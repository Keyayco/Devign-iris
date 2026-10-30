// Dependency-free unit tests for the DOM-free modules. Run: node tests/run-tests.mjs
import assert from 'node:assert/strict';
import { validate, FIELDS, COLLECTIONS } from '../js/schema.js';
import { createStore, STORAGE_KEY } from '../js/store.js';
import { getSampleRecords } from '../js/sample-data.js';
import { runCommand } from '../js/commands.js';
import { dataMode, attentionReasons, todayISO, isOverdue } from '../js/selectors.js';

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const memStorage = (seed = {}) => {
  const d = { ...seed };
  return { d, getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } };
};
const NOW = new Date('2026-10-12T10:00:00Z');

test('validate: required, enum, date, project reference', () => {
  assert.equal(validate('projects', { name: '' }).ok, false);
  assert.equal(validate('projects', { name: 'X', state: 'bogus' }).errors.state !== undefined, true);
  assert.equal(validate('tasks', { title: 'T', due: '12/10/2026' }).errors.due !== undefined, true);
  assert.equal(validate('tasks', { title: 'T', projectId: 'nope' }, []).errors.projectId !== undefined, true);
  const ok = validate('tasks', { title: ' T ', projectId: 'p1', due: '2026-10-12' }, ['p1']);
  assert.equal(ok.ok, true); assert.equal(ok.record.title, 'T'); assert.equal(ok.record.priority, 'medium');
  assert.equal(validate('nope', {}).ok, false);
});

test('validate: activity defaults to reported evidence, never verified', () => {
  const r = validate('activity', { summary: 'did a thing' });
  assert.equal(r.ok, true); assert.equal(r.record.evidence, 'reported');
});

test('store: add / update / remove and project detach', () => {
  const s = createStore(null);
  const p = s.add('projects', { name: 'Alpha' }).record;
  const t = s.add('tasks', { title: 'Do it', projectId: p.id }).record;
  assert.equal(s.getState().tasks[0].projectId, p.id);
  assert.equal(s.update('projects', p.id, { name: 'Alpha2' }).record.name, 'Alpha2');
  assert.equal(s.update('projects', 'missing', { name: 'x' }).ok, false);
  assert.equal(s.add('projects', { name: '' }).ok, false);
  assert.equal(s.remove('projects', p.id), true);
  assert.equal(s.getState().tasks.find((x) => x.id === t.id).projectId, '');
  assert.equal(s.remove('projects', p.id), false);
});

test('store: persists and reloads through storage', () => {
  const st = memStorage();
  const a = createStore(st); a.add('projects', { name: 'Persisted' });
  const b = createStore(st);
  assert.equal(b.getState().projects[0].name, 'Persisted');
  assert.equal(b.getStatus().persisted, true);
});

test('store: corrupt storage is backed up, not silently destroyed', () => {
  const st = memStorage({ [STORAGE_KEY]: '{not json' });
  const s = createStore(st);
  assert.ok(s.getStatus().loadError);
  assert.equal(s.getState().projects.length, 0);
  assert.ok(Object.keys(st.d).some((k) => k.startsWith(`${STORAGE_KEY}:corrupt-`)));
});

test('store: save failure is reported, state kept in memory', () => {
  const st = memStorage(); st.setItem = () => { throw new Error('quota'); };
  const s = createStore(st);
  assert.equal(s.add('projects', { name: 'X' }).ok, true);
  assert.match(s.getStatus().saveError, /quota/);
  assert.equal(s.getState().projects.length, 1);
});

test('store: no storage means memory-only and says so', () => {
  assert.equal(createStore(null).getStatus().persisted, false);
});

test('sample data: valid refs, labelled sample on import, idempotent, removable', () => {
  const sample = getSampleRecords(NOW);
  const ids = new Set(sample.projects.map((p) => p.id));
  for (const c of ['agents', 'activity', 'tasks']) for (const r of sample[c]) assert.ok(!r.projectId || ids.has(r.projectId), `${c} ref`);
  for (const c of COLLECTIONS) for (const r of sample[c]) {
    const v = validate(c, r, [...ids]);
    assert.equal(v.ok, true, `${c}/${r.id}: ${JSON.stringify(v.errors)}`);
  }
  const s = createStore(null);
  const real = s.add('projects', { name: 'Real' }).record;
  assert.ok(s.loadSample(sample) > 0);
  assert.equal(s.loadSample(sample), 0);
  assert.equal(dataMode(s.getState()), 'mixed');
  assert.ok(s.getState().projects.filter((p) => p.sample).length === 3);
  s.clearSample();
  assert.equal(s.getState().projects.length, 1);
  assert.equal(s.getState().projects[0].id, real.id);
  assert.equal(dataMode(s.getState()), 'stored');
});

