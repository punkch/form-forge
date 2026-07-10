# Entities Advanced — Manual Verification

Run `pnpm dev` and open the app.

| # | Steps | Expected |
|---|---|---|
| 1 | Create a form, add a Text question, open **⋯ → Form settings** | The dialog now has **General** and **Entities** tabs; General shows the familiar fields |
| 2 | On the Entities tab click **Set up entities**, type `households` as the list name and `${text}` as the entity label | Declaration fields appear (label, create when, update when, entity ID) with `${}` autocomplete |
| 3 | Close the dialog, select the Text question | The property panel shows an **Entity** section with a "Save to entity property" field and a "?" help popover explaining the `save_to` column |
| 4 | Type `label` into the save_to field | An inline error appears (reserved name, any casing); the Problems button shows the same error; a second question saving to the same property is also an error |
| 5 | Change it to `household_name` | Error clears; a hint says the value is saved to the `households` entity |
| 6 | Reopen settings → Entities | The **Saved properties** table lists `text → household_name`; clicking the question name closes the dialog and selects/reveals the question |
| 7 | Click **Set up follow-up form** | A `households` select-one-from-file question appears at the top of the form; Entity ID becomes `${households}` and "Update when" `true()`; one Ctrl+Z undoes all of it |
| 8 | Select the new question and upload a `households.csv` (`name,label,__version` columns), then open the preview | The form renders in the preview with the CSV rows as choices — no crash, no error banner |
| 9 | Export → XLSForm and re-import it | The entities sheet round-trips (list name, label, update_if, entity_id) and the save_to mapping is preserved |
| 10 | Export → XML | The model contains `entities:entities-version="2024.1.0"`, `<entity dataset="households" update="1" baseVersion="" trunkVersion="" branchId="" …>` and `@update`/version-pointer binds identical to pyxform 4.5.0 output |
| 11 | Remove the follow-up question (keep entity ID set) | Problems shows a warning that nothing selects from `households.csv` |
| 12 | On Entities tab click **Remove entity declaration** | Declaration and the Entity property-panel section disappear |
