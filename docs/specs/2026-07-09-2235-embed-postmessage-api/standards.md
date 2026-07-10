# Skills & Conventions — iframe embed mode + postMessage API

## Code standards (project-wide, applied here)

- pnpm; ESLint neostandard (flat config); TypeScript strict; Vue 3
  Composition API with `<script setup lang="ts">`; Pinia setup stores.
- `src/embed/protocol.ts` follows the `src/core/` spirit: pure types +
  guards, no Vue/Pinia/DOM imports (transport lives in `bridge.ts`).
- All new UI strings go through `t()` with keys in the namespace JSON
  (`shell.embed.*` in `src/i18n/locales/en/shell.json`); ESLint
  `@intlify/vue-i18n/no-missing-keys` enforces catalog integrity.
- Existing `data-testid`s preserved (`export-button`, `back-to-library`);
  new ones added (`embed-waiting`).

## Protocol conventions

- Envelope `{ channel: 'form-forge', v: 1, type, requestId? }` on every
  message; unknown channels ignored, unknown *types* on our channel ignored
  too (loop guard — the builder must never treat its own outbound types as
  requests).
- Requests answered by `<type>-result` echoing `requestId`; failures by
  `error { requestId?, code, message }` with one of the five v1 codes.
- Untrusted input is coerced/validated at the boundary
  (`coerceEmbedConfig`, `parseLoadFormPayload`, `parseSaveFormat`) — never
  cast host JSON into internal types without a shape gate; documents pass
  `migrateDoc` like every externally-sourced document.

## Security conventions

- `event.source === window.parent` required; pinned-origin mismatches are
  dropped **silently** (no probing feedback).
- `targetOrigin` is never `'*'` after init; pre-init messages (`ready`,
  `not-initialized` errors) carry no form data.
- `ArrayBuffer`s go through the transfer list.

## Persistence-seam conventions

- Repos keep every exported function signature; storage access goes through
  `getPersistenceBackend()` only. New repo code must not import `db` from
  `./db` directly (backend.ts is the single Dexie touchpoint for repo
  operations).
- Backends must match Dexie's observable semantics: clone-on-write/read
  (no aliasing), `add` rejects duplicate ids, `importForm` is atomic,
  `listForms` orders by `updatedAt` descending, `listSnapshots` ascending
  by `createdAt`.
- Behavioral parity is enforced by contract suites: persistence specs run
  `describe.each(backendCases)` from `tests/helpers/backends.ts`.

## Testing conventions

- Vitest: protocol guards in `tests/unit` (node env), bridge in
  `tests/component` (happy-dom — real `MessageEvent` dispatch, spied
  `window.postMessage`).
- Playwright: embed e2e drives the real demo host page with
  `frameLocator('#builder-frame')`; the host page's message log is the
  assertion surface for the wire traffic. Viewport widened so the iframe
  itself is ≥1280 px (wide editor layout).
