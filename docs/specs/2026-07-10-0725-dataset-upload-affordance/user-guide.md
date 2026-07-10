# Dataset Upload from the Property Panel — Manual Verification

Run `pnpm dev` and open the app.

| # | Steps | Expected |
|---|---|---|
| 1 | Create a form, add a "Select one from file" question from the palette | Property panel's Appearance section shows the Choices file input, a warning "No file uploaded yet" and an **Upload file** button; the problems button reports "…need an attached choices file" |
| 2 | Click Upload file, pick a local `fruits.csv` with `name,label` columns | The filename input fills with `fruits.csv`, the status flips to a green check "fruits.csv is attached", the problem clears |
| 3 | Open the preview pane | The select renders the CSV's labels as choices |
| 4 | Press Ctrl+Z once | Both the adopted filename AND the attachment ref revert together (single undo step) |
| 5 | Redo, then type `districts.csv` into the Choices file input | Status becomes a warning "districts.csv has not been uploaded yet"; button label reads **Upload file** |
| 6 | Upload a file named `something-else.csv` | It is stored as `districts.csv`; a hint explains the rename; status turns green |
| 7 | Upload another file while one is attached (button reads **Replace file**) | The ref is replaced; the old blob is deleted (check DevTools → IndexedDB → attachments: no orphaned record) |
| 8 | Add an "External CSV" question (csv-external), don't type a filename | Status warns that `<name>.csv` has not been uploaded (the serializer's default); placeholder shows the same name |
| 9 | Upload `fuel.csv` (columns `code,price`) on the csv-external question | Its name is adopted; add a Calculation `pulldata('fuel', 'price', 'code', '<code>')` and a note `… ${calculate}` — the preview shows the looked-up value |
| 10 | Open the Attachments dialog (editor ⋯ menu) | Files uploaded from the property panel are listed; dialog upload/delete still behaves as before |
