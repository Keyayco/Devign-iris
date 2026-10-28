import { h, button, sampleBadge, stateBadge, kv, row, viewHead, emptyState, fmtDateTime } from '../dom.js';
import { label } from '../schema.js';
import { eventsSorted, openTasksSorted, attentionReasons } from '../selectors.js';
import { addRecord, rowActions } from './actions.js';

export function renderProjects(ctx) {
  const state = ctx.store.getState();
  const root = h('section', null, viewHead('Projects', 'Registry of Devign projects and their recorded state.', button('Add project', () => addRecord(ctx, 'projects', 'Add project'), 'primary')));
  if (!state.projects.length) {
    root.append(emptyState('No projects yet', 'Add the first project, or load sample data to see how the registry looks. Sample records are always labelled.',
      button('Add project', () => addRecord(ctx, 'projects', 'Add project'), 'primary'),
      button('Load sample data', ctx.loadSample)));
    return root;
  }
  const list = h('ul', { class: 'rows' });
  for (const p of state.projects) {
    const events = eventsSorted(state).filter((e) => e.projectId === p.id);
    const tasks = openTasksSorted(state).filter((t) => t.projectId === p.id);
    const agents = state.agents.filter((a) => a.projectId === p.id);
    const why = attentionReasons(state, p);
    list.append(h('li', null, row(p.id,
      [h('div', { class: 'row__main' }, h('div', { class: 'row__title' }, p.name), h('div', { class: 'row__meta' }, `${tasks.length} open task${tasks.length === 1 ? '' : 's'}, ${events.length} activity event${events.length === 1 ? '' : 's'}`)),
        h('div', { class: 'row__badges' }, sampleBadge(p), stateBadge(p.state, label(p.state)))],
      [kv([
        ['Purpose', p.purpose], ['Constraints', p.constraints], ['Last known implementation', p.lastImplementation],
        ['Latest evidence', events[0] ? `${label(events[0].evidence)}: ${events[0].summary}` : ''],
        ['Blockers and known bugs', p.blockers], ['Next recommended action', p.nextAction],
        ['Agents', agents.map((a) => `${a.name} (${label(a.status)})`).join(', ')],
        ['Needs attention', why.join('; ') || 'No recorded reason'],
        ['Last updated', fmtDateTime(p.updatedAt)]
      ]), rowActions(ctx, 'projects', p, 'project')])));
  }
  root.append(list);
  return root;
}
