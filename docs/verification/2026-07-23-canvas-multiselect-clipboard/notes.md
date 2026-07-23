# Manual verification — canvas multi-select, clipboard, toolbar, insert-from-template

Date: 2026-07-23 · Build: vite production build served via `pnpm preview` on :4173 ·
Driver: agent-browser (CDP) · Spec: `docs/specs/2026-07-23-1242-canvas-multiselect-clipboard/`

## Automated gates (all green before this pass)

- `pnpm typecheck` 0 errors · `pnpm lint` clean (eslint + stylelint) ·
  `pnpm test` 147 files / 1652 tests · `pnpm test:coverage` floors met ·
  `pnpm test:e2e` 133 passed / 1 (pre-existing) skipped, chromium + firefox, exit 0.
- One regression was caught by the existing e2e specs during delivery and fixed:
  the global Escape-clears-selection handler raced PrimeVue's own overlay Escape handling
  (overlays close on the same keydown before the window-level handler runs) and wiped the
  selection when closing the problems popover / attachments dialog. Selection shortcuts are now
  scoped to `.canvas-panel`/`body` events, and Escape additionally requires no PrimeVue overlay
  in the DOM. Recorded in the spec plan (Task 9, delivery refinement).

## Scenarios exercised

| # | Scenario | Result | Screenshot |
|---|---|---|---|
| 1 | Toolbar renders as panel header; undo/redo relocated; disabled states (paste w/ empty buffer); "1 selected" chip; multiSelect callout at canvas top; header shows plain title | ✅ | 01-light-canvas-toolbar-callout.png |
| 2 | Ctrl+Click toggles a second card in; both cards outlined; "2 selected ×" chip w/ clear; properties panel follows anchor | ✅ | 02-light-multiselect-chip.png |
| 3 | Gear opens the whole form menu: 4 relocated items + separator + "Insert from template…" | ✅ | 03-light-gear-form-menu.png |
| 4 | Insert-from-template dialog: header, hint, 2×2 starter grid | ✅ | 04-light-insert-template-dialog.png |
| 5 | Insert appends 10 questions, selects all ("10 selected"), reveals + anchors the first; ONE Ctrl+Z removes all 10 (card count 13 → 3) | ✅ | 05-light-inserted-template-selected.png |
| 6 | Dark theme: toolbar/chip/callout/selection outline all adapt | ✅ | 06-dark-multiselect-toolbar.png |
| 7 | French locale: callout fully translated (Ctrl+Clic/Maj+Clic/Suppr), palette + chrome in FR | ✅ | 07-fr-editor-toolbar-callout.png |
| 8 | FR canvas guide opens from the callout's "?" trigger, steps translated | ✅ | 08-fr-canvas-guide.png |
| 9 | Cross-tab paste: copy in tab 1 → paste button enables in tab 2 (storage event) → paste lands the card (3 → 4) | ✅ | 09-fr-crosstab-paste.png |

Selection pruning after undo observed working (undo of the insert emptied the selection set,
chip disappeared). Multi-drag gather-on-drop was not driven here (CDP drag simulation is
unreliable); it is pinned by the store-level drag-transaction unit test
(begin → splice + gatherNodesAfter → end = one undo entry) and the e2e Alt+Arrow multi-move.

## Findings (carried into the post-review fix batch)

1. **Insert-from-template silently drops non-primary template languages** —
   `InsertTemplateDialog` discards `MergeResult.droppedLanguages` / `attachmentFilenames` /
   `strippedSaveTo`, so inserting a bilingual starter into a monolingual form loses the French
   text with no signal, where the equivalent paste raises the informational toast. Fix: surface
   the same `canvas.pasteToast.*` toast from the dialog's merge result.

## Interface-craft critique + five-lens code review — outcome

All fixes verified by re-running the gates (lint, typecheck, full vitest, coverage, e2e).

