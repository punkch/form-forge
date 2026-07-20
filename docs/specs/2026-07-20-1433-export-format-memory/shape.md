# Export Format Memory — Shaping Notes

## Scope

The editor toolbar's export `SplitButton` (`src/components/importexport/
ExportMenu.vue`) should **remember the last export format a user chose, per
form**, and make that choice the primary click next time. Concretely:

1. The primary button states the format it will export (compact labels:
   "Export · XForm", "Export · XLSForm", "Export · ZIP (XForm)",
   "Export · ZIP (XLSForm)").
2. The dropdown lists **all** enabled formats (today it hides the primary via
   `enabledActions.slice(1)`), keeps the readiness-summary line at the top, and
   marks the active/remembered format.
3. Picking a format from the dropdown runs it **and** makes it the remembered
   primary.
4. Memory is per form, persisted, and rides the workspace backup.

## Decisions

- **Stable format ids:** `'xform' | 'xlsform' | 'zip-xform' | 'zip-xlsform'`
  (`ExportFormatId`), defined and owned by the ui store (which owns the
  persisted map), imported by `ExportMenu.vue`. Keeps the persisted type and its
  guard in one place; no component→store type inversion.
- **Storage:** `lastExportFormat: Record<string, ExportFormatId>` in the ui
  store, keyed by Dexie `recordId`. **Additive, guarded, persisted** — no
  `STORAGE_VERSION` bump (a bump makes `loadPersisted` drop the whole blob and
  wipe every saved pref). Copies the `hiddenBundledTemplates` pattern verbatim.
- **Backup:** rides `preferences.json` automatically via `exportPreferences` /
  `applyPreferences`. No `WORKSPACE_FORMAT_VERSION` bump (additive optional
  content inside an existing section).
- **Resolution / fallback:** primary = the enabled action whose id matches the
  remembered format; else `enabledActions[0]`. This single expression also
  covers the **embed** case — if the host disabled the remembered format, it is
  absent from `enabledActions`, so the `.find(...) ?? [0]` falls back to the
  first enabled action, preserving the existing promotion behaviour. No separate
  `embed.exportEnabled` re-check is needed in `ExportMenu` beyond what already
  builds `enabledActions`.
- **Write points:** picking from the dropdown writes memory; clicking the
  primary does not (it is already the remembered format). Memory is written even
  if the export is then blocked by validation errors — it reflects the user's
  chosen format, not a successful download.
- **Pruning:** on form deletion, prune the map entry in the **workspace store's
  `deleteForm`** (the single user-facing deletion chokepoint). The embed
  bridge's direct `forms-repo.deleteForm` (replace-form path) is intentionally
  left un-pruned — a stale entry keyed by a dead recordId is harmless and never
  read; coupling the bridge to the ui store isn't worth it.
- **Active-format affordance:** the repo has **no** `#item` slot precedent for
  PrimeVue menus (all menus use the plain `model` array, and the readiness
  summary uses a *function* label the slot would complicate). So the active
  format's menu item is marked by swapping its leading icon to `pi pi-check` and
  adding an `export-format-active` class (PrimeVue applies a model item's
  `class` to the item element) — a recognised "selected" affordance, testable by
  class, no slot. This is the "equivalent PrimeVue menu-item affordance" the
  brief allows.
- **Motion:** a subtle primary-label opacity crossfade (0.35→1) over
  `--builder-motion-duration-s` (120 ms, ≤ 160 ms), retriggered by a
  class-toggle watch on the resolved format id, defined in a scoped
  `@keyframes` in `ExportMenu.vue` using only `--builder-motion-*` tokens. The
  global `prefers-reduced-motion` blanket in `builder.css` neutralises it — no
  per-component gate. PrimeVue's `SplitButton` exposes no label slot, so the
  crossfade is applied to `:deep(.p-button-label)` via a root class rather than a
  Vue `<Transition>`.
- **i18n:** add four compact primary keys + a new `xformItem` dropdown label to
  `importExport.export` in en/fr/es **in lockstep** (`MessageSchema = typeof en`
  → typecheck fails on drift). Remove the now-unused `export.label` ("Export")
  key from all three. All other export strings stay byte-identical (tests
  assert them).
- **Tests coupled to the old label:** three e2e clicks match the primary by
  `name: 'Export'`; they switch to `getByRole('button').first()` (the primary
  action button, label-independent). `entities.spec.ts` / `embed.spec.ts` need
  no change.

## Context

- **Visuals:** None provided.
- **References:** `ExportMenu.vue` (control being changed), `ui.ts` +
  `ui.spec.ts` (`hiddenBundledTemplates` guarded-field pattern to copy),
  `embed.ts` (`exportEnabled`), `workspace.ts` (deletion chokepoint), the en/fr/
  es `importExport.json` catalogs, `builder.css` (motion tokens + fr/es compact
  header rules), and the e2e specs that click the export button. See
  `references.md`.
- **Product alignment:** Client-side-only Vue 3.5 SPA; everything stays in the
  browser (localStorage pref + workspace-backup round-trip). This is a
  Phase-2/3 export-UX polish, consistent with the "device UI preferences ride
  the backup" work already delivered (format v2 preferences.json).

## Skills & Conventions Applied

- **CLAUDE.md hard invariants** — additive guarded persisted field (no
  `STORAGE_VERSION`/`WORKSPACE_FORMAT_VERSION` bump), fr/es i18n lockstep,
  byte-stable existing English, motion only via `--builder-motion-*` tokens, no
  undefined CSS custom properties (stylelint), preserve `data-testid`s. See
  `standards.md`.
- No external plugin skill is strictly required; the work is a localized
  Vue/Pinia/i18n change governed by the repo's own invariants.
