# Architecture

An offline-first worker app: Expo SDK 58, React Native 0.88, TypeScript strict, New Architecture, Hermes, React Compiler. A mock backend in `mock/` implements `docs/api-contract.md`.

## Layout

```
src/app/            Expo Router routes. Thin: each file renders one feature screen.
src/features/       session, home, terms, documents, debug. Screens, hooks, pure modules.
src/services/       Everything that is not a screen.
  sync/             The engine: queue, retries, backoff, response handling. Pure TypeScript.
  storage/          SQLite: queue rows and per-worker cache, behind a small SQL driver port.
  api/              Worker API client. Maps HTTP results to engine results.
  http/             The only place that calls fetch.
  connectivity/     Online/offline signal.
  images/           Compression and upload files.
  i18n/             Spanish and English dictionaries with typed keys.
  session/          Token and signed-in worker.
  runtime/          Composition root: builds the engine with the real ports.
src/uikit/          Tokens and owned components. Imports nothing from features or services.
mock/               Mock backend with failure switches.
scripts/            Gate scripts run by `bun run check:ci`.
```

## Data flow

```
 tap ──► feature hook ──► engine.enqueue ──► SQLite queue row (durable first, M3)
                                                   │
        connectivity, app foreground, timer ──► engine run (one at a time)
                                                   │
                                     transport.send ──► mock / backend
                                                   │
 delivered · retryable · unreachable · stale_terms · rejected · unauthorized
                                                   │
             queue row removed / rescheduled / failed, worker cache updated
                                                   │
 screen ◄── selector (pure) ◄── queue rows + cached server facts
```

A screen never calls the API to perform a worker action. It enqueues, and it reads what a selector derives.

## Sync engine

`src/services/sync` has no React Native import. It receives its dependencies as ports (`sync-ports.ts`): queue store, transport, clock, connectivity, session, outcome sink, random source and id source. Tests run it with in-memory fakes and a fake clock, and an integration suite runs it against the real mock over HTTP.

The engine has one lifecycle, `EngineState`: `idle`, `offline`, `syncing`, `backing_off`, `auth_required`. One transition function handles every event with an exhaustive `switch`.

| Result of a send | Queue | Next |
| --- | --- | --- |
| 201, or 200 replay | Server fact cached, then older failed rows of the slot and the row removed, then upload files deleted | Continue |
| Network error, timeout | Attempt recorded, next attempt scheduled | Stop the pass, back off |
| 408, 429, 5xx | Attempt recorded, next attempt scheduled | Continue with the next due row; back off when none is due |
| 409 `stale_terms` | New terms cached, then row removed | Continue |
| 413, 422, other 4xx | Row marked failed | Continue; the queue is not blocked |
| 401 with the current token, or the session ended | Nothing changes | Stop, `auth_required` |
| 401 with a token replaced since the send | Nothing changes | Send it again with the current token |

- **Server fact, then row, then file.** One order everywhere a row leaves the queue (delivered, replaced, dismissed). The sink caches the fact and is idempotent. If it or the removal fails, the row and its photo stay and the retry gets a 200 replay, so a delivered upload is never shown as "send failed" and a retake never makes a second record (M3, M4, M6). The file is deleted last and best effort; the startup sweep removes a stray one.
- **Fresh fetch.** A delivered or stale-terms outcome also asks for a new `GET /me/assignment`, so the server's copy soon replaces the local patch. The engine does not do this: the composition root wires the sink to the query layer.
- **One run at a time.** A trigger during a run asks for another pass; it never starts a second loop. The run lifecycle is its own closed type: `stopped` (the start state), `idle`, `running`, `running_with_pending`, `stopping`. After `stop()` no new send starts and no timer is armed; a send in flight finishes its store work. `start()` works again. The server also deduplicates on `clientActionId`.
- **Retry now.** `retryNow()` and each offline-to-online edge make the active worker's queued rows due at once without touching `attempts`. Failed rows are not revived. A pass that throws backs off 1 s, 2 s, 4 s up to the cap.
- **Failed rows.** A new action in the same slot (document type, or terms) removes the worker's older failed row and its upload file, so a retake cannot leave "send failed" above server state (M4). Its delivery removes them again, before its own row, so a cleanup cut short at enqueue is finished then. `dismissFailed` removes one on request.
- **Worker switch.** A result for a worker who is no longer active updates its row but never the engine state (M10).
- **Order.** Rows are sent oldest first. After a 408, 429 or 5xx the row waits out its backoff and the pass sends the newer due rows. A network error or timeout ends the pass, so a row whose send always times out still goes first each time it is due. A pass sends each row at most once.

## What the UI shows

Stored: queue rows (device) and the last assignment from the server (cache). Not stored: what a row or the terms screen displays. Pure selectors derive it:

- `documentRowState`: a queued local action wins (`pending_sync`), then a failed local action (`send_failed`), then the server state, then `not_submitted`. Pending Review, Approved and Correction requested can only come from server data (M4).
- `termsState`: `needs_confirmation`, `pending_sync` or `confirmed`, from the current version, the accepted version id and the queue (M6).

## Storage

SQLite, three tables: `queue` (one row per action, indexed by worker and creation time), `worker_cache` (last assignment per worker), `device` (language, last phone). Every query on the first two takes a `workerId` (M10). The store is written against a small SQL driver port, so the same SQL runs on `expo-sqlite` in the app and on `bun:sqlite` in tests. `transaction` hands its work a transaction-scoped executor and nothing else runs on the database meanwhile (work must use only that executor; calling the driver from inside waits forever): `expo-sqlite` uses `withExclusiveTransactionAsync`, the test driver `BEGIN IMMEDIATE`, and both queue other calls behind one serial gate (M2). The queue is read in `created_at, rowid` order, which is insert order.

`worker_cache` rows carry `patched_at`, the engine clock at the last local server-fact patch. A fetch saves only if the request started at or after it: a fetch that started before the last local patch may have read the server before that fact, so it is discarded and the refresh reports `superseded` (M3, M4).

The session token is in the device keystore through `react-native-nitro-storage`. Upload files are in the app document directory under `uploads/<workerId>/`, not in the cache directory, which the OS may empty.

## Boundaries

ESLint enforces them:

- A feature imports another feature only through its `contracts/` folder.
- Services do not import features or routes. `src/uikit` imports neither.
- `*-view.tsx` and route files call no `useState`, `useReducer`, `useEffect`, `useLayoutEffect` or `useInsertionEffect`; logic is in `use-*.ts` hooks and pure modules.
- `fetch` and `XMLHttpRequest` only in `src/services/http`; colors only from the token module; no barrels; no `console.*`.

## Runtime flags

New Architecture and Hermes on, React Compiler on, typed routes, fingerprint runtime version (an over-the-air update reaches only binaries with the same native fingerprint, house rule 4), Android edge-to-edge. `bun run runtime:check` asserts them.
