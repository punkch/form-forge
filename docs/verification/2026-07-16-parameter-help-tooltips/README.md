# Verification pass — parameter help popovers (2026-07-16)

Agent-browser session against the built app (`pnpm preview`, :4173). Spec:
`docs/specs/2026-07-16-1121-parameter-help-tooltips/`.

## Checked

- **Parameter-specific popovers** (`randomize-popover.png`): the Seed
  parameter's "?" opens its own popover — registry description ("Seed for
  consistent randomization"), the XLSForm mapping line ("XLSForm column
  parameters · key seed") and the space-separated key=value syntax hint.
  No trace of the retired generic parameters copy.
- **Unique testids**: the properties panel exposes
  `field-help-param-randomize`, `field-help-param-seed`,
  `field-help-param-value`, `field-help-param-label` alongside the existing
  field ids — the duplicate `field-help-parameters` id is gone (verified by
  enumerating `[data-testid^=field-help]` in the live DOM).
- Options lists (audit `location-priority`), explicit `Default: false` for
  booleans, and the Required marker (range `start`) are pinned by the
  component specs (`tests/component/property-panel.spec.ts`).

## Interface-craft findings

None actionable. The two adjacent "?" affordances near "Choices file"
(field-help popover + the pre-existing guide trigger) predate this feature
and follow the established help-entry idiom.
