# Executed validation

Verified release: **21 October 2026 (Asia/Yerevan)**.

- Application commit: `b60dd95e65ed81f361e85b96302a67eb5b151c43`.
- [Successful verification and deployment](https://github.com/RafayelKaramyan/ryvqen/actions/runs/39644755085).
- [Live demo](https://rafayelkaramyan.github.io/ryvqen/).

## Executed checks

The release workflow completed a clean Node.js 24 installation, strict TypeScript
compilation, zero-warning ESLint, Prettier validation and a production Vite build.
The checks cover the frontend, worker, Node server and browser test source.

**46 unit/integration tests passed**, including actual loopback WebSocket
snapshot/tick, origin restriction and invalid-command rejection tests. Protocol,
decimal parsing, manual price ownership, provider/local suspension precedence,
stale forms, reset generations, failed storage, rejected requests, double
submissions, corruption recovery, retention and subscription cleanup are covered.

**42 browser cases passed with no skips or retries**: fourteen scenarios each in
Chromium, Firefox and Pixel 7 Chromium. They exercise:

- Moving prices, exact paused frames and reconnection.
- Manual prices, exact reasons and journal values across a complete reload.
- Local suspension, resume and release-to-feed as separate operations.
- Invalid inputs, a rejected request, blocked storage and guarded data recovery.
- Stale forms in two tabs without overwriting the first saved decision.
- Watchlist persistence, virtual rendering and paginated keyboard browsing.
- Actual duplicate, late and gap counters with snapshot recovery.
- Downloaded journal JSON containing the exact saved reason and values.
- Motion preferences, system reduced motion, search focus and the skip link.
- Axe scans of the desk, editor, paginated fixtures and journal.
- Actual viewport widths of 1440px on desktop and 320/390px on mobile,
  all five routes, missing-event/page states and absence of page errors.

The first browser run found eight failures: misleading feedback for independently
opened empty workspaces, a search focus race and unnamed duplicate complementary
landmarks. The final code reports the stale workspace accurately, focuses search
after the route commits and names each landmark. The unit conflict case now uses
distinct tab identifiers. A screenshot review also caught truncated mobile
filter labels; those controls now use two columns and a full-width watchlist.
The complete passing run includes all these changes.

## Visual and live review

Desktop and narrow mobile desk, fixture and signal screenshots were inspected.
The 320px fixture capture shows complete filter labels. Retained examples:

- [Published desktop desk](screenshots/desk-desktop.jpg).
- [Mobile desk at 390px](screenshots/desk-mobile.jpg).
- [Mobile fixtures at 320px](screenshots/fixtures-mobile.jpg).

The deployed Pages build was opened separately. Home was set to `2.71`, Draw to
`3.45` and Away to `4.21`, with the reason “Live release verification: manual
prices survive reload”. After a complete reload the manual values remained and
the journal showed one successful decision with the exact reason and after
values. The export action produced a browser download event. Exact downloaded
JSON contents were independently checked by the three CI browser projects.

The public demo URL is present in repository About and README. Later documentation
and screenshot changes do not change the tested application build.

## Limits

Automated axe checks are representative checks, not full accessibility
certification. Safari/VoiceOver, physical devices and external performance
benchmarks have not been tested. No Core Web Vitals score is claimed.

The public static build uses a browser worker and fictional data. The optional
WebSocket server is tested but is not hosted by Pages. Decisions are local to a
browser, not authenticated remote trading actions or a secure production audit
log. Without Web Locks, cross-tab compare/write remains non-atomic and the
interface discloses that limitation.
