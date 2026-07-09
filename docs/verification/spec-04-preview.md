# Spec 04 verification checklist (agent-browser)

Run `pnpm dev`, open a form with text/integer/select questions, toggle Preview.

- [x] Preview button mounts the ODK Web Forms engine in the docked panel;
      the real engine renders our generated XForm (title, text input,
      integer spinner, radio choices, Send button, "Powered by ODK").
- [x] Label edit in the property panel reflects in the preview ≤1.5s.
- [x] Fill the form and Send → SubmissionResultDialog shows the actual
      instance XML with filled values and an engine-generated instanceID
      (verified: `<data id="preview_check"...><text>Tacos</text>...`).
- [x] Breaking an expression (unbalanced constraint) shows the amber
      "Preview is out of date" banner while the last good preview stays
      interactive; fixing the expression clears the banner and refreshes.
- [x] Console free of errors; odk-web-forms ships as a lazy chunk
      (~1.6MB gzip) loaded on first preview only.

**Verified 2026-07-09** with agent-browser (Chrome 150). Screenshot:
`screenshots/spec04-preview.png`.

## Golden parity

`tests/golden/` — 8 XLSForm fixtures converted with pyxform 4.5.0; our
serializer's canonicalized output is asserted equal for every one
(basic, structure, translated, cascade, widgets, entities,
defaults_trigger, submission). Regenerate with
`uv run --with openpyxl --with pyxform scripts/make-goldens.py`.
