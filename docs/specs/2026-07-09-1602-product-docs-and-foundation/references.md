# References for Spec 01

## Prototype assets (this repo, pre-rebuild)

### Field type registry
- **Location:** `src/components/field-type-registry.ts` (1,043 lines)
- **Relevance:** best prototype asset — 36 XLSForm types with category, Collect/Enketo flags, parameters, appearances, container flags.
- **Key patterns:** port to `src/core/registry/`, extend with per-type XForm mapping (bind type, body element, mediatype, preloads) and XLSForm token aliases.

### FieldInstance model
- **Location:** `src/components/FieldInstance.ts` (492 lines)
- **Relevance:** tree helpers (find/flatten/clone) and name validation regex to port into `src/core/model/ops.ts` / `src/core/validate/names.ts`. The `FieldConfig` shape itself is too lossy and is replaced.

### Old theme
- **Location:** `src/themes/odk-theme.js`
- **Relevance:** its Aura preset base (blue primary/slate surfaces) is directionally right; its `extend.odk.*` gradients and hover effects are exactly what NOT to keep.

## Ground truth

- `node_modules/@getodk/web-forms/dist/index.js` — injected `--odk-*` token block, preset colors, `webFormsPlugin` global reset. Re-verified against 1.0.0 in this spec (`scripts/verify-webforms-bundle.mjs`).
- `test-forms/all-widgets.xml` + `test-forms/ODK XLSForm Template.xlsx` — canonical fixtures, moved to `tests/fixtures/`.
- `xlsform-cheatsheet/` — XLSForm column/type/appearance surface (survey.md and choices.md are empty exports; the reconstructed union lives in the Spec 07 shape docs and the plan).
- https://getodk.github.io/xforms-spec/ — ODK XForms specification.
- https://docs.getodk.org/ — form question types, XLSForm docs.
