import { h, button, badge, viewHead, fmtDateTime } from '../dom.js';
import { renderEye, pulseEye } from '../iris-eye.js';
import { runCommand } from '../commands.js';
import { dataMode, MODE_LABELS } from '../selectors.js';
import { GITHUB_OWNER } from '../integrations/github.js';

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

const githubControls = {
  searchQuery: '', searchResults: [], searchTotal: 0, searchMessage: '', searchBusy: false,
  pasteUrl: '', verifiedRepository: null, pasteMessage: '', pasteBusy: false,
  actionMessage: ''
};

function isTracked(repo, tracked) {
  return tracked.some((item) =>
    String(item.id) === String(repo.id) ||
    String(item.fullName || '').toLowerCase() === String(repo.fullName || '').toLowerCase()
  );
}

function repoLink(repo) {
  try {
    const url = new URL(repo.url);
    if (url.protocol === 'https:' && url.hostname === 'github.com') {
      return h('a', { href: url.href, target: '_blank', rel: 'noopener noreferrer' }, repo.fullName || repo.name);
    }
  } catch { /* display the repository name without an unsafe link */ }
  return h('span', null, repo.fullName || repo.name || 'GitHub repository');
}

function repoSyncBadge(repo) {
  const labels = {
    complete: ['Synced', 'ok'],
    empty: ['Empty', 'warn'],
    queued: ['Queued', 'warn'],
    error: ['Sync issue', 'bad']
  };
  const [label, kind] = labels[repo.syncState] || ['Not synced', ''];
  return badge(label, kind);
}

function trackButton(ctx, repo, tracked, syncing = false) {
  const alreadyTracked = isTracked(repo, tracked);
  return button(alreadyTracked ? 'Tracked' : 'Track repository', () => {
    const result = ctx.trackGitHubRepository(repo);
    githubControls.actionMessage = !result.ok
      ? result.error
      : result.duplicate ? `${repo.fullName} is already tracked.` : `Added ${repo.fullName} to tracking.`;
    ctx.rerender();
  }, alreadyTracked ? '' : 'small', { disabled: alreadyTracked || syncing });
}

function repositoryRow(ctx, repo, tracked, { cached = false, syncing = false } = {}) {
  const selected = isTracked(repo, tracked);
  const actions = selected
    ? button('Untrack', () => {
      if (ctx.untrackGitHubRepository(repo)) {
        githubControls.actionMessage = `Untracked ${repo.fullName}; its cached data is preserved.`;
      }
      ctx.rerender();
    }, 'small', { disabled: syncing })
    : trackButton(ctx, repo, tracked, syncing);
  return h('li', { class: 'github-repository' },
    h('div', { class: 'github-repository__top' },
      h('div', null, repoLink(repo), repo.description ? h('small', null, repo.description) : null),
      cached ? badge('Cached only', 'warn') : repoSyncBadge(repo)),
    h('p', { class: 'muted' },
      repo.syncedAt ? `Last sync: ${fmtDateTime(repo.syncedAt)}` : 'Last sync: not yet synced',
      repo.syncError ? ` · ${repo.syncError}` : ''),
    h('div', { class: 'github-repository__actions' }, actions));
}

