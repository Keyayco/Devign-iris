import { h, button, sampleBadge, stateBadge, kv, row, viewHead, emptyState } from '../dom.js';
import { label } from '../schema.js';
import { projectName } from '../selectors.js';
import { addRecord, rowActions } from './actions.js';

export function renderAgents(ctx) {
  const state = ctx.store.getState();
  const root = h('section', null,
    viewHead('Agents', 'AI tools used across Devign and what they are assigned to.', button('Add agent', () => addRecord(ctx, 'agents', 'Add agent'), 'primary')),
    h('p', { class: 'note' }, 'These are records you enter. An assignment does not mean an agent is working, and no live agent activity is monitored yet.'));
  if (!state.agents.length) {
    root.append(emptyState('No agents yet', 'Register the AI tools you use so assignments and handovers can be tracked.',
      button('Add agent', () => addRecord(ctx, 'agents', 'Add agent'), 'primary'), button('Load sample data', ctx.loadSample)));
    return root;
  }
  const list = h('ul', { class: 'rows' });
  for (const a of state.agents) {
    list.append(h('li', null, row(a.id,
      [h('div', { class: 'row__main' }, h('div', { class: 'row__title' }, a.name), h('div', { class: 'row__meta' }, [a.provider || 'Provider unknown', a.projectId ? ` · ${projectName(state, a.projectId)}` : ''].join(''))),
        h('div', { class: 'row__badges' }, sampleBadge(a), stateBadge(a.status, label(a.status)))],
      [kv([
        ['Current assignment', a.assignment], ['Assigned project', projectName(state, a.projectId)],
        ['Capabilities', a.capabilities], ['Limitations', a.limitations],
        ['Last activity (as reported)', a.lastActivity], ['Last reported implementation', a.lastReported],
        ['Pending handover', a.pendingHandover], ['Verification', a.verification || 'Not verified']
      ]), rowActions(ctx, 'agents', a, 'agent')])));
  }
  root.append(list);
  return root;
}
