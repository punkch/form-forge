# F3b/c — External Dataset Tooling (parsing, column-aware params, preview) — Plan

## Problem

After F3a (upload from the property panel), attached CSV/GeoJSON/XML files
were still opaque blobs: the `value`/`label` parameters of
`select_*_from_file` questions had to be typed blind, `choice_filter`
column references were unchecked, and there was no way to look inside an
attached file. Typos only surfaced at preview time.

## Design

### 1. `src/core/xlsform/workbook-read.ts` — `readCsvRows()`

Still the only module allowed to import `xlsx`. New
`readCsvRows(text, maxRows?)` parses CSV text via
`XLSX.read(text, { type: 'string', raw: true, sheetRows: maxRows })` and
reuses the existing `sheetRows()` extraction, so cell text survives
verbatim (leading zeros, date-like strings — `raw: true` disables SheetJS
value inference for plain-text input). A leading UTF-8 BOM is stripped;
empty input returns `[]`.

### 2. `src/core/datasets/parse.ts` (new, pure)

- `parseDataset(filename, data)` →
  `{ format, columns, rows, truncated, rawText?, issues }`:
  - **csv**: header row → columns, data rows capped at
    `DATASET_PREVIEW_ROW_CAP` (500) with a truncation flag (parse cap is
    502 rows, so huge files stay cheap); empty file → `dataset.empty`
    warning.
  - **geojson**: `JSON.parse` + top-level `FeatureCollection` required
    (`dataset.invalid-geojson` error otherwise). Columns = `id` (when
    features carry top-level ids) + union of `features[].properties` keys
    (first-seen order) + `geometry` (when any feature has one, cell shows
    the geometry type). Rows capped at 500.
  - **xml** (and unrecognized): no columns, `rawText` for the raw preview.
- `datasetColumnsOf(filename, data)` — fast header sniff (csv parses only
  row 1); returns `null` for xml/empty/malformed content, meaning
  "unknown — do not validate against this".
- `datasetFormatOf(filename)` — extension classification, shared with the
  UI entry points.
- `defaultDatasetParams(format)` — ODK's default value/label columns:
  csv → `name`/`label`, geojson → `id`/`title`.

### 3. `src/core/validate/datasets.ts` (new, pure)

`validateDatasets(doc, columnsByFilename)`:

- For from-file **selects** (types whose registry definition has a `value`
  parameter — csv-external is an opaque `instance()` source and is skipped)
  whose `effectiveItemsetFile` is a parsed key of the map:
  - warns `dataset.unknown-column` when the effective value/label column
    (explicit parameter or per-format default) is not among the file's
    columns; `null`/empty column sets stay silent; absent files keep
    `ref.missing-attachment` from refs.ts.
  - `choice_filter` references are checked best-effort as severity `info`
    (`dataset.filter-unknown-column`): `filterColumnCandidates()` masks
    string literals (tokenizer) and `${refs}`, skips function calls, path
    steps, `$vars`, `@attrs` and XPath operator words — conservative by
    construction, no false positives.

Wired into `validateDocument(doc, context?)` via the new optional
`ValidateContext` parameter, so validation stays pure/sync and existing
callers are untouched.

### 4. `src/stores/form.ts` — dataset columns section (additive)

- `datasetColumns: shallowRef<Map<attachmentId, columns | null>>` cache;
  a watcher over the `(id, filename)` pairs of csv/geojson attachment refs
  debounces (250ms) an async refresher that loads new blobs via the
  attachments repo, sniffs headers with `datasetColumnsOf`, then re-runs
  validation. Keyed by attachment id: a re-upload mints a new id, so stale
  entries fall out naturally; a generation counter drops superseded runs.
- `datasetColumnsByFilename` computed re-keys the cache by referenced
  filename — the shape consumed by `runValidation()` (as
  `ValidateContext.datasetColumns`) and the property panel.
- All work stays out of the `mutate()` hot path (watch source string only
  changes when the ref pairs change).

### 5. UI

- **`TypeConfigSection.vue`**: when columns are known for the question's
  effective file, the value/label parameter inputs upgrade to **editable**
  PrimeVue Selects listing the actual columns (same
  `prop-param-*` testids); unknown columns keep the InputText fallback.
  Placeholders show the per-format defaults (geojson: id/title). A
  **View file** button (`prop-itemset-view`) appears next to
  Upload/Replace when the file is attached.
- **`DatasetPreviewDialog.vue`** (new, mounted in `EditorDialogs.vue`):
  driven by `editor.activeDialog === 'dataset-preview'` +
  `editor.datasetPreviewFilename` (`openDatasetPreview()` helper).
  DataTable with virtual scrolling for csv/geojson, "first 500 rows"
  banner when truncated, `<pre>` raw-text mode for xml, parse issues
  surfaced inline.
- **`AttachmentsDialog.vue`**: per-row eye button (`attachment-view`) for
  csv/geojson/xml files opens the same preview.

## Tests

- `src/core/datasets/parse.spec.ts` — quoted commas, CRLF, BOM, leading
  zeros/date-likes, empty file, row cap/truncation, ArrayBuffer input,
  geojson columns/rows/malformed/non-FeatureCollection, xml raw mode,
  header fast path, format helpers.
- `src/core/validate/datasets.spec.ts` — explicit + default column
  warnings (csv and geojson defaults), null/absent/empty silence,
  csv-external and xml skipped, choice_filter info issues with
  no-false-positive cases, `validateDocument` context wiring.
- `src/stores/form-datasets.spec.ts` (fake-indexeddb, real timers) —
  upload → columns appear → misspelled value param warns at the node →
  fix clears; malformed geojson stays silent; replacement upload re-parses
  under the new attachment id.
- `tests/component/type-config-columns.spec.ts` — InputText fallback while
  columns are unknown, editable Select upgrade with the parsed columns,
  non-column params unaffected, view button opens the dialog.
- `tests/e2e/dataset-tooling.spec.ts` — attach a 520-row villages CSV from
  the panel; value dropdown lists actual columns; typing a misspelled
  column raises a problem that navigates to the question; View file
  renders the truncated table; attachments-dialog row button previews XML
  as raw text.

## Verification

- `pnpm vitest run` on the specs above; `pnpm typecheck`; eslint on
  changed files.
- `pnpm playwright test tests/e2e/dataset-tooling.spec.ts --project=chromium`.
- Manual: see `user-guide.md`.
