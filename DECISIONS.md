# Decisions

Each section names what I chose and what I gave up. Rule IDs (M1 to M10) are the brief's.

## 0. How this was built, and the timebox

I used AI on purpose and I state it plainly. A spec and a plan came first, written with Claude and reviewed by a second model. The build ran as one session on 2026-11-13: an orchestrating Claude Code session gave separate agents one ticket each, in separate git worktrees, with a written contract (files, types, test names, one gate command). The commit history is real: first commit 15:49, last code commit 17:39 (UTC-3), with up to three agents in parallel. None of it is my typing, and I am not presenting it as a four-hour solo build. Reviews, these write-ups and the fixes from the first device run (2026-11-16, MASNET-12 onward) came after.

The scaffold is my own Expo architecture template (layout, owned UI primitives, ESLint boundary rules, gate scripts). The sync engine, storage, API, translations, session, images, runtime, features and the mock were written for this assessment.

## 1. Local storage

**SQLite (`expo-sqlite`) for the queue and cached server data.** M3 needs "stored before any network call" to be a real commit and M2 needs it to survive a kill; a transaction gives both. `WHERE worker_id = ?` gives M10 in the query itself: the stores have no function that reads without a worker id. WAL with `synchronous = FULL`: the queue is small, so the extra fsync is cheap next to a lost action. Rejected: MMKV, which has no transactions, and TanStack DB, a 1.0 release candidate whose SQLite adapter does not support SDK 58 yet. Gave up: MMKV's speed and simpler API.

**Model.** `queue`: one row per action (`client_action_id` primary key, `worker_id`, type and fields, `status` queued or failed, `failure_reason`, `created_at`, `attempts`, `next_attempt_at`) with CHECK constraints. `worker_cache`: the last assignment per worker and the terms version last seen. `device`: language, last phone.

**Per worker (M10).** Rows, cache, upload folders (`uploads/<workerId>/`) and the in-memory query cache are keyed by worker id. Only the signed-in worker's queue is sent, because the token is theirs; the other worker's actions wait on the device.

**Isolation.** The default `expo-sqlite` transaction does not isolate other statements on the connection, so a stored insert could be rolled back with another write's failure. The driver uses an exclusive transaction and one serial gate. The same SQL runs on `bun:sqlite` in tests through a driver port, including write, close, reopen, read on a real file.

The session token is in the device keystore (`react-native-nitro-storage`), not in SQLite.

## 2. Sync engine

A pure TypeScript module with no React Native import. Queue store, transport, clock, connectivity, session and outcome sink are injected, so tests use a fake clock, and an integration suite runs scenarios 2 to 8 against the real mock over HTTP.

**Ordering.** Oldest first per worker. Not strict FIFO across backoff: an action waiting out a backoff after a server answer (408, 429, 5xx) is not ready, so newer due actions go first in the same pass, because actions are independent and one that keeps failing would hold every later one. A network error or timeout ends the pass instead, so an action whose send always times out is still sent first each time it is due. Gave up: two uploads of the same document can arrive out of order.

**Backoff (M5).** `min(60 s, 1 s × 2^attempts)` with ±20 % jitter. No attempt limit for network errors and 5xx (M2). A network error or timeout ends the pass: the link is likely dead for every action. A 408, 429 or 5xx is an answer, so the link works: that action waits out its backoff and the pass goes on with the next due action. A pass sends each action at most once, so a backoff that ends during a slow pass cannot keep it going. When nothing is due, the timer is set for the earliest waiting action. "Try again now" and a returning connection make queued actions due at once without resetting `attempts`. A 2xx whose body is not JSON is retried, not trusted: a captive portal answers that way, and deduplication makes the retry safe.

| Response | Engine |
|---|---|
| 201, or 200 replay | Update the cache, then remove older failed rows of the same slot and the row |
| Network error, timeout | Record the attempt, schedule the next, stop the pass |
| 408, 429, 5xx | Record the attempt, schedule the next, continue with the next due action |
| 409 `stale_terms` | Cache the new terms, then remove the row. Nothing is accepted (M6) |
| 413, 422, other 4xx, local file gone | Mark the row failed with a reason; continue |
| 401, 403 with the current token | Change nothing; stop; `auth_required` until sign-in |
| 401, 403 with a token that was replaced since the send | Keep the row queued; send it again with the current token |

One order everywhere: server fact into the cache, then remove the row, then delete the file. Removing the row first could lose the server's answer; deleting the file first could turn a delivered upload into "send failed" after a kill. Either way the worker would be invited to submit again under a new id. A fetch that started before the last local update is discarded, so a slow response cannot write "not submitted" over "pending review".

