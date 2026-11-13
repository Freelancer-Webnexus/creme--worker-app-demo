# Ticket contract

The orchestrating session gave each implementation agent one ticket as a written contract in this shape. The `worker` agent refuses a prompt without the first two lines.

```text
worktree: <absolute path of the ticket's git worktree>
verification: bun run --cwd <worktree> check:ci

You are building ticket MASNET-<n> (<scope>) in the git worktree at <path>, on the
checked-out branch `MASNET-<n>-<slug>`. Another agent works on <paths>.
Touch ONLY: <owned paths>.

Read first, fully: AGENTS.md, ARCHITECTURE.md, docs/api-contract.md, <the types and
ports this ticket depends on>. For every native package, read its installed type
definitions under node_modules/<pkg> before using it; do not write an API from memory.
Add no dependency.

The users: <who they are, which language, which devices, which network>.

1. <File or module>: <exact exported names and types>. Tests: <test names, each
   naming the M-rule it proves>.
2. ...

Tests first for anything in src/services/sync. Show the red run before the fix.

Receipt, first line `status: passed`, `status: blocked` or `status: failed`, then:
changed files, every command run with its result, and open risks.
```

A real excerpt, from MASNET-6 (paths shortened):

```text
worktree: .worktrees/masnet-6
verification: bun run --cwd .worktrees/masnet-6 check:ci

You are building ticket MASNET-6 (i18n, session, connectivity, image services) ...
Touch ONLY: src/services/i18n/**, src/services/session/**, src/services/connectivity/**,
src/services/images/**, src/services/native/** (storage wrapper) ...

1. src/services/i18n/ (M9) — an owned, tiny, typed module; no library:
   - es.ts: export const es = { ... } as const ... en.ts: Record<keyof typeof es, string>
     so a missing or extra key is a compile error.
   - Tests: interpolation, missing param leaves a visible marker, every key in es and en
     has the same set of {placeholders}, no empty strings.
```
