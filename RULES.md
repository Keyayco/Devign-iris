# RULES

Source of truth: the Devign Iris Master Project Brief. These rules are persistent; they apply to every AI and human working on this repository.

## Product honesty
- Never present simulated AI replies, invented activity, or placeholder metrics as live information.
- Sample data must always be flagged (`sample: true`) and labelled in the UI.
- Do not claim Iris can inspect GitHub, read Replit deployments, monitor agents, or call a model until that integration exists and has been tested.
- Do not mark anything complete, tested, committed, or deployed without evidence. Use "Unknown" or "Not verified" when evidence is absent.
- Evidence levels: Planned, Reported, Tested, Verified, Deployed, Failed. An AI's narrative alone is never Tested or Verified.

## Scope and approval
- Work one milestone at a time. Implement only the approved scope; do not build a later roadmap phase because the architecture allows it.
- Ask before: significant architecture changes, adding a framework or build tool, adding a backend/database/auth, destructive operations, deleting or renaming files, anything touching production.
- Where a requirement is ambiguous but low-impact, choose a reversible default and document it in `LOGS.md`.
- Do not delete, overwrite, or restructure unrelated working code.

## Architecture
- Vanilla HTML, CSS, JavaScript with native ES modules. No frameworks or build tools without approval.
- Separation: presentation (`js/views`, `js/dom.js`, `css/`), logic (`commands.js`, `selectors.js`, `schema.js`), persistence (`store.js`), integrations (future adapters).
- Logic modules stay DOM-free so they remain testable in Node.
- Model-agnostic: any AI provider sits behind an adapter boundary; core logic never imports a provider.
- Integrations are explicit boundaries; unavailable ones are shown as "Not connected".
- Keep modules reasonably sized: no monolith, no micro-files.

## Security
- API keys and credentials never go in frontend code, records, logs, or the repository. Server-side only.
- No unrestricted shell access, automatic production deploys, or broad repository permissions.
- Least privilege for every integration; confirm destructive or externally consequential actions; keep an audit trail for consequential operations.
- All user-entered text is rendered with text nodes (see `js/dom.js`). Do not introduce `innerHTML` with record data.

## Cost
- Phone/tablet workflow only; no mandatory desktop tooling. Prefer free tiers. Minimise API calls and dependencies.

## Delivery (GitHub web on Android)
- After each milestone deliver: changed files, a file manifest (added/modified/deleted), summary, module dependencies, verification actually performed, exact upload paths.
- Label every package PATCH PACKAGE or COMPLETE PROJECT PACKAGE. Never ship a changed-files-only ZIP as if runnable.
- Patch packages include `UPDATE_MANIFEST.md` (id, base revision if known, added/modified/deleted, install paths, tests, rollback, limitations). Never invent a commit hash.
- Update `STATE.md`, `HANDOVER.md`, `LOGS.md` before declaring a milestone ready to transfer.
