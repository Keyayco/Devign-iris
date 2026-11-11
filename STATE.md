Selective GitHub tracking status — 9 November 2026

Status: Implemented on local "main" from base revision "57d25e9". The local change is committed; it has not been pushed to GitHub or deployed.

- GitHub access stays browser-only, anonymous, public, and read-only. No PAT or other credential was collected or stored.
- Name search is user-initiated and scoped to public, non-fork repositories owned by "Keyayco". A direct pasted URL is checked on demand and can add any public GitHub repository after explicit confirmation.
- Search results and URL checks never add tracking automatically. The tracking allow-list is persisted in the existing GitHub cache.
- Any existing cache containing the 101 repositories from the previous account-wide discovery loads as cached-only data; none are tracked unless explicitly selected. This checkout did not include the user's browser localStorage, so the actual cache contents were not inspected.
- Startup sync and quota resume operate only on explicitly tracked repositories. No account-wide repository listing is performed.
- Command → Connections → GitHub shows tracked and cached-only entries, per-repository sync state and last sync, manual sync/untracking, and API quota headers when available.
- Untracking preserves cached repository data and existing Iris project records. Only tracked data is hydrated into project records; untracked cached data is not reapplied at startup.
- Verification: "npm test" passed 30/30 with Node 24.22.1. Changed JavaScript passed "node --check"; "git diff --check" passed. Browser verification was not performed. No deployment was performed.

Remaining limitations:

- Repository names search only returns the first 100 GitHub search matches; refine broad searches to discover later matches.
- Tracking and GitHub cache persistence are local to this browser's localStorage; there is no cross-device sync.
- The current conversation did not expose the secure PAT-entry form. Repository inspection used anonymous public access; no remote push was attempted.