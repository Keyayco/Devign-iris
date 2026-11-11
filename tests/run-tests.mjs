// Dependency-free unit tests for the DOM-free modules. Run: node tests/run-tests.mjs
import assert from 'node:assert/strict';
import { validate, FIELDS, COLLECTIONS } from '../js/schema.js';
import { createStore, STORAGE_KEY } from '../js/store.js';
import { getSampleRecords } from '../js/sample-data.js';
import { runCommand } from '../js/commands.js';
import { dataMode, attentionReasons, todayISO, isOverdue } from '../js/selectors.js';
import {
  createGitHubClient, eligibleRepositories, parseGitHubRepositoryUrl, shouldRefreshGitHub
} from '../js/integrations/github.js';
import { createGitHubCache, GITHUB_CACHE_KEY } from '../js/integrations/github-cache.js';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const memStorage = (seed = {}) => {
  const d = { ...seed };
  return { d, getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } };
};
const NOW = new Date('2026-10-12T10:00:00Z');
const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(body == null ? null : JSON.stringify(body), { status, headers });
const githubRepo = (id, name, overrides = {}) => ({
  id, name, full_name: `Keyayco/${name}`,
  owner: { login: 'Keyayco' }, private: false, fork: false,
  description: `${name} description`, html_url: `https://github.com/Keyayco/${name}`,
  default_branch: 'main', pushed_at: '2026-11-02T00:00:00Z', size: 10, language: 'JavaScript',
  ...overrides
});
test('validate: required, enum, date, project reference', () => {
  assert.equal(validate('projects', { name: '' }).ok, false);
  assert.equal(validate('projects', { name: 'X', state: 'bogus' }).errors.state !== undefined, true);
  assert.equal(validate('tasks', { title: 'T', due: '12/10/2026' }).errors.due !== undefined, true);
  assert.equal(validate('tasks', { title: 'T', projectId: 'nope' }, []).errors.projectId !== undefined, true);
  const ok = validate('tasks', { title: ' T ', projectId: 'p1', due: '2026-10-12' }, ['p1']);
  assert.equal(ok.ok, true); assert.equal(ok.record.title, 'T'); assert.equal(ok.record.priority, 'medium');
  assert.equal(validate('nope', {}).ok, false);
});

test('validate: activity defaults to reported evidence, never verified', () => {
  const r = validate('activity', { summary: 'did a thing' });
  assert.equal(r.ok, true); assert.equal(r.record.evidence, 'reported');
});

test('store: add / update / remove and project detach', () => {
  const s = createStore(null);
  const p = s.add('projects', { name: 'Alpha' }).record;
  const t = s.add('tasks', { title: 'Do it', projectId: p.id }).record;
  assert.equal(s.getState().tasks[0].projectId, p.id);
  assert.equal(s.update('projects', p.id, { name: 'Alpha2' }).record.name, 'Alpha2');
  assert.equal(s.update('projects', 'missing', { name: 'x' }).ok, false);
  assert.equal(s.add('projects', { name: '' }).ok, false);
  assert.equal(s.remove('projects', p.id), true);
  assert.equal(s.getState().tasks.find((x) => x.id === t.id).projectId, '');
  assert.equal(s.remove('projects', p.id), false);
});

test('store: persists and reloads through storage', () => {
  const st = memStorage();
  const a = createStore(st); a.add('projects', { name: 'Persisted' });
  const b = createStore(st);
  assert.equal(b.getState().projects[0].name, 'Persisted');
  assert.equal(b.getStatus().persisted, true);
});

test('store: corrupt storage is backed up, not silently destroyed', () => {
  const st = memStorage({ [STORAGE_KEY]: '{not json' });
  const s = createStore(st);
  assert.ok(s.getStatus().loadError);
  assert.equal(s.getState().projects.length, 0);
  assert.ok(Object.keys(st.d).some((k) => k.startsWith(`${STORAGE_KEY}:corrupt-`)));
});

test('store: save failure is reported, state kept in memory', () => {
  const st = memStorage(); st.setItem = () => { throw new Error('quota'); };
  const s = createStore(st);
  assert.equal(s.add('projects', { name: 'X' }).ok, true);
  assert.match(s.getStatus().saveError, /quota/);
  assert.equal(s.getState().projects.length, 1);
});

test('store: no storage means memory-only and says so', () => {
  assert.equal(createStore(null).getStatus().persisted, false);
});

test('sample data: valid refs, labelled sample on import, idempotent, removable', () => {
  const sample = getSampleRecords(NOW);
  const ids = new Set(sample.projects.map((p) => p.id));
  for (const c of ['agents', 'activity', 'tasks']) for (const r of sample[c]) assert.ok(!r.projectId || ids.has(r.projectId), `${c} ref`);
  for (const c of COLLECTIONS) for (const r of sample[c]) {
    const v = validate(c, r, [...ids]);
    assert.equal(v.ok, true, `${c}/${r.id}: ${JSON.stringify(v.errors)}`);
  }
  const s = createStore(null);
  const real = s.add('projects', { name: 'Real' }).record;
  assert.ok(s.loadSample(sample) > 0);
  assert.equal(s.loadSample(sample), 0);
  assert.equal(dataMode(s.getState()), 'mixed');
  assert.ok(s.getState().projects.filter((p) => p.sample).length === 3);
  s.clearSample();
  assert.equal(s.getState().projects.length, 1);
  assert.equal(s.getState().projects[0].id, real.id);
  assert.equal(dataMode(s.getState()), 'stored');
});

