# References

## Current implementation (verified against code 2026-07-16)

This corrects and re-anchors the backlog doc's "current implementation"
section against the actual tree (line numbers re-checked; one consumer claim
was wrong and is fixed below).

- **`src/components/shell/AppHeader.vue`** — the shared header shell used by
  the editor only (`FormLibraryView.vue` has its own header markup and does
  not use `AppHeader`). Structure as of this read:
  - `:30` back button (`back-to-library`, `v-if="!embed.active"`)
  - `:39` form title (`editor-form-title`)
  - `:42` `<SaveIndicator>`
  - `:45` `<UndoRedoButtons />`
  - `:46` `<slot name="actions" />`
  - `:47` `<ThemeToggle v-if="!embed.active" />` — **removed by this change**
  - `:48–56` help button (`help-button` → `editor.activeDialog =
    'help-reference'`)
  - The left cluster (`.app-header-left`, `:74,82-84`) is where the new
    `#title-actions` slot is added, between the title and `SaveIndicator`.
- **`src/views/FormEditorView.vue`** — fills `#actions` with (current
  line numbers):
  - `:239–247` palette toggle (`palette-toggle`, icon `pi-objects-column`
    — **re-glyphed to `pi-palette`**, severity flips primary/secondary with
    `paletteShown`)
  - `:248` `<ProblemsButton />`
  - `:249–258` Preview toggle (`preview-button`, label + `pi-eye`, `v-if="mode
    !== 'tablet'"`, severity flips with `editor.previewVisible`) — unchanged
  - `:259` `<ExportMenu />` — unchanged
  - `:260–264` `<CentralDrawerToggle v-if="central.hasServers &&
    !embed.active" ... testid="central-button" />` — **gains a zero-state
    sibling** for the `!central.hasServers` case
  - `:265–272` the ⋮ `Menu` (`editor-more`) — **retired**; its `moreItems`
    (`:219–224`: Form settings/Translations/Choice lists/Attachments, each
    setting `editor.activeDialog`) relocate to the new `#title-actions` Form
    menu, unchanged in content and rendered label text.
- **`src/components/shell/ProblemsButton.vue`** — the "Ready"/error-count
  chip. `:82–93` is the trigger `<Button>` (testid `problems-button`,
  `:label`/`:icon` driven by `form.errorCount`/`form.warningCount`/
  `form.issues`); `:94–118` is the `Popover` body (`problems-list`,
  `problem-row`, `problem-location`). Pinned by
  `tests/component/problems-button.spec.ts` (exact severity classes, icon
  classes, and "Ready"/count text — see `standards.md`).
- **`src/components/central/CentralDrawerToggle.vue`** — the shared
  icon+label Central toggle (`pi-cloud`, `central.drawer.toggle`/
  `tooltipShow`/`tooltipHide`), used by both `FormEditorView.vue`
  (`central-button`) and `FormLibraryView.vue` (`library-central-button`).
  **CORRECTION vs. the backlog doc:** `central-button` has **no** e2e or
  component test consumer anywhere in the repo (only
  `library-central-button` does, via `FormLibraryView.vue:176`); relocating,
  relabelling, or adding a sibling zero-state button next to it is fully
  test-safe.
- **`src/components/shell/EditorTabs.vue`** — the tablet-mode second-row pane
  switcher (canvas/properties/preview). Confirmed **unchanged** by this spec
  — the resolved ruling ships the header reshuffle identically in tablet
  mode rather than folding the Form menu into this row.
- **`src/components/shell/UndoRedoButtons.vue`** — unchanged; stays first in
  the right-hand cluster order, immediately after the (removed) `#actions`
  boundary.
- **`src/components/shell/ThemeToggle.vue`** — unchanged component; only its
  *mount point* in `AppHeader.vue` is removed. `FormLibraryView.vue:184`
  (`<ThemeToggle v-if="!embed.active" />`) already renders it unconditionally
  in the library header — no new code needed there.
- **`src/views/FormLibraryView.vue`** — reference only, not modified beyond
  what's already there: `:173–177` shows the `library-central-button` pattern
  (`CentralDrawerToggle` gated on `central.hasServers && !embed.active`) that
  the editor's zero-state button deliberately does **not** copy (library
  stays out of scope per the backlog's "Out of scope" list).
