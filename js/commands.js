// Local command interpreter. DOM-free and pure: it reads records and returns a result;
// the caller decides what to do with it. No AI model is involved in Phase 1.
import { label } from './schema.js';
import {
  attentionReasons, eventsSorted, latestEvent, openTasksSorted, projectName, sampleTag, isOverdue, dataMode, MODE_LABELS
} from './selectors.js';

const VIEW_ALIASES = {
  command: 'command', project: 'projects', projects: 'projects', agent: 'agents', agents: 'agents',
  activity: 'activity', task: 'tasks', tasks: 'tasks'
};

export const HELP_LINES = [
  'Iris Shell understands these local commands:',
  'briefing: summary of stored records',
  'which projects need attention',
  'what did we implement last',
  'what is blocking <project name>',
  'list projects | agents | tasks | activity',
  'open projects | agents | activity | tasks',
  'add task <title>',
  'handover: plain-text summary of stored records',
  'These read stored records only. AI reasoning is not connected yet.'
];

const reply = (lines, extra = {}) => ({ kind: 'reply', lines, ...extra });
const none = (what) => `No ${what} recorded.`;

export function runCommand(input, state, now = new Date()) {
  const text = String(input || '').trim();
  const t = text.toLowerCase().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
  if (!t) return reply(['Type a command, or "help" to see what Iris can do.']);

  if (t === 'help' || t === '?') return reply(HELP_LINES);

  let m = t.match(/^(?:go to|go|open|show)\s+(command|projects?|agents?|activity|tasks?)$/);
  if (m) return { kind: 'navigate', view: VIEW_ALIASES[m[1]], lines: [`Opening ${VIEW_ALIASES[m[1]]}.`] };

  m = text.match(/^(?:create|add|new)\s+task[:\s]+(.+)$/i);
  if (m) {
    return { kind: 'action', action: { type: 'add', collection: 'tasks', input: { title: m[1].trim(), priority: 'medium', status: 'open' } }, lines: [`Adding task: ${m[1].trim()}`] };
  }

  m = t.match(/^list\s+(projects?|agents?|tasks?|activity)$/);
  if (m) return reply(listLines(state, VIEW_ALIASES[m[1]], now));

  if (t.includes('briefing') || t === 'brief') return reply(briefingLines(state, now));
  if (t.includes('handover')) return reply(handoverLines(state, now));
  if (t.includes('attention')) return reply(attentionLines(state, now));
  if ((t.includes('implement') && /(last|latest|recent)/.test(t)) || t === 'last') return reply(lastLines(state));

  m = t.match(/blocking\s+(.+)$/);
  if (m) return reply(blockingLines(state, m[1].trim()));
  if (t.includes('blocked') || t.includes('blockers')) return reply(blockingLines(state, ''));

  return reply([
    `Iris did not recognise "${text}".`,
    'Only local commands work right now; AI reasoning is not connected. Type "help" for the list.'
  ]);
}

function listLines(state, view, now) {
  if (view === 'projects') return state.projects.length ? state.projects.map((p) => `${p.name}: ${label(p.state)}${sampleTag(p)}`) : [none('projects')];
  if (view === 'agents') return state.agents.length ? state.agents.map((a) => `${a.name}: ${label(a.status)}${a.projectId ? ` on ${projectName(state, a.projectId)}` : ''}${sampleTag(a)}`) : [none('agents')];
  if (view === 'tasks') {
    const open = openTasksSorted(state);
    return open.length ? open.map((k) => `${k.title} (${label(k.priority)}${k.due ? `, due ${k.due}` : ''}${isOverdue(k, now) ? ', overdue' : ''})${sampleTag(k)}`) : [none('open tasks')];
  }
  const ev = eventsSorted(state);
  return ev.length ? ev.slice(0, 10).map((e) => `${label(e.evidence)}: ${e.summary}${sampleTag(e)}`) : [none('activity')];
}

