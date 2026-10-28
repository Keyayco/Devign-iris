// Shared add / edit / delete behaviour for the registry views.
import { openForm } from '../forms.js';
import { h, button } from '../dom.js';

export function addRecord(ctx, collection, title, initial = {}) {
  openForm({ collection, title, initial, projects: ctx.store.getState().projects, onSubmit: (v) => ctx.store.add(collection, v) });
}
export function editRecord(ctx, collection, rec, title) {
  openForm({ collection, title, initial: rec, projects: ctx.store.getState().projects, onSubmit: (v) => ctx.store.update(collection, rec.id, v) });
}
export function deleteRecord(ctx, collection, rec, what) {
  if (window.confirm(`Delete ${what}? This cannot be undone.`)) ctx.store.remove(collection, rec.id);
}
export function rowActions(ctx, collection, rec, what) {
  return h('div', { class: 'btn-row' },
    button('Edit', () => editRecord(ctx, collection, rec, `Edit ${what}`), 'small'),
    button('Delete', () => deleteRecord(ctx, collection, rec, what), 'small danger'));
}
