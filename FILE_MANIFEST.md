FILE_MANIFEST

This manifest describes the tracked source tree for Devign Iris on GitHub "main".

The read-only GitHub integration is merged. The inventory below reflects the current project structure, including the documentation file being added in this alignment pass.

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
"js/integrations/github.js"| Read-only public GitHub API integration
"js/integrations/github-cache.js"| Separate GitHub localStorage cache
"js/views/actions.js"| Shared view actions
"js/views/activity.js"| Activity view
"js/views/agents.js"| Agents view
"js/views/command.js"| Command and connection view
"js/views/projects.js"| Projects view
"js/views/tasks.js"| Tasks view
"tests/run-tests.mjs"| Automated test suite
"tests/smoke.py"| Python Playwright smoke test

Total: 34 tracked files once "AGENT_HANDOVER_PROTOCOL.md" has been added.

GitHub integration status

- Pull request: "#1 — Add read-only GitHub integration" (https://github.com/Keyayco/Devign-iris/pull/1)
- Feature commit: "8a671b9"
- Merge commit: "4919f9e"
- Status: merged into "main"
- Deployment: not performed

The integration discovers public, non-fork repositories owned by the configured GitHub account, retrieves project information and documentation, and caches results locally.

It is browser-only and read-only. It does not use a GitHub token, backend, database, or additional dependencies.

Verification boundaries

- Original implementation test run: "npm test", 23/23 passed.
- JavaScript syntax checks passed.
- Static server and mocked browser checks passed.
- Initial bounded live GitHub sync completed.
- Full live synchronisation and automatic browser resume remain unverified.
- "tests/smoke.py" was not run because Python Playwright was unavailable.
- No deployment has been performed.

See "STATE.md", "HANDOVER.md" and "LOGS.md" for the detailed current state, operating instructions and historical verification record.

Maintenance rules

- Update this manifest when tracked files are added, removed or renamed.
- Keep the inventory aligned with the actual GitHub "main" branch.
- Do not report local or proposed files as committed.
- Do not claim tests, pushes or deployments unless they were actually verified.
- Do not remove historical records merely because the project has moved forward.