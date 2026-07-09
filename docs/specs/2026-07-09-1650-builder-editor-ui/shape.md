# Spec 03: Builder Editor UI — Shaping Notes

## Scope

The form-authoring surface: question palette, canvas tree with drag-and-drop
and keyboard commands, property panel with per-type sections, expression
inputs with `${}` autocomplete, and the Problems popover. See the Spec 01
folder for the full program plan.

## Decisions

- **Summary cards, not widget mocks** — the canvas shows type icon, label,
  name and behavior badges; the real rendering belongs to the ODK Web Forms
  preview (Spec 04). The prototype's 580-line GenericFieldRenderer is gone.
- **vue-draggable-plus for DnD** with palette `pull: 'clone'`; clones arrive
  as `{ paletteType }` markers and are materialized into real nodes inside
  `NodeList.onListUpdate`. Containers nest their own draggable lists.
- **Drag undo via transactions** — Sortable mutates the reactive arrays in
  place, so drags snapshot with `beginTransaction()` on drag start and
  `endTransaction()` (which drops no-op snapshots) on drag end, instead of
  going through `mutate()`.
- **Keyboard command layer independent of DnD** — Alt+↑/↓ reorder, Alt+→
  indent into preceding container, Alt+← outdent; Delete removes. This is
  also the deterministic path for e2e tests. Cards re-focus after cross-list
  remounts (found in verification).
- **Single mutation gateway** (`form.mutate(label, fn)`) with per-label
  coalescing keeps text-edit bursts one undo entry; domain actions
  (add/move/duplicate/indent/outdent/update) all route through it.
- **Choices editing (basic)** lives in the property panel: shared-list
  binding with "used by N" warnings and inline name/label rows. The full
  manager, cascades and per-language editing arrive in Spec 05.
- `cloneSubtree` switched to a JSON deep clone — `structuredClone` refuses
  Vue reactive proxies.
- `#app` is viewport-locked (100dvh, overflow hidden); every panel scrolls
  internally.

## Context

- **References:** prototype `XFormBuilder.vue` (layout/behavior being
  replaced), `field-type-registry.ts` port (palette metadata).
- **Verification:** `../../verification/spec-03-editor.md` — full
  agent-browser pass; two real bugs found and fixed (focus loss, page
  scroll). 20 new unit/component tests (form store actions, PropertyPanel
  sections, TreeNodeCard, ExpressionInput autocomplete).
