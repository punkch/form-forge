# F10 — In-App Help System — Shaping Notes

## Scope

The core slice of `docs/specs/backlog/in-app-help.md`: registry-driven help
content, the question-type help drawer (palette info icons + property-panel
header), the browsable searchable reference behind a header Help button, and
the `HelpPopover` field component. Wiring the popover into the property
sections is a deliberate follow-up (it touches every section component and
would conflict with parallel property-panel work).

## Decisions

- **Registry-driven + bundled content, text-only.** Appearance and parameter
  tables render straight from `questionTypeRegistry` — no second copy of
  that data. The prose (per-type behavior, XLSForm notes, per-field help)
  lives in the i18n catalog under a new `help` namespace, so it ships in the
  bundle and works fully offline. No screenshots: the live web-forms preview
  already shows real rendering.
- **`docsAnchor` on the registry, verified against the live docs.** Every
  type got its anchor checked against the actual section ids on
  `docs.getodk.org/form-question-types/` (fetched during implementation, not
  guessed). Types documented elsewhere (repeat, csv-external, audit) carry an
  absolute URL instead; `docsUrl()` in `src/help/content.ts` resolves both
  forms. All 36 types have one, including structural group/repeat
  (grouping section / form-repeats page).
- **Typed catalog index, not string building.** `src/help/content.ts` maps
  every type and field to literal `MessageKey`s, so a missing or misspelled
  `help.json` entry is a vue-tsc error — the consistency unit test is the
  second net, catching registry types without a map entry.
- **Store pattern copied from dataset-preview.** Two new `EditorDialog`
  entries: `'help-reference'` (header dialog) and `'help-type'` (drawer),
  plus a `helpTypeId` ref and an `openTypeHelp(type)` action, mirroring
  `openDatasetPreview`.
- **One shared detail renderer.** `QuestionTypeHelpContent.vue` renders the
  what-it-does / XLSForm / appearances / parameters / read-more body for
  both the drawer and the reference dialog, so the two surfaces can never
  drift.
- **Search logic extracted, not duplicated.** The palette's match rule moved
  to `src/help/search.ts` (`matchesTypeSearch`); the palette and the
  reference dialog both import it.
- **Palette rows restructured for the info icon.** Nested buttons are
  invalid HTML, so each palette item became a row div holding the draggable
  add-button plus a quiet "?" button (revealed on hover/focus-within, always
  visible on touch devices). The `palette-item-*` testids are unchanged.
- **Attribution**: content adapted (concise, not copied verbatim) from the
  ODK Documentation; the reference dialog footer credits and links
  docs.getodk.org. The ODK docs are CC-BY licensed.

## Out of scope (follow-ups)

- Inserting `<HelpPopover field="…">` next to each property-panel field
  label (component + tests exist; call sites land separately).
- Localized help content for languages other than English.
