---
name: mobile-simulator
description: Build, launch, and verify Sauci on iOS or Android simulators with local backend wiring and captured evidence. Use for native UI, navigation, permissions, or device behavior.
---

# Mobile simulator verification

Read `apps/mobile/AGENTS.md` and `apps/mobile/DESIGN.md` for UI work.

1. Start/reset the local stack through the `dev-local` skill.
2. Use `scripts/dev-local.sh ios` or `android`; do not embed remote credentials.
3. Drive stable accessibility labels/test IDs. Use `maestro test e2e/maestro` for
   committed flows and platform simulator tools for focused exploration.
4. Capture the final visible state and relevant Metro/native logs under
   `evidence/`.
5. Report device/runtime, steps, expected versus observed, and artifact paths.

Do not claim a native result from Expo web or component tests alone.