test('selectors: dataMode empty / sample', () => {
  const s = createStore(null);
  assert.equal(dataMode(s.getState()), 'empty');
  s.loadSample(getSampleRecords(NOW));
  assert.equal(dataMode(s.getState()), 'sample');
});

test('selectors: overdue uses local date and excludes due-today, future, completed, and undated tasks', () => {
  const originalTZ = process.env.TZ;
  try {
    process.env.TZ = 'Africa/Johannesburg';
    const afterLocalMidnight = new Date('2026-10-12T22:30:00.000Z');
    assert.equal(todayISO(afterLocalMidnight), '2026-10-13');
    assert.equal(isOverdue({ status: 'open', due: '2026-10-12' }, afterLocalMidnight), true);
    assert.equal(isOverdue({ status: 'open', due: '2026-10-13' }, afterLocalMidnight), false);
    assert.equal(isOverdue({ status: 'open', due: '2026-10-14' }, afterLocalMidnight), false);
    assert.equal(isOverdue({ status: 'open', due: '' }, afterLocalMidnight), false);

    process.env.TZ = 'America/Los_Angeles';
    const beforeLocalMidnight = new Date('2026-10-13T00:30:00.000Z');
    assert.equal(todayISO(beforeLocalMidnight), '2026-10-12');
    assert.equal(isOverdue({ status: 'open', due: '2026-10-12' }, beforeLocalMidnight), false);
    assert.equal(isOverdue({ status: 'open', due: '2026-10-11' }, beforeLocalMidnight), true);
    assert.equal(isOverdue({ status: 'done', due: '2026-10-11' }, beforeLocalMidnight), false);
  } finally {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  }
});

test('task done toggle', () => {
  const s = createStore(null);
  const t = s.add('tasks', { title: 'x' }).record;
  assert.equal(s.setTaskDone(t.id, true), true);
  assert.equal(s.getState().tasks[0].status, 'done');
  assert.equal(s.setTaskDone('nope', true), false);
});

test('commands: empty state is honest, nothing invented', () => {
  const s = createStore(null);
  const b = runCommand('briefing', s.getState(), NOW).lines.join(' ');
  assert.match(b, /Nothing is recorded yet/);
  assert.match(runCommand('what did we implement last', s.getState(), NOW).lines[0], /No implementation activity recorded/);
  assert.match(runCommand('which projects need attention', s.getState(), NOW).lines[0], /No projects recorded/);
});

test('commands: navigation, add task action, unknown input', () => {
  const s = createStore(null).getState();
  assert.deepEqual(runCommand('open agents', s).view, 'agents');
  assert.equal(runCommand('go to tasks', s).kind, 'navigate');
  const a = runCommand('Add task Call the Client', s);
  assert.equal(a.kind, 'action'); assert.equal(a.action.input.title, 'Call the Client');
  const u = runCommand('write me a poem', s);
  assert.equal(u.kind, 'reply'); assert.match(u.lines.join(' '), /did not recognise/);
});

test('commands: answers from sample data are tagged [sample]', () => {
  const s = createStore(null); s.loadSample(getSampleRecords(NOW));
  const st = s.getState();
  assert.match(runCommand('which projects need attention', st, NOW).lines.join('\n'), /Client Portal \[sample\]: marked blocked/);
  assert.match(runCommand('what is blocking client portal', st, NOW).lines.join(' '), /sign in/);
  assert.match(runCommand('what did we implement last', st, NOW).lines.join(' '), /\[sample\]/);
  assert.match(runCommand('what is blocking nonexistent', st, NOW).lines[0], /No project matches/);
  assert.match(runCommand('handover', st, NOW).lines[0], /does not reflect repository/);
  const lf = st.projects.find((p) => p.id === 'sample-p-leadforge');
  assert.ok(attentionReasons(st, lf, NOW).some((r) => /overdue/.test(r)));
});

test('field specs: every collection has a required field and unique names', () => {
  for (const c of COLLECTIONS) {
    const names = FIELDS[c].map((f) => f.name);
    assert.equal(new Set(names).size, names.length);
    assert.ok(FIELDS[c].some((f) => f.required));
  }
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`PASS  ${name}`); } catch (e) { failed += 1; console.log(`FAIL  ${name}\n      ${e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
