# Motion polish — User guide & manual test scenarios

## What changed for the user

The app now animates the transitions that used to snap instantly. Nothing
about *what* you can do changes — only how state changes look on screen.

- **Switching views** (Library ↔ Editor ↔ Settings ↔ Full preview) crossfades
  with a small rise, instead of a hard cut.
- **Drawers slide, both ways.** The question palette, the editor's Central
  drawer, and the Form Library's Central drawer all slide open *and* slide
  shut — previously only opening was animated; closing was an instant yank.
  Their scrims fade in and out with them.
- **Canvas questions animate in and out.** Adding a question fades and rises
  into place (plus the existing "just added" highlight flash); deleting one
  fades out while the remaining questions glide into their new positions.
  Drag-to-reorder is unchanged.
- **Choice rows fade in** when you add one to a select question.
- **Library form cards animate** when the list changes (fade + rise in, fade +
  shrink out), and a card's border now transitions smoothly on hover instead
  of snapping.
- **Property-panel sections fold open and closed** smoothly instead of
  disappearing instantly; a collapsed section's controls are also no longer
  reachable by keyboard (they were only hidden visually before).
- **Dialogs, menus, and popovers pop in** with a subtle overshoot instead of
  the previous plain zoom; toasts slide up on arrival and collapse away more
  briskly when dismissed.
- **On a tablet-width screen**, switching between the Properties and Preview
  panes now cross-fades instead of cutting.

### What has NOT changed (by design)

- **Your OS's reduced-motion setting is respected everywhere.** If "Reduce
  motion" (or your platform's equivalent) is on, every animation above
  collapses to effectively instant — including routes, drawers, and library
  cards, not just the form editor. Drawers still open and close correctly
  with reduced motion on; nothing gets stuck mid-animation.
- **Drag-and-drop reordering on the canvas** behaves exactly as before — only
  the add/remove/settle motion around it is new.
- **No new visual style** — colors, spacing, and layout are unchanged; this
  pass is purely about how state changes are revealed over time.

## Manual test scenarios

Run against the dev server or the built app (`pnpm dev` or
`pnpm build && pnpm preview`), agent-browser pass logged to
`docs/verification/`.

### M1 — Route switching
1. Navigate Library → open a form (Editor) → Settings → Full preview → back to
   Library.
2. **Pass:** each switch crossfades (fade + slight rise in, fade out); no
   frame where two views are visible stacked/overlapping.

### M2 — Palette drawer, both directions
1. At a laptop/tablet width where the palette renders as a slide-over, open
   it (slide + scrim fade in) and close it (slide + scrim fade **out** —
   previously an instant yank).
2. **Pass:** both directions are animated; the scrim never blocks a click
   made right after it starts closing.

### M3 — Central drawers, both directions
1. In the editor, open and close the Central drawer.
2. On the Form Library, open and close its Central drawer.
3. **Pass:** both slide in and out; no instant yank on close.

### M4 — Canvas add/remove/reorder
1. Add a question from the palette. **Pass:** it fades/rises in; the
   "just added" highlight still flashes; sibling questions glide (not jump)
   to make room.
2. Delete a question. **Pass:** it fades out while remaining questions glide
   into place.
3. Drag a question to reorder, drag a palette item into an empty group, and
   drag a question between nested containers, and into an empty root canvas.
   **Pass:** drag-and-drop still works exactly as before in every case.

### M5 — Choice rows and library cards
1. Add and remove choice rows on a select question. **Pass:** new rows fade
   in (no leave/move animation expected — this is enter-only by design).
2. On the Form Library, hover a form card. **Pass:** the border transitions
   smoothly, not a hard snap. Duplicate/delete/import a form and watch the
   card list change. **Pass:** cards fade/rise in and fade/shrink out.

### M6 — PropSection fold
1. Collapse and expand a properties-panel section (e.g. Choices, Logic).
   **Pass:** the section folds smoothly with no padding jump; while
   collapsed, try Tab-ing into it — its controls must not be reachable.

### M7 — Overlays
1. Open the New Form dialog, a Select dropdown, a context menu, and trigger a
   toast (e.g. autosave or an error). **Pass:** the dialog pops in with a
   slight overshoot; toasts slide up on arrival and collapse away briskly on
   dismiss/timeout; none of this feels slower than before.

### M8 — Tablet pane swap
1. At a tablet width (~900px), switch between the Properties and Preview
   panes for a selected question. **Pass:** cross-fades, no hard cut.

### M9 — Reduced motion (OS-level or CDP emulation)
1. Enable "reduce motion" (OS setting, or `prefers-reduced-motion: reduce` via
   devtools/CDP emulation).
2. Repeat M1–M8. **Pass:** every transition is effectively instant on **every**
   route (not just the editor); drawers still open and close correctly with
   no element stuck mid-animation.

### M10 — Dark mode / high contrast spot-check
1. Switch to dark theme and to high-contrast mode; open one dialog and one
   drawer in each. **Pass:** no cascade accidents — the retuned transitions
   look and behave the same as in light/normal mode.
