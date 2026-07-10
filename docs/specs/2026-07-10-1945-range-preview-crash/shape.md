# Range preview crash — Shaping Notes

## Scope

Fix a preview crash the user hit loading an all-widgets form: a `range`
question without `start`/`end`/`step` parameters serializes to XML that
`@getodk/web-forms` refuses to load, throwing "Expected attribute start is
not defined". The engine renders this through its own
`.form-load-failure-dialog` (a `closable: false` PrimeVue dialog) rather
than throwing to Vue, so the builder's existing engine-error recovery never
fires and the dialog can't be dismissed except by closing the preview.

Three parts:

1. **Serializer** always emits `start`/`end`/`step` on a range, falling back
   to the registry parameter defaults when a bound is unset, so a range can
   never produce load-fatal XML. (web-forms requires all three via
   `parseNumericStringAttribute`; the factory only seeds the required
   start/end, so even a fresh palette range — no `step` — was affected.)
2. **Validation** warns (`parameters.missing-required`) when a question is
   missing a registry-required parameter, so the author knows to set real
   bounds instead of silently shipping defaults. Generalized over the
   registry's `required` parameter flag (range start/end today).
3. **Preview** detects web-forms' `.form-load-failure-dialog` via a bounded
   MutationObserver and routes it through the existing `reportError` path —
   tearing the failed child app down and showing the builder's own
   recoverable `PreviewErrorState` (Show details / Retry / Open full-page)
   and reverting to the last good form.

## Decisions

- User approved the **full fix** (serializer + validation + preview
  dismissability) 2026-07-10.
- Serializer defaults over hard-failing export: a form with unset bounds
  stays loadable/exportable; the warning is the honest signal. Golden
  parity is unaffected (existing range goldens all specify bounds).
- Non-numeric bounds (e.g. `start="abc"`) are an engine-level rejection, not
  a model warning — correctly surfaced through the preview error path, which
  the observer now makes recoverable. `hasText` presence is all the model
  validates.
- The failure-dialog detection is coupled to web-forms' current DOM
  (`.form-load-failure-dialog` / `.message`); documented as best-effort
  defense-in-depth. The serializer fix means the common range case never
  reaches it.

## Context

- **Reported:** mid-session, loading the all-widgets form; error dialog with
  no dismiss affordance (screenshot in the conversation).
- **Root cause files:** `src/core/xform/serializer.ts` (range body attrs),
  `src/components/preview/PreviewHost.vue` (engine-error recovery only on
  throw), no parameter validation existed.
- **Verification:** `docs/verification/2026-07-10-range-preview-crash/`.

## Skills & Conventions Applied

CLAUDE.md invariants: core purity (serializer + validator stay pure TS),
serializer pinned to pyxform 4.5.0 (goldens unmoved), i18n-only UI strings
(`preview.panel.loadFailed`), preserved data-testids. Delivery process:
spec folder → implement → verify (suite + agent-browser) → /code-review →
conventional commits.
