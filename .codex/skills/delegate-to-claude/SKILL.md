---
name: delegate-to-claude
description: Delegate a bounded coding, investigation, or review task from Codex to Claude Code, then inspect and independently assess Claude's result. Use when the user asks Codex to delegate to Claude or when a second-model execution or review pass is explicitly desired. Do not use for ordinary Codex subagents or as a substitute for Codex's final review.
---

# Delegate to Claude Code

Use Claude Code as an executor or independent reviewer while Codex remains the coordinator responsible for scope, evidence, and acceptance.

## Preconditions

1. Confirm `claude` is installed and authenticated by running `scripts/claude_delegate.sh check` from this skill directory.
2. Read the repository's applicable `AGENTS.md`, `CLAUDE.md`, and task-specific instructions before writing the work order.
3. Do not delegate secrets, provider writes, production mutations, releases, or destructive operations unless the user explicitly authorized that exact action. Claude receives no broader authority than Codex has.

## Work order

Write the task into a temporary Markdown file outside the repository unless the user requested a durable task artifact. Make it self-contained and include:

- role: executor or read-only reviewer;
- exact objective and boundaries;
- working directory and relevant files;
- repository instructions Claude must read;
- allowed side effects and forbidden actions;
- required checks and expected evidence;
- requested return format: findings or changed files, commands run, results, and blockers.

The helper adds an executor marker and tells Claude not to spawn further agents. Do not pass the user's whole conversation when a concise work order is sufficient.

## Run

From the target repository directory:

```bash
/absolute/path/to/this-skill/scripts/claude_delegate.sh run /absolute/path/to/work-order.md /absolute/path/to/result.json
```

The default permission mode is `auto`, which lets Claude decide whether tools are safe to use. Override it only when the task requires a stricter mode:

```bash
CLAUDE_DELEGATE_PERMISSION_MODE=plan scripts/claude_delegate.sh run work-order.md result.json
```

Optional environment variables:

- `CLAUDE_DELEGATE_MODEL`: Claude model alias or full model name; default `sonnet`.
- `CLAUDE_DELEGATE_EFFORT`: `low`, `medium`, `high`, `xhigh`, or `max`; default `medium`.
- `CLAUDE_DELEGATE_MAX_BUDGET_USD`: API budget ceiling when supported by the current authentication mode.
- `CLAUDE_DELEGATE_PERMISSION_MODE`: default `auto`; prefer `plan` for read-only planning/review when tools are unnecessary.

The helper loads project and local Claude settings while excluding user-level integrations by default, and disables browser/MCP integrations. This keeps delegation focused on the checked-out repository. If a task genuinely requires an external connector, handle that action in Codex under the original authorization rather than silently widening Claude's access.

Never choose `bypassPermissions` merely to avoid a permission failure. Use it only when the user explicitly requests it and the execution is inside an appropriately isolated sandbox.

For a follow-up in the same Claude session, obtain `session_id` from the JSON result and run:

```bash
scripts/claude_delegate.sh resume SESSION_ID follow-up.md follow-up-result.json
```

If a call outlives the command yield, continue waiting on that same process/session rather than launching a duplicate.

## Accept or iterate

Claude's summary is evidence to inspect, not proof. Codex must:

1. inspect the actual diff or artifacts;
2. run proportionate independent checks;
3. compare the result with the original scope and repository rules;
4. send a focused follow-up with concrete failures when iteration is needed;
5. report Claude's contribution separately from Codex's verification.

Do not claim success from Claude's self-report alone. Codex retains the decision to accept, commit, publish, deploy, or make any external change.
