# FILE_MANIFEST

This manifest describes the current 33-file source tree based on GitHub `Keyayco/Devign-iris` `main` at `6cfe5d2fcd9031fe7b50fb8570fd76b36d3e58b0`. Paths and byte counts below reflect this local, unpushed patch. The manifest's own byte count is omitted to avoid a self-referential size.

| Path | Bytes |
|---|---:|
| `.gitignore` | 74 |
| `HANDOVER.md` | 5522 |
| `LOGS.md` | 11126 |
| `README.md` | 5517 |
| `RULES.md` | 3105 |
| `STATE.md` | 6782 |
| `css/components.css` | 10910 |
| `css/layout.css` | 2783 |
| `css/tokens.css` | 864 |
| `index.html` | 1474 |
| `js/commands.js` | 7409 |
| `js/dom.js` | 3434 |
| `js/forms.js` | 2963 |
| `js/integrations/github-cache.js` | 3636 |
| `js/integrations/github.js` | 26951 |
| `js/iris-eye.js` | 3934 |
| `js/main.js` | 4382 |
| `js/router.js` | 587 |
| `js/sample-data.js` | 3705 |
| `js/schema.js` | 5787 |
| `js/selectors.js` | 2721 |
| `js/store.js` | 8491 |
| `js/views/actions.js` | 986 |
| `js/views/activity.js` | 2523 |
| `js/views/agents.js` | 1896 |
| `js/views/command.js` | 7276 |
| `js/views/projects.js` | 6153 |
| `js/views/tasks.js` | 2408 |
| `package.json` | 303 |
| `serve.mjs` | 2129 |
| `tests/run-tests.mjs` | 26126 |
| `tests/smoke.py` | 5402 |

Not included in the source tree: caches, `node_modules`, screenshots, credentials (none exist), or build artifacts.

## Patch delta

| Status | Path | Change |
|---|---|---|
| Added | `js/integrations/github.js` | Read-only public GitHub REST discovery, bounded sync, documentation checks, and resume logic. |
| Added | `js/integrations/github-cache.js` | Separate localStorage snapshot and successful-response cache; no credentials. |
| Modified | `js/main.js` | Bootstrap, project upsert, stale refresh, and quota-reset resume. |
| Modified | `js/store.js` | Idempotent GitHub project linking while preserving manually entered fields. |
| Modified | `js/views/command.js` | Connection status, counts, progress, sync button, and quota notice. |
| Modified | `js/views/projects.js` | GitHub metadata, commits, branches, docs, and warnings. |
| Modified | `css/components.css` | GitHub connection/project styles and warning note. |
| Modified | `tests/run-tests.mjs` | Mocked integration, cache, pagination, preservation, errors, and rate-limit tests. |
| Modified | `README.md` | Integration behavior, storage, API limits, and verification boundaries. |
| Modified | `STATE.md` | Current implementation, test results, architecture, and limitations. |
| Modified | `HANDOVER.md` | Runbook and next-step instructions. |
| Modified | `LOGS.md` | Chronological implementation and verification record. |
| Modified | `FILE_MANIFEST.md` | Current file inventory and patch delta. |

Deleted: none. Dependencies added: none. Schema migration: none. GitHub push or deployment: none.

## Verification

- `npm test`: 23/23 passed with Node 24.22.1.
- `node --check` passed for all JavaScript modules; `git diff --check` passed.
- Static-server routes `/`, `/js/main.js`, both GitHub modules, and `/css/components.css` returned HTTP 200. `package.json` and a traversal probe returned 404.
- Temporary headless Chromium 152/CDP smoke checks used mock/cache fixtures for the connection panel, sync control, project details, docs, warnings, and preserved manual note. No render error or browser exception was observed.
- The changed-files-only patch was applied to a clean temporary export of the baseline; the extracted package passed `npm test` (23/23) and module syntax checks. ZIP integrity validation passed.
- A bounded live browser sync discovered 101 public non-fork repos; 12 had details read, five were empty, 84 were queued, zero sync issues were reported, and 22 anonymous requests remained. The full sync is not complete; see `STATE.md` and `LOGS.md`.
- The checked-in Python Playwright smoke test was not run.
