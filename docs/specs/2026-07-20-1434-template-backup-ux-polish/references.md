# References for Template & Backup UX Polish

## Similar implementations (in-repo)

### `firstFreeAttachmentName` — the keep-both suffix shape (item 2)

- **Location:** `src/core/model/rename-attachment.ts:141`
- **Relevance:** the new `firstFreeTemplateTitle` mirrors this exactly — "return the name
  unchanged when free, else the first free numbered variant". The only differences are the
  suffix form (` (2)` display style, not `-2` filename style) and case-insensitive
  membership (to match the save-collision check), so it lives in `templates-repo.ts`, not
  core.
- **Key pattern:**
  ```ts
  export const firstFreeAttachmentName = (existing: ReadonlySet<string>, filename: string): string => {
    if (!existing.has(filename)) return filename
    const { stem, ext } = splitFilename(filename)
    let i = 2
    let candidate = `${stem}-${i}${ext}`
    while (existing.has(candidate)) { i++; candidate = `${stem}-${i}${ext}` }
    return candidate
  }
  ```

### `ImportCollisionPanel` + its three hosts — the stable-footer constraint (item 3)

- **Location:** `src/components/importexport/ImportCollisionPanel.vue`; hosts:
  `src/views/FormLibraryView.vue` (save-as-template), `src/components/importexport/ImportDialog.vue`
  (ZIP-bundle path), `src/components/central/LibraryCentralDrawer.vue` (Central import).
- **Relevance:** the panel is purely presentational — the host owns detection and the write
  calls; the panel renders `message` + Copy (secondary) / Replace (danger) and emits which
  was picked. Item 3 must **not** change this component or break the other two hosts. The
  fix is confined to FormLibraryView: keep the footer `Save` mounted-but-disabled during a
  collision and add the Enter-cue flash on a wrapper around the panel. The panel's props
  (`message`, `copyLabel`, `replaceLabel`, `landing`, `testidPrefix`) and its
  `save-template-collision*` testids stay as-is.

### Attention-flash recipe — the Enter cue (item 3)

- **Location:** `src/components/canvas/TreeNodeCard.vue:231–237` (keyframes) +
  `src/styles/builder.css:81–82` (`--builder-flash-tint` / `--builder-flash-ring`).
- **Relevance:** the canonical, token-driven flash. Enter-while-colliding sets a
  `collisionFlash` class that runs a `@keyframes` animation using
  `--builder-motion-duration-flash` and the flash tint/ring pair. Reuse this exact shape —
  no literal timing.
- **Key pattern:**
  ```css
  .attention-flash { animation: collision-flash var(--builder-motion-duration-flash) var(--builder-motion-ease-exit); }
  @keyframes collision-flash {
    0% { background: var(--builder-flash-tint); box-shadow: 0 0 0 2px var(--builder-flash-ring); }
    100% { background: transparent; box-shadow: none; }
  }
  ```

### `importWorkspaceBackup` / `RestoreWorkspaceResult` — the dedupe surface (item 1)

- **Location:** `src/persistence/workspace-io.ts:160` (`RestoreWorkspaceResult`), `:180`
  (`importArchiveTemplates`), `:223` (`importWorkspaceBackup`).
- **Relevance:** dedupe is confined to `importArchiveTemplates` returning
  `{ imported, skipped }`; `RestoreWorkspaceResult` gains `templatesSkipped`, threaded
  through both `importWorkspaceBackup` return statements. The existing helper already reads
  `getPersistenceBackend().listTemplates()` and `addTemplate` — extend it, don't rewrite the
  seam usage.
- **Signature note:** templates are stored with `doc.attachments = []` already
  (`deriveTemplateFields` in `templates-repo.ts:24`), so the dedupe's stripped-doc compare is
  comparing already-stripped docs; the strip in the signature is defensive.

### The save-as-template dialog + collision computed (items 2, 3, 7, 8)

- **Location:** `src/views/FormLibraryView.vue:98–166` (state + `saveTemplateCollision`,
  `runSaveTemplate`, `applySaveTemplate`, `applySaveTemplateReplace`, `saveTemplateOnEnter`),
  `:372–410` (the `Dialog` markup + footer).
- **Relevance:** all four FormLibraryView items live here. `saveTemplateCollision` (a
  computed against a `listTemplates()` snapshot loaded on open) already drives the collision
  UI; item 2 reads that same snapshot for the auto-suffix, item 3 changes the footer binding
  + Enter handler, item 7 swaps the description input, item 8 changes the toast detail.

### The template edit dialog (items 4, 6, 7)

- **Location:** `src/components/library/NewFormDialog.vue:389–421` (edit `Dialog`), `:243–293`
  (bundled + local card action buttons).
- **Relevance:** item 4 adds a hint in the edit dialog, item 6 adds `v-tooltip` to the
  hide/edit/delete icon buttons (directive already registered — `src/main.ts:63`), item 7
  swaps the edit description input to a Textarea and drops its Enter handler.

### The Settings export section (item 5)

- **Location:** `src/views/SettingsView.vue:124–178` (workspace section),
  `:32–37` (`includeCredentials` / `willIncludeCredentials`).
- **Relevance:** item 5 adds a computed summary line here. Counts: `workspace.forms.length`
  (reactive), `central.servers.length` (`useCentralStore()` exposes `servers` — store
  `src/stores/central.ts:61,409`), a `templateCount` loaded once on mount via
  `templatesRepo.listTemplates()`, plus always-preferences and conditional-credentials.

## Prior spec folders (delivered — the features being polished)

- **`docs/specs/2026-07-20-1305-template-management/`** — template hide/edit/delete/replace
  and the save-collision `ImportCollisionPanel` reuse. This polish extends it (items 2, 3,
  4, 6, 7).
- **`docs/specs/2026-07-15-1729-workspace-full-backup/`** — the archive format-2 backup and
  `importWorkspaceBackup` restore that item 1's dedupe extends.

## External references

None — internal UI/store/persistence/i18n only; no XLSForm/XForm serialization surface, so
no pyxform-parity dimension.
