#!/bin/bash
# Claude Code PreToolUse hook on Bash: the human is the only commit author.
cmd=$(jq -r '.tool_input.command // ""')

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

case "$cmd" in *git*) ;; *) exit 0 ;; esac

if printf '%s' "$cmd" | grep -qiE 'co-authored-by'; then
  deny "Co-author trailers are forbidden. The human user is the only commit author."
fi

if printf '%s' "$cmd" | grep -qE 'git[^|;&]*commit[^|;&]*--trailer'; then
  deny "Commit trailers are forbidden. The human user is the only commit author."
fi

if printf '%s' "$cmd" | grep -qiE 'git[^|;&]*(checkout +-[bB]|switch +-[cC]|branch( +-[mMcC])?) +["'"'"']?(claude|codex|cursor|copilot|agent|ai|bot)/'; then
  deny "Agent-prefixed branch names (claude/, codex/, etc.) are forbidden. Use a concise descriptive branch name."
fi

exit 0
