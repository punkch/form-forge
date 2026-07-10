# F3a — Dataset Upload from the Property Panel — Shaping Notes

## Scope

The "Upload from the property panel" slice of
`docs/specs/backlog/external-dataset-tooling.md` (ships first, user
priority): attached/missing status + Upload/Replace button on from-file
questions, filename adoption/override so validation clears and the preview
picks the file up immediately, and a validator fix so csv-external questions
warn about their effective default filename.

Out of scope (later F3b/c slices): dataset preview table, column-aware
value/label dropdowns, column validation, CSV editing, the "view file"
button.

## Decisions

- **Composable, not a store**: upload logic is shared between
  `AttachmentsDialog` and `TypeConfigSection` via
  `useAttachmentUpload()` — it composes the existing form store and
  attachments repo; no new state to own.
- **Single undo step for adopt-on-upload**: `attachFile` accepts an
  `alsoMutate` hook that runs inside the same `form.mutate`, so uploading to
  a question with unset `itemsetFile` adopts the filename and adds the
  attachment ref as one undoable action.
- **Adopt vs. rename keyed on `itemsetFile`, not the effective filename**:
  unset `itemsetFile` (including csv-external's default case) adopts the
  uploaded file's own name — the serializer then references exactly that
  name. An explicitly set `itemsetFile` wins: a differently named upload is
  stored under the expected name (`filenameOverride`) with a visible hint,
  because the form, not the file, is the source of truth.
- **Effective filename has one source of truth**: `effectiveItemsetFile(node)`
  in the question-type registry (`itemsetFile ?? name + '.csv'` for
  csv-external) is shared by the serializer, `validate/refs.ts` and the panel
  status/placeholder, so the `ref.missing-attachment` warning fires and clears
  consistently with what the XForm will actually reference.
- **Orphan cleanup deferred to close, not replace**: replacing an attachment
  under the same filename swaps the document ref but leaves the superseded
  `AttachmentRecord` in IndexedDB, so undoing a replace restores a *working*
  ref (blob intact). Orphaned blobs are reclaimed by
  `attachmentsRepo.pruneOrphans` from the form store's `close()`, which is the
  first point where undo history is discarded and the ref can never come back.
- **No preview wiring needed** (verified): `form.mutate` triggers the
  preview store's deep doc watch + instanceKey bump, and
  `fetchFormAttachment` serves attachments by filename from IndexedDB, so
  itemsets and `pulldata()` work as soon as the ref exists under the right
  name.

## Open questions

- Undo of a replace now restores the old blob (superseded records survive
  until close), so the earlier concern is resolved without snapshotting blobs.
  Remaining edge: a very long session that repeatedly replaces the same file
  accumulates orphan blobs until close — acceptable for v1; revisit only if
  IndexedDB pressure shows up in practice.
