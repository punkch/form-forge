# Draft upstream issue — @getodk/web-forms

Ready to file at https://github.com/getodk/web-forms/issues. Not filed
automatically; review and submit manually.

---

**Title:** Required integer input renders "0" while its value is empty, so
the field looks filled but fails required-validation

**Body:**

## Description

A required `integer` question renders `0` in the number input when its
underlying value is empty. Submitting the form then reports
"1 question with error … This field is required." directly beneath a field
that visibly shows a value. The displayed widget state and the engine's
value state contradict each other.

Additionally, programmatic value changes that set the input's `value`
property and dispatch `input`/`change` events are not always committed to
the engine (relevant for automated testing against forms rendered by
web-forms).

## Steps to reproduce

1. Load a form containing a required `integer` question (e.g.
   `<bind nodeset="…/household_size" type="int" required="true()"/>`).
2. Observe the number input renders `0` without any user interaction.
3. Leave the field untouched and submit.
4. Error banner appears: "1 question with error"; the field shows
   "This field is required." while still displaying `0`.

## Expected

An empty integer value renders an empty input (or a placeholder), so the
required-error appears only under fields that actually look empty.

## Environment

- `@getodk/web-forms` 1.0.0 (bundled preset, Vue 3.5.39)
- Observed inside the Form Forge for ODK builder's live preview
  (chromium, linux), 2026-07-10.

*(Attach `visuals/26-preview-field-error.webp` from this spec folder as the
screenshot.)*
