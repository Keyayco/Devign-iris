# Devign Iris

Personal AI operating system and command centre for Devign Digital.
**Phase 1: Iris Shell.** A mobile-first interface for recording projects, AI agents, implementation activity, and tasks, with a local command box that answers from those records.

Built with vanilla HTML, CSS, and JavaScript (native ES modules). No frameworks, no build step, no npm dependencies, no API keys.

## Current boundaries

- No AI model is connected. The command box matches a fixed set of local commands.
- GitHub access is read-only and uses GitHub's public API. Name search covers public, non-fork repositories owned by `Keyayco`; a pasted URL can verify any public GitHub repository. No credential or token is requested or stored.
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

Command → Connections → GitHub monitors only repositories explicitly added to tracking. Iris never lists or scans the account's full repository set on startup. Search runs only when submitted and returns up to 100 matching public, non-fork repositories owned by `Keyayco`; refine broad searches to see other matches. A pasted repository URL is looked up on demand and must resolve to a public GitHub repository. Search results and checked URLs are not tracked until the user chooses **Track repository**.

The selected repositories are saved in the existing GitHub cache key alongside the normalized repository data and API response cache. Any existing account-wide snapshot (including the earlier 101 previously discovered repositories) is preserved as cached-only data; it is not treated as tracked. Cached-only entries remain visible in a collapsed list and can be explicitly added to tracking. Untracking removes only the tracking choice; it does not delete cached repository data or Iris project records.

Selecting a tracked repository and pressing **Sync tracked** reads its metadata, up to 200 branches, five recent commits, and up to ten small Markdown/text project documents. Empty repositories need no detail requests; missing documents are skipped. Sync runs on demand, refreshes stale tracked data on a later open, and resumes queued tracked work after quota reset while the tab remains open or on a later open. Each pass details at most 12 changed tracked repositories and keeps a small core API request reserve. Search uses GitHub's separate search quota; the UI shows the latest API quota resource, remaining requests, and reset time when GitHub returns those headers. API failures preserve the last successful repository data and are surfaced in Connections and the affected project.

Only tracked repositories are applied to the additive `project.github` field during startup hydration or sync. Existing Iris notes, project state, and other manually entered fields are not overwritten. A unique exact-name manual project can be linked; ambiguous name matches are flagged, while repository identity prevents repeat syncs from creating duplicates. Project details label GitHub information as tracked or cached-only.

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
js/integrations/github.js         Public GitHub search, URL lookup, tracking and selective sync
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