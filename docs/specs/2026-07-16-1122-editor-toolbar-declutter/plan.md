# Editor toolbar de-clutter & form-tools promotion — implementation plan

## Context

The editor header (`AppHeader.vue` + `FormEditorView.vue`'s `#actions` slot)
currently exposes up to 12 interactive targets in one undifferentiated row —
back, undo, redo, palette toggle, Problems, Preview, Export (2 targets),
Central (when servers exist), an unlabeled ⋮ overflow holding the four
form-content tools (Form settings, Translations, Choice lists, Attachments),
theme toggle, help — with uniform icon-only styling and no visual grouping.
An interface-craft critique (2026-07-16, over a live agent-browser session at
1440×900) found this an information-architecture inversion: transient view
toggles and a device preference (theme) hold prime toolbar space while
persistent, frequently-used form-content tools are buried behind an anonymous
kebab. This plan re-groups the header into labelled, visually separated
clusters, promotes the four form-tools items out of the kebab into a labelled
"Form" menu next to the title, relocates the theme toggle out of the editor
entirely, re-glyphs the palette toggle, gives `ProblemsButton` an actionable
affordance, and adds a zero-state Central entry point. It is a pure
Vue-shell/CSS/i18n change — no store, persistence, or `src/core/` code is
touched. See `shape.md` for the full rationale and resolved decisions, and
`standards.md`/`references.md` for the invariants and exact file:line
anchors this plan relies on.

## Resolved decisions (binding — see `shape.md` for rationale)

1. Theme toggle leaves the editor header entirely; stays in the library
   header (already there, unconditionally, no change needed) and Settings.
2. The ⋮ kebab is retired; its four items move to a labelled "Form" menu.
3. Undo/redo stay in the header, first in the right-hand cluster order.
4. Export and Central stay as siblings in an output cluster (no merge).
5. The Form menu sits on the **left**, next to the title; label copy is
   **"Form"**.
6. Preview keeps its labelled button; palette stays icon-only but gets the
   `pi-palette` glyph.
7. Central gets a **zero-state** button (not hidden) when no server is
   registered; it routes to Settings' Central-servers section.
8. Tablet mode ships identically to desktop in this same change — no
   EditorTabs folding.
9. No keyboard shortcuts/descriptions on menu items (deferred).

Clustering, left → right: **[Form menu, next to the title] ‖ [history:
undo/redo] · [view: palette, preview] · [status: Problems] · [output: Export,
Central] · [meta: help]**.

## Task 1 — `ToolbarSeparator.vue`: shared cluster divider

**Build:** a tiny presentational component, a vertical hairline divider used
between clusters in the header's right-hand action row.

**Create** `src/components/shell/ToolbarSeparator.vue`:

```vue
<template>
  <span class="toolbar-separator" aria-hidden="true" />
</template>

<style scoped>
.toolbar-separator {
  align-self: stretch;
  width: 1px;
  margin: var(--odk-spacing-s) 0;
  background: var(--odk-border-color);
  flex-shrink: 0;
}
</style>
```

No props, no slots — purely visual, `aria-hidden` so it never reaches the
accessibility tree. No dedicated unit test is needed (a one-line
presentational atom with no logic); it is exercised implicitly by the
`/agent-browser` visual pass in Task 6.

## Task 2 — `AppHeader.vue`: drop the theme toggle, add the `#title-actions` slot

**Modify** `src/components/shell/AppHeader.vue`:

- Remove the `import ThemeToggle from '@/components/shell/ThemeToggle.vue'`
  line and the `<ThemeToggle v-if="!embed.active" />` element (currently
  right before the help button). The library header already renders its own
  `ThemeToggle` unconditionally (`FormLibraryView.vue:184`) — nothing else
  needs to change for the toggle to keep working there.
- Add a new named slot **immediately after the title span, before
  `<SaveIndicator>`**:

  ```vue
  <span class="app-header-title" data-testid="editor-form-title">
    {{ form.doc?.settings.formTitle ?? '' }}
  </span>
  <slot name="title-actions" />
  <SaveIndicator :state="form.saveState" />
  ```

- In `.app-header-left`'s CSS, keep the existing `gap` from
  `--odk-spacing-m`; no other CSS change is required for this slot itself
  (its content, the Form menu button, is intrinsically sized). If the
  `/agent-browser` pass at narrow widths (Task 6) shows the button
  compressing before the title finishes truncating, add `flex-shrink: 0` to
  the slotted button's wrapper — call this out explicitly if it comes up,
  don't pre-guess it.
- Wrap the existing `<slot name="actions" />` with a `<ToolbarSeparator />`
  on **each side**, so the boundaries between undo/redo, the view/status/
  output clusters supplied by the caller, and the help button all get a
  divider "for free" from the shared shell:

  ```vue
  <div class="app-header-right">
    <UndoRedoButtons />
    <ToolbarSeparator />
    <slot name="actions" />
    <ToolbarSeparator />
    <Button ... data-testid="help-button" ... />
  </div>
  ```

  Import `ToolbarSeparator` alongside the other shell imports.

**Tests:** no dedicated component test exists for `AppHeader.vue` today (it's
exercised only through `FormEditorView.vue`'s e2e coverage) — none is added;
the removal of the theme toggle is covered by the theming e2e rewrite in
Task 5, and the new slot is covered by `FormEditorView.vue`'s own e2e
coverage (Task 3) plus the visual pass (Task 6).

## Task 3 — `FormEditorView.vue`: retire the kebab, build the Form menu, re-glyph, cluster, zero-state Central

**Modify** `src/views/FormEditorView.vue`.

1. **Rename the kebab's model into the Form menu.** Replace:

   ```js
   const moreMenu = ref<InstanceType<typeof Menu> | null>(null)
   const moreItems = computed(() => [ ... four items ... ])
   ```

   with:

   ```js
   const formMenu = ref<InstanceType<typeof Menu> | null>(null)
   const formMenuItems = computed(() => [
     { label: t('shell.editor.formSettings'), icon: 'pi pi-cog', command: () => { editor.activeDialog = 'settings' } },
     { label: t('shell.editor.translations'), icon: 'pi pi-language', command: () => { editor.activeDialog = 'translations' } },
     { label: t('shell.editor.choiceLists'), icon: 'pi pi-list', command: () => { editor.activeDialog = 'choice-lists' } },
     { label: t('shell.editor.attachments'), icon: 'pi pi-paperclip', command: () => { editor.activeDialog = 'attachments' } },
   ])
   ```

   Item content/commands/labels are byte-identical to today — only the
   variable names and the trigger change.

2. **Move the trigger out of `#actions` into a new `#title-actions` template**
   on the `<AppHeader>` usage, rendered **before** `#actions`:

   ```vue
   <AppHeader>
     <template #title-actions>
       <Button
         :label="t('shell.editor.formMenu')"
         icon="pi pi-chevron-down"
         icon-pos="right"
         severity="secondary"
         text
         :aria-label="t('shell.editor.formMenu')"
         data-testid="form-menu"
         @click="formMenu?.toggle($event)"
       />
       <Menu ref="formMenu" :model="formMenuItems" popup />
     </template>
     <template #actions>
       ...
     </template>
   </AppHeader>
   ```

3. **Re-glyph the palette toggle**: change `icon="pi pi-objects-column"` to
   `icon="pi pi-palette"`. No other prop changes (severity/tooltip/testid all
   stay).

4. **Cluster the remaining `#actions` content** with `ToolbarSeparator`
   between the view cluster and Problems, and between Problems and the
   output cluster (import `ToolbarSeparator` from
   `@/components/shell/ToolbarSeparator.vue`):

   ```vue
   <template #actions>
     <Button ... data-testid="palette-toggle" icon="pi pi-palette" ... />
     <Button
       v-if="mode !== 'tablet'"
       ...
       data-testid="preview-button"
       ...
     />
     <ToolbarSeparator />
     <ProblemsButton />
     <ToolbarSeparator />
     <ExportMenu />
     <CentralDrawerToggle
       v-if="central.hasServers && !embed.active"
       v-model:open="editor.centralDrawerOpen"
       testid="central-button"
     />
     <Button
       v-else-if="!embed.active"
       v-tooltip.bottom="t('central.drawer.tooltipAddServer')"
       icon="pi pi-cloud"
       :label="t('central.drawer.toggle')"
       severity="secondary"
       :aria-label="t('central.drawer.tooltipAddServer')"
       data-testid="central-zero-state"
       @click="goToCentralSettings"
     />
   </template>
   ```

   Note the ⋮ `Button` (`editor-more`) and its `<Menu ref="moreMenu" ...>`
   are **deleted** entirely from `#actions` — they've moved to
   `#title-actions` (step 2).

5. **Add the zero-state navigation handler**, near the other top-level
   handlers (e.g. below `beforeUnload`/`onGlobalKeydown`):

   ```js
   const goToCentralSettings = async (): Promise<void> => {
     await router.push({ name: 'settings' })
     await nextTick()
     document.querySelector('[data-testid="settings-central"]')
       ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
   }
   ```

   `nextTick` is already importable from `vue` (add it to the existing `vue`
   import alongside `computed, onBeforeUnmount, onMounted, ref, watch`).
   `router` is already in scope. This deliberately does **not** touch
   `CentralDrawer.vue` or teach it a new empty state — it reuses the existing
   "Add server" flow in `CentralServersSection.vue` (mounted at
   `SettingsView.vue:232`, section testid `settings-central`), keeping the
   Central drawer itself out of scope per `shape.md`.

**i18n:** add `shell.editor.formMenu` ("Form") and
`central.drawer.tooltipAddServer` ("No Central servers yet — add one in
Settings.") — see Task 4. Remove `shell.editor.moreTools` (no longer
rendered anywhere).

**Tests:** no component test exists for `FormEditorView.vue` (it's
e2e-covered only); the e2e updates are Task 5. Add no new component test —
follow existing convention.

## Task 4 — i18n: new/removed `shell.editor.*` and `central.drawer.*` keys

**Modify** `src/i18n/locales/en/shell.json`:

- Add `"formMenu": "Form"` under `shell.editor`.
- Remove `"moreTools": "More form tools"` (no longer rendered — the kebab
  button that used it is deleted).
- Leave `formSettings`, `translations`, `choiceLists`, `attachments`
  unchanged (byte-identical labels, just a new trigger).

**Modify** `src/i18n/locales/en/central.json`:

- Add `"tooltipAddServer": "No Central servers yet — add one in Settings."`
  alongside the existing `drawer.toggle`/`tooltipShow`/`tooltipHide` keys.

Run `pnpm typecheck` (the typed `MessageSchema` picks up new/removed keys) and
`pnpm lint` (the `no-missing-keys` eslint rule) after this task — both must
be clean before moving on, since Tasks 3's templates reference these keys.

## Task 5 — `ProblemsButton.vue`: actionable affordance (chevron)

**Modify** `src/components/shell/ProblemsButton.vue`.

Replace the trigger `<Button icon=... :label=... />` (self-closing, props
only) with a `<Button>` that keeps the exact same `severity`/`text`/
`aria-label`/`data-testid`/`@click` props but renders its content via the
**default slot**, so a trailing chevron can be added without touching any of
the assertions in `tests/component/problems-button.spec.ts`:

```vue
<Button
  v-tooltip.bottom="t('shell.problems.title')"
  :severity="form.errorCount > 0 ? 'danger' : form.issues.length === 0 ? 'success' : 'secondary'"
  text
  :aria-label="t('shell.problems.title')"
  data-testid="problems-button"
  @click="toggle"
>
  <i :class="form.errorCount > 0 ? 'pi pi-times-circle' : form.warningCount > 0 ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'" />
  <span>{{ form.issues.length > 0 ? String(form.issues.length) : t('shell.problems.ready') }}</span>
  <i class="pi pi-chevron-down problems-chevron" aria-hidden="true" />
</Button>
```

Add a scoped style for the new chevron (small, muted, doesn't compete with
the status icon):

```css
.problems-chevron {
  margin-inline-start: 2px;
  font-size: 0.7rem;
  opacity: 0.65;
}
```

**Do not** change the `:icon`/`:label` props to anything else, don't rename
`data-testid="problems-button"`, and don't alter the severity ternary — the
existing four assertions in `tests/component/problems-button.spec.ts`
(`toContain('2')`/`not.toContain('Ready')`, `p-button-danger`/
`p-button-success`/`p-button-secondary` classes, `.pi-times-circle`/
`.pi-exclamation-triangle`/`.pi-check-circle` icon presence, and `'Ready'`
text) all still pass unmodified against this slot-based markup — verify this
by running `pnpm test tests/component/problems-button.spec.ts` after the
change (no test file edits expected; if any assertion breaks, the markup is
wrong, not the test).

## Task 6 — e2e test migration: retired `editor-more` → `form-menu`

Update every consumer of the retired `editor-more` testid to `form-menu`
(item labels stay the same, only the trigger testid changes):

- `tests/e2e/dataset-tooling.spec.ts:61` —
  `page.getByTestId('editor-more')` → `page.getByTestId('form-menu')`
  (line 62's `getByRole('menuitem', { name: 'Attachments' })` is unchanged).
- `tests/e2e/translations.spec.ts:7, 35, 74, 147` — same substitution, four
  occurrences (each followed by `getByRole('menuitem', { name: 'Translations' })`,
  unchanged).
- `tests/e2e/entities.spec.ts:14` — same substitution (followed by
  `getByRole('menuitem', { name: 'Form settings' })`, unchanged). Line 59's
  `'XLSForm (.xlsx)'` menuitem is the Export menu — unrelated, leave as-is.
- `tests/e2e/guides.spec.ts:7` — same substitution (followed by
  `getByRole('menuitem', { name: 'Translations' })`, unchanged).
- `tests/e2e/workspace-archive.spec.ts:10, 79` — same substitution (both
  followed by `getByRole('menuitem', { name: 'Attachments' })`, unchanged).
  Line 141's `'Export archive'` menuitem is the library form-card row menu —
  unrelated, leave as-is.

Do a final repo-wide check after editing:
`grep -rn "editor-more" tests/ src/` must return nothing.

**Coordination:** `tests/e2e/dataset-tooling.spec.ts` and
`tests/e2e/workspace-archive.spec.ts` are also touched by the
attachment-manager stream (different lines). Land this rename first; the
attachment-manager stream rebases onto it and reconciles both files.

## Task 7 — e2e test migration: theme toggle moves to the library header

**Modify** `tests/e2e/theming.spec.ts`'s "a chosen dark scheme persists
across a reload" test. It currently creates a form and clicks
`theme-toggle` from the editor header (which no longer renders it). Rewrite
it to exercise the library header instead — the preference is a global
device setting, so there's no need to create a form at all:

```ts
test('a chosen dark scheme persists across a reload', async ({ page }) => {
  // Go through the real header toggle so the store's persist path runs.
  await page.goto('/#/')
  const toggle = page.getByTestId('theme-toggle')

  // The toggle cycles system → light → dark. From a fresh (unseeded) context
  // the preference starts at `system`, so two clicks land on an explicit dark
  // preference that resolves to dark regardless of the OS colour scheme.
  await toggle.click()
  await toggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-ff-theme', 'dark')

  await page.reload()
  // The inline bootstrap re-applies it from localStorage on the next boot.
  await expect(page.locator('html')).toHaveAttribute('data-ff-theme', 'dark')
})
```

Drop the now-unused `createForm`/`addQuestion` import if this was the only
test in the file needing `createForm` for this particular test (check the
other tests in the same `describe` block — several still use `createForm`
directly, e.g. the "clobber guard" test — so the import itself likely stays;
only this test's body changes).

No other test in `tests/e2e/theming.spec.ts` needs touching (the other three
tests seed the theme via `localStorage`/settings page, not via the editor
header). `tests/component/theme-toggle.spec.ts` needs **no** change — it
mounts `ThemeToggle.vue` directly, with no host chrome.

## Task 8 — verify no other testid regressions

Run a final grep sweep before moving to verification:

```bash
grep -rn "editor-more\b" tests/ src/            # must be empty
grep -rn "moreTools" src/i18n/ src/views/        # must be empty
grep -rn "'theme-toggle'" tests/e2e/             # only theming.spec.ts's rewritten line
```

Confirm `palette-toggle`, `preview-button`, `central-button`,
`library-central-button`, `export-button`, `help-button`, `back-to-library`
all remain untouched testids in the source (they keep their names; only
`central-button`'s *sibling* zero-state gets a new testid,
`central-zero-state`).

## Verification

Automated:

```bash
pnpm lint            # eslint (no-missing-keys) + stylelint (undefined-CSS-var guard)
pnpm typecheck        # vue-tsc — typed MessageSchema picks up the i18n key changes
pnpm test             # unit + component — confirms problems-button.spec.ts still passes unmodified
pnpm test:e2e         # playwright — confirms every rewritten testid/label path in Tasks 6–7
```

Manual, per the established process (`shape.md` → Skills & conventions):

1. **`/agent-browser`** pass against the built app (`pnpm build && pnpm
   preview`, or the e2e harness on `:4173`), at three widths:
   - **Wide, 1440×900** — full header, both with a registered Central server
     (normal `central-button`) and with none (`central-zero-state`).
   - **Laptop, 1100×800** — palette becomes a drawer; confirm the cluster
     grouping and separators still read cleanly at this width.
   - **Tablet, 900×800** — confirm `EditorTabs` still renders unchanged below
     the header, and the header itself carries the identical reshuffle (Form
     menu on the left, clustered `#actions` on the right) per decision 8.
   Screenshot each of the six combinations (3 widths × with/without a
   Central server) into `docs/verification/2026-07-16-editor-toolbar-declutter/`.
2. **`/interface-craft`** critique over the same screenshots — confirm the
   six original critique findings (IA inversion, no grouping, affordance
   mismatch, cryptic glyphs, disclosure inconsistency, Central
   discoverability) are each resolved, and that no new visual regression was
   introduced (title truncation at narrow widths, separator alignment,
   chevron legibility on the Problems button in both light and dark theme).
3. Manually exercise the zero-state Central flow at least once: create a
   fresh form with no registered Central server, click `central-zero-state`,
   confirm it lands on `/#/settings` with the `settings-central` section
   scrolled into view.
4. Manually exercise the Form menu: click `form-menu`, confirm all four
   items open their respective dialogs (`settings`, `translations`,
   `choice-lists`, `attachments`) exactly as the retired ⋮ did.
5. Log the pass (screenshots + a short write-up of what was checked and any
   follow-up findings) to `docs/verification/`, following the style of
   `docs/specs/2026-07-15-1219-central-ux-enhancement/user-guide.md`'s
   "Manual test scenarios" section — this spec's own `user-guide.md` supplies
   the scenario list (S1–S6) to run through.

Once automated + manual verification pass, run `/code-review` (five lenses,
no plan mode) over the diff and fix findings immediately, then commit as a
single conventional commit (`feat(editor): regroup toolbar into labelled
clusters, promote form tools out of the kebab` or similar — exact wording at
commit time).
