---
name: question-pack
description: Create or review Sauci question-pack content and its local migration/seed representation. Use for pack generation, inverse pairs, intensity, targeting, or content quality.
---

# Sauci question packs

Inspect existing packs before generating to avoid duplication.

- Write proposals, not interview questions; use gender-neutral “your partner”.
- Avoid time-bound words such as tonight, now, or today.
- Symmetric activities have no partner text.
- Every asymmetric activity has the reversed counterpart and a correct
  `inverse_of` link; inverse pairs are not duplicates.
- Intensity 1 is non-sexual bonding, 2 romantic/flirty, 3 light sexual, 4
  explicit, and 5 advanced/BDSM. Check surrounding content before deciding.
- Preserve targeting and required-prop semantics; do not infer them from wording.

Return metadata, content, inverse/link validation, and distribution statistics.
Database changes follow the `db-migration` skill and require local verification.
