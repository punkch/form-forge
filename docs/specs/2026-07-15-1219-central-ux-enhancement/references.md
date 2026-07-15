# References for Central UX enhancement

Current-code inventory (recon 2026-07-15, verified against source). All anchors
are exact file:line at promotion time — re-confirm before editing.

## Prior art / provenance
- **Delivered feature spec:** `docs/specs/2026-07-13-1331-central-publishing/`
  (plan, shape, user-guide, CORS recipes + threat model).
- **Review Artifact source:** `visuals/central-ux-review.html` (five-lens
  critique + before/after + Phase-3 hi-fi mockup, 4-state gallery).
- **Backlog stub (promoted):** `docs/specs/backlog/central-ux-enhancement.md`.

## Store — `src/stores/central.ts` (`useCentralStore`, L56)
- Unlock gate: `ensureUnlocked()` **L141–149** — returns immediately if
  `vault.isUnlocked()`, else sets `unlockMode` (`create` if no vault meta else
  `unlock`), sets `unlockPromptOpen=true`, parks an awaiter. **This is the
  stacking mechanism** (opens the app-global modal from inside picker fetches).
- Dialog callbacks: `submitCreate` L152, `submitUnlock` L167 (returns `false` on
  wrong passphrase without closing), `cancelUnlock` L179, `resetVault` L190.
- `lockVault()` L298 — drops key + tokens + connections.
- Targets: `listTargetsForForm(formRecordId)` L389, `upsertTarget(input)` L392
  (thin delegates to the repo).
- Picker/read data: `listProjects(serverId)` L307, `listForms(serverId,
  projectId)` L312 → `CentralFormSummary[]` (**the Check-server read**).
- Orchestration: `publishForm(serverId, projectId, input)` L342, `importFormFrom
  Central(serverId, projectId, xmlFormId)` L327.
- Global `isUnlocked` computed L85 (no per-server unlock). `hasServers` L90 gates
  UI app-wide. Connection status is per-server (`connectionState`/`isConnected`)
  but obtained transparently once unlocked.

## Publish surface — `src/components/central/PublishDialog.vue` (605 L)
- No props/emits; reaches stores directly. Opened via `editor.activeDialog ===
  'publish'` (L48–51); mounted in `EditorDialogs.vue` **L19**.
- **Identity bug:** `targetMatchesSelection` **L84–85** = `serverId &&
  projectId` only — must become the full triple `(serverId, projectId,
  xmlFormId)`.
- Reusable behaviors to move into the drawer unchanged: `submit` L178–231,
  `redeploy` L237–246, `updateExistingInstead` L251–257 (409.3 create-mode),
  `bumpAndRetry` L263–272, `onProgress` L168, `loadTargets` L137.
- 409 recovery UI: `<Message data-testid="publish-conflict">` L396–439 (create
  mode → update-instead + bump; update mode → bump only).
- Testids (preserve where re-homed): `publish-dialog`, `publish-target-${id}`,
  `publish-redeploy-${id}`, `publish-server-select`, `publish-project-select`,
  `publish-new-form`, `publish-update-existing`, `publish-rename-warning`,
  `publish-progress`, `publish-conflict`, `publish-update-instead`,
  `publish-bump-version`, `publish-error`, `publish-result`, `publish-warnings`,
  `publish-submit`. Hosts the only `GuideTrigger guide="central"` (L304).

## Unlock modal — `src/components/central/UnlockVaultDialog.vue` (221 L)
- Mounted app-globally at **`src/App.vue` L39**. Driven only by
  `central.unlockPromptOpen` + `central.unlockMode` — decoupled from
  `editor.activeDialog`, survives route/form changes.
- Three faces `create | unlock | reset`; `reset` is dialog-local (reached via
  `forgot()` L99–114), the store only pushes `create`/`unlock`.
- Testids: `unlock-vault-dialog`, `unlock-vault-passphrase`, `unlock-vault-confirm`,
  `unlock-vault-error`, `unlock-vault-forgot`, `unlock-vault-submit`,
  `unlock-vault-reset-confirm`.
- **Drawer plan:** the drawer resolves unlock **up front** (once per session) via
  the exposed `submitUnlock`/`submitCreate` callbacks, so inner `ensureUnlocked`
  calls become no-ops and the app-global modal never stacks over a flow. The
  modal stays mounted for Settings (`savePassword`/`testConnection`) and edge
  cases — acceptable there (over an inline section, not over another flow).

## Pickers — `src/components/central/Central{Server,Project,Form}Picker.vue`
- Server: props `{ modelValue }`, binds `central.servers` directly (no fetch);
  testids `central-server-select`, `central-server-option-${id}`.
- Project: props `{ serverId, modelValue }`, emits `update:modelValue` + `error`;
  fetches via `useCentralList` → `central.listProjects`; testids
  `central-project-select`, `central-project-connection`.
- Form: props `{ serverId, projectId, modelValue, publishedOnly? }`, emits
  `update:modelValue` + `error`; `central.listForms`; `publishedOnly` filters
  `publishedAt !== null`; testid `central-form-select`.
