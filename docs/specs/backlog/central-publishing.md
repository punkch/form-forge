> **Delivered 2026-07-13.** Promoted to
> `docs/specs/2026-07-13-1331-central-publishing/` (shape + full implementation
> plan) and shipped. This file remains as the provenance record (CORS spike,
> resolved decisions).

# Optional ODK Central integration (publish + import) — shaping (backlog)

## Spike results (2026-07-13) — GO, with a server-side CORS requirement

Run against a real self-hosted Central dev instance (central-backend
v2024.3.1-129, central-frontend v2025.2.2) with an admin web-user account.

**Every API call in the Approach section works as assumed** (all verified
with `curl`):

| Call | Result |
| --- | --- |
| `POST /v1/sessions` (email+password) | 200 → `{token, csrf, expiresAt}` (24 h); `Authorization: Bearer <token>` accepted everywhere |
| `GET /v1/projects` | 200; each project carries a `verbs` array — use it to gate the Publish button (`form.create`/`form.update`) |
| `GET /v1/projects/:id/forms` | 200; **includes never-published forms** (`publishedAt: null`) — import picker must filter on `publishedAt` |
| `GET .../forms/:xmlFormId.xml` and `.../draft.xml` | 200, full XForm XML |
| `GET .../draft/attachments` | 200; `{name, type, hash, exists}` per expected attachment (derived by Central from the XForm) |
| `GET .../draft/attachments/:name` | 200, binary with correct content-type |
| `POST /v1/projects/:id/forms?ignoreWarnings=true&publish=false` (XML body) | 200 → form+draft created |
| same, formId already exists | **409, `code: 409.3`**, structured `details.fields/values` — drives the "update existing (match by formId)" branch |
| `POST .../forms/:xmlFormId/draft?ignoreWarnings=true` (XML body) | 200 `{success:true}` — updates the draft |
| `POST .../draft/attachments/:name` (binary body) | 200; hash appears in the attachments list |
| `DELETE /v1/sessions/:token` | 200 — the "disconnect" action |

**CORS: blocked by default, exactly as feared.** No response ever carries
`Access-Control-Allow-Origin` (any origin, incl. same-origin), and a
preflight `OPTIONS /v1/...` is proxied through to the backend, which
answers 404.1. central-backend has no CORS middleware in its source and no
config knob (checked v2024.3.1 source), so browser-direct calls from a
foreign origin cannot work against a stock install. Curl-level evidence is
conclusive: with no ACAO header the browser blocks the response, and every
call we make carries `Authorization`, which always forces a preflight.

**Working recipe (primary path)** — stock Central terminates TLS in its
own nginx (`files/nginx/odk.conf.template`), which proxies the API via a
`location ~ ^/v\d` block. Override that block to answer preflights and tag
responses (also applicable verbatim at any fronting proxy/LB, e.g. this
instance sits behind a Google LB):

```nginx
location ~ ^/v\d {
  set $cors_origin "";
  # allowlist the builder's origin(s)
  if ($http_origin = "https://<builder-origin>") { set $cors_origin $http_origin; }

  if ($request_method = OPTIONS) {
    add_header Access-Control-Allow-Origin $cors_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    add_header Access-Control-Max-Age 3600 always;
    return 204;
  }
  add_header Access-Control-Allow-Origin $cors_origin always;
  add_header Access-Control-Expose-Headers "ETag" always;

  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_pass http://service:8383;
  proxy_redirect off;
  proxy_request_buffering on;
  proxy_buffering off;
  proxy_read_timeout 2m;
}
```