- **`src/views/SettingsView.vue`** / **`src/components/central/
  CentralServersSection.vue`** — the actual "add a Central server" UI
  (`settings-central` section, `:226` in `CentralServersSection.vue`,
  mounted at `SettingsView.vue:232`). This is where the zero-state Central
  button routes to; `CentralDrawer.vue` itself has **no** built-in add-server
  affordance (confirmed by reading it in full — its `NewDestinationForm`/
  `CentralServerPicker` assume at least one registered server and only show
  an empty-message placeholder otherwise), which is why the zero-state
  button navigates to Settings rather than opening the per-form drawer.
- **Icon availability** — confirmed present in
  `node_modules/primeicons/raw-svg/`: `palette.svg`, `chevron-down.svg`,
  `angle-down.svg`, `caret-down.svg` (chevron-down chosen for the Form menu's
  trailing disclosure icon).
- **Tests — exact e2e consumers of the retired `editor-more` testid**
  (verified via `grep`, 2026-07-16):
  - `tests/e2e/dataset-tooling.spec.ts:61–62`
  - `tests/e2e/translations.spec.ts:7–8, 35–36, 74–75, 147–148`
  - `tests/e2e/entities.spec.ts:14–15`
  - `tests/e2e/guides.spec.ts:7–8`
  - `tests/e2e/workspace-archive.spec.ts:10–11, 79–80`
  - `'Choice lists'` label has **no** e2e consumer (no test opens that menu
    item by name); leave its text unchanged regardless.
- **Tests — theme toggle** — `tests/e2e/theming.spec.ts`'s "a chosen dark
  scheme persists across a reload" test (~`:76–83`) clicks `theme-toggle`
  **from the editor header** (`createForm(page, 'Persist Flow')` then
  `page.getByTestId('theme-toggle')`); this must be rewritten to toggle from
  the library header, since the toggle no longer renders in the editor.
  `tests/component/theme-toggle.spec.ts` mounts `ThemeToggle.vue` directly
  (no host chrome) — confirmed **no change needed** there.
- **Tests — palette/preview/central testids unaffected** —
  `tests/e2e/layout.spec.ts:50,71` (`palette-toggle`) and roughly a dozen
  specs clicking `preview-button` (`logic-builder.spec.ts`,
  `preview.spec.ts`, `dataset-upload.spec.ts`, `pwa.spec.ts`,
  `preview-presets.spec.ts`, `templates.spec.ts`) keep working unmodified —
  neither testid nor click behaviour changes, only the palette's icon glyph.
- **Coordination note** — `tests/e2e/dataset-tooling.spec.ts` and
  `tests/e2e/workspace-archive.spec.ts` are **also** modified by the
  attachment-manager stream (different lines/assertions in the same files).
  Land this toolbar change first; the attachment-manager stream rebases onto
  it and reconciles both files rather than the reverse, to avoid the two
  streams racing on the same `editor-more` → `form-menu` rename.

## Related delivered specs worth reading

- `docs/specs/2026-07-15-1219-central-ux-enhancement/` — delivered the
  current `CentralDrawerToggle`/`CentralDrawer` shape this change reuses
  as-is (icon+label toggle, `aria-pressed`, drawer stays non-modal). Its
  `user-guide.md` "Manual test scenarios" section is the template this
  spec's own `user-guide.md` follows.
- `docs/specs/2026-07-13-1840-theming/` — the theme/accent system
  (`ThemeToggle.vue`, the `ui` store's `theme`/`accent`, the no-FOUC inline
  script) this change relocates but does not modify.
- `docs/specs/2026-07-10-1810-ui-critique-fixes/` and
  `docs/specs/2026-07-10-2342-canvas-card-footer-actions/` — prior
  interface-craft-driven toolbar/canvas polish passes; useful precedent for
  how a critique-sourced reshuffle was scoped and verified previously.
- `docs/specs/backlog/attachment-manager.md` — the sibling backlog item that
  reworks the Attachments dialog's *contents* (explicitly out of scope here)
  and shares two e2e files with this change (see the coordination note
  above).
