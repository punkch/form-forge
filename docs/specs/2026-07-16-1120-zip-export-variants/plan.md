# Plan — ZIP export variants (XML + attachments / XLSX + attachments)

## Context

The editor's Export split-button (`src/components/importexport/ExportMenu.vue`)
offers XForm XML (primary), XLSForm (.xlsx), and a single "ZIP with
attachments" that always bundles the serialized XForm (`form.xml`) plus
`media/<filename>` for every stored attachment blob. Teams that keep the
XLSForm spreadsheet as their editable source of truth — for pyxform tooling,
or to hand a colleague something they can open directly — have no one-click
way to get the `.xlsx` and its attachments together; they must export the
XLSX and the ZIP separately and re-assemble by hand.

This plan splits the ZIP export into two variants that share every step
except the root payload: **ZIP · XForm XML + attachments** (unchanged
content of today's ZIP) and **ZIP · XLSForm + attachments** (the
`writeXlsForm` workbook plus the same full `media/` folder). Both stay
behind the same `blockOnErrors` gate as every other export action, and both
stay behind the single existing `zip` embed-config flag — no protocol
change. `shape.md` in this folder records the resolved decisions (all of the
backlog doc's proposed decisions adopted, plus filenames/ordering/attachment-
set questions resolved); `references.md` carries the code-verified
integration points (exact line numbers, and the corrected detail that the
`blobs` map in `exportZip` is keyed by attachment `id`, not filename);
`standards.md` lists the repo invariants this work must respect.

Effort is **S** — one core module touch, one component touch, one i18n
edit, and lockstep test updates across both test layers. No wave split is
needed; this plan is a single ordered task list for one implementor (or one
Workflow package).

Conventional commit on `main` when done (e.g. `feat(export): split ZIP
export into XForm and XLSForm attachment bundles`). **No `Co-Authored-By`
trailer or other self-attribution** (global user instruction, overrides any
default guidance).

## Resolved decisions (binding — do not re-litigate at implementation time)

1. Embed gating stays the single existing `zip` flag
   (`EmbedExportsConfig.zip` in `src/embed/protocol.ts`), controlling both
   new menu entries. **No edit to `protocol.ts` or `src/stores/embed.ts`.**
2. Menu labels: **"ZIP · XForm XML + attachments"** and **"ZIP · XLSForm +
   attachments"** (final copy, not placeholder).
3. In-archive layout stays symmetrical: `form.xml` vs `form.xlsx` at the
   ZIP root, `media/` beside it. No manifest.
