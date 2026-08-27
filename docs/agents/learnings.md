# Learning promotion

Raw activity is not durable guidance. A lesson becomes agent context only after a
reproducible observation is reviewed and promoted.

## Lifecycle

1. Record a structured observation in `.agents/learnings/inbox/`.
2. Include symptom, reproduction, cause, remediation, evidence, and scope.
3. `npm run learn:check` validates the record.
4. A reviewer promotes it into exactly one maintained surface: documentation,
   skill, test fixture, invariant lint, or scoped `AGENTS.md` rule.
5. Move it to `.agents/learnings/promoted/` and include its destination.

Do not promote speculation, transient provider failures, or one-off workarounds.
Prefer executable enforcement over prose. Review guidance on its expiry date.

`.ralph/runs` and activity logs are historical evidence and are not loaded into
normal task context.
