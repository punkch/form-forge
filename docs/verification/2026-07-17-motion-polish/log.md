# Verification — motion & transition polish (2026-07-17)

Manual agent-browser pass against the production build (`pnpm preview`, :4173),
Chromium via CDP. Spec: `docs/specs/2026-07-17-1632-motion-polish/`.

## Automated gates (all green before this pass)

- `pnpm lint` (eslint + stylelint incl. `value-no-unknown-custom-properties`) ✅
- `pnpm typecheck` ✅
- `pnpm test` — 137 files / 1403 tests ✅
- `pnpm test:e2e` — 120 passed, 1 skipped; the single firefox `entities.spec`
  failure re-ran green 6/6 (`--repeat-each=3`) — pre-existing worker flake,
  not motion-related. Two REAL regressions caught by the first full run were
  fixed in source (see spec `shape.md` → Delivery-phase decisions):
  `NodeList` keyed by `form.recordId`; Settings owns the `?section=central`
  scroll.

## Checks & evidence

| Check | Result | Evidence |
| --- | --- | --- |
| New Form dialog rest state after retuned pop-in (scale 1, opaque, mask) | ✅ | `01-new-form-dialog.png` |
| Canvas after 3 adds — cards at rest, no residual transform, flash completed | ✅ | `02-canvas-three-nodes.png` |
| Node delete — leave completes, card count 3→2, no ghost in DOM | ✅ | eval count |
| PropSection collapse — `grid-template-rows: 0px`, `visibility: hidden`, body stays in DOM (h≈481px inside clip), following sections flush, chevron rotated | ✅ | `03-section-collapsed.png` + computed-style eval |
| Central zero-state → `#/settings?section=central`, section scrolled in-viewport (top 405 / vh 577) | ✅ | `04-settings-central-scroll` eval |
| Palette drawer open at 1100px (slide-over + scrim) | ✅ | `05-palette-drawer-open.png` |
| Scrim close: mid-leave `pointer-events: none` + fading opacity; fully removed from DOM after ≈400ms (no wedge) | ✅ | computed-style evals |
| Tablet 900px pane cycle Canvas→Properties→Preview→Canvas via pane-fade | ✅ | `06-tablet-preview-pane.png` |
| Reduced-motion emulation: `matchMedia` true, computed `transition-duration` 1e-05s on `.node-card` AND `.editor-body`; navigation/drawers still function | ✅ | evals |
| Dark scheme — library card list (TransitionGroup ul) renders clean; no cascade accidents from `html`-prefixed PrimeVue overrides | ✅ | `07-dark-library.png` |
| Card menu → ConfirmDialog → delete: card leaves, empty state returns | ✅ | final eval (`cards: 0`) |

Not exercised here: the editor Central drawer itself (requires a configured
server; its `drawer-end` transition classes are shared with the
LibraryCentralDrawer and validated structurally by the palette drawer pass +
the green `central-drawer` component/e2e specs).

## Follow-up (same day): settings-dialog overflow under `.ff-stable-dialog`

User-reported: the Form settings dialog's ID/Version row overflowed the new
fixed frame and grew a horizontal scrollbar (font-metric dependent — 3px in
headless Chromium, a hard cut of the Version field on the reporting machine).
Root cause: the row's `flex: 1` labels were floored by the monospace inputs'
intrinsic `size`-attribute width (`min-width: auto`). Fixed with
`min-width: 0` on `.grow`; verified `scrollWidth == clientWidth` on both tabs,
including a forced 22px/size-40 font stress test (`08-settings-dialog-fixed.png`).
