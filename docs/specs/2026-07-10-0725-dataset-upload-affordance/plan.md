# F3a — Dataset Upload from the Property Panel — Plan

## Problem

`select_one_from_file`, `select_multiple_from_file` and `csv-external`
questions have `requiresFile: true`, but adding one only inserts the node.
The property panel rendered a bare filename text input; the author had to
separately open the Attachments dialog and upload a file whose name exactly
matched the typed filename. Typos left the question silently broken until
preview time.

## Design

### 1. `src/composables/useAttachmentUpload.ts` (new)

Extracted from `AttachmentsDialog.vue`'s upload logic:

- `roleFor(filename, mediatype)` — same ext/mimetype classification as the
  dialog used (csv / geojson / xml / media / other).
- `attachFile(file, filenameOverride?, { undoLabel?, alsoMutate? })` —
  stores the blob in the attachments repo under `filenameOverride ?? file.name`,
  then in **one** `form.mutate` replaces any existing `doc.attachments` ref
  with the same filename, pushes the new ref, and runs the caller's
  `alsoMutate` hook (used to adopt the filename into `itemsetFile` in the
  same undo step).
- **Orphan fix**: the dialog used to leave the replaced ref's old
  `AttachmentRecord` behind in IndexedDB on re-upload; `attachFile` now
  deletes superseded records after the mutate. (Known trade-off: undoing a
  replace restores a ref whose blob is gone — same class of caveat as
  undoing a `remove`, acceptable for v1.)

`AttachmentsDialog.vue` is refactored onto the composable with no behavior
change beyond the orphan fix.

### 2. `TypeConfigSection.vue` — upload affordance

For `requiresFile` question nodes, the filename input is kept and gains:

- **Effective filename** mirrors the serializer
  (`serializer.ts` external-instance collection):
  `itemsetFile ?? (type === 'csv-external' ? `${name}.csv` : undefined)`.
  The csv-external default also becomes the input's placeholder.
- **Status line** (`data-testid="prop-itemset-status"`, `data-state`
  attribute): green check "*file* is attached" when a `doc.attachments` ref
  matches the effective filename; warning "*file* has not been uploaded yet"
  when one is expected but missing; "No file uploaded yet" when there is no
  effective filename at all (from-file selects before any upload).
- **Upload/Replace button** opening a hidden
  `<input type="file" accept=".csv,.xml,.geojson">`
  (`data-testid="prop-itemset-upload-input"`).
- **Behavior**: if `itemsetFile` is unset, the uploaded file's own name is
  adopted into `itemsetFile` via `alsoMutate` (single undo step). If set and
  the picked file's name differs, the file is stored under the **expected**
  name via `filenameOverride`, and a hint
  (`data-testid="prop-itemset-renamed"`) says it was stored under that name.

Once the ref lands in `doc.attachments` under the right name, the preview
picks it up with no further wiring: `form.mutate` bumps the preview store's
deep doc watch/instanceKey, and `fetchFormAttachment` resolves jr:// URLs by
filename from IndexedDB — itemsets and `pulldata()` both work live.

### 3. `src/core/validate/refs.ts`

`ref.missing-attachment` now checks the same effective filename as the
serializer, so a `csv-external` question with unset `itemsetFile` warns
about `${name}.csv` until that attachment exists (previously it was silent),
and the warning clears consistently after an upload. `ref.no-file` semantics
are unchanged (fires only when no effective filename exists).

## Tests

- `src/core/validate/refs.spec.ts` (new): missing/cleared warning for
  explicit filenames, csv-external effective default, explicit-over-default
  precedence, `ref.no-file` unchanged.
- `tests/component/type-config-upload.spec.ts` (new, mocked attachments
  repo): adopt-on-upload flips status to attached and undoes as one step;
  differently named file stored under expected name + rename hint;
  replace deletes the superseded record; csv-external default status.
- `tests/e2e/dataset-upload.spec.ts` (new): from-file question → problem
  "need an attached choices file" → upload CSV from the property panel →
  problem clears → preview select shows the CSV's labels. Second test:
  csv-external upload + `pulldata()` calculate surfaced through a note
  output renders the CSV value in the preview.

## Verification

- `pnpm vitest run` on the new/affected specs, `pnpm typecheck`, eslint on
  changed files.
- `pnpm playwright test tests/e2e/dataset-upload.spec.ts --project=chromium`.
- Manual: see `user-guide.md`.
