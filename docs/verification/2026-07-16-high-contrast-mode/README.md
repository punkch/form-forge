# Verification pass — high-contrast mode (2026-07-16)

Agent-browser session against the built app (`pnpm preview`, :4173). Spec:
`docs/specs/2026-07-16-1124-high-contrast-mode/`.

## Checked

- **Settings control**: Appearance gained the three-state Contrast select
  (Normal / High / Follow system) beside the scheme select; selecting High
  stamps `data-ff-contrast="high"` live (`settings-light-high.png`).
- **Light + high**: pure-white surfaces, black text, hard 1px borders
  replacing the tinted card separation, outlined accent swatches — the
  decoration-reduction decision is visible, not just ratio-boosting.
- **Dark + high** (`settings-dark-high.png`): near-black surfaces, white
  text, visible borders on cards and inputs.
- **Accent clamping**: with the purple accent under dark+high,
  `--p-primary-color` resolves to `#9ea0f6` — a lighter scale step chosen by
  the generator to clear 7:1 against the black surface; buttons/links keep
  recognizable hue in both schemes. (The drift gate now also asserts every
  clamped primary against the actual high-contrast surface.)
- **Preview re-contrast** (`editor-preview-dark-high.png`): the embedded
  web-forms preview follows the contrast dimension — black canvas, white
  text, clamped primary on Send; the uploaded choices CSV rendered its
  choice under high contrast.
- **Persistence + no-FOUC**: covered by `tests/e2e/contrast.spec.ts`
  (attribute stamped by the inline script before mount; preference survives
  reload) and the forced-colors smoke test.

## Interface-craft findings

- Noted, accepted: under dark+high the preview's question card keeps a
  slight navy tint from the web-forms surface tokens rather than dropping
  to pure black. All text/border pairs still clear the enforced floors
  (unit-tested), so this is documented as decoration survival in the user
  guide rather than fixed.
- Palette category icons keep their hue on black — non-text elements, all
  above the 3:1 non-text floor; wayfinding value kept deliberately.