Notes: the client authenticates with a Bearer header, not cookies, so
`Access-Control-Allow-Credentials` is not needed; `Authorization` must be
listed explicitly in `Allow-Headers` (a `*` wildcard does not cover it).
Fallback A (serve the builder from Central's origin) remains valid and
needs no config. The client must surface "CORS blocked" distinctly from
auth failure — a blocked preflight reaches JS as an opaque `TypeError:
Failed to fetch`, so the error UX should link to this recipe.

**If the Central deployment can't be touched at all** — CORS is enforced
by the browser and only the server side of a connection can relax it, so
there is no pure client-side workaround. The recipe above doesn't require
Central's own nginx specifically: any fronting proxy/LB (e.g. a Google LB)
can add the same headers, leaving the Central install untouched. Beyond
that, the options are "insert something between browser and Central" or
"don't use a browser", ranked:

1. **Org-hosted micro-proxy** (Fallback B): a ~20-line Cloudflare Worker
   or tiny container forwarding `/v1/*` and adding CORS headers; the
   builder gets a proxy-URL field per server record. Credentials and
   session tokens transit it, so it must be org-controlled — public CORS
   proxies are disqualified outright.
2. **Local Caddy proxy on the user's machine** — validated end-to-end
   2026-07-13 against the test instance (preflight, login/logout, API
   calls, incl. the multi-server variant below). Users run stock
   [Caddy](https://caddyserver.com) (Apache-2.0, single static binary,
   actively maintained — we ship documentation, not software) with this
   Caddyfile, then register `http://localhost:8123/<prefix>` as the
   server URL in the builder:

   ```caddyfile
   {
   	auto_https off
   }

   :8123 {
   	@preflight method OPTIONS
   	handle @preflight {
   		header Access-Control-Allow-Origin "https://<builder-origin>"
   		header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
   		header Access-Control-Allow-Headers "Authorization, Content-Type"
   		header Access-Control-Max-Age "3600"
   		header Access-Control-Allow-Private-Network "true"
   		respond 204
   	}

   	header Access-Control-Allow-Origin "https://<builder-origin>"
   	header Access-Control-Expose-Headers "ETag"

   	# one block per registered Central server; add + `caddy reload`
   	handle_path /my-central/* {
   		reverse_proxy https://central.example.org {
   			header_up Host {upstream_hostport}
   		}
   	}
   }
   ```

   Findings baked into that config:
   - `header_up Host {upstream_hostport}` is **mandatory** — verified
     that a forwarded `Host: localhost:8123` gets 404-routed before
     reaching Central's API (nginx `server_name`/LB host routing).
   - Multi-server = one static `handle_path` prefix per server on one
     port (least privilege: the proxy can only reach explicitly listed
     upstreams). A cors-anywhere-style dynamic target-in-path proxy
     (`localhost:3000/https://central…`) is deliberately rejected:
     fragile in Caddy (dynamic upstream + SNI/Host wiring) and an
     open-relay shape — blind requests to arbitrary hosts even though
     the pinned ACAO origin prevents response reads.
   - https page → `http://localhost` is exempt from mixed-content
     blocking (Chrome + Firefox treat loopback as trustworthy); Chrome's
     upcoming Local Network Access may add a one-time permission prompt,
     and the `Allow-Private-Network` header covers the older opt-in.
   - npm CORS proxies (`local-cors-proxy`, `cors-anywhere`) rejected:
     effectively unmaintained; credentials shouldn't transit abandonware.
   - Variant: Caddy can also `file_server` the builder's `dist/` and
     `reverse_proxy /v1/*` — fully same-origin, no CORS at all, at the
     cost of the hosted PWA's auto-updates.
   - **Client implication:** server-record URLs must accept plain `http`
     for loopback hosts only (`localhost`/`127.0.0.1`) and otherwise
     treat the base URL as opaque (path prefixes included), so all proxy
     shapes work unchanged.
3. **Desktop wrapper**: a native shell can do privileged requests outside
   the webview — a distribution-model change, far bigger than this
   feature. Out of scope, but the landscape (assessed 2026-07) for the
   record:
   - **Tauri** (preferred if ever pursued): Rust core + OS webview
     (WebView2/WKWebView/WebKitGTK), 3–10 MB binaries;
     `@tauri-apps/plugin-http` gives a fetch-compatible API that runs in
     Rust — no CORS — and is **scoped to a URL allowlist**, which maps
     directly onto our registered-server-records model. Cost: adds Safari
     (macOS) and WebKitGTK (Linux) engines to a compat matrix we
     currently test only on Chromium+Firefox — a real risk for the
     `@getodk/web-forms` preview, testable since the preview is already
     an isolated child app with pinned deps.
   - **Electron**: bundles its own Chromium — ships the exact engine we
     test, mature tooling (builder/updater/signing), but 100–200 MB
     installers and the maintainer owns the Chromium security-patch
     treadmill; renderer fetch stays CORS-bound, so privileged requests
     go through the main process over IPC.
   - Others (Wails, Neutralinojs, NW.js, Capacitor, Photino) don't change
     the fundamental bundled-Chromium vs OS-webview trade-off;
     Neutralino's weaker IPC/security model disqualifies it for anything
     handling credentials.
   - Either way: a thin wrapper repo consuming the same built `dist/`,
     privileged fetch hidden behind a seam like the persistence/embed
     backends — never a fork. Note that an installed **PWA does not
     help**: it's still the browser's security model, and Chrome's
     Isolated Web Apps (signed-bundle, admin-managed distribution) still
     CORS-bind ordinary fetch — their only escape is Direct Sockets,
     i.e. reimplementing TLS/HTTP in JS. Not applicable.

**Dev-time story (no server changes needed):** implement and manually
test via Vite's `server.proxy` pointing `/v1` at the test instance —
same-origin during `pnpm dev`, so the full publish/import flow works
today. E2e stays on Playwright route interception (never hits the
network). A security-disabled browser is acceptable for a one-off manual
verification pass against a built app, never as a user-facing answer.

**Version note:** everything above verified on central-backend v2024.3.1;
treat 2024.3 as the tentative minimum supported version.

## Problem

The export → download → upload-to-Central loop works but is manual, and the
reverse trip — a form that already lives on Central and needs edits — means
downloading its definition by hand first. Power users want "publish draft
to my Central project" and "import from my Central project" inside the
builder. This is the only backlog feature that talks to a network, so it
must not compromise the product's core guarantee: **no backend, nothing
leaves the device by default**.

## Scope

- Opt-in **server records**: the user can register multiple ODK Central
  servers (display name + base URL), stored locally only and managed from
  the settings page ([settings-page](settings-page.md)). Every picker and
  action below is scoped to an explicitly chosen server.
- **Publish as draft**: create/update a form draft on Central
  (`POST /v1/projects/:id/forms?ignoreWarnings=true&publish=false` with the
  XForm XML, then `POST .../draft/attachments/:name` for each attachment),
  surfacing Central's validation response.
- **Publish targets (per form, device-local; added 2026-07-13):** each
  library form keeps a list of destinations it has been published to
  (server record + project + xmlFormId + last published version/time).
  Importing from Central seeds the source as the first target; every
  successful publish appends or updates one. The publish dialog opens
  pre-filled with the most recent target and lists the others as
  one-click re-deploys — the multi-environment story (the same form on
  dev/staging/prod servers) is "pick a known target", never
  re-navigating pickers. Targets are device-local configuration like
  server records: never exported, cleaned up when their server record or
  form is deleted.
- **Import from Central**: server → project picker (`GET /v1/projects`) →
  form picker (`GET /v1/projects/:id/forms`) → download the definition and
  attachments (`GET .../forms/:xmlFormId.xml`, `GET .../attachments`,
  `GET .../attachments/:name`) and feed them through the existing import
  pipeline (XForm parser + `createFormWithArchiveAttachments`), landing in
  the library with the same row-level import report as file import.
- Project/form pickers are shared between the publish and import flows,
  plus an "open in Central" deep link. Publishing the draft to live stays
  in Central's UI (deliberate: review happens there).

## Hard constraints

- **CORS is the gating risk.** ODK Central's API historically does not send
  permissive CORS headers, so browser-direct calls from a different origin
  may be blocked. **Spike first** against a real Central instance:
  - If Central (or its nginx) can be configured to allow the builder's
    origin, document that server-side setup as a requirement.
  - Fallback A: instruct self-hosters to serve the builder from the same
    origin as Central (it's just static files — drop `dist/` behind
    Central's nginx).
  - Fallback B (last resort): a tiny optional CORS proxy the org hosts —
    explicitly not part of the default product.
  The spec is GO/NO-GO on this spike; everything else is straightforward.
- Credentials: session-token auth (`POST /v1/sessions`, email+password).
  **Decided 2026-07-13 (user):** passwords are stored per server record,
  but only encrypted at rest with a key derived from a user-chosen
  unlock passphrase (the "vault"). The derived key lives in memory only,
  for the session; the app prompts for the passphrase the first time any
  Central functionality is used in a session (or whenever the key is
  absent — first-ever use creates the passphrase). Session tokens stay
  memory-only per server record with a visible "connected as…" indicator;
  disconnect (and an explicit vault lock) wipes key and tokens. Threat
  model, stated honestly: encryption-at-rest protects stored passwords on
  stolen/shared devices and against casual IndexedDB inspection — not
  against code running in an already-unlocked page. A forgotten
  passphrase makes stored passwords unrecoverable by design: the reset
  path wipes stored passwords (server records survive) and the user
  re-enters them under a new passphrase. Server records, encrypted blobs
  and tokens never leak into *single-form / shareable* exports. (Updated
  2026-07-15: a *whole-workspace backup* deliberately carries server config +
  publish targets, and — opt-in on export, with a warning — the vault + saved
  passwords, for a turnkey restore; the share path stays credential-free. See
  `docs/specs/2026-07-15-1729-workspace-full-backup/`.)
- Every network call is user-initiated (a Publish/Import button) — no
  background sync, no telemetry, and the feature is invisible until the
  user adds a server in settings.

## Approach

- `src/core/central/client.ts`: thin typed fetch wrapper (sessions,
  projects, form list, form create/update, definition + attachment
  download, attachment upload, version conflict handling — Central rejects
  re-publishing an existing version string; offer "bump version" using the
  existing settings.version generator).
- `src/core/central/vault.ts` (pure TS, WebCrypto only — no new deps):
  PBKDF2-SHA-256 (OWASP-current iteration count, per-device random salt)
  derives a **non-extractable** AES-GCM `CryptoKey` from the passphrase;
  each stored password is `{iv, ciphertext}` with a fresh random IV; a
  key-check value (a known constant encrypted at vault creation)
  validates the passphrase at unlock time without touching real secrets
  — AES-GCM auth failure = wrong passphrase, detected immediately.
  `lock()` drops the key; the key lives in a module closure, never in
  reactive/devtools-visible store state. Changing the passphrase
  decrypts all records with the old key and re-encrypts with the new.
- `UnlockVaultDialog.vue`: passphrase prompt (create on first-ever use,
  unlock thereafter), triggered lazily by the first Central action of a
  session — publish, import, test-connection, or saving a server
  password in settings.
- Server records: a `centralServers` repo behind the persistence backend
  seam (Dexie table in a db v3 migration + memory-backend parity; specs
  run on both via `tests/helpers/backends.ts`). Encrypted password blobs
  and the vault salt/key-check live here; to the backend they are opaque
  bytes, so parity is unaffected. The same migration adds a
  `publishTargets` table (library form id → {serverId, projectId,
  xmlFormId, lastPublishedVersion, lastPublishedAt}), device-local like
  server records, cascade-cleaned with its server record/form.
- `PublishDialog.vue`: opens pre-filled from the form's publish targets
  (most recent first; import seeds the source as one) with the remaining
  targets as one-click re-deploy choices; full pickers stay available to
  switch server/project or create a new form. Flow: server + connection
  status → project picker → new form vs update existing (match by
  xmlFormId) → progress per attachment → result with Central's warnings
  passed through verbatim; success records/updates the target (version +
  timestamp). If the local formId no longer matches the chosen target's
  xmlFormId (renamed since), warn that publishing creates a NEW form on
  that server. Per-target "last published vX at T" comes from our own
  records; any live status check is an explicit user-triggered refresh —
  no background calls.
- Import: a "From Central" source alongside "From file" in the existing
  import flow (`ImportDialog.vue`), reusing the same parse-report UI;
  picker components shared with PublishDialog.
- E2e: against a mocked Central (Playwright route interception) — real
  Central integration testing stays manual with a checklist.

## Decisions (proposed)

- Import the **XForm XML** — our parser round-trips it losslessly — rather
  than the original `.xlsx` Central may hold; both formats already flow
  through `parseFormFile`, so this can be revisited if fidelity issues
  surface.
- Import the **published** version; importing an unpublished draft is out
  of scope for v1.
- An imported form is a plain workspace copy content-wise — no sync, and
  nothing server-related inside the FormDocument. **Revised 2026-07-13
  (user):** import DOES seed a device-local publish target pointing at
  the source server/project/form, so a later publish prompts with where
  the form came from; the user can always switch server/project or
  create a new form instead (see publish targets in Scope). Targets live
  outside the document, so exports stay clean.
- **Credential storage (decided 2026-07-13, user):** per-server passwords
  persisted encrypted under a single session-lifetime vault key, prompted
  for on first Central use per session (details in Hard constraints).
  One vault passphrase covers all server records; no plaintext password
  or token ever hits storage.

## Open questions

- Minimum supported Central version (attachment/draft API differences)?
- Should we also support the OpenRosa `/submission`-style form list for
  non-Central servers? Proposal: no — Central only, keep scope tight.
- ~~Credentials persistence~~ — resolved 2026-07-13: encrypted vault, see
  Decisions.
- ~~Import collision UX~~ — resolved 2026-07-13 (user): **offer replace**.
  On importing a formId that already exists in the library, ask the user:
  create a copy (non-destructive default) or replace the existing library
  form (destructive — explicit confirmation, overwrites local edits).

## Acceptance

CORS spike documented with a working recipe; publish-draft flow succeeds
against a test Central project incl. attachments; import flow lists
projects and forms from a mocked Central, pulls a form with two
attachments and opens it in the editor with both attachments present and
previewable; importing seeds a publish target and the publish dialog
pre-fills it; publishing the same form to a second server yields two
one-click re-deploy targets, and publish targets never appear in
workspace exports; two server records can be registered and every picker stays
scoped to the chosen server; disconnecting wipes the token; the first
Central action of a session prompts for the vault passphrase (create on
first-ever use) and a wrong passphrase is rejected via the key-check
value without decrypting any stored secret; vault lock/disconnect wipes
the derived key and tokens from memory; the forgotten-passphrase reset
wipes stored passwords but keeps server records; a workspace export made
while connected and unlocked contains no credential material — plaintext
or encrypted — and no server records (test asserts this).
