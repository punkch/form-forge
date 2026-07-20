# Template Management — User Guide

The "New form" gallery (Library → **New form**) offers four bundled starter templates plus
any templates you've saved from your own forms. This feature makes that gallery something
you can curate: safe deletion, editable templates, replace-on-save, and starters you can
hide and bring back.

## Delete a saved template (with confirmation)

1. Open **New form**.
2. On one of your saved templates, click the trash icon.
3. A confirmation dialog appears — **Delete template?** with the template's name and a
   warning that this cannot be undone.
4. Click **Delete** to confirm, or **Cancel** to back out. The template is only removed
   after you confirm; closing the dialog or clicking Cancel leaves it untouched.

## Hide a starter you don't use

1. Open **New form**.
2. On one of the four bundled starters, click the hide icon.
3. The starter disappears from the grid immediately. Nothing is deleted — bundled starters
   aren't stored records, they're just no longer shown to you on this device.

## Restore hidden starters

1. Open **New form**. If any starters are hidden, a line reads **Show hidden starters (N)**
   below the grid (N = how many are hidden).
2. Click it to expand the list of hidden starters.
3. Either:
   - Click the unhide control next to one starter to bring back just that one, or
   - Click **Restore all** to bring back every hidden starter at once.

## Rename a saved template

1. Open **New form**.
2. On one of your saved templates, click the pencil icon.
3. A small dialog opens with the template's current title and description, prefilled.
4. Edit either field and save. The card updates immediately; the template's underlying form
   design is unchanged — only its title/description metadata is edited.

## Replace a template instead of duplicating it

1. From an open form, use **Form menu → Save as template** (or the library row menu's
   **Save as template**).
2. Enter a name that matches one of your existing saved templates (case-insensitive).
3. The dialog shows a warning that a template with this name already exists, with two
   choices:
   - **Replace** — overwrites the existing template in place (same id, same creation date,
     new content and metadata).
   - **Save a copy** — keeps the existing template untouched and creates a second one
     alongside it (the previous behaviour).
4. Choosing neither and clicking Cancel leaves both the dialog and your templates
   untouched.

## Notes

- Hidden-starter state is a per-device preference — like your theme or interface language —
  not something stored per form. It travels with you if you export/import your whole
  workspace backup (Settings → Export/Import workspace), since it rides along in that
  backup's device-preferences section.
- Saved templates continue to be plain records you can delete, rename, or replace; bundled
  starters continue to be built into the app and can only be hidden/shown, never deleted or
  renamed.

## Manual test scenarios

1. **Delete confirm blocks the action.** Save a template from any form. Open New form,
   click its trash icon, click **Cancel** in the confirmation dialog — the template is
   still listed. Click the trash icon again, click **Delete** — the template is gone.
2. **Delete confirm dialog stacks correctly.** With New form open, trigger the delete
   confirm and verify it renders above the New form dialog, dismisses on Esc, and returns
   focus sensibly afterward. Repeat in both light and dark theme.
3. **Hide one starter.** Open New form, hide one bundled starter — it disappears from the
   grid, and "Show hidden starters (1)" appears below it. Expand the disclosure and confirm
   the hidden starter is listed there.
4. **Unhide one starter.** From the expanded hidden-starters list, click the unhide control
   on one starter — it reappears in the main grid and drops out of the hidden list (count
   decrements; the disclosure disappears entirely once the count reaches 0).
5. **Restore all.** Hide two or more starters, expand the disclosure, click **Restore all**
   — every starter reappears in the grid and the disclosure disappears.
6. **Hidden-starter state persists across reloads.** Hide a starter, reload the app — it is
   still hidden. Export a workspace backup, reset hidden starters, import the backup back —
   the starter is hidden again.
7. **Rename updates the card without touching the design.** Save a template, rename it to a
   new title/description via the pencil icon — the New form card reflects the new
   title/description immediately; opening the template still yields the original form
   design.
8. **Rename dialog stacks correctly.** With New form open, open the rename dialog and
   confirm it renders above the New form dialog with working focus and Esc, in both light
   and dark theme.
9. **Save-template collision offers Replace vs Save a copy.** Save a template named "Site
   visit". Save another template using the same name (any case, e.g. "site visit") — the
   collision warning appears with Replace/Save a copy. Choose **Replace** — the template
   list still shows one "Site visit" entry, now with the new content, and its original
   creation date is preserved (check via rename dialog or export, if surfaced). Repeat and
   choose **Save a copy** instead — two "Site visit" entries now exist.
10. **Save-template collision Cancel is a no-op.** Trigger the collision warning, click
    Cancel (or close the dialog) — no template is added or replaced.
11. **All existing testids still resolve.** Run the existing e2e suite touching the New
    form / Library flows (template creation, deletion via the library row menu, etc.) to
    confirm no existing `data-testid` was renamed or removed.
