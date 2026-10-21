# Executed validation

Checkpoint: 20 October 2026, Asia/Yerevan.

## Executed locally

- Strict TypeScript compilation passed, including frontend, worker, Node server
  and browser test source.
- ESLint passed with zero warnings. The TanStack virtualizer remains isolated
  from memoized row data; its specific React Compiler advisory is scoped and
  explained at the call site. React Compiler is not enabled.
- Prettier validation passed.
- **46 unit/integration tests passed** across protocol, decision, persistence and
  actual local WebSocket transport tests.
- The production Vite build passed. The worker is emitted as a separate asset.

Meaningful cases include duplicate/late/foreign epoch frames, gaps and snapshot
recovery, corrupt schemas, exact decimal parsing, manual price ownership,
provider/local suspensions, stale/open transports, stale form and reset generation
conflicts, asynchronous double submissions, blocked storage, rejected responses,
raw-byte recovery, retention, watchlists and real WebSocket origin/payload errors.

Early checks caught an out-of-range generated basketball score and a server
readiness race. The catalog now stays within the schema and the server announces
readiness only after the listening event. The complete local suite then passed.

## Prepared but not executed yet

Fourteen Playwright scenarios target Chromium, Firefox and Pixel 7 Chromium:
42 planned browser cases. They cover live/pause/resume behavior, exact persisted
prices/reasons, market lifecycle, invalid inputs, rejected requests, two tabs,
quota failures, unreadable-byte download/reset, watchlists, virtualization/page
navigation, protocol scenarios, journal export, motion/keyboard behavior,
representative axe scans and actual-viewport layout/screenshot checks.

The initial source checkpoint has not yet run browser CI. No browser pass count,
responsive screenshot, accessibility certification or live deployment is claimed.
No unsupported local preview server/browser was started in the managed runtime.

## Release gate

Run the prepared GitHub Actions workflow after source upload. Inspect failed
assertions and screenshots, fix application issues and rerun the affected checks.
After the complete verification job passes, deploy Pages and exercise a live
edit/reload/journal/export flow. Add the verified URL to repository About and
README, retain actual screenshots and replace this pending section with exact
run/commit evidence.

Full accessibility certification, Safari/VoiceOver, physical-device testing,
production trading correctness and external performance benchmarks remain outside
this checkpoint. The WebSocket server was tested locally; the public static build
intentionally uses the worker replay.
