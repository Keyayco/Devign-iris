import { h, button, badge, viewHead } from '../dom.js';
import { renderEye, pulseEye } from '../iris-eye.js';
import { runCommand } from '../commands.js';
import { dataMode, MODE_LABELS } from '../selectors.js';

const turns = []; // Session-only transcript; not persisted.
const MAX_TURNS = 20;
const CHIPS = ['help', 'briefing', 'which projects need attention', 'what did we implement last'];
const INTEGRATIONS = [
  ['Language model', 'No model is connected. Commands are matched locally.'],
  ['GitHub', 'Repository inspection is not available.'],
  ['Replit deployments', 'Deployment status is not available.'],
  ['Agent sessions', 'Live agent activity is not monitored.']
];

function submit(ctx, text) {
  const state = ctx.store.getState();
  const result = runCommand(text, state);
  const turn = { you: text, lines: result.lines };
  turns.push(turn);
  if (turns.length > MAX_TURNS) turns.shift();
  if (result.kind === 'action' && result.action.type === 'add') {
    const res = ctx.store.add(result.action.collection, result.action.input);
    turn.lines = res.ok ? [`Task added: ${res.record.title}`] : [`Could not add task: ${Object.values(res.errors).join(' ')}`];
  }
  if (result.kind === 'navigate') { ctx.navigate(result.view); return; }
  ctx.rerender();
  pulseEye(document);
  const input = document.getElementById('cmd-input');
  if (input) input.focus();
}

function downloadExport(ctx) {
  const blob = new Blob([ctx.store.exportJSON()], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'devign-iris-export.json' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function renderCommand(ctx) {
  const state = ctx.store.getState();
  const status = ctx.store.getStatus();
  const root = h('section', null, viewHead('Command', 'Ask Iris about stored records.'));
  if (status.loadError) root.append(h('p', { class: 'note note--bad', role: 'alert' }, status.loadError));
  if (status.saveError) root.append(h('p', { class: 'note note--bad', role: 'alert' }, status.saveError));

  root.append(renderEye(state, ctx.openProject));

  const input = h('input', { id: 'cmd-input', class: 'cmd__input', type: 'text', placeholder: 'Type a command', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Command' });
  root.append(
    h('form', { class: 'cmd', onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (v) submit(ctx, v); } }, input, h('button', { type: 'submit', class: 'btn btn--primary' }, 'Run')),
    h('div', { class: 'chips' }, CHIPS.map((c) => h('button', { type: 'button', class: 'chip', onclick: () => submit(ctx, c) }, c))));

  if (turns.length) {
    root.append(h('div', { class: 'transcript', 'aria-live': 'polite' }, turns.map((t) =>
      h('div', { class: 'turn' }, h('div', { class: 'turn__you' }, `> ${t.you}`),
        h('div', { class: 'turn__reply' }, t.lines.map((l) => h('p', null, l))),
        h('div', { class: 'turn__src' }, 'Local command. Answered from stored records, no AI model.')))));
  }

  root.append(h('div', { class: 'section' }, h('h2', null, 'Connections'),
    h('ul', { class: 'status-list' }, INTEGRATIONS.map(([name, note]) => h('li', null, h('div', null, name, h('small', null, note)), badge('Not connected'))))));

  const hasSample = ctx.store.hasSample();
  root.append(h('div', { class: 'section' }, h('h2', null, 'Data'),
    h('p', { class: 'muted' }, `${MODE_LABELS[dataMode(state)]}. ${status.persisted ? 'Saved in this browser only. Clearing site data erases it.' : 'Browser storage is unavailable: records last until this page is closed.'}`),
    h('div', { class: 'btn-row', style: 'margin-top: .75rem' },
      button('Load sample data', ctx.loadSample, '', { disabled: hasSample }),
      button('Remove sample data', () => { if (window.confirm('Remove all sample records? Your own records are kept.')) ctx.store.clearSample(); }, '', { disabled: !hasSample }),
      button('Export JSON', () => downloadExport(ctx)),
      button('Delete all records', () => { if (window.confirm('Delete ALL records, including your own? This cannot be undone.')) ctx.store.clearAll(); }, 'danger'))));
  return root;
}
