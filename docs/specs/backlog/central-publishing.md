# Optional ODK Central integration (publish + import) — shaping (backlog)

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
- Credentials: session-token auth (`POST /v1/sessions`, email+password) —
  the password is never stored; the session token is held in memory per
  server record with a visible "connected as…" indicator and a disconnect
  button that wipes it. Whether a token may optionally be persisted
  ("remember on this device", IndexedDB, per server record) is an open
  question to settle at promotion. Server records and tokens never leak
  into exports or workspace archives — server records are device-local
  configuration, not workspace content.
- Every network call is user-initiated (a Publish/Import button) — no
  background sync, no telemetry, and the feature is invisible until the
  user adds a server in settings.

## Approach

- `src/core/central/client.ts`: thin typed fetch wrapper (sessions,
  projects, form list, form create/update, definition + attachment
  download, attachment upload, version conflict handling — Central rejects
  re-publishing an existing version string; offer "bump version" using the
  existing settings.version generator).
- Server records: a `centralServers` repo behind the persistence backend
  seam (Dexie table in a db v3 migration + memory-backend parity; specs
  run on both via `tests/helpers/backends.ts`).
- `PublishDialog.vue`: server + connection status → project picker → new
  form vs update existing (match by formId) → progress per attachment →
  result with Central's warnings passed through verbatim.
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
- An imported form is a plain library copy — no persistent link back to
  the source server/form, no sync; re-publishing matches by formId as
  above.

## Open questions

- Minimum supported Central version (attachment/draft API differences)?
- Should we also support the OpenRosa `/submission`-style form list for
  non-Central servers? Proposal: no — Central only, keep scope tight.
- Credentials persistence (see Hard constraints): memory-only tokens, or
  opt-in persisted tokens per server record? Decide with the user at
  promotion.
- Import collision UX: importing a formId that already exists in the
  library — always create a duplicate (current file-import behavior) or
  offer replace?

## Acceptance

CORS spike documented with a working recipe; publish-draft flow succeeds
against a test Central project incl. attachments; import flow lists
projects and forms from a mocked Central, pulls a form with two
attachments and opens it in the editor with both attachments present and
previewable; two server records can be registered and every picker stays
scoped to the chosen server; disconnecting wipes the token; a workspace
export made while connected contains no credential material and no server
records (test asserts this).
