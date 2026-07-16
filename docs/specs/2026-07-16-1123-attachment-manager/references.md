# References — attachment manager

Promoted 2026-07-16 from `docs/specs/backlog/attachment-manager.md`. The
file:line anchors below were re-verified against code on 2026-07-16 and
correct several details the backlog doc stated loosely or wrongly — see the
"Corrections from the backlog doc" note at the end of each section.

## Code — the bug

- `src/stores/form.ts:75` — `snapshotDoc = (): FormDocument =>
  structuredClone(toRaw(doc.value)) as FormDocument`. `toRaw` unwraps only
  the outermost reactive Proxy; a nested Proxy surviving inside
  `doc.attachments` makes `structuredClone` throw `DataCloneError`. Called
  from `flushSave` (:171), `mutate` (:236), `undo` (:252), `redo` (:263) and
  `beginTransaction` (:280) — any of these can start failing once the doc is
  poisoned.
- `src/stores/form.ts:202-219` — `close()`: the **existing** superseded-
  record pruning (`attachmentsRepo.pruneOrphans(recordId, referenced)`
  where `referenced` is built from `doc.value.attachments` only, since undo
  history is discarded on the next lines). This stays unchanged; the new
  dialog-open sweep is a separate call site with a wider protected set
  (current doc **and** every `undoStack`/`redoStack` entry's attachments).
- `src/composables/useAttachmentUpload.ts:35-58` — `attachFile(file,
  filenameOverride?, {undoLabel, alsoMutate})`. The suspect mutate,
  :43-56: `d.attachments = d.attachments.filter((a) => a.filename !==
  filename)` followed by `d.attachments.push({...})` — filtering *through*
  the reactive `d` and then pushing onto the freshly (re-)assigned property
  is the shape that leaves a nested Proxy in the raw array. `remove()` in
  `AttachmentsDialog.vue` (:41-47 below) does the filter-and-reassign half
  only, with no follow-up push, and did **not** reproduce the poisoning —
  pin the fix to the push-after-reassign step, not the filter/reassign
  itself.
- `tests/component/attachment-upload.spec.ts:45-46` — a code comment
  already flags the risk: "avoids accumulating reactive refs that
  happy-dom's structuredClone trips on" — corroborating evidence the class
  of bug was already suspected here, though no regression test previously
  pinned it.
- **No existing regression test for the poisoning.**
  `src/stores/form.spec.ts:112-124` (undo-after-replace) and :127-139
  (prune-on-close) are adjacent coverage only — neither reproduces the
  same-filename-while-other-attachments-exist sequence that triggers the
  bug.

**Correction from the backlog doc:** the backlog cites "tests/unit/
form.spec.ts" for the adjacent tests; the real path is `src/stores/
form.spec.ts` (co-located with the store, not under `tests/unit/`).

## Code — current dialog & repo

- `src/components/attachments/AttachmentsDialog.vue` — `records = ref<
  AttachmentRecord[]>([])` populated by `refresh()` (:27-29) from
  `attachmentsRepo.listAttachments(form.recordId)` — raw storage records,
  not `doc.attachments` refs; this is the duplicate-row cause. `upload()`
  (:33-39), `remove()` (:41-47, filter-only — did not poison), `formatSize`
  (:49-54). Testids: `attachments-dialog` (:63), `attachment-view` (:87,
  dataset preview only — gated on `datasetFormatOf`), `attachment-upload`
  (:114), `attachment-file-input` (:108). The delete button carries **no**
  testid today (aria-label only) — a precedent this feature is free to
  follow or break for its own new per-row controls.
- `src/persistence/attachments-repo.ts` — `listAttachments`,
  `getAttachment`, `addAttachment` (:12-27, mints `id` via `newId()`),
  `deleteAttachment`, `pruneOrphans` (:33-37, the shared prune primitive
  both `close()` and the new dialog-open sweep call through). No
  `renameAttachment` exists yet — new for this feature.
- `src/persistence/backend.ts:67-74` — the `PersistenceBackend` attachment
  methods (`listAttachments`, `getAttachment`, `bulkGetAttachments`,
  `addAttachment`, `bulkAddAttachments`, `deleteAttachment`,
  `bulkDeleteAttachments`); Dexie impl :140-146, memory impl in
  `src/persistence/memory-backend.ts:132-152` (a plain `Map<string,
  AttachmentRecord>`, `cloneAttachment` at :19 does a shallow `{...record}`
  copy). `renameAttachment` is added to both.
- `src/persistence/db.ts:22-30` — `AttachmentRecord { id, formRecordId,
  filename, mediatype, size, blob }`. **Correction from the backlog doc:**
  the field is `formRecordId`, not `formId` (the backlog's "Current
  implementation" section states `formId` — that name does not exist on
  this record). `db.ts:146` — `attachments: 'id, formRecordId'`: `filename`
  is **not** indexed, confirming no Dexie schema bump is needed for a
  rename.
- `src/core/model/attachment-role.ts:8-15` — `roleFor(filename, mediatype)`:
  extension first (`csv`/`geojson`/`xml`), then mimetype prefix
  (`image/`/`audio/`/`video/` → `media`), else `other`. Locking the
  extension on rename (Decision 2) means `roleFor` never needs to be
  recomputed post-rename.

## Code — reference sites a rename must rewrite

- `src/core/model/types.ts:157-165` — `AttachmentRef { id, filename,
  mediatype, size, role }`. **Correction from the backlog doc:** this
  already carries `mediatype`/`size`, so the dialog's row model needs no
  join back to `AttachmentRecord` (see `shape.md` Decision 1).
- `src/core/model/types.ts:29-34` — `MediaRefs { image?, audio?, video?,
  bigImage? }`, each a `LocalizedText` (`Partial<Record<Lang, string>>`)
  mapping language → filename.
- `src/core/model/types.ts:68` — `media?: MediaRefs` on every node
  (`BaseNode`, question **and** container labels).
- `src/core/model/types.ts:90` — `itemsetFile?: string` on `QuestionNode`.
- `src/core/model/types.ts:115` — `media?: MediaRefs` on `Choice` (choice-
  label media, the same four keys).
- `src/core/registry/question-types.ts:756-757` — `effectiveItemsetFile =
  (node) => node.itemsetFile ?? (node.type === 'csv-external' ?
  \`${node.name}.csv\` : undefined)` — the single source of truth for the
  *implicit* reference a rename must also catch (Decision: auto-
  materialize).
- `src/core/validate/refs.ts` — the existing missing-attachment scan
  (`validateRefs`): walks `visit(doc.children, …)` for `itemsetFile` and
  per-language `media.image/audio/video/bigImage` (:76-87), then a second
  loop over `Object.values(doc.choiceLists)` for choice-level media
  (:92-107). This is the traversal shape `scanAttachmentReferences`/
  `renameAttachmentRefs` in the new core helper mirror (read-only scan vs.
  in-place rewrite), so reference-missing validation and rename rewriting
  agree on what "references this file" means.
- `src/core/model/ops.ts:5-16` — `visit(nodes, fn, parent?)`, the shared
  tree-walk primitive the new helper reuses.

## Code — the "stored as" precedent (per-row replace copy)

- `src/components/properties/TypeConfigSection.vue:77` —
  `renamedUpload = ref<{ original: string, storedAs: string } | null>`.
  `:129-151` `uploadFile()`: targeted replace via `attachFile(file,
  expected, {undoLabel})`(:149) where `expected = props.node.itemsetFile`;
  sets `renamedUpload` (:148) when the picked file's own name differs from
  the expected/stored name. `:194-196` renders the notice.
- `src/i18n/locales/en/properties.json` — `typeConfig.storedAs`: "Stored as
  {stored} (was {original}) so the question finds it." The new per-row
  replace notice in the attachments dialog reuses this **copy pattern**
  under a new `dialogs.attachments.*` key (the string does not move — it
  stays owned by `properties.json` for `TypeConfigSection`, per the
  verification note: new keys land in `dialogs.json`, `properties.json`
  changes only if the shared copy were to move, which it is not).

## Code — test surfaces this feature touches

- `src/stores/form.spec.ts:112-124` (undo-after-replace),
  `:127-139` (prune-on-close) — adjacent coverage the new regression tests
  sit beside.
- `tests/component/attachment-upload.spec.ts` — composable-level coverage
  of `attachFile`'s role classification and error paths; the fix to the
  mutate shape must not change any of its assertions.
- `tests/component/type-config-upload.spec.ts` — the "stored as"/replace/
  undo precedent this feature's per-row replace and rename mirror in style
  (mocked `@/persistence/attachments-repo`, `freshPinia`/`mountWith` from
  `tests/component/helpers.ts`, `global: { stubs: { teleport: true } }` for
  PrimeVue `Dialog` — see `tests/component/dataset-preview-dialog.spec.ts`
  for the Dialog-mounting pattern specifically).
- `tests/e2e/dataset-tooling.spec.ts:58-70`,
  `tests/e2e/workspace-archive.spec.ts:9-17,78-82` — open the dialog via
  `editor-more` → `getByRole('menuitem', { name: 'Attachments' })`, then
  assert `attachments-dialog` text content and use `attachment-file-input`/
  `attachment-view`. **Coordination:** `editor-toolbar-declutter` retires
  `editor-more` for a labeled "Form" menu; that stream integrates first,
  and this stream rebases and updates the navigation steps in both files
  (the assertions on dialog content/testids are otherwise unaffected).
- `tests/helpers/backends.ts` — `backendCases` (`describe.each`) used by
  every both-backend spec this feature adds or extends.
- `src/persistence/forms-repo.spec.ts:1-20` — the canonical
  `describe.each(backendCases)('… ($name backend)', ({ setup }) => {
  beforeEach(setup) … })` pattern the new persistence-level specs follow.

## Related specs

- `docs/specs/2026-07-15-1219-central-ux-enhancement/` — most recent
  promoted spec in this repo; its `plan.md`/`standards.md` are the format
  template this folder follows.
- `docs/specs/2026-07-15-1729-workspace-full-backup/` — the workspace
  backup this feature does **not** need to touch (no schema bump, no new
  persisted field beyond the existing `AttachmentRecord.filename`).
- `docs/specs/backlog/editor-toolbar-declutter.md` — the sibling stream
  that changes how the Attachments dialog is opened (see Coordination
  above); does not change the dialog's contents.
