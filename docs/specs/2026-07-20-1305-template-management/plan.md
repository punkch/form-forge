# Template management in the New form gallery

## Context

The "New form" gallery (`src/components/library/NewFormDialog.vue`) is the only place
templates are managed, and it has two hard edges:

1. **Deleting a saved template is unconfirmed and irreversible.** `removeLocal()` calls
   `templatesRepo.deleteTemplate(record.id)` straight from a trash-icon click — no
   confirm, no undo. This is inconsistent with deleting a *form*, which goes through
   `confirm.require()` (`FormLibraryView.confirmDelete`, line ~119).
2. **The four bundled starters cannot be hidden.** `bundledTemplates` is rendered with
   an unfiltered `v-for`, and no hidden/disabled state exists anywhere in the app. A user
   with their own templates is stuck scrolling past starters they never use.

While shaping, three adjacent gaps were pulled in: a saved template's title/description
can only be set at save time (never edited), saving a template whose name already exists
silently creates a duplicate, and there is no way to bring hidden starters back en masse.

**Outcome:** the gallery becomes a place you can actually curate — safe deletion, editable
templates, replace-on-save, and starters you can hide and restore.

This follows directly from commit `6fe48c2`, which made locally saved templates part of the
workspace backup. The new `hiddenBundledTemplates` preference rides along in that same
backup for free (see Task 3).

---

## Task 1: Save spec documentation

Create `docs/specs/2026-07-20-1305-template-management/` containing:

