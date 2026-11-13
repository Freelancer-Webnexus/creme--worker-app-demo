# AI configuration

What I used to build this repository with Claude Code, with personal paths and other projects removed. The project rules every agent reads are in [`AGENTS.md`](../../AGENTS.md); `CLAUDE.md` points there.

| File | What it is |
|---|---|
| [`agents/explorer.md`](agents/explorer.md) | Read-only agent that maps code before an edit (Haiku) |
| [`agents/worker.md`](agents/worker.md) | Implementation agent, one ticket at a time in its own worktree (Sonnet) |
| [`agents/reviewer.md`](agents/reviewer.md) | Read-only reviewer for the review passes (Opus) |
| [`ticket-contract.md`](ticket-contract.md) | The written contract each worker received, with a real excerpt |
| [`claude-settings.json`](claude-settings.json) | Permission deny rules and the commit hook (house rules 1, 2, 3, 5) |
| [`hooks/git-authorship-guard.sh`](hooks/git-authorship-guard.sh) | Blocks co-author trailers and agent-named branches |

The orchestrating session ran on Opus. It planned, split tickets, ran the gates and judged every agent's receipt.

## Where each house rule is enforced

| Rule | Agent side (`claude-settings.json`) | Repository side |
|---|---|---|
| 1. No push to `main` | `git push origin main`, `--force` and `--no-verify` denied | `.githooks/pre-push`, `.githooks/commit-msg`, CI `ticket-ids` |
| 2. A human merges | `gh pr merge` denied | Pull request template, CODEOWNERS |
| 3. No store builds, signing, submits | `eas build`, `submit`, `update`, `credentials` denied | — |
| 5. No keys near an agent | Reading or editing `.env*`, keystores, `*.p12`, `*.pem`, service-account files denied | `bun run secrets:check` in CI |
| 4, 6, 7 | Rules in `AGENTS.md` | `runtime:check`, fictional seed, pull request template |

## Install

These files live under `docs/` because I keep agent settings out of project folders. To turn the rules on for Claude Code in a clone:

```bash
mkdir -p .claude/agents
cp docs/ai-config/claude-settings.json .claude/settings.json
cp docs/ai-config/agents/*.md .claude/agents/
```
