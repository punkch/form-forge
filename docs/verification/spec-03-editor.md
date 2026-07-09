# Spec 03 verification checklist (agent-browser)

Run `pnpm dev`, open a form in the editor at 1280×800.

- [x] Palette shows all 8 categories / 36 types with icons; search box present.
- [x] Clicking a palette item adds the question to the canvas and selects it.
- [x] Property panel: Basic (label/name/hint/default/required/read-only), Appearance,
      parameters (randomize/seed for selects), Choices editor, Logic (relevant/constraint/calculation).
- [x] Label edits reflect immediately on the canvas card.
- [x] Keyboard: with a card focused, Alt+→ indents into the preceding group,
      Alt+← outdents, Alt+↑/↓ reorder — including chained sequences
      (focus is restored after cross-list remounts — bug found & fixed here).
- [x] Pointer drag: palette item → canvas creates a question; dragging a card
      into a group's children zone nests it.
- [x] Delete key / trash button remove a node; Ctrl+Z restores it; Ctrl+Y redoes.
- [x] Duplicate names show inline error on the Name field, and the Problems
      popover lists both; clicking an entry selects the offending node;
      fixing the name empties the popover ("No problems found").
- [x] Choices editor: add/remove choices; count badge on the card updates.
- [x] Structure persists across full page reload.
- [x] Page never scrolls as a whole; palette/canvas/properties scroll
      internally (bug found & fixed here: #app is now viewport-locked).
- [x] Console free of errors.

**Verified 2026-07-09** with agent-browser (Chrome 150). Screenshot:
`screenshots/spec03-editor.png`.

## Bugs found & fixed during verification

1. **Keyboard move focus loss** — after Alt+arrow moves that remount the card
   (cross-list), focus fell to `<body>` and further shortcuts were dead.
   Fixed in `TreeNodeCard.vue` by re-focusing `[data-node-id]` on nextTick.
2. **Whole-page scroll** — `#app` had auto height, so long palettes/panels
   grew the page instead of scrolling internally. Fixed by viewport-locking
   `#app` (height 100dvh, overflow hidden) and giving the library view its
   own scroll.
