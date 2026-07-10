# Verification — UI critique fixes (2026-07-10)

Manual agent-browser pass against the production build (`pnpm build` +
`pnpm preview`, chromium 1440×900 unless noted), after all automated gates
passed. Spec: `docs/specs/2026-07-10-1810-ui-critique-fixes/`.

## Automated gates

- `pnpm lint` — clean
- `pnpm typecheck` — clean
- `pnpm test` — 81 files / 723 tests, all pass
- `pnpm test:coverage` — floors met (core 86/78/88, stores 80/85,
  persistence 90/92)
- `pnpm test:e2e` — 66 passed, 1 pre-existing skip; one firefox
  `translations.spec.ts` failure was flaky (add-language timing) and passed
  on isolated re-run; unrelated to this change set
- `tests/e2e/logic-builder.spec.ts` updated for the new nearest-preceding
  condition default (explicit field pick added)

## Findings verified in-app

| # | Finding | Evidence | Result |
|---|---|---|---|
| 1a | Notes excluded from condition operands | `v05-operand-list.webp` — dropdown lists only answerable fields, intro note absent | ✅ |
| 1b | New relevance condition defaults to nearest preceding question | `v03-condition-default.webp` — village's condition seeds with "Region (region)", not the intro note | ✅ |
| 1c | Empty comparison value raises a warning | `v03`/`v04` — header shows ⚠ 1 immediately; popover message names the field | ✅ |
| 2 | Problems entries carry location chips; duplicates grouped | `v04`, `v06-problems-grouped.webp` — duplicate-name error is one row with "Region" + "Village or neighbourhood" chips | ✅ |
| 3 | Question labels wrap to two lines | `v02-editor-ready-labels.webp` — long intro note wraps, no ellipsis | ✅ |
| 4 | Logic badges labeled | `v02`/`v03` — "constraint" and "logic" text pills on cards | ✅ |
| 5 | Preview/Export labeled at every width; panel glyph | `v10-laptop-labels.webp` (1150 px) — both labeled; palette toggle no longer a hamburger | ✅ |
| 6 | Blocked-screen icon | `v11-blocked-icon.webp` (700 px) — desktop monitor icon | ✅ |
| 7 | Version formatted + deemphasized | `v08-library-cards.webp` — "v2026-07-10.1837" muted | ✅ |
| 8 | New-form Create hint | `v01-newform-hint.webp` — hint under the title input while empty | ✅ |
| 9 | Unified help drawer | `v09-help-drawer-list.webp` — header Help opens the drawer in searchable list mode; reference modal removed | ✅ |
| 10 | Library card redesign | `v08` — question-count chip, EN·FR badge, emphasized "Edited …" | ✅ |
| 11 | Ready state + export readiness summary | `v02` (green "Ready" button), `v07-export-summary.webp` ("Ready · 1 warning" atop the export menu) | ✅ |
| 12 | Upstream web-forms issue | drafted in the spec folder (`upstream-issue-web-forms.md`) — documentation only | ✅ |

## Notes

- The seeded empty condition intentionally raises the new warning until the
  author picks a value — verified this reads as a nudge, not an error (form
  still previews/exports; warning clears when a value is chosen or the
  condition is removed).
- The issues count badge shows total issues while grouped rows may be
  fewer — acceptable; the count still communicates severity via color.
