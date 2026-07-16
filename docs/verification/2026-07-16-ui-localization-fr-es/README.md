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

## Follow-up round (same day): question-type names localized

User feedback on the shipped pass overruled the "registry names stay
English" line above: palette items, palette category headings, canvas
type badges, the properties-panel header and the help-reference list now
render localized names from the new `types.*` catalog namespace
(`src/composables/useTypeLabels.ts`; registry text remains the pure-core
English source of truth, and en mirrors it verbatim —
`tests/unit/type-labels.spec.ts` pins three-locale coverage against the
registry). Parameter/appearance tokens and XLSForm type tokens stay
English by design (the help drawer still shows the raw token beside the
localized title).

- `es-type-names-editor.png` — es + dark: ENTRADA/OPCIONES/FECHA Y
  HORA/… palette groups, "Selección única desde archivo" items, canvas
  badges (Nota, Punto GPS, Grupo repetible), properties header "Nota".
- `fr-type-names-editor.png` — fr + light: SAISIE/CHOIX/MÉDIAS groups,
  "Choix unique depuis un fichier", badges (Groupe répétitif, Nombre
  entier), two-line palette items wrap cleanly.
- Palette/help search verified to match the localized title ("selección")
  AND the English title/token ("select_one", "Select one") in any locale.
- en re-checked byte-stable (Input/Choice/… and Text/Select one/… exactly
  as before — e2e strings unaffected).
- The dataset guide's fr/es step 1 quoted the English type names; updated
  to quote the new localized names.
