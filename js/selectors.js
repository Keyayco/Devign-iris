// Read-only helpers that derive facts from stored records. DOM-free.
import { COLLECTIONS, label } from './schema.js';

export const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);
export const byId = (list, id) => list.find((r) => r.id === id) || null;
export const projectName = (state, id) => (byId(state.projects, id) || {}).name || '';
export const sampleTag = (r) => (r.sample ? ' [sample]' : '');

export function eventsSorted(state) {
  return [...state.activity].sort((a, b) => String(b.timestamp || b.createdAt).localeCompare(String(a.timestamp || a.createdAt)));
}
export const latestEvent = (state, projectId) => eventsSorted(state).find((e) => e.projectId === projectId) || null;

export const isOverdue = (task, now = new Date()) => task.status === 'open' && !!task.due && task.due < todayISO(now);
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
export function openTasksSorted(state) {
  return state.tasks.filter((t) => t.status === 'open').sort((a, b) =>
    (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || String(a.due || '9999').localeCompare(String(b.due || '9999')));
}

/** Why a project needs attention, from stored records only. Empty array = no recorded reason. */
export function attentionReasons(state, project, now = new Date()) {
  const reasons = [];
  if (project.state === 'blocked') reasons.push('marked blocked');
  if (project.blockers) reasons.push(`blockers recorded: ${project.blockers}`);
  const tasks = state.tasks.filter((t) => t.projectId === project.id && t.status === 'open');
  const overdue = tasks.filter((t) => isOverdue(t, now)).length;
  if (overdue) reasons.push(`${overdue} overdue task${overdue > 1 ? 's' : ''}`);
  const high = tasks.filter((t) => t.priority === 'high').length;
  if (high) reasons.push(`${high} high-priority open task${high > 1 ? 's' : ''}`);
  const last = latestEvent(state, project.id);
  if (last && last.evidence === 'failed') reasons.push('latest activity failed');
  return reasons;
}

/** "empty" | "sample" | "stored" | "mixed" */
export function dataMode(state) {
  let total = 0; let sample = 0;
  for (const c of COLLECTIONS) for (const r of state[c]) { total += 1; if (r.sample) sample += 1; }
  if (total === 0) return 'empty';
  if (sample === 0) return 'stored';
  return sample === total ? 'sample' : 'mixed';
}
export const MODE_LABELS = { empty: 'No records', sample: 'Sample data', stored: 'Stored records', mixed: 'Stored and sample' };
export { label };
