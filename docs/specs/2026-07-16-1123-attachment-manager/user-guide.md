# Attachment manager — user guide

Form Forge's Attachments dialog (Form tools → Attachments) manages every
file the form references: choice files for "select from file" questions,
label images/audio/video, and external CSV/GeoJSON datasets. It now
supports renaming a file, replacing one row's file in place, safe
handling when an upload's name collides with an existing attachment, and
shows any file the form references but you haven't uploaded yet as a
Missing entry you can fill in one click.

## The list

Each row shows the file's name, its type and size, a reference count
("Referenced by 2 questions" / "Not currently referenced"), and — for CSV
and GeoJSON files — a preview button. The list always reflects exactly what
the form uses: a file you replace or an upload that failed never leaves a
stray duplicate row behind.

The list also shows what the form still **needs**: if a question references
a file that hasn't been uploaded — a choices file (including the implicit
`<name>.csv` a csv-external question expects) or a label image, audio or
video file named in the translations grid — that filename appears as a
**Missing** row. A Missing row has no type or size, carries the same
reference count, and offers a single **Upload** action: pick the file and
it is stored under exactly the name the form references (with the usual
"stored as" note if the file on your computer is named differently). Once
uploaded, the row becomes a normal attachment row. These rows always agree
with the problems panel — both derive "referenced" from the same scan.

## Renaming a file

Click **Rename** on a row to open a small dialog. Edit the name; the file
extension is fixed (shown after the name you're editing) so a rename can
never change what the file *is* — a CSV stays a CSV. The dialog shows how
many places in the form reference this file before you confirm.

Confirming a rename is one step, and one undo: the stored file's name
changes, and so does every place the form pointed at the old name — the
question's choices-file setting, any label image/audio/video that used
it, and (for a `csv-external` question with no separately set choices
file) the question's implicit `<name>.csv` reference, which becomes an
explicit one under the new name. Nothing is left pointing at a name that
no longer exists.

Renaming to a name already used by another attachment, an empty name, or a
name containing a path separator is rejected with an inline message before
you can confirm.

## Replacing one file

Click **Replace** on a row to pick a new file for that entry. Whatever file
you pick is stored under the **row's existing name** — every question that
references it keeps working without further changes. If the file you
picked has a different name on your computer, a small note says so
("Stored as sites.csv (was export_2026.csv)"), the same notice already
used when uploading a choices file from the question's own properties
panel.

## Uploading new files

**Upload files** (the dialog's footer button) adds one or more files. If a
file's name matches something already attached, uploading stops for that
file and asks what to do:

- **Replace** — today's default behaviour, now explicit: the new file
  takes over that name, keeping every reference to it working.
- **Keep both** — the new file is stored under an automatically suffixed
  name (`name-2.ext`, or the next free number if `-2` is also taken) so
  nothing is overwritten and every filename in the form stays unique.
- **Skip** — the new file is not added; nothing changes.

When several files in one batch need a decision, you can tick **Apply to
all remaining** and pick one of the three actions once — it then applies
to every other conflicting file in that batch without asking again.

## What doesn't change

Deleting a row still removes the reference immediately (still one undo
step). Replaced files stay recoverable via **Undo** for the rest of the
session — the superseded copy is only cleaned up once you close the form,
or (new) the next time you open the Attachments dialog, whichever comes
first; either way, anything still reachable through undo/redo is protected
and never removed early.

## Manual test scenarios (verification pass)

Drive these through `/agent-browser` against the built app and log
screenshots/notes to `docs/verification/2026-07-16-attachment-manager/`.

1. **Bug fix regression** — new form → Attachments → upload `sites.csv` →
   upload `logo.png` → upload a *different* `sites.csv` again. Header must
   stay "Saved"/"Saving", never "Save failed"; the list shows exactly two
   rows (`logo.png`, `sites.csv`, the new one); a further edit (e.g. add a
   question) must save normally.
2. **Rename** — rename a CSV attached to a `select_one_from_file` question
   to a new stem; confirm the question's choices-file setting and the
   properties-panel "attached" status both follow the new name; undo
   restores the old name everywhere.
3. **Rename validation** — attempt an empty name, a name with `/`, and a
   name colliding with another attachment; each is rejected inline without
   closing the dialog. Confirm the extension portion cannot be edited.
4. **Rename with implicit reference** — a `csv-external` question with no
   explicit choices file (relying on `<name>.csv`); rename that file and
   confirm the question now has an explicit choices-file setting pointing
   at the new name, and the properties panel still shows "attached".
5. **Per-row replace, same name** — replace a row's file with a new file
   of the same name; no "stored as" notice appears; the question(s)
   referencing it still work.
6. **Per-row replace, different name** — replace a row's file with a
   differently named file from disk; the "stored as" notice appears; the
   row's filename (and every reference to it) is unchanged.
7. **Upload conflict — Replace** — upload a file whose name matches an
   existing attachment; choose Replace; confirm the row updates in place
   and no duplicate row appears.
8. **Upload conflict — Keep both** — same setup; choose Keep both; confirm
   a new row appears with a `-2` suffix (or the next free number) and the
   original row is untouched.
9. **Upload conflict — Skip** — same setup; choose Skip; confirm nothing
   changes and no new row appears.
10. **Multi-file conflict batch with "Apply to all remaining"** — upload
    several files at once where two or more collide with existing
    attachments; tick "Apply to all remaining" and choose Keep both once;
    confirm every conflicting file in the batch is suffixed without
    further prompts, and non-conflicting files in the same batch upload
    normally.
11. **Reference count badge** — attach a file referenced by two questions
    and one choice list's choice media; confirm the row's count reflects
    all three; add/remove a reference and confirm the count updates on
    reopen.
12. **Orphan sweep on open** — replace a file, then (without closing the
    form) reopen the Attachments dialog; confirm the superseded record is
    still restorable via Undo (i.e. not pruned) because it is protected by
    undo history, even though the dialog just ran its open-time sweep.
13. **Existing e2e flows** — `dataset-tooling.spec.ts` and
    `workspace-archive.spec.ts` still pass end to end (navigation updated
    per the `editor-toolbar-declutter` coordination note if that stream has
    already landed).
14. **Missing required attachment** — add a `select_one_from_file`
    question pointing at `villages.csv` without uploading it; open
    Attachments and confirm a Missing row for `villages.csv` (status chip,
    reference count, no delete/rename/preview); the problems panel shows
    the matching missing-file issue. Upload via the row's Upload button
    (pick a file with a different on-disk name): the row becomes a normal
    row under `villages.csv`, the "stored as" note appears, and the
    problems-panel issue clears.
15. **Missing implicit csv-external** — add a `csv-external` question
    named `sites` with no explicit choices file and no uploads; confirm a
    Missing row for `sites.csv` appears and resolves the same way.
