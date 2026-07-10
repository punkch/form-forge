# Wave 3 verification: dataset tooling + help system + PWA basics (agent-browser)

Manual pass over the three Wave 3 features against the production build:
`pnpm build` (plain — no `VITE_E2E`, so the service worker registers as in
production), then `pnpm preview --port 4183` (static SPA, fresh browser
profile / empty IndexedDB). Build was clean (exit 0); `dist/sw.js`,
`dist/workbox-*.js` and `dist/manifest.webmanifest` all generated, and the
built `index.html` carries both `<meta name="theme-color">` and
`<link rel="manifest">`.

## Scenario A — dataset tooling for "Select one from file"

- [x] **Step 1 — PASS.** New form "Dataset Tooling Test" (blank), added a
      **Select one from file** question from the palette (CHOICE category).
      Question card appears on the canvas; name `select_one_from_file`.
- [x] **Step 2 — PASS.** Before upload, the APPEARANCE section renders the
      Value/Label parameter inputs as plain free-text boxes (placeholders
      `name` / `label`) and the choices-file field shows the missing state.
- [x] **Step 3 — PASS.** Uploaded a local `fruits.csv`
      (`name,label,region` header + rows apple/Apple/North,
      banana/Banana/South, cherry/Cherry/East) via the property panel's
      **Upload file** button (hidden `input[type=file]`). Status flipped to a
      green "fruits.csv is attached"; the button became **Replace file** and a
      **View file** button appeared.
- [x] **Step 4 — PASS.** The Value/Label parameter inputs turned into
      **dropdowns**. Opening the Value dropdown lists exactly the three CSV
      columns — `name`, `label`, `region`.
      Screenshot: `screenshots/scenA-value-dropdown-columns.png`.
- [x] **Step 5 — PASS.** Typed a bogus column name `not_a_real_column` into
      the Value parameter. The Problems toolbar badge went to **1** (amber
      warning triangle) and the Problems popover reads
      *"The value column "not_a_real_column" does not exist in "fruits.csv"."*
      — the `dataset.unknown-column` warning. Clicking the row selects the
      question node. Screenshot: `screenshots/scenA-problems-unknown-column.png`.
- [x] **Step 6 — PASS.** **View file** opens the dataset preview dialog
      titled `fruits.csv` with a table: headers name/label/region and all 3
      rows rendered (apple/Apple/North, banana/Banana/South,
      cherry/Cherry/East). Screenshot: `screenshots/scenA-dataset-preview-table.png`.

**Result: PASS (6/6).** Upload → columns parsed → parameter dropdowns,
unknown-column validation surfaced in Problems, and the file preview table
all work.

## Scenario B — help system

- [x] **Step 1 — PASS.** Header **Help** button (`?`) opens the browsable
      "Question type reference" dialog with a search box and category groups.
- [ ] **Step 2 — FAIL (search term "photo" finds nothing).** Searching
      **`photo`** shows the empty state *"No question types match your
      search."* — zero results. The type is titled **Image** (token `image`,
      description "Capture or select an image"), and `matchesTypeSearch`
      (src/help/search.ts) matches only title / type token / description, none
      of which contain "photo". Notably the entry's own help text literally
      begins *"Captures a photo…"*, so a user reasonably searching "photo"
      cannot reach it. Searching **`image`** surfaces the entry as expected.
      Screenshot: `screenshots/scenB-search-photo-nomatch.png`.
      **Suggested fix:** add a synonyms/keywords field to the registry (or fold
      the help `whatItDoes` text into the search haystack) so "photo" → Image,
      "gps" → Geopoint, etc.
- [x] **Step 3 — PASS.** Opening the **Image** entry (via `image` search)
      shows the detail view: **WHAT IT DOES** ("Captures a photo with the
      camera or picks one from the gallery…"), **IN XLSFORM**, and an
      **APPEARANCES** table (6 rows: new, new-front, draw, annotate,
      signature, ex:app) each with **Collect** and **Enketo** support badges.
      Screenshot: `screenshots/scenB-image-help-detail.png`.
- [x] **Step 4 — PASS.** The **Read more** link href resolves to
      `https://docs.getodk.org/form-question-types/#image-widgets` — a
      docs.getodk.org URL with the `#image-widgets` anchor. (Dialog footer also
      links "docs.getodk.org" as attribution.)
- [x] **Step 5 — PASS.** Closed the dialog; clicking a palette item's info
      icon (`?` on the **Image** row) opens the right-side per-type help
      **drawer** with the same content — title "Image"/token `image`, the
      appearances table with Collect/Enketo badges, and the same
      `#image-widgets` Read more link.
      Screenshot: `screenshots/scenB-palette-info-drawer.png`.
- [x] **Step 6 — PASS.** With the question selected, clicking the `?` popover
      on the **Relevant (skip logic)** field shows the field help popover:
      *"Skip logic: the question or group is shown only while this expression
      is true. Values of hidden questions are cleared on finalization…"* plus
      **XLSForm column `relevant`**.
      Screenshot: `screenshots/scenB-field-help-popover.png`.

**Result: 5/6 PASS, 1 FAIL.** The reference, per-type detail (behavior +
appearance badges + anchored docs link), palette-info drawer and field-help
popovers all work. The only failure is that the reference search does not
recognize the synonym "photo" for the Image type.

## Scenario C — PWA basics

- [x] **Step 1 — PASS.** In the page context: `link[rel="manifest"]` href is
      `/manifest.webmanifest`; `meta[name="theme-color"]` content is
      `#3e9fcc`.
- [x] **Step 2 — PASS.** `navigator.serviceWorker.getRegistration()` resolves
      **non-null** — active worker, scope `http://localhost:4183/`
      (installing/waiting both false). Built with plain `pnpm build`, so
      `swRegistrationAllowed()` returns true as in production. (`controller`
      is null on this first, uncontrolled load, which is expected — the
      registration itself is present.)
- [x] **Step 3 — PASS.** Library footer shows the app version
      **"ODK Form Builder v2.0.0-dev"** plus storage status. On a fresh
      profile storage is not yet persistent, so the footer renders the hint
      variant: *"Storage may be cleared under pressure — export a workspace
      backup"* (info icon). Screenshot: `screenshots/scenC-library-footer.png`.

**Result: PASS (3/3).** Manifest + theme-color present, service worker
registered, footer surfaces version + storage status.

## Overall

**14/15 steps PASS, 1 FAIL.** One functional gap found: the help reference
search matches only title/type/description, so the synonym **"photo"** returns
no results for the **Image** type even though its help copy is about photos
(Scenario B, step 2). Everything else in dataset tooling, the rest of the help
system, and PWA basics behaves as specified.
