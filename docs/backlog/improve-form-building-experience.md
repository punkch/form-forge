# Canvas multi-select, clipboard ops, canvas toolbar & insert-from-template

## Context

The canvas today supports only single-node selection; the only structural ops are per-card duplicate/delete and drag. The user wants: (1) multi-select (Ctrl+Click, Shift+Click range) with Cut/Copy/Paste/Delete acting on the whole selection, including paste **between forms**; (2) **multi-move** — reposition the whole selection together (drag and Alt+Arrow keys), including moving it inside a group; (3) "Insert from template" — append a chosen template's fields to the end of the open form as ordinary editable nodes; (4) a new always-on-top toolbar in the canvas panel (undo/redo/cut/copy/paste/delete left, gear right) so the top bar doesn't get more crowded; (5) the in-app multilingual guides (en/fr/es) updated to teach all of this.

## Interface-craft consultation (feedback accounted for)

The design-critique lenses were applied to the proposed design; findings and resolutions:

- **Control duplication (structural)** — undo/redo already live in the AppHeader; showing them twice inches apart splits the pattern. → *Resolved (user decision): UndoRedoButtons **move** into the canvas toolbar; removed from the header.* Bonus: the library view's header stops showing permanently-disabled undo/redo.
- **Family splitting (consistency)** — moving only Form settings out of the form-name menu would strand Translations/Choice lists/Attachments in a menu whose most-used item vanished. → *Resolved (user decision): the gear opens the **whole** form menu (all four items + new "Insert from template…"); the form-name button becomes a plain title.* The gear keeps `data-testid="form-menu"`, so all 15 e2e menu flows survive verbatim.
- **Always-visible disabled buttons (interface)** — cut/copy/delete are dead without a selection, paste without a buffer; six icons where four are often disabled reads as noise. → Mitigate: proper disabled states, tooltips that carry shortcuts ("Cut (Ctrl+X)") and switch to "Nothing to paste" when empty, and a **"N selected" chip + clear button** appearing when >1 selected — feedback that multi-select is active.
- **Expectation setting (interface)** — paste destination must be predictable. → One deterministic rule (mirrors `addFromPalette`): *into the selected open group at its end; otherwise right after the selection; otherwise at the end of the form.* Pasted/inserted nodes are selected and the first is revealed + flashed (existing `revealNodeId` mechanics).
- **Icon clarity (visual)** — PrimeIcons has **no scissors icon** (verified against the pinned package). Cut uses `pi pi-file-export` + tooltip; Copy `pi pi-copy`, Paste `pi pi-clipboard`, Delete `pi pi-trash`, gear `pi pi-cog` — one icon family, existing weight.
- **Toolbar placement (visual/behavioral)** — `position:sticky` inside the padded scroll area floats below the top padding and shows content scrolling behind it. → The toolbar is a **non-scrolling sibling above the scroll area** (always on top by construction), styled as a panel header from existing tokens only.
- **Focus vs multi-select conflict (behavioral)** — cards select on `@focus`; mousedown fires focus before click, which would collapse the set right before Ctrl+Click toggles the node *out*. → A pointerdown flag makes the click handler authoritative during pointer interaction; keyboard focus (Tab/arrows) still collapses to single-select (standard tree behavior).

## Decisions locked with the user

1. **Structural ops only** for multi-select (cut/copy/paste/delete); bulk property editing recorded as a backlog follow-up.
2. **Undo/redo move** to the canvas toolbar (single home).
3. **Gear opens the whole form menu**; header form-name becomes a plain title.
4. **Hybrid clipboard**: in-app localStorage buffer (memory fallback) as source of truth + best-effort system-clipboard write + native ClipboardEvent handling for real Ctrl+X/C/V.

## Architecture

- **`src/core/clipboard/`** (new, pure TS): payload build/parse + the cross-doc merge. Reused by paste AND insert-from-template.
- **`src/clipboard/`** (new, app-level, browser APIs — mirrors the `src/theme/` pure-vs-apply split): localStorage/memory buffer + system-clipboard glue. Not in core (touches `window`/`localStorage`/`navigator`).
- **Form store** gains 5 actions (one `mutate` = one undo entry each). **Editor store** gains a selection set alongside the existing anchor `selectedNodeId` (all current consumers keep working untouched).
- **`useSelectionActions`** composable = the single UI-facing surface (toolbar, keyboard, ClipboardEvents, TreeNodeCard all call it).