test('selectors: dataMode empty / sample', () => {
  const s = createStore(null);
  assert.equal(dataMode(s.getState()), 'empty');
  s.loadSample(getSampleRecords(NOW));
  assert.equal(dataMode(s.getState()), 'sample');
});

test('selectors: overdue uses local date and excludes due-today, future, completed, and undated tasks', () => {
  const originalTZ = process.env.TZ;
  try {
    process.env.TZ = 'Africa/Johannesburg';
    const afterLocalMidnight = new Date('2026-10-12T22:30:00.000Z');
    assert.equal(todayISO(afterLocalMidnight), '2026-10-13');
    assert.equal(isOverdue({ status: 'open', due: '2026-10-12' }, afterLocalMidnight), true);
    assert.equal(isOverdue({ status: 'open', due: '2026-10-13' }, afterLocalMidnight), false);
    assert.equal(isOverdue({ status: 'open', due: '2026-10-14' }, afterLocalMidnight), false);
    assert.equal(isOverdue({ status: 'open', due: '' }, afterLocalMidnight), false);

    process.env.TZ = 'America/Los_Angeles';
    const beforeLocalMidnight = new Date('2026-10-13T00:30:00.000Z');
    assert.equal(todayISO(beforeLocalMidnight), '2026-10-12');
    assert.equal(isOverdue({ status: 'open', due: '2026-10-12' }, beforeLocalMidnight), false);
    assert.equal(isOverdue({ status: 'open', due: '2026-10-11' }, beforeLocalMidnight), true);
    assert.equal(isOverdue({ status: 'done', due: '2026-10-11' }, beforeLocalMidnight), false);
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});

test('GitHub name-search eligibility keeps only public, non-fork repositories owned by the configured account', () => {
  const repos = [
    { full_name: 'Keyayco/public', owner: { login: 'Keyayco' }, private: false, fork: false },
    { full_name: 'Keyayco/fork', owner: { login: 'Keyayco' }, private: false, fork: true },
    { full_name: 'Keyayco/private', owner: { login: 'Keyayco' }, private: true, fork: false },
    { full_name: 'other/public', owner: { login: 'someone-else' }, private: false, fork: false }
  ];
  assert.deepEqual(eligibleRepositories(repos).map((repo) => repo.full_name), ['Keyayco/public']);
});

test('GitHub repository URL validation accepts direct HTTPS repos and rejects unsafe or non-repository URLs', () => {
  const valid = parseGitHubRepositoryUrl('https://github.com/Keyayco/Devign-iris.git/');
  assert.equal(valid.ok, true);
  assert.equal(valid.fullName, 'Keyayco/Devign-iris');
  assert.equal(valid.url, 'https://github.com/Keyayco/Devign-iris');
  for (const value of [
    'http://github.com/Keyayco/iris',
    'https://github.com.evil.example/Keyayco/iris',
    'https://github.com/Keyayco/iris/issues/1',
    'https://github.com/Keyayco/iris?tab=readme',
    'https://user:pass@github.com/Keyayco/iris',
    'not a URL'
  ]) assert.equal(parseGitHubRepositoryUrl(value).ok, false, value);
});

test('legacy cache stays intact but cached repositories are not scanned or tracked on startup', async () => {
  const storage = memStorage();
  const legacyRepos = Array.from({ length: 101 }, (_, i) => ({
    id: 2000 + i, fullName: `Keyayco/old-${i}`, name: `old-${i}`,
    syncState: i < 12 ? 'complete' : 'queued',
    description: `cached ${i}`, docs: [{ path: 'README.md', excerpt: `kept ${i}` }]
  }));
  const cache = createGitHubCache(storage);
  cache.setSnapshot({
    lastSyncAt: '2026-11-04T08:00:00Z',
    repositories: legacyRepos,
    counts: { found: 101, synced: 12, pending: 84, failed: 0 }
  });
  const calls = [];
  const client = createGitHubClient({
    cache: createGitHubCache(storage),
    fetchImpl: async (url) => { calls.push(url); throw new Error('Unexpected network request'); }
  });

  assert.equal(client.getTrackedRepositories().length, 0);
  assert.equal(client.getCachedRepositories().length, 101);
  assert.equal(client.getCachedRepositories()[0].isPublic, true, 'legacy public-cache entries remain explicitly trackable');
  assert.equal(client.getStatus().trackedCount, 0);
  assert.equal(shouldRefreshGitHub(client.getSnapshot(), NOW), false);
  const result = await client.sync();
  assert.equal(result.ok, true);
  assert.equal(calls.length, 0, 'startup state and manual sync do not discover the owner repository list');
  assert.equal(client.getSnapshot().repositories[100].docs[0].excerpt, 'kept 100');
  const fromLegacyCache = createGitHubClient({
    cache: createGitHubCache(storage),
    fetchImpl: async () => { throw new Error('Tracking cached data must not fetch yet'); }
  });
  assert.equal(fromLegacyCache.trackRepository(fromLegacyCache.getCachedRepositories()[0]).ok, true);
  assert.equal(fromLegacyCache.getTrackedRepositories().length, 1);
});

test('GitHub search runs on demand, filters to public owned non-forks, and does not auto-track', async () => {
  const calls = [];
  let conditional = false;
  const items = [
    githubRepo(11, 'iris-app'),
    githubRepo(12, 'iris-fork', { fork: true }),
    githubRepo(13, 'iris-private', { private: true }),
    githubRepo(14, 'iris-other', { full_name: 'Other/iris-other', owner: { login: 'Other' } })
  ];
  const client = createGitHubClient({
    cache: createGitHubCache(memStorage()),
    fetchImpl: async (url, init) => {
      calls.push(url);
      if (init.headers['If-None-Match']) {
        conditional = true;
        return jsonResponse(null, 304, { etag: '"search-v1"', 'x-ratelimit-remaining': '8', 'x-ratelimit-resource': 'search' });
      }
      return jsonResponse({ total_count: 4, items }, 200, {
        etag: '"search-v1"', 'x-ratelimit-remaining': '9', 'x-ratelimit-resource': 'search'
      });
    }
  });

  assert.equal(calls.length, 0, 'search is never issued until requested');
  const first = await client.searchRepositories('iris');
  assert.equal(first.ok, true);
  assert.deepEqual(first.repositories.map((repo) => repo.fullName), ['Keyayco/iris-app']);
  const query = new URL(calls[0]).searchParams.get('q');
  assert.match(query, /user:Keyayco/);
  assert.match(query, /in:name/);
  assert.match(query, /iris/);
  assert.equal(client.getTrackedRepositories().length, 0, 'search results require a separate tracking action');
  assert.equal(client.getStatus().rateLimitResource, 'search');

  const second = await client.searchRepositories('iris');
  assert.equal(second.ok, true);
  assert.equal(conditional, true, 'search requests use the existing ETag cache');
  assert.equal(client.trackRepository(first.repositories[0]).duplicate, false);
  assert.equal(client.trackRepository(first.repositories[0]).duplicate, true);
  assert.equal(client.getTrackedRepositories().length, 1);
});

test('search and sync serialize requests so separate API quota resources are not mixed', async () => {
  let releaseRequest;
  const pendingResponse = new Promise((resolve) => { releaseRequest = resolve; });
  let calls = 0;
  const client = createGitHubClient({
    cache: createGitHubCache(memStorage()),
    fetchImpl: async () => {
      calls += 1;
      await pendingResponse;
      return jsonResponse({ total_count: 0, items: [] }, 200, {
        'x-ratelimit-remaining': '9', 'x-ratelimit-resource': 'search'
      });
    }
  });
  const searching = client.searchRepositories('iris');
  const sync = await client.sync();
  assert.equal(sync.ok, false);
  assert.match(sync.error, /current GitHub request/i);
  assert.equal(calls, 1, 'sync does not start while the search request is in flight');
  releaseRequest();
  assert.equal((await searching).ok, true);
  assert.equal(client.getStatus().rateLimitResource, 'search');
});

test('a pasted public repository URL is checked without tracking until explicit confirmation', async () => {
  const calls = [];
  const client = createGitHubClient({
    cache: createGitHubCache(memStorage()),
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method });
      const parsed = new URL(url);
      if (parsed.pathname === '/repos/Elsewhere/open-project') {
        return jsonResponse({
          id: 701, name: 'open-project', full_name: 'Elsewhere/open-project',
          owner: { login: 'Elsewhere' }, private: false, fork: false,
          html_url: 'https://github.com/Elsewhere/open-project', default_branch: 'main', size: 1
        }, 200, { 'x-ratelimit-remaining': '55', 'x-ratelimit-resource': 'core' });
      }
      if (parsed.pathname === '/repos/Elsewhere/private-project') {
        return jsonResponse({ id: 702, private: true }, 200);
      }
      assert.fail(`Unexpected GitHub request: ${url}`);
    }
  });

  const checked = await client.lookupRepository('https://github.com/Elsewhere/open-project.git');
  assert.equal(checked.ok, true);
  assert.equal(checked.repository.fullName, 'Elsewhere/open-project');
  assert.equal(calls[0].method, 'GET');
  assert.equal(client.getTrackedRepositories().length, 0);
  assert.equal(client.trackRepository(checked.repository).ok, true);
  assert.equal(client.trackRepository({ ...checked.repository, isPublic: false }).ok, false);
  const privateCheck = await client.lookupRepository('https://github.com/Elsewhere/private-project');
  assert.equal(privateCheck.ok, false);
  assert.match(privateCheck.error, /public/i);
  assert.equal(client.getTrackedRepositories().length, 1);
});

