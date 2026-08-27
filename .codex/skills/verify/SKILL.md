---
name: verify
description: Prove a completed Sauci engineering task works before a PR. Use when asked to verify, prove behavior, or open a PR with runtime evidence.
---

# Verify Sauci work

Run locally on a non-default branch with the implementation committed.

1. Start the stack once with `scripts/dev-local.sh up`; reset fixtures first when
   the task changes durable state. Web is `http://127.0.0.1:3000`, admin is
   `http://127.0.0.1:3001`, and MCP health is `http://127.0.0.1:3002/health`.
2. Give a fresh read-only verifier the acceptance criteria. It drives browser
   surfaces with the repository browser capability, native surfaces with Maestro
   or the iOS simulator skill, and APIs with `curl`. Authentication fixtures are
   described by `e2e/.auth/fixtures.json` after `dev-local.sh reset`.
3. The verifier writes screenshots, traces, video, or response evidence under
   `evidence/` and returns only expected, observed, evidence paths, and
   `works|broken`. It never edits code.
4. If broken, fix and use a fresh verifier. Stop after three failed rounds and
   report the unresolved evidence.
5. After the task works, run `npm run verify:fast`, affected E2E, and
   `npm run verify:full` when local Supabase/Deno are available. Never weaken an
   assertion just to pass.
6. Open a PR only after both task verification and regression checks pass. Upload
   evidence to the established CI artifact or `pr-evidence` prerelease and embed
   the screenshot plus a video/trace link in the PR body.

A green test suite without an independently observed task outcome is incomplete.
