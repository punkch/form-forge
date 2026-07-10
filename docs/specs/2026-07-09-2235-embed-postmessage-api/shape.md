# Iframe embed mode + postMessage host API — Shaping Notes

> **Status (2026-07-10): implemented.** The wire contract and design live in
> `plan.md`; host integration docs with message examples in `user-guide.md`.
> Both cross-workstream dependencies below landed first (workspace archive +
> vue-i18n, Wave 1), so the archive payload and `t()` usage shipped together.

## Scope

The full builder app (same bundle — **user decision: no separate Vite entry
point**) runs inside a host page's iframe in "embed mode". The host controls
the builder over `window.postMessage`:

- **load-form**: host pushes a complete form (definition + attachments) into
  the builder.
- **save-form**: host requests the full current form configuration
  (definition + attachments) back.
- **export gating**: the host's init config hides/limits the ExportMenu
  (XForm XML / XLSForm / ZIP).
- Handshake (`ready` → `init`), request/response correlation via `requestId`,
  strict origin handling.

## Decisions

- **Activation**: `?embed=1` in the URL *search* string (before the `#` used
  by hash routing) **and** `window.parent !== window`. Optional
  `&origin=<url-encoded host origin>` locks the handshake to one origin
  (recommended for production hosts; documented in the demo page).
- **Payload format**: the canonical interchange payload is the **single-form
  archive** (`.formforge.zip`: `manifest.json` + `form.json` + attachments)
  built by the parallel workspace-export-import workstream, sent as an
  `ArrayBuffer` (structured clone, transferable). A plain
  `{ format: 'object', doc, attachments[] }` payload is also *accepted* on
  load (and available on save via `options.format`) as the low-friction path
  for hosts, the demo page, and tests. One internal normalization point:
  both formats converge to `(FormDocument, attachment files)` immediately.
  A `{ format: 'new', title? }` load creates a blank form so hosts don't
  need to know the FormDocument schema.
- **Persistence**: init config `persistence: 'memory' | 'local'`, default
  `'memory'`. Memory mode swaps the Dexie-backed repos for an in-memory
  backend behind the same repo function signatures — nothing written to the
  user's IndexedDB; the host owns durability (it listens to `state-changed`
  and calls `save-form`). `'local'` keeps the normal IndexedDB autosave.
- **Routing in embed mode**: library view unreachable; `/` redirects to a
  minimal "Waiting for host…" view until the first successful `load-form`,
  which navigates straight into the editor. Library nav affordances hidden.
- **Dirty-close**: builder keeps its own `beforeunload` flush; the host is
  informed via debounced `state-changed { dirty, errorCount }` events and is
  responsible for its own close-guard UX.
- **Security**: origin pinned at first valid `init` (or forced by the
  `origin` param); `event.source` must be `window.parent`; all outbound
  posts use the pinned `targetOrigin`; messages from other origins are
  ignored silently; `ready` (posted to `'*'` only when no `origin` param is
  given) carries no form data.
- **Envelope**: every message carries `channel: 'form-forge'` (namespace
  marker so Vite HMR/devtools traffic is ignored) and `v: 1`.

## Context

- **Visuals:** None.
- **References:** `src/core/export/zip.ts` (jszip pattern),
  `src/components/importexport/ImportDialog.vue` (import → createForm →
  navigate flow), `src/persistence/forms-repo.ts` (`duplicateForm`
  attachment-id remap), backlog doc
  `docs/specs/backlog/workspace-export-import.md` (archive layout).
- **Product alignment:** client-side-only stays true — embed mode adds no
  backend; the host page is just another client-side consumer.
- **Cross-workstream dependencies:**
  - Single-form archive build/read (`src/core/workspace/archive.ts`) comes
    from the workspace-export-import workstream. Steps ordered so protocol,
    handshake, routing, and export gating land independently; archive
    payload wiring lands after (or the object format ships first).
  - vue-i18n arrives in a parallel workstream; new components use `t()` from
    day one (coordinate landing order; if embed lands first, the i18n
    workstream's plugin scaffold must be pulled forward).

## Skills & Conventions Applied

- Shaped via delegated planning (team-lead brief 2026-07-09); interactive
  shaping questions answered by the brief itself and the backlog docs.
- TS strict, `src/core/` purity rule, Vitest + Playwright conventions — see
  standards.md.
