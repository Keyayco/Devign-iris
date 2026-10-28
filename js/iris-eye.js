// Central visualisation. Every segment is one stored project; colour is the evidence level of
// that project's latest activity event. Nothing animates unless state changes.
import { s, h } from './dom.js';
import { latestEvent } from './selectors.js';

const C = 130;
const R_OUT = 112;
const R_IN = 74;
const MAX_SEGMENTS = 12;

const pt = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
function sector(a0, a1) {
  const [x0, y0] = pt(R_OUT, a0); const [x1, y1] = pt(R_OUT, a1);
  const [x2, y2] = pt(R_IN, a1); const [x3, y3] = pt(R_IN, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  const f = (n) => n.toFixed(2);
  return `M${f(x0)} ${f(y0)} A${R_OUT} ${R_OUT} 0 ${large} 1 ${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)} A${R_IN} ${R_IN} 0 ${large} 0 ${f(x3)} ${f(y3)} Z`;
}
const levelClass = (ev) => {
  if (!ev) return '';
  if (ev.evidence === 'failed') return 'eye-seg--failed';
  if (ev.evidence === 'verified' || ev.evidence === 'deployed') return 'eye-seg--verified';
  if (ev.evidence === 'tested') return 'eye-seg--tested';
  return 'eye-seg--reported'; // planned or reported: a claim without evidence
};

export function describeEye(state) {
  const n = state.projects.length;
  if (!n) return 'No projects recorded.';
  const lv = state.projects.map((p) => (latestEvent(state, p.id) || {}).evidence);
  const verified = lv.filter((e) => e === 'verified' || e === 'deployed').length;
  const none = lv.filter((e) => !e).length;
  return `${n} project${n > 1 ? 's' : ''}: ${verified} verified or deployed, ${none} with no recorded activity.`;
}

export function renderEye(state, onSelect) {
  const projects = state.projects.slice(0, MAX_SEGMENTS);
  const svg = s('svg', { viewBox: '0 0 260 260', role: 'img', 'aria-label': `Iris project status. ${describeEye(state)}` });
  svg.append(s('circle', { class: `eye-ring${projects.length ? '' : ' eye-ring--dormant'}`, cx: C, cy: C, r: R_OUT + 8 }));

  if (projects.length) {
    const step = 360 / projects.length; const gap = projects.length > 1 ? 4 : 0;
    projects.forEach((p, i) => {
      const cls = ['eye-seg', levelClass(latestEvent(state, p.id)), p.sample ? 'is-sample' : '', p.state === 'blocked' ? 'is-blocked' : '']
        .filter(Boolean).join(' ');
      const seg = s('path', { class: cls, d: sector(i * step + gap / 2, (i + 1) * step - gap / 2), tabindex: 0, role: 'link', 'aria-label': `${p.name}${p.sample ? ' (sample)' : ''}` }, s('title', null, p.name));
      const go = () => onSelect && onSelect(p.id);
      seg.addEventListener('click', go);
      seg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      svg.append(seg);
    });
  } else {
    svg.append(s('circle', { class: 'eye-ring eye-ring--dormant', cx: C, cy: C, r: (R_OUT + R_IN) / 2 }));
  }
  svg.append(
    s('circle', { class: 'eye-pupil', cx: C, cy: C, r: R_IN - 12 }),
    s('text', { class: 'eye-count', x: C, y: C + 4 }, String(state.projects.length)),
    s('text', { class: 'eye-label', x: C, y: C + 20 }, state.projects.length === 1 ? 'project' : 'projects'));

  const legend = h('div', { class: 'legend', 'aria-hidden': 'true' },
    h('span', null, h('i'), 'No activity'), h('span', null, h('i', { class: 'l-reported' }), 'Planned or reported'),
    h('span', null, h('i', { class: 'l-tested' }), 'Tested'), h('span', null, h('i', { class: 'l-verified' }), 'Verified or deployed'),
    h('span', null, h('i', { class: 'l-failed' }), 'Failed'));
  const extra = state.projects.length > MAX_SEGMENTS ? ` Showing the first ${MAX_SEGMENTS}.` : '';
  return h('div', { class: 'eye' }, svg, h('p', { class: 'eye__caption' }, describeEye(state) + extra), legend);
}

export function pulseEye(root) {
  const el = root.querySelector('.eye');
  if (!el) return;
  el.classList.add('eye--pulse');
  setTimeout(() => el.classList.remove('eye--pulse'), 400);
}
