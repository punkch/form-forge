# Plan — Canvas card footer actions

## Review findings being implemented (interface-craft, 2026-07-10)

Verdict on the user proposal: **approved with amendments**.

1. **Restructure the card into two stable rows** — title row (chevron +
   type chip + fully wrapping label), footer row (type · name chip · badges,
   actions flush right). Fixes the importance inversion where the title was
   the only element allowed to be crushed.
2. **Reserve the actions' space** — render always; hide with
   `visibility: hidden` + `opacity: 0`; reveal with a ~120 ms opacity fade;
   footer `min-height` equals button height so hover changes nothing
   geometrically. (`display: none → flex` was the root cause of the jump;
   moving the buttons to the footer without reserving space would merely
   relocate the jump to the footer height.)
3. **Unclamp the title** — remove the `-webkit-line-clamp: 2`; wrap to as
   many lines as needed; `overflow-wrap: break-word` for unbroken strings.
4. **Anchor chip and chevron to the first title line** —
   `align-items: flex-start` on the row with small optical offsets
   (18px text vs 28px chip → ~5px first-line padding compensation).
5. **Guard the footer against crowding** — `min-width: 0` + ellipsis on
   badge text; meta group may shrink; actions never shrink.

Bonus polish accepted during review:

- Tighten reveal scope: hovering a container card must not reveal actions
  on descendant cards (pre-existing `.node-card:hover .node-actions`
  descendant-selector quirk).
- Always show actions on touch devices (`@media (hover: none)`).
- `prefers-reduced-motion: reduce` disables the fade.
- Subtle border-color transition on card hover.

## Task 1: Save spec documentation

Create `docs/specs/2026-07-10-2342-canvas-card-footer-actions/` with
`plan.md`, `shape.md`, `standards.md`, `references.md`, `user-guide.md`,
`visuals/before.png` (user screenshot).

## Task 2: Restructure `TreeNodeCard.vue` template

- Move `.node-meta`, `.node-badges` (incl. error icon), `.node-actions`
  into a new `.node-footer` flex row inside `.node-main`, in that order.
- Title row becomes: collapse chevron (containers), type chip,
  `.node-main` (label + footer).
- Preserve all `data-testid`s (`node-card-*`, `delete-node`), aria labels,
  click/keyboard handlers, tooltips, badge keys.

## Task 3: Restyle

- `.node-card-row { align-items: flex-start }`; chevron/chip optical
  offsets to center on the first text line.
- `.node-label`: remove clamp; `overflow-wrap: break-word`.
- `.node-footer`: flex, `align-items: center`, `min-height` = action
  button height, `gap: var(--odk-spacing-m)`.
- `.node-badges { margin-inline-start: auto }` right-aligns the cluster;
  actions after badges with a separating gap; badge text ellipsis.
- `.node-actions`: always rendered; `visibility: hidden; opacity: 0;`
  reveal on `.node-card-row:hover`, `.node-card:focus > …`, row
  `:focus-within`; 120 ms opacity transition; reduced-motion + touch
  media queries. Compact 24px icon buttons.
- Card hover border transition.

## Task 4: Component tests

Extend `tests/component/tree-node-card.spec.ts`:

- Badges and actions render inside `.node-footer` (structure pin).
- Action buttons are always present in the DOM (space reservation is CSS;
  the DOM-presence pin is what happy-dom can assert).
- Existing assertions (badge counts, keyboard moves, delete) unchanged.

## Task 5: Verification

- Full suite: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test:e2e`
  (parallel via Workflow, per delivery process).
- agent-browser manual pass against `pnpm dev`: long-title card wraps
  fully; hover produces zero layout shift (compare screenshots); badges +
  actions right-aligned in footer; container chevron alignment; keyboard
  reveal (Tab to card → buttons visible/operable). Log + screenshots to
  `docs/verification/2026-07-10-canvas-card-footer-actions.md`.

## Task 6: Code review & delivery

- `/code-review` on the diff; fix findings immediately.
- Conventional commit (`fix(canvas): …`) — no co-author trailers.
- CLAUDE.md/README/roadmap: no index changes needed (no module moved,
  no feature added); spec + verification docs are the record.
