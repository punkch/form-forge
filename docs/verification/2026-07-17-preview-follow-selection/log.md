# Verification — preview follows canvas selection (2026-07-17)

Spec: `docs/specs/2026-07-17-1758-preview-follow-selection/`
Environment: dev server (`pnpm dev`, :5173), agent-browser (Chromium CDP),
Household survey starter template ("Follow selection check", 13 rendered
questions, preview scrollHeight ~3080px vs ~980px viewport).

## Automated gates

- `pnpm test` — 138 files / 1423 tests pass (includes the 20 new
  `followSelection.spec.ts` unit tests).
- `pnpm test:e2e preview editor` — 18 pass, chromium + firefox (includes the
  new `preview-follow-selection.spec.ts` on both browsers).
- `pnpm lint` / `pnpm typecheck` / `pnpm build` — clean.

## Manual scenarios (measured via DOM eval, not just eyeballed)

1. **Select a far-down question** (`Comments`, last of 13): preview scrolled
   0 → 2094, target container fully inside the `.preview-host` viewport,
   roughly centered; `ff-follow-flash` class present on exactly that
   container immediately after the click. `01-editor-initial.png`,
   `02-select-flash-light.png` (landed state, light).
2. **Follow through remounts**: selected `water_source` (scroll 1696), then
   edited its label ("… (updated)") in the properties panel. After the
   debounced regen + full child-app remount, the preview re-scrolled to the
   renamed question (`inViewport: true`, scrollTop 1704) with **no** flash —
   previously every edit reset the pane to the top. `03-follow-through-remount.png`.
3. **Group/repeat selection**: selecting the `household_member` repeat
   centered its first renderable child ("Member name").
4. **Duplicate labels**: renamed `region`'s label to "Sex", duplicating the
   member `Sex` question (rendered indexes 2 and 9). Selecting
   `member_sex` flashed index 9; selecting `region` flashed index 2 —
   positional alignment resolves twins correctly.
5. **Reduced motion** (CDP `prefers-reduced-motion: reduce`): scroll lands
   instantly (`behavior: 'auto'` path) and the flash class is cleaned up
   immediately (global 0.01ms animation blanket → instant `animationend`).
6. **Dark mode** (CDP `prefers-color-scheme: dark`): initial implementation
   flashed opaque near-white (`--p-primary-50` resolves to a light-scale
   value in every theme — the dark CSS never remaps the raw primary scale).
   **Fixed during this pass**: both the new preview flash and the
   pre-existing canvas "just added" flash now use the builder-dark.css idiom
   `color-mix(in srgb, var(--p-primary-500) 16%, transparent)` (ring at
   40%), which is translucent, scheme-proof and accent-aware. Re-verified:
   dark flash computes to a ~16%-alpha accent tint; scroll lands correctly.
   `05-dark-mode-landed.png`.

## Post-code-review addendum

The five-lens `/code-review` pass produced fixes applied after the scenarios
above (see shape.md "Delivery-phase decisions"): dynamic-hint wildcard rule
revised, target-anchored alignment replacing the greedy LCS backtrack,
`animationend` listener dropped (it bubbles), flash tint hoisted to
`--builder-flash-*` tokens, `PreviewPanel.follow` reordered behind the
`hostRef` bail, +4 unit tests. Re-ran after fixes: `pnpm test` 1427 pass,
`pnpm test:e2e preview editor` 18 pass (both browsers), lint + typecheck
clean, and the live flash re-verified as the token-driven translucent tint.

## Notes

- Flash screenshots race the 900ms animation; class-presence and computed
  background-color were asserted via eval instead, screenshots document the
  landed states.
- Model-only-type selection (calculate → no scroll) is covered by unit
  tests; not exercised manually (template has no calculate field).
