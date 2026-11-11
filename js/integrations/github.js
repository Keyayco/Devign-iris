// Read-only GitHub REST client. It has no DOM, project-store, or credential
// dependencies; storage and UI are injected at the application boundary.
export const GITHUB_OWNER = 'Keyayco';
export const GITHUB_API = 'https://api.github.com';
export const GITHUB_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
export const GITHUB_RETRY_AFTER_MS = 15 * 60 * 1000;

const PER_PAGE = 100;
const MAX_PAGES = 100;
const MAX_DOCS = 10;
const MAX_DOC_BYTES = 100_000;
const MAX_EXCERPT_CHARS = 320;
const DAY_MS = 24 * 60 * 60 * 1000;
const API_REQUESTS_PER_REPOSITORY = 4;
const API_RESERVE = 8;
const MAX_REPOSITORY_DETAILS_PER_SYNC = 12;
const DOC_PRIORITY = [
  'README.md', 'STATE.md', 'HANDOVER.md', 'LOGS.md', 'FILE_MANIFEST.md',
  'RULES.md', 'CHANGELOG.md', 'ARCHITECTURE.md', 'CONTRIBUTING.md',
  'ROADMAP.md', 'TODO.md'
];
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'vendor', 'dist', 'build']);

export class GitHubApiError extends Error {
  constructor(message, { status = 0, rateLimited = false, resetAt = '', url = '' } = {}) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.rateLimited = rateLimited;
    this.resetAt = resetAt;
    this.url = url;
  }
}

function isoNow(clock) {
  const value = clock();
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function encodeRepoPath(fullName) {
  return String(fullName).split('/').map(encodeURIComponent).join('/');
}

function encodeFilePath(path) {
  return String(path).split('/').map(encodeURIComponent).join('/');
}

function safeApiUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'api.github.com' ? url.href : '';
  } catch {
    return '';
  }
}

function header(headers, name) {
  if (!headers || typeof headers.get !== 'function') return '';
  const value = headers.get(name);
  return value == null ? '' : value;
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return '';
  const parts = String(linkHeader).split(/,(?=\s*<)/);
  for (const part of parts) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (match) return safeApiUrl(match[1]);
  }
  return '';
}

function withPage(url, page) {
  const parsed = new URL(url);
  parsed.searchParams.set('page', String(page));
  if (!parsed.searchParams.has('per_page')) parsed.searchParams.set('per_page', String(PER_PAGE));
  return parsed.href;
}

function rateReset(headers) {
  const seconds = Number(header(headers, 'x-ratelimit-reset'));
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : '';
}

function errorFromResponse(status, body, headers, url) {
  const message = body && typeof body.message === 'string' ? body.message : '';
  const remaining = header(headers, 'x-ratelimit-remaining');
  const rateLimited = status === 429 || (status === 403 && (remaining === '0' || /rate limit/i.test(message)));
  if (rateLimited) {
    const resetAt = rateReset(headers);
    return new GitHubApiError(
      resetAt ? `GitHub API rate limit reached. It resets at ${resetAt}.` : 'GitHub API rate limit reached.',
      { status, rateLimited: true, resetAt, url }
    );
  }
  return new GitHubApiError(
    `GitHub returned HTTP ${status}${message ? `: ${message}` : '.'}`,
    { status, url }
  );
}

function formatApiError(error) {
  if (error?.rateLimited) return error.message;
  if (error instanceof GitHubApiError) return error.message;
  return error?.message || 'GitHub could not be reached. Check the network and try again.';
}

export function eligibleRepositories(repositories, owner = GITHUB_OWNER) {
  if (!Array.isArray(repositories)) return [];
  return repositories.filter((repo) =>
    repo && repo.private !== true && repo.fork !== true &&
    String(repo.owner?.login || '').toLowerCase() === String(owner).toLowerCase()
  );
}

export function parseGitHubRepositoryUrl(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) {
    return { ok: false, error: 'Enter a GitHub repository URL.' };
  }
  let url;
  try { url = new URL(text); } catch {
    return { ok: false, error: 'Enter a valid https://github.com/owner/repository URL.' };
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' ||
      url.username || url.password || url.port || url.search || url.hash) {
    return { ok: false, error: 'Use a direct HTTPS GitHub repository URL without query or fragment.' };
  }
  const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (!match || ['.', '..'].includes(match[1]) || ['.', '..'].includes(match[2])) {
    return { ok: false, error: 'Use a direct repository URL, not an issue, file, or profile URL.' };
  }
  const owner = match[1];
  const name = match[2];
  return {
    ok: true,
    owner,
    name,
    fullName: `${owner}/${name}`,
    url: `https://github.com/${owner}/${name}`
  };
}

