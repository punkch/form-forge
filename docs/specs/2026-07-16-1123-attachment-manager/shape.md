# Attachment manager: rename, per-row replace, conflict handling — Shaping Notes

> Promoted 2026-07-16 from `docs/specs/backlog/attachment-manager.md`. Open
> questions resolved with the user 2026-07-16; current-implementation claims
> verified against code 2026-07-16 (see `references.md` for the corrected
> file:line anchors).

## Scope

Turn the Form attachments dialog from upload/delete-only into a real
attachment manager, on top of a fixed, non-corrupting upload path:

- **Fix first, as its own commit:** the same-filename re-upload path poisons
  the reactive document (a nested Vue reactive Proxy survives `toRaw()` and
  makes `structuredClone()` throw `DataCloneError` inside `snapshotDoc()`),
  breaking every subsequent autosave and `mutate()` for the rest of the
  session; and the dialog lists duplicate rows for a replaced filename
  because it renders raw storage records instead of what the form
  references.
- **Rename** — a per-row action opening a small modal, applying as one undo
  step: the record's filename plus every document reference
  (`itemsetFile`, question-label and choice-label `MediaRefs`, and the
  implicit `csv-external` `${name}.csv` default) rewritten together.
- **Per-row replace** — an upload control on each row that reuses
  `attachFile(file, row.filename)` (the existing `TypeConfigSection`
  pattern), keeping the row's filename regardless of the picked file's own
  name, with the existing "stored as" notice when they differ.
- **Upload-conflict handling** — a general ("Upload files") upload whose
  `file.name` matches an existing reference stops and asks: **Replace** /
  **Keep both** (auto-suffixed, collision-free) / **Skip**, with an "apply
  to all remaining" path for multi-file batches.
- **Missing required attachments** — the dialog detects every filename the
  form design references (explicit `itemsetFile`, the implicit
  `csv-external` `${name}.csv` default, question-label and choice-label
  media) that has no uploaded attachment, and lists it as a **Missing** row
  with an Upload action that stores the picked file under the referenced
  name.
- Per-row reference counts (cheap, derived from the same core scan helper
  that drives rename and the missing detection), an on-open orphan sweep
  that protects undo/redo
  history in addition to the current document, i18n, new testids,
  component + e2e coverage, and an `/agent-browser` + `/interface-craft`
  verification pass logged to `docs/verification/`.

**Out of scope:** attachment editing/preview beyond the existing dataset
preview, drag-and-drop upload into the dialog (note as a follow-up),
Central media-attachment publishing (unchanged, handled by the publish
sequence), and the toolbar placement of the Attachments entry itself (that
is `editor-toolbar-declutter`, see the coordination note below).

## Decisions

All five originally-proposed decisions are **adopted**, stated as settled:

1. The dialog lists the **form's refs** (`form.doc.attachments`), never raw
   `attachmentsRepo` records — storage bookkeeping (undo-superseded blobs,
   orphans) becomes invisible in the list by construction. **Verified
   simplification:** `AttachmentRef` (`src/core/model/types.ts:157-165`)
   already carries `mediatype`/`size`/`role` alongside `id`/`filename`, so
   the row model needs **no join back to `AttachmentRecord`** at all — the
   backlog's "joined with repo records" phrasing described the outcome
   (no duplicates/orphans visible), not a required data join. The repo is
   still called for delete, rename-persist, per-row replace and the
   orphan sweep — just not for populating rows.
2. Rename **keeps the file extension** — the modal edits only the filename
   stem; the extension renders as a fixed suffix the user cannot type over,
   so an extension change (and the role change it could cause) is
   structurally impossible rather than merely validated against.
3. "Keep both" always suffixes to the **first free numeric slot**:
   `name-2.ext`, `name-3.ext`, … — checked against both existing
   `doc.attachments` filenames and any name already allocated earlier in
   the same upload batch, so attachment filenames stay unique within a
   form at all times.
4. Per-row replace **keeps the row's filename** regardless of the picked
   file's own name (reference stability is the entire point), reusing the
   existing "stored as X (was Y)" notice pattern from `TypeConfigSection`.
5. Rename, replace and conflict-resolved upload are each **one undo step**
   with a human-readable label.

Resolved open questions:

- **Rename UX is a small modal**, not inline-in-row editing — room for a
  validation message and a "this will update N references" summary line.
