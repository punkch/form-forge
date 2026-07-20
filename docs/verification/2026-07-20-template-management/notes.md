# Template management — manual verification pass

**Date:** 2026-07-20
**Spec:** `docs/specs/2026-07-20-1305-template-management/`
**Build:** dev server (`pnpm dev --port 5199`), Chromium via agent-browser
**Automated gates at time of pass:** `pnpm typecheck` clean · `pnpm test` 1456/1456 · `pnpm lint` clean

## Why a manual pass was required

The feature stacks a `ConfirmDialog` and a rename `Dialog` **on top of the already-modal
New form dialog**. Overlay z-order, focus, Escape routing and theme contrast are all
invisible to vue-tsc, eslint, stylelint and happy-dom (no layout engine), so the plan
made a browser pass a required gate. It found one real bug — see below.

## Results

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Bundled starter cards after the `<button>` → `div + inner button + icon Button` restructure | ✅ Visually unchanged; hide (eye-slash) icon top-right of each card — `01` |
| 2 | Hide a starter | ✅ Leaves the grid; "Hidden starters (1)" disclosure appears — `02` |
| 3 | Unhide | ✅ Returns to the grid; disclosure disappears when empty |
| 4 | Hide two → **Restore all** | ✅ Counter reads "Hidden starters (2)"; all four starters restored |
| 5 | Delete a saved template — dialog stacking | ✅ ConfirmDialog renders above the gallery, fully opaque, own dimming mask, danger-red Delete — `03` |
| 6 | Delete — **Cancel** button | ✅ Closes only the confirm; template survives; gallery stays open |
| 7 | Delete — **accept** | ✅ Template deleted; gallery stays open |
| 8 | Rename dialog stacking + persistence | ✅ Stacks correctly, prefilled; title, description and both action aria-labels update — `04` |
| 9 | Save under an existing template name | ✅ Amber "already exists" warning + Cancel / Save a copy / Replace, inline — no modal-over-modal — `05` |
| 10 | Dark theme — gallery, disclosure, confirm | ✅ All new surfaces legible; icons, separator and Local tag readable — `06`, `07`, `08` |

## Bug found and fixed during the pass

**One Escape keypress collapsed two levels.** With the delete confirmation (or the rename
dialog) open, pressing Esc dismissed the overlay **and** the New form gallery underneath
it, dumping the user back to the library. Both dialogs receive the same `keydown`, so each
acted on it.

The template was never wrongly deleted — the destructive path stayed correctly gated — but
this contradicts the app's established convention, recorded in CLAUDE.md for the
Attachments dialog: *"Esc backs out one level."*

**Fix:** `NewFormDialog` now tracks `nestedOverlayOpen` (the rename dialog's visibility ref
plus a `confirmOpen` flag set around `confirm.require`, cleared in its `onHide` — the global
ConfirmDialog exposes no visibility model to bind). The gallery binds
`:close-on-escape="!nestedOverlayOpen"`, parking its own Esc handling while an overlay is
on top.

Re-verified after the fix:

- Esc with the confirm open → only the confirm closes; gallery open; template intact ✅
- Esc with the rename dialog open → only the rename closes; gallery open ✅
- Esc with **no** overlay open → gallery closes as before (no regression) ✅

Guarded by `tests/component/new-form-dialog.spec.ts` →
*"parks its own Esc handling while a nested overlay is open"*, which asserts the gallery
Dialog's `closeOnEscape` flips to `false` while an overlay is open and back to `true` after
it closes.

## Second pass — after the code review

The `/code-review` lenses and a `/interface-craft` critique ran after the pass above;
both produced changes that altered rendered UI, so the affected surfaces were re-verified.

| # | Scenario | Result |
| --- | --- | --- |
| 11 | Collision prompt after switching to the shared `ImportCollisionPanel` | ✅ Renders correctly: separator, message, right-aligned Save-a-copy / Replace in the body, Cancel alone in the footer — matching the app's two other collision hosts — `09` |
| 12 | Hidden-starters disclosure **collapsed** (new default) | ✅ One compact row: chevron + "Hidden starters (N)", Restore all still reachable without expanding — `10` |
| 13 | Disclosure **expanded** | ✅ Chevron flips, hidden starters list with per-row unhide — `11` |
| 14 | `hiddenBundledTemplates` persists across a reload | ✅ Confirmed incidentally: a starter hidden in the earlier pass was still hidden after a full page reload |

**UX change made as a result of the critique.** The hidden-starters list was originally
always expanded, so hiding three starters produced a cleaner grid *plus* a permanent
three-row list underneath — roughly cancelling out the decluttering the feature exists to
provide. It is now a real disclosure, collapsed by default (`aria-expanded`, chevron),
reset on every dialog open. "Restore all" deliberately stays in the header so recovery
never requires expanding first.

**Deliberate visual change, not a regression.** Moving to the shared collision panel drops
the amber tint the bespoke "already exists" line had. Kept: the danger-red **Replace**
button is the salience carrier, and amber text *plus* a red destructive button was double
emphasis. A neutral explanation with a red destructive action is the better hierarchy and
matches the other two collision prompts.

## Non-defects (checked and dismissed)

- **Translucent confirm panel.** An early screenshot showed the underlying cards bleeding
  through the confirm dialog. This was a mid-animation frame — `wait --text` returns the
  instant the text appears, before the enter transition settles. Re-shot after settling:
  fully opaque (`03`). Not a defect.
- Two `agent-browser` "element is covered" click failures were automation scroll-position
  artifacts (target under the dialog header), not product behaviour; the same clicks
  succeeded after `scrollintoview`.