function normalizeRepository(repo) {
  const fullName = String(repo?.fullName || repo?.full_name || '');
  const owner = String(repo?.owner?.login || repo?.owner || fullName.split('/')?.[0] || '');
  const name = String(repo?.name || fullName.split('/')?.[1] || '');
  return {
    id: repo?.id,
    owner,
    name,
    fullName,
    description: String(repo?.description || ''),
    url: String(repo?.html_url || repo?.url || (fullName ? `https://github.com/${fullName}` : '')),
    defaultBranch: String(repo?.default_branch || repo?.defaultBranch || ''),
    pushedAt: String(repo?.pushed_at || repo?.pushedAt || ''),
    size: Number(repo?.size) || 0,
    language: String(repo?.language || ''),
    isPublic: repo?.private === false || repo?.isPublic === true,
    fork: repo?.fork === true
  };
}

function documentPriority(path) {
  const basename = path.split('/').pop().toUpperCase();
  const exact = DOC_PRIORITY.indexOf(basename);
  if (exact >= 0) return exact;
  return path.toLowerCase().startsWith('docs/') ? DOC_PRIORITY.length : DOC_PRIORITY.length + 1;
}

export function selectProjectDocuments(treeEntries, maxDocs = MAX_DOCS) {
  if (!Array.isArray(treeEntries)) return [];
  return treeEntries
    .filter((entry) => {
      if (!entry || entry.type !== 'blob' || !entry.path) return false;
      const segments = entry.path.split('/');
      if (segments.some((part) => SKIP_DIRS.has(part.toLowerCase()))) return false;
      if (!/\.(md|mdx|rst|txt)$/i.test(entry.path)) return false;
      return entry.size == null || Number(entry.size) <= MAX_DOC_BYTES;
    })
    .sort((a, b) =>
      documentPriority(a.path) - documentPriority(b.path) ||
      a.path.split('/').length - b.path.split('/').length ||
      a.path.localeCompare(b.path)
    )
    .slice(0, maxDocs)
    .map((entry) => ({ path: entry.path, size: Number(entry.size) || 0 }));
}

function textExcerpt(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT_CHARS);
}

