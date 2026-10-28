# HANDOVER: continuing Devign Iris in Replit

Written for an AI coding agent working through Replit on a phone or tablet. Read `RULES.md` and `STATE.md` first. They are short.

## Situation
- Phase 1 (Iris Shell) is built and was tested in a sandbox with Chromium emulation. It has **never been run in Replit**, never been committed to GitHub from this session, and never been opened on a real Android device.
- Nothing needs installing: no npm dependencies, no build step, no API keys.
- The previous Claude conversation is not needed. Everything required is in this repository.

## Get it running (first session, run-and-verify only)
1. Put the project at the Replit project root so `index.html`, `serve.mjs`, `package.json` sit at the top level. Easiest route: create a Node.js Repl, upload `devign-iris.zip`, and in the Shell run `unzip devign-iris.zip` then move the contents up if they landed in a subfolder. (Not verified in Replit; if `unzip` is missing, upload the files individually or import the GitHub repo instead.)
2. Shell: `npm test`. Expect `14/14 passed`.
3. Run command: `npm start` (runs `node serve.mjs`, reads `PORT` if Replit sets it, otherwise 8000, binds 0.0.0.0). Open the Webview/preview. If the preview shows nothing, check the Replit console for the port it expects and set `PORT` accordingly. This step is unverified.
4. In the running app, check on the phone: five nav items work; "Load sample data" shows Sample badges; a command such as `briefing` answers; adding a project works and survives refresh.
5. Record outcomes in `LOGS.md` under today's date: what ran, what failed, exact error text. Do not write "works" for anything not actually run.

Optional browser test (needs Playwright, skip if awkward on mobile): `node serve.mjs &` then `python3 tests/smoke.py http://localhost:8000`. Expect 50/50.

## Recommended first coding task (after the run check passes)
Fix the overdue date bug (STATE.md limitation 2): `todayISO` in `js/selectors.js` uses UTC; make it use the local date, add a unit test in `tests/run-tests.mjs`, run `npm test`. This is small, reversible, and in scope for Phase 1. Do not start Phase 2.

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
- Supply complete replacement files when practical. After each change run `npm test`, update `STATE.md`/`LOGS.md`, and keep the file manifest accurate.

## Acceptance criteria for the next milestone (run check)
- `npm test` passes 14/14 in Replit.
- App loads in the Replit preview with no console errors, and the five views render.
- `LOGS.md` has an entry stating exactly what was run and the result.
- `STATE.md` "NOT verified" list is updated to reflect what was actually checked.

## Open decisions for the owner
1. Where should durable records live (Phase 2)? Options to compare, not decide: Replit-hosted SQLite or JSON file behind a small server, or a free-tier hosted database. Browser-only storage does not satisfy the brief long term.
2. Should the repository keep `tests/smoke.py` (needs Playwright) or move browser tests elsewhere?
3. Confirm the first real project list; the five names in the sample data are brief candidates, not confirmed active projects.

## Getting files back to GitHub from a phone
Not verified on a device. Options, safest first:
1. Use Replit's Git pane to commit and push to the GitHub repo.
2. In GitHub's mobile web UI, "Add file > Create new file" accepts paths with slashes (for example `js/views/tasks.js`) and creates folders. Paste contents per file. Slow but reliable.
3. "Add file > Upload files" works for files in one folder at a time. GitHub does not unzip archives, so extract the ZIP first. Confirm each upload landed before moving on.