4. Download filenames suffix **both** variants:
   `<formId>-<version>-xform.zip` and `<formId>-<version>-xlsform.zip`. This
   deliberately changes the existing plain `<formId>-<version>.zip`
   filename — call this out in the user guide (already done in this
   folder's `user-guide.md`) and in the docs sweep.
5. Menu ordering groups both ZIP entries **last**: XForm XML (primary) ·
   XLSForm (.xlsx) · ZIP · XForm XML + attachments · ZIP · XLSForm +
   attachments.
6. The XLSForm ZIP variant bundles the **same full `doc.attachments` set**
   as the XForm ZIP variant — no filtering to only XLSForm-column-
   referenced files.

## Task 1 — Core: parameterize `exportZip` with a `variant`

**What to build:** extend `exportZip` to accept an optional third
`variant: 'xform' | 'xlsform'` argument (default `'xform'`, so every
existing call site and the existing spec keep working unchanged), and
branch only the root-payload step. Everything else — the media-bundling
loop, the `export.missing-attachment` warning, and the `uint8array` output
— stays byte-identical and shared between variants.

**File to modify:** `src/core/export/zip.ts`

Replace the file body with:

```ts
/**
 * ZIP export: form.xml (serialized XForm) OR form.xlsx (XLSForm workbook)
 * at the root, plus media/<filename> for every attachment reference whose
 * blob the caller can supply. Attachment refs without a stored blob become
 * warnings, never failures. The two variants share every step but the root
 * payload.
 */
import JSZip from 'jszip'

import type { FormDocument } from '../model/types'
import type { Issue } from '../validate/issues'
import { serializeXForm } from '../xform/serializer'
import { writeXlsForm } from '../xlsform/writer'

export interface ExportZipResult {
  data: Uint8Array
  issues: Issue[]
}

export type ZipVariant = 'xform' | 'xlsform'

const toBytes = async (content: Blob | Uint8Array): Promise<Uint8Array> =>
  content instanceof Uint8Array ? content : new Uint8Array(await content.arrayBuffer())

export const exportZip = async (
  doc: FormDocument,
  blobs: Map<string, Blob | Uint8Array>,
  variant: ZipVariant = 'xform'
): Promise<ExportZipResult> => {
  const zip = new JSZip()
  let issues: Issue[]

  if (variant === 'xlsform') {
    zip.file('form.xlsx', await writeXlsForm(doc))
    issues = []
  } else {
    const serialized = serializeXForm(doc)
    zip.file('form.xml', serialized.xml)
    issues = serialized.issues
  }

  for (const ref of doc.attachments) {
    const content = blobs.get(ref.id)
    if (content === undefined) {
      issues.push({
        severity: 'warning',
        code: 'export.missing-attachment',
        message: `No stored file for attachment "${ref.filename}"; it was left out of the ZIP.`,
        scope: {},
      })
      continue
    }
    zip.file(`media/${ref.filename}`, await toBytes(content))
  }

  const data = await zip.generateAsync({ type: 'uint8array' })
  return { data, issues }
}
```

**Invariants respected:** `src/core/` purity — `../xlsform/writer` is
itself pure core (no Vue/Pinia/Dexie/i18n), so this adds no new dependency
class; `export.missing-attachment` stays a stable `code` with a verbatim
English `message`, unlocalized. No new npm dependency (JSZip already a
dependency).

**Tests to update in lockstep:** `src/core/export/zip.spec.ts` (Task 2).

## Task 2 — Core tests: cover the `xlsform` variant

**File to modify:** `src/core/export/zip.spec.ts`

Add two tests alongside the existing two (`'packs form.xml plus media/…
entries'` and `'warns about attachment refs without a stored blob'`),
covering the `'xlsform'` branch's two paths (payload present, blob missing)
so the new `if (variant === 'xlsform')` branch is exercised both ways for
the coverage floor:

```ts
it('packs form.xlsx plus the same media entries for the xlsform variant', async () => {
  const d = doc({
    title: 'Zip Test',
    formId: 'zip_test',
    children: [q('select_one_from_file', 'v', 'V', { itemsetFile: 'villages.csv' })],
  })
  d.attachments = [attachment('a1', 'villages.csv'), attachment('a2', 'logo.png', 'media')]
  const blobs = new Map<string, Blob | Uint8Array>([
    ['a1', new TextEncoder().encode('name,label\nx,X\n')],
    ['a2', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })],
  ])

  const { data, issues } = await exportZip(d, blobs, 'xlsform')
  expect(issues.filter((i) => i.severity === 'error')).toEqual([])

  const zip = await JSZip.loadAsync(data)
  expect(Object.keys(zip.files).sort()).toEqual(['form.xlsx', 'media/', 'media/logo.png', 'media/villages.csv'])
  const xlsxBytes = await zip.file('form.xlsx')?.async('uint8array')
  expect(xlsxBytes?.[0]).toBe(0x50) // 'P'
  expect(xlsxBytes?.[1]).toBe(0x4b) // 'K' — zip container, i.e. a valid .xlsx
  expect(await zip.file('media/villages.csv')?.async('string')).toBe('name,label\nx,X\n')
  expect(await zip.file('media/logo.png')?.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]))
})

it('warns about attachment refs without a stored blob for the xlsform variant too', async () => {
  const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A')] })
  d.attachments = [attachment('gone', 'missing.csv')]

  const { data, issues } = await exportZip(d, new Map(), 'xlsform')
  expect(issues).toContainEqual(expect.objectContaining({
    severity: 'warning',
    code: 'export.missing-attachment',
  }))
  const zip = await JSZip.loadAsync(data)
  expect(Object.keys(zip.files)).toEqual(['form.xlsx'])
})
```

No changes needed to the existing two tests or the `attachment(...)` helper
— `exportZip(d, blobs)` (no third argument) must keep returning exactly what
it does today, pinning back-compat.

## Task 3 — i18n: replace `zipItem` with the two payload-distinguishing keys

**File to modify:** `src/i18n/locales/en/importExport.json`

Replace:

```json
"zipItem": "ZIP with attachments",
```

with:

```json
"zipXformItem": "ZIP · XForm XML + attachments",
"zipXlsformItem": "ZIP · XLSForm + attachments",
```

(Keep `xlsformItem` and every other key in `importExport.export.*`
unchanged.) This is a deliberate rendered-English change — update the e2e
assertions that pin `'ZIP with attachments'` in the same commit (Task 5);
do not leave the old key referenced anywhere.

## Task 4 — UI: wire two ZIP menu entries in `ExportMenu.vue`

**File to modify:** `src/components/importexport/ExportMenu.vue`

Replace `exportZipBundle` with a variant-parameterized version:

```ts
const exportZipBundle = async (variant: 'xform' | 'xlsform'): Promise<void> => {
  if (form.doc === null || form.recordId === null || blockOnErrors()) return
  const attachments = await listAttachments(form.recordId)
  const blobs = new Map(attachments.map((a) => [a.id, a.blob]))
  const { data, issues } = await exportZip(rawDoc(), blobs, variant)
  for (const issue of issues.filter((i) => i.severity === 'warning')) {
    toast.add({ severity: 'warn', summary: t('importExport.export.warningSummary'), detail: issue.message, life: 5000 })
  }
  downloadBlob(data, `${baseName.value}-${variant}.zip`, 'application/zip')
}
```

(`variant` is already `'xform' | 'xlsform'`, so `` `${variant}.zip` ``
naturally yields `-xform.zip` / `-xlsform.zip`.)

Update `secondaryActions` to push two ZIP actions (both gated by the same
`embed.exportEnabled('zip')` check), after the XLSForm action, in this
order:

```ts
const secondaryActions = computed<ExportAction[]>(() => {
  const actions: ExportAction[] = []
  if (embed.exportEnabled('xlsform')) {
    actions.push({ label: t('importExport.export.xlsformItem'), icon: 'pi pi-file-excel', run: () => { void exportXlsx() } })
  }
  if (embed.exportEnabled('zip')) {
    actions.push({ label: t('importExport.export.zipXformItem'), icon: 'pi pi-box', run: () => { void exportZipBundle('xform') } })
    actions.push({ label: t('importExport.export.zipXlsformItem'), icon: 'pi pi-box', run: () => { void exportZipBundle('xlsform') } })
  }
  return actions
})
```

No other part of the file changes: `baseName`, `blockOnErrors`, `exportXml`,
`exportXlsx`, the `ExportAction` interface, the `primary` computed, and the
`items`/template all already work generically over `secondaryActions` and
need no edits — `primary` promotes `secondaryActions.value[0]` when `xform`
is hidden by the host, which is unaffected by the new entry count.

**Invariants respected:** `data-testid="export-button"` on the `SplitButton`
root is untouched; no new testids are introduced — the two new menu items
are addressed in tests by their accessible role name (`getByRole('menuitem',
{ name: ... })`), matching how `xlsformItem`/the old `zipItem` were already
addressed. `embed.exportEnabled('zip')` is the single gating call for both
new entries — do not add a second `EmbedExportsConfig` key.

## Task 5 — e2e: update the ZIP-menu-item assertions, add the XLSForm-ZIP case

**File to modify:** `tests/e2e/import-export.spec.ts`

Replace the ZIP-export block (currently lines 36-43) with two blocks — one
per variant, both filenames asserted, both keyed off the new menu-item
names:

```ts
    // ZIP export — XForm XML variant
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [xformZipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'ZIP · XForm XML + attachments' }).click(),
    ])
    expect(xformZipDownload.suggestedFilename()).toMatch(/-xform\.zip$/)

    // ZIP export — XLSForm variant
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [xlsformZipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'ZIP · XLSForm + attachments' }).click(),
    ])
    expect(xlsformZipDownload.suggestedFilename()).toMatch(/-xlsform\.zip$/)
```

No other test in this file (`XForm XML import round-trips…`, `import
rejects unsupported files…`) is affected. No new e2e helper is needed —
the existing `getByTestId('export-button').getByRole('button').last()`
caret-open pattern (already used for both the XLSForm and old ZIP cases)
continues to work with four menu items instead of three.

## Task 6 — Docs sweep

Update in the same change, per the CLAUDE.md "keep this file up to date"
mandate and the delivery process's docs-sweep step:

- **`README.md`** — line 53 currently reads `- ✅ **Export** — XForm XML,
  XLSForm .xlsx, ZIP with media/CSV attachments`; reword to reflect two ZIP
  variants, e.g. `- ✅ **Export** — XForm XML, XLSForm .xlsx, or either as a
  ZIP bundled with media/CSV attachments`. Also check the intro paragraph
  (line 7, "...exported as XForm XML, XLSForm (.xlsx) or a ZIP ready for ODK
  Central") for the same nuance if it reads as one-ZIP-only.
- **`docs/product/roadmap.md`** — search for any line naming the single ZIP
  export specifically (the Phase 1 MVP criterion and the `XLSForm import/
  export, ZIP & attachments` delivered bullet are the likely spots) and
  note the two-variant split if the existing wording implies a single ZIP.
- **`CLAUDE.md`** — add a code-map row for `src/core/export/` (there is
  currently none — only `src/core/workspace/archive.ts`, the unrelated
  `.formforge.zip` workspace-backup format, is listed), e.g.: `` `src/core/
  export/zip.ts` `` — `exportZip(doc, blobs, variant)` builds a ZIP with
  `form.xml`/`form.xlsx` at the root plus `media/<filename>` per attachment;
  shared missing-attachment warning across both variants.
- **`docs/specs/2026-07-09-2235-embed-postmessage-api/user-guide.md`** —
  optional one-line addition near the `exports` config description (around
  line 85) noting that the `zip` key now hides two menu entries, not one.
  Not required (the config itself is unchanged), but keeps the doc precise.
- Add a one-line "promoted" pointer at the top of
  `docs/specs/backlog/zip-export-variants.md` referencing this folder (the
  existing convention for promoted backlog docs, e.g. see how
  `docs/specs/backlog/central-ux-enhancement.md` was turned into a
  promotion stub).

## Verification

Commands (all must pass):

```bash
pnpm lint            # eslint (no-missing-keys picks up the renamed i18n keys) + stylelint
pnpm typecheck       # vue-tsc — StrictTranslate resolves zipXformItem/zipXlsformItem
pnpm test            # unit (src/core/export/zip.spec.ts) + component
pnpm test:coverage   # src/core/** floor 86/78/88 — the new variant branch must be
                      # covered both ways (Task 2's two new tests)
pnpm build && pnpm test:e2e   # chromium + firefox, tests/e2e/import-export.spec.ts
```

Additionally:

- **agent-browser manual pass** over the built app: open the Export menu on
  a form with at least one attachment and confirm the four-item order
  (XForm XML primary, XLSForm (.xlsx), ZIP · XForm XML + attachments, ZIP ·
  XLSForm + attachments); download both ZIPs and confirm the suffixed
  filenames and that each archive's root entry (`form.xml` vs `form.xlsx`)
  and `media/` folder are as expected; trigger a missing-attachment warning
  toast on both variants; confirm all four actions are blocked while the
  form has validation errors; confirm `exports: { zip: false }` in embed
  mode hides both ZIP entries while leaving XForm XML/XLSForm visible. Full
  scenario list is in this folder's `user-guide.md` under "Manual test
  scenarios". Log the pass (screenshots + notes) to
  `docs/verification/2026-07-16-zip-export-variants/`.
- **interface-craft** is not needed — no new visual layout is introduced,
  only label text and one additional item inside the existing, unchanged
  `SplitButton` menu.
- **`/code-review`** (five lenses, no plan mode) on the diff; fix findings
  immediately, before committing.
- **Conventional commit** on `main`, e.g. `feat(export): split ZIP export
  into XForm and XLSForm attachment bundles`. No `Co-Authored-By` trailer.
- Confirm the Task 6 docs sweep (README, roadmap, CLAUDE.md, and optionally
  the embed-postmessage-api user guide) landed in the same change.
