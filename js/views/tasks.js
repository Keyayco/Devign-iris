import { h, button, sampleBadge, stateBadge, badge, kv, row, viewHead, emptyState } from '../dom.js';
import { label } from '../schema.js';
import { openTasksSorted, projectName, isOverdue } from '../selectors.js';
import { addRecord, rowActions } from './actions.js';

function taskRow(ctx, t, state) {
  const check = h('input', { type: 'checkbox', class: 'task-check', 'aria-label': `Mark "${t.title}" ${t.status === 'done' ? 'open' : 'done'}`, onchange: (e) => ctx.store.setTaskDone(t.id, e.target.checked) });
  check.checked = t.status === 'done';
  const overdue = isOverdue(t);
  const meta = [projectName(state, t.projectId), t.due ? `Due ${t.due}` : ''].filter(Boolean).join(' · ');
  const r = row(t.id,
    [check, h('div', { class: 'row__main' }, h('div', { class: 'row__title' }, t.title), meta ? h('div', { class: 'row__meta' }, meta) : null),
      h('div', { class: 'row__badges' }, sampleBadge(t), overdue ? badge('Overdue', 'bad') : null, t.status === 'open' ? stateBadge(t.priority, label(t.priority)) : null)],
    [kv([['Notes', t.notes], ['Project', projectName(state, t.projectId)], ['Due date', t.due]]), rowActions(ctx, 'tasks', t, 'task')],
    t.status === 'done' ? 'is-done' : '');
  // Checkbox lives inside <summary>; stop it toggling the row open.
  check.addEventListener('click', (e) => e.stopPropagation());
  return h('li', null, r);
}

export function renderTasks(ctx) {
  const state = ctx.store.getState();
  const root = h('section', null, viewHead('Tasks', 'Actions, priorities, and deadlines.', button('Add task', () => addRecord(ctx, 'tasks', 'Add task'), 'primary')));
  if (!state.tasks.length) {
    root.append(emptyState('No tasks yet', 'Add a task, or type "add task <title>" in the Command view.',
      button('Add task', () => addRecord(ctx, 'tasks', 'Add task'), 'primary'), button('Load sample data', ctx.loadSample)));
    return root;
  }
  const open = openTasksSorted(state);
  const done = state.tasks.filter((t) => t.status === 'done');
  root.append(h('div', { class: 'section' }, h('h2', null, `Open (${open.length})`),
    open.length ? h('ul', { class: 'rows' }, open.map((t) => taskRow(ctx, t, state))) : h('p', { class: 'muted' }, 'Nothing open.')));
  if (done.length) root.append(h('div', { class: 'section' }, h('h2', null, `Done (${done.length})`), h('ul', { class: 'rows' }, done.map((t) => taskRow(ctx, t, state)))));
  return root;
}