- **plan.md** — this plan, copied in FULL (no summarizing)
- **shape.md** — scope, the four decisions below, and their rationale
- **standards.md** — the repo conventions that bind this work (see "Standards" below)
- **references.md** — the reference implementations named throughout this plan
- **user-guide.md** — user-facing docs + manual test scenarios
- **visuals/** — none provided; omit the folder

### Decisions to record in shape.md

| # | Decision | Why |
|---|---|---|
| 1 | Delete uses the **global `ConfirmDialog`** (`confirm.require`), not an inline or undo-toast pattern | Consistency with `FormLibraryView.confirmDelete`; the app already mounts `<ConfirmDialog />` in `App.vue` |
| 2 | Hidden starters are a **ui-store preference**, not a Dexie table | They are device-level UI state, exactly like `dismissedCallouts`; this also makes them ride the workspace backup for free |
| 3 | **No `STORAGE_VERSION` bump** in the ui store | `loadPersisted()` discards the whole blob on version mismatch — a bump would wipe every existing user's theme/locale/panel widths. The new field is guarded and defaults to `[]` |
| 4 | **No `WORKSPACE_FORMAT_VERSION` bump** | `UiPreferences = Omit<PersistedUiState,'version'>`, so the field flows into `preferences.json` automatically; `applyPreferences` guards it, so an older backup without it is a no-op. Same additive reasoning as commit `6fe48c2` |

---

## Task 2: Persistence — extend the seam and the repo

**`src/persistence/backend.ts`** (+ `memory-backend.ts`) — add two methods next to the
template trio added in `6fe48c2`, mirroring the `getCentralServer` / `putCentralServer` pair:

- `getTemplate: (id: string) => Promise<TemplateRecord | undefined>`
- `putTemplate: (record: TemplateRecord) => Promise<void>` — insert-or-replace by id

Dexie: `db.templates.get(id)` / `db.templates.put(record)`. Memory: `structuredClone` on
read and write, matching the surrounding style.

**`src/persistence/templates-repo.ts`** — extract the doc-derived fields that `addTemplate`
already computes (JSON-clone, `attachments = []`, `countQuestions`, `templatePreview`) into a
shared local helper, then add:

- `updateTemplate(id, { title, description })` — metadata-only edit. Reads via `getTemplate`,
  preserves `doc`/`createdAt`/`questionCount`/`preview`, sets `updatedAt: Date.now()`.
  No-op if the id is gone.
- `replaceTemplate(id, doc, title, description)` — overwrite-on-save. Recomputes the
  doc-derived fields via the shared helper, **preserves `createdAt`**, sets `updatedAt`.

Both go through `getPersistenceBackend()` — never `db` directly (the seam invariant, and
what lets the specs run on both backends).

---

## Task 3: ui store — `hiddenBundledTemplates`

**`src/stores/ui.ts`** — mirror `dismissedCallouts` exactly; it is the same shape (persisted
array of stable string ids) and touches the same seven places:

1. `PersistedUiState` — add `hiddenBundledTemplates: string[]`
2. A guarded ref: `Array.isArray(...) ? ...filter(id => typeof id === 'string') : []`
3. Actions: `hideBundledTemplate(id)`, `unhideBundledTemplate(id)`,
   `resetHiddenBundledTemplates()`, `isBundledTemplateHidden(id)` — copy the
   `dismissCallout` / `isCalloutDismissed` idiom (immutable array replacement, no dupes)
4. `exportPreferences()` — add `hiddenBundledTemplates: [...ref.value]`
5. `applyPreferences()` — add the `Array.isArray` + string-filter guard
6. The `watch([...])` persistence list
7. The store's return object

**Do not bump `STORAGE_VERSION`** (Decision 3). Ids are the stable `BundledTemplate.id`
values from `src/templates/index.ts` (`household-survey`, `individual-registration`,
`site-monitoring-visit`, `feedback-satisfaction`); an unknown id in the list is harmless
because filtering is a membership test.

---

## Task 4: NewFormDialog — confirm, hide/unhide, rename

**`src/components/library/NewFormDialog.vue`** — the bulk of the work.

**4a. Confirm before delete.** Import `useConfirm` and wrap `removeLocal`, mirroring
`FormLibraryView.confirmDelete`'s payload shape (`header`, `message`, `icon:
'pi pi-exclamation-triangle'`, `acceptLabel: t('common.delete')`, `rejectLabel:
t('common.cancel')`, danger accept styling). The existing delete only runs from `accept`.

**4b. Hide / show starters.** Split the bundled list into two computeds driven by
`ui.isBundledTemplateHidden(t.id)`: `visibleBundled` and `hiddenBundled`. Below the grid,
add a disclosure — "Show hidden starters (N)" — rendered only when `hiddenBundled.length > 0`,
listing each hidden starter with an unhide control plus a **Restore all** button wired to
`resetHiddenBundledTemplates()`.

> **Markup constraint:** each bundled card is currently a single `<button>`, so a nested
> hide button would be invalid HTML. Restructure bundled cards to the pattern the local
> cards already use (lines 174–200): a `<div class="template-card">` wrapper containing an
> inner `<button class="…-main">` for selection plus a sibling icon `Button`. Reuse the
> existing `.local-card` / `.local-card-main` / `.local-card-delete` CSS rather than
> inventing new layout.

**4c. Rename a saved template.** Add a pencil icon `Button` to each local card opening a
small nested `Dialog` (title + description inputs, prefilled) that calls
`templatesRepo.updateTemplate`, then refreshes `localTemplates`.

> **Stacking risk (applies to 4a and 4c):** both the `ConfirmDialog` and the rename
> `Dialog` open *on top of* the already-modal New form dialog. PrimeVue generally handles
> z-index stacking, but focus-trap and overlay ordering must be confirmed visually — see
> Verification.

New testids: `new-form-local-rename`, `new-form-starter-hide`, `new-form-starter-unhide`,
`new-form-show-hidden`, `new-form-restore-starters`, `template-rename-*`. Preserve every
existing testid (e2e helpers depend on them).

---

## Task 5: Save-template — replace instead of duplicating

**`src/views/FormLibraryView.vue`** — `applySaveTemplate` (line ~111) currently always calls
`addTemplate`, so saving under an existing name silently creates a second entry.

Resolve the collision **inline in the save-template dialog**, not with a modal-over-modal:
when the trimmed name case-insensitively matches an existing template, show a warning line
and offer **Replace** (→ `replaceTemplate(existing.id, …)`) alongside **Save a copy**
(→ `addTemplate`, current behaviour). Cancel leaves the dialog open.

Mirror the shape of the existing `ImportCollisionPanel`
(`src/components/importexport/ImportCollisionPanel.vue`) — the codebase's established
Copy/Replace prompt — rather than inventing a new interaction. Load the template list when
the dialog opens so the check is a local lookup, not a per-keystroke query.

---

## Task 6: i18n — en, fr, es

Add to `src/i18n/locales/en/library.json` under `library.newFormDialog.*` and
`library.saveTemplateDialog.*`:

- `deleteLocalConfirm.header` / `.message` (interpolates `{title}`)
- `renameLocal` (aria), and the rename dialog's header / name / description labels
- `hideStarter` / `unhideStarter` (aria, interpolate `{title}`), `showHidden` (pluralised on
  count), `restoreAllStarters`
- save-template collision: `templateExists`, `replace`, `saveCopy`

**Mirror every key into `fr/` and `es/`** — `MessageSchema = typeof en` means vue-tsc fails
on any drift. Terminology per the glossary in
`docs/specs/2026-07-16-1125-ui-localization-fr-es/`: template → *modèle* / *plantilla*.
Reuse `common.delete` / `common.cancel` rather than adding new ones.

---

## Task 7: Tests

- **`tests/component/new-form-dialog.spec.ts`** — delete is not performed until the confirm
  is accepted; hiding a starter removes it from the grid and surfaces it under
  "Show hidden (N)"; unhide and Restore-all bring starters back; rename updates the card.

  > There is **no existing recipe** for driving a confirm in a component test —
  > `form-library-view.spec.ts` registers `ConfirmationService` but never exercises the
  > dialog. Mock it the way the suite already mocks toasts
  > (`vi.mock('primevue/usetoast')` in `workspace-archive-dialog.spec.ts`): stub
  > `primevue/useconfirm`, assert `require` was called with the expected payload, then
  > invoke the captured `accept` to prove the delete happens only then.

- **`tests/component/form-library-view.spec.ts`** — saving under an existing name offers
  Replace; Replace updates in place (count stays 1, `createdAt` preserved) while Save-a-copy
  yields 2.
- **ui store spec** — `hiddenBundledTemplates` survives `exportPreferences` →
  `applyPreferences`; a malformed/absent value falls back to `[]`; `STORAGE_VERSION`
  is unchanged.
- **`tests/unit/workspace-full-backup.spec.ts`** — extend the preferences assertion so the
  hidden-starter list round-trips through a real backup.
- Repo-level coverage for `updateTemplate` / `replaceTemplate` runs on **both backends** via
  `tests/helpers/backends.ts`.

---

## Task 8: Documentation

Per the repo's "keep this file up to date" mandate:

- **CLAUDE.md** — ui store row (`hiddenBundledTemplates`), `templates-repo` /
  backend-seam rows (`getTemplate`/`putTemplate`, `updateTemplate`/`replaceTemplate`),
  and a note that hidden starters ride the backup's `preferences.json`
- **README.md** — extend the "Form templates" feature bullet with manage/hide/rename
- **docs/product/roadmap.md** — a delivered entry pointing at this spec folder

---

## Task 9: Verify and review

1. `pnpm typecheck && pnpm test && pnpm lint` — all must be green
2. **Browser pass via `/agent-browser`** (required: automated gates are blind to CSS layout
   and overlay stacking). Confirm specifically: the ConfirmDialog and rename Dialog render
   *above* the New form dialog with working focus and Esc; the restructured bundled cards
   are visually unchanged; the hide/show disclosure behaves in light **and** dark themes.
   Log the pass to `docs/verification/`.
3. `/code-review` (five lenses, no plan mode) — fix findings immediately
4. Conventional commit, e.g. `feat(templates): manage saved templates and hide starters`

---

## Standards that bind this work

- `src/core/` purity is untouched — this is store/persistence/UI only
- Persistence goes through the **backend seam**; specs run on both backends
- **UI strings only via vue-i18n**, en/fr/es in lockstep
- **Motion only via `--builder-motion-*` tokens**; no literal timings in the disclosure
  transition
- **No undefined CSS custom properties** (stylelint gate)
- **Preserve existing `data-testid`s**
- Conventional commits, worked directly on `main`

## Files touched

| File | Change |
|---|---|
| `src/persistence/backend.ts`, `memory-backend.ts` | `getTemplate`, `putTemplate` |
| `src/persistence/templates-repo.ts` | `updateTemplate`, `replaceTemplate`, shared field helper |
| `src/stores/ui.ts` | `hiddenBundledTemplates` + 4 actions (7 touch points) |
| `src/components/library/NewFormDialog.vue` | confirm, hide/unhide, rename, card restructure |
| `src/views/FormLibraryView.vue` | replace-on-save collision handling |
| `src/i18n/locales/{en,fr,es}/library.json` | new keys, in lockstep |
| `tests/component/*`, `tests/unit/*` | coverage above |
| `CLAUDE.md`, `README.md`, `docs/product/roadmap.md` | docs |
