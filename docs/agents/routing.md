# Agent routing and effort

Use one implementation agent by default. Add independent agents only when work is
actually separable or a risk trigger requires independent judgment.

| Role | Default effort | Trigger | Do not use for |
|---|---|---|---|
| `repo-scout` | low | locate ownership, callers, contracts | editing or design decisions |
| `implementation` | medium | bounded product or harness change | broad architecture review |
| `test-writer` | medium | focused regression or missing contract test | rubber-stamping green output |
| `verifier` | medium | independently drive changed behavior | editing implementation |
| `database-reviewer` | medium | migrations, RLS, function/query boundaries | ordinary UI changes |
| `security-reviewer` | high | auth, RLS, crypto, secrets, payments, destructive operations | every routine change |
| `architecture-reviewer` | high | cross-cutting or hard-to-reverse decisions | local refactors |

Escalate effort only when uncertainty, blast radius, or irreversibility justifies
it. “Proactively use” is not a trigger. Verification agents return evidence and a
verdict; they do not make changes.

Procedures belong in skills. Agents read the applicable skill and nearest
`AGENTS.md`, then operate within the task's authorization.
