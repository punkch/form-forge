# References — canvas multi-select/clipboard/toolbar/insert-from-template

Seams studied during shaping + verification (three exploration agents, 2026-07-23).

## Canvas interaction

- `src/components/canvas/TreeNodeCard.vue` — selection on `@click.stop` + `@focus` (:128-129),
  `selected` computed vs `editor.selectedNodeId` (:32), Alt+Arrow → store
  `moveBy/indent/outdent` (:96-103), Delete key → `removeNodeById` (:104-105), `refocus()`
  (:88-93), reveal+flash via `editor.revealNodeId` (:67-81), `:data-node-id` (:127).
- `src/components/canvas/NodeList.vue` — VueDraggable component wiring (:56-68), splice-in-place
  `onListUpdate` (:29-49) with `{paletteType}` materialization, `beginTransaction`/
  `endTransaction` in `@start`/`@end` (:51-52), TransitionGroup keyed by `node.id`.
- `src/views/FormEditorView.vue` — `addFromPalette` placement rule (:140-159, the paste-target
  precedent), `onGlobalKeydown` (:183-203, palette-drawer Escape branch first, `inInput` guard),
  listener registration (:205-212), `#title-actions` form-menu button + Menu (:253-265),
  `formMenuItems` (:225-230), tablet CSS (:421-426), `.canvas-inner` (:339, CSS :471-474).

## Stores

- `src/stores/form.ts` — `mutate` (:297, unconditional undo push, opt-in coalesce),
  `beginTransaction`/`endTransaction` (:346/:355, snapshot-at-begin, drop-on-JSON-equality),
  `revision` (:49), `moveBy`/`indent`/`outdent` (:399-431), `deepToRaw` proxy-safe snapshot
  (:92-103 — why JSON-clone, not structuredClone).
- `src/stores/editor.ts` — `EditorDialog` union (:6-15), `select(id)` (:41), `revealNodeId`
  (:31). Consumers of `selectedNodeId` audited: FormEditorView (railed :70, addFromPalette
  :148), EditorTabs:29, TreeNodeCard:32, PropertyPanel:29, PreviewPanel:32-39,
  followSelection.ts:81-85 — all anchor-based; none change.
- `src/stores/ui.ts` — `dismissedCallouts` (:153-157, :191-197) — callout persistence;
  additive-field discipline (no STORAGE_VERSION bump) noted but NOT needed here.

## Core model

- `src/core/model/ops.ts` — `insertNode` (:53), `moveNode` (:92, forward-index compensation +
  `containsNode` guard), `cloneSubtree` JSON-clone precedent (:120), `allNames` (:131),
  `uniqueName` (:138); ops.spec.ts fast-check random-ops property test (:136-193).
- `src/core/model/translations.ts` — `transformLocalizedTexts` walk sites (:87), `langsOf`
  (:51), `languageKey`/`languageCode` (:22-31), `normalizeDefaultContent` (:165);
  `primaryLang` re-export (display.ts:11).
- `src/core/model/rename-attachment.ts` `collectAttachmentReferences` (:34);
  `src/core/registry/question-types.ts` `effectiveItemsetFile` (:756);
  `src/core/validate/refs.ts` `entities.saveto-without-declaration` (:74-81) — drives the
  merge's saveTo-strip policy; `src/core/util/guards.ts` `isRecord`/`hasText`.

## Templates & guides

- `src/templates/index.ts` — `BundledTemplate.load()` (:12-21), `loadTemplate` migrate guard
  (:25-31, unified into `migrateTemplateDoc`).
- `src/components/library/NewFormDialog.vue` — `migrateLocalDoc` (:128-134, refactored onto
  `migrateTemplateDoc`), `.actionable-card` CSS (:481-503, borrowed ~40 lines for the slim
  picker — deliberately NOT extracted), `visibleBundled` (:45-47).
- `src/help/content.ts` — `GuideKey` union (:115-124), `GuideHelp` shape (:102-113), `CalloutId`
  (:100); `src/help/guides.ts` GUIDE_KEYS (:11-21); `tests/unit/guides-content.spec.ts` gates;
  GuideCallout precedents: TranslationsDialog.vue:109, ConditionBuilder.vue:300.

## Shell & tests

- `src/components/shell/AppHeader.vue` — UndoRedoButtons at :43, form-menu shrink rule
  (:103-107, to remove); `src/components/shell/UndoRedoButtons.vue` (no testids).
- `src/components/EditorDialogs.vue` — flat self-gating dialog list (mount pattern for
  InsertTemplateDialog).
- `tests/component/helpers.ts` `freshPinia`/`mountWith`; `tests/component/help-guides.spec.ts`
  (`settle()` pattern to mirror); `tests/helpers/doc-builders.ts` (`q`/`group`/`repeat`/
  `choice`/`doc`); `tests/e2e/helpers.ts` (`createForm`, `addQuestion` — palette click, no drag
  helper); 15 `form-menu` e2e usages across 7 spec files.

## Prior spec folders

- `docs/specs/2026-07-16-1125-ui-localization-fr-es/` — fr/es terminology glossary.
- `docs/specs/2026-07-17-1632-motion-polish/standards.md` — motion token rules.