test('tracking persists, prevents duplicate entries, and untracking preserves cache and Iris records', () => {
  const storage = memStorage();
  const cachedProfile = {
    id: 811, repoId: 811, fullName: 'Keyayco/legacy-project', name: 'Legacy project',
    isPublic: true,
    description: 'Keep this cached data', url: 'https://github.com/Keyayco/legacy-project',
    defaultBranch: 'main', branches: ['main'], branchCount: 1, commits: [],
    docs: [{ path: 'README.md', excerpt: 'Cached excerpt' }], warnings: [],
    syncedAt: '2026-11-04T08:00:00Z', syncState: 'complete', syncError: ''
  };
  const cache = createGitHubCache(storage);
  cache.setSnapshot({ repositories: [cachedProfile], counts: { found: 1, synced: 1, pending: 0, failed: 0 } });
  const client = createGitHubClient({ cache });
  const selected = githubRepo(812, 'selected-project');
  assert.equal(client.trackRepository(selected).ok, true);
  assert.equal(client.trackRepository(selected).duplicate, true);
  assert.equal(client.trackRepository(cachedProfile).ok, true);

  const reloaded = createGitHubClient({ cache: createGitHubCache(storage) });
  assert.equal(reloaded.getTrackedRepositories().length, 2);
  assert.equal(reloaded.getCachedRepositories().length, 1);
  assert.equal(reloaded.untrackRepository(selected), true);
  assert.equal(reloaded.untrackRepository(selected), false);
  assert.equal(reloaded.getTrackedRepositories().length, 1);
  assert.equal(reloaded.getCachedRepositories()[0].docs[0].excerpt, 'Cached excerpt');
  assert.equal(createGitHubCache(storage).getSnapshot().repositories[0].fullName, 'Keyayco/legacy-project');

  const store = createStore(storage);
  const manual = store.add('projects', { name: 'Legacy project', purpose: 'Keep manual data' }).record;
  store.syncGitHubProjects([cachedProfile]);
  const before = store.getState().projects.find((project) => project.id === manual.id);
  assert.equal(before.purpose, 'Keep manual data');
  assert.equal(before.github.fullName, 'Keyayco/legacy-project');
  assert.equal(reloaded.untrackRepository(cachedProfile), true);
  assert.equal(reloaded.getTrackedRepositories().length, 0);
  const after = store.getState().projects.find((project) => project.id === manual.id);
  assert.deepEqual(after, before, 'untracking has no effect on stored project fields');
});

