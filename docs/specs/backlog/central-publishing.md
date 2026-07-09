# Optional ODK Central publishing — shaping (backlog)

## Problem

The export → download → upload-to-Central loop works but is manual. Power
users want "publish draft to my Central project" from the builder. This is
the only backlog feature that talks to a network, so it must not compromise
the product's core guarantee: **no backend, nothing leaves the device by
default**.

## Scope

- Opt-in per-browser connection to an ODK Central server: base URL +
  credentials, stored locally only.
- **Publish as draft**: create/update a form draft on Central
  (`POST /v1/projects/:id/forms?ignoreWarnings=true&publish=false` with the
  XForm XML, then `POST .../draft/attachments/:name` for each attachment),
  surfacing Central's validation response.
- Project/form pickers backed by `GET /v1/projects`, plus "open draft in
  Central" deep link. Publishing the draft to live stays in Central's UI
  (deliberate: review happens there).

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
  the token, not the password, is kept in memory; "remember me" persists
  the token in IndexedDB with a visible "connected as…" indicator and a
  disconnect button. Never in exports/workspace archives.
- Every network call is user-initiated (a Publish button) — no background
  sync, no telemetry, and the feature is invisible until the user adds a
  server in settings.

## Approach

- `src/core/central/client.ts`: thin typed fetch wrapper (sessions,
  projects, form create/update, attachment upload, version conflict
  handling — Central rejects re-publishing an existing version string;
  offer "bump version" using the existing settings.version generator).
- `PublishDialog.vue`: connection status → project picker → new form vs
  update existing (match by formId) → progress per attachment → result with
  Central's warnings passed through verbatim.
- E2e: against a mocked Central (Playwright route interception) — real
  Central integration testing stays manual with a checklist.

## Open questions

- Minimum supported Central version (attachment/draft API differences)?
- Should we also support the OpenRosa `/submission`-style form list for
  non-Central servers? Proposal: no — Central only, keep scope tight.

## Acceptance

CORS spike documented with a working recipe; publish-draft flow succeeds
against a test Central project incl. attachments; disconnecting wipes the
token; a workspace export made while connected contains no credential
material (test asserts this).
