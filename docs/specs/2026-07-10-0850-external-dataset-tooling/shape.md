# F3b/c — External Dataset Tooling — Shaping Notes

## Scope

The remaining (non-upload) scope of
`docs/specs/backlog/external-dataset-tooling.md`: dataset parsing, the
dataset preview dialog, column-aware value/label parameters and
column validation. Upload from the property panel shipped as F3a
(`docs/specs/2026-07-10-0725-dataset-upload-affordance/`).

Out of scope: in-place CSV editing (stretch in the backlog; demand to be
measured first), XML column extraction (raw-text preview only in v1 —
backlog decision), `choice_filter` *error*-severity validation (kept at
info until the tokenizer-based extraction has mileage).

## Decisions

- **SheetJS stays behind the adapter**: CSV parsing is a new
  `readCsvRows()` in `workbook-read.ts`, the single module allowed to
  import `xlsx`. `raw: true` (not the workbook path's `raw: false`
  formatted-text trick) is what preserves text verbatim for *string*
  input: SheetJS would otherwise infer numbers from `007`.
- **Columns are computed, cached per attachment id, never persisted**:
  a re-upload creates a new attachment id, so cache invalidation is
  structural — no blob hashing, no stored metadata to migrate.
- **`validateDocument` stays pure and synchronous**: blob loading/parsing
  is async and belongs to the form store; validation receives the parsed
  columns through an optional `ValidateContext` argument. Existing callers
  (import previews, tests) are unchanged and simply skip dataset checks.
- **`null` columns mean "don't judge"**: an attached but unparseable file
  produces no column warnings — the parse issues themselves surface in the
  preview dialog instead. Missing files keep the existing
  `ref.missing-attachment` warning; the two validators never overlap.
- **Defaults are validated too**: a from-file select with no explicit
  parameters still warns when the file lacks ODK's default columns
  (csv: name/label, geojson: id/title), because Collect/Enketo would break
  at runtime. The message tells the author to set the parameter.
- **Editable Select, not a strict dropdown**: column params accept
  arbitrary text (files can be replaced later; authors may prepare the
  form before the final file exists). The dropdown is an affordance, the
  validator is the safety net.
- **One preview dialog, filename-addressed**: `datasetPreviewFilename` +
  the `dataset-preview` entry in the dialog union; both entry points
  (property panel, attachments manager) resolve the blob through the
  *current* document ref, so a preview always shows what the form would
  actually ship.
- **500-row cap end to end**: the parser never materializes more than 500
  data rows (`sheetRows` caps SheetJS work as well), and the DataTable
  virtual-scrolls those, so a multi-MB CSV cannot jank the editor.

## Risks / follow-ups

- `choice_filter` candidate extraction is regex-over-masked-text, not an
  XPath parse; kept at info severity. Revisit if the expression engine
  grows a real parser.
- The entity-list preview (backlog) is expected to reuse
  `DatasetPreviewDialog`'s table.