test('GitHub sync requests details only for tracked repositories and retains other cached profiles', async () => {
  const cachedOnly = {
    id: 901, fullName: 'Keyayco/not-selected', name: 'not-selected',
    description: 'Preserve me', docs: [{ path: 'README.md', excerpt: 'Keep this' }],
    syncState: 'complete', syncedAt: '2026-11-02T00:00:00Z'
  };
  const cache = createGitHubCache(memStorage());
  cache.setSnapshot({ repositories: [cachedOnly] });
  const selected = githubRepo(902, 'selected', { description: 'Chosen repository' });
  const calls = [];
  const client = createGitHubClient({
    cache,
    fetchImpl: async (url) => {
      calls.push(url);
      const parsed = new URL(url);
      assert.notEqual(parsed.pathname, '/users/Keyayco/repos', 'sync must not rediscover all repositories');
      assert.ok(parsed.pathname.startsWith('/repos/Keyayco/selected/'), `unexpected repository request ${url}`);
      if (parsed.pathname.endsWith('/branches')) return jsonResponse([{ name: 'main' }]);
      if (parsed.pathname.endsWith('/commits')) return jsonResponse([]);
      if (parsed.pathname.includes('/git/trees/')) return jsonResponse({ truncated: false, tree: [] });
      assert.fail(`Unexpected GitHub request: ${url}`);
    }
  });
  client.trackRepository(selected);
  const result = await client.sync();

  assert.equal(result.ok, true);
  assert.equal(result.repositories.length, 1);
  assert.equal(result.repositories[0].fullName, 'Keyayco/selected');
  assert.equal(calls.length, 3);
  assert.equal(client.getSnapshot().repositories.length, 2);
  assert.deepEqual(client.getSnapshot().repositories.find((repo) => repo.id === 901), cachedOnly);
  assert.equal(client.getStatus().trackedCount, 1);
  assert.equal(client.getStatus().cachedCount, 2);
});

