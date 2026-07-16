# Parameter help popovers — user guide

Some question types take extra type-specific options in the properties
panel — a range's Start/End/Step, an image's Max pixels, an audit's Location
priority, a select's Randomize/Seed, and more. Each of these rows has a small
"?" next to its label. Clicking (or focusing and pressing Enter/Space) it now
opens a popover about **that specific option** — not a generic explanation of
the `parameters` column.

## What the popover shows

- **What the option does** — a plain-English description of that parameter.
- **Options**, when the parameter only accepts specific tokens (for example
  an audit's Location priority takes exactly `no-power`, `low-power`,
  `balanced` or `high-accuracy`) — shown even if the field is already a
  dropdown, since the dropdown alone doesn't show you the underlying value
  or confirm it's the exact string the form will store.
- **Default**, when the option has one — including for on/off switches:
  leaving a checkbox unticked is shown as, for example, "Default: false", so
  it's clear that leaving it alone is a real, meaningful choice, not an
  absence of one.
- A **Required** note when the option must be given a value.
- Where it lives in the exported form — the XLSForm `parameters` column and
  the exact key that option corresponds to, plus a reminder that the column
  holds several `key=value` pairs separated by spaces.

Hovering over the label (with a mouse) still shows a short tooltip as a quick
pointer-only preview; the popover is the full, complete version and also
works with touch and keyboard.

## Where this shows up

Any parameter row on any question type that has type-specific options —
range, the media types (image/audio/background audio), the select types and
their from-file variants, geopoint, and audit. The palette/property-panel
question-type help drawer (opened from the "?" next to a question's name, or
the header Help button's reference) already showed this same information in
a table for the whole type at once; this feature brings the same, single
source of information down to the individual field the user is currently
editing.

## What didn't change

- The Default value still appears as the input's placeholder text as before
  — the popover is additional information, not a replacement.
- The question-type help drawer's PARAMETERS table is unchanged.
- Help for other property-panel fields (name, appearance, relevant, choice
  list, and so on) is unchanged — only the type-specific parameter rows
  gained this parameter-specific detail.

## Manual test scenarios

Exercise each with `/agent-browser` against the built app:

1. **Options parameter.** Add an Audit question type. Open its "Location
   priority" row's "?". Confirm the popover shows a description, the four
   option tokens (`no-power`, `low-power`, `balanced`, `high-accuracy`), and
   a line naming the `parameters` column and the key `location-priority`.
2. **Boolean parameter with a false default.** Add a Select one question.
   Open the "Randomize" row's "?" (a checkbox parameter). Confirm the
   popover explicitly states the default is `false`, not just silence.
3. **From-file column parameter.** Add a Select one from file question with
   an attached CSV. Open the "Value" row's "?" (this row also renders as a
   dataset-column dropdown). Confirm the popover still shows the
   description and default (`name`) correctly alongside the dropdown.
4. **Hover still works.** With the mouse (not touch), hover over any
   parameter's label text (not the "?") and confirm the short tooltip still
   appears, unchanged from before this feature.
5. **Keyboard and touch reachability.** Tab to a parameter's "?" trigger and
   press Enter (or Space); confirm the popover opens without a mouse. On a
   touch-emulated viewport, confirm the trigger is tappable and the popover
   is positioned sensibly (not clipped off-screen) — this is the
   `/interface-craft` layout pass.
6. **No stale generic copy.** Search the running app for any remaining
   surface that still shows the old generic "Type-specific options such as
   a range's start, end and step…" copy — there should be none; every
   parameter row now shows its own description.