## Part A — Core

### 1. `src/core/model/ops.ts` (+ ops.spec.ts)
- `uniqueNameIn(names: ReadonlySet<string>, base): string` — suffix dedup against an explicit growing set (fixes N-sibling paste dedup); `uniqueName(doc, base)` reimplemented on top (behavior identical, spec untouched).
- `topMostNodes(doc, ids: Iterable<string>): FormNode[]` — document-order subset with descendants-of-selected removed (manual walk, don't recurse into hits); unknown ids ignored.

### 1b. Multi-move core helpers — `src/core/model/multi-ops.ts` (new, + spec)
Pure functions over the live doc (used inside one `mutate`, or between `beginTransaction`/`endTransaction` for drag). All operate on `topMostNodes(doc, ids)`:
- `moveNodesBy(doc, ids, delta: -1 | 1) → boolean` — per-list block move; **abort whole op (return false, doc untouched) if any top-most node sits at its list edge** (prevents order scrambling); process top-first for −1, bottom-first for +1, reusing `moveNode`'s index compensation.
- `indentNodes(doc, ids) → boolean` — process in **document order**: the first node indents into its preceding sibling container (existing `indent` rule); once it's inside, each subsequent selected sibling's preceding sibling *is* that container, so a contiguous run folds in naturally, order preserved. Abort if the first top-most node has no preceding container.
- `outdentNodes(doc, ids) → boolean` — process in **reverse document order** (each lands at `parentIndex + 1`, so reverse processing preserves relative order). Abort if none can outdent.
- `gatherNodesAfter(doc, ids, anchorId) → boolean` — relocate every top-most selected node (except `anchorId` and any of its ancestors/descendants) to sit **immediately after `anchorId`** in the anchor's parent, preserving document order. `moveNode`'s `containsNode` guard makes into-own-subtree moves safe no-ops. This is the drag gather primitive.

### 2. `src/core/model/translations.ts` (+ spec parity test)
Extract-method refactor: export `transformNodesLocalizedTexts(nodes, fn)` and `transformChoiceListsLocalizedTexts(lists, fn)`; `transformLocalizedTexts(doc, fn)` composes them. Guarantees the merge's language remap hits byte-for-byte the same sites (labels/hints/guidance, bind messages, media refs, translated customColumns, choice labels/media).

### 3. `src/core/clipboard/payload.ts` (new)
```ts
CLIPBOARD_KIND = 'formforge-nodes'; CLIPBOARD_VERSION = 1; MAX_BUFFER_CHARS = 1_500_000
interface NodesPayload { kind; version: 1; nodes: FormNode[]; choiceLists: Record<string, ChoiceList>;
  languages: Lang[]; defaultLanguage?: Lang; attachmentFilenames: string[]; sourceFormRecordId?: string; copiedAt: number }
buildNodesPayload(doc, ids, meta?) → NodesPayload | null   // topMostNodes → JSON-clone subtrees (proxy-safe)
                                                           // → reachable choiceLists only → filenames via collectAttachmentReferences(syntheticDoc)
parseNodesPayload(raw) / serializeNodesPayload(p) / tryParseClipboardText(text)
```
- No `entities`, no `settings`, no blobs — filenames only; missing files surface as the established Missing-rows/refs-warning UX. `sourceFormRecordId` reserved for a future blob-copy stretch.
- System-clipboard marker = the JSON envelope itself; `tryParseClipboardText` sniffs (`{` + `"formforge-nodes"`) before `JSON.parse`. Rejects `version > 1`. Guards via `isRecord`/`hasText`.

### 4. `src/core/clipboard/merge.ts` (new) — the shared cross-doc merge
```ts
mergeNodesIntoDoc(doc, payload, target: {parentId: string|null, index?}) → MergeResult | null
// MergeResult: { insertedIds, addedLists, reusedLists, renamedLists, droppedLanguages, strippedSaveTo, attachmentFilenames }
```
Payload treated immutable (repeat pastes). Step order: validate target (parent must exist + be container, else `null`) → clone nodes+lists → **language remap** → **choice-list import** → **fresh ids + name dedup** (running set seeded from `allNames(doc)`; before renaming a csv-external question with an *implicit* itemset default, materialize `itemsetFile = effectiveItemsetFile(n)` so rename doesn't retarget the file) → **saveTo policy** → sequential `insertNode`. No cycle guard needed (fresh ids ⇒ inserted subtree can't be an ancestor).

**Choice-list collision policy**: absent → add; present + deep-equal (post-remap, key-order-insensitive) → **reuse** (avoids `yes_no_2` litter on paste-back); present + different → **rename** `name_2…` + rewrite `listRef` on pasted questions. Never union-merge, never overwrite.

**Language remap** (one `Map<Lang, Lang|null>` over source keys ∪ sentinel; applied via the §2 sub-walkers):

| # | Source key | Match vs target languages | Result |
|---|---|---|---|
| 1 | any | exact key | that language |
| 2 | any | same `languageCode` (case-insens.) | first match |
| 3 | any | same name part (`'French'` vs `'French (fr)'`) | first match |
| 4 | source primary (incl. Shape A sentinel) | unmatched | **target primary** (`primaryLang(doc)`) |
| 5 | non-primary source lang | unmatched | **drop**, recorded in `droppedLanguages` |

Range ⊆ target's `langsOf` ⇒ two-clean-shapes invariant holds by construction (tests assert `normalizeDefaultContent(doc).changed === false` post-merge). Rationale for drop-not-addLanguage: `addLanguage` is a doc-restructuring migration — too large a side effect for a paste; `MergeResult` reports drops for a toast.

**saveTo policy**: target has no `doc.entities` → strip `saveTo` (counted) — the entities validator raises nothing for orphan saveTo, so keeping it would silently emit entity binds. Target declares entities → keep (existing validators flag conflicts visibly).

## Part B — Transport (`src/clipboard/`, new)

- `buffer.ts`: `writeClipboardBuffer` (in-memory slot always; localStorage `formforge.clipboard.v1` when ≤ MAX_BUFFER_CHARS, try/catch — partitioned embed iframes degrade silently), `readClipboardBuffer` (newest `copiedAt` of memory vs localStorage wins), `hasClipboardBuffer`, `onClipboardBufferChange(cb)` (local writes + window `'storage'` events ⇒ cross-tab paste-button reactivity for free).
- `system.ts`: `writeSystemClipboard(json)` (fire-and-forget `navigator.clipboard.writeText`), `applyToClipboardEvent(e, json)` (`setData('application/json')` + `'text/plain'`), `payloadFromClipboardEvent(e)` (json → text sniff).

## Part C — Stores & composable

### 5. `src/stores/form.ts` — all early-return **before** `mutate` on empty/invalid input (mutate pushes undo unconditionally); one `mutate` each
- `copyNodes(ids) → NodesPayload | null` (no mutation)
- `cutNodes(ids)` — copy + one mutate removing top-most ids (reverse doc order); undo restores nodes, buffer survives (standard cut semantics)
- `deleteNodes(ids)`
- `pasteNodes(payload, target?) → MergeResult | null` — stale/non-container target falls back to root-append *before* mutate
- `insertTemplate(templateDoc) → MergeResult | null` — payload from the whole template tree, merged at doc end
- **Multi-move actions**: `moveSelectionBy(ids, delta)`, `indentSelection(ids)`, `outdentSelection(ids)` — thin wrappers: check the core helper would succeed, then one `mutate(translate('stores.form.undoMoveQuestions'), …)`; no-op (no undo entry) when the helper aborts.
- New undo-label keys ×3 locales (`stores.json`): `undoCutQuestions`, `undoDeleteQuestions`, `undoPasteQuestions`, `undoInsertTemplate`, `undoMoveQuestions`.

### 6. `src/stores/editor.ts` — selection set alongside the anchor
```ts
selectedNodeId: ref<string|null>        // ACTIVE/anchor — unchanged meaning, all consumers untouched
selectedNodeIds: ref<Set<string>>       // invariant: anchor ∈ set unless empty
select(id)        // plain click/programmatic — collapses set to {id} (or clears)
toggleSelect(id)  // Ctrl+Click; toggled-in becomes anchor; toggling anchor out → last remaining (insertion order)
selectRange(id, orderedIds)  // Shift+Click; anchor stays (repeated shift-clicks re-range)
selectMany(ids)   // Ctrl+A + post-insert selection
pruneSelection(existingIds)  // drop stale ids, fix anchor
reset()           // also clears the set
```
Consumer audit done: PropertyPanel/railed/preview-follow/addFromPalette/EditorTabs/ProblemsButton/FormSettingsDialog/NodeList all anchor-based or `select(id)` callers — no changes. `TreeNodeCard.selected` → set membership.

### 7. `src/composables/useSelectionActions.ts` (new) — the one UI surface
`canCut/canCopy/canDelete` (selection non-empty), `canPaste` (reactive via `onClipboardBufferChange` + doc loaded), `copySelection` (store → buffer + best-effort system write), `cutSelection`, `deleteSelection` (+ `select(null)` after), `pasteClipboard()` (buffer only — no permission prompt), `handleCopyEvent/handleCutEvent/handlePasteEvent(e)` (native path: event data first, buffer fallback), paste-target resolution (rule above → `MergeTarget`), post-paste `selectMany(insertedIds)` + `revealNodeId = first` + toast on `droppedLanguages`/`attachmentFilenames`/`strippedSaveTo` (informational, i18n).

## Part D — UI

### 8. `src/components/canvas/TreeNodeCard.vue`
- `selected` → `editor.selectedNodeIds.has(node.id)`; keep single `.selected` visual for all selected cards.
- `@click.stop="onCardClick($event)"` — plain/ctrl/shift per matrix; `@mousedown` sets a pointer flag (+ `preventDefault` when `shiftKey` to kill text selection); `@focus` guarded: no-op during pointer interaction, else `select(id)` (keyboard collapses to single).
- Delete key / `delete-node` button: node ∈ multi-selection → `deleteSelection()`, else existing single delete. Duplicate button unchanged.
- **Alt+Arrow branches become selection-aware** (same pattern as Delete): node ∈ multi-selection → `form.moveSelectionBy(ids, ±1)` / `indentSelection` / `outdentSelection`, else existing single-node `moveBy`/`indent`/`outdent`. `refocus()` unchanged.

### 8b. Multi-drag — `src/components/canvas/NodeList.vue` (gather-on-drop)
Verified feasible against the existing seams (vue-draggable-plus 0.6.1 bundles its own sortablejs, so the MultiDrag plugin can't be mounted — gather-on-drop avoids it entirely):
- vdp's model-value splices land **before** `@end` fires, and `beginTransaction`/`endTransaction` capture *all* doc mutations between them in one undo entry (snapshot at begin; `endTransaction` drops the entry on JSON-equality).
- `onDragStart(e: DraggableEvent)` records the dragged node id (`e.data.id`); `onDragEnd`: if the dragged id ∈ `editor.selectedNodeIds`, size > 1, **and** the dragged node ∈ `topMostNodes(selection)` — call `gatherNodesAfter(form.doc, selectedIds, draggedId)` directly on the live doc (NOT via `mutate` — that would fork a second undo entry), *then* `form.endTransaction()`. Whole gesture = one "Move question" undo entry.
- Dragging a card whose selected *ancestor* is also selected (dragged ∉ top-most) falls back to single-node drag — no gathering (stated in spec).
- Works for drops **into groups** for free: the dragged card lands in the container via the normal vdp path, and the rest of the selection gathers after it there. TransitionGroup FLIP animates the followers on drop; only the dragged card ghosts during the drag (acceptable v1, noted in spec).

**Interaction matrix**: plain click = single select · Ctrl/Cmd+Click = toggle · Shift+Click = range over **visible card order** (`.node-card[data-node-id]` DOM order — excludes collapsed children, matches what the user sees; selected container implies subtree for ops via `topMostNodes`, children not individually marked) · empty-canvas click / Escape = clear · Ctrl+A = select all root-level nodes · **drag a selected card = the whole selection moves** (gather-on-drop, §8b) · **Alt+Arrows on a selected card = the whole selection moves/indents/outdents** (§8b).

### 9. `src/views/FormEditorView.vue`
- Wrap the canvas: `<section class="canvas-panel" v-show="mode !== 'tablet' || editor.activePane === 'canvas'"><CanvasToolbar /><main class="editor-canvas" role="tree" aria-multiselectable="true" …>` — flex column, toolbar `flex-shrink:0`, `.editor-canvas { flex:1; overflow-y:auto }`. Grid tracks are positional — unaffected. Update tablet CSS selectors `> .editor-canvas` → `> .canvas-panel` (~lines 421-425).
- `#title-actions` → plain `<span class="form-title" data-testid="editor-form-title">` (truncation CSS kept); `formMenu` ref/Menu/caret removed; AppHeader's `:deep([data-testid='form-menu'])` shrink rule retargeted.
- `onGlobalKeydown` additions (all behind the existing `inInput` guard): Delete/Backspace → `deleteSelection` when selection non-empty; Ctrl/Cmd+A → `preventDefault` + select all root nodes (guard `activeDialog === null`); Escape → clear selection (AFTER the palette-drawer branch; guard `activeDialog === null && !centralDrawerOpen`).
- Document-level `copy`/`cut`/`paste` ClipboardEvent listeners (registered with the keydown pair): act + `preventDefault` only when `activeDialog === null` ∧ not `inInput` ∧ `window.getSelection()?.isCollapsed !== false` ∧ (copy/cut: selection non-empty | paste: event/buffer carries our payload). Document-level, not canvas-element (focus sits outside the tree after toolbar clicks).
- Stale-selection pruning: `watch(() => form.revision)` → `editor.pruneSelection(new Set(flatten(doc.children).map(n => n.id)))` — covers undo/redo/drag/card-delete.

### 10. `src/components/canvas/CanvasToolbar.vue` (new)
- Left: `<UndoRedoButtons />` (moved by reuse — testids/tooltips/disabled free), `<ToolbarSeparator />`, Cut/Copy/Paste/Delete (icon-only convention: `severity="secondary" text` + tooltip + aria-label), selection chip `"{count} selected"` + clear × when size > 1. Right (after `margin-inline-start:auto`): gear `pi pi-cog`, **`data-testid="form-menu"`**, toggling the relocated `formMenuItems` Menu + `{separator}` + "Insert from template…" (`editor.activeDialog = 'insert-template'`).
- Icons: Cut `pi pi-file-export` (no scissors in PrimeIcons), Copy `pi pi-copy`, Paste `pi pi-clipboard`, Delete `pi pi-trash`.
- Tooltips carry shortcuts with `{mod}` interpolation (⌘/Ctrl via platform sniff); paste tooltip switches to "Nothing to paste" when disabled.
- CSS from existing tokens only (stylelint): `background: var(--builder-panel-bg); border-bottom: var(--builder-panel-border); padding/gap: var(--odk-spacing-*)`.
- `AppHeader.vue`: remove UndoRedoButtons + its ToolbarSeparator.

### 11. `src/components/library/InsertTemplateDialog.vue` (new)
- **Slim picker — no extraction from NewFormDialog** (its two-step flow, management actions and heavy e2e make extraction riskier than ~40 lines of duplicated card CSS).
- Wired via `EditorDialog` union + `'insert-template'` in `EditorDialogs.vue`. Grid of read-only cards: visible bundled starters (respects `ui.isBundledTemplateHidden`) + local templates (`listTemplates()` on open, `shallowRef`). Click → load doc (bundled `load()`; local via **`migrateTemplateDoc`** — extracted/exported from `src/templates/index.ts`, NewFormDialog's private `migrateLocalDoc` refactored to use it) → `form.insertTemplate(doc)` → close, `selectMany(insertedIds)` + reveal/flash first. No confirm step — one click, fully undoable. Empty state + testid.

## Part E — In-app multilingual guides (en/fr/es)

### 12. New `canvas` guide — the home for all the new functionality
Recipe pinned by `tests/unit/guides-content.spec.ts` (registry/catalog sync is gate-tested):
- `src/help/content.ts`: add `'canvas'` to the `GuideKey` union + a `guideHelp.canvas` entry — `title`/`summary`/`steps` (≈6: multi-select via Ctrl+Click & Shift+Click · toolbar cut/copy/paste/delete + shortcuts · paste between forms (open the other form and paste) · moving the selection together by drag or Alt+Arrows, incl. into a group · Insert from template via the gear menu · undo covers every bulk action in one step) + required `searchKeywords` (e.g. `['multi-select', 'copy', 'paste', 'clipboard', 'move', 'toolbar']`); no `docsUrl` (app-specific, like backup/autosave).
- `src/help/guides.ts`: add `'canvas'` to `GUIDE_KEYS` (near the top — it's core editing).
- `guides.json` in **en + fr + es**: matching `guides.canvas` block with identical `steps.{1..N}` numbering (vue-tsc + guides-content.spec both enforce three-locale parity and step-count sync).
- Drawer list/search/detail work automatically (`help-guide-item-canvas` testid comes from the loop).

### 13. Updates to existing guides (en + fr + es together)
- **`keyboard` guide**: extend steps with the new shortcuts — Ctrl+X/C/V on the selection, Ctrl+A select all, Escape clears selection, Delete deletes the whole selection; note Alt+Arrows now move the whole selection. Safe to edit: the e2e substring assertions in `guides.spec.ts` only pin logic/translations text.
- **`templates` guide**: add a step covering "Insert from template" into an *existing* form via the canvas gear menu (the guide currently only covers new-form creation); adjust summary if needed.
- Step-count changes must be mirrored in `guideHelp` step arrays AND all three catalogs (spec-enforced).

### 14. First-use callout on the canvas
Follow the established `GuideCallout`/`dismissedCallouts` pattern (translations/logicRaw precedents): add `CalloutId` `'multiSelect'` + `guides.callouts.multiSelect.{title,body}` ×3 locales; render `<GuideCallout id="multiSelect">` at the top of `.canvas-inner` (visible once, dismissable, persisted) with a `<GuideTrigger guide="canvas">` in its slot linking to the new guide — announces multi-select/toolbar without adding permanent chrome (interface-craft: no always-on "?" crowding the toolbar).

## i18n keys (en + fr + es, typecheck-enforced)
- `canvas.json`: `canvas.toolbar.{cut,copy,paste,delete,cutLabel,copyLabel,pasteLabel,deleteLabel,pasteEmpty,selectionCount,clearSelection}`; `canvas.insertTemplate.{header,hint,empty}` (+ paste-toast keys).
- `shell.json`: `shell.editor.{insertFromTemplate,formMenuOpen}`.
- `stores.json`: the five new undo labels (`undoCutQuestions`, `undoDeleteQuestions`, `undoPasteQuestions`, `undoInsertTemplate`, `undoMoveQuestions`). Existing rendered English stays byte-stable.
- `guides.json`: `guides.canvas.{title,summary,steps.1..N}`, extended `guides.keyboard.steps.*` / `guides.templates.steps.*`, `guides.callouts.multiSelect.{title,body}`.

## Testids
Preserved: `undo`, `redo`, `form-menu` (now the gear), `editor-form-title` (now a span), `node-card-<name>`, `delete-node`, `canvas-list`, `container-list-<id>`.
New: `canvas-toolbar`, `toolbar-cut/copy/paste/delete`, `selection-count`, `selection-clear`, `insert-template-dialog`, `insert-template-card-<id>`, `insert-template-local`, `insert-template-empty`.

## Tests
- **Unit (core)**: extend `ops.spec.ts` (`topMostNodes`, `uniqueNameIn` + property-test parity clause); new `multi-ops.spec.ts` — `moveNodesBy` (block move up/down, non-contiguous gaps preserved, edge abort leaves doc untouched), `indentNodes` (contiguous run folds into the group above in order), `outdentNodes` (reverse-order processing preserves order, multiple children of one parent), `gatherNodesAfter` (cross-parent gather into a group, dragged-descendant fallback, container-into-own-subtree no-op, document order preserved) + extend the random-ops property test (id uniqueness + parent/child integrity); `translations.spec.ts` sub-walker parity; new `payload.spec.ts` (build/parse round-trip, reachable-lists-only, implicit-csv filename, version-2 rejection, sniff never throws); new `merge.spec.ts` — the big one: N-sibling name dedup, list matrix (added/reused/renamed/shared/identical-after-remap), language matrix (A→A, A→B, B→A, B→B × exact/code/name/primary-fallback/drop) with invariant assertion, saveTo both branches, invalid target → null + doc untouched, payload immutability across double merge, fast-check property (post-merge unique names, resolving listRefs, invariant).
- **Unit (transport)**: `buffer.spec.ts` — round-trip, oversize → memory-only, corrupt localStorage fallback, newest-copiedAt wins, storage-event reactivity, no-throw on quota/SecurityError.
- **Unit (stores)**: form — copy adds zero undo entries; cut/delete/paste/insertTemplate/**moveSelectionBy/indentSelection/outdentSelection** exactly one entry each (and zero on aborted moves), single undo fully restores; cross-doc paste fixture; **drag transaction: begin → vdp-style splice + gatherNodesAfter → end = one undo entry**. Editor — select/toggle/range/many/prune matrix incl. anchor fallback.
- **Component**: extend `tree-node-card.spec.ts` (ctrl toggle, shift range, focus-during-pointer no-op, multi-Delete, **Alt+ArrowDown with multi-selection moves the whole block**); new `canvas-toolbar.spec.ts` (disabled states, chip, gear menu = 5 items + separator, undo/redo present); new `insert-template-dialog.spec.ts`. Guides: `guides-content.spec.ts` + `help-guides.spec.ts` gate the new guide via their loops (registry/catalog/step-count sync, searchKeywords required).
- **e2e** (new `multiselect-clipboard.spec.ts`): ctrl-click two → cut → paste → order + single-undo; cut in form A → library → form B → paste (cross-form buffer); insert-from-template via gear; **multi-move: ctrl-click two → Alt+ArrowDown → order asserted → one Ctrl+Z restores**. Existing specs: `form-menu` flows survive (gear keeps testid + item labels); `editor.spec.ts` uses Ctrl+Z/Y keys, untouched; `guides.spec.ts` substring assertions pin only logic/translations text — keyboard/templates guide edits are safe.

## Docs & process
- Create spec folder `docs/specs/<timestamp>-canvas-multiselect-clipboard/` (shape/plan/references/standards/user-guide) per delivery process; verification log to `docs/verification/`.
- `docs/product/roadmap.md` → Known follow-ups: **bulk property editing for canvas multi-selection** (user-requested backlog entry) + optional blob-copy on cross-form paste (payload hook reserved).
- Update CLAUDE.md code map (new `src/core/clipboard/`, `src/clipboard/`, CanvasToolbar, selection model, store actions) + README Features in the same change.

## Implementation order
1. Core helpers (ops, **multi-ops**, translations refactor) → 2. `core/clipboard` payload+merge → 3. transport (parallel-safe) → 4. form-store actions + i18n → 5. editor-store selection → 6. composable → 7. TreeNodeCard (clicks + selection-aware Delete/Alt+Arrows) → 8. FormEditorView (layout/keyboard/events/prune) + **NodeList gather-on-drop** → 9. CanvasToolbar + AppHeader cleanup → 10. InsertTemplateDialog + `migrateTemplateDoc` extraction → 11. **guides: canvas guide + keyboard/templates updates + multiSelect callout ×3 locales** → 12. tests throughout → 13. docs. (Per established process: implement via dynamic Workflow with parallel agents; cheap models for mechanical stages.)

## Verification
- `pnpm test` (unit + component), `pnpm lint` (stylelint token guard), `pnpm typecheck` (fr/es mirror enforcement), `pnpm test:e2e` (note: filter without `--`), `pnpm test:coverage` floors (core 86/78/88, stores 80/85).
- Goldens untouched — no serializer/parser change anywhere.
- Manual/agent-browser pass (per UI-verification memory): multi-select visuals in light/dark, toolbar disabled/enabled states, chip, gear menu, cross-tab paste (two tabs), **multi-drag gather-on-drop into a group + FLIP animation + single undo**, embed demo page (buffer falls back to memory), reduced-motion, **new canvas guide + callout in en/fr/es (switch interface language in Settings)**; log to `docs/verification/`; then `/interface-craft` critique of the built toolbar + `/code-review`, fix findings, conventional commit.
