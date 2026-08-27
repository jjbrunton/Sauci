---
name: incident-triage
description: Diagnose a Sauci development, CI, backend, or production symptom with evidence. Use for failures, regressions, logs, or unexplained runtime behavior; diagnosis alone does not authorize a fix or deployment.
---

# Incident triage

Establish environment, time window, expected behavior, and blast radius. Reproduce
locally when safe, inspect the narrow relevant logs and data boundary, and separate
product bugs from stale tests or environment failures. Preserve exact error text
without exposing secrets.

Return evidence, confirmed cause or ranked hypotheses, affected scope, and the
smallest recommended next action. Do not mutate production, implement a fix, or
deploy unless the request explicitly includes it.
