# Canvas multi-select, clipboard ops, canvas toolbar & insert-from-template — Plan

## Context

The canvas supports only single-node selection; the only structural ops are per-card
duplicate/delete and drag. The shaped backlog item
`docs/backlog/improve-form-building-experience.md` (interface-craft consultation applied,
decisions locked with the user in a prior session) delivers:

1. **Multi-select** — Ctrl+Click toggle, Shift+Click range — with Cut/Copy/Paste/Delete acting
   on the whole selection, including paste **between forms** (hybrid clipboard: localStorage
   buffer + best-effort system clipboard + native ClipboardEvent handling).
2. **Multi-move** — the whole selection moves together: drag (gather-on-drop) and Alt+Arrows
   (block move / indent / outdent), including into groups.
3. **Insert from template** — append a chosen template's fields to the end of the open form as
   ordinary editable nodes (fully undoable, one step).
4. **Canvas toolbar** — non-scrolling header above the canvas scroll area: undo/redo (moved
   from AppHeader — single home), cut/copy/paste/delete, "N selected" chip; gear on the right
   opens the **whole** relocated form menu + new "Insert from template…". The header form-name
   button becomes a plain title.
5. **Guides (en/fr/es)** — new `canvas` guide, extended `keyboard` + `templates` guides,
   first-use `multiSelect` callout on the canvas.

Locked decisions (do not re-litigate): structural ops only (bulk property editing → roadmap
follow-up); undo/redo move to the toolbar; gear = whole form menu (keeps
`data-testid="form-menu"` so all 15 e2e menu flows survive); hybrid clipboard; Cut icon
`pi pi-file-export` (PrimeIcons has no scissors — verified in the installed package).

All backlog claims were verified against the code by three exploration agents. The design holds;
the **corrections** below amend specific integration details and are part of this plan.

## Verified corrections to the backlog design

1. **Drag identity**: `NodeList.vue`'s `@start`/`@end` handlers currently take no args and
   `e.data` is not part of the wiring. The dragged node id is read from the SortableJS event:
   `evt.item.dataset.nodeId` (cards already render `:data-node-id`, TreeNodeCard.vue:127).
2. **Card selection today fires on BOTH `@click.stop` and `@focus`** (TreeNodeCard.vue:128-129),
   not focus-only. The new `onCardClick` replaces the click handler with the plain/ctrl/shift
   matrix; the focus handler gets the pointerdown-flag guard (no-op during pointer interaction,
   else `select(id)` — keyboard collapses to single).
3. **AppHeader's `:deep([data-testid='form-menu'])` shrink rule (AppHeader.vue:103-107) is
   REMOVED**, not retargeted — the gear moves out of the header entirely. FormEditorView's own
   `.form-menu-button`/`.form-menu-title` truncation CSS (:379-397) is renamed/kept for the new
   plain `<span class="form-title" data-testid="editor-form-title">` (that testid is rendered
   today but asserted nowhere — safe either way).
4. **`addFromPalette` lives in FormEditorView.vue:140-159** (not the form store; store method is
   `addNode`). The paste-target rule mirrors its logic and lives in `useSelectionActions`.
5. **saveTo rationale corrected (policy unchanged)**: orphan `saveTo` is NOT silently accepted —
   `src/core/validate/refs.ts:74-81` emits `entities.saveto-without-declaration` (ERROR) when
   `doc.entities` is undefined, and `validateEntities` checks format/duplicates regardless. The
   locked policy stands: **strip saveTo when the target declares no entities** (else paste would
   instantly error the target form); count strips in `MergeResult` for the toast.
6. **Dialog mounting**: `src/components/EditorDialogs.vue` (top-level, flat list of self-gating
   dialogs). Add `'insert-template'` to the `EditorDialog` union (src/stores/editor.ts:6-15) +
   one line in EditorDialogs.vue.
7. **`migrateTemplateDoc` extraction unifies TWO call sites**: NewFormDialog's private
   `migrateLocalDoc` (:128-134) AND `loadTemplate` in `src/templates/index.ts:25-31` (same
   migrateDoc-or-throw shape). Extract one shared `migrateTemplateDoc(raw: FormDocument)` into
   `src/templates/index.ts`; refactor both onto it.