- Shared: `connection.ts` `connectionLabel(...)`; composable
  `src/composables/useCentralList`.
- **Reuse these verbatim** in both drawers.

## Import surface — `src/components/importexport/ImportDialog.vue` (527 L)
- Mounted in **`FormLibraryView.vue` L316**; `defineModel('visible')`.
- **Source toggle to retire:** two `<Button>`s L270–288 (`import-source-file`
  L277, `import-source-central` L283); `showSourceToggle = central.hasServers &&
  !embed.active` L59. Central panel L303–340 (pickers + `import-central-confirm`
  L337).
- Central path: `pullFromCentral()` L119–138 (`importFormFromCentral` **L127**);
  `seedTarget(formRecordId)` L169–182 (`upsertTarget` **L174**) via `landCentral`
  L203–214. Collision copy/replace L216–239 (`import-collision*` testids).
- **Plan:** move the Central branch into a library-level Central drawer; keep the
  File branch (FileDropzone, `import-*` testids) in the Import dialog.

## Settings (unchanged) — `src/components/central/CentralServersSection.vue`
- Mounted `SettingsView.vue` L177. `savePassword` L168 + `testConnection` L201
  call `ensureUnlocked()` up-front (fine — inline section). Stays as-is.

## Persistence — data model
- `PublishTargetRecord` **`db.ts` L95–108**: `{ id, formRecordId, serverId,
  projectId, xmlFormId, lastPublishedVersion, lastPublishedAt }`. **Add
  `lastPublishedContentHash?: string`** (+ optional `lastKnownServerHash?`).
- `db.ts` version chain L124–141: v1 forms/attachments/snapshots, v2 templates,
  v3 central tables (`publishTargets: 'id, formRecordId, serverId'`). **Add v4**
  (new fields aren't indexed, so the `.stores()` string can stay — add a v4 step
  as a migration hook / clarity marker).
- Repo `publish-targets-repo.ts`: `PublishTargetInput = Omit<…,'id'>`;
  `upsertTarget` natural-key upsert on `serverId+projectId+xmlFormId` L27–29
  (already the full triple — good). Mirror new fields through
  `backend.ts` (`listPublishTargets` L63, `upsertPublishTarget` L65), the Dexie
  impl (L137–138), and `memory-backend.ts` (L126–128). Cascades already handled.

## Core transport — `src/core/central/{client,types,publish}.ts`
- `CentralClient` (client.ts L46–74): `listForms(token, projectId)` L54 →
  `CentralFormSummary[]`; `createForm` L66 (`publish=false`, 409.3 on collision);
  `updateDraft` L69; **XML reads are `getPublishedFormXml` L56 /
  `getDraftFormXml` L58** (NOT `getFormXml`/`getDraftXml`); `listDraftAttachments`
  L73 is the only draft-metadata method (no draft-version endpoint).
- `CentralFormSummary` (types.ts L84–89): `{ xmlFormId, name?, version?,
  publishedAt }` — **no `hash`**. `coerceFormSummary` L121. For content-hash
  Check-server, add `hash?` here (non-breaking); else compare `version` only.
- `publish.ts` `publishForm` L113–135 propagates `CentralError{kind:'conflict',
  code:'409.3'}` unchanged; recovery lives in the UI.
- Serializer version stamp: `serializer.ts` **L649–650** — `doc.settings.version`
  → root instance `version` attr only when `hasText`. Content hash must exclude
  `doc.settings.version` (or strip the root `version` attr).

## i18n — `src/i18n/locales/en/central.json`
- Single `central` object; sub-namespaces `servers, vault, connection, publish,
  import, errors`. Error mapper `src/i18n/central-errors.ts` `centralErrorKey`.
- Guide content: `src/i18n/locales/en/guides.json` under `guides.central` L69–81
  (`title`, `summary`, `steps.1–7`) — **update these steps** to describe the
  drawer/hub flow. `GuideTrigger guide="central"` currently only in PublishDialog
  L304 → re-home into the drawer header.
- New copy is **additive** in the `central` namespace; `no-missing-keys` is an
  eslint error.

## Tests to migrate (component specs — NO live-Central e2e exists)
- `tests/component/publish-dialog.spec.ts` (231 L) — pre-fill, redeploy, rename
  warning, 409 create/update recovery, warnings, error copy. **Re-point at the
  drawer** (keep testids where the surface is only re-homed, or migrate
  assertions).
- `tests/component/import-from-central.spec.ts` (200 L) — pull→report→land,
  transport error copy, collision copy/replace. **Re-point at the library
  drawer.**
- `tests/component/central-servers-section.spec.ts` (162 L) — unchanged (Settings
  stays).
- `tests/e2e/import-export.spec.ts` — **file-only**, no Central network; only
  touch if the File-import surface changes.
- `tests/unit/central-export-isolation.spec.ts` — export isolation guard; keep
  green (new fields must not leak into archives).
- Core/persistence specs: `publish-targets-repo.spec.ts`,
  `memory-backend.spec.ts` — extend for the new field; `src/core/central/*.spec.ts`.