**Two loops at once.** The run lifecycle is one closed type. A trigger during a run sets `running_with_pending`, which adds one more pass; it cannot start a second loop. If that guard were wrong, the server still deduplicates on `clientActionId` (M3). The id is created at tap time and stored in the same insert. "Sending" is not a stored status: an action in flight when the app dies is still `queued` and goes out again with the same id.

## 3. State model (M4)

Stored: queue rows (device only) and the last assignment (server). Never stored: what a screen shows. Pure selectors derive it.

- `documentRowState`: queued local upload → `pending_sync`; else failed local upload → `send_failed`; else the server state; else `not_submitted`.
- `termsState`: `confirmed` when the accepted id equals the current id; `pending_sync` when a queued acceptance exists for the current version; else `needs_confirmation`.

`pending_review`, `approved` and `correction_requested` can only come from server data. Home, Documents and Terms call the same selectors. Wording follows: a queued item says "saved on this phone, not sent yet"; the capture button says "Use this photo", not "Send"; an empty queue says "nothing waiting to be sent from this phone", not "everything delivered". Engine, session, boot and capture are each one closed union with one transition function.

## 4. Images (M7)

`prepareUpload` runs a ladder (longest edge 1600 px at JPEG 0.7, then 1280/0.6, 1024/0.5, 800/0.4), checks the real file size after each step and takes the first result under 1 500 000 bytes. If none fits, the worker gets an error and nothing is queued. Files live in the document directory under `uploads/<workerId>/<id>.jpg` with a fresh id per capture; the cache directory can be emptied by the OS while an upload is queued. The original is deleted after compression, and on retake, failure and exit. The compressed file is deleted on delivery or when its failed row is replaced or dismissed. Unreferenced files are swept at start. Gave up: resumable uploads, which need backend work.

## 5. Assumptions

| The brief was silent on | I did |
|---|---|
| Which worker on a shared number is calling | `X-Worker-Id` header; 403 if not on the token's number |
| What survives sign-out | Only the token is cleared; queue and cache stay (M2). Cost: data stays on a shared phone |
| Sign-in offline | Not possible; after the first sign-in the app works offline |
| Unknown phone | `request` answers 200 for any number; `verify` answers 401 like a wrong code |
| Which documents can be sent again | Not submitted, send failed, correction requested |
| Resubmission (M8) | New action, new id, new file |
| 403 | Treated like 401 |
| Rule 7 and the first release | The required scope is not flagged. `assignment.flags` is in the contract and the cache, but no flag exists yet, so no code reads one; the next feature adds its flag there |
| Contract additions | `acceptedTermsVersionId`, `flags`, replay returns the original body. Need backend sign-off (rule 2) |

## 6. What I cut, and what is fragile

- **Emulators and simulators only, no real phone.** The eight scenarios and seven edge cases run as an Argent suite on a release build on an Android 15 emulator (Pixel 9 Pro Fold), and three full runs of the eleven flows that run on iOS passed 9, 9 and 10 of 11 on a release build on an iOS 27 simulator (the README lists each failure). On an Android 9 emulator with 2 GB, two cores and software rendering (360 × 640 dp), a release build shows its first frame in 0.37 to 0.67 s over three cold starts, holds about 123 MB, and tab switches, scrolling and a screen push render at a 95th-percentile frame time of 21 ms with two slow UI-thread frames in 739.
- **Sync runs only while the app is open.** Next: a background task.
- **Data at rest is not encrypted**, and sign-out keeps it. Next: encrypt, and wipe after a period without sign-in or on a revoked session.
- **The engine has two small state machines** (run lifecycle and sync state) that read each other. It is tested, but one machine would be easier to explain.
- **A photo pick interrupted by Android killing the activity is lost.**
- **Session expiry is detected only by a 401.**
- **Changing the system font size while the app is open returns it to Home.** Android recreates the activity and the navigation state is not restored. Nothing queued is lost.
- **The end-to-end suite needs an emulator and Argent**, so CI runs only the unit and integration tests. The Android flows pick a generated test photo by its time in the system photo picker.
- No push, signature or crash reporting. Flags are a field in the assignment, not a service.

Interface choices (motion, lists, large text, keyboard, server state) are in the README under "Interface notes".

## 7. AI usage log

**Tools.** Claude Code: one orchestrating session, implementation agents per ticket, a stronger model as read-only reviewer. It also wrote the first draft of this document. Gemini made the logo concept and the palette direction (MASNET-16); the shipped icon is a vector redraw of that concept with the exact token colours. No tool had credentials or real worker data. The subagent definitions, the ticket contract, the commit hook and the permission deny rules for house rules 1, 2, 3 and 5 are in `docs/ai-config/`. `AGENTS.md`, git hooks and CI hold the same rules for any tool.

