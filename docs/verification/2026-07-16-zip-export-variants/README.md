# Verification pass — ZIP export variants (2026-07-16)

Agent-browser session against the built app (`pnpm preview`, :4173). Spec:
`docs/specs/2026-07-16-1120-zip-export-variants/`.

## Checked

- **Menu shape** (`export-menu-dark-high.png`): the Export dropdown lists
  the readiness summary, then XLSForm (.xlsx), then the two bundles grouped
  last with the final copy — "ZIP · XForm XML + attachments" and
  "ZIP · XLSForm + attachments".
- Download filenames (`<formId>-<version>-xform.zip` / `…-xlsform.zip`),
  both archives' internal layout (`form.xml`/`form.xlsx` + `media/`), the
  missing-attachment warning on both variants, and the single embed `zip`
  flag hiding both entries are pinned by `src/core/export/zip.spec.ts`,
  `tests/component/export-menu.spec.ts` and the two e2e cases in
  `tests/e2e/import-export.spec.ts` (green in the full suite run).
