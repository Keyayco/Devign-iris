# STATE

Last updated: 2026-10-28. Phase 1 (Iris Shell). Package: COMPLETE PROJECT PACKAGE.
Repository revision: **Unknown.** Nothing from this session has been committed to GitHub or deployed anywhere.

## Implemented (and how it was checked)

| Area | Status | Evidence |
|---|---|---|
| Responsive shell: bottom nav on phone, side rail at 768px+ | Works in Chromium emulation | smoke test at 390x844 and 820x1180, no horizontal overflow |
| Navigation: Command, Projects, Agents, Activity, Tasks (hash routes) | Works | smoke test |
| Command view: Iris eye, command box, chips, transcript, Connections, Data panel | Works | smoke test |
| Iris eye: one segment per stored project, coloured by latest evidence level; sample dashed, blocked outlined | Works | smoke test (segment count, empty caption); colours checked visually in screenshots |
| Local commands (9) | Work | 14 unit tests + smoke test |
| Projects / Agents / Activity / Tasks: list, expand, add, edit, delete, validation | Add, validation, toggle, persistence checked; edit and delete have unit-test coverage at store level only | smoke test + unit tests |
| Empty states for every view | Work | smoke test |
| Sample data: load, label, remove without touching real records | Works | unit + smoke tests |
| Persistence: localStorage, survives reload; corrupt data backed up; save errors surfaced | Works | unit + smoke tests |
| Export JSON (download) | **Not tested** | button exists; download not exercised |
| Static server: serves only index.html, css/, js/; blocks traversal | Works | curl checks (package.json, serve.mjs, tests/, ../ all 404) |

## Verified results
- `npm test` / `node tests/run-tests.mjs`: 14/14 passed (Node 22.22.2).
- `tests/smoke.py` against `node serve.mjs`: 50/50 passed (Playwright Chromium 141, touch emulation, phone 390x844 and tablet 820x1180). No console errors.
- `npm start` starts the server and `GET /` returned 200.

## NOT verified
- Real Android devices (Galaxy A56 browser, tablet). Only desktop Chromium emulation was used.
- Firefox, Safari, Samsung Internet.
- Anything in Replit (running, deploying, `npm start`, port handling).
- GitHub upload workflow on a phone.
- Export JSON download, Edit and Delete buttons through the UI, the project-segment tap in the Iris eye (keyboard and touch), dialog behaviour with the on-screen keyboard.
- Accessibility beyond basics (focus rings, labels, reduced-motion CSS are present; no audit was run).

## Architecture
- Native ES modules, no build. `store.js` takes an injected storage object (localStorage in the browser, an in-memory fake in tests).
- Data model (schema version 1, key `devign-iris:v1`): `projects`, `agents`, `activity`, `tasks`. Every record has `id`, `sample`, `createdAt`, `updatedAt`. Field specs in `js/schema.js` drive forms and validation. Activity records also get `timestamp`.
- Deleting a project clears `projectId` on records that referenced it (no cascade delete).
- Views are functions `(ctx) => HTMLElement`; `ctx` carries `store`, `navigate`, `rerender`, `loadSample`, `openProject`. The shell re-renders on every store change and restores scroll position and open rows.
- Router: `#/command|projects|agents|activity|tasks`; unknown hash falls back to Command.

## Configuration
No environment variables, secrets, or external services. `PORT` optional for `serve.mjs` (default 8000, host 0.0.0.0).

## Known limitations and defects
1. **Persistence is browser-only.** The brief requires records to survive restarts; this holds per browser/profile only. Clearing site data erases everything. A server-backed store is a later, approval-gated decision.
2. **Overdue uses the UTC date**, not local time. Near midnight in UTC+2 a task can be flagged overdue up to two hours late. Fix: compare against a local-date string.
3. No import of exported JSON. Export exists, restore does not.
4. Command transcript is session-only (not saved).
5. Activity `timestamp` is set at creation and not editable.
6. Eye shows at most 12 projects (caption says so beyond that).
7. No PWA/service worker, no offline support, no authentication.
8. Edits use native `window.confirm` dialogs for destructive actions.
9. System fonts only (no network during build; avoids external requests).
