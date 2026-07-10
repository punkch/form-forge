# Plan — Range preview crash fix (2026-07-10)

## Context

Loading an all-widgets form crashed the live preview with an undismissable
`@getodk/web-forms` dialog ("Expected attribute start is not defined"). Root
cause: a `range` question without `start`/`end`/`step` serializes to XML the
engine rejects, and the engine renders that failure through its own
`.form-load-failure-dialog` (closable: false) instead of throwing, so the
builder's existing engine-error recovery never fires. User approved the full
fix. See `shape.md` for scope/decisions.

## Changes (all delivered)

### 1. Serializer defaults — `src/core/xform/serializer.ts`
Range body element emits `start`/`end`/`step`, each falling back to the
registry `defaultValue` (`def.parameters`) when the node's parameter is
unset. All three registry defaults exist (1/10/1), so a range always emits
complete, loadable bounds. Tests: `serializer.spec.ts` (defaults filled;
explicit params preserved). Goldens unaffected.

### 2. Parameter validation — `src/core/validate/parameters.ts` (new)
`validateParameters` warns `parameters.missing-required` for any question
missing a registry-`required` parameter (range start/end today), wired into
`validateDocument` in `src/core/validate/index.ts`. Warning, non-gating.
Tests: `parameters.spec.ts`.

### 3. Preview recovery — `src/components/preview/PreviewHost.vue`
After a successful mount, a bounded (4s) MutationObserver watches for
web-forms' `.form-load-failure-dialog`; on detection it extracts the
`.message` text and calls the existing `reportError`, which tears the child
app down (removing the dialog) and emits `engine-error` → the builder's
recoverable `PreviewErrorState` + revert-to-last-good. New i18n key
`preview.panel.loadFailed`. Observer disconnected on teardown/timeout.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (736 pass), goldens unmoved.
- agent-browser: a fresh range renders as a 1–10 slider in the preview (was
  a crash); a range with `start="abc"` shows the builder's dismissable
  error state (Show details reveals the engine message, Retry available)
  instead of the stuck web-forms dialog.
  Evidence: `docs/verification/2026-07-10-range-preview-crash/`.

## Follow-up

`upstream-issue-web-forms.md` in the sibling
`2026-07-10-1810-ui-critique-fixes` spec still stands (the number-input
"0"/required contradiction is a separate web-forms bug).
