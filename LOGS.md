# LOGS

Chronological. Entries state what actually happened.

2026-11-08 - GitHub integration merged and documentation aligned

- Merged PR #1, "Add read-only GitHub integration", into "main".
- Feature commit: "8a671b9".
- Merge commit: "4919f9e".
- Updated "STATE.md" to reflect the merged status and remaining verification.
- Updated "HANDOVER.md" to remove obsolete local-patch instructions and establish "main" as the source of truth.
- No deployment performed.
- Full live GitHub synchronisation and automatic browser resume remain unverified.
- Completed documentation alignment: README, RULES, HANDOVER, FILE_MANIFEST and AGENT_HANDOVER_PROTOCOL reviewed and aligned.

## 2026-11-04 - Final review and verification
- Continued from the local working copy after the workspace restarted; confirmed the patch remained uncommitted.
- Reran `npm test`: 23/23 passed with Node 24.22.1. All JavaScript files passed `node --check`, and `git diff --check` passed.
- Rechecked the static server: app, CSS, and both GitHub modules returned HTTP 200; `package.json` and a traversal probe returned HTTP 404.
- Repeated the temporary headless Chromium 152 smoke using local mock/cache fixtures. Command connection controls rendered; Project details showed a GitHub description, recent commit, README link/excerpt, warning, and preserved manual note. No browser exceptions or render errors were observed.
- Ran a bounded live sync through the final app against GitHub's public API. It discovered 101 public non-fork repositories; 12 had details read, five empty repos were recorded without detail calls, 84 were queued, zero sync issues were reported, and 22 requests remained. GitHub reported reset at `2026-11-04T09:01:56Z`. This verified the first live pass, not completion of the full account sync.
- Built the changed-files-only patch package, applied it over a temporary clean export of the baseline commit, and reran `npm test` (23/23) and JavaScript syntax checks successfully. ZIP integrity validation passed.
- The full account sync remains incomplete. No push or deployment was made.

## 2026-11-03 - GitHub read-only integration patch
- Verified the public repository baseline at `6cfe5d2fcd9031fe7b50fb8570fd76b36d3e58b0` and made changes only in a local working copy. The original Replit project was not available to edit through this conversation.
- Added a browser-only public GitHub REST client and separate cache. It discovers public, non-fork owner repositories, reads metadata/branches/recent commits/project docs, upserts them into `project.github`, and preserves manual Iris fields and notes. No token, backend, dependency, GitHub write operation, or schema migration was added.
- Added deterministic documentation warnings for explicit branch/revision mismatches and declared update dates more than 30 days behind the newest commit date. The UI explicitly says commits do not prove testing or deployment.
- The GitHub connector's owner-repository read showed 100 public non-fork repos in the observed account snapshot, including five empty repos. An earlier browser experiment using the first unthrottled implementation exhausted the anonymous GitHub REST quota while reading details.
- Changed the sync to skip empty repos, limit detail work to 12 repositories per pass, reserve eight REST requests, cap branch pagination at two pages, preserve cached data on errors, and queue/resume work at the reported quota reset. The final throttled implementation has not been verified with a full live owner sync.
- Added mocked tests for paginated discovery/branches, document reads and missing files, cache behavior, duplicates, manual-note/name preservation, API errors, empty repositories, quota reserve/queue, and resume. `npm test` passed 23/23 with the final integration code.
- Static HTTP checks returned 200 for `/`, `js/main.js`, both new integration modules, and `css/components.css`; `package.json` and a traversal probe returned 404. All JavaScript modules passed `node --check`, and `git diff --check` passed.
- Temporary headless Chromium 152/CDP smoke with mocked/cache fixtures verified the Command connection panel/sync control and Project GitHub details (description, commit, doc link/excerpt, warning, and preserved manual note). No render error or browser exception was observed. This did not issue a live GitHub sync.
- No commit, push, or deployment was made.

## 2026-10-29 - Replit import and baseline run
- Imported the public GitHub repository `Keyayco/Devign-iris`, branch `main`, at revision `459c038`. Product files remain vanilla HTML, CSS, and JavaScript; the Replit artifact workflow uses Vite to serve the existing `index.html`.
- Added `start` and `test` scripts to the Replit artifact package so the repository's documented commands work from the artifact directory. No product behavior or source modules were changed.
- Ran `npm test`: 14/14 passed with Node 24.22.1.
- Ran `npm start`; `GET /` and `GET /js/main.js` both returned HTTP 200.
- Started the Replit web workflow and captured the initial Command view at 402x874. Browser logs showed Vite connecting and connected; no errors were reported.
- Not done: no interactive navigation/CRUD test, real Android test, GitHub push, or deployment. The source repository remains unchanged.

## 2026-10-29 - Browser flow verification
- Tried to run `python3 tests/smoke.py`, but the environment does not have the Python Playwright package (`ModuleNotFoundError`). No test dependency was installed.
- Used a temporary Node DevTools Protocol harness with the available headless Chromium 152 against `npm start` on port 8000. It passed 20/20 checks across 390x844 and 820x1180 viewports.
- Verified all five routes and empty states; sample-data load/labels/removal; a local command reply and task creation; task completion; add-project validation and save; project persistence after reload; and sample removal preserving the real project. No browser errors or tablet horizontal overflow were observed.
- The first harness attempt stopped on its own incorrect third-row selector; after correcting the harness selector, the full run passed. No application failure or product-code change resulted.
- This checks the standalone server's UI flows, not real-device behavior or the Vite preview's interactive behavior. Edit/delete UI, export download, and physical Android checks remain open.

