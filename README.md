# Devign Iris

Personal AI operating system and command centre for Devign Digital.
**Phase 1: Iris Shell.** A mobile-first interface for recording projects, AI agents, implementation activity, and tasks, with a local command box that answers from those records.

Built with vanilla HTML, CSS, and JavaScript (native ES modules). No frameworks, no build step, no npm dependencies, no API keys.

## What it is not (yet)

- No AI model is connected. The command box matches a fixed set of local commands.
- No GitHub, Replit, or agent-session integration. The Connections panel says "Not connected" and means it.
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
js/sample-data.js       Labelled demonstration records
js/dom.js, forms.js     DOM helpers, add/edit dialog
js/iris-eye.js          Central visualisation
js/views/               command, projects, agents, activity, tasks, shared actions
tests/run-tests.mjs     Unit tests (14)
tests/smoke.py          Browser smoke test (50 checks, optional)
```

## Local commands

`help`, `briefing`, `which projects need attention`, `what did we implement last`, `what is blocking <project>`, `list projects|agents|tasks|activity`, `open projects|agents|activity|tasks`, `add task <title>`, `handover`.

## Sample data

"Load sample data" (Command view, Data section) adds clearly marked demonstration records. Every sample record shows a Sample badge, the top bar says "Sample data", and command replies tag them `[sample]`. "Remove sample data" deletes only those and keeps your own records.

## Documentation

- `RULES.md` persistent rules and approval requirements
- `STATE.md` what exists, what was verified, known defects
- `HANDOVER.md` how to continue in Replit with an AI agent
- `LOGS.md` chronological record
- `FILE_MANIFEST.md` every file in this package
