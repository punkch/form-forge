# References — ODK Central integration (publish + import)

Recon-verified file:line integration points (six parallel recon agents;
load-bearing claims spot-verified). Paths are absolute in the repo root
`/home/punkch/Projects/odk-builder`.

## New pure-TS core submodule — `src/core/central/`

Sits alongside `datasets/`, `xform/`, `xlsform/`, `workspace/`. Files:
`types.ts` (DTOs + `CentralError`), `client.ts` (fetch wrapper), `vault.ts`
(WebCrypto), `import.ts` (Wave 3 assembly), `publish.ts` (Wave 3 sequence),
`index.ts` (barrel).

- **`src/preview/fetchFormAttachment.ts:1-23`** — the injectable-fetch precedent:
  a factory `makeFetchFormAttachment(id): (url)=>Promise<Response>` returning
  real `Response`s (tests build canned ones). Copy this shape for
  `createCentralClient({ baseUrl, fetchImpl })`.
- **`src/core/xform/xml-reader.ts:10-15`** — `class XmlParseError extends Error`;
  the precedent for `CentralError` (kind/status/code/details). Lines 26-45 show
  `globalThis` feature-detection that keeps core node-testable.
- **`src/core/util/guards.ts:8-14`** — `isRecord`/`hasText`; the narrows to use
  before indexing untrusted Central JSON.
- **`src/core/workspace/archive.ts:37-41,61-72,134-158`** — `ArchiveAttachment
  {filename, mediatype, blob}` (the import currency); `coerceMeta` defensive-
  coercion pattern; blob→mediatype defaulting to `application/octet-stream`.
- **`src/core/model/ids.ts:1-2`** — `globalThis.crypto.randomUUID()` convention
  (no feature-detect); `vault.ts` uses `globalThis.crypto.subtle`/`getRandomValues`
  the same way.
- **`src/core/model/types.ts:130-190`** — `FormSettings` (`formId?`,`version?` at
  132-133), `AttachmentRef {id,filename,mediatype,size,role}` (157-165),
  `FormDocument` (174-190). Publish reads `settings.formId`/`settings.version` +
  `doc.attachments`; import produces these.
- **`src/version.ts:2-3`** — `appVersion()` (only version signal; a User-Agent
  header source).

## Version bump + roleFor (Wave 1 shared prep)

- **`src/core/model/factory.ts:16-21`** — `defaultVersion()` EXISTS but is
  module-private and yields `yyyymmddHHMM`; **re-running within the same minute
  yields an identical string**. Move to `version.ts`, export, add
  `bumpVersion(current)` with a distinctness guarantee. (This resolves the
  recon conflict: core-help claimed "no generator exists" — it exists; what's
  missing is an exported bump helper.)
- **`src/core/model/library-display.ts`** — `TIMESTAMP_VERSION` regex *formats*
  12-digit versions for display (`202607101734 → 2026-07-10.1734`); a suffixed
  bump renders raw (acceptable).
