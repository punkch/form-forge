# External dataset tooling — shaping (backlog)

## Problem

`select_one_from_file`, `select_multiple_from_file` and `csv-external`
questions reference attached CSV/XML/GeoJSON files, but the builder treats
those files as opaque blobs: no way to see what's inside, and the
`value`/`label`/`choice_filter` parameters must be typed blind. Typos in
column names only surface at preview time.

## Scope

- **Dataset preview**: open an attached CSV/GeoJSON from the attachments
  manager (or from the question's property panel) and see a paged table of
  its rows, with detected column names.
- **Column-aware parameters**: the `value` / `label` parameter inputs for
  *_from_file questions become dropdowns of the file's actual columns;
  `choice_filter` column references validate against them.
- **Validation**: new validator warns when a *_from_file question's
  `value`/`label`/filter columns don't exist in the attached file.
- **CSV editing (stretch)**: in-place cell editing + add/remove rows for
  small CSVs, writing back to the attachment blob.

## Approach

- Parsing lives in `src/core/datasets/`:
  - CSV: reuse **SheetJS** (already installed for XLSForm; it reads CSV via
    `XLSX.read(data, { type: 'string' })`) through the existing
    `workbook-read.ts` adapter pattern — no new dependency.
  - GeoJSON: `JSON.parse` + extract `features[].properties` keys and
    `geometry` presence; ODK expects top-level `FeatureCollection`.
  - Output: `{ columns: string[], rows: string[][], issues: Issue[] }` with
    a row cap (first 500) for preview.
- Column metadata is computed on demand and cached per attachment id in the
  attachments store (invalidated when the blob changes) — never persisted.
- Validator (`src/core/validate/datasets.ts`) runs only when the attachment
  is present locally; missing files keep today's `ref.missing-attachment`
  warning.
- UI: `DatasetPreviewDialog.vue` (DataTable, virtualized) reachable from
  AttachmentsDialog rows and from a small "view file" button next to the
  itemset-file input in `TypeConfigSection.vue`.

## Decisions (proposed)

- XML external instances get preview as raw text only in v1 (rare format).
- The preview also powers the future entity-list preview (same table UI).

## Open questions

- Is CSV editing worth it, or is "download → edit in Excel → re-upload"
  good enough for v1? Proposal: ship preview + column dropdowns first;
  measure demand for editing.

## Acceptance

Attach the golden `villages.csv` style fixture → property panel offers its
columns for value/label; misspelled column produces a warning pointing at
the question; preview table renders 500-row files without jank.
