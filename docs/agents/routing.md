# Agent routing and effort

The primary agent owns scope, acceptance criteria, task decomposition, review,
and the final answer. Every substantive repository task must delegate at least
one bounded unit to the best-fit project agent. Use `repo_scout` for read-only
discovery or analysis and `implementation` for product or harness changes. Add
other agents only for separable work or the risk triggers below. Skip delegation
only for trivial conversation, a single obvious lookup, or a mechanical one-line
edit whose coordination cost exceeds the work.

## Implementation and integration

Implementation starts in a dedicated task worktree created from the current
`staging` branch. Keep the shared `staging` checkout clean and use it only as the
integration target. Complete the scoped change, review its diff, and run the
required verification in the task worktree. Merge the task branch back into local
`staging` only after that evidence passes; an unverified or partially complete
branch does not belong in `staging`.

Completion includes publishing the work: commit only the scoped task changes,
merge the verified commit into local `staging`, push `staging`, then fetch or read
back the remote ref and prove `HEAD` equals `origin/staging`. Do not report an
implementation complete while its commits exist only in a task worktree or the
local integration checkout. A blocked or ambiguous push is a blocker, not a
successful publish; preserve the commit, do not retry blindly, and report the
exact remote state. Pushing and deployment remain subject to applicable branch
protection, release, and production-safety rules.

Before implementation, map the change to every deployed consumer it can affect,
including supported mobile builds, web and admin clients, the API and worker, and
internal MCP integrations. Preserve their current interfaces, configuration,
authentication and data expectations. Verification must cover the affected
contracts and cross-application path, not only the edited package. If the change
can alter live production, first establish the actual deployed versions,
configuration, dependencies, interfaces, and behavior; after deployment,
independently verify the affected end-to-end behavior. A local test, repository
state, or successful deployment record is not proof that deployed apps remain
functional.

## Cost ladder

Project Codex defaults live in `.codex/config.toml`; task profiles live in
`.codex/agents/`. An explicit task handoff may raise or lower reasoning effort.

| Role | Codex model | Default effort | Trigger | Do not use for |
|---|---|---:|---|---|
| `repo_scout` | Luna | low | locate ownership, callers, contracts | editing or design decisions |
| `implementation` | Terra | medium, overridable | bounded product or harness change | broad architecture review |
| `test_writer` | Terra | medium | focused regression or missing contract test | rubber-stamping green output |
| `verifier` | Terra | medium | independently drive implemented behavior | editing implementation |
| `database_reviewer` | Terra | high | migrations, RLS, function/query boundaries | ordinary UI changes |
| `security_reviewer` | Sol | high | auth, RLS, crypto, secrets, payments, destructive operations | every routine change |
| `architecture_reviewer` | Sol | high | cross-cutting or hard-to-reverse decisions | local refactors |

Claude profiles under `.claude/agents/` provide equivalent roles when Claude is
explicitly requested. They are not part of the normal Codex routing path.

## Implementation effort

Keep `implementation` on Terra and choose effort from the task shape:

- `low`: mechanical, fully specified, narrow change with an obvious check.
- `medium`: normal feature or bug fix with a few files and known contracts.
- `high`: ambiguous behavior, several interacting modules, concurrency, or
  difficult debugging.
- `xhigh`: exceptional Terra implementation where high effort has already proved
  insufficient or the change has a large but non-security blast radius.

Security and architecture risk are different jobs, not reasons to silently turn
the implementation agent into a premium generalist. Add the matching read-only
Sol reviewer and keep implementation on Terra unless the user explicitly asks for
a different model.

## Handoff contract

Every delegated task includes the objective, owned files or surface, acceptance
criteria, applicable `AGENTS.md` and skill, allowed side effects, required checks,
and the evidence to return. The agent must report changed files, commands and
results, assumptions, and blockers. The primary agent independently reviews the
diff and decides whether acceptance has been met.

Parallel agents are for independent read-heavy work or non-overlapping ownership.
Avoid concurrent edits to the same files, shared database state, fixed local
ports, or one simulator. Subagents consume additional tokens, so parallelism must
buy meaningful time or independent judgment.

Procedures belong in deterministic skills rather than agent prompts. Agents read
the nearest `AGENTS.md` and the applicable repository skill, then operate only
within the task's authorization. Verification agents return evidence and a
verdict; they do not fix implementation.
