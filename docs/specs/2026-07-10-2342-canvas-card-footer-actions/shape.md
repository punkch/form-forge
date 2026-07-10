# Canvas card footer actions — Shaping Notes

## Scope

Restructure the canvas question card (`TreeNodeCard.vue`) so that:

- The question **title owns the full card width** and wraps to as many lines
  as needed (the 2-line clamp is removed).
- The **status badges and hover action buttons move into the footer row**
  (the row that shows the widget type and field-name chip), right-aligned.
- The action buttons **reserve their space permanently** (`visibility` +
  `opacity` fade instead of `display: none`) so hovering a card never
  reflows or resizes anything — the "jumping" effect is eliminated by
  construction, not by tuning.
- The type chip and collapse chevron **anchor to the first title line**
  instead of floating vertically centered against a multi-line label.
- The footer is **guarded against crowding** (badge text ellipsis,
  `min-width: 0` on the meta group, actions never shrink).

## Origin

User remark (2026-07-10, with screenshot of a verbal-autopsy form card):
icons right of the question box force the title to shrink/truncate and the
hover reveal makes the layout jump. Proposal: icons → footer, right-aligned;
title wraps freely.

An interface-craft five-lens critique **approved the proposal with
amendments** (see `plan.md` → Review findings). Key amendment: moving the
buttons alone is not enough — their space must be reserved or the *footer*
height jumps instead.

## Decisions

- **Unbounded title wrap** — no line cap. Form labels are authored text;
  full fidelity on canvas is the point ("the canvas is the document").
  `overflow-wrap: break-word` guards pathological unbroken strings.
- **One content row, one metadata row** — title row = chevron + type chip +
  label; footer = type title + name chip (left), badges + actions (right,
  via `margin-inline-start: auto`).
- **Badges stay left of actions** with a slightly larger gap separating
  state (badges) from verbs (buttons).
- **Reveal scope tightened** — reveal is driven by `.node-card-row:hover` /
  `.node-card:focus` / row `:focus-within`, not `.node-card:hover`, so
  hovering a group no longer reveals actions on every descendant card
  (a pre-existing quirk of the descendant selector).
- **Touch devices** (`hover: none`): actions are always visible — there is
  no hover to reveal them.
- **Motion**: 120 ms opacity fade on reveal; disabled under
  `prefers-reduced-motion: reduce` (matches the existing scroll-reveal
  convention in this component).
- **Compact action buttons** (24px) keep the always-present footer from
  inflating card height; footer `min-height` equals the button height so
  geometry is hover-invariant.
- **Keyboard path preserved** — card `:focus` reveals the buttons, Tab
  reaches them (they are visible at Tab time), row `:focus-within` keeps
  them visible while focused. Same mechanics as the old `display: none`
  version, minus the reflow.

## Context

- **Visuals:** `visuals/before.png` (user screenshot: truncated title +
  right-side icon cluster). After-screenshots land in
  `docs/verification/` per the delivery process.
- **References:** see `references.md`.
- **Product alignment:** UI-polish; no roadmap item. Falls under Phase 2's
  delivered builder canvas. No README feature-list change needed.

## Skills & Conventions Applied

- **unops-toolkit:interface-craft** — five-lens critique produced and
  gated this work; its findings are the requirements list.
- **unops-toolkit:code-review** — run post-implementation, findings fixed
  immediately (established project process).
- **agent-browser** — manual verification pass logged to
  `docs/verification/`.
- **Project invariants** — preserve `data-testid`s; UI strings via
  vue-i18n (no new strings needed); logical CSS properties for future RTL.
