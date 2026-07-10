# References — Full translation coverage & per-language editing

Real files studied during shaping, with why each matters and what to reuse.

## Core model — the heart of the change

### `src/core/model/translations.ts`
- **Relevance/purpose:** owns `collectTranslationSites`, `TranslationSiteRef`,
  `setSiteText`, `siteKey`, `translationStats`, `NodeTextField`,
  `NODE_FIELD_TITLES`, `transformLocalizedTexts`, `addLanguage`,
  `removeLanguage`, `languageKey`/`languageCode`.
- **Key patterns to extend (WP1):** `collectTranslationSites` currently filters
  with `hasAnyValue` (line ~145) — replace with per-field relevance. The
  `TranslationSiteRef` union (line ~111) and `siteKey` (line ~175) get media
  kinds. `setSiteText` (line ~181) gets media handling. `NODE_FIELD_TITLES`
  (line ~122) is the "core emits English display strings" precedent for the new
  `MEDIA_SLOT_TITLES`. `transformLocalizedTexts` (line ~38) already walks node
  media + choice media + custom columns — proof the model is complete; **do not
  change it**.

### `src/core/model/display.ts`
- **Relevance:** `displayText` (fallback chain), `exactText` (no fallback, used
  by grid cells), `setText` (writes/removes a single language key — `value===''`
  deletes `next[lang]`). The whole per-language editing behaviour rests on
  `exactText` for the value and `displayText` for the placeholder. `setText`'s
  "empty removes only that key" is the acceptance "clearing removes only the
  selected language" — reuse it everywhere; don't reimplement.

### `src/core/model/types.ts`
- **Relevance:** `LocalizedText = Partial<Record<Lang, string>>`,
  `DEFAULT_LANG = 'default'`, and `MediaRefs { image?, audio?, video?, bigImage? }`
  (each a `LocalizedText`) on both `BaseNode.media` and `Choice.media`.
  `BindProps.constraintMessage`/`requiredMessage` are `LocalizedText`. The
  `MediaSlot` type WP1 adds mirrors `MediaRefs`'s keys.

## Translation grid + dialog (WP3 owns the grid)