- **The conflict dialog offers "Apply to all remaining"** for multi-file
  uploads: three actions (Replace / Keep both / Skip) plus a checkbox that,
  when ticked, applies the chosen action to every remaining queued conflict
  without prompting again (Replace all / Keep both for all / Skip all).
- **Rows show which questions reference the file** (a count, cheap to
  derive from the same core scan helper the rename modal uses) — kept to a
  count rather than clickable navigation to stay inside the M-sized effort.
- **Orphan sweep also runs on dialog open**, in addition to the existing
  `close()` sweep: records referenced by the current document **or by any
  undo/redo history entry** are protected (a wider protected set than
  `close()`'s, which discards undo history anyway and so only needs to
  protect the current document). The two sweeps stay two separate
  call sites with two different protected-id computations — `close()`'s
  logic is unchanged.
- **The implicit `csv-external` reference** (a question with no explicit
  `itemsetFile` whose `effectiveItemsetFile()` defaults to `${name}.csv`)
  is **auto-materialized**: renaming a file such a question implicitly
  references sets an explicit `itemsetFile` on that question to the new
  name, in the same undo step. This was raised in the backlog as
  "materialize or warn" — auto-materializing is the simpler, always-correct
  choice (no extra dialog copy, no silently-broken reference to explain),
  consistent with the feature's premise that a rename never leaves a
  dangling reference.
- **Missing required attachments are listed** (added by the user
  2026-07-16, after promotion): a filename the form references with no
  matching upload renders as a Missing row — filename, "Missing" status in
  place of type/size, the reference-count badge, and an Upload action
  storing the picked file under the referenced name (the per-row-replace
  mechanism pointed at a name that doesn't exist yet). "Referenced" is
  computed by the same core traversal the refs/datasets validators use, so
  the dialog's Missing rows always agree with the problems panel; the
  dialog adds the fix affordance at the point of care.

## Context

- **Provenance:** promoted from `docs/specs/backlog/attachment-manager.md`,
  itself written after a live agent-browser session on 2026-07-16 found the
  must-fix bug and the duplicate-row symptom while reviewing the existing
  upload/delete-only dialog.
- **Current-implementation claims were verified against code on
  2026-07-16** and several details in the backlog doc were corrected in the
  process (see `references.md` for the full list): attachment records key
  on `formRecordId`, not `formId`; `filename` is not a Dexie index (no
  schema bump needed for anything this feature does); the superseded-record
  pruning the backlog attributes loosely to "the dialog" actually lives in
  the form store's `close()`; and the regression-test anchor is
  `src/stores/form.spec.ts`, not a `tests/unit/form.spec.ts` that does not
  exist.
- **Coordination with `editor-toolbar-declutter`:** that stream retires the
  ⋮ "More form tools" menu the two e2e specs (`dataset-tooling.spec.ts`,
  `workspace-archive.spec.ts`) currently use to open the Attachments dialog
  (`editor-more` → menu item "Attachments") in favour of a labeled "Form"
  menu. Toolbar-declutter integrates first; this stream rebases onto it and
  reconciles the navigation steps in those two e2e files (the dialog's own
  behaviour and testids are unaffected).
- **Product alignment:** hardens an existing Phase 2/3 authoring surface
  (`docs/product/roadmap.md`); no protocol, schema or serializer change.

## Skills & Conventions Applied

- Repo conventions (CLAUDE.md hard invariants): `src/core/` purity for the
  new rename/scan helper, the persistence backend seam (repo signatures
  identical across Dexie + memory, specs run on both via
  `tests/helpers/backends.ts`), typed i18n catalog with byte-stable
  rendered English elsewhere, `data-testid` preservation, the stylelint
  undefined-CSS-custom-property gate, and conventional commits with **no**
  `Co-Authored-By` trailer (global user instruction).
- **agent-browser** — the walkthrough that discovered the bug and the
  duplicate-row symptom; the same skill drives post-implementation
  verification of rename, per-row replace and the conflict dialog, logged
  to `docs/verification/`.
- **interface-craft** — a lighter-touch critique pass on the two new
  overlays (rename modal, conflict dialog) for consistency with the
  dialog's existing look and the app's other small-modal patterns
  (e.g. rename-style flows elsewhere use PrimeVue `Dialog` at a narrow
  width).
- Delivery process: dynamic Workflow with parallel agents where tasks are
  independent, `/code-review` (five lenses, no plan mode) with findings
  fixed immediately, then the documentation sweep.