**Context.** `AGENTS.md` (house rules and M1 to M10), `docs/api-contract.md`, and a per-ticket contract. The engine's public types were fixed before parallel agents started.

**Verification.** `bun run check:ci` per ticket (types, lint with boundaries, React Compiler, secrets, over 1,300 pure tests and over 120 component tests), `expo-doctor`, an Android debug build, the integration suite, five independent read-only reviews, each followed by a fix ticket (MASNET-7, 9, 11, 13, 30), and a run of the eight scenarios on an emulator (MASNET-12).

**Where the AI was wrong.** Green tests were not enough: the first review found nine defects with 228 tests passing, the second eleven with 1034 passing, the third two more blockers with 1189 passing, the fourth two more with 1251 passing: on a device a dropped connection did not end the pass, and a slow link could keep a pass running.

1. *Lost server fact, twice.* The engine removed the queue row, then updated the cache. A failure in between left "not submitted" with nothing queued, and the worker would submit again under a new id, which M3 forbids. The fix reversed the order, but it deleted the upload file before removing the row, so a kill in between made a delivered upload show "send failed". The third review, of the fix itself, caught that. A fix is new code and needs its own review.
2. *A test that proved nothing.* The first regression test for that fix passed on the old code. The agent caught it by stashing the fix and re-running, then rewrote the test until it failed first.

3. *The last metre.* With every test and three reviews green, the first emulator run failed scenario 2: no photo upload reached the server. The app's `fetch` is `expo/fetch`, which rejects React Native's `{ uri, name, type }` file part; the tests sent a Blob, so the runtime path never ran. A regression test now runs the real encoder. The same run found a dirty clone after `expo start`, a camera error that named the wrong cause, and an Android 17 permission the README did not mention.

Also: a sync indicator that said "everything reached the staff" whenever the queue was empty, false after a 409; a server 500 shown as "you need internet"; a failed upload row shown above an approved document; the previous worker's in-flight result changing the next worker's sync state; a template Android compileSdk pin that the build rejected; a crash on the next screen push after the worker changed the font size, because expo-router's shared `router` was unbound when Android recreated the activity (a lint rule now blocks that import).

**What stays with a human.** On a team: merging, sign-off on the contract, credentials, and deciding that a device run passed. On this take-home the orchestrating session merged each pull request after CI passed (PROCESS.md); AGENTS.md rule 2 is the team rule.

## Written questions

**1. Offline passport Monday; staff reject an earlier version Tuesday; sync Wednesday.**
Server: accept the Monday upload as a new submission; it has its own `clientActionId` and is not an edit. Set the document to Pending Review, and keep Tuesday's correction in history as answered by a newer submission, with the capture time so staff see the photo predates their request. App: deliver the queued action, refetch, show what the server says. Worker: the row goes from "saved on this phone" to "sent, waiting for review". The app must not show Tuesday's correction over a newer submission, and must not hide it if the Monday upload fails.

**2. Push with SMS fallback.**
The server owns delivery: push first, then SMS if no delivery or open receipt arrives within a window sized to the appointment's urgency. Push is a hint, not data. On receipt, app open and reconnect, the app refetches appointments and treats the server list as truth. On the device: the appointment list with a version, the last sync time, and local reminders scheduled from that list and rescheduled on every sync. The worker's acknowledgement goes through the offline queue. Offline, the screen shows "last updated". An unacknowledged change stays flagged for staff to call.

**3. Store review and Android 9 with 2 GB.**
Review risks: permission texts that match real use, the data-safety form for identity documents, a reviewer account that works without a real code. Device risks: out-of-memory decoding full-size photos, the OS killing the app during capture or sync, slow cold start, storage pressure from queued images. Tests: an Android 9, 2 GB emulator profile and one real low-end phone; repeated large captures while watching memory; kill during compression and upload, then check the queue; fill storage; measure cold start; internal-track builds with pre-launch reports.

**4. Device binding.**
New phone: code plus worker selection creates a session and the server revokes the old one. Old phone: its token gets 401; queued actions stay local and cannot be delivered under a revoked session. Lost phone: staff or the worker revokes sessions; local data is encrypted and wiped when the app learns of the revocation or after a period offline. Actions queued on a lost phone are lost by design: server state shows what is missing and the worker repeats it. Because families share a number, a new device login notifies the others and re-binding is rate-limited.
