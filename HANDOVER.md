HANDOVER: Devign Iris

Written for AI coding agents working on Devign Iris from a phone or tablet.

Before making changes, read:

- "README.md"
- "RULES.md"
- "STATE.md"
- "LOGS.md"
- "FILE_MANIFEST.md"
- "AGENT_HANDOVER_PROTOCOL.md"

Situation

- Selective GitHub tracking is implemented and committed on local "main", based on revision "57d25e9". The commit is not pushed to GitHub.
- GitHub access remains public, anonymous, browser-only, and read-only. No credential was collected or stored.
- Search runs on demand for public, non-fork repositories owned by "Keyayco"; direct HTTPS repository URLs are checked on demand and may identify any public GitHub repository.
- Users explicitly add results or checked repositories to the persistent tracking allow-list. Search and URL validation never auto-track.
- Any existing cache containing the 101 repositories from the earlier owner-wide discovery loads as cached-only and is not monitored. The repository checkout did not include the user's browser localStorage, so actual cache contents were not inspected.
- The existing GitHub cache key and API response cache are retained; untracked cache data is not reapplied to project records on startup. Untracking does not delete cached data, Iris project records, or manual notes.
- Startup refresh and quota-aware resume work only on tracked repositories. The client does not call the owner-wide repository listing.
- The implementation uses dependency-free vanilla HTML, CSS and JavaScript.
- "npm start" runs the static server.

The secure PAT-entry form was unavailable in the implementation conversation. The repository was inspected through anonymous public access; no push or deployment was attempted.

Run and verify

1. Start from a fresh checkout of the current GitHub "main" branch.
2. Run "npm test" (Node 18+; no dependencies).
3. Run "npm start"; open "http://localhost:8000".
4. Open Command → Connections → GitHub to search, check a public URL, explicitly track repositories, inspect cached-only data, sync, and untrack.
5. Record only verification actually performed in "LOGS.md".

The public API quota is shared. One sync pass details at most 12 changed tracked repositories, budgeting four core REST requests per repository plus an eight-request reserve. Search uses a separate GitHub search quota. The UI shows the returned quota resource, remaining count and reset time when available.

The previous live snapshot found 101 public non-fork repositories; 12 had details read, five empty repositories were skipped, and 84 were queued. Any of those profiles still present in browser localStorage are loaded cached-only; none are tracked as a migration side effect.

Recommended next action

- Obtain repository write access through an available secure GitHub workflow, inspect the remote branch again, and push the already committed local change only after owner authorization.
- Do not deploy without explicit approval.

Do not do without explicit approval

- Add a database, backend, authentication, framework, bundler or TypeScript.
- Call any AI model or store an API key.
- Add another integration, shell access or auto-deploy.
- Start Phase 2 (server-backed memory). That needs a written trade-off comparison of low-cost options first.
- Rewrite files outside the approved task.
- Change the "devign-iris:v1" storage key or schema version without a migration.

Files to inspect for common tasks

Task| Files
Add or change a record field| "js/schema.js", matching "js/views/*.js", "js/sample-data.js", tests
Add a local command| "js/commands.js", "tests/run-tests.mjs", HELP_LINES
Change storage| "js/store.js"
Change GitHub search, URL validation, tracking or sync| "js/integrations/github.js", "js/integrations/github-cache.js", "js/main.js", "js/views/command.js", mocked tests
Colours, spacing, typography| "css/tokens.css"
Layout breakpoints| "css/layout.css"
Iris eye| "js/iris-eye.js", ".eye-*" rules in "css/components.css"

Conventions

- Logic modules must not touch "document" or "window".
- Record text is rendered through "h()" text nodes. Never use "innerHTML" with user data.
- Show unavailable information honestly: "Not connected", "Unknown" or "Not verified".
- Supply complete replacement files when practical.
- After each approved change, run "npm test".
- Update "STATE.md", "HANDOVER.md", "LOGS.md" and "FILE_MANIFEST.md" when relevant.
- Follow `AGENT_HANDOVER_PROTOCOL.md` when transferring work between agents.

Verification status

- Selective tracking implementation committed on local "main"; remote is unchanged.
- "npm test": 30/30 passed with Node 24.22.1.
- Changed JavaScript syntax checks and "git diff --check" passed.
- Browser verification was not performed. The optional "tests/smoke.py" test remains unrun.
- No live GitHub repository search/sync was performed as part of this change.
- No push or deployment was performed.

Milestone handover — 9 November 2026

- Project/repository: Devign Iris, "https://github.com/Keyayco/Devign-iris".
- Branch/base: local "main", based on "57d25e9". The remote branch remains unchanged.
- Objective/scope: replace account-wide discovery with explicit public-repository search/URL verification, persisted allow-list tracking, selective sync, untracking, and preservation of cached records. No backend, framework, dependency, write API, or deployment was added.
- Files modified: "README.md", "STATE.md", "HANDOVER.md", "LOGS.md", "FILE_MANIFEST.md", "css/components.css", "js/integrations/github-cache.js", "js/integrations/github.js", "js/main.js", "js/views/command.js", "js/views/projects.js", and "tests/run-tests.mjs".
- Completed: selective implementation and tests; changes committed locally. Existing cache entries and Iris project records are preserved by the code path; old cache entries start with no tracking selections. The user's browser localStorage was not available to inspect directly.
- Verification: "npm test" passed 30/30 with Node 24.22.1; JavaScript syntax checks and "git diff --check" passed. Browser verification and live API search/sync were not performed.
- Blocker: the secure PAT-entry form was unavailable, so no credential was requested or used and no remote push was attempted.
- Next action: after secure write access is available, compare the remote branch with local "main" and obtain owner authorization before pushing; never deploy without explicit approval.

Open decisions for the owner

1. Where should durable records live (Phase 2)? Compare low-cost options before recommending a decision.
2. Should "tests/smoke.py" remain (requires Python Playwright)?
3. Confirm the first real project list. Sample projects are candidates, not confirmed active projects.

Getting files back to GitHub from a phone

Use GitHub's mobile web editor for small documentation changes.

For larger changes, use a fresh checkout and a reviewed commit/PR workflow. Do not push from an outdated Replit workspace without first checking its branch and commit history.