function branchClaims(text) {
  const matches = [];
  const expression = /\bdefault\s+branch\s*[:=]\s*[`"' ]*([A-Za-z0-9._/-]+)/gi;
  for (const match of String(text || '').matchAll(expression)) {
    matches.push(match[1].replace(/[.,;:)]+$/, ''));
  }
  return matches;
}

function currentRevisionClaims(text) {
  const matches = [];
  const expression = /\b(?:current|latest)\s+(?:head|commit|revision)\s*[:=]\s*[`"' ]*([a-f0-9]{7,40})/gi;
  for (const match of String(text || '').matchAll(expression)) matches.push(match[1].toLowerCase());
  return matches;
}

function declaredUpdateDate(text) {
  const match = String(text || '').match(/\b(?:last\s+updated|updated\s+on|last\s+modified|as\s+of)\s*[:=—-]\s*(\d{4}-\d{2}-\d{2})/i);
  if (!match) return '';
  const time = Date.parse(`${match[1]}T00:00:00Z`);
  return Number.isNaN(time) ? '' : match[1];
}

export function analyzeDocumentation(documents, { defaultBranch = '', headSha = '', latestCommitDate = '' } = {}) {
  const warnings = [];
  const allBranchClaims = [];
  const head = String(headSha || '').toLowerCase();
  const latestTime = Date.parse(latestCommitDate || '');

  for (const doc of documents || []) {
    const text = doc.text || '';
    for (const branch of branchClaims(text)) {
      allBranchClaims.push({ branch, path: doc.path });
      if (defaultBranch && branch !== defaultBranch) {
        warnings.push({
          type: 'conflict',
          path: doc.path,
          message: `${doc.path} declares default branch "${branch}", while GitHub reports "${defaultBranch}".`
        });
      }
    }
    for (const revision of currentRevisionClaims(text)) {
      if (head && !head.startsWith(revision) && !revision.startsWith(head)) {
        warnings.push({
          type: 'conflict',
          path: doc.path,
          message: `${doc.path} names current revision ${revision}, which differs from the fetched repository HEAD.`
        });
      }
    }

    const declaredDate = declaredUpdateDate(text);
    const declaredTime = Date.parse(`${declaredDate}T00:00:00Z`);
    if (declaredDate && Number.isFinite(latestTime) && latestTime - declaredTime > 30 * DAY_MS) {
      warnings.push({
        type: 'outdated',
        path: doc.path,
        message: `${doc.path} says it was updated ${declaredDate}; the latest repository commit is more than 30 days newer.`
      });
    }
  }

  const distinctBranches = [...new Set(allBranchClaims.map((claim) => claim.branch))];
  if (distinctBranches.length > 1) {
    warnings.push({
      type: 'conflict',
      path: allBranchClaims.map((claim) => claim.path).join(', '),
      message: `Project documents declare different default branches: ${distinctBranches.join(', ')}.`
    });
  }
  return warnings;
}

function normalizeCommit(commit) {
  const sha = String(commit?.sha || '');
  return {
    sha,
    shortSha: sha.slice(0, 7),
    message: String(commit?.commit?.message || '').split('\n')[0].slice(0, 180),
    author: String(commit?.commit?.author?.name || commit?.author?.login || 'Unknown'),
    date: commit?.commit?.committer?.date || commit?.commit?.author?.date || '',
    url: commit?.html_url || ''
  };
}

function fallbackDocumentUrl(repo, branch, path) {
  const ref = encodeURIComponent(branch || 'HEAD');
  const file = encodeFilePath(path);
  return `https://github.com/${repo.full_name}/blob/${ref}/${file}`;
}

function minimalRepository(repo, now) {
  return {
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    isPublic: repo.private !== true,
    description: repo.description || '',
    url: repo.html_url || '',
    defaultBranch: repo.default_branch || '',
    pushedAt: repo.pushed_at || '',
    size: Number(repo.size) || 0,
    language: repo.language || '',
    branches: [],
    branchCount: 0,
    commits: [],
    docs: [],
    warnings: [],
    syncedAt: '',
    syncState: 'queued',
    syncError: '',
    availableInOwnerList: true,
    discoveredAt: now
  };
}

function repositoryWithCurrentMetadata(prior, repo, now) {
  const current = minimalRepository(repo, now);
  return {
    ...current,
    ...(prior || {}),
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    description: repo.description || '',
    url: repo.html_url || '',
    defaultBranch: repo.default_branch || '',
    pushedAt: repo.pushed_at || '',
    size: Number(repo.size) || 0,
    language: repo.language || '',
    empty: false,
    availableInOwnerList: true
  };
}

function isEmptyRepository(repo) {
  return Number(repo.size) === 0 || !repo.default_branch;
}

function emptyRepositoryProfile(repo, now) {
  return {
    ...minimalRepository(repo, now),
    empty: true,
    syncState: 'empty',
    syncedAt: now,
    syncError: ''
  };
}

function queuedRepositoryProfile(prior, repo, now) {
  const profile = repositoryWithCurrentMetadata(prior, repo, now);
  return {
    ...profile,
    syncState: 'queued',
    syncError: '',
    warnings: (profile.warnings || []).filter((warning) => warning.type !== 'sync')
  };
}

function buildPageUrl(path) {
  return `${GITHUB_API}${path}`;
}

export function shouldRefreshGitHub(snapshot, now = new Date()) {
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const lastAttempt = Date.parse(snapshot?.lastAttemptAt || '');
  const lastSync = Date.parse(snapshot?.lastSyncAt || '');
  const rateLimitReset = Date.parse(snapshot?.rateLimitResetAt || '');
  const tracked = Array.isArray(snapshot?.trackedRepositories) ? snapshot.trackedRepositories : [];
  if (!tracked.length) return false;
  const cached = Array.isArray(snapshot?.repositories) ? snapshot.repositories : [];
  const pending = tracked.some((item) => {
    const profile = cached.find((repo) =>
      String(repo.id) === String(item.id) ||
      String(repo.fullName || '').toLowerCase() === String(item.fullName || '').toLowerCase()
    );
    return !profile || profile.syncState === 'queued';
  });
  const staleTracked = tracked.some((item) => {
    const profile = cached.find((repo) =>
      String(repo.id) === String(item.id) ||
      String(repo.fullName || '').toLowerCase() === String(item.fullName || '').toLowerCase()
    );
    const syncedAt = Date.parse(profile?.syncedAt || '');
    return !Number.isFinite(syncedAt) || current - syncedAt >= GITHUB_STALE_AFTER_MS;
  });
  const rateLimitError = pending && /rate limit/i.test(snapshot?.error || '');
  if ((pending || rateLimitError) && Number.isFinite(rateLimitReset) && current < rateLimitReset) return false;
  if ((pending || rateLimitError) && Number.isFinite(rateLimitReset) && current >= rateLimitReset) return true;
  if (Number.isFinite(lastAttempt) && current - lastAttempt < GITHUB_RETRY_AFTER_MS) return false;
  if (pending || staleTracked) return true;
  if (!Number.isFinite(lastSync)) return true;
  return current - lastSync >= GITHUB_STALE_AFTER_MS;
}

export function createGitHubClient({
  fetchImpl = globalThis.fetch,
  cache,
  owner = GITHUB_OWNER,
  clock = () => new Date(),
  onStatus = () => {}
} = {}) {
  let snapshot = cache?.getSnapshot?.() || {
    lastAttemptAt: '', lastSyncAt: '', trackedRepositories: [], repositories: [],
    counts: { found: 0, synced: 0, pending: 0, failed: 0 }, error: ''
  };
  snapshot = {
    ...snapshot,
    trackedRepositories: Array.isArray(snapshot.trackedRepositories) ? snapshot.trackedRepositories : [],
    repositories: Array.isArray(snapshot.repositories) ? snapshot.repositories : []
  };
  let running = null;
  let requestRunning = false;
  const repoMatches = (a, b) =>
    String(a?.id ?? '') === String(b?.id ?? '') ||
    (!!a?.fullName && String(a.fullName).toLowerCase() === String(b?.fullName || '').toLowerCase());

  function cachedProfile(repo) {
    return snapshot.repositories.find((item) => repoMatches(item, repo)) || null;
  }

  function toApiRepository(repo) {
    const tracked = normalizeRepository(repo);
    return {
      id: tracked.id,
      name: tracked.name,
      full_name: tracked.fullName,
      owner: { login: tracked.owner },
      private: !tracked.isPublic,
      fork: tracked.fork,
      description: tracked.description,
      html_url: tracked.url,
      default_branch: tracked.defaultBranch,
      pushed_at: tracked.pushedAt,
      size: tracked.size,
      language: tracked.language
    };
  }

  function profileForTracked(repo) {
    const apiRepo = toApiRepository(repo);
    const prior = cachedProfile(repo);
    return {
      ...minimalRepository(apiRepo, isoNow(clock)),
      ...(prior || {}),
      id: apiRepo.id,
      fullName: apiRepo.full_name,
      name: apiRepo.name,
      description: apiRepo.description || prior?.description || '',
      url: apiRepo.html_url || prior?.url || '',
      defaultBranch: apiRepo.default_branch || prior?.defaultBranch || '',
      pushedAt: apiRepo.pushed_at || prior?.pushedAt || '',
      size: apiRepo.size || prior?.size || 0,
      language: apiRepo.language || prior?.language || '',
      syncState: prior?.syncState || 'queued'
    };
  }

  function summarizeTracked(repositories = snapshot.trackedRepositories) {
    const profiles = repositories.map((repo) => profileForTracked(repo));
    return {
      found: profiles.length,
      synced: profiles.filter((repo) => repo.syncState === 'complete' || repo.syncState === 'empty').length,
      pending: profiles.filter((repo) => repo.syncState === 'queued').length,
      failed: profiles.filter((repo) => repo.syncState === 'error').length
    };
  }

  let status = {
    phase: snapshot.trackedRepositories.length && snapshot.lastSyncAt ? 'cached' : 'idle',
    lastAttemptAt: snapshot.lastAttemptAt || '',
    lastSyncAt: snapshot.lastSyncAt || '',
    counts: summarizeTracked(),
    trackedCount: snapshot.trackedRepositories.length,
    cachedCount: snapshot.repositories.length,
    progress: { completed: 0, total: snapshot.trackedRepositories.length },
    error: snapshot.trackedRepositories.length ? snapshot.error || '' : '',
    notice: snapshot.trackedRepositories.length ? snapshot.notice || '' : '',
    rateLimitRemaining: null,
    rateLimitResetAt: snapshot.rateLimitResetAt || '',
    cache: cache?.getStorageStatus?.() || { available: false, error: '' }
  };

  function notify() {
    status = {
      ...status,
      counts: status.phase === 'syncing' ? status.counts : summarizeTracked(),
      trackedCount: snapshot.trackedRepositories.length,
      cachedCount: snapshot.repositories.length,
      lastAttemptAt: snapshot.lastAttemptAt || '',
      lastSyncAt: snapshot.lastSyncAt || '',
      cache: cache?.getStorageStatus?.() || status.cache
    };
    onStatus({ ...status, counts: { ...status.counts }, progress: { ...status.progress }, cache: { ...status.cache } });
  }

  async function request(url) {
    if (typeof fetchImpl !== 'function') throw new Error('This browser does not provide fetch().');
    const previous = cache?.getResponse?.(url);
    const headers = { Accept: 'application/vnd.github+json' };
    if (previous?.etag) headers['If-None-Match'] = previous.etag;

    let response;
    try {
      response = await fetchImpl(url, { method: 'GET', headers });
    } catch (error) {
      throw new Error(error?.message || 'Network request failed.');
    }
    const remainingText = header(response.headers, 'x-ratelimit-remaining');
    if (remainingText !== '') {
      const remaining = Number(remainingText);
      const resource = header(response.headers, 'x-ratelimit-resource') || 'core';
      status.rateLimitRemaining = status.rateLimitResource !== resource || status.rateLimitRemaining == null
        ? remaining : Math.min(status.rateLimitRemaining, remaining);
      status.rateLimitResource = resource;
    }
    status.rateLimitResetAt = rateReset(response.headers) || status.rateLimitResetAt;

    if (response.status === 304 && previous) return { data: previous.data, headers: response.headers };
    if (!response.ok) {
      let body = {};
      try { body = await response.json(); } catch { /* response may not contain JSON */ }
      throw errorFromResponse(response.status, body, response.headers, url);
    }

    const data = await response.json();
    const etag = header(response.headers, 'etag');
    if (etag) cache?.setResponse?.(url, { etag, data, savedAt: isoNow(clock) });
    return { data, headers: response.headers };
  }

  async function fetchPages(firstUrl, { maxPages = MAX_PAGES } = {}) {
    let url = firstUrl;
    let page = 1;
    let pages = 0;
    const items = [];
    while (url && pages < maxPages) {
      const { data, headers } = await request(url);
      if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected list response.');
      items.push(...data);
      pages += 1;
      const next = parseNextLink(header(headers, 'link'));
      if (next) {
        url = next;
        const parsed = new URL(url);
        page = Number(parsed.searchParams.get('page')) || page + 1;
      } else if (data.length >= PER_PAGE) {
        page += 1;
        url = withPage(firstUrl, page);
      } else {
        url = '';
      }
    }
    if (url) return { items, complete: false, error: `Stopped after ${maxPages} GitHub API pages.` };
    return { items, complete: true, error: '' };
  }

  async function fetchOptionalContent(repo, commitSha, branch, path) {
    const full = encodeRepoPath(repo.full_name);
    const file = encodeFilePath(path);
    const url = `https://raw.githubusercontent.com/${full}/${encodeURIComponent(commitSha)}/${file}`;
    try {
      const response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'text/plain' } });
      if (response.status === 404) return null;
      if (!response.ok) throw new GitHubApiError(`GitHub raw content returned HTTP ${response.status}.`, { status: response.status, url });
      const text = await response.text();
      return {
        path,
        url: fallbackDocumentUrl(repo, branch, path),
        text,
        excerpt: textExcerpt(text)
      };
    } catch (error) {
      if (error?.status === 404) return null;
      throw error;
    }
  }

  async function syncRepository(repo) {
    if (isEmptyRepository(repo)) return emptyRepositoryProfile(repo, isoNow(clock));
    const full = encodeRepoPath(repo.full_name);
    const branch = repo.default_branch || 'main';
    const commitsUrl = buildPageUrl(`/repos/${full}/commits?per_page=5&sha=${encodeURIComponent(branch)}`);
    const branchesUrl = buildPageUrl(`/repos/${full}/branches?per_page=${PER_PAGE}`);
    const treeUrl = buildPageUrl(`/repos/${full}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const [branchPage, commitResult, treeResult] = await Promise.all([
      fetchPages(branchesUrl, { maxPages: 2 }),
      request(commitsUrl),
      request(treeUrl)
    ]);

    const commits = Array.isArray(commitResult.data) ? commitResult.data.map(normalizeCommit) : [];
    const branchNames = branchPage.items.map((item) => String(item?.name || '')).filter(Boolean);
    const selected = selectProjectDocuments(treeResult.data?.tree);
    const rawDocs = [];
    const docWarnings = [];

    if (commits[0]?.sha) {
      for (const item of selected) {
        try {
          const doc = await fetchOptionalContent(repo, commits[0].sha, branch, item.path);
          if (doc) rawDocs.push(doc);
        } catch (error) {
          docWarnings.push({
            type: 'sync',
            path: item.path,
            message: `Could not read ${item.path}: ${formatApiError(error)}`
          });
        }
      }
    }

    const latestCommit = commits[0] || null;
    const warnings = [
      ...analyzeDocumentation(rawDocs, {
        defaultBranch: branch,
        headSha: latestCommit?.sha || '',
        latestCommitDate: latestCommit?.date || repo.pushed_at || ''
      }),
      ...docWarnings
    ];
    if (!branchPage.complete) {
      warnings.push({ type: 'sync', path: '', message: branchPage.error || 'Branch listing may be incomplete.' });
    }
    if (treeResult.data?.truncated) {
      warnings.push({ type: 'sync', path: '', message: 'GitHub truncated the repository file tree; document discovery may be incomplete.' });
    }
    const syncError = branchPage.complete && !docWarnings.length && !treeResult.data?.truncated ? '' :
      [branchPage.error, ...docWarnings.map((item) => item.message),
        treeResult.data?.truncated ? 'GitHub truncated the repository file tree; document discovery may be incomplete.' : '']
        .filter(Boolean).join(' ');

    return {
      ...minimalRepository(repo, isoNow(clock)),
      empty: false,
      branches: branchNames.slice(0, 20),
      branchCount: branchNames.length,
      branchListingComplete: branchPage.complete,
      commits: commits.slice(0, 5),
      docs: rawDocs.map(({ path, url, excerpt }) => ({ path, url, excerpt })),
      warnings,
      syncedAt: isoNow(clock),
      syncState: syncError ? 'error' : 'complete',
      syncError
    };
  }

  function getSnapshot() {
    return JSON.parse(JSON.stringify(snapshot));
  }

  function getStatus() {
    return {
      ...status,
      counts: status.phase === 'syncing' ? { ...status.counts } : summarizeTracked(),
      trackedCount: snapshot.trackedRepositories.length,
      cachedCount: snapshot.repositories.length,
      progress: { ...status.progress },
      cache: { ...status.cache }
    };
  }

  function getTrackedRepositories() {
    return JSON.parse(JSON.stringify(snapshot.trackedRepositories));
  }

  function getTrackedProfiles() {
    return snapshot.trackedRepositories.map((repo) => profileForTracked(repo));
  }

  function getCachedRepositories() {
    return JSON.parse(JSON.stringify(snapshot.repositories));
  }

  async function searchRepositories(query) {
    const term = String(query || '').trim();
    if (!term) return { ok: false, repositories: [], error: 'Enter a repository name to search.' };
    if (term.length > 100) return { ok: false, repositories: [], error: 'Search terms must be 100 characters or fewer.' };
    if (running || requestRunning) return { ok: false, repositories: [], error: 'Wait for the current GitHub request to finish.' };
    requestRunning = true;
    status.rateLimitRemaining = null;
    status.rateLimitResource = '';
    try {
      const q = `user:${owner} in:name ${term}`;
      const url = buildPageUrl(`/search/repositories?q=${encodeURIComponent(q)}&per_page=100&sort=full_name`);
      const { data } = await request(url);
      if (!Array.isArray(data?.items)) throw new Error('GitHub returned an unexpected repository search response.');
      const repositories = eligibleRepositories(data.items, owner).map(normalizeRepository);
      return { ok: true, repositories, totalCount: Number(data.total_count) || repositories.length };
    } catch (error) {
      return { ok: false, repositories: [], error: formatApiError(error) };
    } finally {
      requestRunning = false;
      notify();
    }
  }

  async function lookupRepository(value) {
    const parsed = parseGitHubRepositoryUrl(value);
    if (!parsed.ok) return parsed;
    if (running || requestRunning) return { ok: false, error: 'Wait for the current GitHub request to finish.' };
    requestRunning = true;
    status.rateLimitRemaining = null;
    status.rateLimitResource = '';
    try {
      const path = `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`;
      const { data } = await request(buildPageUrl(path));
      if (!data || data.private === true || data.id == null) {
        return { ok: false, error: 'Only public GitHub repositories can be tracked.' };
      }
      const repository = normalizeRepository(data);
      if (!repository.fullName || !repository.url) {
        return { ok: false, error: 'GitHub did not return a valid repository record.' };
      }
      return { ok: true, repository };
    } catch (error) {
      const message = error?.status === 404
        ? 'Repository not found or not public.'
        : formatApiError(error);
      return { ok: false, error: message };
    } finally {
      requestRunning = false;
      notify();
    }
  }

  function trackRepository(value) {
    if (running || requestRunning) return { ok: false, error: 'Wait for the current GitHub request to finish.' };
    const repository = normalizeRepository(value);
    if (repository.id == null || !repository.owner || !repository.name || !repository.fullName ||
        !repository.isPublic || !repository.url) {
      return { ok: false, error: 'Only a verified public GitHub repository can be tracked.' };
    }
    const existing = snapshot.trackedRepositories.find((item) => repoMatches(item, repository));
    if (existing) return { ok: true, duplicate: true, repository: existing };
    const tracked = { ...repository, trackedAt: isoNow(clock) };
    const hadTrackedRepositories = snapshot.trackedRepositories.length > 0;
    snapshot = {
      ...snapshot,
      trackedRepositories: [...snapshot.trackedRepositories, tracked],
      ...(hadTrackedRepositories ? {} : { error: '', notice: '' })
    };
    snapshot.counts = summarizeTracked();
    cache?.setSnapshot?.(snapshot);
    if (!hadTrackedRepositories) {
      status.error = '';
      status.notice = '';
    }
    status.phase = snapshot.lastSyncAt ? 'cached' : 'idle';
    status.counts = summarizeTracked();
    status.progress = { completed: 0, total: snapshot.trackedRepositories.length };
    notify();
    return { ok: true, duplicate: false, repository: tracked };
  }

  function untrackRepository(identity) {
    if (running || requestRunning) return false;
    const key = typeof identity === 'object' && identity
      ? identity
      : { id: identity, fullName: String(identity || '') };
    const previous = snapshot.trackedRepositories.length;
    const trackedRepositories = snapshot.trackedRepositories.filter((item) => !repoMatches(item, key));
    if (trackedRepositories.length === previous) return false;
    snapshot = { ...snapshot, trackedRepositories, counts: summarizeTracked(trackedRepositories) };
    cache?.setSnapshot?.(snapshot);
    status.phase = trackedRepositories.length && snapshot.lastSyncAt ? 'cached' : 'idle';
    status.counts = summarizeTracked();
    status.progress = { completed: 0, total: trackedRepositories.length };
    if (!trackedRepositories.length) {
      status.error = '';
      status.notice = '';
    }
    notify();
    return true;
  }

  async function runSync() {
    const attemptedAt = isoNow(clock);
    const selected = snapshot.trackedRepositories.slice();
    if (!selected.length) {
      status = {
        ...status,
        phase: 'idle',
        counts: { found: 0, synced: 0, pending: 0, failed: 0 },
        progress: { completed: 0, total: 0 },
        error: '',
        notice: 'Track a repository before syncing.'
      };
      notify();
      return { ok: true, repositories: [], status: getStatus() };
    }

    const resetAt = Date.parse(snapshot.rateLimitResetAt || '');
    const nowTime = new Date(attemptedAt).getTime();
    const hasQueuedTracked = selected.some((repo) => profileForTracked(repo).syncState === 'queued');
    if (hasQueuedTracked &&
        Number.isFinite(resetAt) && nowTime < resetAt) {
      const notice = `Sync is paused until GitHub's public API quota resets at ${snapshot.rateLimitResetAt}.`;
      status = {
        ...status,
        phase: 'partial',
        counts: summarizeTracked(),
        progress: { completed: 0, total: selected.length },
        error: '',
        notice
      };
      notify();
      return { ok: false, repositories: getTrackedProfiles(), status: getStatus() };
    }

    snapshot = { ...snapshot, lastAttemptAt: attemptedAt, error: '', notice: '' };
    status = {
      ...status,
      phase: 'syncing',
      counts: { found: selected.length, synced: 0, pending: 0, failed: 0 },
      progress: { completed: 0, total: selected.length },
      error: '',
      notice: '',
      rateLimitRemaining: null,
      rateLimitResource: '',
      rateLimitResetAt: Number.isFinite(resetAt) && resetAt > nowTime ? snapshot.rateLimitResetAt : ''
    };
    cache?.setSnapshot?.(snapshot);
    notify();

    try {
      const repoProfiles = [];
      let synced = 0;
      let pending = 0;
      let failed = 0;
      let detailedThisRun = 0;
      let pauseDetails = false;
      for (let i = 0; i < selected.length; i += 1) {
        const tracked = selected[i];
        const repo = toApiRepository(tracked);
        const prior = cachedProfile(tracked);
        let profile;

        if (isEmptyRepository(repo)) {
          profile = emptyRepositoryProfile(repo, attemptedAt);
          synced += 1;
        } else {
          const unchanged = prior?.syncedAt && prior.syncState === 'complete' && !prior.syncError &&
            String(prior.pushedAt || '') === String(repo.pushed_at || '') &&
            String(prior.defaultBranch || '') === String(repo.default_branch || '');
          if (unchanged) {
            profile = repositoryWithCurrentMetadata(prior, repo, attemptedAt);
            synced += 1;
          } else {
            const remaining = status.rateLimitRemaining;
            const hasBudget = remaining == null
              ? detailedThisRun < 10
              : remaining >= API_REQUESTS_PER_REPOSITORY + API_RESERVE;
            const reachedBatchLimit = detailedThisRun >= MAX_REPOSITORY_DETAILS_PER_SYNC;
            if (pauseDetails || reachedBatchLimit || !hasBudget) {
              profile = queuedRepositoryProfile(prior, repo, attemptedAt);
              pending += 1;
            } else {
              detailedThisRun += 1;
              try {
                profile = await syncRepository(repo);
                if (profile.syncError) failed += 1;
                else synced += 1;
              } catch (error) {
                if (error?.status === 409 && /repository is empty/i.test(error.message)) {
                  profile = emptyRepositoryProfile(repo, attemptedAt);
                  synced += 1;
                } else if (error?.rateLimited) {
                  profile = queuedRepositoryProfile(prior, repo, attemptedAt);
                  pending += 1;
                  status.rateLimitResetAt = error.resetAt || status.rateLimitResetAt;
                  pauseDetails = true;
                } else {
                  const base = repositoryWithCurrentMetadata(prior, repo, attemptedAt);
                  const message = formatApiError(error);
                  profile = {
                    ...base,
                    syncState: 'error',
                    syncError: message,
                    warnings: [...(base.warnings || []).filter((warning) => warning.type !== 'sync'), {
                      type: 'sync',
                      path: '',
                      message: `Sync failed; showing the last successful GitHub data when available. ${message}`
                    }]
                  };
                  failed += 1;
                  if (!error?.status || error.status >= 500) pauseDetails = true;
                }
              }
            }
          }
        }
        repoProfiles.push(profile);
        status = {
          ...status,
          counts: { found: selected.length, synced, pending, failed },
          progress: { completed: i + 1, total: selected.length }
        };
        notify();
      }

      const complete = pending === 0 && failed === 0;
      const error = complete ? '' :
        repoProfiles.filter((item) => item.syncState === 'error').map((item) => item.syncError)
          .filter(Boolean).slice(0, 4).join(' ');
      const pauseUntil = pending > 0 ? status.rateLimitResetAt || '' : '';
      const notice = pending > 0
        ? pauseUntil
          ? `${pending} tracked repositories are queued. GitHub's public API quota resets at ${pauseUntil}; sync will resume then.`
          : `${pending} tracked repositories are queued for a later sync.`
        : '';
      const merged = new Map(snapshot.repositories.map((repo) => [String(repo.id), repo]));
      for (const profile of repoProfiles) merged.set(String(profile.id), profile);
      snapshot = {
        ...snapshot,
        lastAttemptAt: attemptedAt,
        lastSyncAt: complete ? isoNow(clock) : snapshot.lastSyncAt || '',
        repositories: [...merged.values()].sort((a, b) => String(a.fullName).localeCompare(String(b.fullName))),
        counts: { found: selected.length, synced, pending, failed },
        error,
        notice,
        rateLimitResetAt: pauseUntil
      };
      cache?.setSnapshot?.(snapshot);
      status = {
        ...status,
        phase: complete ? 'ready' : 'partial',
        counts: summarizeTracked(),
        progress: { completed: selected.length, total: selected.length },
        error,
        notice,
        rateLimitResetAt: snapshot.rateLimitResetAt
      };
      notify();
      return { ok: complete, repositories: getTrackedProfiles(), status: getStatus() };
    } catch (error) {
      const message = formatApiError(error);
      snapshot = {
        ...snapshot,
        lastAttemptAt: attemptedAt,
        error: message,
        rateLimitResetAt: error?.resetAt || snapshot.rateLimitResetAt || ''
      };
      snapshot.counts = summarizeTracked();
      cache?.setSnapshot?.(snapshot);
      status = {
        ...status,
        phase: 'error',
        counts: summarizeTracked(),
        progress: { completed: 0, total: 0 },
        error: message,
        notice: snapshot.notice || '',
        rateLimitResetAt: error?.resetAt || status.rateLimitResetAt
      };
      notify();
      return { ok: false, repositories: getTrackedProfiles(), status: getStatus(), error: message };
    }
  }

  function sync() {
    if (!running) {
      if (requestRunning) {
        return Promise.resolve({
          ok: false,
          repositories: getTrackedProfiles(),
          status: getStatus(),
          error: 'Wait for the current GitHub request to finish.'
        });
      }
      running = runSync().finally(() => { running = null; });
    }
    return running;
  }

  return {
    getSnapshot, getStatus, getTrackedRepositories, getTrackedProfiles, getCachedRepositories,
    searchRepositories, lookupRepository, trackRepository, untrackRepository, sync
  };
}
