# Attachment manager: rename, per-row replace, conflict handling — Implementation Plan

> Promoted 2026-07-16 from `docs/specs/backlog/attachment-manager.md`. This is
> the full plan. Shaping decisions live in `shape.md`; current-code anchors
> (corrected against a 2026-07-16 read) in `references.md`; repo invariants in
> `standards.md`; end-user docs + manual test scenarios in `user-guide.md`.

## Why

The Form attachments dialog (Form tools → Attachments) is upload/delete-only:
there is no rename (short of delete + re-upload, which breaks every question
that referenced the old name), no per-row replace, and uploading a file whose
name matches an existing attachment is handled silently — the reference is
swapped with no confirmation and no "keep both" option. Worse, a live
agent-browser session on 2026-07-16 found that the same-name upload path
**breaks saving**: re-uploading a file under an existing filename while other
attachments exist leaves a nested Vue reactive Proxy inside the raw document,
which `structuredClone()` cannot clone — every autosave and `mutate()` after
that throws until the page reloads. The same session found the dialog then
lists **duplicate rows** for the replaced filename, because it renders raw
storage records instead of what the form actually references.

This plan fixes that bug first (its own commit), then builds rename,
per-row replace and upload-conflict handling on top of the fixed, non-
corrupting upload path.

## Resolved decisions (see `shape.md` for full rationale)

1. The dialog lists **`form.doc.attachments`** refs, never raw
   `attachmentsRepo` records. `AttachmentRef` already carries
   `mediatype`/`size`/`role`, so no join back to `AttachmentRecord` is
   needed for the row model (a correction to the backlog's "joined with
   repo records" phrasing — verified against `src/core/model/types.ts:157-165`).
2. Rename **keeps the file extension**: the modal edits only the filename
   stem; the extension renders as a fixed, non-editable suffix.
3. "Keep both" always suffixes to the **first free numeric slot**
   (`name-2.ext`, `name-3.ext`, …), checked against existing attachment
   filenames **and** names already allocated earlier in the same upload
   batch.
4. Per-row replace **keeps the row's filename** regardless of the picked
   file's own name, reusing the existing "stored as X (was Y)" notice
   pattern from `TypeConfigSection.vue`.
5. Rename, per-row replace, and each conflict-resolved upload are
   individually **one undo step** with a human-readable label.
6. Rename UX is a **small modal**, not inline-in-row editing.
7. The conflict dialog offers **Replace / Keep both / Skip**, plus an
   "Apply to all remaining" checkbox that turns the chosen action into a
   silent default for every other file left in the same upload batch.
8. Rows show a **reference count** ("used by N questions"), derived from
   the same core scan helper the rename modal uses.
9. An **orphan sweep also runs when the dialog opens**, protecting records
   referenced by the current document **or by any undo/redo history
   entry** — a wider protected set than `close()`'s (which discards undo
   history right after pruning, so only needs to protect the current
   document). The two sweeps are two separate call sites; `close()` is
   unchanged.
10. Renaming a file that a `csv-external` question **implicitly**
    references (no explicit `itemsetFile`, relying on the
    `effectiveItemsetFile()` default of `${name}.csv`) **auto-materializes**
    an explicit `itemsetFile` on that question, in the same undo step —
    simpler and always-correct versus warning and leaving the reference
    dangling.
11. **(Added by the user 2026-07-16, post-promotion.)** The dialog also
    surfaces what the form design **requires but doesn't have**: every
    filename referenced anywhere in the document (explicit `itemsetFile`,
    the implicit `csv-external` `${name}.csv` default, question-label and
    choice-label media) that has **no** corresponding `doc.attachments`
    entry renders as a **Missing** row — filename, a "Missing" status in
    place of type/size, the same reference-count badge, and an **Upload**
    action that stores the picked file under the referenced name (the
    per-row-replace mechanism pointed at a missing name). "Referenced"
    means exactly what the refs/datasets validators mean — both derive
    from the same traversal — so the list agrees with the problems panel.

**Out of scope** (unchanged from the backlog): attachment editing/preview
beyond the existing dataset preview; drag-and-drop upload into the dialog
(note as a follow-up in the docs sweep); Central media-attachment publishing
(untouched); and the toolbar placement of the Attachments entry itself
(`editor-toolbar-declutter`'s concern — see Task 9 for the coordination this
plan owns).

---

## Task 1 — Fix the attachment save-poisoning bug (own commit, blocks Tasks 5-8)

**What:** stop the same-filename re-upload path from leaving a reactive
Proxy in the raw document, harden the snapshot path against the whole class
of bug, and stop the dialog from ever showing duplicate/orphaned rows.

**Files:**

