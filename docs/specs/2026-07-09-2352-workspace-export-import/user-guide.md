# Workspace Export / Import — Manual Verification

Stage 1 ships logic only; there is nothing to click yet. Verify stage 1 via
the test suites (`src/core/model/migrate.spec.ts`,
`src/core/workspace/archive.spec.ts`, `src/persistence/workspace-io.spec.ts`).

Once the stage-2 UI lands, run `pnpm dev` and verify:

| # | Steps | Expected |
|---|---|---|
| 1 | Create forms "Alpha" and "Beta"; give Alpha a CSV attachment. Library → overflow menu → Export workspace | A `workspace-<date>.formforge.zip` downloads |
| 2 | Unzip it | `manifest.json` listing both forms; `forms/<id>/form.json`, `meta.json`; Alpha's CSV under `forms/<id>/attachments/` |
| 3 | DevTools → Application → Storage → Clear site data; reload | Library is empty |
| 4 | Overflow menu → Import workspace → drop the archive | Dialog lists Alpha + Beta with attachment counts; Import restores both, question counts intact, Alpha's CSV byte-identical, original creation dates kept |
| 5 | Import the same archive again | Both forms imported once more, each with a "duplicate form ID" warning; nothing overwritten |
| 6 | Row menu on Alpha → Export form archive | `alpha.formforge.zip` with a single-form manifest; importing it elsewhere restores Alpha losslessly |
| 7 | Import an `.xlsx` file through Import workspace | Clear error: not a workspace archive, hinting at "Import form" for XLSForms |
| 8 | Import a corrupted/truncated zip | Single "could not be read as a ZIP archive" error, no partial import |
| 9 | Hand-edit an archive: set `formatVersion: 2` in `manifest.json` | Import refuses with an unsupported-format-version error |
| 10 | Hand-edit an archive: break one form's `form.json` | The other forms import; the broken one is reported as skipped |
