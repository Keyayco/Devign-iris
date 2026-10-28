// State and persistence. DOM-free: storage is injected so tests can use an in-memory adapter.
// Persistence in Phase 1 is browser localStorage only (a local cache, not a server database).
import { COLLECTIONS, SCHEMA_VERSION, validate, isStoredState } from './schema.js';

export const STORAGE_KEY = 'devign-iris:v1';
const PREFIX = { projects: 'p', agents: 'a', activity: 'e', tasks: 't' };

let counter = 0;
function newId(collection) {
  counter += 1;
  return `${PREFIX[collection]}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
const emptyState = () => ({ schema: SCHEMA_VERSION, projects: [], agents: [], activity: [], tasks: [] });

export function createStore(storage = null, clock = () => new Date()) {
  let state = emptyState();
  const status = { persisted: !!storage, saveError: null, loadError: null };
  const subs = new Set();

  const notify = () => subs.forEach((fn) => fn(state));

  function save() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
      status.saveError = null;
    } catch (err) {
      status.saveError = `Could not save records: ${err && err.message ? err.message : 'storage unavailable'}`;
    }
  }

  function load() {
    status.loadError = null;
    if (!storage) return;
    let raw;
    try { raw = storage.getItem(STORAGE_KEY); } catch (err) { status.loadError = 'Stored records could not be read.'; return; }
    if (raw == null) return;
    try {
      const parsed = JSON.parse(raw);
      if (!isStoredState(parsed)) throw new Error('unrecognised structure');
      state = emptyState();
      for (const c of COLLECTIONS) {
        state[c] = parsed[c].filter((r) => r && typeof r === 'object' && typeof r.id === 'string');
      }
    } catch (err) {
      // Keep the unreadable data under a backup key so nothing is silently destroyed.
      status.loadError = 'Stored records were unreadable and have been set aside. Starting empty.';
      try { storage.setItem(`${STORAGE_KEY}:corrupt-${clock().getTime()}`, raw); } catch (e) { /* ignore */ }
      state = emptyState();
    }
  }

  const projectIds = () => state.projects.map((p) => p.id);

  function add(collection, input) {
    const res = validate(collection, input, projectIds());
    if (!res.ok) return res;
    const now = clock().toISOString();
    const record = { ...res.record, id: newId(collection), sample: false, createdAt: now, updatedAt: now };
    if (collection === 'activity') record.timestamp = now;
    state[collection].push(record);
    save(); notify();
    return { ok: true, errors: {}, record };
  }

  function update(collection, id, input) {
    const idx = state[collection].findIndex((r) => r.id === id);
    if (idx < 0) return { ok: false, errors: { _: 'Record not found.' }, record: null };
    const res = validate(collection, input, projectIds());
    if (!res.ok) return res;
    const prev = state[collection][idx];
    const record = { ...prev, ...res.record, updatedAt: clock().toISOString() };
    state[collection][idx] = record;
    save(); notify();
    return { ok: true, errors: {}, record };
  }

  function remove(collection, id) {
    const before = state[collection].length;
    state[collection] = state[collection].filter((r) => r.id !== id);
    if (state[collection].length === before) return false;
    if (collection === 'projects') {
      // Detach references rather than leaving dangling ids.
      for (const c of ['agents', 'activity', 'tasks']) state[c].forEach((r) => { if (r.projectId === id) r.projectId = ''; });
    }
    save(); notify();
    return true;
  }

  /** Toggle a task's done state without full validation. */
  function setTaskDone(id, done) {
    const t = state.tasks.find((r) => r.id === id);
    if (!t) return false;
    t.status = done ? 'done' : 'open';
    t.updatedAt = clock().toISOString();
    save(); notify();
    return true;
  }

  const hasSample = () => COLLECTIONS.some((c) => state[c].some((r) => r.sample));

  /** Insert pre-built sample records. No-op if sample records already exist. */
  function loadSample(sample) {
    if (hasSample()) return 0;
    let added = 0;
    for (const c of COLLECTIONS) {
      for (const r of sample[c] || []) { state[c].push({ ...r, sample: true }); added += 1; }
    }
    save(); notify();
    return added;
  }

  function clearSample() {
    let removed = 0;
    for (const c of COLLECTIONS) {
      const before = state[c].length;
      state[c] = state[c].filter((r) => !r.sample);
      removed += before - state[c].length;
    }
    // Real records must never keep pointing at removed sample projects.
    const ids = new Set(projectIds());
    for (const c of ['agents', 'activity', 'tasks']) state[c].forEach((r) => { if (r.projectId && !ids.has(r.projectId)) r.projectId = ''; });
    save(); notify();
    return removed;
  }

  function clearAll() {
    state = emptyState();
    save(); notify();
  }

  const exportJSON = () => JSON.stringify({ ...state, exportedAt: clock().toISOString() }, null, 2);

  load();
  return {
    getState: () => state,
    getStatus: () => status,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    add, update, remove, setTaskDone, loadSample, clearSample, clearAll, hasSample, exportJSON
  };
}
