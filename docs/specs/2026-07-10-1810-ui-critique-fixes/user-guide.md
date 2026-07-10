# User Guide — UI Critique Fixes

What changed for form authors, and how to test each change by hand.

## Smarter visual logic builder

- The field dropdown in a condition no longer offers *note* questions —
  notes can't hold answers, so a condition on one could never be true.
- A new condition now starts from the question **just above** the one you
  are editing (the most common thing to branch on), instead of the first
  thing in the form.
- If a condition compares against an empty value (e.g. `Region = ""`), the
  Problems check shows a **warning** naming the question. Warnings don't
  block preview or export — they're a nudge to finish the condition.

**Try it:** create a form from the Household survey template → select
"Village or neighbourhood" → Logic → Relevant → Visual → Add condition.
The field defaults to "Region"; leave the value empty and watch the ⚠ 1
appear in the header.

## Problems panel that says *where*

Each problem now shows a clickable **location chip** with the question's
label — clicking it jumps to and selects that question. Identical messages
(like a duplicate name reported for both questions) are grouped into one
entry with one chip per affected question.

**Try it:** give two questions the same Name; open the Problems button —
one entry, two chips.

## "Ready" state and export summary

- When a form has no problems, the header Problems button turns into a
  green **Ready** check.
- The Export dropdown starts with a one-line status: "N problems block
  export" or "Ready · N warnings · M untranslated".

## Canvas and header polish

- Long question labels wrap to two lines instead of being cut off.
- The skip-logic, constraint and calculation badges on cards now say what
  they are ("logic", "constraint", "calc") instead of bare icons.
- **Preview** and **Export** keep their text labels at laptop widths.
- The question-palette toggle uses a panel icon (no longer a hamburger);
  the too-small-screen page shows a monitor icon.

## Library and new-form dialog

- Form cards show a question-count chip, a language badge (e.g. "EN · FR")
  for multilingual forms, a formatted version ("v2026-07-10.1837") and an
  emphasized "Edited …" timestamp.
- In the New form dialog, a hint under the title field explains what's
  needed before **Create** enables.

## One help surface

The header **?** now opens the same right-side help drawer used by the
palette's per-type help — starting on a searchable list of all question
types; picking one shows the detail view with a back button. (The old
centered reference window is gone.)

## Known upstream issue (not fixed here)

In the live preview, a required number question can display "0" while
actually being empty, then complain "This field is required." on submit.
This is a bug in the `@getodk/web-forms` engine the preview embeds — a
ready-to-file issue is drafted in `upstream-issue-web-forms.md`.
