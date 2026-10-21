# Code walkthrough

## A short demonstration

1. Open Northbridge / AC Valora at the live desk. Show changing feed prices and
   the authored SVG tracker. Save the fixture to the watchlist.
2. Set Home to `2.71`, add a reason and apply. The feed keeps moving while manual
   prices stay fixed. Reload and show the same manual value.
3. Pause and resume Match result. Return its prices to the feed. Open the journal
   to inspect the exact before/after values and download the record.
4. Open Signal. Inject a duplicate, an old frame and a gap. Explain why the gap
   requires a snapshot while a duplicate can be safely discarded.
5. Open the same market in two tabs before saving. Apply one, then submit the
   older form. The stale revision must fail instead of overwriting the first.

Clearly describe the fictional data and browser-local decisions during the demo.

## Read the code in this order

Start with `model.ts`: `messageSchema`, `ingest`, `effectiveMarket`, `parsePrice`
and `applyMutation`. Explain the invariant each function protects before reading
its implementation.

Then open `store.ts`: `transaction` is the durable boundary. Find where storage
is reread, the lock is applied, and success is announced. Trace a quota failure
and a generation conflict. Open the related tests and predict their results.

Next compare `feed.worker.ts` with `server/feed.ts`. The public demo has a worker
replay; the local server proves the same protocol travels over an actual socket.
`websocket.test.ts` runs a real server and checks its snapshot/tick and rejection
behavior. No external service is required.

Finally review `MarketDialog.tsx`, `FixturesList.tsx` and `Visuals.tsx`. Follow
the captured form revision, immutable row data, windowed rendering, the native
dialog and the authored football/basketball graphics.

## Questions to be able to answer

- Why are manual prices and provider prices stored separately?
- Why does a feed tick not invalidate every open operator form?
- What happens when a source pauses a market that a local operator resumed?
- What is the difference between duplicate data, a gap and a stale connection?
- Why write storage before announcing success?
- What race remains when Web Locks are unavailable?
- Why is this local journal not a secure production audit log?
- What happens to a form opened before another tab resets the workspace?
- How does the paginated view complement virtualization and keyboard access?
- How would server-side authorization and idempotency change the design?

## Small exercises

Change the maximum manual price and update the boundary tests. Add a fourth
fictional market while keeping outcome IDs stable. Add a new journal filter.
Modify a tracker transition while honoring reduced motion. Complete these changes
and explain the checks they need before presenting this work in an interview.

The scope and executed evidence are in `validation.md`; do not substitute an
unmeasured performance score or an unrun browser assertion for evidence.
