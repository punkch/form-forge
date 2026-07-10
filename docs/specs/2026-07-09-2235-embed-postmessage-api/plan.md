# Iframe embed mode + postMessage API — Plan

## Context

Host applications (portals, case-management systems) want to embed the
builder and own form storage themselves: the host loads a form into the
builder, the user edits, the host retrieves the full configuration — without
the builder writing to the user's browser library or exposing download
buttons the host doesn't want. Same app bundle, no separate build (user
decision 2026-07-09); see `shape.md` for the shaping decisions.

## Activation

Embed mode is active when **both** hold:

- `?embed=1` appears in `location.search` — i.e. **before** the hash, since
  the app uses hash routing (`/?embed=1#/forms/…`);
- `window.parent !== window` (the page is actually framed).

The optional `&origin=<url-encoded origin>` parameter pins the host origin
(recommended in production): inbound messages from any other origin are
silently ignored, and outbound messages target it instead of `'*'`.

Detection is `detectEmbed()` in `src/embed/detect.ts`, evaluated in
`src/main.ts` **before** the app mounts and in `src/router/index.ts` at route
table construction.

## Protocol v1 — wire contract

Every message (both directions) carries the envelope:

```jsonc
{ "channel": "odk-builder", "v": 1, "type": "<message type>", "requestId": "…?" }
```

Any message without `channel === 'odk-builder'` is not ours and is ignored
(this also filters Vite HMR / devtools traffic). Every host **request** must
carry a string `requestId`; the builder echoes it on the matching
`<type>-result` reply (or on `error`).

### Builder → host

| type | payload | when |
| --- | --- | --- |
| `ready` | `{ appVersion }` | once on boot. Posted to the URL-pinned origin, or `'*'` when none was given — it never contains form data. |
| `init-result` | `{ requestId, ok: true, protocolVersion: 1 }` | reply to `init`. |
| `load-form-result` | `{ requestId, ok, issues }` | reply to `load-form`. `issues` is `[{ severity, code, message }]`. On `ok: true` the builder has opened the editor with the form. |
| `save-form-result` | `{ requestId, ok: true, payload, meta }` | reply to `save-form`. `meta = { formId, title, version, errorCount, warningCount }`. |
| `set-config-result` | `{ requestId, ok: true }` | reply to `set-config`. |
| `state-changed` | `{ dirty, errorCount }` | debounced ~300 ms after the form's save state or error count changes (only after init). `dirty` is true whenever there are changes the builder has not finished persisting. |
| `error` | `{ requestId?, code, message }` | any failed request. Codes: `not-initialized`, `bad-request`, `no-form-loaded`, `load-failed`, `unsupported-format`. `load-failed` doubles as the generic "the form operation failed unexpectedly" code (there is no dedicated save-failure code in v1). |

### Host → builder

| type | payload | notes |
| --- | --- | --- |
| `init` | `{ requestId, config? }` | must be the first request; anything else before it gets `error { code: 'not-initialized' }`. Re-`init` is allowed and re-applies config. |
| `load-form` | `{ requestId, payload }` | `payload` is one of the three formats below. On success the builder stores the form (fresh record + attachment ids, refs remapped) and navigates to the editor. |
| `save-form` | `{ requestId, options?: { format?: 'archive' \| 'object' } }` | default `'archive'`. Flushes the in-flight autosave first. |
| `set-config` | `{ requestId, config }` | partial config merge, same shape as `init.config`. |

### Config

```ts
{
  exports?:     { xform?: boolean, xlsform?: boolean, zip?: boolean },
  persistence?: 'memory' | 'local',   // default 'memory'
  locale?:      string,               // BCP-47, e.g. 'en'
}
```

- **exports** — an export action is hidden only when its flag is explicitly
  `false`; all three `false` removes the Export button entirely.
- **persistence** — `'memory'`: nothing touches IndexedDB, the host owns
  durability. `'local'`: normal Dexie autosave into the browser library.
  Unknown keys/values are dropped (`coerceEmbedConfig`).
- **locale** — routed through the app's `setLocale`.

### Load payload formats

```ts
{ format: 'archive', data: ArrayBuffer }
  // single-form .odkbuilder.zip — the canonical, self-versioned interchange
  // format (manifest.formatVersion + FormDocument.schemaVersion). When the
  // archive contains several forms, the first one is taken.
{ format: 'object', doc: FormDocument, attachments: [{ filename, mediatype, data: ArrayBuffer }] }
  // doc passes through migrateDoc; attachments are matched to
  // doc.attachments[] refs by filename, unmatched refs are dropped.
{ format: 'new', title?: string }
  // blank form via newDocument(title)
```

Save replies use the mirrored `payload` shape (`archive` ArrayBuffer or
`object` with per-attachment ArrayBuffers). Malformed payloads are
`bad-request`; a `format` string we don't know is `unsupported-format`;
archive/doc parse failures come back as `load-form-result { ok: false,
issues }`.

### Security

- Only messages with `event.source === window.parent` are handled.
- With `?origin=` pinned, `event.origin` must equal it; non-matching
  messages are ignored **silently** (no probing feedback).
