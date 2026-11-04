# STATE

Last updated: 2026-11-04. Phase 1 (Iris Shell) with GitHub read-only sync implemented locally.
Working baseline: GitHub `Keyayco/Devign-iris` `main` at `6cfe5d2fcd9031fe7b50fb8570fd76b36d3e58b0`. Changes in this working copy have not been pushed or deployed.

## Implemented

| Area | Status | Evidence |
|---|---|---|
| Iris Shell, five routes, local commands, forms, sample data, browser-only persistence | Existing behavior retained | Existing history in `LOGS.md`; source test suite |
| GitHub public repository discovery | Implemented | Unit test covers owner/public/non-fork filtering and paginated discovery |
| GitHub metadata, README/project documents, branches, recent commits | Implemented | Mocked integration-client tests; empty/missing docs are handled |
| Project linking/upsert and manual-note preservation | Implemented without schema migration | Tests cover duplicate prevention, ambiguous name match, manual fields/name edits, and reload |
| Documentation conflict/outdated flags | Implemented as deterministic indicators | Tests cover explicit branch/revision conflicts and declared stale dates |
| Anonymous API quota management | Implemented | Tests cover reserve/batch limit, queued work, pre-reset pause, and post-reset resume |
| Connection and project UI | Implemented | Mocked UI checks and a bounded live first sync; full-sync browser pass remains unverified |

## Current verification

- `npm test`: 23/23 passed after the GitHub changes, including discovery pagination, branch pagination, document reads/missing files, duplicate prevention, manual-record preservation, API failure handling, empty repositories, quota queuing, and resume.
- The unit suite uses mocked GitHub responses. A separate bounded browser run exercised the final sync against GitHub's public API, but did not complete all repositories.
- `npm start` served `/`, `js/main.js`, both GitHub modules, and the CSS with HTTP 200. `package.json` and a traversal probe returned 404 as expected.
- A temporary headless Chromium 152/CDP smoke check used mocked/cache fixture data. The connection panel and sync button rendered; the project detail showed the GitHub description, commit, README link/excerpt, warning, and unchanged manual note. No render error or browser exception was observed. It did not run a live full sync.
- The changed-files-only archive was applied to a temporary clean export of the baseline; the extracted patch passed `npm test` (23/23) and JavaScript syntax checks. ZIP integrity validation passed.
- An earlier browser run on the pre-throttling implementation exhausted the anonymous REST quota during detail reads. In a bounded live run on 2026-11-04, the final implementation discovered 101 public non-fork repositories: 12 received detail reads, five were empty, and 84 were queued with zero sync issues; 22 requests remained, with reset reported at `2026-11-04T09:01:56Z`. The full account sync was not completed.
- The checked-in Python Playwright smoke test was not run in the earlier verification because Python Playwright was unavailable; no browser-test dependency has been added.
- No commit, push, or deployment has been made for this patch.

## NOT verified
- Final full live GitHub sync and its end-to-end browser behavior.
- Real Android devices, Firefox, Safari, and Samsung Internet.
- Physical-device form focus/keyboard behavior and a full accessibility audit.

## Architecture
- Native ES modules, no build. `store.js` takes an injected storage object (localStorage in the browser, an in-memory fake in tests).
- Data model (schema version 1, key `devign-iris:v1`): `projects`, `agents`, `activity`, `tasks`. Every record has `id`, `sample`, `createdAt`, `updatedAt`. Field specs in `js/schema.js` drive forms and validation. Activity records also get `timestamp`.
- GitHub cache has its own `devign-iris:github:v1` localStorage key; API ETags/successful responses and normalized repo snapshots are not stored as credentials. GitHub fields are additive `project.github` properties; schema version and existing project notes stay intact.
- `js/integrations/github.js` is DOM/store independent. It discovers public owner repos through GitHub REST, reads raw public docs, caches detail reads, and throttles detail syncs. `github-cache.js` owns only the separate GitHub cache.
- The owner endpoint is unauthenticated, so the shared public REST quota is limited. A sync pass details at most 12 changed repos, budgets four REST requests per repo (three detail endpoints plus one extra branch page) and keeps an eight-request reserve. Branch lists are capped at two pages; longer listings are flagged incomplete. Remaining repos resume at reset while the tab stays open or on a later open.
- The bounded live snapshot had 101 public non-fork repositories: 96 non-empty and five empty. With at most 12 detail reads per quota window, a full initial sync is expected to span about eight hourly windows total if the list stays unchanged.
- The app stores short excerpts, not full document bodies. It flags explicit default-branch/current-revision discrepancies and declared update dates more than 30 days older than the latest commit. These are indicators, not AI summaries or proof that a document is wrong. Commit activity is not proof of testing or deployment.
- Deleting a project clears `projectId` on records that referenced it (no cascade delete).
- Views are functions `(ctx) => HTMLElement`; `ctx` carries `store`, `navigate`, `rerender`, `loadSample`, `openProject`. The shell re-renders on every store change and restores scroll position and open rows.
- Router: `#/command|projects|agents|activity|tasks`; unknown hash falls back to Command.

## Configuration
No environment variables, secrets, tokens, or backend are required. GitHub access is anonymous and read-only. `PORT` optional for `serve.mjs` (default 8000, host 0.0.0.0).

## Known limitations and defects
1. **Persistence is browser-only.** The brief requires records to survive restarts; this holds per browser/profile only. Clearing site data erases everything. A server-backed store is a later, approval-gated decision.
2. No import of exported JSON. Export exists, restore does not.
3. Command transcript is session-only (not saved).
4. Activity `timestamp` is set at creation and not editable.
5. Eye shows at most 12 projects (caption says so beyond that).
6. GitHub integration only sees public, non-fork repositories owned by `Keyayco`; it cannot access private repositories and does not write to GitHub.
7. Anonymous GitHub REST quota means a large first sync is gradual; GitHub may change its public quota or API behavior.
8. No PWA/service worker or offline GitHub sync; edits use native `window.confirm` dialogs for destructive actions.
9. System fonts only.
