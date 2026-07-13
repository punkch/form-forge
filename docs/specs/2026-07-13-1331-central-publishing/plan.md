# Plan — ODK Central integration (publish + import) (2026-07-13)

## Context

Form Forge is client-side-only: no backend, nothing leaves the device by
default. This feature adds the **only** networked capability in the product —
publish a form draft to an ODK Central project, and import a published form
from Central — behind a strict opt-in. It is invisible until the user registers
a server in App Settings, every network call is user-initiated, and no server
record or credential material ever enters an export.

The shaping/provenance doc is `docs/specs/backlog/central-publishing.md`
(CORS spike GO, all decisions resolved). `shape.md` in this folder records the
resolved decisions plus six planning-time refinements (version-bump helper,
CORS heuristic, atomic replace seam, app-global unlock dialog, single `central`
i18n namespace, three-table db v3). `references.md` carries the recon-verified
integration points. This is the first `fetch` code in the codebase — there is
no existing HTTP seam to copy; the persistence backend seam and the preview
`makeFetchFormAttachment` factory are the "isolate the risky dependency behind
a seam" patterns to imitate.

Branch: **development** (per task). Conventional commits; release-please derives
versions from `main`. **No `Co-Authored-By` trailer on any commit** (global
user instruction).

## Wave & package structure

Four waves. Within a wave, packages have **disjoint file ownership** (every
shared file — `backend.ts`, `memory-backend.ts`, `db.ts`, `App.vue`,
`SettingsView.vue`, `EditorDialogs.vue`, `ImportDialog.vue`, `editor.ts`,
`FormEditorView.vue`, `src/i18n/locales/en/index.ts`, `guides.json` — belongs
to exactly one package in exactly one wave). Cross-package *imports* (not
edits) are noted.

- **Wave 1 — foundations (4 parallel packages):** central client (core), vault
  (core crypto), persistence (db v3 + repos + seam), shared prep (version-bump +
  roleFor extraction + the complete `central` i18n key tree). Everything a later
  wave references is defined here so later waves never touch a shared foundation
  file.
- **Wave 2 — store foundation (1 package):** the central Pinia store + the
  cross-route UnlockVaultDialog (app-global mount) + the three shared
  server/project/form pickers. Wave 3 UI depends on all of this, so it lands as
  its own wave for clean parallelism.
- **Wave 3 — feature UI (3 parallel packages):** settings CentralServersSection;
  Publish (dialog + toolbar button + targets + 409 bump + rename warning);
  Import ("From Central" source + core import assembly + collision replace).
- **Wave 4 — tests, help, docs (3 parallel packages):** e2e mocked Central;
  help guide; documentation (README/roadmap/CLAUDE.md/user-guide/verification).

This refines the task's suggested 3-wave shape by splitting the store
foundation (my Wave 2) out of the UI (my Wave 3) so every wave is truly
parallel with no intra-wave dependency. Mapping: task Wave 2 = my Waves 2+3;
task Wave 3 = my Wave 4.

---

## Task 1: Save spec documentation — DONE at promotion

`docs/specs/2026-07-13-1331-central-publishing/` with plan.md (this file),
shape.md, references.md, standards.md, user-guide.md. No `visuals/` (text
feature). Backlog doc gets a one-line "promoted" pointer at its top.

---

## WAVE 1 — Foundations

### WP1-A — Central client (pure-TS core transport)

**Goal:** a thin, injectable, typed fetch wrapper for every Central endpoint,
with a typed error carrying a `kind` discriminant, and defensive DTO coercion.

**Owns (create):**
- `src/core/central/types.ts`
- `src/core/central/client.ts`
- `src/core/central/index.ts` (barrel — re-exports `./types`, `./client`, AND
  `./vault`; the `./vault` re-export is a forward reference to WP1-B's file,
  resolved at integration since both land in Wave 1)
- `src/core/central/client.spec.ts`
- `src/core/central/types.spec.ts` (error/coercion cases)

**Implementation notes:**
- **Seam via factory** — mirror `src/preview/fetchFormAttachment.ts:1-23`
  (factory returning a function) and the persistence setter-seam. Signature:
  `createCentralClient({ baseUrl, fetchImpl = globalThis.fetch.bind(globalThis) })`.
  `bind` is **mandatory** — an unbound `fetch` throws "Illegal invocation" in
  browsers (recon core-help gotcha). Tests inject a fake `fetchImpl` returning
  canned `Response` objects (works in node v24 — no polyfill; see
  `tests/setup/unit.ts`).
- **Opaque base URL** — join `baseUrl + '/v1/...'` preserving any path prefix
  (`http://localhost:8123/my-central`) and never double-slashing. The base URL
  is treated as opaque per the Caddy multi-server recipe; do not parse/reassemble
  its host.
- **Token per call** — the client is stateless re: auth; methods that need it
  take a `token` and send `Authorization: Bearer <token>` (forces a preflight,
  which is expected). The session token lives in the store closure, not here.
- **Endpoints (all verified in the spike table):**
  - `createSession(email, password): {token, csrf, expiresAt}` — `POST /v1/sessions`
  - `deleteSession(token): void` — `DELETE /v1/sessions/:token`
  - `listProjects(token): Project[]` — `GET /v1/projects` (each carries a
    `verbs[]` array — the store uses `form.create`/`form.update` to gate Publish)
  - `listForms(token, projectId): FormSummary[]` — `GET .../:id/forms`
    (**includes `publishedAt:null` never-published forms** — the import picker
    filters on `publishedAt != null`)
  - `getPublishedFormXml(token, projectId, xmlFormId): string` —
    `GET .../forms/:xmlFormId.xml`
  - `getDraftFormXml(...)` — `.../draft.xml` (scaffold now; v1 imports published
    only)
  - `listPublishedAttachments(token, projectId, xmlFormId): AttachmentDescriptor[]`
    — `GET .../forms/:xmlFormId/attachments` → `{name, type, hash, exists}`
  - `downloadPublishedAttachment(...): Blob` — `.../attachments/:name`
  - `createForm(token, projectId, xml): void` — `POST .../forms?ignoreWarnings=true&publish=false`;
    **on formId collision → 409 `code:'409.3'`** with structured
    `details.fields/values` (drives the update-existing branch)
  - `updateDraft(token, projectId, xmlFormId, xml): void` —
    `POST .../forms/:xmlFormId/draft?ignoreWarnings=true`
  - `uploadDraftAttachment(token, projectId, xmlFormId, name, blob, contentType): void`
    — `POST .../draft/attachments/:name`
  - `listDraftAttachments(...)` — `.../draft/attachments` (used post-create to
    know expected attachments)
