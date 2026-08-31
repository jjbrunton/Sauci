# Mobile application

Expo React Native with Expo Router, Zustand, Supabase, RevenueCat, Firebase, and
native iOS/Android targets.

- Read `DESIGN.md` before UI changes.
- Routes belong under `app`; feature logic belongs under `src/features`.
- Reuse existing Zustand stores and clear user-scoped state during sign-out.
- Check RevenueCat availability before native purchase operations.
- Use `.maybeSingle()` when zero rows are valid and handle nullable profiles.
- Keep route files thin; extract focused components/hooks when responsibilities
  diverge rather than enforcing a mechanical line limit.
- Add stable accessibility labels or `testID` values for critical interactions.
- Verify focused Jest tests, typecheck, lint, then native/Expo behavior as risk
  requires. UI work needs observable simulator evidence.
- Before and after any `expo prebuild`, follow the "After native regeneration"
  checklist in `docs/releasing.md`.