test('GitHub selective sync paginates branches, reads docs/commits, and flags objective doc conflicts', async () => {
  const storage = memStorage();
  const cache = createGitHubCache(storage);
  const repo = {
    id: 1001, name: 'Iris', full_name: 'Keyayco/iris',
    owner: { login: 'Keyayco' }, private: false, fork: false,
    description: 'Project command centre', html_url: 'https://github.com/Keyayco/iris',
    default_branch: 'main', pushed_at: '2026-11-01T11:00:00Z', size: 120
  };
  const branchPageOne = [
    ...Array.from({ length: 99 }, (_, i) => ({ name: `feature-${i + 1}` })),
    { name: 'main' }
  ];
  const commitSha = 'abcdef0123456789abcdef0123456789abcdef01';
  const responsesByUrl = new Map();
  const calls = [];
  const fixedNow = new Date('2026-11-03T12:00:00Z');
  const fetchImpl = async (url, init) => {
    calls.push(url);
    if (init.headers['If-None-Match']) {
      return jsonResponse(null, 304, { etag: init.headers['If-None-Match'] });
    }

    const parsed = new URL(url);
    if (parsed.hostname === 'raw.githubusercontent.com') {
      if (parsed.pathname.endsWith('/README.md')) {
        return new Response('# Iris\nPublic project documentation.', { status: 200 });
      }
      if (parsed.pathname.endsWith('/STATE.md')) {
        return new Response('Last updated: 2026-09-01\nDefault branch: develop\nCurrent revision: deadbeef', { status: 200 });
      }
      return new Response('', { status: 404 });
    }
    let body;
    let headers = {};
    if (parsed.pathname === '/repos/Keyayco/iris/branches') {
      if (!parsed.searchParams.has('page') || parsed.searchParams.get('page') === '1') {
        body = branchPageOne;
        headers.link = '<https://api.github.com/repos/Keyayco/iris/branches?per_page=100&page=2>; rel="next"';
      } else body = [{ name: 'release' }];
    } else if (parsed.pathname === '/repos/Keyayco/iris/commits') {
      body = [{
        sha: commitSha,
        html_url: `https://github.com/Keyayco/iris/commit/${commitSha}`,
        commit: {
          message: 'Improve sync status\nMore details',
          author: { name: 'Devign' },
          committer: { date: '2026-11-01T11:00:00Z' }
        }
      }];
    } else if (parsed.pathname === '/repos/Keyayco/iris/git/trees/main') {
      body = {
        truncated: false,
        tree: [
          { path: 'README.md', type: 'blob', size: 120 },
          { path: 'STATE.md', type: 'blob', size: 150 },
          { path: 'HANDOVER.md', type: 'blob', size: 100 },
          { path: '.github/notes.md', type: 'blob', size: 80 },
          { path: 'node_modules/README.md', type: 'blob', size: 80 }
        ]
      };
    } else {
      assert.fail(`Unexpected GitHub request: ${url}`);
    }

    const etag = `"${Math.abs(url.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0))}"`;
    responsesByUrl.set(url, { body, etag, headers });
    return jsonResponse(body, 200, { ...headers, etag });
  };
  const client = createGitHubClient({ fetchImpl, cache, clock: () => fixedNow });
  client.trackRepository(repo);

  const first = await client.sync();
  assert.equal(first.ok, true, JSON.stringify(first.status));
  assert.equal(first.repositories.length, 1);
  assert.equal(first.status.counts.found, 1);
  assert.equal(first.status.counts.synced, 1);
  const profile = first.repositories[0];
  assert.equal(profile.fullName, 'Keyayco/iris');
  assert.equal(profile.description, 'Project command centre');
  assert.equal(profile.branchCount, 101);
  assert.equal(profile.branches.length, 20);
  assert.equal(profile.commits[0].shortSha, commitSha.slice(0, 7));
  assert.deepEqual(profile.docs.map((doc) => doc.path), ['README.md', 'STATE.md']);
  assert.ok(profile.warnings.some((warning) => warning.type === 'conflict' && /default branch/.test(warning.message)));
  assert.ok(profile.warnings.some((warning) => warning.type === 'conflict' && /revision/.test(warning.message)));
  assert.ok(profile.warnings.some((warning) => warning.type === 'outdated'));
  assert.equal(profile.tests, undefined);
  assert.equal(profile.deployment, undefined);
  assert.equal(calls.some((url) => new URL(url).pathname === '/users/Keyayco/repos'), false);
  assert.ok(calls.some((url) => new URL(url).searchParams.get('page') === '2' && new URL(url).pathname === '/repos/Keyayco/iris/branches'));
  assert.equal(calls.some((url) => url.includes('.github%2Fnotes.md') || url.includes('node_modules')), false);
  assert.ok(storage.d[GITHUB_CACHE_KEY]);

  const callsBeforeCachedSync = calls.length;
  const second = await client.sync();
  assert.equal(second.ok, true);
  assert.equal(calls.length, callsBeforeCachedSync, 'unchanged tracked repositories reuse cached details without a discovery pass');
  assert.equal(second.repositories[0].docs.length, 2);
  assert.equal(responsesByUrl.size > 0, true);
});

