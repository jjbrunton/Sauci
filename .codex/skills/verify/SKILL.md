---
name: verify
description: Prove a completed Sauci engineering task works before a PR. Use when asked to verify, prove behavior, or open a PR with runtime evidence.
---

# Verify Sauci work

Run locally on a non-default branch with the implementation committed. Use an
independent verifier for user-facing, cross-boundary, or high-risk runtime
changes. Documentation, mechanical configuration, isolated tests, and low-risk
package-local changes may use focused deterministic checks without a verifier.

1. Package-local deterministic checks do not need a running stack. For runtime
   verification, reuse a compatible running local stack when available; otherwise
   start the documented full stack with `scripts/dev-local.sh up`. Reset fixtures
   first when the task changes durable state. Web is `http://127.0.0.1:3000`,
   admin is `http://127.0.0.1:3001`, and MCP health is
   `http://127.0.0.1:3002/health`.
2. When independent runtime verification is required, give a fresh read-only
   verifier the acceptance criteria. It drives browser
   surfaces with the repository browser capability, native surfaces with Maestro
   or the iOS simulator skill, and APIs with `curl`. Authentication fixtures are
   described by `e2e/.auth/fixtures.json` after `dev-local.sh reset`.
3. The verifier writes screenshots, traces, video, or response evidence under
   `evidence/` and returns only expected, observed, evidence paths, and
   `works|broken`. It never edits code.
4. If independent verification is broken, fix and use a fresh verifier. Stop
   after three failed rounds and report the unresolved evidence.
5. Run focused checks for the affected change. Run affected E2E when the runtime
   path requires it. Run `npm run verify:full` when its prerequisites are
   available; it already runs `npm run verify:fast`, so do not run both in
   sequence. Never weaken an assertion just to pass.
6. Open a PR only after both task verification and regression checks pass. Upload
   evidence to the established CI artifact or `pr-evidence` prerelease and embed
   the screenshot plus a video/trace link in the PR body.

A green test suite without an independently observed outcome is incomplete when
independent runtime verification is required.
