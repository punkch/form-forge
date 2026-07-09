# References — Preview Stale-Form Fix

## Files changed

- `src/stores/preview.ts` — `reset()`, `blankRootBlock()`, `recordId`
  watcher registered first inside a detached `effectScope`, `reset` exported.
- `src/components/preview/PreviewHost.vue` — `formRecordId` watcher clears
  `lastGoodXml` and remounts (or tears down) the engine child app.
- `src/components/preview/PreviewPanel.vue` — paused banner suppressed when
  `!preview.hasPreview`; empty state gets `data-testid="preview-empty"`.
- `tests/unit/preview-form-switch.spec.ts` — new regression suite (unit).
- `tests/e2e/preview.spec.ts` — new e2e regression test (form switch).

## Files consulted (unchanged)

- `src/stores/form.ts` — `load()`/`close()` lifecycle, `recordId` semantics.
- `src/core/validate/structure.ts` — `structure.empty-container` only fires
  on empty group/repeat nodes, never on a blank root document.
- `src/core/validate/index.ts`, `src/core/xform/serializer.ts` — confirmed a
  blank document validates and serializes without errors.
- `src/views/FormEditorView.vue` — editor never calls `form.close()` between
  forms; `loadForm()` swaps `recordId`/`doc` in place.
- `src/views/FullPreviewView.vue` — independent serialization path.
- `src/stores/preview.spec.ts`, `tests/unit/preview-gating.spec.ts` — test
  patterns followed (Pinia setup, real timers, `settle()` helper).
- `tests/e2e/helpers.ts` — `createForm` / `addQuestion` helpers (the e2e
  test inlines form creation after `back-to-library` to avoid the helper's
  `page.goto()` reload, which would reset the app-global stores under test).