- **`CentralError extends Error`** in `types.ts` — mirror `XmlParseError`
  (`src/core/xform/xml-reader.ts:10-15`). Carries `kind: 'cors' | 'network' |
  'auth' | 'http' | 'conflict' | 'not-found'`, `status?: number`, `code?: string`
  (e.g. `'409.3'`), `details?: unknown` (Central's conflict payload). **Do NOT
  model transport errors as validate `Issue`s** (`Issue.message` is rendered
  verbatim and is form-node-scoped — wrong shape; recon core-help gotcha).
- **Error classification:**
  - `fetch` **rejects** (TypeError: Failed to fetch) → CORS or offline,
    indistinguishable at the network layer. Heuristic (planning refinement):
    `globalThis.navigator?.onLine === false` → `kind:'network'`, else
    `kind:'cors'`. Both map (in the UI) to copy that links the setup recipe.
  - `fetch` **resolves** with a non-OK Response → classify by status: `401/403`
    → `'auth'`, `409` → `'conflict'` (parse `code`/`details`), `404` →
    `'not-found'`, other → `'http'`.
- **Untrusted-input coercion** — every field read off a parsed Central JSON goes
  through `isRecord` (`src/core/util/guards.ts:8-14`) + per-field type checks,
  exactly like `coerceMeta` in `src/core/workspace/archive.ts:61-72`. Never
  trust response shape.
- **User-agent** — if the client tags requests, source from `appVersion()`
  (`src/version.ts`), the only version signal (e.g. `Form-Forge/${appVersion()}`).
- **Purity** — no Vue/Pinia/Dexie/vue-i18n/`src/stores`/`src/persistence`
  imports. May read `src/core/model/types.ts`.

**Tests & coverage:** co-located specs, node env. **`src/core/**` floor:
statements ≥86 / branches ≥78 / lines ≥88** — branches are the binding
constraint. Cover every branch: each error kind (cors via onLine=false→network
and onLine=true→cors, auth 401, conflict 409.3 with details, not-found 404,
http 500), successful DTO coercion vs malformed responses, opaque-base-URL join
with and without a path prefix, the `bind` default vs an injected `fetchImpl`.

**Introduces:** no testids/i18n keys (pure core).

---

### WP1-B — Credential vault (pure-TS WebCrypto)

**Goal:** passphrase-derived, non-extractable AES-GCM encryption of per-server
passwords, with a key-check for unlock validation and a module-closure key.

**Owns (create):**
- `src/core/central/vault.ts`
- `src/core/central/vault.spec.ts`

(Does **not** touch `index.ts` — WP1-A owns the barrel and re-exports `./vault`.)

**Implementation notes:**
- WebCrypto off `globalThis`, following `src/core/model/ids.ts:1-2`'s
  `globalThis.crypto.randomUUID()` convention (no feature-detect, no new dep;
  node v24 + browsers both provide `crypto.subtle`/`getRandomValues`;
  `tsconfig.app.json` lib includes DOM for `CryptoKey`/`SubtleCrypto` types).
- **Key derivation:** PBKDF2-SHA-256, **OWASP-current iteration count
  (600,000)**, per-device random 16-byte salt, `deriveKey` to an AES-GCM key
  with **`extractable: false`** and usages `['encrypt','decrypt']`.
- **Blobs:** `EncryptedBlob = { iv: Uint8Array, ciphertext: Uint8Array }` — a
  fresh 12-byte random IV per encryption. Structured-clone-safe primitives only;
  **never a `CryptoKey`** on any persisted record.
- **Key-check:** at vault creation, encrypt a fixed known constant → store the
  resulting `{iv, ciphertext}` as `keyCheck`. At unlock, derive the key and
  decrypt `keyCheck`; **AES-GCM auth failure ⇒ wrong passphrase**, detected
  without touching real secrets.
- **Module-closure key** — the derived `CryptoKey` lives in a module-level
  `let currentKey` inside `vault.ts`, never returned, never in a ref/store
  (Pinia devtools would expose it). Precedent: `src/persistence/backend.ts:82`
  `let activeBackend`.
- **API (returns/consumes opaque bytes + booleans only):**
  - `isUnlocked(): boolean`
  - `create(passphrase): Promise<{ salt: Uint8Array, keyCheck: EncryptedBlob }>`
    — derive + install key, return meta to persist
  - `unlock(passphrase, meta): Promise<boolean>` — derive + verify key-check;
    install key + return `true` on success, `false` on auth failure
  - `lock(): void` — drop `currentKey`
  - `encrypt(plaintext: string): Promise<EncryptedBlob>` (throws if locked)
  - `decrypt(blob: EncryptedBlob): Promise<string>` (throws if locked)
  - `resetKey(newPassphrase): Promise<{ salt, keyCheck }>` — new salt + key-
    check for the forgotten-passphrase reset (the repo wipes stored passwords;
    see WP1-C). Change-passphrase (decrypt-all-with-old + re-encrypt-with-new)
    is **out of scope for v1** — only reset is required by acceptance.
- **Persistence boundary** — vault does crypto only; storage of salt/key-check/
  ciphertext lives in `src/persistence` (WP1-C). No persistence import here.

**Tests & coverage:** `src/core/**` floor (86/78/88). Assert behavior, not key
material (non-extractable key can't be exported — that's the intended boundary):
encrypt→decrypt round-trip; unlock with correct passphrase returns true and
enables decrypt; wrong passphrase returns false and leaves the vault locked;
`encrypt`/`decrypt` throw when locked; reset produces a distinct salt. **Call
`vault.lock()` in `beforeEach`** — the module-closure key persists across specs
in the same vitest worker (recon core-help gotcha).

---

### WP1-C — Persistence (db v3 + repos + seam parity)

**Goal:** three new Dexie tables behind the backend seam with full memory-
backend parity, two new repos, an atomic replace method, and the export-
isolation regression test.

**Owns (create):**
- `src/persistence/central-servers-repo.ts`
- `src/persistence/publish-targets-repo.ts`
- `src/persistence/central-servers-repo.spec.ts`
- `src/persistence/publish-targets-repo.spec.ts`
- `tests/unit/central-export-isolation.spec.ts`

**Owns (modify):**
- `src/persistence/db.ts` — record interfaces + EntityTable fields + v3 stores
- `src/persistence/backend.ts` — interface + `dexieBackend` impl
- `src/persistence/memory-backend.ts` — memory impl (parity)
- `src/persistence/forms-repo.ts` — add `replaceFormWithArchiveAttachments`
- `tests/helpers/backends.ts` — clear the new tables in dexie setup

**Implementation notes:**
- **db.ts (recon `db.ts:51-74`):** DB name stays `'odk-form-builder'` (origin-
  scoped; a rename orphans every user's data). Add interfaces beside
  `FormRecord`/`AttachmentRecord`/`TemplateRecord`:
  - `CentralServerRecord { id, name, baseUrl, email?, encryptedPassword?: EncryptedBlob }`
    — password is opaque `{iv, ciphertext}` bytes; **no plaintext, no token, no
    key** ever on this record.
  - `CentralVaultRecord { id: 'vault', salt: Uint8Array, keyCheck: EncryptedBlob }`
    — single fixed-id row (global; one passphrase covers all servers, and the
    vault can exist before any server — so it must NOT be denormalized onto
    server rows; recon persistence gotcha).
  - `PublishTargetRecord { id, formRecordId, serverId, projectId, xmlFormId, lastPublishedVersion, lastPublishedAt }`.
  - Add EntityTable fields: `centralServers!: EntityTable<CentralServerRecord,'id'>`,
    `centralVault!: EntityTable<CentralVaultRecord,'id'>`,
    `publishTargets!: EntityTable<PublishTargetRecord,'id'>`.
  - After the existing `this.version(2)` block, add exactly:
    `this.version(3).stores({ centralServers: 'id', centralVault: 'id', publishTargets: 'id, formRecordId, serverId' })`
    — declare ONLY the new tables (prior tables carry over, mirroring the v2
    block at `db.ts:68`). `publishTargets` indexes `formRecordId` (list a form's
    targets) and `serverId` (cascade on server delete).
- **backend.ts (recon `backend.ts:11-88`):** extend the `PersistenceBackend`
  interface (this is the parity contract — TS won't compile until both impls
  satisfy it) and implement in the `dexieBackend` object literal:
  - Server CRUD: `listCentralServers`, `getCentralServer`, `addCentralServer`,
    `putCentralServer`, `deleteCentralServer` (**atomic:** delete the server row
    AND its `publishTargets` where `serverId` matches, AND — for
    forgotten-reset-independent server removal — its own encrypted password goes
    with the row).
  - Vault meta: `getVaultMeta`, `putVaultMeta`, `clearVaultMeta`.
  - Publish targets: `listPublishTargets(formRecordId)`,
    `listPublishTargetsByServer(serverId)`, `upsertPublishTarget`,
    `deletePublishTargetsForForm(formRecordId)`.
  - Forgotten-passphrase reset: `resetVault(meta, /* wipes */)` — a single
    atomic op that writes the new `centralVault` row AND clears
    `encryptedPassword` on every `centralServers` row (server records survive;
    recon persistence gotcha). Keep "reset vault" and "delete server" distinct.
  - Atomic replace: `replaceFormWithArchiveAttachments(existingRecordId, doc, attachments, opts)`
    — one transaction that overwrites the existing form + its attachments,
    **keeping the record id** (see below).
  - **Extend `deleteFormCascade`** to also delete `publishTargets` where
    `formRecordId` matches (so form deletion cascades to targets, automatically,
    for the library delete flow).
- **memory-backend.ts (recon `memory-backend.ts:14-104`):** add a
  `centralServers` Map, a `publishTargets` Map, and a nullable module var for
  the single vault-meta row inside the closure; clone on read/write via
  `structuredClone` (ArrayBuffer/Uint8Array clone cleanly). Implement every new
  method with identical semantics. `createMemoryBackend()` returns fresh state
  per call, so the memory case needs no clear helper.
- **Repos** — thin wrappers over `getPersistenceBackend()`, mirroring
  `forms-repo.ts`/`attachments-repo.ts` (recon: **do NOT** copy
  `templates-repo.ts`, which imports `db` directly and thereby forfeits memory
  parity). IDs from `newId()` (`@/core/model/ids`). The repo is **crypto-
  ignorant** — it persists opaque `{iv,ciphertext}`/salt bytes; the vault logic
  is WP1-B.
  - `central-servers-repo.ts`: `listCentralServers`, `getCentralServer`,
    `saveCentralServer`, `deleteCentralServer`, vault-meta `getVaultMeta`/
    `setVaultMeta`/`clearVaultMeta`, `resetVaultWipingPasswords(meta)`.
  - `publish-targets-repo.ts`: `listTargetsForForm`, `upsertTarget`,
    `deleteTargetsForForm`. (server-scoped delete happens inside
    `deleteCentralServer`.)
- **forms-repo.ts** — add `replaceFormWithArchiveAttachments(existingRecordId, doc, attachments, opts?)`
  next to `createFormWithArchiveAttachments` (`forms-repo.ts:83-113`). Same
  filename-keyed remap + `dropUnmatched:true` semantics, but targets an existing
  record id via the new atomic seam method. Reuse `deriveRecordFields`.
- **backends.ts (recon `tests/helpers/backends.ts:16-30`):** add
  `db.centralServers.clear()`, `db.centralVault.clear()`, `db.publishTargets.clear()`
  to the dexie-case `Promise.all([...])` or every parity spec bleeds state.

**Tests & coverage:** **`src/persistence/**` floor is the strictest —
statements ≥90 / lines ≥92** (aggregate over the directory; new repos + two
backend impls add many lines). Required:
- Both-backend parity specs (`describe.each(backendCases)` importing the repo as
  a namespace; template `forms-repo.spec.ts:15`) for server CRUD, vault-meta,
  publish-targets CRUD, cascade-on-server-delete, cascade-on-form-delete, reset-
  wipes-passwords-keeps-servers, and `replaceFormWithArchiveAttachments` (id
  stability + attachment overwrite).
- **v2→v3 migration test** mirroring `templates-repo.spec.ts:60-102`: build a
  prior-version Dexie on an isolated `new IDBFactory()` with `IDBKeyRange` from
  `fake-indexeddb`, seed a row, close, reopen via `new BuilderDb({...})`, assert
  `upgraded.verno === 3`, old data survives, and the three new tables are usable.
- **Export-isolation regression** (`tests/unit/central-export-isolation.spec.ts`,
  both backends): seed a form + a `centralServers` row with encrypted-password
  bytes + a `centralVault` row + a `publishTargets` row, run `gatherArchiveForms()`
  then `buildWorkspaceArchive(...)`, assert (a) gathered forms carry no server
  fields, (b) the zip entries are only `manifest.json` + `forms/**` (no server/
  target path), and (c) the serialized archive text contains **none** of the
  server's `baseUrl`/`name`/a ciphertext sentinel. This pins the "safe by
  construction" guarantee (`gatherArchiveForms` reads only forms/attachments,
  `workspace-io.ts:19-49`) against regression.

**Introduces:** no testids/i18n keys.

---

### WP1-D — Shared prep: version bump + roleFor extraction + i18n key tree

**Goal:** pre-stage the three shared helpers/files every later wave depends on,
so no UI wave edits a shared foundation file.

**Owns (create):**
- `src/core/model/version.ts` + `src/core/model/version.spec.ts`
- `src/core/model/attachment-role.ts` + `src/core/model/attachment-role.spec.ts`
- `src/i18n/locales/en/central.json`

**Owns (modify):**
- `src/core/model/factory.ts` — re-point its private `defaultVersion` to import
  from `version.ts`
- `src/composables/useAttachmentUpload.ts` — import `roleFor` from the new core
  module
- `src/i18n/locales/en/index.ts` — import + spread `central.json`

**Implementation notes:**
- **`version.ts`** — move `defaultVersion()` out of `factory.ts:17` (currently
  module-private, `yyyymmddHHMM`) into an exported function, and add
  `bumpVersion(current?: string): string`. **Distinctness guarantee** (planning
  refinement — the shaping doc's "existing settings.version generator" does not
  exist as a bump helper, and same-minute regeneration yields an identical
  string): compute `candidate = defaultVersion()`; if `candidate !== current`
  return `candidate`; else return a counter-suffixed form (`${candidate}-2`, and
  if `current` already ends in `-N` bump to `-(N+1)`) — always distinct from
  `current`. Note the display formatter (`library-display.ts` `TIMESTAMP_VERSION`
  regex) formats bare 12-digit timestamps; a suffixed version simply renders
  raw, which is acceptable and signals "manually bumped". `factory.ts` imports
  `defaultVersion` from here so its `newDocument`/`instantiateTemplate` behavior
  is byte-identical.
- **`attachment-role.ts`** — extract the pure `roleFor(filename, mediatype):
  AttachmentRole` out of `useAttachmentUpload.ts:24-31` (currently unexported
  and inside a Vue composable that imports `@/stores/form`, so it cannot be
  imported into pure core — recon import-pipeline gotcha). Place it in core so
  the Central import assembly (WP3-C) can build `AttachmentRef.role` without a
  Vue dependency. `useAttachmentUpload.ts` imports it (behavior unchanged).
- **`central.json`** — the **complete** `central` namespace key tree, defined
  upfront so Wave-2/3 UI packages reference keys without ever editing a shared
  i18n file. Single top-level key `central`, nested string leaves only (a
  malformed array/non-string leaf produces confusing far-away vue-tsc errors —
  recon i18n gotcha). Subtrees:
  - `central.servers.*` — settings section: heading/description, add/edit/remove,
    field labels (name, base URL, email, password), validation messages
    (base-URL required, http-only-for-loopback), test-connection, save.
  - `central.vault.*` — unlock/create dialog: create-passphrase, confirm,
    unlock, wrong-passphrase, lock, forgotten-reset confirm copy.
  - `central.connection.*` — "connected as {email}", connect, disconnect.
  - `central.publish.*` — dialog header, server/project picker labels, new-form
    vs update-existing, target list + one-click re-deploy, rename warning
    ("publishing creates a NEW form on {server}"), per-attachment progress,
    result (Central warnings passed through verbatim), 409 conflict + bump-
    version offer, success toast.
  - `central.import.*` — "From Central" source label, pickers, published-only
    note, collision offer-replace (copy vs replace + danger confirm), report
    strings.
  - `central.errors.*` — one entry per `CentralError.kind` (`cors` with the
    setup-recipe pointer, `network`, `auth`, `notFound`, `http`, `conflict`) —
    the UI maps `kind` → copy; **core never localizes**.
  - `central.store.*` — store-surfaced strings (toasts, any undo labels). Using
    `central.store.*` rather than `stores.central.*` keeps this the single
    i18n file WP1-D owns (planning refinement).
  - Register in `src/i18n/locales/en/index.ts` (import `central from './central.json'`
    + `...central,` in the `en` spread). This single edit wires runtime catalog
    + `MessageSchema` typing + eslint `no-missing-keys` discovery.

**Tests & coverage:** `src/core/**` floor (86/78/88) for `version.ts` and
`attachment-role.ts`. `version.spec.ts`: bare timestamp shape; `bumpVersion`
returns a distinct string when `current` equals a freshly generated timestamp
(the binding case), and increments an existing `-N` suffix.
`attachment-role.spec.ts`: role classification parity with the pre-extraction
behavior. i18n: the app already has an i18n smoke test; `no-missing-keys` +
vue-tsc validate the new keys once referenced.

**Introduces:** the entire `central.*` i18n key namespace (no testids).

---

## WAVE 2 — Store foundation

### WP2-A — Central store + UnlockVaultDialog + shared pickers

**Goal:** the reactive surface every Wave-3 UI package consumes, plus the
cross-route unlock dialog and the shared pickers.

**Owns (create):**
- `src/stores/central.ts`
- `src/components/central/UnlockVaultDialog.vue`
- `src/components/central/CentralServerPicker.vue`
- `src/components/central/CentralProjectPicker.vue`
- `src/components/central/CentralFormPicker.vue`
- `src/stores/central.spec.ts`
- `tests/component/unlock-vault-dialog.spec.ts`

**Owns (modify):**
- `src/App.vue` — mount `<UnlockVaultDialog/>` app-globally beside
  `<ConfirmDialog/>` (`App.vue:35`), so it is reachable from library, editor,
  and settings.

**Implementation notes:**
- **Setup-store style** (`defineStore('central', () => {...})`), mirroring
  `src/stores/workspace.ts`:
  - **Reactive:** server list via `liveQuery(centralServersRepo.listCentralServers)`
    held in a closure `let subscription` (workspace.ts:13,18 precedent);
    per-server connection state (`Map<serverId, {status, email?}>` exposed
    reactively); `isUnlocked` computed that calls `vault.isUnlocked()`; a
    `hasServers` computed (gates UI); active-server selection.
  - **Non-reactive closure:** `let tokens = new Map<serverId, string>()` for
    session tokens (form.ts:46-47 / workspace.ts:13 closure-`let` precedent).
    Tokens and the vault key are **never** in reactive/Pinia state (devtools-
    visible).
  - **Actions:** `ensureUnlocked()` (promise-gated — see below);
    `connect(serverId)` (decrypt password via `vault.decrypt`, `client.createSession`,
    stash token, set connection state); `disconnect(serverId)`
    (`client.deleteSession`, wipe token + state); `lockVault()` (vault.lock +
    clear all tokens + reset connection states); `listProjects(serverId)`,
    `listForms(serverId, projectId)` (via token + client — used by pickers);
    server CRUD + password save (encrypt via `vault.encrypt` → repo);
    `resetVault(newPassphrase)` (vault.resetKey → repo.resetVaultWipingPasswords);
    publish-target accessors (`listTargetsForForm`, `upsertTarget`).
  - **Authenticated orchestration (the token seam — REQUIRED so tokens stay
    private).** The pure core `import.ts`/`publish.ts` runners take an injected
    `client + token`, but the token must never leave the store (invariant).
    Therefore the store — the only holder of the token and the only thing that
    can build a client from a `baseUrl` and ensure a live session — owns the
    authenticated entry points, and the pickers/dialogs call these, never a raw
    token/client accessor:
    - `importFormFromCentral(serverId: string, projectId: number, xmlFormId: string): Promise<CentralImportResult>`
      — internally `ensureUnlocked()` → ensure a session token (`connect` if
      absent) → run the pure core import runner with `{ client: clientFor(baseUrl),
      token, projectId, xmlFormId }`. `CentralImportResult = { document:
      FormDocument; issues: Issue[]; attachments: ArchiveAttachment[] }` is
      exported from `src/core/central/import.ts` (WP3-C).
    - `publishForm(serverId: string, projectId: number, opts: { xml: string;
      attachments: ArchiveAttachment[]; xmlFormId: string; mode: PublishMode;
      onProgress?: (done: number, total: number) => void }): Promise<CentralPublishResult>`
      — same auth path, then the pure core publish runner. The **dialog** owns
      reading the open form (serialize + resolve attachment blobs) and passes
      `xml`/`attachments` in, so the central store never couples to the form
      store. `PublishMode` (`'create'|'update'`) and `CentralPublishResult`
      (Central warnings verbatim; **carries `warnings: string[]`** which the
      dialog renders as a list) are exported from `src/core/central/publish.ts`
      (WP3-B). Throws `CentralError` on failure. **The `central.ts` implementer
      imports these types from `@/core/central/publish` and
      `ArchiveAttachment` from `@/core/workspace/archive` — do not redefine
      them.** `projectId` is Central's numeric project id
      (`GET /v1/projects/:id`); `serverId` is our own record id.
    Do **NOT** expose a public `tokenFor`/client accessor — that leaks the token
    to callers and breaks the "tokens never leave the store" invariant.
  - Central client is constructed per server from its `baseUrl`
    (`createCentralClient({ baseUrl })`).
- **Promise-gated unlock** — `ensureUnlocked(): Promise<void>` resolves
  immediately if `vault.isUnlocked()`, else opens `UnlockVaultDialog` by setting
  reactive store state (`unlockPromptOpen = true`, `unlockMode: 'create'|'unlock'`
  determined by whether vault meta exists) and stores a pending resolver; the
  dialog calls back into the store (`submitUnlock`/`submitCreate`/`cancelUnlock`)
  which resolves/rejects. First Central action of a session awaits this.
- **UnlockVaultDialog** — local/`defineModel`-free; visibility driven by
  `central.unlockPromptOpen`. Create mode: passphrase + confirm →
  `central.submitCreate`. Unlock mode: passphrase → `central.submitUnlock`
  (wrong passphrase shows `central.vault.wrongPassphrase`, does not close).
  A forgotten-passphrase link → danger confirm (`useConfirm`, FormLibraryView.vue:110-119
  shape) → `central.resetVault`. Mount at App root (recon: editor.activeDialog
  is editor-reset-prone and cannot back a cross-route dialog).
  - testids: `unlock-vault-dialog`, `unlock-vault-passphrase`,
    `unlock-vault-confirm`, `unlock-vault-submit`, `unlock-vault-forgot`,
    `unlock-vault-reset-confirm`.
- **Pickers** — PrimeVue `Select`-based components reading the store:
  - `CentralServerPicker` — options from the reactive server list; testid
    `central-server-select`, per-option `central-server-option-${id}`.
  - `CentralProjectPicker` — calls `central.listProjects(serverId)` on server
    change (explicit, user-initiated); shows connection state; testid
    `central-project-select`.
  - `CentralFormPicker` — calls `central.listForms`; testid `central-form-select`.
  - Each pairs with `@hide`/reset hygiene when embedded in a dialog so a prior
    connection's project list never leaks across opens (recon settings-ui gotcha).
  - PrimeVue pieces imported per-SFC (never globally registered); no new PrimeVue
    dep (pinned 4.3.3).

**Tests & coverage:** **`src/stores/**` floor: statements ≥80 / lines ≥85** (no
branch floor). `central.spec.ts` (happy-dom pragma if it needs DOM/crypto):
ensureUnlocked resolves-when-unlocked / opens-dialog-when-locked; connect stores
a token and sets "connected" state; disconnect wipes both; lockVault clears all
tokens; hasServers reflects the repo; password save encrypts before persisting
(assert the persisted bytes are not the plaintext). WebCrypto works in both
node and happy-dom (recon i18n-tests — verified). Component test for the dialog
via `mountWith(freshPinia(), ...)` (`tests/component/settings-view.spec.ts` is
the template: teleport stub, `vi.waitUntil` for async Dialog render).

**Introduces testids:** `unlock-vault-*`, `central-server-select`,
`central-project-select`, `central-form-select`, `central-server-option-*`.
**i18n:** consumes `central.vault.*`, `central.connection.*`, `central.servers.*`
(all defined in WP1-D).

---

## WAVE 3 — Feature UI (parallel; all depend on WP2-A + WP1-*)

### WP3-A — Settings: CentralServersSection

**Goal:** register/edit/remove servers and save encrypted passwords from App
Settings.

**Owns (create):**
- `src/components/central/CentralServersSection.vue`
- `tests/component/central-servers-section.spec.ts`

**Owns (modify):**
- `src/views/SettingsView.vue` — replace the extension-point comment at line
  124 with `<CentralServersSection/>` (a plain `<section class="settings-section"
  data-testid="settings-central">`, reusing the section/row/field/note scoped
  classes; recon settings-ui integration point).

**Implementation notes:**
- Section markup mirrors the About section (`SettingsView.vue:95-122`): heading
  + rows. Per server: display name, base URL, email, "save password"
  (triggers `central.ensureUnlocked()` then encrypts + persists), test-
  connection button (connect/disconnect), remove (danger confirm →
  `central.deleteCentralServer`, which cascades targets).
- **Base-URL validation** — accept plain `http` only for loopback
  (`localhost`/`127.0.0.1`), otherwise require `https`; treat the URL as opaque
  incl. path prefixes (shaping doc client implication). Validation messages from
  `central.servers.*`; inline `<small class="prop-issue" data-testid="...">`
  pattern (`FormSettingsDialog.vue:269-274`).
- Fields use the `prop-field` label/InputText pattern; import
  `@/components/properties/prop-section.css`.
- Embed-safe for free: the `/settings` route is absent in embed
  (`router/index.ts:24-30`), so this section never renders in embed mode.
- testids: `settings-central`, `central-add-server`, `central-server-row-${id}`,
  `central-server-name`, `central-server-url`, `central-server-email`,
  `central-server-save-password`, `central-server-test`, `central-server-remove`.

**Tests:** component-level (no coverage floor on components). Section renders;
adding a server persists; invalid base URL shows the validation message; save-
password path triggers unlock; remove confirms and deletes. Mount via
`mountWith` with `ToastService`/`ConfirmationService` plugins.

**i18n:** `central.servers.*`, `central.connection.*`, `central.vault.*`.

---

### WP3-B — Publish (dialog + toolbar + targets + 409 bump + rename warning)

**Goal:** publish the open form's draft to a chosen (or remembered) Central
target, with conflict/bump and rename handling.

**Owns (create):**
- `src/components/central/PublishDialog.vue`
- `src/core/central/publish.ts` (pure publish-sequence helper) +
  `src/core/central/publish.spec.ts`
- `tests/component/publish-dialog.spec.ts`

**Owns (modify):**
- `src/components/EditorDialogs.vue` — mount `<PublishDialog/>`
- `src/stores/editor.ts` — add `'publish'` to the `EditorDialog` union
  (`editor.ts:6-15`) AND clear it in `reset()` (`editor.ts:70-81`)
- `src/views/FormEditorView.vue` — a Publish `<Button data-testid="publish-button">`
  right after `<ExportMenu>` (`FormEditorView.vue:253`), gated
  `centralStore.hasServers && !embed.active`

**Implementation notes:**
- **Trigger** — editor toolbar. Opening sets `editor.activeDialog = 'publish'`
  (this dialog IS editor-scoped, so `activeDialog` is correct here — unlike the
  cross-route unlock dialog). Publish is a network sibling of Export; gate on
  `hasServers && !embed.active` (embed uses the memory backend; centralServers
  would not persist there anyway — recon stores gotcha).
- **Reads the open form** exactly like `ExportMenu.vue`: XForm via
  `serializeXForm(toRaw(form.doc))` (`ExportMenu.vue:46`), attachments via
  `listAttachments(form.recordId)` (`ExportMenu.vue:59`); formId/version from
  `doc.settings` (`ExportMenu.vue:24-27`).
- **Pre-fill from publish targets** — on open, `central.listTargetsForForm(recordId)`;
  pre-select the most recent target's server/project; list the rest as one-click
  re-deploy buttons. Full pickers (WP2-A) stay available to switch server/project
  or create a new form.
- **`publish.ts` (pure sequence, core):** given an injected client + token +
  projectId + xml + `ArchiveAttachment[]`, run: create-or-update draft (choose
  by whether the target xmlFormId exists / user's new-vs-update choice) →
  per-attachment `uploadDraftAttachment` with progress callbacks → return a
  structured result (**exported `CentralPublishResult`**, Central warnings passed
  through verbatim). Throws `CentralError` on failure; core stays framework-free.
- **Auth/token seam** — the dialog does NOT call `publish.ts` directly (it has
  no token). It resolves the payload — `serializeXForm(toRaw(form.doc))` +
  attachment blobs from the persistence repo — and calls the **store** action
  `central.publishForm(serverId, projectId, { xml, attachments, xmlFormId, mode,
  onProgress? }): Promise<CentralPublishResult>` (WP2-A), which injects
  `client + token` into the core runner. This keeps the token in the store and
  keeps the central store decoupled from the form store (the dialog owns reading
  the open form).
- **409 conflict → bump offer** — when `createForm` throws
  `CentralError{kind:'conflict', code:'409.3'}`, offer to bump: call
  `bumpVersion(doc.settings.version)` (WP1-D), apply through
  `form.mutate('...', d => { d.settings.version = next })` (reuse the
  `FormSettingsDialog.vue:35-40` `set('version', ...)` path — `mutate` is
  synchronous on `doc.value`, so re-serialize from the live doc after the
  mutation, no `flushSave` await needed; recon stores gotcha), then retry.
- **formId-rename warning** — if `doc.settings.formId !== chosenTarget.xmlFormId`
  (renamed since import/last publish), warn that publishing creates a **NEW**
  form on that server (`central.publish.renameWarning`).
- **On success** — `central.upsertTarget({ formRecordId, serverId, projectId,
  xmlFormId, lastPublishedVersion: doc.settings.version, lastPublishedAt: now })`.
  Per-target "last published vX at T" comes from our own records; any live
  status is an explicit user-triggered refresh (no background calls).
- `@hide="reset"` clears connection/project/progress state.
- testids: `publish-button`, `publish-dialog`, `publish-target-${id}`,
  `publish-server-select` (reused picker), `publish-project-select`,
  `publish-new-form` / `publish-update-existing`, `publish-submit`,
  `publish-bump-version`, `publish-rename-warning`, `publish-result`.

**Tests & coverage:** `publish.spec.ts` under **`src/core/**` (86/78/88)** —
create vs update path, per-attachment upload sequencing, warning pass-through,
409 surfaced as conflict. Component test: pre-fill from a seeded target, one-
click re-deploy, rename warning shows when formId≠target, bump offer on a
mocked 409.

**i18n:** `central.publish.*`, `central.errors.*`.

---

### WP3-C — Import ("From Central" source + assembly + collision replace)

**Goal:** import a published Central form (definition + attachments) into the
library with the file-import report UX and offer-replace collision handling.

**Owns (create):**
- `src/core/central/import.ts` (pure assembly) + `src/core/central/import.spec.ts`
- (component test additions co-located or in a new
  `tests/component/import-from-central.spec.ts`)

**Owns (modify):**
- `src/components/importexport/ImportDialog.vue` — add a "From Central" source
  branch beside the `FileDropzone` (`ImportDialog.vue:92`)

**Implementation notes:**
- **`import.ts` (pure assembly, core):** given an injected client + token +
  projectId + xmlFormId, run: `getPublishedFormXml` → `parseXForm(xml)`
  (`src/core/xform/parser.ts:167`, **not** `parseFormFile` — bypass the
  File/extension dispatch; call `parseXForm` on the string directly) →
  `listPublishedAttachments` → per-file `downloadPublishedAttachment` →
  `ArchiveAttachment[]` (`{filename, mediatype, blob}`, `archive.ts:37-41`),
  mediatype from the download's Content-Type, defaulting to
  `application/octet-stream` like `archive.ts`. **THE critical gotcha:** the
  XForm parser sets `doc.attachments = []` and never populates it
  (`parser.ts:95`). Before returning, **build `AttachmentRef[]` from the
  attachment list** (using `roleFor` from WP1-D) and set `doc.attachments`, or
  (a) `refs.ts` validation flags every referenced file as "referenced but not
  uploaded" (`refs.ts:55-100`), and (b) zip export omits the attachments. Note
  `createFormWithArchiveAttachments` uses `dropUnmatched:true`, so
  Central's `exists:false` (expected-but-not-uploaded) attachments will drop
  from `doc.attachments` — acceptable (matches file-import "missing = not
  uploaded"). **Exports `type CentralImportResult = { document: FormDocument;
  issues: Issue[]; attachments: ArchiveAttachment[] }`** and the pure runner
  that returns it. The runner is `client + token`-injected — it does NOT know
  about the store; the store's `importFormFromCentral` (WP2-A) is what injects
  them, so the token stays private.
- **ImportDialog "From Central" source** — today the dialog is single-source
  (`FileDropzone` while `result===null`, `ImportDialog.vue:92`). Add a source
  toggle; the Central branch runs the WP2-A pickers (server → project → form),
  then calls the **store** action `central.importFormFromCentral(serverId,
  projectId, xmlFormId): Promise<CentralImportResult>` (WP2-A owns the auth/token
  seam — the component must NOT build a client+token itself). Map the returned
  `CentralImportResult` into the same `ImportParseResult`-shaped `result` so the
  existing report UI (`ImportDialog.vue:105-125`) renders unchanged. Hold parsed
  docs in `shallowRef` (avoid `DataCloneError` to IndexedDB — recon import
  gotcha).
- **Landing** — the Central path must call
  `createFormWithArchiveAttachments(document, attachments)` (`forms-repo.ts:83`),
  **not** `createForm` (which is attachment-less, `ImportDialog.vue:77`), then
  `router.push({name:'editor', params:{formId: record.id}})`. Preview works with
  no extra work — `makeFetchFormAttachment` resolves `jr://` by filename against
  stored `AttachmentRecords` (`fetchFormAttachment.ts:9-23`).
- **Seed the source publish target** on success:
  `central.upsertTarget({ formRecordId: record.id, serverId, projectId,
  xmlFormId, lastPublishedVersion: <published version>, lastPublishedAt: now })`
  so a later Publish pre-fills the origin.
- **Collision offer-replace** — detect by matching `document.settings.formId`
  against `listForms()` formIds (guard `formId !== ''`, `workspace-io.ts:76`).
  Offer **copy** (non-destructive default → `createFormWithArchiveAttachments`
  as-is, new record id) or **replace** (destructive → danger confirm
  `useConfirm` → `replaceFormWithArchiveAttachments(existingId, document,
  attachments)` from WP1-C, keeping the record id + its publish targets). Surface
  network/CORS/auth failures **distinctly** (not through the file-oriented
  `common.readFailed` copy) via `central.errors.*` mapped from `CentralError.kind`.
- testids: `import-source-central`, `import-source-file`, `central-server-select`
  (reused), `central-project-select`, `central-form-select`,
  `import-central-confirm`, `import-collision-copy`, `import-collision-replace`.

**Tests & coverage:** `import.spec.ts` under **`src/core/**` (86/78/88)** with an
injected fake client: XML→parseXForm→attachments assembly; **`doc.attachments`
is populated** (the load-bearing assertion); `exists:false` handling; mediatype
defaulting; error kinds surfaced. Component test: From-Central flow renders the
report, copy vs replace collision paths.

**i18n:** `central.import.*`, `central.errors.*`.

---

## WAVE 4 — Tests, help, docs (parallel)

### WP4-A — e2e against a mocked Central

**Owns (create):** `tests/e2e/central.spec.ts`, fixtures (e.g.
`tests/e2e/fixtures/central/*`).
**Owns (modify):** `tests/e2e/helpers.ts` — add `registerCentralServer` +
`mockCentral` route helpers.

**Implementation notes:**
- No `page.route` usage exists yet — greenfield. e2e runs against the **built**
  app (`pnpm build && pnpm preview` at `http://localhost:4173`, no Vite proxy),
  so Central MUST be mocked via `page.route(...)` + `route.fulfill(...)` and
  never hit the network.
- **Register the mock base URL same-origin under `http://localhost:4173`**
  (recon recommendation) so the client's `fetch('.../v1/...')` is same-origin —
  no CORS preflight, no ACAO needed. This matches the legitimate Fallback A /
  Caddy `file_server` deployment, so the test path mirrors production. (The
  cross-origin alternative would force handling `OPTIONS` preflight + ACAO on
  every fulfill — avoided.)
- **Fixture set:** `POST /v1/sessions` → `{token,csrf,expiresAt}`; `GET /v1/projects`
  → projects with `verbs`; `GET .../forms` → forms incl. one `publishedAt:null`
  (assert it's filtered out of the import picker); `GET .../:xmlFormId.xml`;
  `GET .../attachments` + `.../attachments/:name` for **a form with two
  attachments** (the import acceptance test). Register routes BEFORE the action.
- **Scenarios (map to acceptance):** register two servers; unlock prompt on first
  action (create then wrong-passphrase reject then correct); import a two-
  attachment form → both present + previewable; import seeds a target and the
  Publish dialog pre-fills it; publish to a second server → two one-click re-
  deploy targets; disconnect wipes the token indicator; a workspace export made
  while connected+unlocked contains no credential material.

**Tests:** the specs themselves (chromium + firefox). No coverage floor.

---

### WP4-B — Help guide ('central')

**Owns (modify):**
- `src/help/content.ts` — add `'central'` to the `GuideKey` union
  (`content.ts:114-122`) + a `guideHelp.central` entry (title/summary/steps/
  searchKeywords + `docsUrl`, e.g. `https://docs.getodk.org/central-forms/`),
  `satisfies Record<GuideKey, GuideHelp>` (`content.ts:130-234`)
- `src/help/guides.ts` — add `'central'` to `GUIDE_KEYS` order (`guides.ts:11-20`)
- `src/i18n/locales/en/guides.json` — add `guides.central.{title,summary,steps.1..N}`

**Implementation notes:** the registry is `satisfies`-checked, so a missing
catalog key is a vue-tsc/`no-missing-keys` build error — keep content.ts,
guides.ts, and guides.json in sync. `guides.json` is a different file from
WP1-D's `central.json`, so no ownership conflict. A first-use callout on the
settings section (CalloutId + `guides.callouts.<id>` + `ui.dismissedCallouts`)
is **optional/deferred** (avoids touching `ui.ts`); the guide is the required
deliverable. GuideContent/GuideTrigger render by key automatically.

**i18n:** `guides.central.*` (in `guides.json`).

---

### WP4-C — Documentation & delivery

**Owns (modify):**
- `README.md` — Features section (Central publish/import ⬜→✅)
- `docs/product/roadmap.md` — move central-publishing from pending to delivered
- `CLAUDE.md` — code-map (`src/core/central/`, the `central` i18n namespace, the
  new persistence repos + db v3, the central store, the guide), documentation
  index (this spec folder; drop central-publishing from the backlog "blocked"
  note)
- `docs/specs/2026-07-13-1331-central-publishing/user-guide.md` — complete the
  end-user walkthrough (the CORS server-setup recipes are already staged there)
- `docs/verification/2026-07-13-central-publishing/` — verification log
  placeholder (filled during the agent-browser pass)

**Implementation notes:** CLAUDE.md's "keep this file up to date" mandate — the
code-map row for `src/core/` should note `central/` (client + vault + import +
publish); persistence should note db v3 + the two repos; stores should note
`central`. Also remove the backlog's "blocked on a CORS spike" line since the
spike is done (GO). Keep the backlog file with its "promoted" pointer.

---

## Cross-cutting rules (every package)

- **Core purity** — nothing in `src/core/central` (or the new `src/core/model`
  helpers) imports Vue/Pinia/Dexie/vue-i18n or `src/stores`/`src/persistence`.
  Enforced by review only (eslint has no `no-restricted-imports`; recon core-
  help gotcha). Core emits stable `code` strings + verbatim English `message`
  for content issues, and a typed `CentralError` for transport — never localizes.
- **Every network call is user-initiated** — no background sync, no telemetry,
  no polling. Status is our own recorded data; live checks are explicit refresh.
- **Embed gating** — the whole feature is invisible until a server exists AND
  hidden in embed. The `/settings` route is embed-absent (auto-hides settings +
  the servers section); the editor Publish button and ImportDialog "From
  Central" source are on always-present routes and need explicit
  `hasServers && !embed.active` guards.
- **No plaintext secrets at rest** — only `{iv,ciphertext}`/salt/key-check bytes
  are persisted. Plaintext password exists transiently only during `connect`
  (needed for the sessions POST) — within threat model.
- **Tokens + `CryptoKey` never in reactive state** — session tokens in a store
  closure Map; the derived key in the `vault.ts` module closure. Never a ref/
  Pinia field (devtools-visible).
- **No server/credential material in exports** — pinned by the WP1-C isolation
  regression test on both backends; `gatherArchiveForms` reads only forms/
  attachments by construction.
- **Preserve existing `data-testid`s**; new controls add their own (namespaced
  `central-*` / `publish-*` / `import-*` / `unlock-vault-*` — avoid the
  `settings-dialog`/`settings-tab-*` clashes owned by `FormSettingsDialog`).
- **Rendered English byte-stable** — e2e/component assert substrings; all visible
  strings via `t('central.*')` (`no-missing-keys` is an error; `no-raw-text` a
  warn in components/views).
- **Conventional commits, NO `Co-Authored-By` trailer** (global user
  instruction overriding any default).

## Verification plan (definition of done)

Commands (all must pass):
- `pnpm lint` — clean (incl. `@intlify/no-missing-keys`; no raw UI strings).
- `pnpm typecheck` — clean (`central.*` keys resolve through `StrictTranslate`;
  both backend impls satisfy the extended `PersistenceBackend`).
- `pnpm test` — unit + component green.
- `pnpm test:coverage` — floors met: `src/core/**` 86/78/88 (branch-dense
  client/vault/import/publish are the risk), `src/stores/**` 80/85,
  `src/persistence/**` 90/92.
- `pnpm build && pnpm test:e2e` — chromium + firefox green (mocked, same-origin).

Plus:
- **agent-browser manual pass** over the built app (register a server; unlock
  create → wrong → correct; import a two-attachment form and preview both;
  pre-filled publish + one-click re-deploy to a second server; disconnect wipes
  the indicator; forgotten-passphrase reset keeps servers, wipes passwords;
  export contains no credential material) — logged to
  `docs/verification/2026-07-13-central-publishing/`. (Manual real-Central pass
  uses the dev-time Vite `server.proxy` /v1 story from the shaping doc; a
  security-disabled browser is acceptable only for a one-off manual pass, never
  a user-facing answer.)
- **`/code-review`** (five lenses, no plan mode); fix findings immediately.
- **Conventional commit(s) on `development`** grouped sensibly, e.g. a single
  `feat(central): publish drafts to and import forms from ODK Central`, or per-
  wave (`feat(central): typed client + credential vault`, `feat(persistence):
  db v3 central servers, vault and publish targets`, `feat(central): publish and
  import dialogs`, `test(e2e): mocked Central publish/import`, `docs(central):
  guide, README, roadmap, CLAUDE.md`). **No `Co-Authored-By` trailer.**
- Update README Features, `docs/product/roadmap.md`, and `CLAUDE.md` in the same
  change (WP4-C).

## Acceptance criteria (from the shaping doc)

- CORS spike documented with a working recipe (in `user-guide.md`).
- Publish-draft flow succeeds against a test Central project incl. attachments
  (manual real-Central pass; e2e mocked).
- Import lists projects/forms from a mocked Central, pulls a form with two
  attachments, opens it in the editor with both attachments present and
  previewable.
- Importing seeds a publish target and the Publish dialog pre-fills it;
  publishing the same form to a second server yields two one-click re-deploy
  targets; publish targets never appear in workspace exports.
- Two server records can be registered; every picker stays scoped to the chosen
  server; disconnecting wipes the token.
- The first Central action of a session prompts for the vault passphrase (create
  on first-ever use); a wrong passphrase is rejected via the key-check without
  decrypting any stored secret; vault lock/disconnect wipes the derived key and
  tokens; the forgotten-passphrase reset wipes stored passwords but keeps server
  records.
- A workspace export made while connected + unlocked contains **no** credential
  material (plaintext or encrypted) and no server records (test asserts this).
