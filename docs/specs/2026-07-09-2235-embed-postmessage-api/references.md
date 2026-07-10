# References for iframe embed mode + postMessage API

## In-repo

### Shaping source
- **Location:** `docs/specs/backlog/iframe-embed-api.md`
- **Relevance:** original backlog shaping (problem, scope, approach,
  decisions, acceptance). This spec folder supersedes it.

### Workspace archive container
- **Location:** `src/core/workspace/archive.ts`
- **Relevance:** the canonical interchange payload. `readWorkspaceArchive`
  parses `load-form { format: 'archive' }` buffers (first form taken);
  `buildWorkspaceArchive` produces the `save-form` archive payload for a
  single form. Self-versioned via `manifest.formatVersion` +
  `FormDocument.schemaVersion`.

### Document migration gate
- **Location:** `src/core/model/migrate.ts`
- **Relevance:** every `load-form { format: 'object' }` doc passes through
  `migrateDoc` before use — same rule as archives ("every document sourced
  from outside the running app").

### Persistence repos
- **Location:** `src/persistence/forms-repo.ts`, `attachments-repo.ts`,
  `workspace-io.ts`, `db.ts`
- **Relevance:** the delegation targets of the backend seam. Exported
  signatures are frozen (preview `fetchFormAttachment`, `exportZip`, the
  form store's autosave and the workspace archive dialogs all consume them).
  `remapAttachments` (forms-repo) is the shared fresh-id remap used by
  duplicateForm, archive import and the bridge's `openForm`.

### Backend seam (new)
- **Location:** `src/persistence/backend.ts`, `src/persistence/memory-backend.ts`
- **Relevance:** `PersistenceBackend` interface + `dexieBackend` default +
  Map-based embed backend; swapped via `setPersistenceBackend`.

### Embed modules (new)
- **Location:** `src/embed/protocol.ts`, `src/embed/detect.ts`,
  `src/embed/bridge.ts`, `src/stores/embed.ts`,
  `src/views/EmbedWaitingView.vue`
- **Relevance:** the implementation this spec documents; see `plan.md`.

### Wiring points
- **Location:** `src/main.ts`, `src/router/index.ts`,
  `src/components/shell/AppHeader.vue`,
  `src/components/importexport/ExportMenu.vue`
- **Relevance:** boot-time embed detection + memory backend install +
  bridge start; embed `/` route; hidden library nav; export gating.

### Form store
- **Location:** `src/stores/form.ts`
- **Relevance:** `flushSave()` is awaited before every `save-form` reply;
  `saveState`/`errorCount` feed the debounced `state-changed` event; the
  editor view's `load()` is what actually opens the record the bridge
  created.

### Demo host + e2e
- **Location:** `public/embed-demo.html`, `tests/e2e/embed.spec.ts`
- **Relevance:** reference host implementation (vanilla JS, both directions
  logged) and the Playwright `frameLocator` coverage of the full loop.

### Contract test helper
- **Location:** `tests/helpers/backends.ts`
- **Relevance:** `backendCases` used by `describe.each` in
  `src/persistence/forms-repo.spec.ts` and `workspace-io.spec.ts` so both
  backends satisfy one behavioral contract.

## External

### MDN — `window.postMessage`
- **Relevance:** origin semantics (`targetOrigin`, `event.origin`,
  `event.source`) and transferable objects; the security model in
  `plan.md` follows its recommendations (never `'*'` once data flows,
  validate source + origin on receipt).

### vue-i18n 11 (project convention)
- **Relevance:** the waiting view's string lives in
  `src/i18n/locales/en/shell.json` under `shell.embed.*`; components use
  `useAppI18n()`.
