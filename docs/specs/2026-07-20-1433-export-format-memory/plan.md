# Export Format Memory — Implementation Plan

> Full plan, saved verbatim from shaping. Do NOT summarize. Sonnet-tier
> implementation agents should be able to execute each task independently from
> this file plus `standards.md` / `references.md`.

## Summary

The editor toolbar's export control is a PrimeVue `SplitButton`
(`src/components/importexport/ExportMenu.vue`). Today its **primary** action is
always "Export" (XForm XML), and its dropdown lists the *other* three formats
(`enabledActions.slice(1)`). This change makes the control **remember the last
format the user exported, per form**, surface that format's name on the primary
button, and list **all** enabled formats in the dropdown with the active one
marked.

Four stable export format ids:

| `ExportFormatId` | Primary label (en) | Dropdown label (en)              | Icon             | Runs                       |
| ---------------- | ------------------ | -------------------------------- | ---------------- | -------------------------- |
| `xform`          | `Export · XForm`         | `XForm XML`                      | `pi pi-download`   | `exportXml()`              |
| `xlsform`        | `Export · XLSForm`       | `XLSForm (.xlsx)`               | `pi pi-file-excel` | `exportXlsx()`             |
| `zip-xform`      | `Export · ZIP (XForm)`   | `ZIP · XForm XML + attachments` | `pi pi-box`        | `exportZipBundle('xform')` |
| `zip-xlsform`    | `Export · ZIP (XLSForm)` | `ZIP · XLSForm + attachments`   | `pi pi-box`        | `exportZipBundle('xlsform')` |

Memory is a `lastExportFormat: Record<string, ExportFormatId>` map in the ui
store, keyed by the form's Dexie `recordId`. It is an **additive, guarded,
persisted** field (never bump `STORAGE_VERSION`) and rides the workspace
backup's `preferences.json` via `exportPreferences` / `applyPreferences`.

### Resolution rules (single source of truth for behaviour)

- **Primary** = the enabled action whose `id` equals the remembered format for
  the current form; if there is no memory, or the remembered format is not in
  the currently-enabled set (embed host disabled it), fall back to the **first
  enabled action** (`enabledActions[0]` — which is `xform` unless the host hid
  it, exactly the current promotion behaviour).
- **Dropdown** = readiness-summary line + separator + **every** enabled action
  (no more `.slice(1)`), with the action matching the resolved primary marked
  active (a `pi pi-check` glyph replacing its format icon + an
  `export-format-active` class).
- **Picking a format from the dropdown** writes the memory
  (`ui.setLastExportFormat(recordId, id)`) **and** runs that export. The primary
  click just runs the primary export (it is already the remembered format, so no
  write is needed).
- **Deleting a form** prunes its map entry (`ui.forgetExportFormat(id)`).

---

## Task 1: Save Spec Documentation

Create `docs/specs/2026-07-20-1433-export-format-memory/` with:

- **plan.md** — this file (full plan, not summarized).
- **shape.md** — scope, decisions, context.
- **standards.md** — repo invariants that bind this work.
- **references.md** — the files studied and what to borrow.
- **user-guide.md** — user-facing behaviour + manual test scenarios.
- (no `visuals/` — none provided.)

This task is complete when the folder exists with those files.

---

## Task 2: ui store — persisted per-form `lastExportFormat` map

**File:** `src/stores/ui.ts` (+ tests in `src/stores/ui.spec.ts`).

This is a carbon copy of the existing `hiddenBundledTemplates` guarded-field
pattern (array → replace with a validated `Record`). Follow that pattern
exactly; it already proves the "additive guarded field, no `STORAGE_VERSION`
bump" contract (see `ui.spec.ts` "pins the storage version at 1" test).

1. **Export the format-id type + guard** near the top of the module (after the
   `PreviewPreset` / `PanelName` types):

   ```ts
   export type ExportFormatId = 'xform' | 'xlsform' | 'zip-xform' | 'zip-xlsform'

   const EXPORT_FORMAT_IDS: readonly ExportFormatId[] =
     ['xform', 'xlsform', 'zip-xform', 'zip-xlsform']

   export const isExportFormatId = (v: unknown): v is ExportFormatId =>
     typeof v === 'string' && (EXPORT_FORMAT_IDS as readonly string[]).includes(v)

   /** Keep only `{ formId: ExportFormatId }` entries with string keys and a
    * recognised format value. Unknown formats / non-string values dropped. */
   const sanitizeExportFormatMap = (raw: unknown): Record<string, ExportFormatId> => {
     if (typeof raw !== 'object' || raw === null) return {}
     const out: Record<string, ExportFormatId> = {}
     for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
       if (isExportFormatId(value)) out[key] = value
     }
     return out
   }
   ```

