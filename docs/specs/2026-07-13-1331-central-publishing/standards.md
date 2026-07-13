# Skills & Conventions for ODK Central integration

The following skills and conventions apply to this work.

---

## unops-toolkit:shape-spec (skill)

- **Source:** `plugins/unops-toolkit/skills/shape-spec/` (invoked to promote
  the backlog proposal into this timestamped spec folder).
- **Why it applies:** the delivery process (CLAUDE.md) requires a shaping doc →
  timestamped spec folder (shape/plan/references/standards/user-guide) before
  parallel implementation.
- **Key points:** Task 1 always saves the spec documentation first; the plan is
  copied in full (not summarized); each package is specific and actionable.

## unops-toolkit:code-review (skill) — at delivery

- **Why it applies:** the delivery process runs `/code-review` (five lenses, no
  plan mode) on the wave diffs, fixing findings immediately before commit.

## agent-browser / verify (skills) — at delivery

- **Why it applies:** verification includes a manual agent-browser pass over the
  built app, logged to `docs/verification/`.

---

## CLAUDE.md hard invariants that apply

### `src/core/` is pure TS

`src/core/central/` (client, vault, import, publish, types) and the new
`src/core/model/` helpers (version, attachment-role) must **not** import
Vue/Pinia/Dexie/vue-i18n or `src/stores`/`src/persistence`. Core may use
Web-platform globals off `globalThis` (crypto, fetch, navigator, TextEncoder)
defensively — the `xml-reader.ts`/`ids.ts` precedent. This is the first network
code in the app, so the fetch seam is established here (injectable `fetchImpl`
defaulting to `globalThis.fetch.bind(globalThis)`). Purity is **review-enforced**
(no `no-restricted-imports` in eslint).

Core emits stable `code` strings + verbatim-English `message` for content
`Issue`s (rendered as-is in the UI), and a typed `CentralError`
(kind/status/code/details) for transport/protocol failures — **never** an
`Issue`, and core **never** localizes. The UI maps `CentralError.kind` →
`central.errors.*` copy.

### Persistence goes through the backend seam

New storage (three db-v3 tables, two repos, the atomic replace method) is
declared on the `PersistenceBackend` interface and implemented in **both**
`dexieBackend` and `createMemoryBackend` — the interface is the parity contract
(TS won't compile until both are complete). Specs run on both via
`tests/helpers/backends.ts`. Repos are thin wrappers over `getPersistenceBackend()`
(mirror `forms-repo.ts`/`attachments-repo.ts`; **not** `templates-repo.ts`,
which bypasses the seam). The Dexie DB name `'odk-form-builder'` must not change
(origin-scoped). Encrypted material is opaque `{iv,ciphertext}`/salt/key-check
bytes — no `CryptoKey`, token, or plaintext on any persisted record.

### Serializer/parser parity is pinned

Import reuses `parseXForm` (pyxform-4.5.0-pinned round-trip); publish reuses
`serializeXForm`. This feature adds no new golden fixtures and must not perturb
existing serializer behavior.

### Version pins

PrimeVue 4.3.3 + `@primeuix` are byte-matched to `@getodk/web-forms` — add **no**
new PrimeVue dep; import PrimeVue pieces per-SFC. The vault uses WebCrypto only —
**no new crypto dependency**.

### UI strings only via vue-i18n

A new **`central` namespace** (`src/i18n/locales/en/central.json`), the complete
key tree defined upfront in Wave 1 so no later UI package edits the shared i18n
files. Never the `settings` namespace (owned by `FormSettingsDialog`). Store-
surfaced strings live under `central.store.*` (not `stores.central.*`) to keep
the file single-owner. Guide copy is the exception — `guides.json`.
`useAppI18n().t` in components, `translate` in stores; `no-missing-keys` is an
ERROR, and keys are `StrictTranslate`/vue-tsc-checked. Rendered English is
byte-stable (e2e/component assert substrings).

### Preserve `data-testid`s

New affordances add namespaced testids (`central-*`, `publish-*`, `import-*`,
`unlock-vault-*`, `settings-central`); none reuse the `settings-dialog` /
`settings-tab-*` testids owned by `FormSettingsDialog`, or any existing
`settings-*` page testid.

### Conventional commits — NO self-attribution

Conventional commits on `development` (release-please derives versions from
`main`). **No `Co-Authored-By: Claude` trailer or any self-attribution** —
global user instruction, overriding any default guidance.

---

## Conventions this feature adds

- **Networked capability is strictly opt-in and invisible by default.** Every
  network call is user-initiated (a Publish/Import/Test button); no background
  sync, polling, or telemetry. The feature is hidden until a server is
  registered AND whenever embed mode is active. Status shown is our own recorded
  data; any live check is an explicit user refresh.
- **Secrets never touch reactive state or storage in the clear.** The vault
  `CryptoKey` lives in the `vault.ts` module closure; session tokens live in the
  central-store closure Map. Persisted bytes are always encrypted. Plaintext
  passwords exist only transiently during `connect` (the sessions POST) — within
  the stated threat model (no protection against code in an already-unlocked
  page).
- **Device-local config is export-excluded by construction and by test.** Server
  records, vault meta, and publish targets live in their own db-v3 tables, which
  `gatherArchiveForms` never reads; a regression test on both backends asserts no
  credential material or server data leaks into a workspace archive.
- **CORS is a documented server-side requirement, not a client workaround.** The
  client surfaces a blocked request distinctly (kind `cors` via a
  `navigator.onLine` heuristic) and links the nginx/Caddy/same-origin recipes in
  the user guide; there is no pure-client bypass.
- **Cross-route dialogs mount app-globally, driven by a dedicated store.** The
  UnlockVaultDialog mounts once in `App.vue` and is driven by the central store's
  promise-gated `ensureUnlocked()`, never by the editor-scoped `activeDialog`
  (which resets on every form load). Editor-only dialogs (Publish) may use
  `editor.activeDialog`.
