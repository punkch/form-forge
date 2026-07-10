# Verification — Canvas card footer actions (2026-07-10)

Manual agent-browser pass against `pnpm dev` (chromium 1280×~580), after
all automated gates passed.
Spec: `docs/specs/2026-07-10-2342-canvas-card-footer-actions/`.

## Automated gates

- `pnpm lint` — clean
- `pnpm typecheck` — clean
- `pnpm test` — 94 files / 845 tests, all pass (includes the new
  footer-structure pin and duplicate/delete click tests in
  `tree-node-card.spec.ts`)
- `pnpm test:e2e` — 85 passed, 1 pre-existing skip
- all gates re-run green after the code-review fixes (hover-reveal
  utility extraction, redundant CSS removal)

## Environment note

The automation browser reports `(hover: none)`, so the touch fallback
(actions always visible) is what screenshots of untouched cards show —
itself a verification of scenario 7. Hover-capable behavior was verified
by injecting a lower-specificity override reproducing the non-hovered
base state (it loses to the component's reveal rules exactly like the
real base rule), then measuring with real mouse hover and real Tab
keypresses.

## Scenarios verified

| # | Scenario | Evidence | Result |
|---|---|---|---|
| 1 | Long title wraps fully, no ellipsis; chip anchors to first line | `card-footer-long-title-wrap.png` — 3-line (Id10009) verbal-autopsy question fully visible | ✅ |
| 2 | Zero layout shift on hover | Measured `getBoundingClientRect` hidden vs hovered: card 760×75 and label 690×27 byte-identical; only opacity/visibility changed | ✅ |
| 3 | Footer layout: type · name left; badges + actions right-aligned | `card-footer-canvas-initial.png`, `card-footer-hover-state.png` | ✅ |
| 4 | Crowded footer degrades gracefully | Card constrained to 360px: actions stay on-card, footer stays one 24px line, badge text `text-overflow: ellipsis` clips | ✅ |
| 5 | Keyboard: card focus reveals actions; Tab reaches Duplicate then Delete | Real Tab keypress lands on `aria-label="Duplicate"`, row `:focus-within` holds reveal. **Note:** with the initial `visibility: hidden` approach real Tab dumped focus on `<body>` (browser focus-fixup race — the old `display: none` code had the same break); switched to opacity + `pointer-events`, which fixes the path | ✅ |
| 6 | Container cards: chevron + chip + title share the first line; row-scoped hover no longer lights up descendants' actions | `card-footer-container-chevron.png` | ✅ |
| 7 | Touch (`hover: none`): actions always visible | Environment-native; `card-footer-canvas-initial.png` | ✅ |
| 8 | Buttons functional from the footer | Hover + click Duplicate: 14 → 15 cards (`region_2`); its Delete button removes it: back to 14 | ✅ |
| 9 | Reduced motion | Code-inspected: `@media (prefers-reduced-motion: reduce)` zeroes both transitions (media emulation unavailable in this harness) | ✅ (static) |

## Screenshots

- `card-footer-canvas-initial.png` — household template canvas after restructure
- `card-footer-long-title-wrap.png` — the user's reported scenario, fixed
- `card-footer-hover-state.png` — hovered card, actions revealed, geometry unchanged
- `card-footer-container-chevron.png` — repeat container + children alignment
