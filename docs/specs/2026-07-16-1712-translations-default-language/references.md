# References — retire the "Default" language column

## Codebase anchors (verified 2026-07-16, pre-change)

### Core model

- `src/core/model/types.ts:23` — `DEFAULT_LANG = 'default'`, a KEY inside
  `LocalizedText = Partial<Record<Lang, string>>` alongside real language
  keys; `doc.languages` excludes the sentinel (except the parser edge case
  below); `settings.defaultLanguage?: Lang`.
- `src/core/model/translations.ts` — `transformLocalizedTexts` (:47, the one
  doc-wide walker: labels/hints/guidance/bind messages/node+choice media/
  translated customColumns/choice labels), `addLanguage` (:88, previously
  COPIED default→first language keeping the default copy — now moves),
  `removeLanguage` (:105), `collectTranslationSites` (:189), `setSiteText`
  (:266), `translationStats` (:298), `siteKey` (:236).
- `src/core/model/display.ts` — `displayText` fallback chain (requested →
  sentinel → first non-empty), `exactText` (no fallback, grid cells),
  `documentPreviewLabels` (:28, library cards).
- `src/core/model/factory.ts:50-53,83,93` — seeded labels ("Text question",
  Option 1..3) previously under DEFAULT_LANG unconditionally.
- `src/core/model/migrate.ts:43` — `migrateDoc`, the load seam for archive
  read (`src/core/workspace/archive.ts:259`), templates
  (`src/templates/index.ts:26`, `src/components/library/NewFormDialog.vue:100`),
  embed bridge (`src/embed/bridge.ts:223`).
- `src/stores/form.ts:213-227` — `load()` clones from Dexie WITHOUT
  migrateDoc; normalization is applied there separately.
- `src/core/import-form.ts:15` — `parseFormFile` (XForm + XLSForm imports);
  `src/core/central/import.ts:65` — Central import parseXForm.

### Engine (deliberately untouched)

- `src/core/xform/serializer.ts:92-96` — `textIn = text[lang] ??
  text[DEFAULT_LANG]` fallback; `:186-190` `default="true()"` on the first
  translation; `:576-582` `useItext` + langs list with
  `settings.defaultLanguage` hoisted first.
- `src/core/xform/parser.ts:497-502,536,678,693` — inline labels → sentinel
  key; itext langs verbatim INCLUDING a literal `'default'` into
  `doc.languages` — pinned by `src/core/xform/parser.spec.ts:55-57`
  (all-widgets pyxform fixture). Normalization guards on
  `languages.includes(DEFAULT_LANG)` and never runs inside the parser (the
  round-trip gates call parseXForm→serializeXForm directly).
- `src/core/xlsform/row-model.ts:64-83` — bare column ↔ sentinel key; only
  `::Lang` suffixed columns enter `doc.languages` (round-trip asymmetry:
  a literal named `'default'` collapses back to the sentinel through XLSX).
- `src/core/xlsform/writer.ts:71-110` — bare + `::Lang` column emission.

### UI surfaces

- `src/components/translations/TranslationGrid.vue:95-96,112-120` — the
  hardcoded Default `<th>` + per-row sentinel cell
  (testid `cell-<siteKey>-default`).
- `src/components/translations/TranslationsDialog.vue:45,65-81,185-212` —
  add/remove language, Default-language select (was show-clear),
  Show-in-editor select (was `[Default(null), …langs]`).
- `src/components/properties/PropertyPanel.vue:35-51,86-98` — editing-language
  select (testid `panel-editing-language`), rendered only when languages
  exist.
- `src/composables/useEditingLanguage.ts` — `displayLanguage ?? DEFAULT_LANG`
  (pre-change); the seam through which panel edits pick their write key.
- `src/components/properties/LocalizedInput.vue:37-43` — fallback-as-
  placeholder; `TreeNodeCard.vue:33`, `ProblemsButton.vue:37` — canvas/problems
  display language.
- `src/components/properties/ChoicesSection.vue:75` — `addChoice` seeds
  `label: {}` (language-neutral, unaffected).

### Tests that pinned the old behavior

- `src/core/model/translations.spec.ts:175-241` (copy-keeps-default →
  rewritten to move semantics), `tests/component/translations.spec.ts:58-65,161-243`,
  `tests/component/display-language.spec.ts`, `tests/e2e/translations.spec.ts:44,67,102-196`,
  `tests/unit/translation-roundtrip.spec.ts:98-115`,
  `src/core/xform/parser.spec.ts:55-57` (unchanged),
  `src/core/xlsform/reader.spec.ts:75-87` (unchanged),
  `src/core/validate/validate.spec.ts:116-133`.
- `tests/golden/expected/translated.xml` — two NAMED languages, zero inline
  labels, `default="true()"` on English: the mixed shape was never golden-
  covered, so model-level changes keep goldens byte-stable.

## ODK ecosystem research (2026-07-16, cited)

- **XLSForm / ODK docs** — https://docs.getodk.org/form-language/ and
  https://docs.getodk.org/guide-form-language/: a bare column in a
  multi-language form "will be treated as if it were a separate language"
  (shown as "Default" in clients); remedy: "all columns that can be made
  multi-lingual need to be created as such". `default_language` (settings)
  takes `Language Name (code)`; unset ⇒ first language. "Blank cells in a
  language-specific column will be blank in the form when that language is
  active, even if the 'default' column has a value" — no fallback.
- **ODK XForms spec** — https://getodk.github.io/xforms-spec/: translations
  are itext `<translation lang="…">` (lang required — no anonymous default);
  `default=""` attr or first-listed wins; inline `<label ref=…>fallback</label>`
  intermix is spec-legal (rare; pyxform never emits it; our parser tolerates).
- **pyxform** — https://github.com/XLSForm/pyxform issues #157, #609;
  https://forum.getodk.org/t/missing-default-language-warning/25732;
  `pyxform/survey.py` `_add_empty_translations`: bare+named mix ⇒ a language
  literally named "default"; every itext gap padded with `"-"` ("disables any
  of the default_language fallback functionality"); warning "Translations are
  incomplete: languages French (fr) and default are missing columns";
  `default="true()"` emitted for the default language.
- **Clients** — Collect/Enketo/@getodk/web-forms populate the language picker
  from the itext translation list; mixed forms show a phantom "Default"
  entry; a missing string renders blank/dash; `default_language` only
  pre-selects.
- **KoboToolbox** — https://support.kobotoolbox.org/language_xls.html,
  https://support.kobotoolbox.org/language_dashboard.html: "to add
  translations to an XLSForm, first define the default language"; existing
  text belongs to the named default; no Default pseudo-column.
- **ODK Build** — https://github.com/getodk/build/issues/260: its uncoded
  default language name made ODK Central reject forms ("language declarations
  do not contain valid machine-readable codes") — evidence that an unnamed/
  uncoded default is a liability.

## Prior specs in this repo

- `docs/specs/2026-07-10-2006-translation-coverage/` — built the current grid
  (site collection, rarely-used toggle, LocalizedInput, editing-language
  control) this spec reshapes.
- `docs/specs/2026-07-16-1125-ui-localization-fr-es/` — fr/es glossary for
  the new catalog strings.
