# References — Dataset Upload from the Property Panel

## Files changed

- `src/composables/useAttachmentUpload.ts` — new shared upload composable:
  `roleFor()` classification, `attachFile()` with filename override,
  same-undo-step `alsoMutate` hook, superseded-record deletion.
- `src/components/attachments/AttachmentsDialog.vue` — refactored onto the
  composable (upload loop now `attachFile(file)` per file; role
  classification and ref replacement moved out verbatim).
- `src/components/properties/TypeConfigSection.vue` — status line
  (`prop-itemset-status` with `data-state`), rename hint
  (`prop-itemset-renamed`), hidden file input
  (`prop-itemset-upload-input`, accept `.csv,.xml,.geojson`),
  Upload/Replace button (`prop-itemset-upload`), effective-filename
  computed, csv-external placeholder.
- `src/core/validate/refs.ts` — `ref.missing-attachment` checks the
  serializer's effective itemset filename (csv-external defaults to
  `${name}.csv`).
- `src/i18n/locales/en/properties.json` — `properties.typeConfig.*` keys:
  fileAttached, fileMissing, fileNone, uploadFile, replaceFile, storedAs,
  undoUploadChoicesFile.
- `src/core/validate/refs.spec.ts` — new unit spec.
- `tests/component/type-config-upload.spec.ts` — new component spec
  (mocked attachments repo).
- `tests/e2e/dataset-upload.spec.ts` — new e2e spec (from-file itemset flow
  and csv-external + pulldata flow).

## Files consulted (unchanged)

- `src/core/xform/serializer.ts` — external-instance collection
  (`node.itemsetFile ?? node.name + '.csv'` for csv-external) mirrored by
  the panel and the validator.
- `src/core/registry/question-types.ts` — `requiresFile` types
  (select_one_from_file, select_multiple_from_file, csv-external) and their
  default value/label parameters.
- `src/preview/fetchFormAttachment.ts`, `src/stores/preview.ts` — verified
  that attachments are resolved by filename and any `form.mutate` remounts
  the preview, so no extra wiring was needed.
- `src/persistence/attachments-repo.ts` — add/delete/list API used by the
  composable.
- `src/stores/form.ts` — `mutate()` single-gateway semantics (undo snapshot
  before `fn`, validation debounce).
- `tests/component/property-panel.spec.ts`,
  `tests/component/workspace-archive-dialog.spec.ts` — component test
  patterns (freshPinia/mountWith, vi.hoisted mocks).
- `tests/e2e/preview.spec.ts`, `tests/e2e/workspace-archive.spec.ts` — e2e
  polling patterns and `setInputFiles` buffer uploads.