2. **Add to `PersistedUiState`** (interface, ~line 52):
   ```ts
   lastExportFormat: Record<string, ExportFormatId>
   ```
   `UiPreferences` is `Omit<PersistedUiState, 'version'>`, so it picks this up
   automatically — no separate edit there.

3. **Init the ref** alongside the other refs (after `hiddenBundledTemplates`):
   ```ts
   /** Last export format chosen per form (keyed by Dexie recordId). */
   const lastExportFormat = ref<Record<string, ExportFormatId>>(
     sanitizeExportFormatMap(persisted.lastExportFormat)
   )
   ```

4. **Actions** (near `hideBundledTemplate` etc.):
   ```ts
   const setLastExportFormat = (formId: string, id: ExportFormatId): void => {
     lastExportFormat.value = { ...lastExportFormat.value, [formId]: id }
   }

   const getLastExportFormat = (formId: string): ExportFormatId | null =>
     lastExportFormat.value[formId] ?? null

   const forgetExportFormat = (formId: string): void => {
     if (!(formId in lastExportFormat.value)) return
     const next = { ...lastExportFormat.value }
     delete next[formId]
     lastExportFormat.value = next
   }
   ```

5. **`exportPreferences()`** — add `lastExportFormat: { ...lastExportFormat.value }`.

6. **`applyPreferences(raw)`** — add, mirroring the array-guard style:
   ```ts
   if (typeof p.lastExportFormat === 'object' && p.lastExportFormat !== null) {
     lastExportFormat.value = sanitizeExportFormatMap(p.lastExportFormat)
   }
   ```

7. **Persist watch** — add `lastExportFormat` to the `watch([...])` source array
   AND to the serialized `state` object literal inside the watcher (the watch is
   `{ deep: true }`, so nested key changes persist).

8. **`return { ... }`** — expose `lastExportFormat`, `setLastExportFormat`,
   `getLastExportFormat`, `forgetExportFormat`.

**Tests (`src/stores/ui.spec.ts`)** — add a new `describe('ui store last export
format')` block mirroring the hidden-templates block:
- set/get: `setLastExportFormat('rec1','xlsform')` → `getLastExportFormat('rec1')` is `'xlsform'`; unknown id → `null`.
- overwrite: a second `setLastExportFormat('rec1','zip-xform')` replaces.
- forget: `forgetExportFormat('rec1')` → `getLastExportFormat('rec1')` is `null`; forgetting an absent id is a no-op.
- persistence: after a set + `nextTick`, the `STORAGE_KEY` blob's
  `lastExportFormat` carries the entry; a fresh store restores it.
- guard on load: a persisted blob with
  `lastExportFormat: { good: 'xlsform', bad: 'pdf', n: 5 }` restores only
  `{ good: 'xlsform' }`.
- version pin: a `version: 1` blob with a `lastExportFormat` entry still
  restores (rides v1, no bump) — mirror the existing "pins the storage version
  at 1" assertion.
- round trip: `exportPreferences()` carries the map;
  `applyPreferences(prefs)` on a fresh store adopts it; `applyPreferences` with
  a non-object or malformed map keeps the current value / drops bad entries.

---

## Task 3: prune the map on form deletion

**File:** `src/stores/workspace.ts` (+ `src/stores/workspace.spec.ts`).

`deleteForm` in the workspace store is the single chokepoint for user-initiated
deletion (`FormLibraryView.confirmDelete` → `workspace.deleteForm`). Prune the
memory there:

```ts
import { useUiStore } from '@/stores/ui'
// ...
const deleteForm = async (id: string): Promise<void> => {
  await formsRepo.deleteForm(id)
  useUiStore().forgetExportFormat(id)
}
```

Keep the signature `Promise<void>`. Calling `useUiStore()` inside the action is
the standard Pinia cross-store pattern; it resolves the active pinia at call
time (safe in tests that `setActivePinia`).

> Note: the embed bridge calls `forms-repo.deleteForm` directly
> (`src/embed/bridge.ts:193`, replace-form path) and bypasses this store. A
> stale map entry there is harmless (keyed by a recordId that no longer exists,
> never read, ~40 bytes). Do **not** add pruning to the embed path — it would
> couple the bridge to the ui store for no user-visible benefit.

**Test (`src/stores/workspace.spec.ts`):** after `createForm` then
`deleteForm(record.id)`, assert `useUiStore().getLastExportFormat(record.id)`
is `null` when a memory entry was seeded first
(`useUiStore().setLastExportFormat(record.id, 'xlsform')` before delete).

