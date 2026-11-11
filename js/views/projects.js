import { h, button, badge, sampleBadge, stateBadge, kv, row, viewHead, emptyState, fmtDateTime } from '../dom.js';
import { label } from '../schema.js';
import { eventsSorted, openTasksSorted, attentionReasons } from '../selectors.js';
import { addRecord, rowActions } from './actions.js';

function safeGitHubLink(url, text) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname === 'github.com') {
      return h('a', { href: parsed.href, target: '_blank', rel: 'noopener noreferrer' }, text);
    }
  } catch { /* render untrusted or unavailable URLs as plain text */ }
  return h('span', null, text);
}

function githubDetails(github, tracked = false) {
  if (!github) return null;
  const warningList = github.warnings || [];
  const docs = github.docs || [];
  const commits = github.commits || [];
  const branches = github.branches || [];
  const branchText = branches.length
    ? `${branches.join(', ')}${github.branchCount > branches.length ? `, +${github.branchCount - branches.length} more` : ''}`
    : '';

  return h('section', { class: 'github-project' },
    h('div', { class: 'github-project__head' },
      h('h3', null, 'GitHub-derived information'),
      badge('Read-only source', 'cyan'),
      badge(tracked ? 'Tracked' : 'Cached only · not monitored', tracked ? 'ok' : 'warn'),
      github.syncState === 'queued' ? badge('Sync queued', 'warn') : null,
      github.syncState === 'empty' ? badge('Empty repository', 'warn') : null,
      github.syncState === 'error' ? badge('Sync issue', 'bad') : null,
      github.identityConflict ? badge('Name match needs review', 'warn') : null,
      github.availableInOwnerList === false ? badge('No longer listed publicly', 'warn') : null),
    h('dl', { class: 'kv' },
      h('dt', null, 'Repository'),
      h('dd', null, safeGitHubLink(github.url, github.fullName || github.name || 'GitHub repository')),
      h('dt', null, 'Description'),
      h('dd', { class: github.description ? '' : 'is-unknown' }, github.description || 'No GitHub description'),
      h('dt', null, 'Default branch'),
      h('dd', { class: github.defaultBranch ? '' : 'is-unknown' }, github.defaultBranch || 'Unknown'),
      h('dt', null, 'Branches'),
      h('dd', { class: branchText ? '' : 'is-unknown' }, branchText || 'No branches returned'),
      h('dt', null, 'Repository last pushed'),
      h('dd', { class: github.pushedAt ? '' : 'is-unknown' }, github.pushedAt ? fmtDateTime(github.pushedAt) : 'Unknown'),
      h('dt', null, 'Last GitHub sync'),
      h('dd', { class: github.syncedAt ? '' : 'is-unknown' }, github.syncedAt ? fmtDateTime(github.syncedAt) : 'Not synced successfully yet')),
    github.syncError ? h('p', { class: 'note note--bad', role: 'status' }, github.syncError) : null,
    h('div', { class: 'github-project__list' },
      h('h4', null, 'Recent commits'),
      commits.length ? h('ul', null, commits.map((commit) =>
        h('li', null,
          safeGitHubLink(commit.url, `${commit.shortSha || ''} · ${commit.message || 'Commit'}`),
          h('small', null, `${commit.author || 'Unknown author'} · ${commit.date ? fmtDateTime(commit.date) : 'date unknown'}`))))
        : h('p', { class: 'muted' }, 'No commits returned.')),
    h('div', { class: 'github-project__list' },
      h('h4', null, 'Project documents'),
      docs.length ? h('ul', null, docs.map((doc) =>
        h('li', null, safeGitHubLink(doc.url, doc.path), doc.excerpt ? h('small', null, doc.excerpt) : null)))
        : h('p', { class: 'muted' }, 'No readable project documents found.')),
    warningList.length ? h('div', { class: 'github-project__warnings' },
      h('h4', null, 'Documentation and sync warnings'),
      h('ul', null, warningList.map((warning) =>
        h('li', null, badge(warning.type === 'conflict' ? 'Conflict' : warning.type === 'outdated' ? 'Possibly outdated' : 'Sync warning', warning.type === 'conflict' ? 'bad' : 'warn'),
          warning.path ? `${warning.path}: ` : '', warning.message))))
      : null,
    h('p', { class: 'github-project__disclaimer' }, 'Commit history is repository activity only; it does not prove that tests passed or that anything was deployed.'));
}

export function renderProjects(ctx) {
  const state = ctx.store.getState();
  const trackedGitHub = ctx.githubTrackedRepositories || [];
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
        h('div', { class: 'row__badges' }, sampleBadge(p), p.github ? badge('GitHub', 'cyan') : null, stateBadge(p.state, label(p.state)))],
      [kv([
        ['Purpose', p.purpose], ['Constraints', p.constraints], ['Last known implementation', p.lastImplementation],
        ['Latest evidence', events[0] ? `${label(events[0].evidence)}: ${events[0].summary}` : ''],
        ['Blockers and known bugs', p.blockers], ['Next recommended action', p.nextAction],
        ['Agents', agents.map((a) => `${a.name} (${label(a.status)})`).join(', ')],
        ['Needs attention', why.join('; ') || 'No recorded reason'],
        ['Last updated', fmtDateTime(p.updatedAt)]
      ]), githubDetails(p.github, trackedGitHub.some((repo) =>
        String(repo.id) === String(p.github?.repoId || p.github?.id || '') ||
        String(repo.fullName || '').toLowerCase() === String(p.github?.fullName || '').toLowerCase()
      )), rowActions(ctx, 'projects', p, 'project')])));
  }
  root.append(list);
  return root;
}
