# Canvas multi-select, clipboard ops, canvas toolbar & insert-from-template — Shaping Notes

## Scope

The canvas gains multi-select (Ctrl+Click toggle, Shift+Click range) with structural bulk ops —
Cut/Copy/Paste/Delete over the whole selection, paste working **between forms** and between
tabs; multi-move of the selection by drag (gather-on-drop) and Alt+Arrows (block move / indent /
outdent), incl. into groups; "Insert from template" appending a template's fields to the open
form as ordinary editable nodes; a new always-on-top canvas toolbar (undo/redo + clipboard ops
left, gear = relocated whole form menu right); and the in-app multilingual guides (en/fr/es)
updated to teach all of it (new `canvas` guide, extended `keyboard`/`templates` guides,
first-use `multiSelect` callout).

## Decisions (locked with the user in the shaping session)

1. **Structural ops only** for multi-select (cut/copy/paste/delete); bulk property editing
   recorded as a roadmap follow-up.
2. **Undo/redo move** to the canvas toolbar (single home; removed from AppHeader — the library
   view's header stops showing permanently-disabled undo/redo).
3. **Gear opens the whole form menu** (all four items + new "Insert from template…"); the
   header form-name button becomes a plain title. The gear keeps `data-testid="form-menu"`.
4. **Hybrid clipboard**: in-app localStorage buffer (memory fallback) as source of truth +
   best-effort system-clipboard write + native ClipboardEvent handling for real Ctrl+X/C/V.

## Interface-craft consultation (findings and resolutions, from shaping)

- **Control duplication (structural)** — undo/redo already in the AppHeader; showing them twice
  inches apart splits the pattern. → Resolved (user decision): UndoRedoButtons **move**.
- **Family splitting (consistency)** — moving only Form settings out of the form-name menu would
  strand Translations/Choice lists/Attachments. → Resolved (user decision): the gear opens the
  **whole** menu; e2e menu flows survive verbatim.
- **Always-visible disabled buttons (interface)** — six icons where four are often disabled
  reads as noise. → Mitigate: proper disabled states, tooltips with shortcuts ("Cut (Ctrl+X)"),
  "Nothing to paste" when empty, and a "N selected" chip + clear button when >1 selected.
- **Expectation setting (interface)** — paste destination must be predictable. → One
  deterministic rule (mirrors addFromPalette): into the selected open group at its end;
  otherwise right after the selection; otherwise at the end of the form. Pasted/inserted nodes
  are selected and the first is revealed + flashed.
- **Icon clarity (visual)** — PrimeIcons has **no scissors icon** (verified against the pinned
  package). Cut uses `pi pi-file-export` + tooltip; Copy `pi pi-copy`, Paste `pi pi-clipboard`,
  Delete `pi pi-trash`, gear `pi pi-cog` — one icon family, existing weight.
- **Toolbar placement (visual/behavioral)** — `position:sticky` inside the padded scroll area
  floats below the top padding. → The toolbar is a **non-scrolling sibling above the scroll
  area** (always on top by construction), styled as a panel header from existing tokens only.
- **Focus vs multi-select conflict (behavioral)** — mousedown fires focus before click, which
  would collapse the set right before Ctrl+Click toggles the node out. → A pointerdown flag
  makes the click handler authoritative during pointer interaction; keyboard focus (Tab/arrows)
  still collapses to single-select (standard tree behavior).

## Verification corrections (this session, three exploration agents)

See plan.md "Verified corrections to the backlog design" — ten items. Highlights: dragged-node
identity comes from `evt.item.dataset.nodeId` (not `e.data`); card selection today fires on both
click and focus; AppHeader's form-menu shrink rule is removed outright; the saveTo-strip policy
keeps its behavior but for the corrected reason (orphan saveTo raises
`entities.saveto-without-declaration`, an ERROR — stripping avoids instantly erroring the target
form); `migrateTemplateDoc` extraction unifies two existing call sites; UndoRedoButtons carry no
testids so relocating them is free.

## Context

- **Visuals:** None (interaction design captured textually in the shaping session).
- **References:** see references.md.
- **Product alignment:** Phase-3 builder-productivity work; roadmap gains two Known follow-ups
  (bulk property editing for multi-selection; blob-copy on cross-form paste — payload hook
  `sourceFormRecordId` reserved).

## Skills & Conventions Applied

- `unops-toolkit:shape-spec` — this folder.
- Dynamic Workflow orchestration for implementation (established delivery process).
- `/unops-toolkit:code-review`, `/agent-browser` + `/unops-toolkit:interface-craft` for the
  review stage (UI diff ⇒ pixels get checked, not just code).
- Repo invariants in standards.md.
