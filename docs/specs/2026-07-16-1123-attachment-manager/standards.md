# Standards & process — attachment manager

Repo hard invariants (CLAUDE.md) that constrain this feature, and the
process skills used to deliver it.

## Repository hard invariants

- **`src/core/` is pure TS.** The new `src/core/model/rename-attachment.ts`
  (rename + reference rewrite + reference-scan + the "keep both" free-slot
  naming) must import nothing from Vue/Pinia/Dexie/vue-i18n and must never
  localize. The bug-fix's `deepToRaw` hardening in `snapshotDoc`, by
  contrast, imports Vue's `toRaw` and so stays in `src/stores/form.ts` (a
  Vue-aware layer), never in `src/core/`.
- **Persistence goes through the backend seam**
  (`src/persistence/backend.ts`). The new `renameAttachment(id, filename)`
  method is added to the `PersistenceBackend` interface and implemented
  identically in the Dexie backend (`db.attachments.update`) and the memory
  backend (in-place `Map` mutation); `attachments-repo.ts` re-exports it
  with the same signature on both. Every new/changed repo behaviour
  (`renameAttachment`, the wider `pruneOrphans` protected-set call from the
  dialog-open sweep) is specced via `describe.each(backendCases)` per
  `tests/helpers/backends.ts`.
- **No Dexie schema bump.** `filename` is not an indexed field
  (`db.ts:146`, `'id, formRecordId'`), so renaming it in place needs no
  `db.version()` step and no workspace-backup format change. If a future
  change did add an indexed/typed field to `AttachmentRecord`, the
  workspace-backup invariant would apply (bump `WORKSPACE_FORMAT_VERSION`
  in lockstep) — out of scope here because nothing this feature adds is
  indexed or new-shaped at the persistence layer.
- **UI strings only via vue-i18n.** All new copy (rename modal, per-row
  "stored as" notice, conflict dialog, reference-count badge) is added to
  the typed catalog (`dialogs.json`, namespace `dialogs.attachments.*`);
  `eslint`'s `no-missing-keys` rule is an error. Existing rendered English
  (the dialog header/hint/empty-state, the delete/view button labels,
  every string `tests/e2e/dataset-tooling.spec.ts` and
  `tests/e2e/workspace-archive.spec.ts` assert) stays byte-stable —
  the list-source rewrite (Task 2) changes *how* the row model is built,
  not what it renders for an unchanged attachment.
- **Preserve `data-testid`s.** `attachments-dialog`, `attachment-upload`,
  `attachment-file-input` and `attachment-view` are asserted by
  `dataset-tooling.spec.ts` and `workspace-archive.spec.ts` and must not
  change shape or meaning. Every new interactive element (rename button and
  modal, per-row replace control, conflict dialog, reference-count badge)
  gets its own new testid.
- **No undefined CSS custom properties.** Any new dialog/modal CSS reuses
  existing `--odk-*`/`--builder-*` tokens already used elsewhere in
  `AttachmentsDialog.vue`'s `<style scoped>` block; `pnpm lint` runs
  stylelint's `value-no-unknown-custom-properties` check over
  `src/**/*.{css,vue}` and fails the build on a bare undefined `var()`.
- **Undo correctness.** Every mutating operation (rename, per-row replace,
  conflict-resolved upload) stays a single `form.mutate()` call with a
  human-readable label; superseded blob records stay restorable until
  pruned. The dialog-open orphan sweep must not delete a record still
  reachable from `undoStack`/`redoStack`, or undo/redo could restore a
  document reference whose blob no longer exists.
- **Serializer/goldens untouched.** Filenames flow through the existing
  `itemsetFile`/`MediaRefs`/attachments paths; nothing in this feature
  touches `src/core/xform/serializer.ts` or the pyxform-pinned golden
  fixtures, so `tests/golden/` needs no changes.
- **Conventional commits, no `Co-Authored-By` trailer** (global user
  instruction, overrides any default git-commit guidance). The must-fix bug
  fix lands as its own commit before the feature commits, per the resolved
  ruling.

## Coverage floors (must not regress)

`pnpm test:coverage` enforces core 86/78/88, stores 80/85, persistence
90/92. The new core helper, the `snapshotDoc`/`attachFile` hardening in the
form store, and the new backend method must ship with tests that keep
these floors green (see `plan.md`'s per-task test lists).

## Process skills used

- **Dynamic Workflows with parallel Sonnet implementors** for independent
  tasks (e.g. the core helper + its unit tests can proceed in parallel with
  the persistence backend method + its both-backend specs); the bug fix
  (Task 1) is a hard prerequisite for every dialog-UI task and must land,
  reviewed and green, before they start.
- **`/agent-browser`** for the manual verification pass — rename (valid
  name, collision, extension-locked), per-row replace with a differently
  named file (stored-as notice), the conflict dialog (Replace / Keep both /
  Skip / apply-to-all), and the reference-count badge — screenshots and
  notes logged to `docs/verification/2026-07-16-attachment-manager/`.
- **`/interface-craft`** for a lighter design pass on the two new overlays
  (rename modal, conflict dialog), checked for consistency with the
  dialog's existing look and the app's other small-modal idioms.
- **`/code-review`** (five lenses, no plan mode) on the wave's diff, with
  findings fixed immediately before the feature commit.
- Documentation sweep (README Features, `docs/product/roadmap.md`,
  `CLAUDE.md`'s composables/attachments rows) in the same change, per the
  established delivery process.