- `src/composables/useAttachmentUpload.ts` — `attachFile`'s mutate
  currently does `d.attachments = d.attachments.filter((a) => a.filename
  !== filename)` then `d.attachments.push({...})` *through* the reactive
  `d` (the read-back-then-push sequence that leaves a nested Proxy in the
  surviving element). Replace with a mutate that builds the entire next
  array from plain data in one shot, before ever touching `d.attachments`:

  ```ts
  form.mutate(options.undoLabel ?? translate('dialogs.attachments.undoAdd'), (d) => {
    const next = d.attachments
      .filter((a) => a.filename !== filename)
      .map((a) => ({ ...a })) // de-proxy each surviving element (all-primitive fields)
    next.push({
      id: record.id,
      filename: record.filename,
      mediatype: record.mediatype,
      size: record.size,
      role: roleFor(record.filename, record.mediatype),
    })
    d.attachments = next
  })
  ```

  `d.attachments` is assigned exactly once, with an array that is fully
  plain before the assignment — no instrumented reactive array method
  (`.push`/`.splice`) is ever called on a value reached through `d`. Any
  future rename/replace mutate (Tasks 4-8) must follow the same rule:
  **never call an array-mutating method on a property reached through the
  reactive `doc` argument** — compute the next array/value from plain data,
  then assign once.
