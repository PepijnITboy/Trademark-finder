# Classification schemes

Trademark class systems are **not** interchangeable.

## Schemes
- `nice_45` — International Nice Classification classes 1–45 (default for EU and most T1/T2 offices).
- `us_legacy_cert` — USPTO legacy certification codes A / B / 200 (not Nice).

## Rules
1. Class pickers load the scheme(s) of the selected register(s).
2. Multi-register scopes only share one picker when all schemes are identical (or all `nice_45`).
3. Scoring component `niceClassOverlap` runs **only** when both watched and candidate schemes are `nice_45` (or an explicit mapping). Cross-scheme pairs return 0 / incomparable — never invent Nice overlap.
4. Register catalog entries carry `classificationSchemeId` (`packages/domain`).

Domain helpers: `resolveClassPickerOptions`, `canComputeNiceClassOverlap`, `getClassificationScheme`.
