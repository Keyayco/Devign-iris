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

- The read-only GitHub integration has been merged into "main".
- Pull request: "#1 — Add read-only GitHub integration" (https://github.com/Keyayco/Devign-iris/pull/1)
- Feature commit: "8a671b9"
- Merge commit: "4919f9e"
- No deployment has been performed.
- Full live GitHub synchronisation and automatic browser resume remain unverified.
- GitHub data is kept separate in "project.github" and a dedicated localStorage cache key. Schema-v1 project records and manually entered notes are preserved.
- The implementation uses dependency-free vanilla HTML, CSS and JavaScript.
- "npm start" runs the static server.

Important: The GitHub integration is already in "main". Do not reapply the old patch or attempt to recreate PR #1.

Run and verify

1. Start from a fresh checkout of the current GitHub "main" branch.
2. Run "npm test" (Node 18+; no dependencies).
3. Run "npm start"; open "http://localhost:8000".
4. Open Command → Connections to inspect connection state, counts, quota/queue notice and manual sync.
5. Record only verification actually performed in "LOGS.md".

The unauthenticated REST quota is shared. One pass details at most 12 changed repositories, budgeting four REST requests per repository plus an eight-request reserve.

The previous live snapshot discovered 101 public non-fork repositories; 12 had details read, five empty repositories were skipped, 84 were queued, and 22 anonymous REST requests remained. The full sync was not completed.

Recommended next milestone

- Verify the merged integration from a fresh "main" checkout.
- Complete live synchronisation and verify automatic browser resume.
- Review the current UI and identify the next owner-approved improvement.
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
Change GitHub API/cache behavior| "js/integrations/github.js", "js/integrations/github-cache.js", mocked tests
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
- Follow `AGENT_HANDOVER_PROTOCOL.md when transferring work between agents.

Verification status

- GitHub integration merged into "main".
- Original implementation tests passed 23/23.
- Mock-based API checks passed.
- Initial bounded live sync performed on 4 November 2026.
- Full live sync and automatic browser resume remain unverified.
- No deployment performed.

Open decisions for the owner

1. Where should durable records live (Phase 2)? Compare low-cost options before recommending a decision.
2. Should "tests/smoke.py" remain (requires Python Playwright)?
3. Confirm the first real project list. Sample projects are candidates, not confirmed active projects.

Getting files back to GitHub from a phone

Use GitHub's mobile web editor for small documentation changes.

For larger changes, use a fresh checkout and a reviewed commit/PR workflow. Do not push from an outdated Replit workspace without first checking its branch and commit history.