test('GitHub project upsert avoids duplicates and preserves manual fields and name edits', () => {
  const storage = memStorage();
  const store = createStore(storage, () => new Date('2026-11-03T12:00:00Z'));
  const firstManual = store.add('projects', {
    name: 'Iris', purpose: 'Private manual purpose', state: 'active',
    constraints: 'Keep the shell simple', lastImplementation: 'Human note',
    blockers: 'No blockers', nextAction: 'Review next milestone'
  }).record;
  store.add('projects', { name: 'Iris', purpose: 'Second manual record' });

  const profile = {
    id: 101, repoId: 101, fullName: 'Keyayco/iris', name: 'Iris',
    description: 'GitHub description', url: 'https://github.com/Keyayco/iris',
    defaultBranch: 'main', branches: ['main'], branchCount: 1,
    commits: [], docs: [], warnings: [], syncedAt: '2026-11-03T12:00:00.000Z',
    syncError: '', availableInOwnerList: true
  };
  const initial = store.syncGitHubProjects([profile]);
  assert.equal(initial.created, 0);
  assert.equal(initial.matchedManual, 1);
  assert.equal(initial.conflicts, 1);
  assert.equal(store.getState().projects.length, 2);
  let linked = store.getState().projects.find((project) => project.id === firstManual.id);
  assert.equal(linked.purpose, 'Private manual purpose');
  assert.equal(linked.state, 'active');
  assert.equal(linked.constraints, 'Keep the shell simple');
  assert.equal(linked.lastImplementation, 'Human note');
  assert.equal(linked.nextAction, 'Review next milestone');
  assert.equal(linked.github.description, 'GitHub description');
  assert.equal(linked.github.identityConflict, true);

  store.syncGitHubProjects([{ ...profile, description: 'Updated GitHub description' }]);
  linked = store.getState().projects.find((project) => project.id === firstManual.id);
  assert.equal(linked.purpose, 'Private manual purpose');
  assert.equal(linked.github.description, 'Updated GitHub description');

  const renamed = store.update('projects', firstManual.id, {
    ...linked, name: 'My Iris Notes'
  });
  assert.equal(renamed.ok, true);
  assert.equal(renamed.record.github.nameOverride, true);
  store.syncGitHubProjects([{ ...profile, name: 'Iris v2' }]);
  linked = store.getState().projects.find((project) => project.id === firstManual.id);
  assert.equal(linked.name, 'My Iris Notes');
  assert.equal(linked.github.name, 'Iris v2');

  const newRepo = { ...profile, id: 202, repoId: 202, fullName: 'Keyayco/new-project', name: 'New project' };
  store.syncGitHubProjects([newRepo]);
  store.syncGitHubProjects([newRepo]);
  assert.equal(store.getState().projects.filter((project) => project.github?.repoId === 202).length, 1);
  assert.equal(store.getState().projects.length, 3);

  const reloaded = createStore(storage);
  const persisted = reloaded.getState().projects.find((project) => project.id === firstManual.id);
  assert.equal(persisted.purpose, 'Private manual purpose');
  assert.equal(persisted.github.fullName, 'Keyayco/iris');
});

test('GitHub refresh respects stale and retry windows', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  assert.equal(shouldRefreshGitHub({}, now), false, 'no repositories are scanned without an explicit tracking choice');
  const tracked = [{ id: 1, fullName: 'Keyayco/a', name: 'a' }];
  const syncedProfile = { id: 1, fullName: 'Keyayco/a', syncState: 'complete' };
  assert.equal(shouldRefreshGitHub({ trackedRepositories: tracked }, now), true);
  assert.equal(shouldRefreshGitHub({
    trackedRepositories: tracked,
    repositories: [syncedProfile],
    lastSyncAt: '2026-11-03T11:00:00Z',
    lastAttemptAt: '2026-11-03T11:55:00Z'
  }, now), false);
  assert.equal(shouldRefreshGitHub({
    trackedRepositories: tracked,
    repositories: [syncedProfile],
    lastSyncAt: '2026-11-03T05:00:00Z',
    lastAttemptAt: '2026-11-03T05:00:00Z'
  }, now), true);
  assert.equal(shouldRefreshGitHub({
    trackedRepositories: tracked,
    repositories: [syncedProfile],
    lastAttemptAt: '2026-11-03T11:55:00Z'
  }, now), false);
  assert.equal(shouldRefreshGitHub({
    trackedRepositories: tracked,
    repositories: [{ id: 1, fullName: 'Keyayco/a', syncState: 'queued' }],
    lastAttemptAt: '2026-11-03T11:55:00Z',
    rateLimitResetAt: '2026-11-03T11:59:00Z',
  }, now), true, 'queued work should resume after the quota reset, even inside the retry cooldown');
});

test('GitHub sync skips empty repositories without detail API calls', async () => {
  const cache = createGitHubCache(memStorage());
  const calls = [];
  const empty = {
    id: 501, name: 'empty', full_name: 'Keyayco/empty',
    owner: { login: 'Keyayco' }, private: false, fork: false,
    description: 'A repository with no commits', html_url: 'https://github.com/Keyayco/empty',
    default_branch: '', pushed_at: null, size: 0
  };
  const client = createGitHubClient({
    cache,
    clock: () => new Date('2026-11-03T12:00:00Z'),
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse([empty]);
    }
  });
  client.trackRepository(empty);
  const result = await client.sync();
  assert.equal(result.ok, true);
  assert.equal(result.status.counts.synced, 1);
  assert.equal(result.repositories[0].syncState, 'empty');
  assert.equal(result.repositories[0].empty, true);
  assert.equal(calls.length, 0, 'an explicitly tracked empty repository needs no detail requests');
});

