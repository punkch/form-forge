# Verification pass — editor toolbar de-clutter (2026-07-16)

Agent-browser session against the built app (`pnpm preview`, :4173), plus an
interface-craft critique over the captured states. Spec:
`docs/specs/2026-07-16-1122-editor-toolbar-declutter/`.

## Checked

- **Wide 1440×900, no Central server** (`wide-1440-no-central.png`,
  `wide-1440-form-menu-open.png`): Form menu sits left of the title and opens
  all four items (Form settings / Translations / Choice lists / Attachments —
  each verified to open its dialog); clusters read left→right as
  history · view · status · output · meta with hairline separators; the
  Problems chip carries its new chevron; the zero-state Central button
  renders with the add-server tooltip. The ⋮ kebab is gone.
- **Laptop 1100×800** (`laptop-1100.png`): header intact, title truncates
  before any control compresses.
- **Tablet 900×800** (`tablet-900.png` → `tablet-900-final.png`): the first
  pass found three real squeezes — the Form button collapsed to "rm", the
  back button to a 2px sliver, and the save text overlapped undo/redo. Fixed
  (commit `fix(editor): keep header controls rigid at narrow widths`): the
  title is now the only shrinkable left-side element; at ≤1024px the save
  indicator drops to icon-only (text preserved for assistive tech) and the
  Central toggle drops its label. Re-measured: left 307px + right 548px
  inside 900px, no overlap; EditorTabs row unaffected.
- **Zero-state Central routing**: click lands on `#/settings` with the
  Central-servers section scrolled into view (also pinned by the new e2e
  case in `tests/e2e/editor.spec.ts`).

## Interface-craft findings

- **Fixed:** the re-glyphed palette toggle used `pi-palette` (a paint
  palette) — the most theme-associated glyph available, three buttons from
  where the theme toggle lived until this change. Swapped to `pi-th-large`
  (component grid), which reads as "panel of building blocks"
  (`wide-1440-final-dark-high.png`).
- No other findings; cluster separators, chevron affordance and zero-state
  idiom judged consistent with the app's existing visual language.
