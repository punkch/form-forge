# Workspace export / import — shaping (backlog)

## Problem

All data lives in one browser's IndexedDB. Users need protection against
profile resets, a way to move between machines, and a way to hand a whole
form collection to a colleague — without introducing a server.

## Scope

- **Export workspace**: one `.odkbuilder.zip` containing every form and its
  attachments.
- **Import workspace**: merge a workspace archive into the current library
  (also serves as "restore backup").
- **Single-form archive**: same container with one form — becomes the
  "share this form with a colleague" story (distinct from XLSForm/XForm
  export because it is lossless, including attachments and builder state).

## Approach

Archive layout (all pieces already exist):

```text
manifest.json                 { formatVersion: 1, exportedAt, appVersion, forms: [...] }
forms/<recordId>/form.json    FormDocument (already structured-clone/JSON-safe)
forms/<recordId>/meta.json    { title, formId, version, createdAt, updatedAt }
forms/<recordId>/attachments/<filename>   raw blobs
```

- Build/read with **jszip** (already a dependency; `src/core/export/zip.ts`
  shows the pattern). Pure logic in `src/core/workspace/archive.ts`
  (`buildWorkspaceArchive`, `readWorkspaceArchive` → issues use the existing
  `Issue` type).
- `FormDocument.schemaVersion` + a `migrateDoc()` hook (already reserved in
  the model) version the payload; `manifest.formatVersion` versions the
  container.
- Import policy: always create **new record ids** (no overwrite); when a
  `formId` collides with an existing form, import anyway and surface a
  warning chip in the library ("duplicate form ID"). Attachment ids are
  remapped exactly like `duplicateForm` does in `src/persistence/forms-repo.ts`.
- UI: "Export workspace" + "Import workspace" in a library overflow menu;
  per-form card menu gets "Export form archive". Reuse `useDownload` and the
  import drop-zone from Spec 07.

## Decisions (proposed)

- No encryption in v1 — the archive is plain zip; document that it contains
  everything. (Password-protected zip is weak crypto; if demanded later,
  use age/WebCrypto and a separate spec.)
- No selective export in v1 beyond single-form vs whole-workspace.

## Open questions

- Should autosave snapshots be included? Proposal: no (keeps archives small
  and semantics simple).

## Acceptance

Export → wipe site data → import restores every form byte-identically
(model-level equality) including attachments; e2e test covers the loop.