- `src/stores/form.ts` — harden `snapshotDoc` (:75) with a recursive
  de-proxy pass before `structuredClone`, so no future mutate shape can
  reintroduce this class of bug:

  ```ts
  const deepToRaw = <T>(value: T): T => {
    const raw = toRaw(value as object) as unknown
    if (Array.isArray(raw)) return raw.map((v) => deepToRaw(v)) as unknown as T
    if (raw !== null && typeof raw === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw)) out[k] = deepToRaw(v)
      return out as T
    }
    return raw as T
  }

  const snapshotDoc = (): FormDocument => structuredClone(deepToRaw(doc.value)) as FormDocument
  ```

  `deepToRaw` stays a private, non-exported helper in `form.ts` (it imports
  Vue's `toRaw`, so it cannot live in `src/core/`). `FormDocument` is plain
  JSON-shaped data (no `Blob`/`Map`/etc. per the core model's own
  documented invariant), so a generic object/array walk is safe.
- `src/components/attachments/AttachmentsDialog.vue` — replace the
  `records = ref<AttachmentRecord[]>([])` / `refresh()`-from-`attachmentsRepo.listAttachments`
  list source with a computed straight off the document:

  ```ts
  const rows = computed<AttachmentRef[]>(() => form.doc?.attachments ?? [])
  ```

  This removes the repo round-trip (and the staleness it caused) from the
  list entirely — `deleteAttachment`/future rename/replace calls still use
  the repo, just not for populating rows. Update the template's `v-for` to
  iterate `rows` and read `AttachmentRef` fields (`id`, `filename`,
  `mediatype`, `size`, `role`) instead of `AttachmentRecord` fields (same
  names except `blob`, which the row never used). `remove()` drops its
  trailing `await refresh()` call (no longer needed — `rows` is reactive).

**Tests (add before the fix; must fail on `main`, pass after):**

- `src/stores/form.spec.ts` — new tests in a `describe.each(backendCases)`
  block (import `backendCases` from `../../tests/helpers/backends`,
  matching the pattern in `src/persistence/forms-repo.spec.ts:1-20`),
  alongside (not replacing) the existing plain `describe('form store', …)`
  block:
  - `'form store attachment save resilience ($name backend)'`: load a
    fresh form, `attachFile` a `sites.csv`, `attachFile` a `logo.png`,
    then `attachFile` a **different-content** `sites.csv` again (the exact
    repro sequence). Assert `store.doc?.attachments` has exactly two
    entries (`logo.png`, the new `sites.csv`) with the new file's id, that
    `await store.flushSave()` resolves with `store.saveState === 'saved'`
    (never `'error'`), and that a subsequent `store.addNode('text', null)`
    does not throw and leaves `saveState` at `'dirty'` then `'saved'`
    after another `flushSave()`.
- `tests/component/attachment-upload.spec.ts` — no assertions should need
  to change (the mutate's *observable* result is identical); run it to
  confirm.
- No new component spec is needed yet for the list-source rewrite in
  `AttachmentsDialog.vue` — Task 5 adds the first dedicated component spec
  for that file and covers it there (`rows` renders each ref exactly once,
  a replaced filename shows one row, not two).

**i18n / testids:** none new in this task — existing `attachments-dialog`,
`attachment-upload`, `attachment-file-input`, `attachment-view` testids and
all rendered strings stay byte-identical.

---

## Task 2 — Core helper: rename, reference scan, "keep both" naming

**What:** a pure, unit-tested helper covering everything a rename or a
"keep both" upload needs to compute, reused by both the rename modal and
the per-row reference-count badge.

**File (new):** `src/core/model/rename-attachment.ts` — no Vue/Pinia/Dexie/
vue-i18n imports; reuses `visit` from `./ops` (the same traversal
`src/core/validate/refs.ts` already walks for missing-attachment
validation, so "what counts as a reference" stays consistent everywhere).

```ts
export interface AttachmentReferenceScan {
  count: number
}

/** One traversal over every reference site in the document — question
 *  itemsetFile (explicit or the csv-external implicit default) and
 *  question-label / choice-label media (image/audio/video/bigImage) —
 *  returning filename → occurrence count. Mirrors the traversal in
 *  src/core/validate/refs.ts so "referenced" means the same thing there
 *  and here. Drives the per-row reference counts AND the missing-row
 *  detection (referenced filenames absent from doc.attachments). */
export const collectAttachmentReferences = (doc: FormDocument): Map<string, number> => { … }

/** Per-filename view over collectAttachmentReferences (kept for call sites
 *  that scan a single name, e.g. the rename modal's summary line). */
export const scanAttachmentReferences = (doc: FormDocument, filename: string): AttachmentReferenceScan => { … }

export type RenameAttachmentOutcome =
  | { ok: true, referencesUpdated: number }
  | { ok: false, reason: 'not-found' | 'extension-changed' | 'collision' }

/** Mutates `doc` in place (call from inside form.mutate): re-keys the
 *  attachment ref's filename and rewrites every reference found by
 *  scanAttachmentReferences, including materializing an implicit
 *  csv-external default into an explicit itemsetFile when it matches
 *  `from`. Defensively re-checks the extension-lock and collision rules
 *  even though the UI is expected to enforce them first. */
export const renameAttachmentRefs = (doc: FormDocument, from: string, to: string): RenameAttachmentOutcome => { … }

/** First free `name-2.ext`, `name-3.ext`, … not in `existing`. Returns
 *  `filename` unchanged when it is not already in `existing`. */
export const firstFreeAttachmentName = (existing: ReadonlySet<string>, filename: string): string => { … }
```

Full bodies: `collectAttachmentReferences` (which `scanAttachmentReferences`
delegates to) and the reference-rewriting half of
`renameAttachmentRefs` walk `visit(doc.children, …)` checking
`node.itemsetFile === filename` and, when `node.itemsetFile === undefined`
and `node.type === 'csv-external'`, `` `${node.name}.csv` === filename ``,
plus `node.media?.{image,audio,video,bigImage}` (each a
`Partial<Record<Lang, string>>` — iterate `Object.keys(media)` and compare
`media[lang]`), then a second loop over `Object.values(doc.choiceLists)` /
`list.choices` for `choice.media?.{image,audio,video,bigImage}` — the exact
shape `src/core/validate/refs.ts:76-107` already uses. `renameAttachmentRefs`
additionally re-keys `doc.attachments.find((a) => a.filename === from)!.filename`
and, for csv-external implicit matches, sets `node.itemsetFile = to`
(materializing it) rather than leaving it implicit.

`firstFreeAttachmentName` splits at the last `.` (no extension ⇒ whole
string is the stem, empty suffix) and probes `-2`, `-3`, … against
`existing`.

**Tests (new):** `src/core/model/rename-attachment.spec.ts` (co-located,
matching `question-types.spec.ts`'s convention):

- `collectAttachmentReferences` / `scanAttachmentReferences`: zero for an
  unreferenced file; counts an
  explicit `itemsetFile` match; counts the implicit `csv-external` default
  match when `itemsetFile` is unset; counts question-label media in one
  language and choice-label media; does **not** double-count a file used
  in two languages of the same media slot as one (it should count each
  language occurrence — assert the exact number the test sets up); the
  collector's key set includes filenames that have **no** `doc.attachments`
  entry (the missing-detection contract) and excludes uploaded-but-
  unreferenced attachments.
- `renameAttachmentRefs`: renames the ref's filename; rewrites an explicit
  `itemsetFile`; **materializes** an implicit csv-external default into an
  explicit `itemsetFile` under the new name; rewrites question-label and
  choice-label media across multiple languages; returns
  `{ ok: false, reason: 'extension-changed' }` for a `.csv` → `.txt`
  attempt without mutating anything; returns `{ ok: false, reason:
  'collision' }` when `to` already names another attachment; returns
  `{ ok: false, reason: 'not-found' }` when `from` matches no attachment;
  a from === to call is a no-op returning `{ ok: true, referencesUpdated: 0 }`.
- `firstFreeAttachmentName`: returns the input unchanged when free; returns
  `name-2.ext` when `name.ext` is taken; returns `name-3.ext` when both
  `name.ext` and `name-2.ext` are taken; handles a filename with no
  extension.

**i18n / testids:** none (pure core, no UI).

---

## Task 3 — Persistence: `renameAttachment` on the backend seam

**What:** the one new repo capability this feature needs — updating a
stored attachment's filename in place. No Dexie schema bump (`filename` is
not an indexed field, `src/persistence/db.ts:146`).

**Files:**

- `src/persistence/backend.ts` — add to the `PersistenceBackend` interface
  (near the other attachment methods, :67-74):
  `renameAttachment: (id: string, filename: string) => Promise<void>`.
  Dexie impl:
  ```ts
  renameAttachment: async (id, filename) => {
    const updated = await db.attachments.update(id, { filename })
    if (updated === 0) throw new Error(`Attachment ${id} does not exist`)
  },
  ```
- `src/persistence/memory-backend.ts` — matching impl, following the
  existing `putForm`-style "does not exist" error:
  ```ts
  renameAttachment: async (id, filename) => {
    const record = attachments.get(id)
    if (record === undefined) throw new Error(`Attachment ${id} does not exist`)
    attachments.set(id, { ...record, filename })
  },
  ```
- `src/persistence/attachments-repo.ts` — thin wrapper:
  `export const renameAttachment = (id: string, filename: string): Promise<void> => getPersistenceBackend().renameAttachment(id, filename)`.

**Tests (new):** a `describe.each(backendCases)` block in a new
`src/persistence/attachments-repo.spec.ts` (no existing file to extend —
current attachment-repo coverage lives only inside consumer specs):

- renames an existing record's filename (`listAttachments` reflects the
  new name; the blob and id are unchanged).
- throws on both backends when the id does not exist (assert the same
  error-shape contract: repo signatures and failure behavior are identical
  across backends per the persistence invariant).

**i18n / testids:** none (persistence layer).

---

## Task 4 — Form store: dialog-open orphan sweep

**What:** a new store action the Attachments dialog calls on open, sweeping
records unreferenced by **either** the current document **or** any
undo/redo history entry — wider than `close()`'s protected set (which only
needs the current document, since undo history is discarded right after).

