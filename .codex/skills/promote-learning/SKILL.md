---
name: promote-learning
description: Record or promote a reproduced Sauci agent lesson into durable documentation, a skill, fixture, or executable invariant. Use after repeated or confirmed workflow failures, not for speculative observations.
---

# Promote a learning

Read `docs/agents/learnings.md` and copy `.agents/learnings/TEMPLATE.md` into the
appropriate state directory. Include reproduction and verification evidence.

Prefer one executable destination. Promotion requires review, a destination,
and a review-after date; update the record to `promoted` only after that artifact
exists and passes `npm run learn:check`. Never turn a transient provider failure or
untested workaround into a golden rule.
