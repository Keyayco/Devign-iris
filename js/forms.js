// Generic add/edit dialog built from the field specs in schema.js.
import { FIELDS, label } from './schema.js';
import { h, button } from './dom.js';

/**
 * openForm({ collection, title, initial, projects, onSubmit })
 * onSubmit(values) returns { ok, errors } - on !ok the dialog stays open and shows errors.
 */
export function openForm({ collection, title, initial = {}, projects = [], onSubmit }) {
  const dialog = h('dialog', { 'aria-labelledby': 'form-title' });
  const form = h('form', { class: 'form', method: 'dialog', novalidate: true });
  const body = h('div', { class: 'form__body' });
  const inputs = {};
  const errorEls = {};

  for (const f of FIELDS[collection]) {
    const id = `f-${f.name}`;
    let input;
    const value = initial[f.name] != null && initial[f.name] !== '' ? initial[f.name] : f.default || '';
    if (f.type === 'textarea') input = h('textarea', { id, name: f.name }, value);
    else if (f.type === 'select') {
      input = h('select', { id, name: f.name }, f.options.map((o) => h('option', { value: o, selected: o === value }, label(o))));
    } else if (f.type === 'project') {
      input = h('select', { id, name: f.name },
        h('option', { value: '' }, 'None'),
        projects.map((p) => h('option', { value: p.id, selected: p.id === value }, p.name)));
    } else input = h('input', { id, name: f.name, type: f.type === 'date' ? 'date' : 'text', value, autocomplete: 'off' });
    if (f.required) input.setAttribute('aria-required', 'true');
    inputs[f.name] = input;
    errorEls[f.name] = h('p', { class: 'field__error', role: 'alert', hidden: true });
    body.append(h('div', { class: 'field', 'data-field': f.name }, h('label', { for: id }, f.label), input, errorEls[f.name]));
  }

  const showErrors = (errors = {}) => {
    for (const name of Object.keys(errorEls)) {
      const msg = errors[name];
      errorEls[name].hidden = !msg; errorEls[name].textContent = msg || '';
      errorEls[name].parentElement.classList.toggle('field--error', !!msg);
    }
    const first = Object.keys(errors).find((k) => inputs[k]);
    if (first) inputs[first].focus();
  };

  const close = () => { dialog.close(); dialog.remove(); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = {};
    for (const [k, el] of Object.entries(inputs)) values[k] = el.value;
    const res = onSubmit(values);
    if (res && res.ok) close(); else showErrors((res && res.errors) || { _: 'Could not save.' });
  });
  dialog.addEventListener('cancel', () => dialog.remove());

  form.append(
    h('div', { class: 'form__head' }, h('h2', { id: 'form-title' }, title)),
    body,
    h('div', { class: 'form__foot' }, button('Cancel', close, 'quiet'), h('button', { type: 'submit', class: 'btn btn--primary' }, 'Save')));
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  const firstInput = Object.values(inputs)[0];
  if (firstInput) firstInput.focus();
}
