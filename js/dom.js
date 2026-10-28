// Small DOM helpers. All user data goes through text nodes, never innerHTML.
const SVG_NS = 'http://www.w3.org/2000/svg';

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}
function applyAttrs(el, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
}
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  applyAttrs(el, attrs); append(el, children);
  return el;
}
export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyAttrs(el, attrs); append(el, children);
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function badge(text, kind = '') { return h('span', { class: `badge${kind ? ` badge--${kind}` : ''}` }, text); }
export const sampleBadge = (r) => (r && r.sample ? badge('Sample', 'sample') : null);

const KIND_BY_VALUE = {
  active: 'cyan', blocked: 'bad', done: 'ok', verified: 'ok', deployed: 'ok', tested: 'cyan', failed: 'bad',
  reported: 'warn', planned: '', reported_active: 'warn', assigned: 'cyan', registered: '', high: 'bad', medium: 'warn', low: ''
};
export const stateBadge = (value, text) => badge(text, KIND_BY_VALUE[value] || '');

/** Definition list; blank values render as an explicit "Unknown" so gaps are visible. */
export function kv(pairs, unknownText = 'Unknown') {
  const dl = h('dl', { class: 'kv' });
  for (const [k, v] of pairs) {
    dl.append(h('dt', null, k), h('dd', { class: v ? '' : 'is-unknown' }, v || unknownText));
  }
  return dl;
}

export function fmtDateTime(iso) {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function viewHead(title, sub, ...actions) {
  return h('div', { class: 'view-head' },
    h('div', null, h('h1', null, title), sub ? h('p', { class: 'view-head__sub' }, sub) : null),
    h('div', { class: 'btn-row' }, actions));
}

export function emptyState(title, body, ...actions) {
  return h('div', { class: 'empty' }, h('h2', null, title), h('p', null, body), h('div', { class: 'btn-row' }, actions));
}

export const button = (text, onClick, kind = '', extra = {}) =>
  h('button', { type: 'button', class: `btn${kind ? ` btn--${kind.split(' ').join(' btn--')}` : ''}`, onclick: onClick, ...extra }, text);

// Remember which rows are expanded so re-rendering after an edit does not collapse them.
const openIds = new Set();
export const openRow = (id) => openIds.add(id);
export function row(id, summaryChildren, bodyChildren, extraClass = '') {
  const d = h('details', { class: `row ${extraClass}`.trim(), 'data-id': id });
  if (openIds.has(id)) d.open = true;
  d.addEventListener('toggle', () => { if (d.open) openIds.add(id); else openIds.delete(id); });
  d.append(h('summary', null, summaryChildren), h('div', { class: 'row__body' }, bodyChildren));
  return d;
}
