// Hash router (#/projects). Works on any static host without server rewrites.
export const VIEWS = ['command', 'projects', 'agents', 'activity', 'tasks'];
export const VIEW_TITLES = { command: 'Command', projects: 'Projects', agents: 'Agents', activity: 'Activity', tasks: 'Tasks' };

export const currentView = () => {
  const name = location.hash.replace(/^#\/?/, '').split('?')[0];
  return VIEWS.includes(name) ? name : 'command';
};
export const navigate = (view) => { location.hash = `#/${view}`; };
export const onRouteChange = (fn) => window.addEventListener('hashchange', fn);
