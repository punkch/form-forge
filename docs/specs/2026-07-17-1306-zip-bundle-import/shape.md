# ZIP bundle import — Shaping Notes

## Scope

Import per-form ZIP archives that contain a `form.xml` **or** `form.xlsx` at
the root plus `media/<filename>` attachments — the exact structure our own
per-form export (`src/core/export/zip.ts`) produces. The form lands in the
library **with** its attachments, closing the round-trip gap: today the app
can export that bundle but not read it back.

## Decisions (2026-07-17 shaping, user-confirmed)

1. **Entry point** — extend the existing library "Import form" dialog
   (`ImportDialog.vue` / FileDropzone) to also accept `.zip`. A
   `.formforge.zip` workspace archive dropped there gets a helpful error
   pointing to Settings → Import workspace (it has `manifest.json`; the
   bundle layout does not).
2. **form_id collision** — Copy/Replace prompt mirroring the Central import
   flow; Replace keeps the existing record id (and therefore its publish
   targets). Scoped to the ZIP bundle path only — plain `.xml`/`.xlsx` import
   stays create-and-open.
3. **Both `form.xml` and `form.xlsx` in one zip** — prefer `form.xml` (the
   lossless native format); the `.xlsx` is ignored with an informational
   warning. Our own export never produces both.
4. **No visuals**; standing repo invariants apply, with the Central importer
   (`src/core/central/import.ts`) as the reference implementation.

## Context

- **Three existing import paths, none of which reads the export bundle:**
  single bare file (`ImportDialog` → `parseFormFile`, no attachments),
  workspace archive (`WorkspaceArchiveDialog` → `readWorkspaceArchive`,
  manifest-based `.formforge.zip`), and ODK Central (network).
- **Why Central import is the template:** `parseXForm`/`readXlsForm` leave
  `document.attachments = []`; the Central importer rebuilds
  `document.attachments` from the downloaded file list via `roleFor` and
  hands `{document, issues, attachments: ArchiveAttachment[]}` to the shared
  landing primitives (`createFormWithArchiveAttachments` /
  `replaceFormWithArchiveAttachments`, filename-joined, atomic). The ZIP
  importer does the same with `media/*` entries instead of downloads.
- **Mediatype gap:** zip entries carry no mediatype, and `roleFor` classifies
  image/audio/video by mediatype — hence the new pure `mediatypeFor(filename)`
  extension map beside `roleFor`.
- **Product alignment:** completes the export/import round-trip story on the
  roadmap's sharing/portability thread; no backend, all client-side, no
  persistence-schema change (no Dexie or workspace-format bump).

## Skills & Conventions Applied

- Repo standing invariants (see `standards.md`) — core purity, i18n
  three-catalog parity, testid preservation, golden byte-stability,
  conventional commits without co-author trailers.
- Established delivery process — spec folder → dynamic Workflow with parallel
  agents → full verification + agent-browser pass → `/code-review` (five
  lenses) → conventional commit + docs sweep.
