# Verification pass — attachment manager (2026-07-16)

Agent-browser session against the built app (`pnpm preview`, :4173). Spec:
`docs/specs/2026-07-16-1123-attachment-manager/` (scenarios from its
user-guide.md).

## Checked

- **Save-poisoning regression (the original bug repro)**: upload
  `sites.csv` → `logo.png` → a different `sites.csv` again. The re-upload
  now stops at the explicit conflict dialog (`conflict-dialog.png`); choosing
  **Replace** lands with the save indicator at "All changes saved" (never
  "Save failed") and exactly one `sites.csv` row. A follow-up question edit
  saved normally.
- **Missing required attachments** (`missing-row-and-list.png`): a
  `select_one_from_file` question pointing at `villages.csv` (not uploaded)
  produced a **Missing** row — amber chip, "Used by 1 question", hint text,
  a single Upload action, and no rename/delete/preview verbs. The problems
  chip showed the matching warning. Uploading a file with a different
  on-disk name (`villages-export.csv`) via the row stored it under
  `villages.csv`, showed "Stored as villages.csv (was villages-export.csv).",
  flipped the row to a normal one, cleared the panel warning, and the
  uploaded CSV drove the live preview's choice list.
- **Rename** (`rename-modal.png`): modal opens with the stem editable and
  `.csv` rendered as a locked suffix; "Renaming will update 1 reference."
  (the count prop). Renaming `villages.csv` → `places.csv` rewrote the
  question's choices file, kept the "attached" status, and the row followed.
- **Keep both** (`keep-both-result.png`): re-uploading `sites.csv` and
  choosing Keep both produced `sites-2.csv`, original untouched.
- Reference-count badges render Not referenced / Used by 1 question /
  Used by N questions correctly across the list.

Conflict apply-to-all, skip, orphan-sweep protection and validation
rejections are covered by the 27-case component spec
(`tests/component/attachments-dialog.spec.ts`) and the both-backend store
regression tests.

## Interface-craft findings

None actionable — the two new overlays (rename modal, conflict dialog)
match the app's small-modal idiom; the Missing row was judged the
standout affordance (validator warning converted to a fix at the point of
care).