**File:** `src/stores/form.ts`

```ts
const protectedAttachmentIds = (): Set<string> => {
  const ids = new Set<string>()
  const collect = (d: FormDocument | null): void => { d?.attachments.forEach((a) => ids.add(a.id)) }
  collect(doc.value as FormDocument | null)
  for (const entry of undoStack.value) collect(entry.doc)
  for (const entry of redoStack.value) collect(entry.doc)
  return ids
}

const sweepOrphanAttachments = async (): Promise<void> => {
  if (recordId.value === null) return
  try {
    await attachmentsRepo.pruneOrphans(recordId.value, protectedAttachmentIds())
  } catch (error) {
    console.error('Failed to prune orphaned attachments', error)
  }
}
```

Add `sweepOrphanAttachments` to the store's returned object. `close()`
(:202-219) is **not** changed — it keeps its own inline, narrower
protected-set logic exactly as today.

**Tests:** extend `src/stores/form.spec.ts` (plain `describe`, dexie
backend is sufficient here — this exercises store-level undo-stack logic,
not backend parity):

- replace an attachment (superseded record kept for undo) → call
  `store.sweepOrphanAttachments()` → assert the superseded record **still
  exists** (protected by `undoStack`).
- `store.undo()` past the point where a record was superseded, so nothing
  references it from either the current doc or remaining history → call
  `sweepOrphanAttachments()` → assert it **is** removed.
- a record referenced only by a `redoStack` entry (after an `undo()`) is
  protected until the redo entry itself is discarded.

**i18n / testids:** none (store layer).

---

## Task 5 — Attachments dialog: missing-required rows + reference-count badge + first component spec

**What:** with the list already rendering from `doc.attachments` (Task 1)
and the sweep available (Task 4), wire the dialog's `watch(visible, …)` to
call the sweep instead of the old repo-list `refresh()`, and build the full
row model from Task 2's collector: uploaded attachments **plus a Missing
row for every filename the form design references that has no attachment**
(decision 11), each row carrying the reference-count badge. This task also
adds the **first** dedicated component spec for `AttachmentsDialog.vue`
(none exists today), which Tasks 6-8 extend.

**Files:**

