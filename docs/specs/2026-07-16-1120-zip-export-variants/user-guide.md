# Exporting a ZIP with attachments — user guide

The editor's **Export** button offers four ways to get a form out of Form
Forge. Click the button for the primary action (XForm XML), or open the
dropdown (the small caret) for the rest:

1. **Export** (primary) — the XForm XML, `<formId>-<version>.xml`.
2. **XLSForm (.xlsx)** — the spreadsheet representation,
   `<formId>-<version>.xlsx`.
3. **ZIP · XForm XML + attachments** — a ZIP containing `form.xml` at the
   root plus a `media/` folder with every attached file (images, audio,
   video, CSV/GeoJSON datasets), downloaded as
   `<formId>-<version>-xform.zip`.
4. **ZIP · XLSForm + attachments** — a ZIP containing `form.xlsx` at the
   root plus the **same** `media/` folder, downloaded as
   `<formId>-<version>-xlsform.zip`.

Both ZIP downloads bundle every attachment the form uses — the XLSForm ZIP
is not filtered to only the files its own columns mention; it carries
everything the XML variant does, so either ZIP is a complete, self-contained
copy of the form.

## Why two ZIPs

Previously there was one ZIP export, always built around the XForm XML.
Teams that keep the **XLSForm spreadsheet** as their editable source of
truth — for pyxform-based tooling, or to hand a colleague something they can
open and edit in Excel/LibreOffice — had no single-download way to get the
`.xlsx` together with its media. Now either representation can be exported
complete with attachments in one click.

## A note on the download filename

If you've used the ZIP export before, its filename has changed: it used to
be `<formId>-<version>.zip` and is now `<formId>-<version>-xform.zip` (the
`-xform` suffix distinguishes it from the new `-xlsform` variant). The ZIP's
**contents are unchanged** — `form.xml` plus `media/`, exactly as before —
only the downloaded file's name is different, so existing scripts or
folders that watch for the old exact filename will need updating.

## What each ZIP is for

- Pass the **XForm ZIP** to anyone who needs the ready-to-publish XML plus
  its media, e.g. to manually upload to a Central project or archive
  alongside its assets.
- Pass the **XLSForm ZIP** to anyone working with the spreadsheet — pyxform
  users, or collaborators who prefer editing in a spreadsheet — while still
  giving them every attachment the form needs.

## What stays the same

- Both ZIPs are ordinary, unencrypted, single-use export files — they are
  **not** the same thing as the workspace backup (`.formforge.zip` from
  Settings → Export workspace), which is a different, versioned format
  covering your entire form library plus Central configuration. Neither ZIP
  export here can be re-imported (import still accepts XML, XLSForm, and
  the workspace archive).
- If the form has validation errors, all four export actions stay blocked
  (as today) until they're fixed — the Problems panel explains why.
- If any attachment referenced by the form has no stored file, that file is
  simply left out of either ZIP and you get a warning toast naming it — the
  export still completes.
- An embedding host that hides the ZIP export (`exports: { zip: false }` in
  the postMessage config) hides **both** ZIP menu entries — the host-facing
  configuration has not changed.

## Manual test scenarios (for the browser verification pass)

1. **Open the Export menu** on a form with at least one image/CSV
   attachment. Confirm the dropdown shows, in order: XLSForm (.xlsx), ZIP ·
   XForm XML + attachments, ZIP · XLSForm + attachments (below the primary
   XForm XML action).
2. **Download the XForm ZIP.** Confirm the filename ends in `-xform.zip`
   and, opening the archive, it contains `form.xml` at the root and
   `media/<each attachment>`.
3. **Download the XLSForm ZIP.** Confirm the filename ends in
   `-xlsform.zip` and, opening the archive, it contains `form.xlsx` at the
   root (opens as a valid spreadsheet) and the **same** `media/` folder as
   step 2.
4. **Remove/skip an attachment's stored file** (or use a form with a
   referenced-but-never-uploaded file) and download each ZIP variant.
   Confirm a warning toast names the missing file and the export still
   downloads successfully, without that file in `media/`.
5. **Trigger a validation error** on the open form (e.g. an unresolved
   reference) and confirm all four Export actions are blocked with the
   existing "fix errors before exporting" messaging.
6. **Embed mode:** with `exports: { zip: false }` set via the postMessage
   config, confirm neither ZIP menu entry appears, while XForm XML and
   XLSForm (.xlsx) remain visible (or the analogous individual-key checks
   for `xform`/`xlsform`).