export function briefingLines(state, now = new Date()) {
  const mode = dataMode(state);
  const lines = [`Records: ${state.projects.length} projects, ${state.agents.length} agents, ${state.activity.length} activity events, ${state.tasks.length} tasks (${MODE_LABELS[mode]}).`];
  if (mode === 'empty') return [...lines, 'Nothing is recorded yet. Add a project, or load sample data from the Command view.'];
  if (mode === 'sample' || mode === 'mixed') lines.push('Some records are sample data and do not describe real work.');
  const attention = state.projects.filter((p) => attentionReasons(state, p, now).length);
  lines.push(attention.length ? `Needing attention: ${attention.map((p) => p.name).join(', ')}.` : 'No project has a recorded reason to need attention.');
  const open = openTasksSorted(state);
  const overdue = open.filter((k) => isOverdue(k, now)).length;
  lines.push(`Open tasks: ${open.length}${overdue ? `, ${overdue} overdue` : ''}.`);
  const ev = eventsSorted(state)[0];
  lines.push(ev ? `Latest activity: ${label(ev.evidence)}, "${ev.summary}"${sampleTag(ev)}.` : 'No implementation activity is recorded.');
  return lines;
}

function attentionLines(state, now) {
  if (!state.projects.length) return [none('projects')];
  const out = [];
  for (const p of state.projects) {
    const r = attentionReasons(state, p, now);
    if (r.length) out.push(`${p.name}${sampleTag(p)}: ${r.join('; ')}`);
  }
  return out.length ? out : ['No project has a recorded reason to need attention.'];
}

function lastLines(state) {
  const ev = eventsSorted(state)[0];
  if (!ev) return [none('implementation activity')];
  const proj = projectName(state, ev.projectId);
  return [
    `${proj || 'No project'}${sampleTag(ev)}: ${ev.summary}`,
    `Evidence: ${label(ev.evidence)}. ${['verified', 'deployed', 'tested'].includes(ev.evidence) ? '' : 'Not verified.'}`.trim(),
    `Recorded: ${String(ev.timestamp || ev.createdAt).slice(0, 16).replace('T', ' ')} UTC. Commit: ${ev.commit || 'Unknown'}.`
  ];
}

function blockingLines(state, name) {
  const projects = name ? state.projects.filter((p) => p.name.toLowerCase().includes(name)) : state.projects;
  if (name && !projects.length) return [`No project matches "${name}".`];
  const out = [];
  for (const p of projects) {
    const bits = [];
    if (p.state === 'blocked') bits.push('marked blocked');
    if (p.blockers) bits.push(p.blockers);
    state.agents.filter((a) => a.projectId === p.id && a.status === 'blocked').forEach((a) => bits.push(`agent ${a.name} is blocked`));
    if (bits.length) out.push(`${p.name}${sampleTag(p)}: ${bits.join('; ')}`);
  }
  if (out.length) return out;
  return [name ? `No blockers are recorded for ${projects.map((p) => p.name).join(', ')}.` : 'No blockers are recorded.'];
}

export function handoverLines(state, now = new Date()) {
  const lines = ['Records handover (generated from Iris records only; it does not reflect repository or deployment state).', ''];
  if (!state.projects.length) return [...lines, none('projects')];
  for (const p of state.projects) {
    lines.push(`${p.name}${sampleTag(p)}: ${label(p.state)}`);
    if (p.purpose) lines.push(`  Purpose: ${p.purpose}`);
    const ev = latestEvent(state, p.id);
    lines.push(`  Last activity: ${ev ? `${label(ev.evidence)}, ${ev.summary}` : 'Unknown'}`);
    const agents = state.agents.filter((a) => a.projectId === p.id);
    if (agents.length) lines.push(`  Agents: ${agents.map((a) => `${a.name} (${label(a.status)})`).join(', ')}`);
    const tasks = state.tasks.filter((k) => k.projectId === p.id && k.status === 'open');
    if (tasks.length) lines.push(`  Open tasks: ${tasks.map((k) => k.title).join('; ')}`);
    if (p.blockers) lines.push(`  Blockers: ${p.blockers}`);
    if (p.nextAction) lines.push(`  Next: ${p.nextAction}`);
  }
  return lines;
}
