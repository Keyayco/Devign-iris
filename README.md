# Devign Iris

Personal AI operating system and command centre for Devign Digital.
**Phase 1: Iris Shell.** A mobile-first interface for recording projects, AI agents, implementation activity, and tasks, with a local command box that answers from those records.

Built with vanilla HTML, CSS, and JavaScript (native ES modules). No frameworks, no build step, no npm dependencies, no API keys.

## Current boundaries

- No AI model is connected. The command box matches a fixed set of local commands.
- GitHub sync is read-only and limited to public, non-fork repositories owned by `Keyayco`. It uses GitHub's anonymous public API; no credential or token is requested or stored.
- No Replit or agent-session integration.
- No server database. Records live in the browser's localStorage (this device and browser only).
- No login.

## Run it

Native modules do not load from `file://`, so serve over HTTP.

```
npm start            # node serve.mjs, http://localhost:8000 (set PORT to change)
npm test             # unit tests, Node 18+ (no dependencies)
```

Without npm: `node serve.mjs`, or `python3 -m http.server 8000` from this folder.

Optional browser test (needs Playwright and Chromium, not required to run the app):

```
node serve.mjs &
python3 tests/smoke.py http://localhost:8000
```

Environment variables: none required. `PORT` is optional for `serve.mjs`.

## GitHub read-only sync

The Command view's Connections panel can sync the public repositories owned by `Keyayco`. On first open and when the last complete sync is at least six hours old, Iris starts a sync automatically; the button also starts one on demand.

The client discovers the owner's repositories through GitHub REST, filters out private and forked repositories, follows pagination, and reads repository metadata, up to 200 branches, five recent commits, and up to ten small Markdown/text project documents (README, state/handover/log/manifest files, and other likely project docs). Document text is fetched from GitHub's public raw-content host. Empty repositories are recorded without detail requests; missing documents are skipped. Successful API responses and normalized repository data are cached in this browser's localStorage, separately from the Iris project records.

**Anonymous API quota affects first sync.** GitHub's unauthenticated REST limit is shared by the browser's public requests. To stay below it, one sync pass fetches details for at most 12 changed repositories and retains a small request reserve; remaining repositories are shown as queued. Iris waits for the reset, resumes while the tab remains open, and also resumes on a later open. For a large account, first sync can span multiple hourly quota windows. API failures preserve the last successful repository data and are surfaced in Connections and the affected project.

GitHub values are stored in the additive `project.github` field. Existing Iris notes, project state, and other manually entered fields are not overwritten. A unique exact-name manual project can be linked; ambiguous name matches are flagged, while repository identity prevents repeat syncs from creating duplicates. A repository that disappears from the public owner listing is retained and marked rather than deleted.

Iris reads documents to show short excerpts and flag explicit default-branch or current-revision conflicts, plus a declared update date more than 30 days behind the latest commit date. These are deterministic indicators, not AI summaries or proof that a document is wrong. Commit activity is never treated as evidence that tests passed or a deployment happened.

## Layout

```
index.html              App shell and boot guard
serve.mjs               Dependency-free static server (serves index.html, css/, js/ only)
css/                    tokens.css, layout.css, components.css
js/main.js              Bootstrap, shell rendering
js/router.js            Hash router (#/projects)
js/store.js             State + localStorage persistence (storage injected)
js/schema.js            Field specs, enums, validation
js/selectors.js         Derived facts from records
js/commands.js          Local command interpreter (pure)
js/integrations/github.js         Public GitHub REST client and sync orchestration
js/integrations/github-cache.js   Separate browser cache for GitHub data
js/sample-data.js       Labelled demonstration records
js/dom.js, forms.js     DOM helpers, add/edit dialog
js/iris-eye.js          Central visualisation
js/views/               command, projects, agents, activity, tasks, shared actions
tests/run-tests.mjs     Dependency-free unit and integration-client tests
tests/smoke.py          Browser smoke test (50 checks, optional)
```

## Local commands

`help`, `briefing`, `which projects need attention`, `what did we implement last`, `what is blocking <project>`, `list projects|agents|tasks|activity`, `open projects|agents|activity|tasks`, `add task <title>`, `handover`.

## Sample data

"Load sample data" (Command view, Data section) adds clearly marked demonstration records. Every sample record shows a Sample badge, the top bar says "Sample data", and command replies tag them `[sample]`. "Remove sample data" deletes only those and keeps your own records.

## Documentation

- "RULES.md" — persistent development rules and owner approval requirements
- "STATE.md" — current implementation, verification status and known limitations
- "HANDOVER.md" — current project handover and next steps
- "LOGS.md" — chronological record of completed work and verification
- "FILE_MANIFEST.md" — tracked source-file inventory
- "AGENT_HANDOVER_PROTOCOL.md" — reusable protocol for transferring work between AI agents

All coding agents must read the project documentation before making changes and follow "AGENT_HANDOVER_PROTOCOL.md" when handing work to another agent.