# Template & Backup UX Polish — User Guide

Small refinements to two recently shipped features: managing saved templates (the "New form"
gallery) and the whole-workspace backup. Nothing changes about how forms or backups are
stored — these are usability and correctness fixes.

## Re-importing a backup no longer duplicates your templates

Previously, importing the same workspace backup twice added a second copy of every saved
template to your gallery. Now, on import, any template whose **name and form design** exactly
match one you already have is skipped. The import success toast tells you both how many
templates were restored and how many were already present, so a repeat import is safe and
predictable.

Templates that are genuinely different (a different name, or the same name with different
content) are still restored.

## "Save a copy" gives the copy a distinct name

When you Save a form as a template under a name that already exists, you can choose
**Replace** (overwrite the existing one) or **Save a copy**. Save a copy now names the new
template `Name (2)` (or `(3)`, and so on) instead of creating a second template with the
exact same name — so your two entries are told apart at a glance.

## The Save-as-template dialog no longer jumps around

When you type a template name that's already taken, the dialog now:

- keeps the **Save template** button in place (disabled) instead of removing it, so the
  footer doesn't shift;
- shows a short hint — *"This name is already taken — choose Replace or Save a copy below."*;
- and, if you press **Enter** while the name collides, briefly highlights the
  Replace / Save-a-copy choice instead of doing nothing silently.

The Replace / Save-a-copy choice itself is unchanged.

## Editing a template tells you what it does (and doesn't) change

The template **edit** dialog (pencil icon in the New form gallery) now carries a hint that it
edits only the name and description. To change the form design behind a template, open a
form and use **Save as template → Replace**.

## Descriptions can span multiple lines

The description fields when saving a template and when editing one are now multi-line text
areas. Pressing **Enter** inserts a line break there. Pressing **Enter** in the *name* field
still confirms the dialog.

## Hover tooltips on the gallery's icon buttons

The hide, edit, and delete icons on the New form gallery cards now show a tooltip on hover
describing what they do (they already announced themselves to screen readers).

## The export screen tells you what's in the backup

**Settings → Export workspace** now shows a one-line summary of what the backup will contain
before you export — for example *"This backup will include 3 forms · 2 templates · app
preferences."* If you have Central servers configured they're listed too, and *saved
passwords* is added when you tick the credentials box. This makes it clear that your saved
templates travel with the backup.

---

## Manual test scenarios

1. **Idempotent template restore.** Save two templates. Export a workspace backup. Import it
   — both templates restore, the toast says "2 templates restored". Import the **same** file
   again — no new templates appear, and the toast indicates 2 were already present (0
   restored).
2. **Partial restore.** With one of the two templates deleted, re-import the backup — exactly
   one template is restored, one is reported already present.
3. **Save-a-copy suffix.** Save a template "Site visit". Save another form as a template,
   type "Site visit", choose **Save a copy** — a "Site visit (2)" appears. Repeat → "Site
   visit (3)".
4. **Stable footer.** Open Save as template, type an existing name — the Save button stays
   visible but disabled, the "already taken" hint shows, and Replace / Save a copy appear
   below. Clear the name back to a unique one — Save re-enables.
5. **Enter cue.** With a colliding name typed, press Enter in the name field — no template is
   saved and the Replace / Save-a-copy panel briefly flashes. In light and dark theme.
6. **Multi-line descriptions.** In both the Save-as-template dialog and the edit dialog,
   press Enter inside the description — a newline is inserted, the dialog does **not** submit.
   Press Enter in the name field — the dialog confirms.
7. **Edit hint.** Open the edit dialog on a saved template — the hint about name/description
   only is shown.
8. **Tooltips.** Hover the hide, edit, and delete icons in the New form gallery — a tooltip
   appears for each.
9. **Export summary.** In Settings, with some forms and templates (and optionally a Central
   server), read the export summary line — the counts match your workspace; ticking the
   credential box (vault unlocked) adds "saved passwords".
10. **Single import toast.** Import a backup that carries templates — exactly one success
    toast appears, its detail naming both forms and templates (no separate second toast).
11. **All existing testids still resolve.** Run the New form / Library / workspace-archive
    e2e and component suites to confirm no existing `data-testid` was renamed or removed.
