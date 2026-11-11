// Application bootstrap: builds the shell, wires store, router, and views.
import { h, s, clear, badge, openRow } from './dom.js';
import { createStore } from './store.js';
import { getSampleRecords } from './sample-data.js';
import { VIEWS, VIEW_TITLES, currentView, navigate, onRouteChange } from './router.js';
import { dataMode, MODE_LABELS } from './selectors.js';
import { renderCommand } from './views/command.js';
import { renderProjects } from './views/projects.js';
import { renderAgents } from './views/agents.js';
import { renderActivity } from './views/activity.js';
import { renderTasks } from './views/tasks.js';
import { createGitHubCache } from './integrations/github-cache.js';
import { createGitHubClient, shouldRefreshGitHub } from './integrations/github.js';

const RENDERERS = { command: renderCommand, projects: renderProjects, agents: renderAgents, activity: renderActivity, tasks: renderTasks };

function safeStorage() {
  try {
    const st = window.localStorage;
    st.setItem('devign-iris:probe', '1'); st.removeItem('devign-iris:probe');
    return st;
  } catch (e) { return null; }
}

const browserStorage = safeStorage();
const store = createStore(browserStorage);
const githubCache = createGitHubCache(browserStorage);
const app = document.getElementById('app');
let githubStatus;
let githubClient;
let githubResumeTimer = 0;

const ctx = {
  store,
  navigate,
  rerender: () => render(),
  loadSample: () => store.loadSample(getSampleRecords()),
  openProject: (id) => { openRow(id); navigate('projects'); },
  get githubStatus() { return githubStatus; },
  get githubTrackedRepositories() { return githubClient.getTrackedProfiles(); },
  get githubCachedRepositories() { return githubClient.getCachedRepositories(); },
  searchGitHubRepositories: (query) => githubClient.searchRepositories(query),
  lookupGitHubRepository: (url) => githubClient.lookupRepository(url),
  trackGitHubRepository: (repo) => {
    const tracked = githubClient.trackRepository(repo);
    scheduleGitHubResume();
    return tracked;
  },
  untrackGitHubRepository: (repo) => {
    const removed = githubClient.untrackRepository(repo);
    scheduleGitHubResume();
    return removed;
  },
  syncGitHub: () => syncGitHub()
};

async function syncGitHub() {
  const result = await githubClient.sync();
  store.syncGitHubProjects(result.repositories);
  githubStatus = githubClient.getStatus();
  render();
  scheduleGitHubResume();
  return result;
}

function scheduleGitHubResume() {
  if (githubResumeTimer) window.clearTimeout(githubResumeTimer);
  githubResumeTimer = 0;
  const snapshot = githubClient.getSnapshot();
  const status = githubClient.getStatus();
  const shouldResume = status.trackedCount > 0 &&
    ((status.counts?.pending || 0) > 0 || /rate limit/i.test(status.error || ''));
  const resetAt = Date.parse(snapshot.rateLimitResetAt || status.rateLimitResetAt || '');
  if (!shouldResume || !Number.isFinite(resetAt)) return;
  const delay = resetAt - Date.now() + 1500;
  if (delay <= 0) return;
  githubResumeTimer = window.setTimeout(() => {
    githubResumeTimer = 0;
    void syncGitHub();
  }, Math.min(delay, 2_147_000_000));
}

githubClient = createGitHubClient({
  cache: githubCache,
  onStatus: (next) => { githubStatus = next; render(); }
});
githubStatus = githubClient.getStatus();

function brandMark() {
  return s('svg', { viewBox: '0 0 32 32', 'aria-hidden': 'true' },
    s('circle', { cx: 16, cy: 16, r: 11, fill: 'none', stroke: 'var(--cyan)', 'stroke-width': 3 }),
    s('circle', { cx: 16, cy: 16, r: 4, fill: 'var(--cyan)' }));
}

function render() {
  const state = store.getState();
  const status = store.getStatus();
  const view = currentView();
  const y = window.scrollY;
  document.title = `${VIEW_TITLES[view]} · Devign Iris`;

  const mode = dataMode(state);
  const top = h('header', { class: 'topbar' },
    h('div', { class: 'brand' }, brandMark(), 'Devign Iris'),
    h('div', { class: 'topbar__status' },
      badge(MODE_LABELS[mode], mode === 'sample' || mode === 'mixed' ? 'sample' : mode === 'stored' ? 'cyan' : ''),
      status.persisted ? null : badge('Not saved', 'warn')));

  const nav = h('nav', { class: 'nav', 'aria-label': 'Primary' }, VIEWS.map((v) =>
    h('a', { href: `#/${v}`, 'aria-current': v === view ? 'page' : null }, VIEW_TITLES[v],
      v !== 'command' ? h('span', { class: 'nav__count' }, String(state[v].length)) : null)));

  let content;
  try { content = RENDERERS[view](ctx); } catch (err) {
    content = h('p', { class: 'note note--bad', role: 'alert' }, `This view failed to render: ${err.message}`);
    console.error(err);
  }
  clear(app);
  app.append(top, h('main', { class: 'main', id: 'main' }, content), nav);
  window.scrollTo(0, y);
}

store.subscribe(() => render());
onRouteChange(() => { render(); window.scrollTo(0, 0); });
store.syncGitHubProjects(githubClient.getTrackedProfiles());
render();
scheduleGitHubResume();
if (shouldRefreshGitHub(githubClient.getSnapshot())) void syncGitHub();
