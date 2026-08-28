---
id: 2026-08-28-maestro-stable-login-readiness
date: 2026-08-28
status: promoted
scope: native Auth-shell acceptance flows
evidence: iOS simulator login-shell acceptance on current main
destination: e2e/maestro
review_after: 2027-02-28
---

## Symptom

The credential-free native smoke failed even though the current app reached the
login screen and displayed its required controls.

## Reproduction

Run `e2e/maestro/login-screen-smoke.yaml` against current main. The flow waited
for the retired tagline `Explore intimacy together`; the app displayed updated
marketing copy while `Sauci` and `Password` were present.

## Cause

Login readiness was coupled to mutable marketing copy rather than a stable
required control.

## Remediation

Wait for the password control that defines login readiness, while retaining the
brand and password assertions. Apply the same readiness condition to the
authenticated and credential-free flows.

## Evidence

Simulator read-back confirmed the current login shell exposes `Sauci` and
`Password`. The maintained Maestro flows now wait for that stable control rather
than the tagline.
