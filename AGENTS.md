# AGENTS

Rules for any AI agent working in this repository. `CLAUDE.md` points here.
Read this file, `ARCHITECTURE.md` and `docs/api-contract.md` before you change code.

## House rules (the client's delivery process)

These are not style preferences. Git hooks and CI enforce the ones a tool can check.

1. **Never push to `main`.** Every change is a pull request from a branch named `MASNET-<n>-<slug>`. Every commit message starts with `MASNET-<n>`. Enforced by `.githooks/commit-msg`, `.githooks/pre-push` and the `ticket-ids` CI job.
2. **A human reviews and merges every pull request.** An agent never merges. A change to `docs/api-contract.md`, `mock/` or `src/services/api/` also needs sign-off from the backend developers; stop and say so in the pull request.
3. **An agent never builds for a store, signs, submits or changes a rollout.** Those steps belong to a human.
4. **Over-the-air updates carry JavaScript-only changes that match the installed native build.** A change to `app.config.ts`, a native dependency or a config plugin ships as a new binary. Every pull request states "OTA" or "binary".
5. **No signing keys, store credentials or production API keys in this repository or in your context.** Never read or create `.env*`, keystores, `*.jks`, `*.p12`, `*.pem`, `google-services.json` or service-account files. `bun run secrets:check` fails the build on them.
6. **No real worker data.** Names, phone numbers and document images in fixtures, prompts, logs and screenshots are the fictional seed in `mock/seed.ts`. A document photo in a test, screenshot or recording is a picture of blank paper or a generated image, never a real document. Never log a token, a phone number or a file path that contains a worker id.
7. **New behavior ships behind a remote flag that is off by default.** Read it from `assignment.flags`. The required scope of the first release is the only code that is not flagged.

## Domain rules (reference these IDs in comments, tests and docs)

| ID | Rule |
| --- | --- |
| M1 | Every worker action works offline: saved on the device first, sent when a connection returns. |
| M2 | A queued action survives an app kill, a phone restart, and sign-out followed by sign-in as the same worker. |
| M3 | Each action gets a `clientActionId` when the worker performs it, stored before any network call. Retries reuse it. |
| M4 | Pending Sync (device only), Pending Review (delivered) and Approved or Correction requested (staff) are never confused in the UI. |
| M5 | Network failures and 5xx retry with backoff. Each 4xx is handled, never retried blindly. |
| M6 | A terms acceptance carries the exact `termsVersionId` the worker saw. A 409 means show the new terms and ask again. |
| M7 | Required documents come from the server catalog. Photos are compressed under 1.5 MB before queueing; the original is deleted. |
| M8 | A resubmission after a correction is a new action, not an edit. |
| M9 | Spanish is the default language, English the option. Every user-facing string goes through `src/services/i18n`. |
| M10 | Workers who share a phone keep separate queues and data. Every storage read takes a `workerId`. |

## How to work

- Plan before you edit anything in `src/services/sync`, `src/services/storage`, `src/services/api` or `mock/`. State the plan, wait for approval, then implement.
- Sync engine changes start with a failing test in `src/services/sync/*.test.ts`.
- The engine imports no React Native module. It talks to the world through the ports in `src/services/sync/sync-ports.ts`.
- A lifecycle is one closed union with one transition function and an exhaustive `switch`. Never model a status with booleans, nullable fields or strings spread over several places. Derive what the UI shows; do not store it.
- Do not add a dependency without asking. Native dependencies change the binary (house rule 4).
- Verify on the Android emulator before you call a UI change done. Tests alone do not prove a screen.

## Project rules

- Use only `bun` and `bunx`.
- Layout: `src/app` (routes), `src/features`, `src/services`, `src/uikit`, `mock/` (backend mock), `scripts/` (gates).
- File names are lowercase kebab-case. No barrel `index.ts` files.
- Route files stay thin and render a feature screen.
- A screen is a `*-screen.tsx` host that composes one `use-*.ts` hook and one `*-view.tsx`. Views receive props, render and wire. No fetch, no effects, no business rules in a `.tsx` file.
- Business logic lives in `use-*.ts` hooks and in pure `.ts` modules with tests.
- A feature imports another feature only through its `contracts/` folder. Services never import features or routes. `src/uikit` never imports features or services, so translated text reaches it as props.
- `fetch` exists only in `src/services/http`. Native modules enter through `src/services`.
- StyleSheet only. Colors come from `src/uikit/tokens/colors.ts`. Text scales with the system font size: no fixed heights on text containers, touch targets at least 48 dp, layouts work at 360 dp width.
- Use the owned logger in `src/services/logger`. No `console.*`.
- React Compiler is on. Never write `try`/`finally` without `catch` in a component or hook.

## Gates

`bun run check:ci` must pass before a pull request. It runs:

| Command | What it proves |
| --- | --- |
| `bun run typecheck` | Types, strict mode |
| `bun run lint:ci` | Lint and architecture boundaries, zero warnings |
| `bun run compiler:check` | `app.config` enables React Compiler, and every component and hook in non-test `src/**/*.ts(x)` compiles without a bailout |
| `bun run runtime:check` | New Architecture, Hermes and edge-to-edge flags |
| `bun run secrets:check` | No credential files or key patterns (house rule 5) |
| `bun run domain:check` | Pure tests: sync engine, storage, mock, selectors, i18n parity |
| `bun run test:unit` | Component tests |

`bun run deps:check` and `bunx expo-doctor` must pass after any dependency change.
