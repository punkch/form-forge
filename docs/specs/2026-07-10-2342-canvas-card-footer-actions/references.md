# References — Canvas card footer actions

## Primary target

### TreeNodeCard.vue

- **Location:** `src/components/canvas/TreeNodeCard.vue`
- **Relevance:** the component being restructured.
- **Key patterns to preserve:** roving keyboard focus via `.node-card`
  (`tabindex=0`, `role=treeitem`), Alt+Arrow move/indent handlers, the
  `just-added` reveal flash (already respects `prefers-reduced-motion`
  — the new fade must too), badge computed with i18n tooltips,
  `data-testid`s (`node-card-<name>`, `delete-node`).

## Context components

### NodeList.vue

- **Location:** `src/components/canvas/NodeList.vue`
- **Relevance:** wraps cards in `VueDraggable` (whole card is the drag
  surface — no handle). Action buttons already `@click.stop`; footer
  placement does not interfere with dragging.

## Test surface

- `tests/component/tree-node-card.spec.ts` — pins `.node-badge`,
  `.badge-text` counts and keyboard behavior; no row-structure pins.
- e2e specs reference cards only via `data-testid` and use the keyboard
  Delete path — nothing clicks the hover-revealed buttons.

## Design tokens

- `src/styles/odk-tokens.css` — `--odk-question-font-size: 1.125rem`,
  `--odk-hint-font-size: .875rem`, `--odk-spacing-*`, `--odk-radius`.
  Chip is 28×28; first-line optical centering derives from these.

## External conventions consulted

- Linear / Notion / Height list rows: hover-revealed actions reserve
  space or overlay; they never reflow the text being read.
- Peer form builders (Google Forms, Kobo, ODK Build) show full question
  text on canvas — "the canvas is the document".