- `src/components/attachments/AttachmentsDialog.vue`:
  ```ts
  watch(visible, (open) => { if (open) void form.sweepOrphanAttachments() })

  const refCounts = computed<Map<string, number>>(() =>
    form.doc !== null ? collectAttachmentReferences(form.doc) : new Map(),
  )

  interface AttachmentRow { ref: AttachmentRef | null, filename: string, missing: boolean }

  const rows = computed<AttachmentRow[]>(() => {
    const refs = form.doc?.attachments ?? []
    const present = new Set(refs.map((a) => a.filename))
    const missing = [...refCounts.value.keys()]
      .filter((name) => !present.has(name))
      .sort()
      .map((filename) => ({ ref: null, filename, missing: true }))
    return [...refs.map((ref) => ({ ref, filename: ref.filename, missing: false })), ...missing]
  })
  ```
  (This `rows` computed **replaces** Task 1's plain `doc.attachments`
  computed — Task 1 ships the simple version; this task generalizes it.)
  Missing rows render the filename, a "Missing" status chip
  (`data-testid="attachment-missing"`) in place of the `mediatype · size`
  meta line, **no** delete/preview/rename controls, and an **Upload**
  button (`data-testid="attachment-upload-missing"`, aria-label
  `t('dialogs.attachments.uploadMissingAria', { filename })`) that stores
  the picked file under the referenced filename via the shared per-row
  input mechanism Task 7 introduces (`attachFile(file, row.filename)` —
  identical semantics to replace, including the "stored as" notice when
  the picked file's own name differs). Normal rows render
  `t('dialogs.attachments.usedByCount', { count: refCounts.get(ref.filename) ?? 0 })`
  under the meta line, `data-testid="attachment-ref-count"`.
- `src/i18n/locales/en/dialogs.json` — add under `dialogs.attachments`:
  `"usedByCount": "Not referenced | Used by 1 question | Used by {count} questions"`
  (three-way plural form, matching the existing precedent in
  `properties.json`'s `usedByCount`/`attachmentsPulled` in `central.json`),
  `"missing": "Missing"`,
  `"missingHint": "The form references this file, but it hasn't been uploaded."`,
  `"uploadMissing": "Upload"`,
  `"uploadMissingAria": "Upload {filename}"`.

**Tests (new):** `tests/component/attachments-dialog.spec.ts`, mocking
`@/persistence/attachments-repo` exactly like
`tests/component/type-config-upload.spec.ts` (`freshPinia`/`mountWith` from
`tests/component/helpers.ts`, `global: { stubs: { teleport: true } }` per
`tests/component/dataset-preview-dialog.spec.ts`):

- renders one row per `doc.attachments` entry, with no repo `listAttachments`
  call for the list itself (assert the mock is not called, or called only
  by the sweep).
- a replace (push a second ref under a different id but call `refCounts`)
  never yields two rows for the same filename.
- reference-count badge shows 0/1/N correctly for a file referenced by an
  `itemsetFile`, by choice media, and by neither.
- **missing rows**: a doc whose question references `villages.csv` via
  `itemsetFile` (and another implicitly via csv-external `${name}.csv`)
  with no matching attachments shows one Missing row per referenced name,
  status chip rendered, no rename/delete/preview controls; uploading via
  the missing row's Upload button calls `attachFile(file, filename)` and
  the row flips to a normal row (chip gone, meta line present); an
  uploaded-but-unreferenced attachment never shows the Missing chip.
- opening the dialog (`editor.activeDialog = 'attachments'`) triggers
  `attachmentsRepo.pruneOrphans` (mock assertion) exactly once.

**i18n / testids:** `usedByCount`, `missing`, `missingHint`,
`uploadMissing`, `uploadMissingAria` (above); `attachment-ref-count`,
`attachment-missing`, `attachment-upload-missing` (new testids).

---

## Task 6 — Rename modal

**What:** a per-row "Rename" action opening a small modal; confirming
applies the rename as one undo step (repo filename update + core helper
reference rewrite).

**Files (new):** `src/components/attachments/RenameAttachmentDialog.vue` —
props `attachment: AttachmentRef | null` (null ⇒ closed), `existingFilenames:
string[]`; emits `update:attachment` (null to close) and `rename(newName:
string)`. Internal state: a stem `InputText` (`data-testid="rename-attachment-stem"`)
prefilled from the current filename minus its extension, a fixed,
non-editable extension suffix rendered next to it, and inline validation
(non-empty stem, no `/`/`\`, no collision against `existingFilenames` minus
the row's own current filename) that disables the Confirm button and shows
`data-testid="rename-attachment-error"` when invalid. Also renders the
reference-count summary from Task 2's `scanAttachmentReferences` (computed
against the **old** filename — the count doesn't change while the user
types the new stem), e.g. "Renaming will update 2 references."

**Files (modified):** `src/components/attachments/AttachmentsDialog.vue` —
a "Rename" button per row (`data-testid="attachment-rename"`,
aria-label `t('dialogs.attachments.renameAria', { filename })`), local
`renameTarget = ref<AttachmentRef | null>(null)`, and a confirm handler:

```ts
const confirmRename = async (newName: string): Promise<void> => {
  const target = renameTarget.value
  renameTarget.value = null
  if (target === null) return
  await attachmentsRepo.renameAttachment(target.id, newName)
  form.mutate(t('dialogs.attachments.undoRename'), (d) => {
    renameAttachmentRefs(d, target.filename, newName)
  })
}
```

(Repo call first, doc mutate second — the same ordering convention as
`attachFile`; Task 1's hardening means a mutate failure here is no longer
expected, but the ordering is kept consistent with the rest of the file.)

**i18n (new, `dialogs.json` → `dialogs.attachments`):**
- `"rename": "Rename"` (button label)
- `"renameAria": "Rename {filename}"`
- `"undoRename": "Rename attachment"`
- nested `"rename"` object for the modal:
  `"header": "Rename {filename}"`,
  `"newName": "New name"`,
  `"referencesNone": "This file is not currently referenced."`,
  `"referencesCount": "Renaming will update 1 reference. | Renaming will update {count} references."`,
  `"errorEmpty": "Enter a name."`,
  `"errorSeparator": "Names can't contain \"/\" or \"\\\"."`,
  `"errorCollision": "\"{filename}\" is already used by another attachment."`,
  `"confirm": "Rename"`,
  `"cancel": "Cancel"`.

**Tests:** extend `tests/component/attachments-dialog.spec.ts`:

- opens the modal prefilled with the current stem and locked extension.
- rejects an empty stem, a stem containing `/`, and a collision, each
  without closing the modal or mutating the doc.
- confirms a valid rename: `attachmentsRepo.renameAttachment` called with
  the new full filename; `form.doc.attachments` shows the new filename;
  a question's `itemsetFile` that pointed at the old name now points at
  the new one; `form.undo()` restores both.
- renaming a file only implicitly referenced by a `csv-external` question
  (no explicit `itemsetFile`) leaves that question with an explicit
  `itemsetFile` equal to the new name.

**i18n / testids summary:** `attachment-rename`,
`rename-attachment-stem`, `rename-attachment-error`,
`rename-attachment-confirm` (Confirm button), plus the keys above.

---

## Task 7 — Per-row replace

**What:** a "Replace" control per row that re-uses `attachFile(file,
row.filename)` (the `TypeConfigSection` targeted-replace pattern), showing
the "stored as" notice only when the picked file's own name differs.

**Files:** `src/components/attachments/AttachmentsDialog.vue`:

```ts
// keyed by filename, not AttachmentRef — the same mechanism serves both a
// normal row's Replace and a Missing row's Upload (Task 5, decision 11)
const replaceTarget = ref<{ filename: string } | null>(null)
const replaceInput = ref<HTMLInputElement | null>(null)
const storedAsNotice = ref<{ row: string, original: string } | null>(null)

const startReplace = (filename: string): void => {
  replaceTarget.value = { filename }
  replaceInput.value?.click()
}

const onReplaceFile = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  const target = replaceTarget.value
  replaceTarget.value = null
  if (file === undefined || target === null) return
  storedAsNotice.value = file.name !== target.filename ? { row: target.filename, original: file.name } : null
  const existed = (form.doc?.attachments ?? []).some((a) => a.filename === target.filename)
  await attachFile(file, target.filename, existed ? { undoLabel: t('dialogs.attachments.undoReplace') } : undefined)
}
```

(The `existed` check keeps undo labels honest: a Missing row's Upload is an
*add*, not a replace, so it takes `attachFile`'s default add label.)

A single hidden `<input type="file" ref="replaceInput" data-testid="attachment-replace-input">`
serves every row (mirroring the footer's single shared input) — including
the Missing rows' Upload buttons from Task 5, which call
`startReplace(row.filename)` with a filename no attachment carries yet
(`attachFile` then creates rather than supersedes, which is exactly its
existing behaviour). Each normal row
gets a "Replace" `Button` (`data-testid="attachment-replace"`, aria-label
`t('dialogs.attachments.replaceAria', { filename })`) calling
`startReplace(ref.filename)`. The stored-as notice renders under a row only when
`storedAsNotice.value?.row === ref.filename`
(`data-testid="attachment-stored-as"`), text via a new
`dialogs.attachments.storedAs` key (the copy pattern is reused, not moved —
`properties.json`'s `typeConfig.storedAs` stays where it is, per the
standards note on not relocating shared copy).

**i18n (new):**
- `"replace": "Replace"`, `"replaceAria": "Replace {filename}"`,
  `"undoReplace": "Replace attachment"`,
  `"storedAs": "Stored as {stored} (was {original})."`.

**Tests:** extend `tests/component/attachments-dialog.spec.ts`:

- replacing with a same-named file: no stored-as notice; row count
  unchanged; `repo.deleteAttachment` not called (superseded record kept,
  mirroring `type-config-upload.spec.ts`'s equivalent assertion).
- replacing with a differently-named file: stored-as notice appears under
  that row only, with both names in the rendered text; the row's filename
  and every question reference to it stay unchanged.
- undo after a per-row replace restores the prior record's id under the
  same filename (mirrors `src/stores/form.spec.ts:112-124`).

**i18n / testids summary:** `attachment-replace`,
`attachment-replace-input`, `attachment-stored-as`, plus the keys above.

---

## Task 8 — Upload-conflict handling (Replace / Keep both / Skip / apply-to-all)

**What:** the general "Upload files" footer control stops per file whose
name collides with an existing attachment and asks for a decision, with an
"apply to all remaining" fast path for multi-file batches.

**Files (new):** `src/components/attachments/AttachmentConflictDialog.vue`
— props `file: File | null` (null ⇒ closed), `remaining: number` (files
still queued after this one, drives whether "apply to all" is offered);
emits `resolve({ action: 'replace' | 'keep-both' | 'skip', applyToRemaining:
boolean })`. Renders the conflicting filename, three buttons
(`data-testid="attachment-conflict-replace"`,
`attachment-conflict-keep-both`, `attachment-conflict-skip`), and — only
when `remaining > 0` — a checkbox
`data-testid="attachment-conflict-apply-all"` labelled "Apply to all
remaining ({remaining})".

**Files (modified):** `src/components/attachments/AttachmentsDialog.vue`:

```ts
const conflictQueue = ref<File[]>([])
const conflictIndex = ref(0)
const applyAllChoice = ref<'replace' | 'keep-both' | 'skip' | null>(null)
const activeConflict = computed<File | null>(() => conflictQueue.value[conflictIndex.value] ?? null)

const upload = async (event: Event): Promise<void> => {
  const files = (event.target as HTMLInputElement).files
  if (files === null || form.recordId === null) return
  const known = new Set((form.doc?.attachments ?? []).map((a) => a.filename))
  const queue: File[] = []
  for (const file of files) {
    if (known.has(file.name)) { queue.push(file); continue }
    await attachFile(file)
    known.add(file.name)
  }
  (event.target as HTMLInputElement).value = ''
  if (queue.length > 0) {
    conflictQueue.value = queue
    conflictIndex.value = 0
    applyAllChoice.value = null
    await advanceConflict()
  }
}

const advanceConflict = async (): Promise<void> => {
  while (conflictIndex.value < conflictQueue.value.length) {
    if (applyAllChoice.value === null) return // wait for the modal
    await applyConflict(applyAllChoice.value, conflictQueue.value[conflictIndex.value])
    conflictIndex.value++
  }
  conflictQueue.value = []
}

const resolveConflict = async ({ action, applyToRemaining }: { action: 'replace' | 'keep-both' | 'skip', applyToRemaining: boolean }): Promise<void> => {
  if (applyToRemaining) applyAllChoice.value = action
  const file = activeConflict.value
  if (file !== null) await applyConflict(action, file)
  conflictIndex.value++
  await advanceConflict()
}

const applyConflict = async (action: 'replace' | 'keep-both' | 'skip', file: File): Promise<void> => {
  if (action === 'skip') return
  if (action === 'replace') {
    await attachFile(file, undefined, { undoLabel: t('dialogs.attachments.undoReplace') })
    return
  }
  const known = new Set((form.doc?.attachments ?? []).map((a) => a.filename))
  await attachFile(file, firstFreeAttachmentName(known, file.name))
}
```

Each resolved file is its own `attachFile` call and therefore its own undo
step, matching the existing one-mutate-per-upload granularity (unchanged
from today's plain multi-file loop) — "apply to all" changes how many
prompts the user sees, not how many undo steps are produced.

**i18n (new, `dialogs.attachments.conflict.*`):**
- `"header": "\"{filename}\" already exists"`,
  `"body": "A file named {filename} is already attached to this form."`,
  `"replace": "Replace"`, `"keepBoth": "Keep both"`, `"skip": "Skip"`,
  `"applyToAll": "Apply to all remaining ({count})"`.

**Tests:** extend `tests/component/attachments-dialog.spec.ts`:

- a single conflicting upload shows the conflict dialog with the right
  filename; **Replace** updates the existing row in place, no new row.
- **Keep both** adds a new row named `name-2.ext` (or the next free slot
  when `-2` is already taken by a prior attachment).
- **Skip** leaves the document and attachment list unchanged.
- a batch of N files where 2 collide: non-conflicting files upload
  immediately; the conflict dialog appears once per colliding file in
  order; ticking "apply to all" on the first and choosing Keep both
  applies Keep-both to the remaining colliding file(s) without a second
  prompt, and the two "kept both" files get distinct, non-colliding
  suffixes (`-2`, `-3`).

**i18n / testids summary:** `attachment-conflict-replace`,
`attachment-conflict-keep-both`, `attachment-conflict-skip`,
`attachment-conflict-apply-all`, plus the keys above.

---

## Task 9 — e2e coordination + full-suite test pass

**What:** reconcile the two e2e specs that exercise the Attachments dialog
with whatever this dialog now looks like, and land the coordination with
`editor-toolbar-declutter`.

- `tests/e2e/dataset-tooling.spec.ts:58-70`,
  `tests/e2e/workspace-archive.spec.ts:9-17,78-82` currently open the
  dialog via `editor-more` → `getByRole('menuitem', { name: 'Attachments'
  })`. **If `editor-toolbar-declutter` has already integrated** (it is
  scheduled to land first per the coordination note in `shape.md`), rebase
  onto its navigation change (the new "Form" menu) and update just the
  open-dialog steps in both files — every assertion on
  `attachments-dialog` content and on `attachment-file-input`/
  `attachment-view` stays as-is, since this feature does not change those.
  **If it has not yet landed**, leave the `editor-more` navigation alone
  and flag the rebase as a follow-up commit once it does.
- Neither e2e file needs a new end-to-end scenario for rename/replace/
  conflict — those are fully covered at the component level (Tasks 5-8);
  keep e2e scoped to the existing upload/view/save-round-trip happy path
  plus the Task 1 regression once end-to-end (upload → same-name
  re-upload → save succeeds), added to `dataset-tooling.spec.ts` or a new
  small e2e case if the component-level regression in Task 1 is judged
  insufficient confidence for the real browser/IndexedDB path.

---

## Task 10 — Verify

Run the full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm
test:coverage`; `pnpm test:e2e`. Confirm coverage floors (core 86/78/88,
stores 80/85, persistence 90/92) stay green — the new core helper, the
`renameAttachment` backend method, and the store's `sweepOrphanAttachments`
all need tests contributing to those floors, not just passing assertions.

**`/agent-browser` pass** against the built app (`:4173`, matching `pnpm
test:e2e`), driving every scenario in `user-guide.md`'s "Manual test
scenarios" section (the bug-fix regression, rename incl. validation and the
implicit-reference case, per-row replace both same- and different-named,
all three conflict actions plus apply-to-all, the reference-count badge,
and the open-time orphan sweep not evicting undo-reachable records).
Screenshots + notes logged to
`docs/verification/2026-07-16-attachment-manager/`.

**`/interface-craft` pass** on the two new overlays (rename modal, conflict
dialog) for consistency with the existing dialog's look and the app's other
small-modal idioms; fold any findings into the same commit.

---

## Task 11 — Code review

`/code-review` (five lenses, no plan mode) on the full wave diff; fix
findings immediately, before the feature commit(s) land.

---

## Task 12 — Documentation sweep

- **README.md** — Features section: note rename/replace/conflict handling
  under the existing attachments bullet(s) (around the "Export" and
  workspace-archive attachment mentions, `README.md:34,36,53,112`).
- **`docs/product/roadmap.md`** — mark the attachment-manager hardening
  delivered alongside the existing attachments/ZIP entry (`roadmap.md:15`).
- **`CLAUDE.md`** — Code map: extend the `src/composables/` row
  (`useAttachmentUpload` — now also backs per-row replace and conflict
  resolution), add `src/core/model/rename-attachment.ts` to the
  `src/core/model/` row, and note the persistence bullet's new
  `renameAttachment` method. Note the drag-and-drop-upload follow-up in the
  roadmap or a fresh backlog stub if not already tracked.
- Update `docs/specs/backlog/attachment-manager.md` to a short promotion
  stub pointing at this folder (matching the `central-ux-enhancement`
  precedent).

---

## Verification

**Commands:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm
test:coverage`, `pnpm test:e2e` — all green, coverage floors intact (core
86/78/88, stores 80/85, persistence 90/92).

**`/agent-browser`:** full walkthrough of `user-guide.md`'s 13 manual test
scenarios against the built app on `:4173`; screenshots + a written pass
log saved to `docs/verification/2026-07-16-attachment-manager/`.

**`/interface-craft`:** a critique pass on `RenameAttachmentDialog.vue` and
`AttachmentConflictDialog.vue` specifically (new overlays), checked against
the existing `AttachmentsDialog.vue` and the repo's other small-modal
patterns; findings folded into the same commit, not deferred.

**Logged artefacts:** `docs/verification/2026-07-16-attachment-manager/`
(screenshots + notes per scenario), plus the `/code-review` findings
summary (fixed inline, not a separate file per the established process).
