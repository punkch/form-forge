# Wave 1 verification: workspace archives + UI i18n (agent-browser)

Manual pass over the two Wave 1 features against the production build:
`pnpm build`, then `pnpm preview --port 4181` (static SPA, fresh browser
profile / empty IndexedDB).

## Scenario A — workspace export/import roundtrip

- [x] **Step 1 — PASS.** Created form "W1 Alpha", added a Text question
      from the palette, labelled it "Alpha question". Library card:
      `W1 Alpha · w1_alpha · 1 question`.
- [x] **Step 2 — PASS.** Created form "W1 Beta", added a Text question
      labelled "Beta question". Library card:
      `W1 Beta · w1_beta · 1 question`.
- [x] **Step 3 — PASS.** Library "Workspace actions" menu → **Export
      workspace** downloaded a zip with suggested filename
      `odkbuilder-workspace-2026-07-09.odkbuilder.zip` (date is UTC from
      `toISOString`). Verified the file is a valid Zip archive containing
      `manifest.json` (formatVersion 1, both forms listed with recordId /
      formId / title) plus `forms/<id>/form.json` and
      `forms/<id>/meta.json` for each of the two forms.
- [x] **Step 4 — PASS.** Deleted BOTH forms via each card's actions menu
      (Delete → confirm). Library returned to the "No forms yet" empty
      state.
- [x] **Step 5 — PASS.** Workspace actions → **Import workspace**, chose
      the downloaded archive. The report step rendered:
      `odkbuilder-workspace-2026-07-09.odkbuilder.zip — 2 forms found.
      No problems found.` with rows `W1 Beta / w1_beta / no attachments`
      and `W1 Alpha / w1_alpha / no attachments`, and the confirm button
      read "Import 2 forms".
      Screenshot: `screenshots/scenA-import-report.png`.
- [x] **Step 6 — PASS.** After import both cards are back with their
      original formIds and versions (`w1_alpha · v202607100042`,
      `w1_beta · v202607100043`), each "1 question".
      Screenshot: `screenshots/scenA-restored-library.png`.
- [x] **Step 7 — PASS.** Opened the restored "W1 Alpha": the canvas shows
      the Text question, the property panel shows Label "Alpha question" /
      Name "text", and the live preview renders the real engine with
      "W1 Alpha" + the "Alpha question" input.
      Screenshot: `screenshots/scenB-editor-with-preview.png`.

**Result: PASS (7/7).** Export → delete → import is a lossless roundtrip.

## Scenario B — i18n spot-check (no raw key leaks)

Clicked through library → editor and inspected every visible string; also
ran an automated scan of `document.body.innerText` plus all `aria-label`,
`placeholder`, `title` and `alt` attributes on each surface for key-like
dotted tokens (`/\b[a-z]\w*\.[a-z]\w*(\.\w+)*\b/`).

- [x] **Library — PASS.** Header, subtitle ("Forms are stored in this
      browser only — nothing leaves your device."), card metadata, New
      form / Import form dialogs, Workspace actions menu ("Export
      workspace" / "Import workspace"), per-card menu ("Rename",
      "Duplicate", "Export archive", "Delete") all proper English.
      Scan: 0 key-like hits.
- [x] **Palette — PASS.** Category headings (Input, Choice, Date & time,
      Media, Location, Display, Structure, Metadata) and all 30+ question
      type names read as English; search placeholder "Search question
      types". Scan: 0 hits.
- [x] **Property panel — PASS.** Sections BASICS / APPEARANCE / LOGIC with
      Label, Name, Hint, Default value, Required, Read only, Appearance,
      Relevant (skip logic), Constraint, Calculation. The only dotted
      tokens on the page are the intentional "e.g." placeholder examples
      (`e.g. ${age} >= 18`, `e.g. . >= 0 and . <= 120`,
      `e.g. ${price} * ${quantity}`).
- [x] **Export menu — PASS.** "XLSForm (.xlsx)" and "ZIP with
      attachments". Screenshot: `screenshots/scenB-export-menu.png`.
- [x] **Attachments dialog — PASS.** "Form attachments", explanatory copy,
      "No attachments yet.", "Upload files".
      Screenshot: `screenshots/scenB-attachments-dialog.png`.
- [x] **Translations dialog — PASS.** "Translations", "Languages", "Add
      language" (placeholders "French" / "fr"), "Default language",
      "(unset)", "Show in editor", "Show untranslated only", "Add a
      language on the left to start translating.".
      Screenshot: `screenshots/scenB-translations-dialog.png`.
- [x] **Form settings / Choice lists / Problems — PASS.** Also scanned:
      "Form settings" fields, "Choice lists" empty state ("No choice lists
      yet. Select questions create one automatically, or add one here."),
      Problems panel ("No problems found."). 0 key-like hits everywhere.

**Result: PASS.** No raw i18n keys (nothing like `shell.header.title` or
`common.cancel`) leak anywhere; every scanned surface reads as proper
English.

Minor observation (not an i18n leak): the Export split-button's dropdown
toggle in the editor toolbar has no accessible name — it snapshots as
`button [expanded=false]` with an empty label.

**Verified 2026-07-09/10** with agent-browser (headless Chromium) against
the production build served by `vite preview` on port 4181.