- After a valid `init`, **all** outbound posts use that init message's
  `event.origin` as `targetOrigin` — never `'*'`.
- `ArrayBuffer`s travel in the postMessage transfer list, not as copies.

## Design

### Persistence seam

`src/persistence/backend.ts` defines `PersistenceBackend` — the complete
storage surface the repos need (forms/attachments/snapshots CRUD, cascade
delete, atomic `importForm`) — plus `getPersistenceBackend()` /
`setPersistenceBackend()`. The Dexie implementation (`dexieBackend`) is the
module default; `src/persistence/memory-backend.ts` is the Map-based
implementation embed mode installs at boot. `forms-repo.ts`,
`attachments-repo.ts` and `workspace-io.ts` delegate every storage access
through the active backend while keeping **every exported function signature
identical** — so `fetchFormAttachment`, `exportZip`, the preview, autosave
and the workspace archive code paths work unchanged on either backend.
The memory backend clones records on read/write (matching Dexie's
structured-clone behavior) and shares immutable attachment `Blob`s by
reference. The templates repo (if present) stays Dexie-only — embed mode
never shows the library.

### Modules

- `src/embed/protocol.ts` — pure message type unions, guards
  (`isEnvelope`, `parseLoadFormPayload`, `parseSaveFormat`,
  `coerceEmbedConfig`) and `PROTOCOL_VERSION`. No Vue/DOM imports.
- `src/embed/detect.ts` — pure activation check (`?embed=1` in search +
  framed) and origin-param extraction.
- `src/embed/bridge.ts` — `startEmbedBridge({ router, pinia })`: window
  message listener, origin pinning, request dispatch and requestId
  correlation. `load-form`: archive → `readWorkspaceArchive` (first form),
  object → `migrateDoc`, new → `newDocument`; all converge on one
  `openForm(doc, attachments)` that mints a record via `createForm`, remaps
  attachment ids with the shared `remapAttachments` helper (like
  duplicateForm/archive import) and `router.push`es to the editor.
  `save-form`: `flushSave()` → `gatherArchiveForms([recordId])` →
  `buildWorkspaceArchive` (single form) or object payload, replied with the
  buffers transferred. Watches `form.saveState` + `form.errorCount` for the
  debounced `state-changed`. Returns a stopper (used by tests).
- `src/stores/embed.ts` — `{ active, hostOrigin, initialized, config }` +
  `applyConfig` (locale → `setLocale`) + `exportEnabled(kind)`. Backend
  switching stays in the bridge.

### Wiring

- `src/main.ts` — detects embed before mount; installs the memory backend
  (boot default in embed; `init` may switch to `'local'`), marks the embed
  store, starts the bridge (which posts `ready`).
- `src/router/index.ts` — in embed mode `/` renders
  `src/views/EmbedWaitingView.vue` ("Waiting for host…", i18n key
  `shell.embed.waiting`) instead of the library; the editor/preview routes
  are unchanged, so the library is unreachable.
- `src/components/shell/AppHeader.vue` — hides the back-to-library button
  in embed mode.
- `src/components/importexport/ExportMenu.vue` — filters the primary XML
  action and the menu items by `embed.exportEnabled(...)`; with XML hidden
  the first remaining action is promoted to the primary click; all three
  hidden renders nothing. Non-embed behavior (and the `export-button`
  test id) unchanged.

### Demo host

`public/embed-demo.html` — self-contained vanilla-JS host page served at
`/embed-demo.html`. Iframe src `./?embed=1&origin=` +
`encodeURIComponent(location.origin)`; buttons for Init (with an
"all exports disabled" toggle), Load sample (object format, two questions),
New form, Save (archive → meta + byte size + download link; the host keeps
its ArrayBuffer), Load back saved archive (transfers a copy); scrolling
message log of both directions.

## Tests

- `tests/unit/embed-protocol.spec.ts` — envelope/config/payload guards.
- `tests/component/embed-bridge.spec.ts` (happy-dom) — ready handshake,
  not-initialized gating, init-result + requestId correlation, silent
  rejection of wrong origins/channels, bad-request without requestId,
  unsupported formats, object load → editor route → object save round-trip
  on the memory backend, debounced `state-changed { dirty: true }`.
- `src/persistence/forms-repo.spec.ts` + `workspace-io.spec.ts` — the
  pre-existing repo specs now run as contract suites via
  `describe.each(backendCases)` (`tests/helpers/backends.ts`) against
  **both** Dexie and memory backends.
- `tests/e2e/embed.spec.ts` (Playwright, `frameLocator`) — demo page: ready
  logged, init handshake, load sample → question cards in the iframe, label
  edit → `"dirty":true` in the log, save → meta with `errorCount: 0` +
  byte size, load-back → edited label survives, and init with all exports
  `false` → no export button in the iframe.

## Acceptance (from shaping — all verified)

- Demo host page loads a form (object + archive), edits produce
  `state-changed`, save returns a payload that round-trips back in.
- `exports` all-false hides the Export menu.
- Unknown origins never get a reply.
- Memory persistence keeps IndexedDB untouched; repos behave identically on
  both backends (contract suites).