---

## Task 4: i18n keys (en/fr/es in lockstep)

**Files:** `src/i18n/locales/{en,fr,es}/importExport.json` — the `importExport.export` object.

`MessageSchema = typeof en`, and fr/es `satisfies` it, so **every** key added to
en MUST be added to fr and es or `pnpm typecheck` fails.

1. **Add** the four compact primary labels and the new XForm dropdown label.
   Keep them compact — fr/es have compact-header CSS and the button sits in the
   editor header.

   **en** (`importExport.export`):
   ```json
   "primaryXform": "Export · XForm",
   "primaryXlsform": "Export · XLSForm",
   "primaryZipXform": "Export · ZIP (XForm)",
   "primaryZipXlsform": "Export · ZIP (XLSForm)",
   "xformItem": "XForm XML",
   ```
   **fr:**
   ```json
   "primaryXform": "Exporter · XForm",
   "primaryXlsform": "Exporter · XLSForm",
   "primaryZipXform": "Exporter · ZIP (XForm)",
   "primaryZipXlsform": "Exporter · ZIP (XLSForm)",
   "xformItem": "XForm XML",
   ```
   **es:**
   ```json
   "primaryXform": "Exportar · XForm",
   "primaryXlsform": "Exportar · XLSForm",
   "primaryZipXform": "Exportar · ZIP (XForm)",
   "primaryZipXlsform": "Exportar · ZIP (XLSForm)",
   "xformItem": "XForm XML",
   ```

2. **Remove** the now-unused `export.label` key (`"Export"` / `"Exporter"` /
   `"Exportar"`) from all three catalogs, in lockstep. It was the old primary
   label and has no other reference (grep confirms it is used only at
   `ExportMenu.vue:81`, which Task 5 rewrites). Removing it keeps the catalog
   honest; leaving it is a dead key. Removing a key from en requires removing it
   from fr/es too (they `satisfies typeof en`; an extra key is fine for
   `satisfies` but leave none behind — remove from all three for symmetry).

   > If any missed reference to `importExport.export.label` surfaces at
   > typecheck/lint, prefer restoring the key in all three catalogs over
   > deleting the reference — but the grep says there is none.

Keep the existing `moreOptions`, `xlsformItem`, `zipXformItem`, `zipXlsformItem`,
`blocked*`, `warning*`, `summary*` keys **byte-identical** (tests and the
readiness summary assert them).

---

## Task 5: ExportMenu.vue — memory-aware primary + full dropdown + active marker

**File:** `src/components/importexport/ExportMenu.vue`.

1. **Imports:** add `import { useUiStore } from '@/stores/ui'` and
   `import type { ExportFormatId } from '@/stores/ui'`, plus `watch`,
   `nextTick`, `ref` from `vue` as needed. `const ui = useUiStore()`.

2. **Extend `ExportAction`** with a stable id and a distinct primary label:
   ```ts
   interface ExportAction {
     id: ExportFormatId
     /** Compact label shown on the SplitButton primary (states the format). */
     primaryLabel: string
     /** Full label shown in the dropdown. */
     label: string
     icon: string
     run: () => void
   }
   ```

3. **`enabledActions`** — give every pushed action an `id` + `primaryLabel`,
   using the new i18n keys. The order (xform, xlsform, zip-xform, zip-xlsform) is
   unchanged, so `enabledActions[0]` is still `xform` unless the host hid it:
   ```ts
   const enabledActions = computed<ExportAction[]>(() => {
     const actions: ExportAction[] = []
     if (embed.exportEnabled('xform')) {
       actions.push({ id: 'xform', primaryLabel: t('importExport.export.primaryXform'),
         label: t('importExport.export.xformItem'), icon: 'pi pi-download', run: exportXml })
     }
     if (embed.exportEnabled('xlsform')) {
       actions.push({ id: 'xlsform', primaryLabel: t('importExport.export.primaryXlsform'),
         label: t('importExport.export.xlsformItem'), icon: 'pi pi-file-excel',
         run: () => { void exportXlsx() } })
     }
     if (embed.exportEnabled('zip')) {
       actions.push({ id: 'zip-xform', primaryLabel: t('importExport.export.primaryZipXform'),
         label: t('importExport.export.zipXformItem'), icon: 'pi pi-box',
         run: () => { void exportZipBundle('xform') } })
       actions.push({ id: 'zip-xlsform', primaryLabel: t('importExport.export.primaryZipXlsform'),
         label: t('importExport.export.zipXlsformItem'), icon: 'pi pi-box',
         run: () => { void exportZipBundle('xlsform') } })
     }
     return actions
   })
   ```

