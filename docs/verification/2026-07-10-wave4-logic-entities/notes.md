# Wave 4 verification: visual logic builder + entities advanced (agent-browser)

Manual pass over the two Wave 4 features against the production build:
`pnpm build` (clean, exit 0) then `pnpm preview --port 4184` (static SPA,
fresh browser profile / empty IndexedDB). Form used throughout: blank form
"Wave4 Logic Test" with an Integer question `age` and a Text question `name`.

## Scenario A — visual logic builder (relevant on `name`)

- [x] **Step 1 — PASS.** New blank form "Wave4 Logic Test"; added Integer
      question renamed to **Age / `age`** and Text question renamed to
      **Name / `name`** from the palette.
- [x] **Step 2 — PASS.** With `name` selected, the LOGIC section shows
      **Relevant (skip logic)** with a Visual/Raw toggle. Clicking **Visual**
      shows *Add condition* / *Add group*. Adding a condition produces a row
      with a **Question dropdown** (defaulted to "Age (age)" — the only other
      field), an **Operator dropdown** (=, !=, <, <=, >, >=) and a typed
      **Value** input (numeric spinner because `age` is an integer). Set
      `Age (age) >= 18`. Screenshot: `screenshots/scenA-visual-condition-row.png`.
- [x] **Step 3 — PASS (preview hides `name` when age < 18).** In the live
      engine preview (real ODK Web Forms), with Age empty or 15 only the Age
      field renders — no "Name" input.
      Screenshot: `screenshots/scenA-preview-name-hidden.png`.
- [x] **Step 4 — PASS (preview shows `name` when age = 20).** Typing 20 into
      the preview's Age field makes the **Name** text input appear
      immediately; changing it back to 15 hides it again. Round-trip works
      against the real engine, no refresh needed.
      Screenshot: `screenshots/scenA-preview-name-shown-age20.png`.
- [x] **Step 5 — PASS (condition re-renders visually).** Selected `age`, then
      reselected `name`: the Relevant editor re-opens in **Visual** mode with
      the structured row `Age (age) | >= | 18` — not raw text.
- [x] **Step 6 — PASS (Raw ⇄ Visual round-trip without loss).** Switching to
      **Raw** shows exactly `${age} >= 18`; switching back to **Visual**
      restores the same structured row. No data loss either way.
- [x] **Step 7 — PASS (instance() locks the Visual tab).** Pasted
      `instance('ages')/root/item[name='adult']/value <= ${age}` into Raw.
      The **Visual** tab immediately becomes disabled (greyed out), with the
      explanation surfaced twice: an inline hint under the raw editor and a
      tooltip on hover — *"This expression uses features the visual builder
      can't show, so it can only be edited as text here."* Restoring
      `${age} >= 18` re-enables the Visual tab.
      Screenshot: `screenshots/scenA-raw-locked-visual-disabled.png`.

**Result: PASS (7/7).**

## Scenario B — constraint presets on `age`

- [x] **Step 1 — PASS (preset fills visual rows).** On `age`, the Constraint
      editor's **Common patterns** dropdown lists *Number between 0 and 100*,
      *Phone number (North American)*, *Email address*, *Letters only*.
      Picking **Number between 0 and 100** switches the constraint to Visual
      mode and fills two structured rows joined by an **All**/Any toggle:
      `This answer (.) >= 0` and `This answer (.) <= 100`, plus an empty
      Constraint message field.
      Screenshot: `screenshots/scenB-constraint-preset-applied.png`
      (retaken after Scenario C, hence the error badge in the toolbar).
- [x] **Step 2 — PASS (preview rejects out-of-range).** In the live preview,
      entered **150** for Age and clicked **Send**: submission is blocked
      with a red *"1 question with error"* banner and the field-level message
      *"This value doesn't meet the constraint."* Correcting to 20 clears the
      error and the banner.
      Screenshot: `screenshots/scenB-preview-constraint-rejected.png`.

**Result: PASS (2/2).**

## Scenario C — entities

- [x] **Step 1 — PASS (declare dataset).** Form settings (⋮ → Form settings)
      has an **Entities** tab with a "Set up entities" call-to-action.
      Declared list name **`households`** and entity label **`${name}`**;
      create_if / update_if / entity_id inputs all present with XLSForm-style
      placeholders. Screenshot: `screenshots/scenC-entities-tab-declared.png`.
- [x] **Step 2 — PASS (save_to + help popover).** On the `name` question the
      property panel gained an **ENTITY** section with *Save to entity
      property*. The `?` popover explains: *"Maps this answer to an entity
      property, so submissions can create or update shared entities that
      other forms read (ODK Entities)."* and names the XLSForm column
      `save_to`. Set the value to `household_name`.
      Screenshot: `screenshots/scenC-saveto-help-popover.png`.
- [x] **Step 3 — PASS (overview table + navigation).** The Entities tab's
      **Saved properties** table lists the mapping `name → household_name`;
      the question cell is a link. Clicking it closes the dialog and selects
      the `name` question in the tree.
      Screenshot: `screenshots/scenC-entities-overview-table.png`.
- [x] **Step 4 — PASS (follow-up wizard).** **Set up follow-up form** (enabled
      once the dataset is named) inserts a **Select one from file** question
      named `households` at the top of the form consuming
      **`households.csv`**, wires **Entity ID** to `${households}` and
      defaults **update_if** to `true()`; the dialog confirms *"Follow-up
      question added: households"*. All one undo step.
      Screenshots: `screenshots/scenC-followup-wizard-entityid-wired.png`,
      `screenshots/scenC-followup-question-selected.png`.
- [x] **Step 5 — PASS (reserved-name validation).** Changed `name`'s save_to
      to the reserved word **`label`**: the Problems badge flips to an error
      state and both the Problems popover and an inline red hint under the
      field read *"save_to must not be \"name\" or \"label\" (any casing) —
      those entity properties are set by the entity system itself."* The
      question card gets a red error marker and the preview banner says it is
      out of date until the error is fixed.
      Screenshot: `screenshots/scenC-reserved-name-problem.png`.

**Result: PASS (5/5).**

## Observations (non-blocking)

1. After the follow-up wizard runs, Problems shows the warning *"Attachment
   \"households.csv\" is referenced but has not been uploaded."* For an
   entity-list follow-up the CSV is served by Central at runtime, so this
   warning is arguably noise in the entity workflow — worth considering a
   suppression or a softer hint when the itemset file matches the declared
   entity list.
2. Automation-only quirks (not user-facing): PrimeVue InputNumber fields
   ignore synthetic `fill`/insert-text events (individual key presses work),
   and one programmatic click on "Set up follow-up form" was swallowed while
   the dialog re-rendered; a second click worked. Neither reproduces with
   real keyboard/mouse interaction patterns.
3. Preview containment held throughout: the unresolvable `instance('ages')`
   relevant expression did not crash the preview — the dependent question
   simply stayed hidden.