test('GitHub sync treats missing documents as optional and preserves cached project data on API errors', async () => {
  const cache = createGitHubCache(memStorage());
  const cachedDoc = { path: 'README.md', url: 'https://github.com/Keyayco/retry/blob/main/README.md', excerpt: 'Cached readme' };
  const prior = {
    id: 901, fullName: 'Keyayco/retry', name: 'retry',
    description: 'Last successful description', url: 'https://github.com/Keyayco/retry',
    defaultBranch: 'main', pushedAt: '2026-11-01T00:00:00Z',
    branches: ['main'], branchCount: 1, commits: [], docs: [cachedDoc], warnings: [],
    syncedAt: '2026-11-02T12:00:00Z', syncState: 'complete', syncError: ''
  };
  cache.setSnapshot({
    lastAttemptAt: '2026-11-02T12:00:00Z',
    lastSyncAt: '2026-11-02T12:00:00Z',
    repositories: [prior],
    counts: { found: 1, synced: 1, pending: 0, failed: 0 }
  });
  const repo = {
    id: 901, name: 'retry', full_name: 'Keyayco/retry',
    owner: { login: 'Keyayco' }, private: false, fork: false,
    description: 'Current GitHub description', html_url: 'https://github.com/Keyayco/retry',
    default_branch: 'main', pushed_at: '2026-11-03T00:00:00Z', size: 50
  };
  const client = createGitHubClient({
    cache,
    clock: () => new Date('2026-11-03T12:00:00Z'),
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/branches')) {
        return jsonResponse({ message: 'temporary upstream failure' }, 500);
      }
      if (parsed.pathname.endsWith('/commits')) return jsonResponse([]);
      if (parsed.pathname.includes('/git/trees/')) return jsonResponse({ truncated: false, tree: [] });
      if (parsed.hostname === 'raw.githubusercontent.com') return new Response('', { status: 404 });
      assert.fail(`Unexpected request: ${url}`);
    }
  });
  client.trackRepository(repo);

  const result = await client.sync();
  assert.equal(result.ok, false);
  assert.equal(result.status.counts.failed, 1);
  assert.equal(result.repositories[0].syncState, 'error');
  assert.equal(result.repositories[0].description, 'Current GitHub description');
  assert.deepEqual(result.repositories[0].docs, [cachedDoc]);
  assert.match(result.repositories[0].syncError, /HTTP 500/);
});

test('GitHub sync queues work within the public API budget and resumes after reset', async () => {
  const cache = createGitHubCache(memStorage());
  let now = new Date('2026-11-03T12:00:00Z');
  let apiCalls = 0;
  const resetSeconds = String(Math.floor(Date.parse('2026-11-03T13:00:00Z') / 1000));
  let postResetCalls = 0;
  const repos = Array.from({ length: 20 }, (_, i) => ({
    id: 700 + i, name: `project-${i}`, full_name: `Keyayco/project-${i}`,
    owner: { login: 'Keyayco' }, private: false, fork: false,
    description: '', html_url: `https://github.com/Keyayco/project-${i}`,
    default_branch: 'main', pushed_at: '2026-11-02T00:00:00Z', size: 10
  }));
  const headers = () => ({
    'x-ratelimit-remaining': String(Math.max(0, 59 - apiCalls)),
    'x-ratelimit-reset': resetSeconds
  });
  const fetchImpl = async (url) => {
    apiCalls += 1;
    if (now.getTime() >= Date.parse('2026-11-03T13:00:00Z')) postResetCalls += 1;
    const parsed = new URL(url);
    let body;
    if (parsed.pathname.endsWith('/branches')) body = [{ name: 'main' }];
    else if (parsed.pathname.endsWith('/commits')) body = [];
    else if (parsed.pathname.includes('/git/trees/')) body = { truncated: false, tree: [] };
    else assert.fail(`Unexpected request: ${url}`);
    const remaining = now.getTime() >= Date.parse('2026-11-03T13:00:00Z')
      ? String(Math.max(0, 59 - postResetCalls))
      : String(Math.max(0, 59 - apiCalls));
    return jsonResponse(body, 200, {
      ...headers(),
      'x-ratelimit-remaining': remaining
    });
  };
  const client = createGitHubClient({ cache, clock: () => now, fetchImpl });
  for (const repo of repos) client.trackRepository(repo);

  const first = await client.sync();
  assert.equal(first.status.counts.found, 20);
  assert.equal(first.status.counts.synced, 12);
  assert.equal(first.status.counts.pending, 8);
  assert.equal(apiCalls, 36, 'sync makes three GitHub API calls for each of 12 tracked repositories');
  assert.ok(Number(first.status.rateLimitRemaining) >= 8, 'leave rate-limit reserve for normal page variation');
  assert.match(first.status.notice, /queued.*quota resets/i);

  const callsBeforeEarlyRetry = apiCalls;
  await client.sync();
  assert.equal(apiCalls, callsBeforeEarlyRetry, 'do not retry queued work before the quota reset');

  now = new Date('2026-11-03T13:01:00Z');
  const resumed = await client.sync();
  assert.equal(resumed.ok, true, JSON.stringify(resumed.status));
  assert.equal(resumed.status.counts.found, 20);
  assert.equal(resumed.status.counts.synced, 20);
  assert.equal(resumed.status.counts.pending, 0);
  assert.equal(resumed.repositories.filter((repo) => repo.syncState === 'complete').length, 20);
});