function githubConnection(ctx) {
  const status = ctx.githubStatus || {};
  const tracked = ctx.githubTrackedRepositories || [];
  const cachedOnly = (ctx.githubCachedRepositories || []).filter((repo) => !isTracked(repo, tracked));
  const counts = status.counts || { found: 0, synced: 0, pending: 0, failed: 0 };
  const progressState = status.progress || { completed: 0, total: 0 };
  const isSyncing = status.phase === 'syncing';
  const resetAt = Date.parse(status.rateLimitResetAt || '');
  const waitingForQuota = Number.isFinite(resetAt) && resetAt > Date.now() &&
    ((counts.pending || 0) > 0 || /rate limit/i.test(status.error || ''));
  const isBusy = isSyncing || githubControls.searchBusy || githubControls.pasteBusy;
  const statusText = {
    idle: tracked.length ? 'Ready to sync' : 'No repositories tracked',
    syncing: 'Sync in progress',
    ready: 'Up to date',
    cached: 'Cached tracked data',
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
      'aria-label': 'Tracked repository sync progress'
    })
    : null;
  const syncLabel = isSyncing
    ? `${progressState.completed} of ${progressState.total} tracked repositories processed`
    : waitingForQuota ? `Queued until quota reset · ${fmtDateTime(status.rateLimitResetAt)}` : '';

  const searchInput = h('input', {
    class: 'cmd__input', type: 'search', value: githubControls.searchQuery,
    placeholder: 'Search repository names', autocomplete: 'off',
    'aria-label': 'Search my public GitHub repositories',
    disabled: isBusy,
    oninput: (event) => { githubControls.searchQuery = event.target.value; }
  });
  const searchForm = h('form', {
    class: 'github-form',
    onsubmit: async (event) => {
      event.preventDefault();
      if (isBusy || githubControls.searchBusy) return;
      githubControls.searchBusy = true;
      githubControls.searchMessage = '';
      ctx.rerender();
      const result = await ctx.searchGitHubRepositories(githubControls.searchQuery);
      githubControls.searchBusy = false;
      githubControls.searchResults = result.repositories || [];
      githubControls.searchTotal = Number(result.totalCount) || 0;
      githubControls.searchMessage = result.ok
        ? (result.repositories.length
          ? `${result.repositories.length} eligible result${result.repositories.length === 1 ? '' : 's'} shown${githubControls.searchTotal ? ` from ${githubControls.searchTotal} GitHub matches` : ''}${githubControls.searchTotal > 100 ? '; refine the name to see more' : ''}.`
          : 'No public, non-fork repositories matched that name.')
        : result.error;
      ctx.rerender();
    }
  }, searchInput, button(githubControls.searchBusy ? 'Searching…' : 'Search', () => {}, 'primary', {
    type: 'submit', disabled: isBusy
  }));

  const pasteInput = h('input', {
    class: 'cmd__input', type: 'url', value: githubControls.pasteUrl,
    placeholder: 'https://github.com/owner/repository',
    autocomplete: 'url', 'aria-label': 'GitHub repository URL',
    disabled: isBusy,
    oninput: (event) => {
      githubControls.pasteUrl = event.target.value;
      githubControls.verifiedRepository = null;
      githubControls.pasteMessage = '';
    }
  });
  const pasteForm = h('form', {
    class: 'github-form',
    onsubmit: async (event) => {
      event.preventDefault();
      if (isBusy || githubControls.pasteBusy) return;
      githubControls.pasteBusy = true;
      githubControls.verifiedRepository = null;
      githubControls.pasteMessage = '';
      ctx.rerender();
      const result = await ctx.lookupGitHubRepository(githubControls.pasteUrl);
      githubControls.pasteBusy = false;
      githubControls.verifiedRepository = result.ok ? result.repository : null;
      githubControls.pasteMessage = result.ok ? 'Public repository verified. Add it to tracking explicitly.' : result.error;
      ctx.rerender();
    }
  }, pasteInput, button(githubControls.pasteBusy ? 'Checking…' : 'Check URL', () => {}, '', {
    type: 'submit', disabled: isBusy
  }));

  const trackedList = tracked.length
    ? h('ul', { class: 'github-repository-list' }, tracked.map((repo) => repositoryRow(ctx, repo, tracked, { syncing: isBusy })))
    : h('p', { class: 'muted' }, 'Nothing is monitored until you add a repository to tracking.');
  const cachedList = cachedOnly.length
    ? h('details', { class: 'github-cached' },
      h('summary', null, `Cached only — ${cachedOnly.length} repositories, not monitored`),
      h('p', { class: 'muted' }, 'These are preserved from earlier discovery. Track one explicitly to resume updates.'),
      h('ul', { class: 'github-repository-list' }, cachedOnly.map((repo) => repositoryRow(ctx, repo, tracked, { cached: true, syncing: isBusy }))))
    : null;
  const searchResults = githubControls.searchResults.length
    ? h('ul', { class: 'github-repository-list' },
      githubControls.searchResults.map((repo) => h('li', { class: 'github-repository' },
        h('div', { class: 'github-repository__top' },
          h('div', null, repoLink(repo), repo.description ? h('small', null, repo.description) : null),
          isTracked(repo, tracked) ? badge('Tracked', 'cyan') : null),
        h('div', { class: 'github-repository__actions' }, trackButton(ctx, repo, tracked, isBusy)))))
    : null;
  const verified = githubControls.verifiedRepository
    ? h('div', { class: 'github-verified' },
      h('p', null, repoLink(githubControls.verifiedRepository)),
      trackButton(ctx, githubControls.verifiedRepository, tracked, isBusy))
    : null;

  return h('div', { class: 'github-connection' },
    h('div', { class: 'github-connection__head' },
      h('div', null, h('strong', null, 'GitHub'), h('small', null, 'Public repositories · read-only · no token stored')),
      badge(statusText, statusKind)),
    h('div', { class: 'github-connection__actions' },
      button(isSyncing ? 'Syncing…' : waitingForQuota ? 'Queued until reset' : 'Sync tracked',
        () => ctx.syncGitHub(), 'primary', { disabled: isBusy || waitingForQuota || tracked.length === 0 })),
    progress,
    syncLabel ? h('p', { class: 'muted', 'aria-live': 'polite' }, syncLabel) : null,
    h('p', { class: 'muted' },
      `${tracked.length} tracked · ${cachedOnly.length} cached only · ${counts.synced || 0} synced · ${counts.pending || 0} queued · ${counts.failed || 0} with sync issues`),
    h('p', { class: 'muted' }, 'Cached-only repositories are not monitored. Search and URL checks run only when you request them.'),
    status.rateLimitRemaining != null
      ? h('p', { class: 'muted' },
        `GitHub API quota: ${status.rateLimitRemaining} ${status.rateLimitResource || 'API'} requests remaining`,
        status.rateLimitResetAt ? ` · reset ${fmtDateTime(status.rateLimitResetAt)}` : '')
      : null,
    status.error ? h('p', { class: 'note note--bad', role: 'status' }, status.error) : null,
    status.notice ? h('p', { class: 'note note--warn', role: 'status' }, status.notice) : null,
    status.cache?.error ? h('p', { class: 'note note--bad', role: 'status' }, status.cache.error) : null,
    status.cache && !status.cache.available
      ? h('p', { class: 'muted' }, 'Browser storage is unavailable; GitHub cache will last only for this session.')
      : null,
    h('h3', { class: 'github-connection__section-title' }, 'Tracked repositories'),
    trackedList,
    cachedList,
    h('h3', { class: 'github-connection__section-title' }, 'Add repositories'),
    h('p', { class: 'muted' }, `Search is limited to public, non-fork repositories owned by ${GITHUB_OWNER}. A pasted URL can verify any public GitHub repository.`),
    searchForm,
    githubControls.searchMessage ? h('p', { class: 'muted', role: 'status' }, githubControls.searchMessage) : null,
    searchResults,
    pasteForm,
    githubControls.pasteMessage ? h('p', { class: 'muted', role: 'status' }, githubControls.pasteMessage) : null,
    verified,
    githubControls.actionMessage ? h('p', { class: 'muted', role: 'status' }, githubControls.actionMessage) : null);
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