4. **`primary`** — resolve via memory, with the embed/no-memory fallback baked
   in (the `.find(...) ?? [0]` handles both):
   ```ts
   const primary = computed<ExportAction | null>(() => {
     const actions = enabledActions.value
     if (actions.length === 0) return null
     const remembered = form.recordId !== null ? ui.getLastExportFormat(form.recordId) : null
     return actions.find((a) => a.id === remembered) ?? actions[0]
   })
   ```

5. **Pick handler** — writes memory then runs:
   ```ts
   const pick = (action: ExportAction): void => {
     if (form.recordId !== null) ui.setLastExportFormat(form.recordId, action.id)
     action.run()
   }
   ```

6. **`items`** — list ALL enabled actions (drop `.slice(1)`), mark the active
   one (check icon replacing the format icon + `export-format-active` class):
   ```ts
   const items = computed(() => [
     { label: readinessSummary, disabled: true },
     { separator: true },
     ...enabledActions.value.map((action) => ({
       label: action.label,
       icon: action.id === primary.value?.id ? 'pi pi-check' : action.icon,
       class: action.id === primary.value?.id ? 'export-format-active' : undefined,
       command: () => { pick(action) },
     })),
   ])
   ```

7. **Template** — primary uses `primaryLabel`; preserve `data-testid="export-button"`:
   ```html
   <SplitButton
     v-if="primary !== null"
     :label="primary.primaryLabel"
     :icon="primary.icon"
     severity="secondary"
     :model="items"
     :class="{ 'ff-export-label-changed': labelAnimating }"
     :menu-button-props="{ 'aria-label': t('importExport.export.moreOptions') }"
     data-testid="export-button"
     @click="primary.run"
     @animationend="labelAnimating = false"
   />
   ```
   (`primary.run` still needs no memory write — it's already the remembered
   format. Keep the `@click="primary.run"` binding as today.)

8. **Label crossfade (motion)** — retrigger a short opacity animation on the
   primary label whenever the resolved format id changes. Tokens only, no
   literal timings; the global `prefers-reduced-motion` blanket in `builder.css`
   covers it (no per-component gate):
   ```ts
   const labelAnimating = ref(false)
   watch(() => primary.value?.id, async (id, prev) => {
     if (prev === undefined || id === undefined || id === prev) return
     labelAnimating.value = false          // reset so the animation can re-fire
     await nextTick()
     labelAnimating.value = true
   })
   ```
   Add a scoped style block (ExportMenu.vue currently has none):
   ```html
   <style scoped>
   .ff-export-label-changed :deep(.p-button-label) {
     animation: ff-export-label-fade var(--builder-motion-duration-s) var(--builder-motion-ease-standard);
   }
   @keyframes ff-export-label-fade {
     from { opacity: 0.35; }
     to { opacity: 1; }
   }
   </style>
   ```
   - `animationend` bubbles from `.p-button-label` to the SplitButton root, so
     the root's `@animationend="labelAnimating = false"` resets the flag.
   - `--builder-motion-duration-s` = 120 ms (≤ 160 ms as required);
     `--builder-motion-ease-standard` is defined in `builder.css :root`.
   - **stylelint:** only existing `--builder-motion-*` tokens are referenced (no
     new bare `var(--x)`), so `value-no-unknown-custom-properties` stays green.
     No new `:style`-injected custom property is introduced, so no allowlist
     edit is needed.

---

## Task 6: update tests that couple to the old primary label

### 6a. Component test — `tests/component/export-menu.spec.ts`

The existing readiness-summary tests still pass unchanged (the summary line and
strings are untouched). Update / add:

- **"keeps the export actions after the summary line"** (existing) — the menu
  now also contains the XForm item. Add `expect(labels).toContain('XForm XML')`
  to the existing assertions (keep the three existing `toContain`s).
