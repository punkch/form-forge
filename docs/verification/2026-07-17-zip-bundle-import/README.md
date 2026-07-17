# Manual verification — ZIP bundle import (2026-07-17)

Agent-browser pass against the production build (`pnpm preview`, :4173),
Chromium. Spec: `docs/specs/2026-07-17-1306-zip-bundle-import/`.
All seven planned scenarios pass.

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| a | ZIP-XForm round trip: blank form + Text question + `photo.png`/`districts.csv` uploaded via Form menu → Attachments; export "ZIP · XForm XML + attachments" (`form.xml` + `media/photo.png` + `media/districts.csv` at the expected paths); delete form; Import form → report reads **"read as XForm XML. No problems found."**; Import opens the editor with both attachments restored (photo.png `image/png · 70 B`, districts.csv `text/csv · 53 B`) | ✅ | `01-import-report-zip.png`, `02-attachments-restored.png` |
| b | ZIP-XLSForm variant: same round trip via "ZIP · XLSForm + attachments" (`form.xlsx` at the root) → report reads **"read as XLSForm. No problems found."**, both attachments restored after import | ✅ | `03-xlsform-variant-report.png` |
| c | Collision: re-importing the same bundle while the form exists → after pressing Import the collision panel appears ("A form with ID \"zip_import_test\" already exists in your library.") with **Import as copy** / **Replace existing**. Copy created a second library card (2 cards). Third import → **Replace existing** → danger confirm "Replace form?" ("This overwrites … Its attachments are replaced too.", red Replace button) → accepting kept the count at 2 (replaced, not added) | ✅ | `04-collision-panel.png`, `05-replace-confirm.png` |
| d | Workspace-archive rejection: zip containing only `manifest.json` → error "This is a Form Forge workspace archive. Import it from Settings → Import workspace."; Import button disabled | ✅ | `06-workspace-archive-error.png` |
| e | No form: zip containing only `media/foo.csv` → error "The ZIP does not contain a form.xml or form.xlsx file at its root."; Import button disabled | ✅ | `07-no-form-error.png` |
| f | Unreferenced media: XForm bundle rebuilt with an extra `media/extra.txt` → imports clean (as copy); Attachments dialog lists extra.txt (`application/octet-stream · 24 B`, "Not referenced") alongside the two originals | ✅ | `08-unreferenced-media.png` |
| g | Both forms: zip with `form.xml` **and** `form.xlsx` + media → "read as XForm XML. 0 errors, 1 warning." + warning "The ZIP contains both form.xml and form.xlsx; form.xml was imported."; confirm button reads **Import anyway** (enabled) | ✅ | `09-both-forms-warning.png` |

Scenario (a) note: the optional preview-render check for an image question was
skipped — the uploaded media was not wired to a question (both files list as
"Not referenced"), and attachments-restored was taken as sufficient per plan.

Observations / anomalies (none blocking):

- The collision panel only appears **after** pressing Import — the initial
  report for a colliding bundle reads "No problems found." with a plain
  Import button. Reasonable staging, but worth knowing when reading the flow.
- "Import as copy" keeps the form id: both library cards carry
  `data-testid="form-card-zip_import_test"` and the identical title
  "Zip Import Test", so the copy is indistinguishable at a glance (no
  "(copy)" suffix, no id remap).
- Error reports for form-less ZIPs ((d), (e)) still lead with
  "read as XForm XML" before the error line — slightly misleading copy since
  no form was read, though the error itself is clear and Import stays
  disabled. **Fixed in the same commit** (post-pass review fix: ImportReport
  suppresses the "read as" tail whenever no document parsed).
- After "Replace existing" with two same-id forms in the library ((c), after
  the copy), replace targeted one of them and the editor opened on the
  replaced form; the library count stayed at 2 as expected.
- Browser console stayed clean for the whole pass (no errors or warnings).

Automated gates at the same commit: `pnpm test` 1395 tests green (zero engine
files in the diff — goldens untouched), `pnpm test:coverage` floors met,
`pnpm lint` + `pnpm typecheck` clean, full Playwright e2e matrix green on
chromium + firefox (121 passed / 1 skipped), including the new
"ZIP bundle export round-trips a form and its attachment" e2e test.

Five-lens code review (reuse / quality / efficiency / correctness /
style+tests) ran on the diff after the browser pass; all accepted findings
were fixed in the same commit: a double-click re-entrancy window in the
Import dialog's confirm flow (now guarded), the collision/landing state
machine duplicated between the Import dialog and the library Central drawer
(extracted into the shared `useImportLanding` composable, which also gates
mid-flight dialog closes), the attachment-ref rebuild duplicated from the
Central importer (now the shared `attachmentRefsFor` in
`attachment-role.ts`), a false workspace-archive rejection for bundles
carrying a stray root `manifest.json` (form entries now take precedence),
`media\` backslash entries from nonconforming Windows zip tools silently
dropped (now normalized), a prototype-chain hazard in `mediatypeFor`
(`x.constructor` filenames — now `Object.hasOwn` + `splitFilename`), stale
landing errors resurfacing after a mid-flight close, double
`normalizeDefaultContent` on the zip path, the misleading "read as" report
line above form-less-zip errors, two French copy fixes (paquet ZIP /
écrase), and test-coverage gaps (landing-failure surface, empty-formId
skip, double-click guard, `mediatypeFor` map, xlsform-variant classify,
extensionless workspace-archive sniff). Accepted without change: the
bounded double zip load on the extensionless sniff path (clarity-justified),
uppercase `MEDIA/` entries staying ignored (documented contract), duplicated
test fixture styles across the three import specs, and the auto-accepting
confirm mock not exercising the replace-cancel path (same precedent as the
Central spec).
