# User guide — Canvas card footer actions

## What changed

Question cards on the builder canvas now show the **full question text**,
wrapping onto as many lines as it needs — long titles are no longer cut
off with "…". The status icons (required, logic, choice list, …) and the
duplicate/delete buttons moved down into the card's footer line, next to
the widget type and field name, aligned to the right edge.

Hovering a card no longer makes the text shift or re-wrap: the action
buttons fade in, in space that is always reserved for them.

## Manual test scenarios

1. **Long title wraps fully** — create a text question and paste a label
   longer than three lines of the canvas width. The whole label is
   visible; no ellipsis; the type icon stays aligned with the first line.
2. **No hover jump** — hover on/off a card with a long label. Nothing
   moves: no text re-wrap, no height change; duplicate/delete fade in at
   the footer's right edge.
3. **Footer layout** — a select-one with required + choice list shows,
   left to right: type title, name chip, then (right-aligned) required
   asterisk, list chip, duplicate, delete.
4. **Crowded footer** — narrow the canvas pane with a long choice-list
   name: badge text truncates with ellipsis; buttons stay on-card.
5. **Keyboard** — Tab/arrow to a card: buttons appear; Tab again reaches
   Duplicate, then Delete; Enter activates. Esc/blur hides them.
6. **Containers** — hovering a group's header row shows only that
   group's actions, not every child card's. Chevron aligns with the
   group title's first line.
7. **Touch** (device emulation) — actions are always visible.
8. **Reduced motion** — with `prefers-reduced-motion: reduce`, buttons
   appear/disappear instantly (no fade).
