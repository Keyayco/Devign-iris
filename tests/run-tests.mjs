// Dependency-free unit tests for the DOM-free modules. Run: node tests/run-tests.mjs
import assert from 'node:assert/strict';
import { validate, FIELDS, COLLECTIONS } from '../js/schema.js';
import { createStore, STORAGE_KEY } from '../js/store.js';
import { getSampleRecords } from '../js/sample-data.js';
import { runCommand } from '../js/commands.js';
import { dataMode, attentionReasons, todayISO, isOverdue } from '../js/selectors.js';
import { createGitHubClient, eligibleRepositories, shouldRefreshGitHub } from '../js/integrations/github.js';
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

test('GitHub discovery keeps only public, non-fork repositories owned by the configured account', () => {
  const repos = [
    { full_name: 'Keyayco/public', owner: { login: 'Keyayco' }, private: false, fork: false },
    { full_name: 'Keyayco/fork', owner: { login: 'Keyayco' }, private: false, fork: true },
    { full_name: 'Keyayco/private', owner: { login: 'Keyayco' }, private: true, fork: false },
    { full_name: 'other/public', owner: { login: 'someone-else' }, private: false, fork: false }
  ];
  assert.deepEqual(eligibleRepositories(repos).map((repo) => repo.full_name), ['Keyayco/public']);
});

test('GitHub sync paginates discovery and branches, reads docs/commits, and flags objective doc conflicts', async () => {
  const storage = memStorage();
  const cache = createGitHubCache(storage);
  const repo = {
    id: 1001, name: 'Iris', full_name: 'Keyayco/iris',
    owner: { login: 'Keyayco' }, private: false, fork: false,
    description: 'Project command centre', html_url: 'https://github.com/Keyayco/iris',
    default_branch: 'main', pushed_at: '2026-11-01T11:00:00Z', size: 120
  };
  const listPageOne = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1, name: `fork-${i}`, full_name: `Keyayco/fork-${i}`,
    owner: { login: 'Keyayco' }, private: false, fork: true
  }));
  const branchPageOne = [
    ...Array.from({ length: 99 }, (_, i) => ({ name: `feature-${i + 1}` })),
    { name: 'main' }
  ];
  const commitSha = 'abcdef0123456789abcdef0123456789abcdef01';
  const responsesByUrl = new Map();
  const calls = [];
  let conditionalRequests = 0;
  const fixedNow = new Date('2026-11-03T12:00:00Z');
  const fetchImpl = async (url, init) => {
    calls.push(url);
    if (init.headers['If-None-Match']) {
      conditionalRequests += 1;
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
    if (parsed.pathname === '/users/Keyayco/repos') {
      if (parsed.searchParams.get('page') === '1') {
        body = listPageOne;
        headers.link = '<https://api.github.com/users/Keyayco/repos?type=owner&sort=pushed&per_page=100&page=2>; rel="next"';
      } else body = [repo];
    } else if (parsed.pathname === '/repos/Keyayco/iris/branches') {
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
  assert.ok(calls.some((url) => new URL(url).searchParams.get('page') === '2' && new URL(url).pathname === '/users/Keyayco/repos'));
  assert.ok(calls.some((url) => new URL(url).searchParams.get('page') === '2' && new URL(url).pathname === '/repos/Keyayco/iris/branches'));
  assert.equal(calls.some((url) => url.includes('.github%2Fnotes.md') || url.includes('node_modules')), false);
  assert.ok(storage.d[GITHUB_CACHE_KEY]);

  const second = await client.sync();
  assert.equal(second.ok, true);
  assert.ok(conditionalRequests > 0, 'cached ETags should enable conditional requests');
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
  assert.equal(shouldRefreshGitHub({}, now), true);
  assert.equal(shouldRefreshGitHub({
    lastSyncAt: '2026-11-03T11:00:00Z',
    lastAttemptAt: '2026-11-03T11:55:00Z'
  }, now), false);
  assert.equal(shouldRefreshGitHub({
    lastSyncAt: '2026-11-03T05:00:00Z',
    lastAttemptAt: '2026-11-03T05:00:00Z'
  }, now), true);
  assert.equal(shouldRefreshGitHub({
    lastAttemptAt: '2026-11-03T11:55:00Z'
  }, now), false);
  assert.equal(shouldRefreshGitHub({
    lastAttemptAt: '2026-11-03T11:55:00Z',
    rateLimitResetAt: '2026-11-03T11:59:00Z',
    counts: { pending: 2 }
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
  const result = await client.sync();
  assert.equal(result.ok, true);
  assert.equal(result.status.counts.synced, 1);
  assert.equal(result.repositories[0].syncState, 'empty');
  assert.equal(result.repositories[0].empty, true);
  assert.equal(calls.length, 1, 'only the owner repository list should be requested');
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
      if (parsed.pathname === '/users/Keyayco/repos') return jsonResponse([repo]);
      if (parsed.pathname.endsWith('/branches')) {
        return jsonResponse({ message: 'temporary upstream failure' }, 500);
      }
      if (parsed.pathname.endsWith('/commits')) return jsonResponse([]);
      if (parsed.pathname.includes('/git/trees/')) return jsonResponse({ truncated: false, tree: [] });
      if (parsed.hostname === 'raw.githubusercontent.com') return new Response('', { status: 404 });
      assert.fail(`Unexpected request: ${url}`);
    }
  });

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
    if (parsed.pathname === '/users/Keyayco/repos') body = repos;
    else if (parsed.pathname.endsWith('/branches')) body = [{ name: 'main' }];
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

  const first = await client.sync();
  assert.equal(first.status.counts.found, 20);
  assert.equal(first.status.counts.synced, 12);
  assert.equal(first.status.counts.pending, 8);
  assert.equal(apiCalls, 37, 'discovery plus three API requests for each of 12 repositories');
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

  const result = await client.sync();
  assert.equal(result.ok, false);
  assert.equal(result.status.phase, 'error');
  assert.match(result.status.error, /rate limit reached/i);
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
