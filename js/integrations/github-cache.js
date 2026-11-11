// GitHub's successful read responses and normalised sync snapshot are cached
// separately from Iris's v1 record store. No credentials are stored here.
export const GITHUB_CACHE_KEY = 'devign-iris:github:v1';

const MAX_CACHE_CHARS = 3_500_000;
const MAX_RESPONSE_CHARS = 90_000;

const emptyCache = () => ({
  version: 1,
  lastAttemptAt: '',
  lastSyncAt: '',
  trackedRepositories: [],
  repositories: [],
  counts: { found: 0, synced: 0, pending: 0, failed: 0 },
  error: '',
  notice: '',
  rateLimitResetAt: '',
  responses: {}
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createGitHubCache(storage = null) {
  let state = emptyCache();
  let storageError = '';

  if (storage) {
    try {
      const raw = storage.getItem(GITHUB_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.repositories)) {
          // The v1 cache was populated only from GitHub's anonymous public
          // owner listing; mark those old profiles so explicit tracking can
          // safely reuse them without rescanning the account.
          const repositories = parsed.repositories.map((repo) => ({
            ...repo,
            isPublic: repo?.isPublic === true || repo?.private === false ||
              (repo?.isPublic == null && repo?.private == null)
          }));
          state = {
            ...emptyCache(),
            ...parsed,
            trackedRepositories: Array.isArray(parsed.trackedRepositories) ? parsed.trackedRepositories : [],
            repositories,
            counts: { ...emptyCache().counts, ...(parsed.counts || {}) },
            responses: parsed.responses && typeof parsed.responses === 'object' ? parsed.responses : {}
          };
        }
      }
    } catch {
      storageError = 'The saved GitHub cache could not be read.';
    }
  }

  function persist() {
    if (!storage) return false;
    try {
      let raw = JSON.stringify(state);
      if (raw.length > MAX_CACHE_CHARS) {
        // Response bodies are only an optimisation for ETag/304 requests.
        // Drop them before touching the useful, normalised repository cache.
        state.responses = {};
        raw = JSON.stringify(state);
      }
      if (raw.length > MAX_CACHE_CHARS) {
        // Keep the information needed by the UI while reducing large excerpts.
        state.repositories = state.repositories.map((repo) => ({
          ...repo,
          docs: (repo.docs || []).map((doc) => ({ ...doc, excerpt: (doc.excerpt || '').slice(0, 120) }))
        }));
        raw = JSON.stringify(state);
      }
      storage.setItem(GITHUB_CACHE_KEY, raw);
      storageError = '';
      return true;
    } catch {
      storageError = 'The GitHub cache could not be saved in this browser.';
      return false;
    }
  }

  return {
    getSnapshot() { return clone(state); },
    setSnapshot(snapshot) {
      state = {
        ...state,
        ...snapshot,
        version: 1,
        responses: state.responses
      };
      persist();
    },
    getResponse(url) {
      const entry = state.responses[url];
      return entry && entry.etag && Object.hasOwn(entry, 'data') ? clone(entry) : null;
    },
    setResponse(url, entry) {
      if (!entry?.etag || !Object.hasOwn(entry, 'data')) return false;
      const value = { etag: entry.etag, data: entry.data, savedAt: entry.savedAt || new Date().toISOString() };
      if (JSON.stringify(value).length > MAX_RESPONSE_CHARS) return false;

      state.responses[url] = value;
      let raw = JSON.stringify(state);
      if (raw.length > MAX_CACHE_CHARS) {
        const oldest = Object.entries(state.responses)
          .filter(([key]) => key !== url)
          .sort((a, b) => String(a[1].savedAt).localeCompare(String(b[1].savedAt)));
        for (const [key] of oldest) {
          delete state.responses[key];
          raw = JSON.stringify(state);
          if (raw.length <= MAX_CACHE_CHARS) break;
        }
      }
      if (raw.length > MAX_CACHE_CHARS) {
        delete state.responses[url];
        return false;
      }
      return persist();
    },
    getStorageStatus() {
      return { available: !!storage, error: storageError };
    }
  };
}