- **`src/composables/useAttachmentUpload.ts:24-31`** — `roleFor(filename,
  mediatype)` is unexported and inside a Vue composable importing `@/stores/form`
  (can't reach pure core). Extract to `src/core/model/attachment-role.ts`;
  lines 57-63 show the canonical `AttachmentRef` push shape.

## Persistence seam (Wave 1 WP1-C)

- **`src/persistence/backend.ts:11-88`** — THE seam. `PersistenceBackend`
  interface (11-42) is the parity contract (TS won't compile until both impls
  satisfy it); `dexieBackend` literal (45-80); `activeBackend` +
  get/set (82-88). Has `importForm` (62-67) + `deleteFormCascade` (55-61) but
  **no replace-by-id** — add `replaceFormWithArchiveAttachments`.
- **`src/persistence/db.ts:51-74`** — `BuilderDb extends Dexie`, EntityTable
  fields (52-55), `this.version(1)` (62-66) + `this.version(2).stores({templates:...})`
  (68-70, lists only the NEW table). DB name `'odk-form-builder'` (61) **must
  stay**. Add the three record interfaces + fields + `this.version(3)`.
- **`src/persistence/memory-backend.ts:12-104`** — `createMemoryBackend()` fresh
  per call; `forms/attachments/snapshots` Maps (15-17); `structuredClone` on
  read/write (31,42,65,93). Add `centralServers`/`publishTargets` Maps + a
  vault-meta module var; mirror every new method.
- **`src/persistence/forms-repo.ts:83-158`** — `createFormWithArchiveAttachments`
  (83-113, the atomic import-landing path; `dropUnmatched:true` at 108),
  `remapAttachments` (47-71), `createForm` (121-125, attachment-less — NOT for
  Central import), `deleteForm`/`deleteFormCascade` (135-137),
  `deriveRecordFields` (16-21). Add `replaceFormWithArchiveAttachments` beside 83.
- **`src/persistence/attachments-repo.ts:1-37`** — second thin-wrapper repo
  example for the new repos to mirror.
- **`src/persistence/templates-repo.ts:1-45`** — COUNTER-example: imports `db`
  directly (line 6), bypasses the seam → no memory parity. **Do NOT** copy this
  for the central repos.
- **`src/persistence/workspace-io.ts:19-92`** — `gatherArchiveForms` (19-49)
  reads ONLY forms/attachments (so server records are export-excluded by
  construction); `importArchiveForms` (64-92) is the batch-import + collision-
  warning pattern (formId guard at 76).
- **`src/persistence/templates-repo.spec.ts:60-102`** — EXACT db-migration test
  pattern (isolated `IDBFactory`, seed, reopen, assert `verno` + survival).
  Mirror for v2→v3.
- **`src/persistence/forms-repo.spec.ts:15`** — canonical both-backend parity
  spec (`describe.each(backendCases)`, repo imported as a namespace).
- **`tests/helpers/backends.ts:16-30`** — `backendCases`; dexie `setup` clears
  only forms/attachments/snapshots (19-22). **Add clears for the three new
  tables** or parity specs bleed state.
- **`src/embed/bridge.ts:119`** — backend swap; adding interface methods keeps it
  working automatically as long as both impls are complete (the safety net).
- **`vitest.config.ts:28,55-58`** — persistence specs included; floor
  `src/persistence/** = 90 statements / 92 lines` (directory aggregate).

## Import pipeline (Wave 3 WP3-C)

- **`src/components/importexport/ImportDialog.vue`** — single-source today
  (`FileDropzone` while `result===null`, line 92); parse-report UI (105-125) to
  reuse; `importNow` (74-81) calls `createForm` (attachment-less) — the Central
  path must branch to `createFormWithArchiveAttachments`. `shallowRef` for parsed
  docs (21-23) to avoid `DataCloneError`. Mounted in `FormLibraryView.vue:311`.
- **`src/core/xform/parser.ts:85-100,167`** — `parseXForm(xml): {document,
  issues}` (sync, pure) — the reuse point (bypass `parseFormFile`). **PRIMARY
  GOTCHA:** `emptyDocument()` sets `attachments:[]` (95) and the parser NEVER
  populates `doc.attachments`; itemset src → `question.itemsetFile` (637), media
  → `node.media`. Must build `AttachmentRef[]` before landing.
- **`src/core/import-form.ts:15-46`** — `parseFormFile(File)` dispatches by
  extension; the `.xml` branch wraps `parseXForm` as `{kind:'xform',document,issues}`.
  Central calls `parseXForm` directly.
- **`src/core/validate/refs.ts:1-100`** — warns when a referenced filename is
  absent from `doc.attachments` (11, 55-100) — why `doc.attachments` MUST be
  populated on import.
- **`src/preview/fetchFormAttachment.ts:9-23`** — resolves `jr://` by filename
  against `listAttachments(formRecordId)` — preview needs no extra work once
  blobs are stored.
- **`tests/e2e/workspace-archive.spec.ts:1-90`** — closest import-with-
  attachments e2e template (export→wipe→import→verify previewable).

## Settings / stores / editor UI (Waves 2-3)

- **`src/views/SettingsView.vue:55-223`** — host page; extension-point comment at
  **lines 124-125** (between About, closing 122, and `</main>`, 126); reuse the
  `settings-section`/`settings-row`/`settings-field`/`settings-note` scoped
  classes (171-222). Root testid `settings-view`.
- **`docs/specs/2026-07-10-2005-settings-page/shape.md:50,56-64`** — records that
  Central ships only as an extension point, and the naming clashes: i18n
  `settings` and testids `settings-dialog`/`settings-tab-*` are TAKEN by
  `FormSettingsDialog` → use a fresh `central` namespace + `central-*`/
  `settings-central` testids.
- **`src/stores/editor.ts:6-15,70-81`** — `EditorDialog` closed union +
  `reset()` (runs on every form load). Add `'publish'` to both for the editor-
  scoped Publish dialog. **Do NOT** back the cross-route UnlockVaultDialog with
  `activeDialog` (reset-prone).
- **`src/stores/workspace.ts:11-49`** — `liveQuery(listForms)` in closure `let
  subscription` (the store-pattern to copy for `central.ts`); thin repo wrappers;
  a Central import auto-refreshes the list.
- **`src/stores/form.ts:37-52,220-238,291-296`** — `mutate(label, fn)` (undoable +
  autosave + revalidate); closure `let` for non-reactive timers (46-47, the
  precedent for keeping tokens/keys out of reactive state). Version bump writes
  `doc.settings.version` inside `mutate`.
- **`src/stores/embed.ts:14-47`** — `embed.active`/`exportEnabled()` gating
  pattern to copy for `hasServers && !embed.active`.
- **`src/stores/ui.ts:40-157`** — localStorage prefs (`odk-builder:ui:v1`).
  **Server records/vault do NOT go here** — Dexie only. Template only for a
  dismissed-callout / last-used-server pref.
- **`src/views/FormEditorView.vue:212-264`** — toolbar `#actions`: `<ExportMenu>`
  at 253 (place the Publish button right after) or a `moreItems` entry (213-218).
- **`src/views/FormLibraryView.vue:48,100-166,311,334`** — `importVisible` ref +
  `<ImportDialog>` mount (311); `useConfirm().require({...acceptProps:{severity:'danger'}...})`
  destructive-confirm shape (110-119); `useToast` (107); twice-mounted help
  drawer (334) — the "duplicate a cross-route dialog" precedent (we instead mount
  UnlockVault once at App root).
- **`src/App.vue:1-36`** — app-global `<ConfirmDialog/>` (35) + `<Toast>` (17,19);
  mount `<UnlockVaultDialog/>` here beside them.
- **`src/main.ts`** — `ConfirmationService` + `ToastService` already registered;
  `useConfirm()`/`useToast()` work anywhere (no new service).
- **`src/components/EditorDialogs.vue:1-19`** — editor-only dialog host (mounted
  by `FormEditorView`); `<PublishDialog>` mounts here.
- **`src/components/settings/FormSettingsDialog.vue:25-28,128-135,269-274,340`** —
  store-backed dialog pattern; `prop-field`/`prop-issue` form-field markup;
  imports `@/components/properties/prop-section.css`. Version edit `set('version',...)`
  at 146-154 — reuse for the bump.
- **`src/components/importexport/ExportMenu.vue:24-27,44-66,76`** — the read
  trio Publish reuses: `baseName` from settings (24-27),
  `serializeXForm(toRaw(form.doc))` (46), `listAttachments(form.recordId)` (59);
  `embed.exportEnabled` gating (76).
- **`src/components/importexport/WorkspaceArchiveDialog.vue:1-169`** — self-
  contained results-dialog scaffolding (`defineModel('visible')`, `@hide="reset"`,
  `useToast`, `:loading`, `shallowRef`) for the Central dialogs to mirror.
- **`src/router/index.ts:7,24-30`** — `embedded = embedDetection().active`;
  `/settings` registered only when `!embedded` → the servers section is embed-
  safe for free; editor Publish + ImportDialog source need explicit guards.

## i18n / tests

- **`src/i18n/locales/en/index.ts:6-40`** — namespace registration: import
  `central from './central.json'` + `...central,` in the `en` spread. The ONLY
  wiring for typing + `no-missing-keys` + runtime.
- **`src/i18n/index.ts:9,65-71`** — `MessageSchema = typeof en` (types every key);
  `useAppI18n().t` (components), `translate` (stores). Both `StrictTranslate`.
- **`src/i18n/locales/en/settings.json:1-51`** — namespace file shape to mirror
  (`{ "central": { ... } }`, nested string leaves only; ICU `{name}`).
- **`eslint.config.js:13,52-72`** — `localeDir` glob auto-discovers `central.json`;
  `no-missing-keys` ERROR (all `src/**`); `no-raw-text` WARN (components/views).
  No `no-restricted-imports` → core purity is review-enforced.
- **`vitest.config.ts:20-59`** — two projects (unit=node, component=happy-dom);
  floors: `src/core/**` 86/78/88, `src/stores/**` 80/85, `src/persistence/**`
  90/92; components/views have NO per-glob floor.
- **`tests/setup/unit.ts:1-27`** — node env; `globalThis.crypto`/`fetch` NOT
  shimmed because node v24 provides them (verified). Inject a fake `fetchImpl`;
  no route interception at the unit layer.
- **`tests/setup/component.ts:1-14`** — installs the shared `i18n` instance
  globally (rendered English works); Pinia is per-test via `freshPinia()`.
- **`tests/component/helpers.ts:1-27`** — `freshPinia()` + `mountWith(...)`.
- **`tests/component/settings-view.spec.ts:18-28,146-179`** — the template for a
  Central dialog/section component test (vi.mock seams, teleport stub,
  `vi.waitUntil`, `setLocaleMessage` + `afterEach setLocale('en')` to avoid
  cross-test bleed).
- **`playwright.config.ts:11-25`** — baseURL `http://localhost:4173`; webServer
  `pnpm build && pnpm preview` (VITE_E2E=1); chromium+firefox. No Vite proxy → e2e
  must mock via `page.route`.
- **`tests/e2e/helpers.ts:1-16`** / **`tests/e2e/import-export.spec.ts:1-68`** —
  thin e2e helpers + representative spec; no `page.route` anywhere yet
  (greenfield). Register the mock base URL **same-origin** to avoid preflight.

## Help / core error surface

- **`src/help/content.ts:99-234`** — `GuideHelp` interface (101-112), `GuideKey`
  union (114-122), `guideHelp` object `satisfies Record<GuideKey,GuideHelp>`
  (130-234), `CalloutId` union (99). Add `'central'`.
- **`src/help/guides.ts:11-27`** — `GUIDE_KEYS` order (add `'central'`) +
  `guideDocsUrl`.
- **`src/i18n/locales/en/guides.json`** — guide copy home; add
  `guides.central.{title,summary,steps.1..N}`.
- **`src/core/validate/issues.ts:20-42`** — `Issue` + `error()/warning()/info()`
  factories — for form-CONTENT problems only. **Central transport/API errors are
  NOT Issues** — use the typed `CentralError`.
