# Standards — Workspace Export / Import

Follows the existing project standards
(`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`):
strict TypeScript, neostandard ESLint (no semicolons), Vitest colocated
`*.spec.ts`, fake-indexeddb for persistence specs, `Issue` for all
user-facing diagnostics.

Conventions this feature adds:

- **Issue code namespaces**: `workspace.*` for archive/container problems
  (`workspace.invalid-archive`, `workspace.not-an-archive`,
  `workspace.format-version-unsupported`, `workspace.form-unreadable`,
  `workspace.duplicate-form-id`, `workspace.import-failed`) and `doc.*` for
  document-schema problems (`doc.malformed`,
  `doc.schema-version-unsupported`).
- **Layering**: `src/core/workspace/` is pure (jszip + model + issues only —
  no Dexie/Vue), consistent with the `src/core/` purity rule; all IndexedDB
  access for archives lives in `src/persistence/workspace-io.ts`.
- **Container vs payload versioning**: bump `WORKSPACE_FORMAT_VERSION` for
  zip-layout changes and `FormDocument.schemaVersion` (with a migration in
  `src/core/model/migrate.ts`) for model changes — never one for the other.
- **Import identity rule**: anything imported from outside the app gets
  freshly minted ids (records and attachments); imports never overwrite.
- **Archive filename suffix**: `.odkbuilder.zip` (stage 2), so exports are
  double-clickable zips yet recognizable as app archives.
