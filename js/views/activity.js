import { h, button, sampleBadge, stateBadge, kv, row, viewHead, emptyState, fmtDateTime } from '../dom.js';
import { label } from '../schema.js';
import { eventsSorted, projectName } from '../selectors.js';
import { addRecord, rowActions } from './actions.js';

let filterProject = '';

export function renderActivity(ctx) {
  const state = ctx.store.getState();
  const root = h('section', null,
    viewHead('Activity', 'Implementation ledger. Claims are not proof; evidence level says how far each one is backed.', button('Log activity', () => addRecord(ctx, 'activity', 'Log activity'), 'primary')));
  if (!state.activity.length) {
    root.append(emptyState('No activity logged', 'Log what an agent or person reports having changed, with its evidence level. Anything without evidence stays marked as reported.',
      button('Log activity', () => addRecord(ctx, 'activity', 'Log activity'), 'primary'), button('Load sample data', ctx.loadSample)));
    return root;
  }
  if (filterProject && !state.projects.some((p) => p.id === filterProject)) filterProject = '';
  const select = h('select', { id: 'activity-filter', onchange: (e) => { filterProject = e.target.value; ctx.rerender(); } },
    h('option', { value: '' }, 'All projects'),
    state.projects.map((p) => h('option', { value: p.id, selected: p.id === filterProject }, p.name)));
  root.append(h('div', { class: 'filter' }, h('label', { for: 'activity-filter' }, 'Show'), select));

  const events = eventsSorted(state).filter((e) => !filterProject || e.projectId === filterProject);
  if (!events.length) { root.append(h('p', { class: 'muted' }, 'No activity recorded for this project.')); return root; }
  const list = h('ul', { class: 'rows' });
  for (const e of events) {
    list.append(h('li', null, row(e.id,
      [h('div', { class: 'row__main' }, h('div', { class: 'row__title' }, e.summary), h('div', { class: 'row__meta' }, `${projectName(state, e.projectId) || 'No project'} · ${fmtDateTime(e.timestamp || e.createdAt)}`)),
        h('div', { class: 'row__badges' }, sampleBadge(e), stateBadge(e.evidence, label(e.evidence)))],
      [kv([
        ['Responsible', e.actor], ['Objective', e.objective], ['Files or resources', e.files], ['Tests and results', e.tests || 'Not verified'],
        ['Commit or revision', e.commit], ['Deployment', e.deployment], ['Outstanding issues', e.issues], ['Recommended next action', e.nextAction]
      ]), rowActions(ctx, 'activity', e, 'activity event')])));
  }
  root.append(list);
  return root;
}
