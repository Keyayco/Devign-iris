# HANDOVER: continuing Devign Iris in Replit

Written for an AI coding agent working through Replit on a phone or tablet. Read `RULES.md` and `STATE.md` first. They are short.

## Situation
- This patch starts from GitHub `main` baseline `6cfe5d2fcd9031fe7b50fb8570fd76b36d3e58b0`. It adds a public, read-only GitHub sync at the owner's explicit request; changes are local and have not been pushed or deployed.
- GitHub data is kept separate in `project.github` and a dedicated localStorage cache key. The schema-v1 project records and manually entered notes are preserved.
- Current source tests: `npm test` passes 23/23, including discovery/branch pagination, docs and missing files, duplicate prevention, manual-note preservation, API failures, empty repos, and quota pause/resume.
- A bounded live browser sync of the final implementation on 2026-11-04 discovered 101 public non-fork repos; 12 had details read, five empty repos were skipped, 84 were queued, zero sync issues were reported, and 22 anonymous REST requests remained. The full sync was not completed; unit tests cover queuing and post-reset resume.
- Earlier mobile-preview observations and physical-device/browser-engine limits remain in `STATE.md` and the older `LOGS.md` entries.
- The product is dependency-free vanilla HTML/CSS/JS. `npm start` runs the repository's static server.

## Run and verify
1. Run `npm test` (Node 18+; no dependencies).
2. Run `npm start`; open `http://localhost:8000`. The static server serves `index.html`, `css/`, and `js/`.
3. Open Command → Connections to see connection state, counts, quota/queue notice, and manual sync. First open starts discovery when there is no fresh completed cache.
4. Keep the app open for automatic resume after the public GitHub API quota resets. A later open also resumes queued work. No token is needed or accepted.
5. Record only verification actually performed in `LOGS.md`. The checked-in `tests/smoke.py` requires Python Playwright; verify availability before claiming it ran.

The unauthenticated REST quota is shared. One pass details at most 12 changed repositories, budgeting four REST requests per repo plus an eight-request reserve. The live snapshot had 96 non-empty and five empty repos, so a full first sync is expected to take about eight hourly quota windows total if the list is unchanged.

## Recommended next milestone
Review the local patch package and test report. If approved, apply it to the intended project, repeat `npm test`, and perform a live sync after the public quota is available. Do not push or deploy without a separate explicit request.

## Do not do without explicit approval
- Add a database, backend, auth, framework, bundler, or TypeScript.
- Call any AI model or store an API key anywhere.
- Add another integration, shell access, or auto-deploy.
- Start Phase 2 (server-backed memory). That needs a written trade-off comparison of low-cost options first (RULES.md, brief section 5).
- Rewrite files that are not part of the task. Do not change the `devign-iris:v1` storage key or `schema` version without a migration.

## Files to inspect for common tasks
| Task | Files |
|---|---|
| Add or change a record field | `js/schema.js` (FIELDS), the matching `js/views/*.js` detail list, `js/sample-data.js`, tests |
| Add a local command | `js/commands.js`, `tests/run-tests.mjs`, HELP_LINES |
| Change storage | `js/store.js` (storage is injected; keep it testable) |
| Change GitHub API/cache behavior | `js/integrations/github.js`, `js/integrations/github-cache.js`, mocked tests |
| Colours, spacing, type | `css/tokens.css` |
| Layout breakpoints | `css/layout.css` (single breakpoint at 768px) |
| Iris eye | `js/iris-eye.js`, `.eye-*` rules in `css/components.css` |

## Conventions the next agent must keep
- Logic modules (`schema`, `store`, `selectors`, `commands`, `sample-data`) must not touch `document` or `window`.
- Record text is rendered through `h()` text nodes. No `innerHTML` with user data.
- Unavailable things are shown as unavailable ("Not connected", "Unknown", "Not verified").
- Supply complete replacement files when practical. After each change run `npm test`, update `STATE.md`, `HANDOVER.md`, and `LOGS.md`, and keep `FILE_MANIFEST.md` accurate.

## Completed milestone verification
- `npm test` passes 23/23 for the current source tree.
- No full live sync, push, or deployment has been completed for this patch.
- `STATE.md` distinguishes mock-based GitHub checks from unverified live GitHub and browser flows.

## Open decisions for the owner
1. Where should durable records live (Phase 2)? Options to compare, not decide: Replit-hosted SQLite or JSON file behind a small server, or a free-tier hosted database. Browser-only storage does not satisfy the brief long term.
2. Should the repository keep `tests/smoke.py` (needs Playwright) or move browser tests elsewhere?
3. Confirm the first real project list; the five names in the sample data are brief candidates, not confirmed active projects.

## Getting files back to GitHub from a phone
Not verified on a device. Options, safest first:
1. Use Replit's Git pane to commit and push to the GitHub repo.
2. In GitHub's mobile web UI, "Add file > Create new file" accepts paths with slashes (for example `js/views/tasks.js`) and creates folders. Paste contents per file. Slow but reliable.
3. "Add file > Upload files" works for files in one folder at a time. GitHub does not unzip archives, so extract the ZIP first. Confirm each upload landed before moving on.
