# LOGS

Chronological. Entries state what actually happened.

## 2026-10-28 - Phase 1 Iris Shell (Claude, chat session)
- Inspected environment: `/mnt/user-data/uploads` empty, `/mnt/user-data/outputs` empty, no existing project. Started from scratch. No GitHub repository or revision was available to check against, so no base revision is recorded.
- Tooling present: Node 22.22.2, npm 10.9.7, Python 3.12.3, Playwright with Chromium 141. Network for the sandbox was disabled, so no web fonts or CDN assets were used (system font stacks).
- Requirement conflicts and resolutions:
  - Brief 3.2 wants records to survive restarts; Phase 1 scope says smallest practical persistence. Resolved with localStorage plus injected-storage design. Documented as limitation 1.
  - Brief 14 asks for GitHub-uploadable files; GitHub's web uploader does not unzip. Documented workarounds in HANDOVER.md, unverified.
  - Brief asks to avoid decorative dashboard cards; rows with native details/summary used instead.
- **Incident:** mid-session the sandbox filesystem was reset and the first copy of the project was lost (it had not yet been copied to outputs). All files were re-created from the conversation. A snapshot was then copied to `/mnt/user-data/outputs/devign-iris-wip/`. No other effect on the code is known; everything described in STATE.md was tested on the re-created files.
- Built: shell, five views, Iris eye, local commands, forms, sample data, store, tests, static server, docs.
- Decisions: hash routing (no server rewrites needed); native `<details>` rows (accessible, no JS); native `<dialog>` for forms; evidence defaults to "Reported" for new activity so nothing is "Verified" by default; sample actor name made generic.
- Tests run: unit 14/14; browser smoke 50/50 (phone and tablet viewports); server route checks (private files 404); `npm test` and `npm start` ran.
- Bugs found and fixed during testing: a test race after hash navigation (test bug, fixed by waiting for render); `.btn` text wrapped on narrow screens (fixed with `white-space: nowrap`).
- Not done: Replit run, GitHub commit, real-device check, Export JSON test.
- Final ZIP contents and a re-run of tests against the extracted ZIP were performed after packaging; that result is reported in the session report because a ZIP cannot contain its own verification.