- **New `describe('ExportMenu format memory')`** block. In `beforeEach`, after
  `form.doc = newDocument('T')`, also set `form.recordId = 'rec1'` (the ref is
  writable on the setup store).
  - **primary follows stored pref:** `useUiStore().setLastExportFormat('rec1',
    'xlsform')`; mount; the `export-button` primary shows `Export · XLSForm`
    (assert `wrapper.get('[data-testid="export-button"]').text()` contains
    `'Export · XLSForm'`).
  - **default when no memory:** with no memory set, the primary shows
    `Export · XForm`.
  - **picking a format remembers it + promotes it:** open the menu, click the
    `XLSForm (.xlsx)` menuitem; assert `useUiStore().getLastExportFormat('rec1')
    === 'xlsform'` and (after `nextTick`) the primary now shows
    `Export · XLSForm`.
  - **active marker:** with memory `xlsform`, the `XLSForm (.xlsx)` menuitem
    carries the `export-format-active` class (find via
    `wrapper.find('.export-format-active')` and assert its text contains
    `XLSForm (.xlsx)`), and its icon is `pi pi-check`.
  - **embed fallback:** `const embed = useEmbedStore(); embed.active = true;
    embed.config = { exports: { xlsform: false } }`; memory is `xlsform`; the
    primary falls back to the first enabled action → `Export · XForm`. (Import
    `useEmbedStore` from `@/stores/embed`.)

  Reuse the existing `openMenu` helper / `mountWith` / `freshPinia` from
  `./helpers` and the `vi.mock('primevue/usetoast', ...)` already at the top of
  the file.

### 6b. e2e — primary-button-by-name clicks must stop matching `'Export'`

Three specs click the primary via
`getByTestId('export-button').getByRole('button', { name: 'Export', exact: true })`.
The primary label is now `Export · XForm` (fresh form, no memory), so
`name: 'Export', exact: true` no longer matches. Change each to select the
**first** button inside the SplitButton (the primary action), which is
label-independent:

```ts
page.getByTestId('export-button').getByRole('button').first().click()
```

Sites to update:
- `tests/e2e/import-export.spec.ts:17` (XForm XML primary export).
- `tests/e2e/translations.spec.ts:63` and `:228` (primary export of XML).

> `.first()` is the primary action button; `.last()` is the dropdown-toggle
> button. The menu-driven selections in these specs already use `.last()` +
> `getByRole('menuitem', { name })` and keep working — the menu still lists
> those items by the same labels. Note that after the first spec picks XLSForm
> from the menu, that form's primary becomes XLSForm and the memory is set; the
> subsequent `.last()`-open + menuitem picks are unaffected because they select
> by menuitem name, and every enabled format (including the now-primary one) is
> still listed.

- `tests/e2e/entities.spec.ts:56` uses `.last()` + `XLSForm (.xlsx)` menuitem —
  **no change needed** (menu label unchanged, menu still lists it).
- `tests/e2e/embed.spec.ts:51` asserts the whole export button disappears when
  all exports are disabled — **no change needed** (`primary` is still `null`
  when `enabledActions` is empty).

Run `pnpm test:e2e import-export` / `translations` / `entities` (single-arg
filter — never `-- <filter>`, which silently runs the full suite) to confirm.

---

## Task 7: docs + regression sweep

1. **`CLAUDE.md`** — in the `src/stores/` row, extend the `ui` store bullet to
   note the new `lastExportFormat` guarded map (mirroring the
   `hiddenBundledTemplates` phrasing: "additive guarded persisted field — never
   bump `STORAGE_VERSION`; rides `preferences.json` via
   `exportPreferences`/`applyPreferences`; pruned on form deletion by the
   workspace store"). Note the ExportMenu now remembers the last export format
   per form and states it on the primary.
2. **README Features** (✅/⬜) + **`docs/product/roadmap.md`** — if there is an
   export-UX line to tick or a "Known follow-ups" entry to move, update it;
   otherwise add a short note under the relevant Phase.
3. **Full suite:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.
   - `lint` runs stylelint over `.vue`/`.css` — the new scoped animation must
     pass `value-no-unknown-custom-properties`.
   - `typecheck` catches any fr/es i18n key drift.
4. **Manual pass (agent-browser + interface-craft):** verify per
   `user-guide.md`, and specifically check the fr/es editor header does not
   overflow with `Exporter · ZIP (XForm)` on the primary button (the compact
   header rules live in `builder.css`, `html:is([lang='fr'],[lang='es'])
   .app-header …`). If it overflows, extend those compact rules to the export
   SplitButton primary label rather than shortening the strings. Log the pass to
   `docs/verification/`.
5. **Conventional commit** for the feature (e.g. `feat(export): remember the
   last export format per form`). Per global instructions, **no**
   `Co-Authored-By` trailer.

---

## Out of scope

- No change to the actual serialization/export logic (`exportXml`,
  `exportXlsx`, `exportZipBundle`), file names, or the readiness-summary content.
- No `WORKSPACE_FORMAT_VERSION` bump — `lastExportFormat` rides the existing
  `preferences.json` section (additive, guarded), exactly like every other ui
  pref.
- No `STORAGE_VERSION` bump — additive guarded localStorage field.
- The share/single-form export path is untouched (this control is editor-only).
