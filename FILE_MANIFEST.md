# FILE_MANIFEST

Upstream source manifest: GitHub `Keyayco/Devign-iris`, `main` at revision `459c038`.
Table paths and byte sizes describe that upstream snapshot, not the Replit workspace copy. The application files were imported; the Replit artifact keeps its pnpm/Vite `package.json` with the upstream `start` and `test` commands added. This milestone's workspace changes and test results are listed below. No changes were pushed to GitHub.

| Path | Bytes |
|---|---|
| `.gitignore` | 74 |
| `HANDOVER.md` | 5005 |
| `LOGS.md` | 2341 |
| `README.md` | 2972 |
| `RULES.md` | 3105 |
| `STATE.md` | 4259 |
| `css/components.css` | 9106 |
| `css/layout.css` | 2783 |
| `css/tokens.css` | 864 |
| `index.html` | 1474 |
| `js/commands.js` | 7409 |
| `js/dom.js` | 3434 |
| `js/forms.js` | 2963 |
| `js/iris-eye.js` | 3934 |
| `js/main.js` | 2768 |
| `js/router.js` | 587 |
| `js/sample-data.js` | 3705 |
| `js/schema.js` | 5787 |
| `js/selectors.js` | 2486 |
| `js/store.js` | 5319 |
| `js/views/actions.js` | 986 |
| `js/views/activity.js` | 2523 |
| `js/views/agents.js` | 1896 |
| `js/views/command.js` | 4253 |
| `js/views/projects.js` | 2263 |
| `js/views/tasks.js` | 2408 |
| `package.json` | 303 |
| `serve.mjs` | 2129 |
| `tests/run-tests.mjs` | 7277 |
| `tests/smoke.py` | 5402 |

30 files, plus this manifest.

Not included on purpose: caches, node_modules, screenshots, credentials (none exist), build artefacts.

## Current Replit workspace delta

| Status | Path | Change |
|---|---|---|
| Modified | `js/selectors.js` | Compare due dates to the local calendar date instead of the UTC date. |
| Modified | `tests/run-tests.mjs` | Add timezone-boundary and non-overdue regression cases. |
| Modified | `STATE.md` | Record current behavior, tests, and remaining unverified items. |
| Modified | `HANDOVER.md` | Update current run instructions and next milestone recommendation. |
| Modified | `LOGS.md` | Record reproduction, implementation, and actual verification performed. |
| Modified | `FILE_MANIFEST.md` | Record this workspace delta and test results. |

Added: none. Deleted: none. Dependencies added: none. No deployment or GitHub push.

Verification: `npm test` passed 15/15. A temporary Node/CDP harness against the Replit preview passed 96/96 checks in headless Chromium 152 at phone/tablet viewport sizes, including the timezone-sensitive overdue UI, edit/delete flows, and JSON export. A later mobile touch/focus emulation passed eye-segment touch and keyboard activation, but one final-textarea visibility assertion did not pass; see `LOGS.md`. The checked-in Python Playwright smoke test was not run because Playwright is unavailable in this environment.
