# Export format memory — manual verification (agent-browser)

Date: 2026-07-20 · Build: `pnpm build` (post-implementation), preview on :4173
Spec: `docs/specs/2026-07-20-1433-export-format-memory/`

## Checks

| # | Check | Result |
| --- | --- | --- |
| 1 | Primary button states its format ("Export · XForm" by default) | ✅ (`01-dropdown-default-light.png`) |
| 2 | Dropdown lists ALL four formats + readiness line, active item marked `pi-check` | ✅ (`01`, `05`) |
| 3 | Picking XLSForm from dropdown runs the export AND relabels the primary | ✅ (`02-primary-relabels-xlsform.png`) |
| 4 | Memory persists across full page reload (form A → still "Export · XLSForm") | ✅ |
| 5 | Per-form isolation: new form B defaults to "Export · XForm" while A remembers XLSForm | ✅ |
| 6 | Longest label "Export · ZIP (XLSForm)"; primary icon follows format (box for ZIP) | ✅ (`03-zip-xlsform-label.png`) |
| 7 | French locale at 1100 px viewport: "Exporter · ZIP (XLSForm)" fits, compact-header rules hold, no overflow | ✅ (`04-fr-header-1100.png`) — no `builder.css` extension needed |
| 8 | Dark theme: dropdown + check marker + primary render correctly | ✅ (`05-dropdown-dark-remembered.png`) |

## Notes

- The spec's flagged risk (fr/es primary label overflowing the editor header) did
  not materialize — the existing `html[lang]`-scoped compact rules absorb it.
- Label crossfade is covered by the component spec (animation class retrigger);
  not visually assertable in stills.
- Automated gates at this point: `pnpm typecheck` ✅, `pnpm lint` ✅,
  `pnpm test` 1475/1475 ✅, `pnpm test:e2e import-export translations` 20/20 ✅.
