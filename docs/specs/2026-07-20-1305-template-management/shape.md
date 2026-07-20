# Template Management — Shaping Notes

## Scope

The "New form" gallery (`src/components/library/NewFormDialog.vue`) is the only place
templates are managed, and it has two hard edges: deleting a saved template is unconfirmed
and irreversible, and the four bundled starters cannot be hidden. Three adjacent gaps were
pulled in while shaping: a saved template's title/description can only be set at save time
(never edited), saving a template under an existing name silently creates a duplicate, and
there is no way to bring hidden starters back en masse.

The delivered shape covers all five behaviours in one pass:

1. Confirm-before-delete for saved templates.
2. Hide a bundled starter from the grid.
3. Restore hidden starters (individually or all at once).
4. Rename a saved template's title/description after the fact.
5. Replace-on-save when saving under an existing template name, instead of duplicating.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Delete uses the **global `ConfirmDialog`** (`confirm.require`), not an inline or undo-toast pattern | Consistency with `FormLibraryView.confirmDelete`; the app already mounts `<ConfirmDialog />` in `App.vue`. Introducing a second delete-confirmation idiom (inline warning, undo toast) alongside the existing one would fragment the app's confirm vocabulary for no benefit — every other destructive action in the app already funnels through this one component. |
| 2 | Hidden starters are a **ui-store preference**, not a Dexie table | They are device-level UI state, exactly like `dismissedCallouts` — a small set of stable string ids, no relational structure, no need for query/index support a database table would imply. Modeling it as a Dexie table would mean a schema bump, a new repo, and backend-seam methods on both backends for what is fundamentally the same shape the ui store already persists. Piggybacking on the ui store also means it **rides the workspace backup for free** — `exportPreferences`/`applyPreferences` already round-trip the whole `PersistedUiState` shape through `preferences.json`, so no new backup-format work is needed. |
| 3 | **No `STORAGE_VERSION` bump** in the ui store | `loadPersisted()` discards the *entire* persisted blob on any version mismatch — a bump would silently wipe every existing user's theme, locale, and panel-width preferences on their next load, just to add one new array field. The new field is additive and guarded (`Array.isArray(...) ? ...filter(...) : []`), so it defaults safely to `[]` for anyone on an older persisted blob; no migration step is needed. |
| 4 | **No `WORKSPACE_FORMAT_VERSION` bump** | `UiPreferences = Omit<PersistedUiState,'version'>`, so `hiddenBundledTemplates` flows into `preferences.json` automatically the moment it's added to `exportPreferences`/`applyPreferences` — no new archive section, no new reader branch. `applyPreferences` already guards every field it reads, so an **older** backup that lacks the key is a silent no-op (empty array), and a **newer** backup read by an older app just has the extra field ignored by that version's own guard. This is the same additive reasoning CLAUDE.md documents for commit `6fe48c2`: bump the format version only when an older reader would *misread* the archive, not for a purely optional section it can safely skip. |

## Context

**Visuals:** None provided; the restructured bundled-starter cards reuse the existing
`.local-card` / `.local-card-main` / `.local-card-delete` CSS rather than inventing new
layout, so the pixel result should be visually unchanged from today's single-`<button>`
cards. Verify with `/agent-browser` per Task 9 of the plan (light and dark themes, overlay
stacking of `ConfirmDialog` and the rename `Dialog` above the already-modal New form dialog).

**References:** see `references.md` for the reference implementations named throughout the
plan — `FormLibraryView.confirmDelete` (the confirm payload shape to mirror),
`src/stores/ui.ts`'s `dismissedCallouts` (the persisted-string-array pattern
`hiddenBundledTemplates` mirrors exactly), `NewFormDialog`'s existing local-card markup
(the div-wrapper + inner button + sibling icon-button shape the bundled cards must adopt),
and `ImportCollisionPanel` (the established Copy/Replace prompt shape reused for the
save-template collision).

**Product alignment:** this extends the delivered workspace-backup work in commit
`6fe48c2`, which made locally saved templates (and, separately, device UI preferences) part
of the whole-workspace backup's `preferences.json`/`templates.json` sections. The new
`hiddenBundledTemplates` preference rides along in that same `preferences.json` section for
free — no format-version change, no new archive plumbing — because it is added to the ui
store's existing `exportPreferences`/`applyPreferences` pair rather than to a new table or
section.
