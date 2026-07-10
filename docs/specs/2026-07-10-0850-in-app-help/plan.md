# F10 — In-App Help System — Plan

## Goal

Authors can learn what any question type does, what its appearances and
parameters mean (with Collect/Enketo support), and what each property-panel
field maps to in XLSForm — without leaving the app, fully offline, with
"read more" links to the exact ODK docs anchors.

## Registry

`src/core/registry/question-types.ts` gains `docsAnchor?: string` on
`QuestionTypeDefinition` and a value for all 36 types: a bare fragment id on
`https://docs.getodk.org/form-question-types/` (e.g. `single-select-widget`,
`geolocation-at-survey-start`, `metadata`) or an absolute URL for types
documented on other pages (`form-repeats`, `form-datasets`,
`form-audit-log`).

## Content layer (`src/help/`)

- `content.ts` — `typeHelp` (per type: `whatItDoes`, `xlsformNotes`),
  `fieldHelp` (16 property fields: `whatItIs`, `xlsformColumn`), both typed
  as literal `MessageKey`s; `HelpFieldKey`; `docsUrl(def)`;
  `ODK_QUESTION_TYPES_DOCS_URL`.
- `search.ts` — `matchesTypeSearch(def, query)`, extracted from the palette
  and now shared with the reference dialog.
- English text in `src/i18n/locales/en/help.json` (`help.types.*`,
  `help.fields.*`, `help.ui.*`), registered in `en/index.ts`.

## Store

`editor.ts`: `EditorDialog` gains `'help-reference' | 'help-type'`;
`helpTypeId` ref; `openTypeHelp(type)`; both cleared by `reset()`.

## Components (`src/components/help/`)

- `QuestionTypeHelpContent.vue` — shared body: behavior text, XLSForm notes,
  appearances table (name + combinable, description, Collect/Enketo badges),
  parameters table (name + required, description + options, default),
  external "Read more" link.
- `QuestionTypeHelpDrawer.vue` — right-side PrimeVue Drawer
  (`activeDialog === 'help-type'`), header = category-colored icon + title +
  type-token chip.
- `HelpReference.vue` — large PrimeVue Dialog
  (`activeDialog === 'help-reference'`): search input + category-grouped
  list of all registry types; clicking an entry swaps to the inline detail
  view with a back button; footer carries the ODK docs attribution. Fully
  keyboard navigable (input → item buttons → back; Esc closes).
- `HelpPopover.vue` — "?" trigger + PrimeVue Popover rendering a
  `fieldHelp` entry (`whatItIs` + XLSForm column chip). Component only;
  property sections adopt it in a follow-up.

## Entry points

- `AppHeader.vue` — "?" Help button (right side) → `'help-reference'`.
- `QuestionPalette.vue` — per-item info button (revealed on hover/focus,
  always shown on touch) → `openTypeHelp(def.type)`.
- `PropertyPanel.vue` — header help button after the node name →
  `openTypeHelp(def.type)` for the selected node's type.
- `EditorDialogs.vue` — mounts `HelpReference` + `QuestionTypeHelpDrawer`.

## Tests

- `tests/unit/help-content.spec.ts` — consistency: every type has
  `docsAnchor` + `typeHelp` entry resolving to non-empty catalog text; no
  orphan entries; every appearance/parameter has a description; every
  `fieldHelp` entry resolves; `docsUrl` shapes; `matchesTypeSearch` rules.
- `tests/component/help.spec.ts` — drawer renders appearances/badges/
  parameters/read-more for select_one and closes cleanly; reference search
  filters, opens detail inline, back returns, empty state; popover renders
  a field entry on toggle.
- `tests/e2e/help.spec.ts` — header Help → search "select" → select_one
  detail with appearances and correct docs href; palette info icon → drawer;
  property-panel header → drawer for the selected type.
