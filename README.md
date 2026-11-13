# Worker App — Offline Slice

An offline-first app for seasonal workers: sign in, see the job order and terms, confirm the terms, upload required documents. Every action is saved on the phone first and sent when a connection returns. React Native 0.88, Expo SDK 58, TypeScript, with a mock backend.

| Document | What it covers |
|---|---|
| [DECISIONS.md](DECISIONS.md) | Trade-offs, assumptions, what was cut, AI usage log, written questions |
| [PROCESS.md](PROCESS.md) | Ticket to merged pull request to store release with AI tools; release plan |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Layout, data flow, sync engine, storage |
| [AGENTS.md](AGENTS.md) | Rules for AI agents: house rules and domain rules |
| [docs/api-contract.md](docs/api-contract.md) | Mock API contract and failure switches |
| [docs/ai-config/](docs/ai-config/README.md) | The Claude Code agents, ticket contract, deny rules and hook used to build this |

## Requirements

- [Bun](https://bun.sh) 1.4 or newer
- Node.js (the Android Gradle build calls `node`)
- Android Studio with an Android emulator, and the JDK that Android Studio bundles
- iOS: eleven of the Argent flows also run on an iOS 27 simulator (see [End-to-end tests](#end-to-end-tests-argent)); the scenarios are written for Android

## Run

```bash
bun install
```

Start the mock backend (port 4000):

```bash
bun run mock
```

Run the app on the Android emulator. The first run compiles the native project and takes several minutes:

```bash
bun run android
```

The app reaches the mock at `http://10.0.2.2:4000`, the emulator's address for the host. To use another address, set `EXPO_PUBLIC_API_URL`.

On an Android 17 emulator the app asks to find "nearby devices" on first launch. Tap **Allow**: without it Android blocks the local network, so the debug build cannot reach Metro or the mock.

Airplane mode also cuts the debug build off from Metro at `10.0.2.2:8081`, so a kill and reopen offline (scenario 2) fails to load JavaScript. Before the offline scenarios, point the debug build at `localhost` through adb: run `adb reverse tcp:8081 tcp:8081`, then shake the device (or press `Cmd+M`), open **Settings › Debug server host & port for device** and enter `localhost:8081`.

Run the tests:

```bash
bun run test
```

Run every gate that CI runs (types, lint, React Compiler, secrets, tests):

```bash
bun run check:ci
```

## Sign in

The one-time code is `123456`.

| Phone | Worker | Starting state |
|---|---|---|
| `+52 55 1000 0001` | Ana López | Terms v2 not confirmed; no documents |
| `+52 55 1000 0002` | Bruno Díaz | Terms v2 confirmed; passport approved |
| `+52 55 1000 0002` | Carla Díaz | Passport correction requested |

All names and numbers are fictional.

## Failure switches

Run these on the host while the mock is running.

```bash
# 2-second latency
curl -X POST localhost:4000/__admin/switches -H 'content-type: application/json' -d '{"latencyMs":2000}'

# Random 500s on half of the requests
curl -X POST localhost:4000/__admin/switches -H 'content-type: application/json' -d '{"errorRate":0.5}'

# Save the next action, then drop the response (simulates a timeout)
curl -X POST localhost:4000/__admin/switches -H 'content-type: application/json' -d '{"dropResponse":"next"}'

# Publish terms v3
curl -X POST localhost:4000/__admin/publish-terms

# Lower the image limit to 1 KB, so any photo answers 413 (scenario 5 on any build)
curl -X POST localhost:4000/__admin/switches -H 'content-type: application/json' -d '{"maxImageBytes":1024}'

# Expire every token (forces a 401)
curl -X POST localhost:4000/__admin/expire-tokens

# Show saved records: use this to confirm "exactly one record"
curl localhost:4000/__admin/state

# Back to the seed: clears records and switches, terms return to v2, sessions stay
curl -X POST localhost:4000/__admin/reset
```

The same switches can be set at start: `MOCK_LATENCY_MS=2000 MOCK_ERROR_RATE=0.5 MOCK_DROP_RESPONSE=next MOCK_PUBLISH_V3=1 bun run mock`.

To send an oversized image (scenario 5), lower the mock limit with the switch above, or send a real one: `bun run android` makes a development build, and in it Home has a debug link at the bottom ("Depuración" / "Debug"). Turn on "Disable compression", then choose a gallery image larger than 1.5 MB (emulator camera photos can be smaller). The debug screen does not exist in a release build.

## Scenarios

The scenarios change server state, so some need a reset first. After a reset, pull down on Home so the app refetches.

| # | Before | Steps |
|---|---|---|
| 1 | Fresh install | Sign in as Ana. The app is in Spanish. Switch to English on Home: every string changes, including the sync states and the tab bar |
| 2 | Reset | Airplane mode on. Confirm terms; photograph the passport. Both say saved on this phone, waiting for connection. Kill the app and reopen: both are still queued. Airplane mode off: both deliver once; the passport says sent, waiting for review |
| 3 | After 2 | Turn on the drop switch. Upload the DS-160 confirmation. The app retries; `/__admin/state` shows one record; the row says waiting for review |
| 4 | **Reset** (in scenario 2 Ana confirmed v2) | Airplane mode on. Open Terms, do not confirm. Publish v3. Confirm, then airplane mode off: v2 is not accepted; the app shows v3 with a "terms changed" banner and asks again |
| 5 | A document not yet submitted | Lower the mock image limit (or disable compression in Debug), upload a photo: a clear message in Spanish, Retake works, later actions still deliver |
| 6 | Reset | Random 500s on: queued actions deliver after retries; the indicator shows the countdown and "Try again now"; the UI stays responsive |
| 7 | Reset | Sign in on `+52 55 1000 0002`, choose Carla: she sees the correction reason and resubmits. Switch to Bruno: none of Carla's data or queue is visible |
| 8 | Signed in | Expire tokens: queued actions are kept, the indicator asks to sign in again, and the queue resumes after the code |

`src/services/sync/integration.test.ts` runs scenarios 2 to 8 automatically with the real sync engine, real SQLite, real HTTP and the real mock. Its upload file part is a Bun `Blob`, not the device's part. `mock/server.test.ts` covers the device encoding: it encodes a file part with `bytes()`, `name` and `type` through expo/fetch's `convertFormDataAsync` and posts those bytes to the mock.

## End-to-end tests (Argent)

`e2e/argent/` holds saved [Argent](https://github.com/software-mansion/argent) flows that drive the real app on an Android emulator: the 8 scenarios above, plus edge cases (double tap, cancel, sign-out with pending actions, bad sign-in input, largest font). Every flow starts from a clean baseline: it clears the app data, resets the mock, turns airplane mode off and sets the font scale to 1.0.

The flows run against a release build. It carries its JavaScript, so it reopens in airplane mode without Metro. Tested on an Android 15 emulator. Argent cannot drive the Android 9 image, which lacks the emulator display service it uses. The host scripts need Node.js.

```bash
# Once: install Argent, build and install the release app, put the test photo in the gallery
npm install -g @swmansion/argent@0.33.0
bun run android -- --variant release
node e2e/argent/scripts/seed-gallery-android.mjs

# Every run: the mock in one terminal, the suite in another
bun run mock
argent e2e run "$PWD/e2e/argent" --device emulator-5554

# One flow
argent e2e run "$PWD/e2e/argent/qa-04-stale-terms-v3.yaml" --device emulator-5554
```

Set `E2E_ANDROID_SERIAL` if your emulator is not `emulator-5554`. The seed script generates a blank sheet of paper and dates it 8:48:13, the time the flows pick it by. Never put a real document in the emulator gallery.

| Flow | Covers |
|---|---|
| `qa-01-language-switch` | Scenario 1: Spanish on a fresh install, switch to English, every string including the tab bar changes |
| `qa-02-offline-queue-kill-deliver` | Scenario 2: offline confirm and passport photo, kill and reopen, deliver once (Android) |
| `qa-03-dropped-response-one-record` | Scenario 3: response dropped after save, one record on the server (Android) |
| `qa-04-stale-terms-v3` | Scenario 4: v2 refused, v3 banner, confirm v3 once |
| `qa-05-too-large-photo` | Scenario 5: the mock image limit drops to 1 KB, 413 message, Retake, Dismiss, later actions deliver |
| `qa-06-random-500s-countdown` | Scenario 6: 500s, countdown, "Try again now", delivery after recovery |
| `qa-07-shared-phone-carla-bruno` | Scenario 7: correction reason, isolation, Carla's queued action is not sent for Bruno and is sent after she signs in again |
| `qa-08-expired-token-resume` | Scenario 8: tokens expire, action kept, queue resumes after the code |
| `qa-09-double-tap-confirm` | Double tap on Confirm saves one acceptance |
| `qa-10-cancel-and-back` | Cancel on capture, on the gallery and on the preview; back key |
| `qa-11-sign-out-with-pending` | Sign-out dialog, pending action survives and is sent after sign-in |
| `qa-12-sign-in-validation` | Malformed phone, wrong code, unknown number |
| `qa-13-language-switch-with-queue` | Language switch while an action is queued |
| `qa-14-kill-during-upload-dropped` | Kill the app during a slow request with a dropped response, one record |
| `qa-15-large-font` | Font scale 2.0, the largest Android offers: every control stays reachable |

Eleven flows also run on an iOS simulator; the other four need Android-only controls. The simulator cannot go offline, so there the offline steps make the mock answer every request with 500 instead. In three full runs on iOS, qa-11 failed twice and qa-07 once, each time waiting for the sign-out dialog after tapping "Salir"; qa-09 failed once before MASNET-33 measured its tap point again, and qa-14 failed once. Under those 500s the sync card used to change height between retries, which can move "Salir" under the tab bar. MASNET-34 keeps it steady between retries; since then qa-07 and qa-11 each passed three runs of three on a signed release build. Build the iOS app with Xcode's local signing: an unsigned simulator build cannot use the Keychain, so the session is gone after a relaunch. `e2e/argent/lib/` holds shared fragments and `e2e/argent/scripts/` the host scripts (mock switches, record counts, device baseline).

## Interface notes

- **Motion.** Reanimated drives press feedback, status changes and the tab pill on the UI thread. Every animation reads the live Reduce Motion setting; with it on, screens cut instead of fading or sliding. A step forward slides in; switching between sign-in and the tabs fades. Gesture Handler is only the root view the navigator needs: no screen has a custom gesture.
- **Lists.** A `ScrollView`, not FlashList: Documents has three rows and Home a fixed set of cards.
- **Large text.** Body text scales to 2x. Headings stop at 1.5x (title) and 1.75x (headline), and tab labels shrink to fit one line, so no word breaks in the middle on a 360 dp screen. Fields and messages reserve their height, so an error appearing does not move the button.
- **Keyboard.** Form screens follow the keyboard frame by frame (`react-native-keyboard-controller`) and keep the field and its button above it.
- **Server state.** TanStack Query reads the cached worker view from SQLite; the sync engine writes it and then refreshes the query, so a screen never waits on the network to show what the phone knows.

## Project rules in one minute

- Every change is a pull request from a `MASNET-<n>-<slug>` branch; commits start with the ticket ID. Git hooks (installed by `bun install`) and CI enforce it.
- No credentials in the repository: `bun run secrets:check`.
- After a dependency change: `bun run deps:check` and `bunx expo-doctor`.