test('GitHub API rate-limit failures preserve the last successful cache', async () => {
  const storage = memStorage();
  const cache = createGitHubCache(storage);
  const prior = {
    id: 1, repoId: 1, fullName: 'Keyayco/cached', name: 'cached',
    description: 'Last known description', url: 'https://github.com/Keyayco/cached',
    defaultBranch: 'main', branches: ['main'], branchCount: 1,
    commits: [], docs: [], warnings: [], syncedAt: '2026-11-02T12:00:00Z',
    syncError: '', availableInOwnerList: true
  };
  cache.setSnapshot({
    lastAttemptAt: '2026-11-02T12:00:00Z',
    lastSyncAt: '2026-11-02T12:00:00Z',
    repositories: [prior],
    counts: { found: 1, synced: 1, failed: 0 },
    error: ''
  });
  const reset = String(Math.floor(Date.parse('2026-11-03T13:00:00Z') / 1000));
  const client = createGitHubClient({
    cache,
    clock: () => new Date('2026-11-03T12:00:00Z'),
    fetchImpl: async () => jsonResponse({ message: 'API rate limit exceeded' }, 403, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': reset
    })
  });
  client.trackRepository(githubRepo(1, 'cached', {
    description: 'Last known description',
    pushed_at: '2026-11-02T00:00:00Z'
  }));

  const result = await client.sync();
  assert.equal(result.ok, false);
  assert.equal(result.status.phase, 'partial');
  assert.equal(result.status.counts.pending, 1);
  assert.match(result.status.notice, /quota resets/i);
  assert.equal(result.repositories[0].syncState, 'queued');
  assert.equal(result.repositories[0].fullName, 'Keyayco/cached');
  assert.equal(client.getSnapshot().lastSyncAt, '2026-11-02T12:00:00Z');
  assert.equal(client.getSnapshot().repositories[0].description, 'Last known description');
});

test('task done toggle', () => {
  const s = createStore(null);
  const t = s.add('tasks', { title: 'x' }).record;
  assert.equal(s.setTaskDone(t.id, true), true);
  assert.equal(s.getState().tasks[0].status, 'done');
  assert.equal(s.setTaskDone('nope', true), false);
});

test('commands: empty state is honest, nothing invented', () => {
  const s = createStore(null);
  const b = runCommand('briefing', s.getState(), NOW).lines.join(' ');
  assert.match(b, /Nothing is recorded yet/);
  assert.match(runCommand('what did we implement last', s.getState(), NOW).lines[0], /No implementation activity recorded/);
  assert.match(runCommand('which projects need attention', s.getState(), NOW).lines[0], /No projects recorded/);
});

test('commands: navigation, add task action, unknown input', () => {
  const s = createStore(null).getState();
  assert.deepEqual(runCommand('open agents', s).view, 'agents');
  assert.equal(runCommand('go to tasks', s).kind, 'navigate');
  const a = runCommand('Add task Call the Client', s);
  assert.equal(a.kind, 'action'); assert.equal(a.action.input.title, 'Call the Client');
  const u = runCommand('write me a poem', s);
  assert.equal(u.kind, 'reply'); assert.match(u.lines.join(' '), /did not recognise/);
});

test('commands: answers from sample data are tagged [sample]', () => {
  const s = createStore(null); s.loadSample(getSampleRecords(NOW));
  const st = s.getState();
  assert.match(runCommand('which projects need attention', st, NOW).lines.join('\n'), /Client Portal \[sample\]: marked blocked/);
  assert.match(runCommand('what is blocking client portal', st, NOW).lines.join(' '), /sign in/);
  assert.match(runCommand('what did we implement last', st, NOW).lines.join(' '), /\[sample\]/);
  assert.match(runCommand('what is blocking nonexistent', st, NOW).lines[0], /No project matches/);
  assert.match(runCommand('handover', st, NOW).lines[0], /does not reflect repository/);
  const lf = st.projects.find((p) => p.id === 'sample-p-leadforge');
  assert.ok(attentionReasons(st, lf, NOW).some((r) => /overdue/.test(r)));
});

test('field specs: every collection has a required field and unique names', () => {
  for (const c of COLLECTIONS) {
    const names = FIELDS[c].map((f) => f.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(FIELDS[c].some((f) => f.required));
  }
});

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log(`PASS  ${name}`); } catch (e) { failed += 1; console.log(`FAIL  ${name}\n      ${e.stack || e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
