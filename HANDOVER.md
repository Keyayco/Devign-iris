# HANDOVER: continuing Devign Iris in Replit

Written for an AI coding agent working through Replit on a phone or tablet. Read `RULES.md` and `STATE.md` first. They are short.

## Situation
- Phase 1 (Iris Shell) was imported from GitHub `main` at `459c038`.
- Fixed overdue-date comparison to use the local calendar date. Regression tests now cover both sides of UTC midnight, overdue dates, due-today/future/undated dates, and completed tasks.
- On 2026-10-29, `npm test` passed 15/15 with Node 24.22.1. The Replit Vite preview browser suite passed 96/96 checks at phone and tablet viewport sizes, including editing, deletion, project-reference detachment, JSON download/parse, and timezone-sensitive overdue badges.
- The only product-code changes are `js/selectors.js` and `tests/run-tests.mjs`. No dependencies were added; nothing was pushed to GitHub or deployed.
- The browser tests used a temporary Node/CDP harness and headless Chromium 152 against the Replit preview proxy. The checked-in `tests/smoke.py` was not run because Python Playwright is unavailable. Real Android and additional browser-engine checks remain open.
- A later 390x844 touch-emulation check passed eye-segment touch, Enter, and Space activation. The add-project dialog kept its controls reachable in a reduced-height viewport, but focusing the final textarea left part of its bounds below the scroll area in one emulation check. This is not a physical Android/soft-keyboard result.
- The product is still dependency-free vanilla HTML/CSS/JS. Replit uses Vite to serve the existing `index.html`; `npm start` remains the repository's static server.

## Run in this Replit project
1. Start the `artifacts/devign-iris: web` workflow for the preview.
2. From `artifacts/devign-iris`, run `npm test`; the current baseline is 15/15.
3. From `artifacts/devign-iris`, run `npm start` to exercise the standalone static server. It uses `PORT`, or 8000 by default, and binds to `0.0.0.0`.
4. Latest Replit preview flow verification: 96/96 checks passed at 390x844 and 820x1180 using the temporary CDP runner. Its script is not committed.
5. The checked-in `tests/smoke.py` still requires Python Playwright, which is not installed here; no dependency was added. Record only actions actually run in `LOGS.md`.

Optional source browser test (requires Python Playwright): `node serve.mjs &` then `python3 tests/smoke.py http://localhost:8000`. It was not run in this Replit project; the preview suite above was run with separate temporary CDP automation.

## Recommended next milestone
Run a manual check on the target Android phone/tablet for the final textarea and actual on-screen keyboard, along with eye-segment taps. The current checks use Chromium viewport/touch emulation only; the textarea focus measurement needs device confirmation. Keep Phase 2 storage work approval-gated; compare options before implementing it.

## Do not do without explicit approval
- Add a database, backend, auth, framework, bundler, or TypeScript.
- Call any AI model or store an API key anywhere.
- Add GitHub or Replit integrations, shell access, or auto-deploy.
- Start Phase 2 (server-backed memory). That needs a written trade-off comparison of low-cost options first (RULES.md, brief section 5).
- Rewrite files that are not part of the task. Do not change the `devign-iris:v1` storage key or `schema` version without a migration.

## Files to inspect for common tasks
| Task | Files |
|---|---|
| Add or change a record field | `js/schema.js` (FIELDS), the matching `js/views/*.js` detail list, `js/sample-data.js`, tests |
| Add a local command | `js/commands.js`, `tests/run-tests.mjs`, HELP_LINES |
| Change storage | `js/store.js` (storage is injected; keep it testable) |
| Colours, spacing, type | `css/tokens.css` |
| Layout breakpoints | `css/layout.css` (single breakpoint at 768px) |
| Iris eye | `js/iris-eye.js`, `.eye-*` rules in `css/components.css` |

## Conventions the next agent must keep
- Logic modules (`schema`, `store`, `selectors`, `commands`, `sample-data`) must not touch `document` or `window`.
- Record text is rendered through `h()` text nodes. No `innerHTML` with user data.
- Unavailable things are shown as unavailable ("Not connected", "Unknown", "Not verified").
- Supply complete replacement files when practical. After each change run `npm test`, update `STATE.md`, `HANDOVER.md`, and `LOGS.md`, and keep `FILE_MANIFEST.md` accurate.

## Completed milestone verification
- `npm test` passes 15/15 in Replit.
- The Replit preview browser suite passed 96/96 checks with no console errors or uncaught page exceptions.
- The browser suite covers all five views, add/edit/delete, reload persistence, sample-data handling, JSON export, and local-date overdue display.
- `STATE.md` distinguishes browser-emulated checks from the remaining physical-device and cross-browser checks.

## Open decisions for the owner
1. Where should durable records live (Phase 2)? Options to compare, not decide: Replit-hosted SQLite or JSON file behind a small server, or a free-tier hosted database. Browser-only storage does not satisfy the brief long term.
2. Should the repository keep `tests/smoke.py` (needs Playwright) or move browser tests elsewhere?
3. Confirm the first real project list; the five names in the sample data are brief candidates, not confirmed active projects.

## Getting files back to GitHub from a phone
Not verified on a device. Options, safest first:
1. Use Replit's Git pane to commit and push to the GitHub repo.
2. In GitHub's mobile web UI, "Add file > Create new file" accepts paths with slashes (for example `js/views/tasks.js`) and creates folders. Paste contents per file. Slow but reliable.
3. "Add file > Upload files" works for files in one folder at a time. GitHub does not unzip archives, so extract the ZIP first. Confirm each upload landed before moving on.
