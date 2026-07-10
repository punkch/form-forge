# Full translation coverage & discoverable per-language editing — shaping (backlog)

## Problem

ODK/XLSForm supports the `::Language (code)` suffix on more than labels:
`hint`, `guidance_hint`, `constraint_message`, `required_message`, the media
columns (`image`, `audio`, `video`, `big-image`), and choice labels + choice
media ([docs.getodk.org/form-language](https://docs.getodk.org/form-language/)).
The core model already round-trips all of these (`transformLocalizedTexts`,
`src/core/model/translations.ts`), but the UI under-exposes them:

- **The translation grid hides empty sites.** `collectTranslationSites`
  skips any site with no value in any language, so a form whose questions
  only have labels shows *only* label rows — there is no way to add a hint
  or constraint-message translation from the grid until the default-language
  value exists first. (ODK explicitly has no fallback language, so a
  language-only value is legitimate.)
- **Media sites never appear in the grid** (node media, choice media),
  even though the model, serializer, and XLSForm writer support
  per-language media.
- **Per-language editing from the properties panel is undiscoverable and
  inconsistent.** The hidden mechanism is Translations dialog → "Show in
  editor" (`editor.displayLanguage`); then Label/Hint in `BasicSection.vue`
  write that language. But the panel gives no indication which language is
  being edited, inputs display fallback text while writing the selected
  language, `LogicSection.vue` (constraint message) and `ChoicesSection.vue`
  (choice labels) always write the default language regardless, and
  required message / guidance hint are not editable from the panel at all.

Related: [in-app-guidance](in-app-guidance.md) explains these concepts to
users; this spec fixes the structural gaps.

## Scope

- **Grid completeness:** show rows for translatable sites that are relevant
  even when empty — label + hint for every question/group, constraint
  message whenever `bind.constraint` is set, required message whenever
  `bind.required` is set, guidance hint for every question (or behind a
  toggle). Empty-in-all-languages rows render as normal editable cells.
- **Media in the grid:** rows for node/choice `image`/`audio`/`video`
  (+ `bigImage`) wherever a ref exists in at least one language; cells are
  filename inputs that reference form attachments (same contract as
  `fetchFormAttachment`).
- **Properties panel:** a visible editing-language control (selector or
  badge synced with `editor.displayLanguage`) in the panel; ALL localized
  inputs respect it — label, hint, constraint message, required message,
  guidance hint, choice labels; untranslated values show as placeholder
  (fallback) rather than as editable text, so what you type is unambiguously
  the selected language.
- Stats (`translated/total`) recomputed over the expanded site list.

Out of scope: translating form title (not supported by XLSForm), audio/video
recording, per-language attachment upload UX beyond filename references.

## Approach

- Extend `collectTranslationSites` with a relevance rule per field
  (constraint message ⇢ has constraint, required message ⇢ required, …)
  instead of the current `hasAnyValue` filter; add `media` site kinds to
  `TranslationSiteRef` and `setSiteText`. Core-only change, spec'd first.
- Grid: group rows per node (label/hint/…/media under one context header)
  or keep flat rows with richer context strings — decide at promotion.
- Properties panel: one `useEditingLanguage()` composable wrapping
  `editor.displayLanguage`, used by every localized input; shared
  `LocalizedInput` component (badge + placeholder-fallback behavior) to
  stop each section hand-rolling `setText` calls.
- Add required-message and guidance-hint inputs where they belong
  (LogicSection / BasicSection) so the panel and grid cover the same set.

## Decisions (proposed)

- Fallback text moves to `placeholder` in per-language mode — an input never
  displays text in a language other than the one it writes.
- The "Show in editor" select stays in the Translations dialog but the same
  state also gets a compact control in the properties panel header; one
  state, two access points.
- Custom translated columns stay grid-only (they already flow through
  `transformLocalizedTexts`); no properties-panel affordance.

## Open questions

- Empty-row policy for guidance hint: always visible, toggle
  ("show rarely-used fields"), or only-when-set? (Grid noise vs coverage.)
- Media cells: free-text filename vs picker over the attachments repo —
  picker is better UX but pulls the attachments store into the dialog.
- Should the canvas also render the selected display language for choice
  labels (it does for question labels today)? Verify during promotion.

## Acceptance

A form with a constraint but no message shows an editable
constraint-message row in the grid; a French-only hint entered in the grid
round-trips through XLSForm export/import and XForm serialize/parse; an
`image::French (fr)` column imports, appears in the grid, and re-exports
byte-stable; with "French (fr)" selected as editing language the properties
panel visibly indicates it, typing a constraint message writes the French
key (not default), and clearing an input removes only the French key;
grid completeness stats count the expanded site list on both backends'
persisted docs.
