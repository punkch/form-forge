# F0 — Preview Stale-Form Bug Fix — Plan

## Bug

Opening a new or different form shows the **previously opened form** in the
live preview panel until the new form produces XML of its own (which a blank
form never does).

## Root cause (verified)

- `src/stores/preview.ts` is an **app-global Pinia store**; its state
  (`xml`, `stale`, `status`, `engineError`, `blockReason`) outlives any one
  form.
- `regenerate()` early-returns **without clearing `xml`** when
  `form.errorCount > 0`, when the empty-container `blockReason` is set, or on
  serializer errors. A brand-new blank form never reaches the
  `xml.value = result.xml` line, so the previous form's XML stays behind.
- `form.load()` / `form.close()` (`src/stores/form.ts`) never touch preview
  state.
- `PreviewPanel.vue` gates `PreviewHost` on `preview.xml !== null` and passes
  the **new** `form.recordId` together with the **old** `xml`.
- `PreviewHost.vue` keeps a module-level `lastGoodXml` which can revert the
  pane to a *different form's* XML after an engine error.
- Additionally, the preview store's watchers were registered from
  `PreviewPanel`'s `onMounted` without a detached scope — Vue binds them to
  the component's effect scope, so they were **disposed when the panel
  unmounted** (navigating back to the library) while the `watching` flag
  stayed `true`, leaving the preview dead for the next form.

## Fix design

1. **`src/stores/preview.ts` — add `reset()`**: clear the debounce timer;
   `xml = null`; `stale = false`; `status = 'idle'`; `engineError = null`;
   `engineErrorRecovered = false`; `blockReason = null`. Export it from the
   store return.
2. **`start()` — register `watch(() => form.recordId, ...)` calling `reset()`
   on any change BEFORE the existing deep `form.doc` watcher** (registration
   order = same-flush order), so a form switch clears stale XML before
   regeneration for the new document runs. Both watchers run inside a
   **detached `effectScope(true)`** so they survive `PreviewPanel` unmounts.
   Behavior within a single form (last-good-XML + stale flag) is unchanged.
3. **`src/components/preview/PreviewHost.vue`** — watch the `formRecordId`
   prop: on change clear `lastGoodXml` and remount from the current
   `props.formXml` (null-safe; tears down the child app if there is no XML).
4. **`src/components/preview/PreviewPanel.vue`** — suppress the `blockReason`
   warning banner when `!preview.hasPreview`, so a blank form shows only the
   friendly empty state ("The preview appears once the form has questions.").
   The empty state gets `data-testid="preview-empty"` for e2e.
5. **Blank-root gating** — a document with zero children passes validation
   (`structure.empty-container` only fires on empty *group/repeat nodes*, not
   the root) and serializes cleanly, so previously a blank form would mount
   the engine on an empty body. `regenerate()` now computes
   `blockReason = blankRootBlock() ?? emptyContainerBlock()`, where
   `blankRootBlock()` pauses regeneration while `doc.children.length === 0`.
   A brand-new blank form therefore keeps `xml === null` and shows the empty
   state; emptying an existing form mid-session keeps the last good XML under
   the paused banner (consistent with empty-container behavior).

## Tests

Unit (`tests/unit/preview-form-switch.spec.ts`, Pinia + fake-indexeddb,
patterned after `src/stores/preview.spec.ts` / `tests/unit/preview-gating.spec.ts`):

- (a) form A ready, then `form.close()` → `xml` null, status `idle`, stale
  false; a pending debounce from a pre-close edit never resurrects the XML.
- (b) A ready → `load()` blank form B → `xml` is null (never A's), blank-root
  blockReason set.
- (c) an engine error reported on A is cleared after switching to B.
- (d) editing B into a valid non-empty form regenerates **B's** XML (title
  `Beta`, never containing `Alpha`).
- (e) a brand-new blank form starts with no preview and no error state.

E2E (`tests/e2e/preview.spec.ts`): create form A, add a text question
labelled "Alpha question", assert the preview renders it; navigate back to
the library **in-app** (no reload); create blank form B; assert the preview
shows the empty state, no `preview-host`, no paused banner, and never
contains "Alpha question"; add "Beta question" to B and assert it renders
while "Alpha question" still never appears.

## Verification

- `pnpm vitest run` (full suite) and `pnpm typecheck` — green.
- e2e suite run by the orchestrator.
- Manual: see `user-guide.md`.
