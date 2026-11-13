# Process

How a ticket becomes a merged pull request and then a store release when AI agents do part of the work, inside the client's house rules (numbered 1 to 7 as in the brief).

**What happened on this repository.** Agents wrote the code from per-ticket contracts, and an orchestrating session ran the gates and five read-only review passes. Each ticket is a pull request, and the orchestrating session merged each one after CI passed; on a team, a human merges (rule 2). One commit went straight to `main`: the initial README stub, because a pull request needs a base. The rest of this document is the process I follow with a team.

## From ticket to merged pull request

1. **Ticket and branch.** One ticket, one branch `MASNET-<n>-<slug>`, one pull request. Hooks and CI refuse anything else (rule 1).
2. **Context for the agent.** The agent reads `AGENTS.md` (house rules and domain rules M1 to M10), `ARCHITECTURE.md` and `docs/api-contract.md`. I add a task brief: the files it owns, the files it must not touch, the exact types or test names when they matter, and one gate command. Designs go in as screenshots or a written description with fictional data only (rule 6).
3. **Plan, then implement.** For anything in `src/services/sync`, `storage`, `api` or `mock/`, the agent writes a plan and I approve it before it edits. Copy, layout and tests for existing behavior go straight to implementation.
4. **Tests first for behavior.** A sync change starts with a failing test. A fix is accepted only when the test was seen to fail before the change.
5. **Review.** A second model reviews the diff read-only, with the brief and no access to the author's reasoning. Then I review. Green tests are not the bar: on this project each of five review passes found real defects with every test passing, and each pass became its own fix ticket (MASNET-7, 9, 11, 13, 30). The third pass reviewed the fixes themselves and found a defect that an earlier fix had introduced.
6. **Pull request.** The template asks for: OTA or binary (rule 4), feature flag (rule 7), contract change (rule 2), and what was verified on a device. CI runs the gates. A human merges.

## What an agent may do

| Unsupervised | Supervised (a human reads every line before merge) | Never |
|---|---|---|
| Read the code, run gates, write tests for existing behavior | Sync engine, storage schema, API contract and mock | Push to `main`, merge |
| Lint and type fixes, translation keys | Dependencies and `app.config.ts` (they change the binary) | Signing, store submission, rollout changes (rules 3, 5) |
| Layout and copy behind an existing flag | Anything touching tokens, sessions or files with worker data | Read `.env*`, keystores or credentials; use real worker data (rules 5, 6) |

## How the setup stops an agent from breaking the rules

| Rule | Enforced by tooling | Handled by people |
|---|---|---|
| 1. No push to `main`; ticket IDs | `.githooks/pre-push` and `commit-msg`; CI job `ticket-ids`. GitHub Free has no branch protection for private repositories, so in the client's organization I would also turn on branch protection with required checks | — |
| 2. Human reviewer; backend sign-off on contract | Pull request template; CODEOWNERS on `docs/api-contract.md`, `mock/`, `src/services/api/` | Solo here. With the team: one mobile or full-stack reviewer per pull request, and a backend developer as required code owner on the contract paths |
| 3. Track, staging QA, production; human approves | `eas build`, `submit`, `update` and `credentials` are denied in `docs/ai-config/claude-settings.json` | Described in the release plan |
| 4. OTA only for compatible JS changes | Fingerprint runtime version: an update only reaches binaries with the same native fingerprint. `runtime:check` asserts the setting | The pull request author states OTA or binary; the reviewer checks it |
| 5. No keys in the repo or near an agent | `secrets:check` in CI fails on credential file names and key patterns; the agent's permission rules deny reading or editing them (`docs/ai-config/claude-settings.json`) | Keys live in the CI secret store and the store consoles. Agents run on developer machines with no access to either |
| 6. No real worker data | Seed is fictional; the logger never receives tokens, phones or file paths | Screenshots and recordings use placeholder images; crash reports scrub user fields before upload |
| 7. Remote flag, off by default | `assignment.flags` is the only source (in the contract, no flag defined yet); the pull request template asks for the flag name | Flags are turned on per environment by a human, staging first |

The rules live in `AGENTS.md`, git hooks and CI, so they hold for any agent and for people. `docs/ai-config/` adds the Claude Code side: agent definitions, deny rules and a commit hook.

## Verifying on a device

Tests prove the engine. They do not prove a screen. Before a pull request is ready I run the affected scenarios on the Android emulator at 360 dp with the largest font, with the mock's switches: airplane mode, kill and reopen, dropped response, random 500s, expired token. Before a release, the same on a real low-end Android 9 phone. I record what I ran in the pull request.

## What CI runs

On every pull request: branch and commit ticket IDs; install with a frozen lockfile; typecheck; lint with architecture boundaries and zero warnings; React Compiler check; runtime flag check; secret scan; over 1,300 pure tests (engine, storage on real SQLite, mock, selectors, translations, end-to-end sync against the mock); component tests; Expo dependency check. Ticket IDs, static gates and component tests run as three parallel jobs; the tsc, ESLint and Jest caches are restored by lockfile and config hash, and each tool rechecks file contents. Not in CI yet: a native build and an end-to-end UI test; both belong in the release pipeline.

## Where a human must decide

Merging. Any contract change. Adding a dependency. OTA versus binary. Turning a flag on. Promoting a build between tracks. Each rollout step. Rolling back.

## Release plan for this app

**Build and signing.** CI builds release binaries with EAS Build or an equivalent pipeline. The upload key and store credentials are in the CI secret store; Play App Signing holds the app signing key. No developer machine and no agent has them (rule 5).

**Tracks.** Play internal track and TestFlight for every merged build, pointed at the staging backend. QA runs the eight scenarios there on a low-end Android device. A human promotes to closed testing, then production (rule 3).

**OTA versus binary.** JavaScript-only changes that keep the same native fingerprint ship as an OTA update to the matching runtime version, first to the staging channel, then production. Any change to native dependencies, config plugins or `app.config.ts` is a new binary (rule 4). When unsure, binary.

**Staged rollout.** Production binaries go to 5 %, 20 %, 50 %, then 100 %, at least a day apart, each step approved by a human after checking the numbers below. OTA updates use the same steps through rollout percentage.

**Monitoring.** Crash and error reporting with user fields scrubbed (rule 6). I watch crash-free sessions, ANR rate, cold start on low-end devices, and three app-specific signals from the backend: actions stuck in a queue for more than a day, duplicate `clientActionId` replays (expected, but a spike means timeouts), and 409 and 413 rates.

**Rollback.** New behavior is behind a flag, so the first move is to turn the flag off (rule 7). A bad OTA update: republish the previous update to the channel. A bad binary: halt the staged rollout in the store console, then ship a fixed build with a higher version code; stores do not roll a binary back. Local data must stay readable by the previous version, so a schema migration ships one release before the code that depends on it.
