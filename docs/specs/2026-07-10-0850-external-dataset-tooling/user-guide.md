# External Dataset Tooling — Manual Verification

Run `pnpm dev` and open the app.

| # | Steps | Expected |
|---|---|---|
| 1 | Create a form, add a "Select one from file" question, upload a `villages.csv` with `name,label,district` columns from the property panel | Status turns green; the **Value** and **Label** parameter fields become dropdowns (still typeable) listing `name`, `label`, `district`; placeholders show `name`/`label` |
| 2 | Pick `district` as the value column | No problems reported (the column exists) |
| 3 | Type a misspelled column (e.g. `distrct`) into the Value field | The problems button shows a warning `The value column "distrct" does not exist in "villages.csv"`; clicking it selects the question |
| 4 | Clear the Value parameter on a CSV without a `name` column | A warning says the file has no `name` column and asks you to set the value parameter |
| 5 | Click **View file** next to Upload/Replace | A dialog shows the CSV as a table with its column headers; with a 500+ row file a banner says only the first 500 rows are shown; scrolling is smooth (virtualized) |
| 6 | Upload a `.geojson` FeatureCollection instead | Columns offered are `id`, the feature properties and `geometry`; placeholders show `id`/`title`; the preview table shows geometry types |
| 7 | Upload a malformed `.geojson` (invalid JSON) | No column warnings appear (unknown files are not judged); View file shows the parse error inside the dialog |
| 8 | Add a `choice_filter` such as `district=${d}` vs a misspelled `distict=${d}` | The misspelled column produces an info-level problem; `${refs}`, quoted strings and functions never do |
| 9 | Open the Attachments dialog (⋯ menu) | csv/geojson/xml rows have an eye button; clicking it opens the same preview; XML files render as raw text |
| 10 | Replace `villages.csv` with a file that has different columns | The dropdowns and validation update to the new columns after a moment (no reload needed) |
