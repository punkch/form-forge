# F0 — Preview Stale-Form Bug Fix — Shaping Notes

## Scope

Bug fix only: the live preview panel must never show a previously opened
form's rendered XML when a new/different form is opened. No feature work; no
change to within-form preview behavior (debounce, last-good-XML under a
stale banner, empty-container pausing).

## Bug

Open form A (preview renders) → back to library → open/create form B →
the preview still shows form A. For a blank B it stays that way forever;
for a non-blank B it shows A until B's first successful regeneration.

## Root cause

1. `usePreviewStore` is app-global; nothing cleared `xml`/`engineError`/
   `blockReason` on form switch, and `regenerate()`'s gating paths
   (validation errors, empty-container block, serializer errors — and for a
   blank form, nothing at all clearing prior state) all early-return with the
   old `xml` intact.
2. `PreviewHost` cached `lastGoodXml` across prop changes, so an engine error
   on form B could *revert the pane to form A*.
3. Latent: the store's watchers were created inside `PreviewPanel`'s
   `onMounted` (active component effect scope) — disposed on unmount while
   the `watching` guard stayed set, so live updates died after returning from
   the library.

## Decisions

- **Reset on `recordId` change, not in `form.load()/close()`** — keeps the
  form store ignorant of the preview store (no new coupling); the preview
  store already owns its lifecycle via `start()`.
- **Watcher registration order carries the invariant**: the `recordId`
  watcher is registered before the deep `doc` watcher, so within one flush a
  switch resets before the new doc regenerates.
- **Detached `effectScope(true)`** for the store watchers so they are truly
  app-global (survive panel unmounts), matching the store's lifetime.
- **Blank-root forms pause regeneration** via a `blankRootBlock()` reason
  (the empty-container mechanism generalized to the document root), instead
  of mounting the engine on an empty-body XForm. Verified: a blank root
  produces **neither** a `structure.empty-container` issue (that validator
  only inspects container *nodes*) **nor** `errorCount > 0` — it serialized
  cleanly, which is why the old empty state never appeared.
- **Banner suppression, not removal**: the paused banner still shows when a
  *mounted* preview is paused (`hasPreview`); a blank form shows only the
  designed empty state.
- `PreviewHost` drops `lastGoodXml` on `formRecordId` change as
  defense-in-depth (the store reset already unmounts the host in the panel,
  but the host is also mounted by `FullPreviewView` and must stay correct
  for any future host that switches forms on a live instance).

## Out of scope

- `FullPreviewView` — self-contained (serializes from the repo per visit),
  not affected.
- Persisting preview panel visibility, preview performance work.
