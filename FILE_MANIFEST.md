FILE_MANIFEST

This manifest describes the tracked source tree for Devign Iris. Selective tracking is committed on local "main"; the remote branch has not been updated.

No files were added or removed for the selective tracking milestone.

Source tree

Path| Purpose
".gitignore"| Git exclusions
"README.md"| Project overview and usage
"RULES.md"| Development and agent rules
"STATE.md"| Current project state
"HANDOVER.md"| Current task handover
"LOGS.md"| Chronological project history
"FILE_MANIFEST.md"| File inventory
"AGENT_HANDOVER_PROTOCOL.md"| Reusable agent-to-agent handover protocol
"index.html"| Application entry point
"package.json"| Project scripts and metadata
"serve.mjs"| Static development server
"css/tokens.css"| Design tokens
"css/layout.css"| Layout and responsive rules
"css/components.css"| Component styling
"js/main.js"| Application bootstrap
"js/dom.js"| DOM helpers
"js/router.js"| Hash-based routing
"js/schema.js"| Record schema and validation
"js/store.js"| Local persistence and data operations
"js/selectors.js"| Derived data and selectors
"js/forms.js"| Form handling
"js/commands.js"| Local command system
"js/sample-data.js"| Sample records
"js/iris-eye.js"| Iris eye component
"js/integrations/github.js"| Public GitHub search, URL verification, tracking and selective sync
"js/integrations/github-cache.js"| Separate GitHub localStorage cache
"js/views/actions.js"| Shared view actions
"js/views/activity.js"| Activity view
"js/views/agents.js"| Agents view
"js/views/command.js"| Command and connection view
"js/views/projects.js"| Projects view
"js/views/tasks.js"| Tasks view
"tests/run-tests.mjs"| Automated test suite
"tests/smoke.py"| Python Playwright smoke test

Total: 34 tracked files.

GitHub integration status

- Selective repository tracking is committed to the local "main" branch from base revision "57d25e9"; it is not pushed.
- Search is on demand and limited to public non-fork repositories owned by "Keyayco". Pasted direct HTTPS repository URLs are checked on demand and may target any public repository.
- Search results and checked URLs need explicit tracking. Startup refresh and resume operate only on tracked repositories.
- Any old cache containing the previous 101 discovered repository profiles loads as cached-only; tracking defaults to empty. The user's browser localStorage was not available to inspect in this checkout.
- Untracking preserves GitHub cache entries and Iris project records. Only tracked repository profiles update project records.
- No credential was collected or stored; no push or deployment was performed.

The integration retrieves selected repository metadata and documents using anonymous public GitHub REST requests and caches results in browser localStorage.

It is browser-only and read-only. It does not use a GitHub token, backend, database, framework, or additional dependencies.

Verification boundaries

- Updated full test suite: "npm test", 30/30 passed with Node 24.22.1.
- Changed JavaScript syntax checks and "git diff --check" passed.
- Optional "tests/smoke.py" was not run because Python Playwright is unavailable; browser verification was not performed.
- No live repository search or selective sync was performed as part of this change.
- No push or deployment has been performed.

See "STATE.md", "HANDOVER.md" and "LOGS.md" for the detailed current state, operating instructions and historical verification record.

Maintenance rules

- Update this manifest when tracked files are added, removed or renamed.
- Keep the inventory aligned with the source tree; local-only changes must be labelled until pushed.
- Do not report local or proposed files as committed.
- Do not claim tests, pushes or deployments unless they were actually verified.
- Do not remove historical records merely because the project has moved forward.