## 2026-10-29 - Overdue date fix and remaining browser verification
- Before changing code, reran the baseline `npm test` (14/14) and checked the existing UI flows against the Replit preview. The preview checks exercised edit prefill/save for projects, agents, activity, and tasks; delete confirmation cancel/accept for each; project-reference detachment; and an actual JSON download that parsed with the expected records.
- Reproduced the UTC/local-date defect before the fix. In `Africa/Johannesburg`, `2026-10-12T22:30:00Z` is local `2026-10-13`; the old `todayISO` returned `2026-10-12`, so an October 12 task was not yet marked overdue. In `America/Los_Angeles`, `2026-10-13T00:30:00Z` is local `2026-10-12`; the old function returned `2026-10-13`, marking an October 12 task overdue too early.
- Updated `js/selectors.js` to format the local calendar date with local date getters. Added a regression test in `tests/run-tests.mjs` for both timezone boundaries, an overdue date, due-today, future, undated, and completed tasks.
- After the fix, `npm test` passed 15/15 with Node 24.22.1. The web workflow was restarted and came up cleanly.
- Reran the full preview UI check using temporary Node/CDP automation and headless Chromium 152 through the Replit preview proxy. Final result: 96/96 checks passed at 390x844 and 820x1180. The checks included the previous navigation/data flows, all edit/delete/export cases, and overdue-badge behavior with an emulated Johannesburg clock. CDP captured no console errors or uncaught page exceptions.
- The first preview harness attempts exposed harness-only timing/expectation issues; these were corrected before the passing run. The final result above uses the corrected reload wait, confirmation-message expectations, and CDP error-event listeners. The temporary harness was not added to the project.
- `tests/smoke.py` remains unrun because Python Playwright is unavailable. No dependencies were installed. No GitHub push or deployment was made.

## 2026-10-29 - Mobile touch and form-focus emulation
- In an isolated headless Chromium 152 session at 390x844, dispatched CDP touch events on a project segment. The app navigated to Projects and expanded the selected row. Enter and Space keyboard activation on the focused segment also passed.
- The add-project dialog opened with its first field focused. It fit the 390x844 viewport, had a vertically scrollable form body, and Tab stayed within the dialog. At an emulated 520px viewport height, the dialog and Save button remained visible; saving succeeded.
- One focus geometry check did not pass: when the final textarea was focused at 390x844, its bounds extended below the form body's visible region (textarea bottom y=813; body bottom y=764). The emulated viewport could scroll only part of that gap. This is a potential mobile form-focus clipping issue, not a confirmed physical-device result.
- No source code changed in this check. The actual Android soft keyboard and target devices remain untested; this mobile browser harness was temporary and was not added to the repository.

## 2026-10-28 - Phase 1 Iris Shell (Claude, chat session)
- Inspected environment: `/mnt/user-data/uploads` empty, `/mnt/user-data/outputs` empty, no existing project. Started from scratch. No GitHub repository or revision was available to check against, so no base revision is recorded.
- Tooling present: Node 22.22.2, npm 10.9.7, Python 3.12.3, Playwright with Chromium 141. Network for the sandbox was disabled, so no web fonts or CDN assets were used (system font stacks).
- Requirement conflicts and resolutions:
  - Brief 3.2 wants records to survive restarts; Phase 1 scope says smallest practical persistence. Resolved with localStorage plus injected-storage design. Documented as limitation 1.
  - Brief 14 asks for GitHub-uploadable files; GitHub's web uploader does not unzip. Documented workarounds in HANDOVER.md, unverified.
  - Brief asks to avoid decorative dashboard cards; rows with native details/summary used instead.
- **Incident:** mid-session the sandbox filesystem was reset and the first copy of the project was lost (it had not yet been copied to outputs). All files were re-created from the conversation. A snapshot was then copied to `/mnt/user-data/outputs/devign-iris-wip/`. No other effect on the code is known; everything described in STATE.md was tested on the re-created files.
- Built: shell, five views, Iris eye, local commands, forms, sample data, store, tests, static server, docs.
- Decisions: hash routing (no server rewrites needed); native `<details>` rows (accessible, no JS); native `<dialog>` for forms; evidence defaults to "Reported" for new activity so nothing is "Verified" by default; sample actor name made generic.
- Tests run: unit 14/14; browser smoke 50/50 (phone and tablet viewports); server route checks (private files 404); `npm test` and `npm start` ran.
- Bugs found and fixed during testing: a test race after hash navigation (test bug, fixed by waiting for render); `.btn` text wrapped on narrow screens (fixed with `white-space: nowrap`).
- Not done: Replit run, GitHub commit, real-device check, Export JSON test.
- Final ZIP contents and a re-run of tests against the extracted ZIP were performed after packaging; that result is reported in the session report because a ZIP cannot contain its own verification.
