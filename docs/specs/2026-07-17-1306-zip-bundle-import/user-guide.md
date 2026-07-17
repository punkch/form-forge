# Importing a form ZIP bundle — User Guide

## What it does

The library's **Import form** dialog now accepts `.zip` archives in addition
to `.xml` (XForm) and `.xlsx`/`.xls` (XLSForm). A form ZIP bundle is the
structure Form Forge itself exports from the editor's Export menu ("ZIP —
XForm" / "ZIP — XLSForm"):

```
form.xml            (or form.xlsx)   ← the form definition, at the root
media/photo.png                      ← one entry per attachment
media/districts.csv
```

Importing such a bundle restores the form **together with its attachments** —
the complete round trip of the app's own export.

## How to use it

1. In the form library, click **Import form**.
2. Drop or pick a `.zip` (or `.xml`/`.xlsx` as before).
3. Review the parse report (errors block import; warnings can be confirmed).
4. Click **Import**. If a form with the same form ID already exists you are
   offered:
   - **Import as copy** — a new form is created; the existing one is untouched.
   - **Replace existing** — after a confirmation, the existing form is
     overwritten in place. Its identity is kept, so any tracked ODK Central
     publish destinations stay attached to it.
5. The imported form opens in the editor; its files are listed under
   Form menu → Attachments.

## Notes and edge cases

- A **workspace archive** (`.formforge.zip`) is a different format (whole
  workspace backup/share). Dropping one here shows an error directing you to
  Settings → Import workspace.
- If a hand-built zip contains **both** `form.xml` and `form.xlsx`, the
  `form.xml` wins (it is the lossless format); a warning notes that the
  `.xlsx` was ignored.
- Media files in the zip that the form never references are still imported
  and listed in the Attachments dialog.
- Files the form references but the zip does not contain show up as
  "Missing" in the Attachments dialog and as warnings in Problems — upload
  them there.
- Entries outside `form.*` and `media/` (e.g. `__MACOSX/` junk or nested
  folders under `media/`) are ignored.

## Manual test scenarios

| # | Scenario | Expected |
| --- | --- | --- |
| a | Editor: add an image + a CSV attachment, export "ZIP — XForm", delete the form, import the downloaded zip | Form restored with both attachments; preview renders the image |
| b | Same round trip via "ZIP — XLSForm" | Same result (kind reported as XLSForm) |
| c | Import a bundle whose form_id already exists | Copy creates a second form; Replace (after the danger confirm) keeps the record id and its publish targets |
| d | Drop a `.formforge.zip` on Import form | Error "This is a Form Forge workspace archive…"; Import disabled |
| e | Zip without `form.xml`/`form.xlsx` | Error "does not contain a form.xml or form.xlsx"; Import disabled |
| f | Zip with an extra media file the form never references | Imports; file listed in AttachmentsDialog |
| g | Hand-built zip with BOTH `form.xml` and `form.xlsx` | form.xml imported; warning shown; button reads "Import anyway" |
