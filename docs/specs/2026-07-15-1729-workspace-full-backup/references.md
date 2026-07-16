# References — workspace full backup (format v2)

Promoted 2026-07-15 from `docs/specs/backlog/workspace-full-backup.md` (kept as a
provenance stub).

## Code

- `src/core/workspace/archive.ts` — format v2 container: `WORKSPACE_FORMAT_VERSION
  = 2`, `SHARE_FORMAT_VERSION = 1`, `buildWorkspaceArchive(forms, appVersion,
  exportedAt, backup?: WorkspaceBackupSections)`, `readWorkspaceArchive` (returns
  `central?` + `preferences?`), the `ArchiveCentral*`/`ArchiveVault`/
  `ArchivePreferences` shapes, and the pure base64 codec.
- `src/stores/ui.ts` — `exportPreferences()` / `applyPreferences(raw)` for the
  `preferences.json` section (validated per-field; theme/accent apply live via
  the theme controller's watcher, language via `setLocale` in the dialog).
- `src/persistence/workspace-io.ts` — `gatherWorkspaceBackup({includeCredentials})`
  (secret-strip in the gather step), `importArchiveForms` (now returns
  `formIdMap`), `importWorkspaceBackup` (server dedupe + 3-way vault branch +
  target remap).
- `src/composables/useWorkspaceExport.ts` — `exportWorkspace({includeCredentials})`
  (v2) vs `exportFormArchive` (v1 share).
- `src/views/SettingsView.vue` — the opt-in checkbox + warning (gated on
  `central.isUnlocked`).
- `src/components/importexport/WorkspaceArchiveDialog.vue` — Central summary +
  `importWorkspaceBackup`.
- i18n: `src/i18n/locales/en/appSettings.json` (workspace section),
  `importExport.json` (`workspaceArchive` central keys).

## Tests

- `tests/unit/workspace-full-backup.spec.ts` — opt-out / opt-in / existing-vault /
  dedupe / v1, both backends.
- `tests/unit/central-export-isolation.spec.ts` — rescoped to the share path.
- `tests/component/settings-view.spec.ts`, `workspace-archive-dialog.spec.ts`.

## Related specs

- `docs/specs/2026-07-13-1331-central-publishing/` — the Central tables + vault
  this backs up; its threat model (credentials device-local, excluded from
  *shares*, included in *full backups* only when opted in).
- `docs/specs/2026-07-15-1219-central-ux-enhancement/` — publish targets +
  content-hash freshness carried by the backup.
