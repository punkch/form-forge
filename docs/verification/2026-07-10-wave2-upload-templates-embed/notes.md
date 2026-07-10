# Wave 2 verification: dataset upload + templates + iframe embed (agent-browser)

Manual pass over the three Wave 2 features against the production build:
`pnpm build`, then `pnpm preview --port 4182` (static SPA, fresh browser
profile / empty IndexedDB).

## Scenario A — choices-file upload for "Select one from file"

- [x] **Step 1 — PASS.** Created blank form "Dataset Upload Test", added
      a **Select one from file** question from the palette (CHOICE
      category). Question card appears on the canvas with name
      `select_one_from_file`.
- [x] **Step 2 — PASS.** Property panel APPEARANCE section shows the
      missing-file state: field "Choices file (csv / xml / geojson)"
      with placeholder `e.g. districts.csv`, an amber warning "No file
      uploaded yet" and an **Upload file** button. The Problems badge
      shows **1** and the popover reads "Select one from file questions
      need an attached choices file."; the question card is
      error-highlighted. Screenshot: `screenshots/scenA-missing-file.png`.
- [x] **Step 3 — PASS.** Uploaded a local `fruits.csv`
      (`name,label` header + rows apple/Apple, banana/Banana,
      cherry/Cherry) via the panel's Upload button (hidden
      `input[type=file]`). Status flipped to a green
      "fruits.csv is attached", the filename field now reads
      `fruits.csv` and the button became **Replace file**.
- [x] **Step 4 — PASS.** Problems cleared: toolbar badge replaced by the
      green check, popover reads "No problems found."
- [x] **Step 5 — PASS.** Live preview renders the real engine with the
      select and all 3 choice labels — Apple, Banana, Cherry — as radio
      options. Screenshot: `screenshots/scenA-attached-preview.png`.

**Result: PASS (5/5).** Missing state → upload → attached, problems
clear, choices flow into the preview.

## Scenario B — starter templates + save as template

- [x] **Step 1 — PASS.** Library → **New form** opens a gallery dialog:
      "Blank form" card on top, then "Or start from a template" with the
      4 starter templates — Household survey, Individual registration,
      Site monitoring visit, Feedback & satisfaction — each with a
      description, question count and content preview line, all noted
      "Bilingual English/French". Screenshot: `screenshots/scenB-gallery.png`.
- [x] **Step 2 — PASS.** Selected **Household survey** (title auto-filled
      "Household survey") → Create. Editor opens with the full template:
      intro note, Date of interview, Region (select_one, 4 choices),
      Village or neighbourhood, Household location (geopoint), head-of-
      household fields, a "Household member" repeat (name/age/sex),
      water source, dwelling ownership, comments — 13 questions.
- [x] **Step 3 — PASS.** 0 error problems: toolbar shows the green check
      and the Problems popover reads "No problems found."
- [x] **Step 4 — PASS.** Live preview renders the whole form via the
      engine: language picker "English (en)", required markers, the
      Region choices (North/South/East/West), the repeat with "Add
      Household member", and the Send button.
      Screenshot: `screenshots/scenB-instantiated-editor.png`.
- [x] **Step 5 — PASS.** Back to library → row menu for "Household
      survey" contains **Save as template**. Dialog pre-fills the
      template name; saved as "Household survey (local)" with
      description "Saved from wave-2 verification pass".
- [x] **Step 6 — PASS.** New form gallery now shows the saved template
      with a **Local** badge, its description, "13 questions", the
      content preview line and a per-template delete (trash) button.
      Screenshot: `screenshots/scenB-gallery-local.png`.

**Result: PASS (6/6).** Gallery, instantiation with zero problems and a
working preview, and local save-as-template roundtrip all work.

## Scenario C — iframe embed protocol (embed-demo.html)

- [x] **Step 1 — PASS.** Opened `/embed-demo.html`. Host page shows the
      control row (Init, "all exports disabled" checkbox, Load sample,
      New form, Save (archive), Load back saved archive) plus the
      message log; the iframe posted
      `{"type":"ready","appVersion":"2.0.0-dev"}` on load.
- [x] **Step 2 — PASS.** **Init** → host sends `init`
      (`persistence: "memory"`), iframe answers `init-result ok,
      protocolVersion 1`.
- [x] **Step 3 — PASS.** **Load sample (object)** → `load-form` with the
      object doc, `load-form-result ok, issues: []`. The iframe shows
      the editor with the sample questions "Visitor name" (text) and
      "Visitor age" (integer), pane tabs Canvas / Properties / Preview,
      and **no library nav** — no "Back to forms" button, no form
      library anywhere in the embedded chrome.
      Screenshot: `screenshots/scenC-after-load.png`.
- [x] **Step 4 — PASS.** Edited the label to "Visitor full name" in the
      Properties pane → message log shows
      `{"type":"state-changed","dirty":true,"errorCount":0}`.
- [x] **Step 5 — PASS.** **Save (archive)** → `save-form-result ok` with
      an ArrayBuffer payload (1770 bytes). Host page renders the meta
      block: `formId: embedded_sample`, `title: Embedded sample`,
      `version: 1`, `errorCount: 0`, `warningCount: 0`, `bytes: 1770`
      plus a "Download archive" link, and "Load back saved archive"
      became enabled. Screenshot: `screenshots/scenC-after-save.png`.
- [x] **Step 6 — PASS.** **Load back saved archive** →
      `load-form-result ok, issues: []` and the canvas shows the edited
      question "Visitor full name" — the edit persisted through the
      archive roundtrip.
- [x] **Step 7 — PASS.** Checked "all exports disabled" → **Init** →
      host sends `exports: {xform:false, xlsform:false, zip:false}`,
      `init-result ok`. The Export split button (download icon + "More
      export options") vanished from the iframe toolbar; the rest of
      the editor is intact.
      Screenshot: `screenshots/scenC-exports-disabled.png`.

**Result: PASS (7/7).** Handshake, load/save/load-back roundtrip,
state-changed events, host-rendered meta and the exports kill-switch all
behave.

**Observation (cosmetic, host demo page only):** the message-log line
for the archive load-back renders the outgoing payload as
`[ArrayBuffer 0 bytes]` — the buffer is transferred to the iframe by
`postMessage` and is already detached when the demo logs it. The load
itself succeeds (`load-form-result ok`, edits persist), so this is a
logging artifact in `embed-demo.html`, not a protocol bug.

## Overall

**18/18 steps PASS.** No functional problems found in the wave-2
features.
