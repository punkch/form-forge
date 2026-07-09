# Spec 04: XForm Serializer & Live Preview — Shaping Notes

## Scope

The pyxform-parity XForm serializer (`src/core/xform/`) and the embedded
@getodk/web-forms live preview (panel + full-page + submission testing).

## Decisions

- **Goldens first**: 8 XLSForm fixtures were generated and converted with
  pyxform 4.5.0 *before* writing the serializer, pinning every convention
  (instance root `data`, `jr:template=""` + default repeat copy, itext id
  schemes, setvalue placement — model-level for first-load defaults,
  in-body for value-changed triggers, `odk:recordaudio` on
  `odk-instance-load`, entity meta block, `orx:max-pixels`/`odk:quality`
  bind attrs, `randomize()` wrapping). All 8 golden parity tests pass.
- **Canonicalized comparison** (tests/helpers/xml-canonicalize.ts):
  attributes sorted, expression whitespace normalized string-literal-aware
  (pyxform pads `${}` substitutions), itext `<text>` sorted by id,
  secondary instances sorted by id. Semantic equality, not byte equality.
- **Own XmlNode writer** — deterministic output, mixed content (labels with
  `<output/>`) rendered inline, `{ raw }` children for preserved fragments.
- **When a trigger is set, the calculation moves into the value-changed
  setvalue** and the bind loses its `calculate` attr (pyxform semantics).
- **Preview isolation**: OdkWebForm mounts in a child Vue app created per
  regeneration (`instanceKey` bump); `webFormsPlugin` installs its bundled
  PrimeVue into the child only. The web-forms chunk (~1.6MB gzip) is
  lazy-loaded on first preview.
- **Keep-last-good**: regeneration is debounced 500ms and gated on zero
  validation errors; when the form breaks, the previous preview stays
  interactive under an amber stale banner. Engine errors revert to the
  last successfully mounted XML.
- Submission callback contract verified against the bundle:
  `callback({ next: POST_SUBMIT__NEW_INSTANCE })` resets the instance.

## Context

- **References:** tests/golden/expected/*.xml (pyxform ground truth),
  node_modules/@getodk/web-forms/dist (callback + plugin behavior).
- **Verification:** `../../verification/spec-04-preview.md` — full
  agent-browser pass of the preview loop. 20 new tests (140 total).
