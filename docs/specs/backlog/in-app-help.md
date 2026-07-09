# In-app help system — shaping (scheduled)

## Problem

Authors can't tell, without leaving the app, what a question type does:
which widget renders, what the appearance options mean, which parameters
exist, or what a property-panel field maps to in XLSForm. The official
reference (docs.getodk.org/form-question-types/) is external and the app
must work fully offline.

## Scope

- **Field popovers**: a small "?" affordance on property-panel fields
  explaining what the field does and the XLSForm column it maps to.
- **Question-type help drawer**: from a palette info icon and the property
  panel header — widget behavior, appearances with what they do and
  Collect/Enketo support, parameters, "read more" link to the official
  docs anchor.
- **Browsable reference**: a Help entry in the header opening a searchable,
  category-grouped reference of all ~40 question types, usable without
  selecting a question.

## Approach

- Registry-driven: `src/core/registry/question-types.ts` already carries
  per-type `description`, `appearances[]` (description + platform support +
  combinable) and `parameters[]`. Add `docsAnchor` per type.
- `src/help/` content layer: i18n-keyed extended help (per-type widget
  behavior and per-field entries) in the en.json catalog under a `help`
  namespace — bundled, fully offline.
- Components: `HelpPopover.vue`, `QuestionTypeHelpDrawer.vue`,
  `HelpReference.vue` (reuses the palette's search/filter logic).
- Consistency test: every registry type has help content + docsAnchor;
  every appearance has a description.

## Decisions (user, 2026-07-09)

- Full depth: popovers + drawer + browsable reference.
- Text-only content — no bundled widget screenshots; the live
  @getodk/web-forms preview already shows real rendering. Content adapted
  from the official docs with attribution (verify license, expected CC-BY).

## Acceptance

Every question type opens a help drawer with its appearances and platform
badges; property fields show popover help; header Help search finds any
type offline; docs links hit the right anchors.
