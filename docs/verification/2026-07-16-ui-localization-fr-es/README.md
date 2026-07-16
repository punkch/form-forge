# Verification pass — French + Spanish UI localization (2026-07-16)

Per-locale contextual QA against the built app (`pnpm preview`, :4173), per
the acceptance bar in `docs/specs/2026-07-16-1125-ui-localization-fr-es/`:
strings reviewed in their rendered context, not word-for-word.

## Surfaces walked (both locales)

Settings (workspace/vault/language/appearance/about), library (header, empty
state, new-form dialog + template gallery), editor header (all clusters, Form
menu, zero-state Central), palette chrome, property panel (GENERAL/APPEARANCE/
LOGIC sections on real questions), export menu, attachments dialog (fr),
problems chip. Screenshots: `fr-settings.png`, `fr-library.png`,
`fr-editor.png`, `fr-properties.png`, `fr-attachments.png`,
`fr-editor-1100.png` → `fr-editor-1100-fixed.png`, `es-settings.png`,
`es-editor.png`, `es-properties.png`.

## Quality observations

- Translations describe what controls do, not literal word swaps:
  "Afficher/masquer la palette de questions" (toggle), "Pertinence (logique
  de saut)" (relevant explained as skip logic), "Instructions
  supplémentaires (guidance hints)" (keeps the ODK docs term as an aid),
  "L'importation n'écrase jamais les formulaires existants".
- Expression placeholders survive translation ("p. ex. ${age} >= 18");
  format tokens (XLSForm, XForm XML, .formforge.zip, ZIP) stay literal.
- French typographic conventions applied (« » with inner spacing, space
  before colon); Spanish uses its own conventions («» unspaced, no colon
  space) — deliberate per-language house style from the drafting round.
- Deliberately mixed-language surfaces render as designed: registry
  question-type names ("Text", "Integer"), palette category headings
  (INPUT/CHOICE/…) and parameter/appearance tokens stay English per the
  core-purity policy; documented in the spec's user guide.

## Findings + fix round

1. **Fixed — header overflow at 1100–1280 px**: "Toutes les modifications
   enregistrées" plus the longer fr/es action labels overflowed into the
   undo/redo cluster (`fr-editor-1100.png`). Per the settled posture (fix
   the layout, don't shorten the translation), `src/styles/builder.css`
   gained `html:is([lang='fr'],[lang='es'])`-scoped rules that engage the
   header's compact treatments (icon-only save indicator + icon-only
   Central toggle) at ≤1280 px instead of ≤1024 px for those locales
   (`fr-editor-1100-fixed.png`).
2. **Known limitation (follow-up)**: PrimeVue's built-in aria labels (e.g.
   the Dialog close button's "Close") come from PrimeVue's own locale
   config, not the app catalog, and stay English. Localizing them means
   feeding a per-locale PrimeVue `locale` option — noted as a small
   follow-up, orthogonal to the catalogs.
3. Plural behaviour (fr singular at count 0) and first-run
   `navigator.language` detection are pinned by `src/i18n/pluralRules.spec.ts`,
   `src/i18n/detectLocale.spec.ts` and the fr-CA e2e case rather than
   re-verified by hand here.