8. **UndoRedoButtons (`src/components/shell/UndoRedoButtons.vue`) carry no testids**; e2e
   undo/redo is keyboard-only (`editor.spec.ts` uses Ctrl+Z/Y). Moving them breaks nothing.
9. **No general Escape branch exists** in `onGlobalKeydown` (only the palette-drawer branch,
   which early-returns first) — add Escape→clear-selection after it, guarded
   `activeDialog === null && !centralDrawerOpen`.
10. **Single-node `moveBy`/`indent`/`outdent` live in the form store** (form.ts:399-431), each a
    `mutate('stores.form.undoMoveQuestion')`; `moveNode` (ops.ts:92) already has forward-index
    compensation + `containsNode` own-subtree guard — `multi-ops.ts` builds on these.

## Task 1 — Save spec documentation (shape-spec)

This folder (`docs/specs/2026-07-23-1242-canvas-multiselect-clipboard/`): plan.md (this file),
shape.md, standards.md, references.md, user-guide.md. Delete
`docs/backlog/improve-form-building-experience.md` in the same change (promoted here per the
established delivery process).

## Task 2 — Core helpers (pure TS)

**`src/core/model/ops.ts`** (+ extend co-located `ops.spec.ts`):
- `uniqueNameIn(names: ReadonlySet<string>, base): string` — suffix dedup against an explicit
  growing set (fixes N-sibling paste dedup); reimplement `uniqueName(doc, base)` on top
  (behavior identical, existing spec untouched).
