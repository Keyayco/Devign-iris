import { h, button, badge, viewHead, fmtDateTime } from '../dom.js';
import { renderEye, pulseEye } from '../iris-eye.js';
import { runCommand } from '../commands.js';
import { dataMode, MODE_LABELS } from '../selectors.js';

const turns = []; // Session-only transcript; not persisted.
const MAX_TURNS = 20;
const CHIPS = ['help', 'briefing', 'which projects need attention', 'what did we implement last'];
const INTEGRATIONS = [
  ['Language model', 'No model is connected. Commands are matched locally.'],
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

function githubConnection(ctx) {
  const status = ctx.githubStatus || {};
  const counts = status.counts || { found: 0, synced: 0, pending: 0, failed: 0 };
  const progressState = status.progress || { completed: 0, total: 0 };
  const isSyncing = status.phase === 'discovering' || status.phase === 'syncing';
  const resetAt = Date.parse(status.rateLimitResetAt || '');
  const waitingForQuota = Number.isFinite(resetAt) && resetAt > Date.now() &&
    ((counts.pending || 0) > 0 || /rate limit/i.test(status.error || ''));
  const statusText = {
    idle: 'Not checked yet',
    discovering: 'Discovering repositories',
    syncing: 'Sync in progress',
    ready: 'Up to date',
    cached: 'Cached data',
    partial: 'Partial sync',
    error: 'Sync unavailable'
  }[status.phase] || 'Public API';
  const statusKind = status.phase === 'error' ? 'bad' :
    status.phase === 'partial' ? 'warn' :
      status.phase === 'ready' || status.phase === 'cached' ? 'cyan' : '';
  const progress = isSyncing
    ? h('progress', {
      max: Math.max(progressState.total || 0, 1),
      value: progressState.total ? progressState.completed : null,
      'aria-label': 'GitHub sync progress'
    })
    : null;
  const syncLabel = isSyncing && progressState.total
    ? `${progressState.completed} of ${progressState.total} repositories processed`
    : isSyncing ? 'Loading public repository list…'
      : waitingForQuota ? `Queued until quota reset · ${fmtDateTime(status.rateLimitResetAt)}`
        : '';

  return h('div', { class: 'github-connection' },
    h('div', { class: 'github-connection__head' },
      h('div', null, h('strong', null, 'GitHub · Keyayco'), h('small', null, 'Public REST API · read-only · no token stored')),
      badge(statusText, statusKind)),
    h('div', { class: 'github-connection__actions' },
      button(isSyncing ? 'Syncing…' : waitingForQuota ? 'Queued until reset' : 'Sync GitHub',
        () => ctx.syncGitHub(), 'primary', { disabled: isSyncing || waitingForQuota })),
    progress,
    syncLabel ? h('p', { class: 'muted', 'aria-live': 'polite' }, syncLabel) : null,
    h('p', { class: 'muted' }, `${counts.found || 0} public repositories found · ${counts.synced || 0} synced · ${counts.pending || 0} queued · ${counts.failed || 0} with sync issues`),
    status.lastSyncAt ? h('p', { class: 'muted' }, `Last complete sync: ${fmtDateTime(status.lastSyncAt)}`) : null,
    status.rateLimitRemaining != null
      ? h('p', { class: 'muted' }, `GitHub API requests remaining: ${status.rateLimitRemaining}`)
      : null,
    status.error ? h('p', { class: 'note note--bad', role: 'status' }, status.error) : null,
    status.notice ? h('p', { class: 'note note--warn', role: 'status' }, status.notice) : null,
    status.cache?.error ? h('p', { class: 'note note--bad', role: 'status' }, status.cache.error) : null,
    status.cache && !status.cache.available
      ? h('p', { class: 'muted' }, 'Browser storage is unavailable; GitHub cache will last only for this session.')
      : null);
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
    githubConnection(ctx),
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
