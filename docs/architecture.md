# Architecture

RYVQEN is a browser-local operations demonstration, with an optional loopback
WebSocket server. The UI is not an authentication or multi-user authorization
boundary. “RK” identifies a local demonstration operator.

## Boundaries

| Layer                     | Responsibility                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `src/core/fixtures.ts`    | Deterministic fictional catalog, snapshots and replay ticks                               |
| `src/core/model.ts`       | Zod protocol, sequence reducer, exact decimal prices, effective market and decision rules |
| `src/core/store.ts`       | External store, persistence, revision/generation checks and recovery                      |
| `src/core/runtime.ts`     | React subscription, worker/WebSocket lifecycle, freshness watchdog and downloads          |
| `src/core/feed.worker.ts` | Replay transport and controlled fault injection                                           |
| `server/feed.ts`          | Actual loopback WebSocket snapshots and contiguous updates                                |
| `src/components/`         | Authored graphics, market editor and fixture rendering                                    |
| `src/pages/`              | Desk, fixture directory, journal, signal monitor and guide                                |

## The stream and the book are separate

The stream contains current fixture values, a connection state, epoch, sequence,
receipt time and actual session counters. It restarts on reload. It is not saved
as authoritative real-world information.

The book contains a schema version, reset generation, workspace revision,
watchlist, market overrides, newest 200 successful decisions and motion preference.
It persists under `ryvqen:desk:v1`.

An override has its own operator revision, optional manual prices, a suspension
flag and a reason. Live feed ticks do not alter this revision or overwrite manual
prices. Effective status is suspended if either the source or the local operator
suspends it. Releasing manual prices changes only the pricing source.

## Message ordering

A snapshot initializes or deliberately recovers the connection. A tick must use
the current epoch and the next sequence. Duplicate/late/foreign-epoch ticks are
discarded. A gap freezes incremental processing and requests a snapshot; it does
not apply a partial view. Invalid prices, duplicate fixture IDs, malformed data
and unknown fixture patches are rejected.

The public worker emits a frame every 1.8 seconds. The signal controls send actual
duplicate/late/gap messages through the same reducer. These are controlled replay
conditions, not a measured external feed SLA.

A 7.5-second freshness guard blocks writes even if a transport remains open.
The watchdog requests a snapshot and reconnects if recovery does not arrive.
WebSocket reconnects back off from one to sixteen seconds. Deliberate pause and
cleanup cancel retry timers and detach old sockets, so an old socket cannot
replace a new session. StrictMode cleanup terminates the old worker/subscriptions.

## A market decision

1. The dialog captures the current reset generation and operator revision.
2. The user enters exact hundredths and a reason of 4–240 characters.
3. The demonstration endpoint acknowledges after a short asynchronous boundary.
4. Under a Web Lock where supported, the store rereads current persisted data.
5. It rechecks freshness, connection, live event, source status, generation,
   operator revision, complete prices and action semantics.
6. It writes the next book before notifying React or announcing success.

A rejected endpoint response, stale form or storage failure leaves saved prices
and the journal unchanged. Conflicts require reopening the form; the interface
does not silently replace a user's captured values.

Web Locks coordinate supported tabs; a storage event refreshes other tabs.
Without Web Locks, compare/read/write is not atomic. This fallback is explicitly
shown on Signal. The project does not claim distributed concurrency guarantees.

## Recovery and presentation

Unreadable saved bytes remain available for download. Reset requires a second
confirmation and compares the reviewed raw bytes before replacing them. An
external storage deletion creates a new generation so stale dialogs fail.

The fixture directory renders visible rows plus overscan. A paginated alternative
keeps all fixtures reachable with native links and buttons. The SVG tracker has
an accessible description; it is an illustration, not a real event visualization.
Motion follows system reduced motion and a persisted pause preference.

Native dialogs provide focus containment and Escape handling. The application
restores focus when the editor closes and uses a skip link and route focus target.
Frequent feed frames do not spam an assertive live region. Successful decisions
use a separate polite status message.

## Deliberate limits

The loopback server is a feed demonstration with bounded message size and origin
checks, not a public security boundary. Local journal records are editable by the
browser owner, capped and not tamper-proof. There is no identity provider,
server-side trading API, remote persistence, transaction settlement or live data
license. A production service would own authorization, decisions, audit retention
and concurrency on the server.
