# Embedding the ODK Form Builder — host integration guide

The builder can run inside your application's iframe and be driven entirely
over `window.postMessage`: you push a form in, the user edits it, you pull
the full configuration back out. In the default `memory` persistence mode
the builder writes **nothing** to the user's browser storage — your
application owns durability.

A complete working host page ships with the app at `/embed-demo.html`
(source: `public/embed-demo.html`) — open it against a running build to see
every message in a live log.

## 1. Embed the iframe

```html
<iframe id="builder"
        src="https://builder.example.com/?embed=1&origin=https%3A%2F%2Fhost.example.com">
</iframe>
```

- `embed=1` must be in the **query string, before the `#`** (the app routes
  with the hash).
- `origin=<url-encoded origin of YOUR page>` is optional but strongly
  recommended: the builder will silently ignore messages from any other
  origin and address all of its messages to yours.
- Give the iframe at least ~1280 px of width for the full three-panel
  editor; below that the builder falls back to its laptop/tablet layouts.

## 2. Speak the envelope

Every message in both directions carries:

```jsonc
{ "channel": "odk-builder", "v": 1, "type": "…", "requestId": "…" }
```

`requestId` is any string you choose per request; the reply
(`<type>-result` or `error`) echoes it. Always check `event.origin` and
`event.data.channel` in your listener:

```js
const builder = document.getElementById('builder').contentWindow
const BUILDER_ORIGIN = 'https://builder.example.com'

const send = (message, transfer = []) =>
  builder.postMessage({ channel: 'odk-builder', v: 1, ...message }, BUILDER_ORIGIN, transfer)

window.addEventListener('message', (event) => {
  if (event.origin !== BUILDER_ORIGIN) return
  const msg = event.data
  if (!msg || msg.channel !== 'odk-builder') return
  // …dispatch on msg.type
})
```

## 3. Handshake

The builder posts `ready` once it boots:

```jsonc
// builder → host
{ "channel": "odk-builder", "v": 1, "type": "ready", "appVersion": "2.0.0" }
```

Answer with `init` (required before anything else — earlier requests get
`error { code: 'not-initialized' }`):

```jsonc
// host → builder
{
  "channel": "odk-builder", "v": 1, "type": "init", "requestId": "r1",
  "config": {
    "exports": { "xform": false, "xlsform": false, "zip": false },
    "persistence": "memory",
    "locale": "en"
  }
}
// builder → host
{ "channel": "odk-builder", "v": 1, "type": "init-result",
  "requestId": "r1", "ok": true, "protocolVersion": 1 }
```

Config, all keys optional:

- **`exports`** — hides the builder's own download actions. Only an
  explicit `false` hides an action; all three `false` removes the Export
  button entirely (typical when your app owns the exported artifacts via
  `save-form`).
- **`persistence`** — `'memory'` (default): nothing touches IndexedDB;
  `'local'`: the form also autosaves into the user's browser library.
- **`locale`** — UI language (BCP-47), e.g. `'en'`.

Use `set-config` any time later to change config (replied with
`set-config-result`).

## 4. Load a form

Until the first `load-form` the iframe shows a "Waiting for host…" screen.
Three payload formats:

```jsonc
// blank form
{ "type": "load-form", "requestId": "r2",
  "payload": { "format": "new", "title": "Site inspection" } }

// your stored archive blob (recommended round-trip format)
{ "type": "load-form", "requestId": "r3",
  "payload": { "format": "archive", "data": ArrayBuffer } }

// raw document + attachments
{ "type": "load-form", "requestId": "r4",
  "payload": {
    "format": "object",
    "doc": { /* FormDocument JSON, schemaVersion 1 */ },
    "attachments": [
      { "filename": "villages.csv", "mediatype": "text/csv", "data": ArrayBuffer }
    ]
  } }
```

Pass the `ArrayBuffer`s in the transfer list if you don't need your copy:
`send(msg, [msg.payload.data])`.

Reply:

```jsonc
{ "type": "load-form-result", "requestId": "r3", "ok": true,
  "issues": [ { "severity": "warning", "code": "…", "message": "…" } ] }
```

On `ok: true` the editor opens with the form. On `ok: false` the `issues`
array says why the content was unusable (e.g. unsupported schema version).
Malformed requests get `error { code: 'bad-request' }`; an unknown
`format` gets `error { code: 'unsupported-format' }`.

## 5. Track edit state

After init, the builder emits (debounced ~300 ms):

```jsonc
{ "type": "state-changed", "dirty": true, "errorCount": 0 }
```

`dirty` means there are changes the builder hasn't finished persisting —
use it for your own close guards. `errorCount` is the form's current
validation error count.

## 6. Save the form back

```jsonc
// host → builder (options optional; format defaults to 'archive')
{ "type": "save-form", "requestId": "r5", "options": { "format": "archive" } }

// builder → host
{ "type": "save-form-result", "requestId": "r5", "ok": true,
  "payload": { "format": "archive", "data": ArrayBuffer },
  "meta": { "formId": "site_inspection", "title": "Site inspection",
            "version": "1", "errorCount": 0, "warningCount": 1 } }
```

The builder flushes any pending autosave before serializing, and transfers
the buffers to you. Store the archive blob opaquely — it is self-versioned
and is exactly what `load-form { format: 'archive' }` accepts back. With
`options.format: 'object'` you get `{ doc, attachments: [{ filename,
mediatype, data }] }` instead. If no form has been loaded yet you get
`error { code: 'no-form-loaded' }`.

`meta.errorCount > 0` means the form currently fails validation — the
builder still hands you the configuration (your call whether to accept it).

## 7. Error reference

| code | meaning |
| --- | --- |
| `not-initialized` | request received before `init`. |
| `bad-request` | malformed message (missing `requestId`, wrong payload shape). |
| `no-form-loaded` | `save-form` with nothing loaded. |
| `load-failed` | the form operation failed unexpectedly (also used for unexpected save failures). |
| `unsupported-format` | a `format` value the protocol doesn't know. |

## Security notes

- The builder only accepts messages from its **parent window**; with the
  `origin` URL parameter it additionally drops any message whose origin
  doesn't match — silently, so probes learn nothing.
- After `init`, everything the builder posts targets your origin
  explicitly (never `'*'`). Before `init` it only ever posts `ready` and
  `not-initialized` errors, which contain no form data.
- Nothing is written to browser storage in `memory` mode; the user's local
  form library is unreachable inside the embed (no library route, no
  back-navigation).
