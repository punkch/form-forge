# In-app guidance — User Guide & Manual Test Scenarios

This feature adds **workflow guides** to the help drawer, contextual "?" triggers
on feature home surfaces, and two dismissable first-use callouts. It is bundled
and offline; nothing is fetched at runtime except the optional "Read more" links
to docs.getodk.org.

## Where guidance shows up

- **Editor header Help ( ? )** — opens the help drawer. Its list now starts with a
  **Guides** section above the question-type reference. The search box filters
  guides and types together.
- **Library toolbar ( ? )** — opens the same drawer to the guides list (the
  library's only guide entry point).
- **Contextual "?" triggers** — Translations dialog header, the logic builder's
  mode header, the choices/dataset section, and the entity section each have a
  "?" that opens the drawer straight at the matching guide.
- **First-use callouts** — the Translations dialog and the logic builder's
  forced raw-mode show a one-time, dismissable panel; dismissal is remembered.

## Guide content outlines (source for Package A)

Each guide is task-oriented and step-numbered, adapted from the sources in
`references.md`. Titles/summaries below are indicative; final copy lives in
`guides.json`.

### `translations` — Translating a form
> Read the **post-translation-coverage** Translations surface first.
1. Open the Translations dialog; add a language by name (+ optional code) — it
   becomes a key like `French (fr)`. Adding the first language copies your
   existing text into it.
2. Set the **default language** — the one ODK treats as primary at fill time.
3. Use the **editing-language control** (in the properties panel) to choose which
   language the canvas and property fields edit; your edits save into that
   language.
4. Fill the grid: one row per translatable site, one column per language. The
   grid **shows empty sites** and highlights blanks.
5. **ODK has no fallback language** — a blank cell ships blank. Fill every string
   in every language you ship.

### `logic` — Visual logic builder
1. Select a question; open **Logic**. Relevant (skip logic) and Constraint each
   have a **Visual | Raw** toggle.
2. Build a condition visually: **Add condition** → pick question / operator /
   value (inputs adapt to the question's type).
3. Combine with **All | Any** (and/or) once there are 2+ rows; **Add group** for
   bracketed sub-logic.
4. Constraints target **This answer (.)**; a **Common patterns** menu fills
   number-range / phone / email / letters. Always set a constraint message.
5. Raw mode is the escape hatch: expressions the builder can't represent open in
   Raw with Visual disabled and are never rewritten. Verify in **Preview**.

### `datasets` — External datasets (CSV/GeoJSON)
1. Add a "Select one from file" (or External CSV) question.
2. Upload a local CSV/GeoJSON from the choices/dataset section; the "not
   uploaded" warning clears and the file attaches.
3. Map **Value** and **Label** to the file's columns (dropdowns list them).
4. Column typos and unknown-column filters raise a warning naming the file;
   click it to jump to the question.
5. **View file** opens a preview table (first 500 rows for big files). For
   `pulldata`, add a calculation and reference it in a note.

### `entities` — Entities & follow-up forms
1. Form settings → **Entities** → declare a list name and entity label.
2. On a question, use the **Entity** section's **Save to property** (`save_to`);
   reserved names like `label` error inline.
3. Review the **Saved properties** table (question → property).
4. **Set up follow-up form** inserts a select-one-from-file for the list, sets the
   entity id and update-when — undone by a single Ctrl+Z.
5. Upload the entity CSV to preview the follow-up choices; export round-trips the
   entities sheet.

### `backup` — Backing up your workspace
1. Library overflow menu → **Export workspace** downloads a `.formforge.zip`
   (all forms + attachments).
2. A single form's row menu → **Export form archive** for one form.
3. **Import workspace** → drop an archive; review the form list, then Import.
4. Import **never overwrites** — it mints fresh ids; re-importing duplicates.
5. Archives are unencrypted and exclude autosave/crash snapshots (working state,
   not content).

### `templates` — Starting from a template
1. Library → **New form** shows Blank plus bundled template cards (title,
   description, question count, label preview).
2. Blank flow is unchanged: type a title, press Enter.
3. Pick a template → confirm → **Create** opens a populated editor. Bundled
   templates are bilingual (switch language in preview).
4. A form's row menu → **Save as template** adds a **Local** template
   (attachments not included).
5. Local templates can be deleted (hover → trash); bundled ones can't.

### `autosave` — Autosave & crash snapshots
> Package A: confirm the real recovery entry point before writing a restore step.
1. Edits autosave to your browser after ~1.5s idle — no manual Save. The header
   indicator shows saving / saved / **Unsaved changes** / error.
2. Everything is local (IndexedDB); no network requests.
3. Leaving with unsaved edits warns before the tab closes/reloads.
4. Snapshots are separate point-in-time copies kept for crash recovery (last 20
   per form); Undo/Redo is a separate in-memory stack lost on close.
5. Backups (`.formforge.zip`) deliberately exclude snapshots.

### `keyboard` — Keyboard commands
1. **↑ / ↓** move focus between question cards (document order).
2. **Alt+↑ / Alt+↓** reorder the selected question.
3. **Alt+→ / Alt+←** indent (nest into the preceding group) / outdent.
4. **Delete** removes the focused question.
5. Panel resize: **Tab** to a split handle, **← / →** to resize (Shift = bigger
   steps), **Home / End** for min/max, **Enter** or double-click to reset.

## Callout copy (source for Packages A/C/D/E)

- **`translations`** (Translations dialog): "The editing-language control sets
  which language you're editing — your changes save into that language. ODK has
  no fallback language, so any label left blank ships blank. Fill every language."
  Includes a "Learn more" trigger to the `translations` guide.
- **`logicRaw`** (logic builder, forced raw): "This expression can't be shown in
  the visual builder, so it's staying in Raw. Editing the text keeps it in Raw;
  it's never rewritten." Includes a "Learn more" trigger to the `logic` guide.

## Manual test scenarios (verification pass → `docs/verification/`)

1. **Drawer guide list + search.** Editor header **?** → drawer opens → a
   **Guides** section lists all 8 guides above the type reference. Type `logic` →
   the list narrows to the visual-logic guide (and any matching type). Clear
   search → full list returns.
2. **Guide detail.** Click the visual-logic guide → detail view
   (`help-guide-logic`) shows title, summary, numbered steps, and (if present) a
   "Read more" link to docs.getodk.org. Back returns to the list.
3. **Contextual trigger — translations.** Open the Translations dialog → click
   the header **?** (`guide-trigger-translations`) → the drawer opens at
   `help-guide-translations`.
4. **Contextual trigger — logic.** Select a question, open Logic → the mode
   header **?** (`guide-trigger-logic`) opens the logic guide.
5. **Contextual trigger — datasets.** On a file-backed select, the dataset
   section **?** (`guide-trigger-datasets`) opens the datasets guide.
6. **Contextual trigger — entities.** On a question, the Entity section **?**
   (`guide-trigger-entities`) opens the entities guide.
7. **Library trigger.** From the library, the toolbar **?** opens the drawer's
   guide list (backup / templates / autosave reachable there).
8. **Translations callout lifecycle.** First open of the Translations dialog
   shows `guide-callout-translations` (display-language retargeting + no
   fallback). Dismiss it → gone. Close and reopen the dialog → still gone.
   **Reload the page**, reopen the dialog → still gone (persisted).
9. **Logic raw-mode callout.** Put an expression the builder can't represent into
   a relevance/constraint field → the builder forces Raw and shows
   `guide-callout-logicRaw`. Dismiss → gone, and stays gone for the other field
   and after reload.
10. **Byte-stable English.** No existing rendered string changed (only new guide
    keys added); `pnpm lint` (`no-missing-keys`) clean; `pnpm typecheck` clean.
11. **Offline / PWA.** `pnpm build` succeeds and the precache manifest generates
    within size expectations; guides render with the network offline (they are
    bundled strings). "Read more" links are the only network use.
