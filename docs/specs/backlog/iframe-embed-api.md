# Iframe embed mode + postMessage API — shaping (scheduled)

## Problem

Host applications (portals, case-management systems) want to embed the
builder and own form storage themselves: the host loads a form into the
builder, the user edits, and the host retrieves the full configuration —
without the builder writing to the user's browser library or exposing
download buttons the host doesn't want.

## Scope

- **Embed mode**: the same app bundle runs inside a host page's iframe,
  activated by `?embed=1` (+ optional `&origin=` pin). No separate build.
- **postMessage protocol v1**: handshake (`ready` → `init` with config),
  `load-form` (full payload: form definition + attachments), `save-form`
  (responds with the full configuration including attachments),
  `set-config`, `state-changed` / `error` events.
- **Host-controlled export**: `init.config.exports` toggles XForm / XLSForm /
  ZIP visibility (all off hides the Export menu entirely).
- **Persistence choice**: `memory` (default — nothing touches IndexedDB;
  host owns durability) or `local` (normal Dexie autosave).

## Approach

Envelope `{ channel: 'odk-builder', v: 1, type, requestId? }` on every
message. Load payload formats: `archive` (ArrayBuffer single-form
`.odkbuilder.zip` — canonical, self-versioned via `manifest.formatVersion` +
`FormDocument.schemaVersion`), `object` (`{ doc, attachments:
[{filename, mediatype, data: ArrayBuffer}] }`), `new` (`{ title? }`).
Save responds with the chosen format plus
`meta: { formId, title, version, errorCount, warningCount }`.

- `src/embed/protocol.ts` (pure types/guards), `src/embed/bridge.ts`
  (listener, origin pinning, dispatch), `src/stores/embed.ts`.
- Persistence seam: `src/persistence/backend.ts` + in-memory backend;
  repos keep identical signatures so preview/export work unchanged.
- Security: only `event.source === window.parent`; non-matching origins
  ignored silently; pinned targetOrigin after init; ArrayBuffers
  transferred, not copied.
- `public/embed-demo.html` vanilla-JS host harness; e2e via Playwright
  frameLocator.

## Decisions

- Same bundle, no separate entry point (user decision 2026-07-09).
- Single-form archive is the canonical interchange format (shared code
  path with workspace export; hosts store one opaque blob).
- Library view unreachable in embed mode; `/` shows "Waiting for host…"
  until the first `load-form`.

## Acceptance

Demo host page loads a form (object + archive), edits produce
`state-changed`, save returns a payload that round-trips back in;
`exports: {}` hides the Export menu; unknown origins never get a reply.