**Applied:**
- Insert-from-template now raises the shared merge-degradation toast (finding #1 above) via a
  shared `revealMergeResult` on `useSelectionActions` (also unifies the post-paste reveal).
- Selection chip restored to spec: visible only when >1 selected (single selection already
  reads via the card highlight + properties panel).
- BLOCKER (introduced during the fix batch itself, caught by two review lenses):
  `notifyMergeOutcome` missing from the `SelectionActions` interface broke `pnpm typecheck`
  (vitest transpiles without type-checking, so tests stayed green). Fixed.
- Per-keystroke render cascade: `pruneSelection` no longer reassigns the selection Set when
  nothing was pruned, and the `form.revision` watcher skips the full-doc flatten when the
  selection is empty — previously every property-panel keystroke re-rendered every card.
- `parseNodesPayload` now validates element shape (recursive node guard, choice-list/choices/
  languages/filenames entries) — a tagged-but-mangled external payload is rejected at parse
  instead of throwing inside `mutate()` after the undo push.
- `droppedLanguages` now intersects with the languages the copied content actually carries —
  no more false "translations dropped" toast for a declared-but-unused source language.
- `InsertTemplateDialog` gained a re-entrancy latch (double-click inserted twice before).
- Reuse: `resolvePrimaryLang(languages, preferred?)` extracted (display.ts) — `primaryLang` and
  the merge's payload-primary both delegate; the selection-relative insertion rule is now owned
  solely by `useSelectionActions.insertionTarget()` (paste AND `addFromPalette`);
  TreeNodeCard's two DOM enumerations share one `visibleCards()` helper.
- Tests added: `src/clipboard/system.spec.ts`, payload mangled-element rejection, merge
  declared-but-unused-language case, dialog double-click latch, e2e Ctrl+A/Escape scenario.

## User-review follow-up (2026-07-23, pre-commit)

Two items from the user's review of the working tree, both applied and re-gated:

1. **Shortcut keys in tooltips, everywhere an action has an affordance** — undo/redo tooltips
   now carry the shortcut ("Undo ({mod}+Z)" / "Undo: {label} ({mod}+Z)" / "Redo ({mod}+Y)"),
   the selection-chip × gained a "Clear selection (Esc)" tooltip, and the node-card
   duplicate/delete buttons gained tooltips (delete = locale-appropriate "Delete (Del)" /
   "Supprimer (Suppr)" / "Eliminar (Supr)"). The platform sniff moved from CanvasToolbar into a
   shared `src/shortcuts.ts` (`shortcutMod()`), used by both toolbar components. Shortcuts with
   NO button affordance (Ctrl+A, Ctrl+S, Alt+Arrows) have no tooltip site — they stay
   documented in the keyboard/canvas guides. aria-labels stay plain (shortcut only in the
   hover tooltip), keys mirrored ×3 locales.
2. **multiSelect callout now teaches multi-drag** — body extended with "Drag any selected card —
   or press Alt+Arrows — and the whole selection moves together, groups included." ×3 locales.

Verified in-browser (screenshot 10-tooltips-shortcuts-callout.png): undo tooltip with label +
shortcut, redo "(Ctrl+Y)", card delete "(Del)", extended callout text.

## User-review follow-up #2 (2026-07-23, pre-commit): dormant translations

User decision revising the merge's language policy: unmatched non-primary source languages are
NO LONGER dropped on paste/insert-from-template. Their text stays **dormant in place** under
the source language key — invisible (grid, XForm serializer and validators iterate declared
languages only; the XLSForm writer now explicitly filters undeclared keys so exports never
implicitly declare a language) — and `addLanguage` runs a new `adoptDormantTranslations` pass
using the same shared `matchLanguage` (exact / code / name-part) helper the merge uses, so
declaring "French (fr)" later surfaces text pasted as "Français (fr)". On a first-language
add, adoption runs before the sentinel move; a differing sentinel value survives as the
established Unassigned-column conflict. Sentinel debris from mixed-shape sources is still
dropped (two-clean-shapes). `MergeResult.droppedLanguages` → `dormantLanguages`; toast copy
now says the translations came along and points at Form menu → Translations (×3 locales);
canvas guide step 3 updated to match (×3). Also from this review round: README "Planned"
section removed (multi-select delivered; more UI languages only on request) along with its
link to the deleted backlog file, and the stale header-menu description fixed.
Tests: merge.spec retention/dormant + sentinel-debris cases, translations.spec
matchLanguage + adoption suite (6 cases incl. first-language conflict and media-prefill
precedence), writer.spec dormant-filter case.

**Accepted as-is (recorded, no change):** `runMultiOp` pre-flights multi-moves on a throwaway
clone (2 clones per discrete keypress — keeps `mutate`'s undo contract intact); `topMostNodes`
walked twice on multi-drag end (once per gesture); TreeNodeCard's inline two-line multi-delete
(routing through the composable would pull `useToast` into every card test); the copy/cut and
handleCopy/CutEvent near-twin pairs and the three multi-move store wrappers (readable as-is);
`.selection-chip-clear` literal 16px (no matching token exists); view-level
`clipboardEventAllowed` guard untested directly (underlying handlers fully covered; the
Escape-race guard is regression-pinned by the dataset/entities/media-labels e2e specs).
