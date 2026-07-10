# References — External Dataset Tooling

## Files changed

- `src/core/xlsform/workbook-read.ts` — new `readCsvRows(text, maxRows?)`
  (BOM strip, `raw: true` verbatim text, `sheetRows` cap; reuses
  `sheetRows()` extraction).
- `src/core/datasets/parse.ts` (new) — `parseDataset`, `datasetColumnsOf`,
  `datasetFormatOf`, `defaultDatasetParams`, `DATASET_PREVIEW_ROW_CAP`.
- `src/core/validate/datasets.ts` (new) — `validateDatasets`,
  `filterColumnCandidates`; issue codes `dataset.unknown-column`
  (warning), `dataset.filter-unknown-column` (info) and parse-side
  `dataset.empty` / `dataset.invalid-geojson`.
- `src/core/validate/index.ts` — optional `ValidateContext` parameter on
  `validateDocument`; dataset validation runs only when
  `context.datasetColumns` is provided.
- `src/stores/form.ts` — dataset-columns section: per-attachment-id cache
  (`shallowRef`), debounced (250ms) async refresher watching the
  csv/geojson `(id, filename)` ref pairs, `datasetColumnsByFilename`
  computed, `runValidation()` passes the context.
- `src/stores/editor.ts` — `'dataset-preview'` in the dialog union,
  `datasetPreviewFilename` ref, `openDatasetPreview()`, reset handling.
- `src/components/datasets/DatasetPreviewDialog.vue` (new) — DataTable
  (virtual scroller) / raw `<pre>` preview, truncation banner
  (`dataset-preview-truncated`), parse-issue lines, missing state.
- `src/components/properties/TypeConfigSection.vue` — editable column
  Selects for value/label params (`prop-param-value` / `prop-param-label`
  keep their testids), per-format default placeholders, View file button
  (`prop-itemset-view`), actions row.
- `src/components/attachments/AttachmentsDialog.vue` — per-row eye button
  (`attachment-view`) for csv/geojson/xml files.
- `src/components/EditorDialogs.vue` — mounts `DatasetPreviewDialog`.
- `src/i18n/locales/en/properties.json` — `typeConfig.viewFile`.
- `src/i18n/locales/en/dialogs.json` — `attachments.viewFile`,
  `datasetPreview.*` (header, loading, missing, empty, truncated, close).

## Tests added

- `src/core/datasets/parse.spec.ts`
- `src/core/validate/datasets.spec.ts`
- `src/stores/form-datasets.spec.ts`
- `tests/component/type-config-columns.spec.ts`
- `tests/e2e/dataset-tooling.spec.ts`

## Files consulted (unchanged)

- `src/core/registry/question-types.ts` — `effectiveItemsetFile()` (from
  F3a) is the single source of truth for which filename a question
  references.
- `src/core/validate/refs.ts` — `ref.missing-attachment` stays the
  absent-file signal; dataset validation deliberately does not duplicate it.
- `src/core/expr/tokenizer.ts` — `maskStringLiterals` reused by the
  choice_filter candidate extraction.
- `src/composables/useAttachmentUpload.ts` — upload path (F3a) that the
  store's refresher piggybacks on (new ref pairs trigger parsing).
- `src/persistence/attachments-repo.ts` — blob loading for the refresher
  and the preview dialog (works against both Dexie and the embed memory
  backend).

## External references

- ODK docs — "Selects from an external file" and "Building selects from
  geojson files": default value/label columns (name/label; id/title),
  top-level FeatureCollection requirement, geometry column semantics.
- SheetJS parsing options — `raw`, `sheetRows`, `type: 'string'` CSV input.
