# STATE

Last updated: 2026-10-29. Phase 1 (Iris Shell). Imported from GitHub `main` at `459c038`.
No changes have been pushed to GitHub. The Replit preview is running; no deployment was made.

## Implemented (and how it was checked)

| Area | Status | Evidence |
|---|---|---|
| Responsive shell: bottom nav on phone, side rail at 768px+ | Works in Chromium emulation | Replit preview suite at 390x844 and 820x1180; no horizontal overflow |
| Navigation: Command, Projects, Agents, Activity, Tasks (hash routes) | All five routes and empty states checked | Replit preview browser suite at 390x844 and 820x1180 |
| Command view: Iris eye, command box, chips, transcript, Connections, Data panel | Works | Replit preview browser suite and visual screenshot |
| Iris eye: one segment per stored project, coloured by latest evidence level; sample dashed, blocked outlined | Rendering and selection work in Chromium emulation | Preview suite (segment count, empty caption); CDP touch, Enter, and Space activation; visual appearance checked in screenshot |
| Local commands (9) | Work | 15 unit tests + Replit preview browser suite |
| Projects / Agents / Activity / Tasks: list, expand, add, edit, delete, validation | Add, validation, edit prefill/save, delete cancel/accept, and project-reference detachment checked | Replit preview browser suite + unit tests |
| Empty states for every view | Work | Replit preview browser suite |
| Sample data: load, label, remove without touching real records | Works | Unit tests + Replit preview browser suite |
| Persistence: localStorage, survives reload; corrupt data backed up; save errors surfaced | Works | Unit tests + Replit preview browser suite |
| Export JSON (download) | Downloaded and parsed in browser | Replit preview browser suite; exported records matched edited UI state |
| Static server: serves only index.html, css/, js/; blocks traversal | Works | curl checks (package.json, serve.mjs, tests/, ../ all 404) |

## Verified results
- `npm test` / `node tests/run-tests.mjs`: 15/15 passed (Node 24.22.1). The added regression test covers local-date boundaries in Johannesburg and Los Angeles, due-today/future/undated tasks, and completed tasks.
- Before the fix, reproduced both UTC boundary errors: in `Africa/Johannesburg`, `2026-10-12T22:30Z` is local October 13 but `todayISO` returned October 12; in `America/Los_Angeles`, `2026-10-13T00:30Z` is local October 12 but `todayISO` returned October 13.
- Replit preview browser suite: 96/96 checks passed using temporary Node/CDP automation and headless Chromium 152, at 390x844 and 820x1180. It covered the full navigation/data flows, edit and delete for all four record types, confirmation cancellation and acceptance, project-reference detachment, an actual JSON download and parse, and the overdue badge under an emulated Johannesburg clock. No browser console errors or uncaught page exceptions were observed.
- `tests/smoke.py` was not run because Python Playwright is not installed. The temporary CDP runner was not added to the repository; no browser-test dependency was added.
- The Vite web workflow restarted successfully and served the preview. No GitHub push or deployment was made.

## NOT verified
- Real Android devices (Galaxy A56 browser, tablet). Only headless Chromium viewport emulation was used.
- Firefox, Safari, Samsung Internet.
- GitHub upload workflow on a phone.
- Real Android soft-keyboard behavior in the form dialog. Touch taps and Enter/Space activation on an eye segment passed in Chromium emulation.
- A mobile-emulation focus check showed the final project textarea extending below the form scroll area at 390x844; a reduced-height viewport kept the dialog and Save button visible. Physical-device behavior remains unknown.
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
2. No import of exported JSON. Export exists, restore does not.
3. Command transcript is session-only (not saved).
4. Activity `timestamp` is set at creation and not editable.
5. Eye shows at most 12 projects (caption says so beyond that).
6. No PWA/service worker, no offline support, no authentication.
7. Edits use native `window.confirm` dialogs for destructive actions.
8. System fonts only (no network during build; avoids external requests).
