# Spec 07 (core): XLSForm Reader/Writer & ZIP Export — Shaping Notes

## Scope

The native-TypeScript XLSForm bridge (`src/core/xlsform/`) and the ZIP
exporter (`src/core/export/zip.ts`): read .xlsx workbooks into the
FormDocument model, write documents back out as stable .xlsx, and pack
form.xml + media into a ZIP. Pure core modules only — the dialogs/menus of
Spec 07 (AttachmentsDialog, ImportReport, ExportMenu) integrate after merge.

## Decisions

- **Library isolation**: `workbook-read.ts` is the only module importing
  SheetJS ('xlsx'); `workbook-write.ts` the only one importing
  write-excel-file. Everything downstream works on `string[][]` rows, so
  either library can be swapped behind one file. write-excel-file 4.x has
  no bare entry point: node uses `write-excel-file/node` (`.toBuffer()`,
  behind an `@vite-ignore` dynamic import so node:fs never enters the app
  bundle graph) and the browser uses `write-excel-file/browser`
  (`.toBlob()`); both normalize to Uint8Array.
- **Force-text coercion**: cells are read via
  `sheet_to_json({ header: 1, raw: false, defval: '', blankrows: true })`
  with the range re-anchored at A1, then `String()`-ed and trimmed. This
  keeps '20260709', '007' and format-driven '1.50' verbatim AND keeps array
  indexes equal to Excel row numbers, so every reader Issue carries a real
  `{ sheet, row (1-based, header = 1), column? }` scope. The writer emits
  every cell as text for the same reason.
- **Reader never throws on content**: unknown types, missing names,
  begin/end mismatches, missing select arguments, or_other, legacy ':'
  separators, extra settings rows — all become error/warning Issues; bad
  rows are skipped, good rows still import. Unreadable bytes produce a
  single `workbook.unreadable` error.
- **pyxform alias surface**: '::' language suffixes byte-identical
  (`label::English (en)`), single-':' accepted with a warning,
  `media::image[::Lang]`, generic space→underscore folding
  ('constraint message' → constraint_message) plus true aliases (caption,
  readonly, relevance, command, value→name on choices, title/id_string on
  settings, dataset on entities, big_image → big-image). Type tokens:
  'begin group'/'begin_group' variants, 'select one'/'select all that
  apply', `select_*_from_file f.csv|xml|geojson` → itemsetFile,
  'dateTime' → datetime, location → geopoint, photo → image.
- **Lossless escape hatches**: instance::/bind::/body:: → instanceAttrs /
  bind.custom / body.custom; unknown survey columns → customColumns
  (LocalizedText when any '::Lang' variant exists); unknown choices columns
  → choice.extras keyed by the original header, per-list extraColumnOrder
  restricted to columns the list uses; unknown settings columns →
  settings.custom; unknown sheets → unknown.extraSheets verbatim (the ODK
  template's eight emoji-named documentation sheets round-trip).
- **Empty-cell semantics match pyxform**: empty choice extras produce no
  `<item>` children (cascade golden pins this); required/read_only
  'yes'→'true()', 'no'→omitted; languages are first-seen '::Lang' order
  across survey then choices headers.
- **Writer stability**: canonical column order [type, name, label, hint,
  guidance_hint, required, required_message, read_only, relevant,
  constraint, constraint_message, calculation, choice_filter, appearance,
  parameters, default, trigger, repeat_count, image, audio, video,
  (big-image), save_to] filtered to used; translated columns expand
  'base::Lang' right after their base in doc.languages order, a plain base
  column only when DEFAULT_LANG values exist; passthrough/custom columns
  append in first-seen DFS order; survey always keeps at least type+name
  headers so an empty form re-imports. Rows are DFS with begin_/end_
  markers; write→read round-trips compare equal (ids stripped) and
  serialize to identical canonical XForms.
- **ZIP**: jszip; form.xml at the root (serializer issues are surfaced),
  `media/<filename>` per attachment ref; a ref without a stored blob is a
  `export.missing-attachment` warning, never a failure. Blobs are
  normalized to Uint8Array before zipping so node and browser behave
  identically.

## Context

- **References:** tests/golden/src/*.xlsx + expected/*.xml (pyxform 4.5.0
  ground truth — the bridge test reads every fixture and must match the
  golden canonicalized XForm end-to-end), scripts/make-goldens.py (exact
  workbook shapes), xlsform-cheatsheet/*.md, tests/fixtures/ODK XLSForm
  Template.xlsx (591KB official template; imports with zero issues).
- **Verification:** `pnpm lint && pnpm typecheck && pnpm test` — 215 tests
  (75 new: 17 golden-bridge, 26 header parsing, 18 reader/params, 4 text
  coercion, 7 writer, 2 zip, 2 template — plus the round-trip halves).