### `src/components/translations/TranslationGrid.vue`
- **Relevance:** the surface WP3 changes. `sites` = `collectTranslationSites`,
  `stats` over `sites` (unfiltered — keep this "denominator independent of
  untranslated-only" behaviour), `rows` = untranslated filter, `editCell` →
  `setSiteText` via `form.mutate(..., { coalesce: true })`. Cells already use
  `exactText` with `cell-missing` highlight and `data-testid` `cell-${siteKey}-${lang}`
  / `-default`, rows `row-${siteKey}`, headers `lang-header-${lang}` +
  `lang-completeness-${lang}`. **Preserve these testids** (e2e depends).
- **Reuse:** the toolbar/checkbox pattern for the new "Show rarely-used fields"
  toggle; the same `InputText` cell for media filenames.

### `src/components/translations/TranslationsDialog.vue`
- **Relevance:** hosts the grid and the language panel with add/remove and the
  "Show in editor" `Select` bound to `editor.displayLanguage`
  (`data-testid="display-language"`, options `[Default, ...languages]`). The
  panel editing-language control (WP2) mirrors this option shape and English
  "Default" label (`dialogs.translations.defaultOption`). **WP2/WP3 do not edit
  this file** — it already works; only referenced for parity.

## Properties panel (WP2)

### `src/components/properties/BasicSection.vue`
- **Relevance:** today's per-language label/hint. `editLang = editor.displayLanguage ?? DEFAULT_LANG`;
  writes via `setText(n.label, value, editLang)`; **shows `displayText(...)`**
  (the fallback-as-editable-text bug). Testids `prop-label` (Textarea),
  `prop-hint` (InputText), `prop-name`, `prop-default`, `prop-required`,
  `prop-readonly`. `showLabel` gate (`!meta && !calculate`). WP2 swaps
  label/hint to `LocalizedInput` and adds guidance-hint.

### `src/components/properties/LogicSection.vue`
- **Relevance:** `setConstraintMessage` calls `setText(n.bind.constraintMessage, value)`
  **with no lang → always default** (the bug). Constraint-message input shown
  when `node.bind.constraint` is set, testid `prop-constraint-message`, uses
  `displayText`. WP2 makes it language-aware and adds a required-message input
  gated on `node.bind.required`.

### `src/components/properties/ChoicesSection.vue`
- **Relevance:** `setChoiceLabel` → `setText(l.choices[i].label, value)`
  **no lang → always default** (the bug). Choice rows: `choice-name-${i}`,
  `choice-label-${i}` (uses `displayText`), inside a `VueDraggable`, edited via
  `editChoices` → `form.mutate(..., { coalesce: true })`. WP2 makes the label
  input language-aware; keep drag/name/add/remove untouched.

### `src/components/properties/PropertyPanel.vue`
- **Relevance:** the shell. `.property-header` (icon/title/name/help). Sections
  Basics/Appearance/Choices/Logic/Entity. WP2 inserts the compact
  editing-language control below the header, gated on `form.doc.languages.length`.
  `data-testid="property-panel"`, `property-header`, `property-help`.

### `src/help/content.ts` + `src/i18n/locales/en/help.json` + `src/components/help/HelpPopover.vue`
- **Relevance:** `fieldHelp` is a `satisfies Record<string, FieldHelp>` keyed by
  panel field; `HelpFieldKey = keyof typeof fieldHelp`. `HelpPopover field="…"`
  looks up `fieldHelp[field]` → i18n `help.fields.<key>.whatItIs`/`.xlsformColumn`.
  WP2 adds `guidanceHint` + `requiredMessage` keys so the new inputs can carry a
  "?" without a lookup miss. `constraintMessage`/`required`/`hint` entries are
  the copy template.

## Stores

### `src/stores/editor.ts`
- **Relevance:** `displayLanguage: ref<string | null>` (null = DEFAULT_LANG
  sentinel), `reset()` clears it. Consumed by `TreeNodeCard`, `ProblemsButton`,
  `BasicSection`, `TranslationsDialog`. `useEditingLanguage()` (WP2) wraps this
  single source of truth — no new state.

### `src/stores/form.ts`
- **Relevance:** `mutate(label, fn, { coalesce })` (single mutation gateway,
  snapshot+autosave+validate; coalescing folds rapid same-label edits into one
  undo) and `updateNode(id, label, fn)` (coalesce:true). All localized writes go
  through these; the per-field undo `label` is why `LocalizedInput` should let
  the parent own the `setText` call + label (WP2 note).

## XLSForm media columns + serializer (reference only — NOT changed)

### `src/core/xlsform/writer.ts` / `reader.ts` / `columns.ts`
- **Relevance:** proof the model already round-trips media + all messages.
  `columns.ts` `MEDIA_BASES`/`MEDIA_PREFIX` parse `media::image::Lang` and
  `image::Lang` and the `big_image`/`big image` aliases → slots. `writer.ts`
  `putLocalized` (base for DEFAULT_LANG, `base::lang` otherwise),
  `putMedia`/`MEDIA_COLUMNS`; `reader.ts` `readMedia`/`localizedValue`,
  `applyRowProps` reads label/hint/guidance_hint/constraint_message/
  required_message per-language. **WP1's round-trip unit test imports these; no
  package edits them.**

### `src/core/xform/` (serializer/parser) + `tests/golden/`
- **Relevance:** itext for every localized field already emitted/parsed. Golden
  parity is pinned to pyxform 4.5.0 and **must stay untouched/green**. `tests/
  golden/src/translated.xlsx` + `expected/translated.xml` are the existing
  multi-language fixture.

## Preview / attachments contract

### `src/preview/fetchFormAttachment.ts`
- **Relevance:** resolves `jr://` URLs by **filename** against the form's
  IndexedDB attachments. Media grid cells are free-text filenames under this
  exact contract (decision 2) — a cell value like `sign.png` matches an
  attachment named `sign.png`. No picker in v1.

## Tests to mirror

- `src/core/model/translations.spec.ts` — the collect/set/stats/siteKey unit
  patterns WP1 extends (uses `tests/helpers/doc-builders` `doc/q/group/choice`).
- `tests/component/translations.spec.ts` — dialog + grid component patterns
  (`freshPinia`, `mountWith`, testid-driven) WP3 extends.
- `tests/component/display-language.spec.ts` — the exact BasicSection/TreeNodeCard
  display-language assertions WP2 extends (and must keep green).
- `tests/component/property-panel.spec.ts` — panel mount patterns WP2 extends.
- `tests/e2e/translations.spec.ts` — the add-language/translate/export flow WP4
  extends (uses `tests/e2e/helpers.ts`).
- `tests/helpers/backends.ts` — dual-backend parametrization for the
  cross-backend acceptance line.