- `topMostNodes(doc, ids: Iterable<string>): FormNode[]` — document-order subset with
  descendants-of-selected removed (manual walk, don't recurse into hits); unknown ids ignored.

**`src/core/model/multi-ops.ts`** (new, + co-located spec). Pure functions over the live doc
(used inside one `mutate`, or between `beginTransaction`/`endTransaction` for drag), all
operating on `topMostNodes(doc, ids)`:
- `moveNodesBy(doc, ids, delta: -1|1) → boolean` — per-list block move; abort whole op (return
  false, doc untouched) if any top-most node sits at its list edge; process top-first for −1,
  bottom-first for +1, reusing `moveNode`'s index compensation.
- `indentNodes(doc, ids) → boolean` — document order; first node indents into its preceding
  sibling container (same rule as store `indent`), subsequent siblings follow it in naturally.
  Abort if the first top-most node has no preceding container.
- `outdentNodes(doc, ids) → boolean` — reverse document order (each lands at `parentIndex+1`,
  matching store `outdent`); abort if none can outdent.
- `gatherNodesAfter(doc, ids, anchorId) → boolean` — relocate every top-most selected node
  (except `anchorId` and its ancestors/descendants) immediately after `anchorId` in the anchor's
  parent, preserving document order; `moveNode`'s `containsNode` guard makes into-own-subtree
  moves safe no-ops. This is the drag gather primitive.

**`src/core/model/translations.ts`** (+ parity test): extract-method refactor — export
`transformNodesLocalizedTexts(nodes, fn)` + `transformChoiceListsLocalizedTexts(lists, fn)`;
`transformLocalizedTexts(doc, fn)` composes them (today one function walks both). Site list
verified: label/hint/guidanceHint, bind required/constraint messages, all 4 media kinds,
translated customColumns, choice label+media. Guarantees the merge's language remap hits
byte-for-byte the same sites.

## Task 3 — `src/core/clipboard/` (new, pure TS): payload + merge

**`payload.ts`**: `CLIPBOARD_KIND = 'formforge-nodes'`, `CLIPBOARD_VERSION = 1`,
`MAX_BUFFER_CHARS = 1_500_000`.
`NodesPayload { kind; version: 1; nodes: FormNode[]; choiceLists: Record<string, ChoiceList>;
languages: Lang[]; defaultLanguage?: Lang; attachmentFilenames: string[];
sourceFormRecordId?: string; copiedAt: number }`.
- `buildNodesPayload(doc, ids, meta?) → NodesPayload | null` — `topMostNodes` → JSON-clone
  subtrees (`JSON.parse(JSON.stringify())`, the repo's established proxy-safe clone — ops.ts
  precedent) → reachable choiceLists only → filenames via `collectAttachmentReferences` on a
  synthetic doc (rename-attachment.ts:34; covers implicit csv-external `${name}.csv` via
  `effectiveItemsetFile`, question-types.ts:756).
- `parseNodesPayload(raw)` / `serializeNodesPayload(p)` / `tryParseClipboardText(text)` — sniff
  (`{` + `"formforge-nodes"`) before `JSON.parse`; reject `version > 1`; guards via
  `isRecord`/`hasText` (`src/core/util/guards.ts`). No entities, no settings, no blobs —
  filenames only (missing files surface as the established Missing-rows/refs-warning UX);
  `sourceFormRecordId` reserved for a future blob-copy stretch.

**`merge.ts`** — the shared cross-doc merge, reused by paste AND insert-from-template:
`mergeNodesIntoDoc(doc, payload, target: {parentId: string|null, index?}) → MergeResult | null`
with `MergeResult { insertedIds, addedLists, reusedLists, renamedLists, dormantLanguages,
strippedSaveTo, attachmentFilenames }`. Payload treated immutable (repeat pastes). Step order:
validate target (parent exists + `isContainer`, else null) → clone nodes+lists → language remap
→ choice-list import → fresh ids + name dedup (running set seeded from `allNames(doc)`,
ops.ts:131; before renaming a csv-external question with an implicit itemset default,
materialize `itemsetFile = effectiveItemsetFile(n)` so rename doesn't retarget the file) →
saveTo policy → sequential `insertNode` (ops.ts:53). Fresh ids ⇒ no cycle guard needed.

- **Choice-list collision policy**: absent → add; present + deep-equal post-remap
  (key-order-insensitive) → reuse; present + different → rename `name_2…` + rewrite `listRef` on
  pasted questions. Never union-merge, never overwrite.
- **Language remap** (one `Map<Lang, Lang|null>` over source keys ∪ sentinel; applied via the
  Task-2 sub-walkers; `Lang = string`, match via `languageCode()`/name-part parsing from
  translations.ts):

  | # | Source key | Match vs target languages | Result |
  |---|---|---|---|
  | 1 | any | exact key | that language |
  | 2 | any | same `languageCode` (case-insens.) | first match |
  | 3 | any | same name part (`'French'` vs `'French (fr)'`) | first match |
  | 4 | source primary (incl. Shape A sentinel) | unmatched | **target primary** (`primaryLang(doc)`) |
  | 5 | non-primary source lang | unmatched | **kept DORMANT** under its own key, recorded in `dormantLanguages` |

  **Revised post-delivery (user decision, 2026-07-23):** row 5 originally DROPPED the text;
  it now stays in place under its source key — invisible (grid/serializers/validators iterate
  declared languages only; the XLSForm writer explicitly filters undeclared keys so exports
  never implicitly declare a language) — and a later `addLanguage` runs
  `adoptDormantTranslations`, which uses the SAME `matchLanguage` (exact/code/name-part)
  helper to surface the text under the newly declared language. On a first-language add,
  adoption runs before the sentinel move, so a differing sentinel value survives as the
  established Unassigned-column conflict. Sentinel debris from a mixed-shape source is still
  dropped (retaining it would break two-clean-shapes). Two-clean-shapes (a sentinel-content
  invariant) holds: dormant keys are named languages, never the sentinel; tests still assert
  `normalizeDefaultContent(doc).changed === false` post-merge. Rationale for
  adopt-not-addLanguage-at-paste stands: `addLanguage` is a doc-restructuring migration — too
  large a side effect for a paste; `MergeResult` reports dormant languages for a toast that
  points the user at Form menu → Translations.
- **saveTo policy** (corrected rationale, correction #5): target has no `doc.entities` → strip
  `saveTo` + count in `strippedSaveTo` — keeping it would instantly raise the
  `entities.saveto-without-declaration` ERROR on the target form. Target declares entities →
  keep (existing validators flag conflicts visibly).

## Task 4 — Transport `src/clipboard/` (new, app-level; mirrors the theme pure-vs-apply split)

- `buffer.ts`: `writeClipboardBuffer` (in-memory slot always; localStorage
  `formforge.clipboard.v1` when ≤ MAX_BUFFER_CHARS, try/catch — partitioned embed iframes
  degrade silently), `readClipboardBuffer` (newest `copiedAt` of memory vs localStorage wins),
  `hasClipboardBuffer`, `onClipboardBufferChange(cb)` (local writes + window `'storage'` events
  ⇒ cross-tab paste-button reactivity).
- `system.ts`: `writeSystemClipboard(json)` (fire-and-forget `navigator.clipboard.writeText`),
  `applyToClipboardEvent(e, json)` (`setData('application/json')` + `'text/plain'`),
  `payloadFromClipboardEvent(e)` (json → text sniff).

## Task 5 — Form store actions (`src/stores/form.ts`)

All early-return **before** `mutate` on empty/invalid input (`mutate` form.ts:297 pushes undo
unconditionally); one `mutate` each:
- `copyNodes(ids) → NodesPayload | null` (no mutation)
- `cutNodes(ids)` — copy + one mutate removing top-most ids (reverse doc order); undo restores
  nodes, buffer survives (standard cut semantics)
- `deleteNodes(ids)`
- `pasteNodes(payload, target?) → MergeResult | null` — stale/non-container target falls back to
  root-append *before* mutate
- `insertTemplate(templateDoc) → MergeResult | null` — payload from the whole template tree,
  merged at doc end
- Multi-move wrappers: `moveSelectionBy(ids, delta)`, `indentSelection(ids)`,
  `outdentSelection(ids)` — one `mutate(translate('stores.form.undoMoveQuestions'), …)` each;
  no-op (no undo entry) when the core helper aborts.
- New undo-label keys ×3 locales (`stores.json`, following the existing `undoAddQuestion` set):
  `undoCutQuestions`, `undoDeleteQuestions`, `undoPasteQuestions`, `undoInsertTemplate`,
  `undoMoveQuestions`. Stores use `translate()` (not `useAppI18n`).

## Task 6 — Editor store selection set (`src/stores/editor.ts`)

`selectedNodeId` keeps its meaning (ACTIVE/anchor — consumer audit verified: FormEditorView
railed + addFromPalette, EditorTabs, TreeNodeCard, PropertyPanel, PreviewPanel/followSelection —
all anchor-based or `select(id)` callers, none change). Add:
`selectedNodeIds: ref<Set<string>>` (invariant: anchor ∈ set unless empty), `select(id)`
(collapses set — existing signature/behavior extended), `toggleSelect(id)` (toggled-in becomes
anchor; toggling anchor out → last remaining by insertion order), `selectRange(id, orderedIds)`
(anchor stays; repeated shift-clicks re-range), `selectMany(ids)`, `pruneSelection(existingIds)`
(drop stale ids, fix anchor), `reset()` also clears the set. Also add `'insert-template'` to the
`EditorDialog` union.

## Task 7 — `src/composables/useSelectionActions.ts` (new) — the one UI surface

`canCut/canCopy/canDelete` (selection non-empty), `canPaste` (reactive via
`onClipboardBufferChange` + doc loaded), `copySelection` (store → buffer + best-effort system
write), `cutSelection`, `deleteSelection` (+ `select(null)` after), `pasteClipboard()` (buffer
only — no permission prompt), `handleCopyEvent/handleCutEvent/handlePasteEvent(e)` (native path:
event data first, buffer fallback), paste-target resolution (mirrors the addFromPalette rule,
FormEditorView.vue:140-159: into selected open group at end → right after selection → end of
form), post-paste `selectMany(insertedIds)` + `revealNodeId = first` (existing reveal+flash
mechanics, TreeNodeCard.revealIfTargeted) + toast on
`dormantLanguages`/`attachmentFilenames`/`strippedSaveTo` (informational, i18n).

## Task 8 — TreeNodeCard + NodeList (multi-select interaction & multi-drag)

**`src/components/canvas/TreeNodeCard.vue`**:
- `selected` computed → `editor.selectedNodeIds.has(node.id)`; keep the single `.selected`
  visual for all selected cards.
- Replace `@click.stop="select"` with `onCardClick($event)` — plain/ctrl/shift per matrix;
  `@mousedown` sets a pointer flag (+ `preventDefault` when `shiftKey` to kill text selection);
  `@focus` guarded: no-op during pointer interaction, else `select(id)` (keyboard collapses to
  single — standard tree behavior).
- Delete key / `delete-node` button: node ∈ multi-selection → `deleteSelection()`, else existing
  single `removeNodeById`. Duplicate button unchanged.
- Alt+Arrow branches become selection-aware (same pattern): node ∈ multi-selection →
  `form.moveSelectionBy(ids, ±1)` / `indentSelection` / `outdentSelection`, else existing
  single-node `moveBy`/`indent`/`outdent`. `refocus()` unchanged.

**`src/components/canvas/NodeList.vue`** — gather-on-drop (vue-draggable-plus ^0.6.1 bundles
its own sortablejs; the MultiDrag plugin can't be mounted — gather-on-drop avoids it):
- `onDragStart(evt)` records the dragged id from `evt.item.dataset.nodeId` (correction #1) and
  calls `beginTransaction` as today; `onDragEnd`: if dragged id ∈ `editor.selectedNodeIds`, size
  > 1, and dragged node ∈ `topMostNodes(selection)` → call `gatherNodesAfter(form.doc,
  selectedIds, draggedId)` directly on the live doc (NOT via `mutate` — that would fork a second
  undo entry), *then* `form.endTransaction()`. vdp's model-value splices land before `@end`;
  begin/end already bracket them (verified NodeList.vue:51-52, form.ts:346/355) — whole gesture
  = one "Move question" undo entry.
- Dragged card whose selected ancestor is also selected (dragged ∉ top-most) → single-node drag
  fallback, no gathering. Drops into groups work free (dragged lands via normal vdp path,
  followers gather after it there); TransitionGroup FLIP animates followers; only the dragged
  card ghosts (accepted v1, noted in spec).

**Interaction matrix**: plain click = single select · Ctrl/Cmd+Click = toggle · Shift+Click =
range over visible card order (`.node-card[data-node-id]` DOM order — excludes collapsed
children; a selected container implies its subtree for ops via `topMostNodes`) · empty-canvas
click / Escape = clear · Ctrl+A = select all root-level nodes · drag a selected card = whole
selection moves · Alt+Arrows on a selected card = whole selection moves/indents/outdents.

## Task 9 — FormEditorView: layout, keyboard, clipboard events, pruning

- Wrap the canvas: `<section class="canvas-panel" v-show="mode !== 'tablet' ||
  editor.activePane === 'canvas'"><CanvasToolbar /><main class="editor-canvas" role="tree"
  aria-multiselectable="true" …>` — flex column, toolbar `flex-shrink:0`, `.editor-canvas {
  flex:1; overflow-y:auto }`. Grid tracks are positional — unaffected. Move the v-show from
  `<main>` (currently :333) to the section; update tablet CSS selectors `> .editor-canvas` →
  `> .canvas-panel` (~:421-426).
- `#title-actions` → plain `<span class="form-title" data-testid="editor-form-title">`
  (truncation CSS kept/renamed); `formMenu` ref/Menu/caret removed from the view (they move to
  CanvasToolbar); AppHeader's shrink rule removed (correction #3).
- `onGlobalKeydown` additions (behind the existing `inInput` guard, after the palette-drawer
  Escape branch): Delete/Backspace → `deleteSelection` when selection non-empty; Ctrl/Cmd+A →
  `preventDefault` + select all root nodes (guard `activeDialog === null`); Escape → clear
  selection (guard `activeDialog === null && !centralDrawerOpen`).
  **Delivery refinement (e2e-caught):** all three selection branches additionally require the
  key event to originate from `.canvas-panel` or `body` (`inSelectionScope`), and Escape also
  requires NO PrimeVue overlay in the DOM (`overlayOpen()`), because PrimeVue overlays close on
  the SAME Escape keydown *before* this window-level bubble handler runs — a bare
  `activeDialog === null` guard races and cleared the selection as a side effect of closing the
  problems popover / attachments dialog (broke dataset-upload/dataset-tooling/entities/
  media-labels e2e).
- Document-level `copy`/`cut`/`paste` ClipboardEvent listeners (registered/removed with the
  existing keydown pair, :205-212): act + `preventDefault` only when `activeDialog === null` ∧
  not `inInput` ∧ `window.getSelection()?.isCollapsed !== false` ∧ (copy/cut: selection
  non-empty | paste: event/buffer carries our payload). Document-level, not canvas-element
  (focus sits outside the tree after toolbar clicks).
- Stale-selection pruning: `watch(() => form.revision)` (revision ref exists, form.ts:49) →
  `editor.pruneSelection(new Set(flatten(doc.children).map(n => n.id)))` — covers
  undo/redo/drag/card-delete.
- Render `<GuideCallout id="multiSelect">` at the top of `.canvas-inner` with a
  `<GuideTrigger guide="canvas">` in its slot (Task 12).

## Task 10 — CanvasToolbar + AppHeader cleanup

**`src/components/canvas/CanvasToolbar.vue`** (new):
- Left: `<UndoRedoButtons />` (moved by reuse from AppHeader), `<ToolbarSeparator />`,
  Cut/Copy/Paste/Delete (icon-only convention: `severity="secondary" text` + tooltip +
  aria-label), selection chip "{count} selected" + clear × when size > 1. Right (after
  `margin-inline-start:auto`): gear `pi pi-cog` with **`data-testid="form-menu"`**, toggling the
  relocated `formMenuItems` Menu (all 4 existing items — shell.editor.formSettings/translations/
  choiceLists/attachments, same labels so the 15 e2e `getByRole('menuitem')` flows survive) +
  `{separator}` + "Insert from template…" (`editor.activeDialog = 'insert-template'`).
- Icons: Cut `pi pi-file-export`, Copy `pi pi-copy`, Paste `pi pi-clipboard`, Delete
  `pi pi-trash`, gear `pi pi-cog` (all verified present).
- Tooltips carry shortcuts with `{mod}` interpolation (⌘/Ctrl via platform sniff); paste tooltip
  switches to "Nothing to paste" when disabled.
- CSS from existing tokens only (stylelint gate): `var(--builder-panel-*)`, `var(--odk-spacing-*)`.
- **`AppHeader.vue`**: remove UndoRedoButtons + its ToolbarSeparator + the form-menu shrink rule.

## Task 11 — InsertTemplateDialog + `migrateTemplateDoc` extraction

**`src/components/library/InsertTemplateDialog.vue`** (new) — slim picker, deliberately NOT
extracted from NewFormDialog (its two-step flow, management actions and heavy e2e make
extraction riskier than ~40 lines of duplicated card CSS):
- Wired via the `EditorDialog` union + one line in `src/components/EditorDialogs.vue`
  (correction #6). Grid of read-only cards: visible bundled starters (respects
  `ui.isBundledTemplateHidden`) + local templates (`listTemplates()` on open, `shallowRef`).
  Click → load doc (bundled `template.load()`; local via `migrateTemplateDoc`) →
  `form.insertTemplate(doc)` → close, `selectMany(insertedIds)` + reveal/flash first. No confirm
  step — one click, fully undoable. Empty state + testid.
- **`migrateTemplateDoc(raw)`** extracted into `src/templates/index.ts`; refactor BOTH
  NewFormDialog's `migrateLocalDoc` AND `loadTemplate` onto it (correction #7).

## Task 12 — Guides & callout (en + fr + es, typecheck-enforced)

- **New `canvas` guide**: `src/help/content.ts` — add `'canvas'` to the `GuideKey` union + a
  `guideHelp.canvas` entry (title/summary/≈6 steps: multi-select via Ctrl+Click & Shift+Click ·
  toolbar cut/copy/paste/delete + shortcuts · paste between forms · moving the selection by drag
  or Alt+Arrows incl. into a group · Insert from template via the gear menu · undo covers every
  bulk action in one step) + required `searchKeywords`
  (`['multi-select','copy','paste','clipboard','move','toolbar']`); no `docsUrl` (app-specific,
  like backup/autosave). `src/help/guides.ts`: add `'canvas'` to `GUIDE_KEYS` near the top.
  `guides.json` ×3 locales: matching `guides.canvas` block (`steps.{1..N}`; EN parity gated by
  `guides-content.spec.ts`, fr/es parity by `satisfies MessageSchema`).
- **`keyboard` guide** (5 steps today): extend with Ctrl+X/C/V on the selection, Ctrl+A, Escape
  clears selection, Delete deletes the whole selection; note Alt+Arrows move the whole
  selection. **`templates` guide** (4 steps today): add an "Insert from template into an
  existing form via the canvas gear menu" step. Step-count changes mirrored in `guideHelp` step
  arrays AND all three catalogs (spec-enforced). `guides.spec.ts` e2e pins only
  logic/translations/backup text — keyboard/templates edits are safe.
- **First-use callout**: add `'multiSelect'` to `CalloutId` (content.ts:100) +
  `guides.callouts.multiSelect.{title,body}` ×3; render `<GuideCallout id="multiSelect">` at the
  top of `.canvas-inner` (FormEditorView) with a `<GuideTrigger guide="canvas">` in its slot
  (GuideCallout has a default slot; precedents: TranslationsDialog:109, ConditionBuilder:300).
  Backed by the existing `ui.dismissedCallouts` — no new ui pref, no STORAGE_VERSION change.

## Task 13 — i18n keys (en + fr + es)

- `canvas.json`: `canvas.toolbar.{cut,copy,paste,delete,cutLabel,copyLabel,pasteLabel,
  deleteLabel,pasteEmpty,selectionCount,clearSelection}`; `canvas.insertTemplate.{header,hint,
  empty}` + paste-toast keys.
- `shell.json`: `shell.editor.{insertFromTemplate,formMenuOpen}` (menu item labels reused).
- `stores.json`: the five new undo labels (Task 5). Existing rendered English stays byte-stable.
- `guides.json`: Task 12 keys.
- fr/es terminology anchored to the ODK-ecosystem glossary in
  `docs/specs/2026-07-16-1125-ui-localization-fr-es/`.

## Task 14 — Tests

- **Unit (core)**: extend `ops.spec.ts` (`topMostNodes`, `uniqueNameIn` + property-test parity
  clause — fast-check ^4 available); new `multi-ops.spec.ts` (block move up/down with
  non-contiguous gaps, edge abort leaves doc untouched, contiguous indent fold, reverse-order
  outdent, cross-parent gather into group, dragged-descendant fallback,
  container-into-own-subtree no-op, doc order preserved; extend the random-ops property test);
  `translations.spec.ts` sub-walker parity; new `payload.spec.ts` (round-trip,
  reachable-lists-only, implicit-csv filename, version-2 rejection, sniff never throws); new
  `merge.spec.ts` — the big one: N-sibling name dedup, list matrix
  (added/reused/renamed/shared/identical-after-remap), language matrix (A→A, A→B, B→A, B→B ×
  exact/code/name/primary-fallback/dormant) with `normalizeDefaultContent` invariant assertion,
  saveTo both branches, invalid target → null + doc untouched, payload immutability across
  double merge, fast-check property (post-merge unique names, resolving listRefs, invariant).
  Fixtures via `tests/helpers/doc-builders.ts` (`q`/`group`/`repeat`/`choice`/`doc`).
- **Unit (transport)**: `buffer.spec.ts` — round-trip, oversize → memory-only, corrupt
  localStorage fallback, newest-copiedAt wins, storage-event reactivity, no-throw on
  quota/SecurityError.
- **Unit (stores)**: form — copy adds zero undo entries; cut/delete/paste/insertTemplate/
  moveSelectionBy/indentSelection/outdentSelection exactly one entry each (zero on aborted
  moves), single undo fully restores; cross-doc paste fixture; drag transaction (begin →
  vdp-style splice + gatherNodesAfter → end = ONE undo entry). Editor —
  select/toggle/range/many/prune matrix incl. anchor fallback.
- **Component** (pattern: `freshPinia()` + `mountWith`, `settle()` helper): extend
  `tree-node-card.spec.ts` (ctrl toggle, shift range, focus-during-pointer no-op, multi-Delete,
  Alt+ArrowDown with multi-selection moves the block); new `canvas-toolbar.spec.ts` (disabled
  states, chip, gear menu = 5 items + separator, undo/redo present); new
  `insert-template-dialog.spec.ts` (mirror `help-guides.spec.ts`). Guides:
  `guides-content.spec.ts` + `help-guides.spec.ts` gate the new guide via their loops.
- **e2e** (new `multiselect-clipboard.spec.ts`; helpers `createForm`/`addQuestion` click the
  palette — no drag simulation needed, gather-on-drop is covered by the store transaction unit
  test + the manual agent-browser pass): ctrl-click two → cut → paste → order + single-undo; cut
  in form A → library → form B → paste (cross-form buffer); insert-from-template via gear;
  multi-move: ctrl-click two → Alt+ArrowDown → order asserted → one Ctrl+Z restores. Existing
  specs survive: 15 `form-menu` flows (gear keeps testid + labels), `editor.spec.ts`
  keyboard-only undo/redo untouched.

## Task 15 — Docs & process

- `docs/product/roadmap.md` → Known follow-ups: bulk property editing for canvas
  multi-selection (user-requested) + optional blob-copy on cross-form paste (payload hook
  reserved).
- Update `CLAUDE.md` code map (new `src/core/clipboard/`, `src/clipboard/`, CanvasToolbar,
  selection model, store actions, moved undo/redo, gear-hosted form menu) + README Features in
  the same change.

## Testids

Preserved: `form-menu` (now the gear), `editor-form-title` (now a span), `node-card-<name>`,
`delete-node`, `canvas-list`, `container-list-<id>`. New: `canvas-toolbar`,
`toolbar-cut/copy/paste/delete`, `selection-count`, `selection-clear`, `insert-template-dialog`,
`insert-template-card-<id>`, `insert-template-local`, `insert-template-empty`.
(The backlog listed `undo`/`redo` as preserved testids — they never existed; nothing to
preserve.)

## Execution strategy (per established delivery workflow)

Dynamic Workflow orchestration with parallel agents; `model: 'sonnet'` for standard
implementation stages; session model for orchestration and review. Phases follow the
dependency chain:

1. **Parallel wave 1** (independent files): Task 2 (core helpers) ∥ Task 4 (transport) ∥
   Task 12 guides + all EN i18n keys.
2. **Wave 2**: Task 3 (core clipboard — needs Task 2).
3. **Wave 3**: Tasks 5-6 (stores) → Task 7 (composable).
4. **Wave 4** (disjoint files, parallel): Task 8 (cards/drag) ∥ Task 10 (toolbar/header) ∥
   Task 11 (dialog) → Task 9 (view integration, sequential last — touches shared seams).
5. fr/es catalog mirroring (glossary-anchored translation) after all EN keys land; e2e spec
   after UI integration; Task 15 docs last.

## Verification

- `pnpm test` (unit + component), `pnpm lint` (stylelint token guard), `pnpm typecheck` (fr/es
  mirror enforcement), `pnpm test:e2e`, `pnpm test:coverage` floors (core 86/78/88, stores
  80/85). Goldens untouched — no serializer/parser change anywhere.
- Manual agent-browser pass: multi-select visuals light/dark, toolbar disabled/enabled states,
  chip, gear menu, cross-tab paste (two tabs), multi-drag gather-on-drop into a group + FLIP +
  single undo, embed demo page (buffer falls back to memory), reduced-motion, new canvas guide +
  callout in en/fr/es (switch interface language in Settings); log to `docs/verification/`.
- Then `/unops-toolkit:interface-craft` critique of the built toolbar + `/unops-toolkit:code-review`
  (no plan mode), fix verified findings immediately, re-run gates.
- Conventional commit (no Co-Authored-By trailer) only after user confirmation.
