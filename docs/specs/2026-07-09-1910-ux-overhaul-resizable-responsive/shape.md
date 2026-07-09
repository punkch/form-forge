# UX/Layout Overhaul — Shaping Notes

## Scope

A design-review-driven overhaul of the builder's layout system, responsiveness, error containment, and visual polish. Triggered by user feedback that "the UI is not responsive enough, the preview can't be made wider," with the goal of a state-of-the-art authoring UX that preserves the ODK colors and the ODK Web Forms family look.

The review itself was a live agent-browser sweep (390–1920px viewports) using the interface-craft five-lens critique methodology; full findings are in `plan.md` (Context) and the screenshots in `visuals/`.

## Decisions

Four decisions were put to the user (AskUserQuestion); the recommended option was chosen each time:

1. **Preview sizing** — *chosen:* drag-handle splitter (min 360px, max 60vw), persisted width, plus device-width content presets (Phone 360 / Tablet 768 / Fill) with a subtle device frame; double-click resets. *Rejected:* simple drag-resize with no presets.
2. **Responsive story** — *chosen:* full adaptive layout: wide ≥1280 multi-pane resizable; laptop 1024–1279 palette drawer + docked preview that never covers properties; tablet 768–1023 single-pane with Canvas/Properties/Preview tabs; phone <768 polished "continue on a larger screen" editor screen while library and full-page preview stay usable. *Rejected:* fixing only ≥1024 and keeping the phone block.
3. **Visual depth** — *chosen:* UX + visual polish within the ODK look (Roboto + #3e9fcc kept; category color accents, labeled collapsible property sections, designed empty states, micro-interactions with reduced-motion support). *Rejected:* layout-only fixes; bolder identity pass with a new display typeface.
4. **Panel scope** — *chosen:* all panels resizable/collapsible with persisted widths; properties auto-collapses to a 44px rail when nothing is selected. *Rejected:* preview-only resizing.

## Constraints

- `src/styles/odk-preset.ts` and `src/styles/odk-tokens.css` must not change — `tests/unit/theme-parity.spec.ts` enforces byte-parity with the theme bundled in `@getodk/web-forms`. All new chrome variables are `--builder-*` in `src/styles/builder.css`.
- Client-side only; UI preferences persist to localStorage (`odk-builder:ui:v1`), not Dexie, because panel widths are needed synchronously at first paint.
- The canvas DOM must stay untouched by the splitter system (VueDraggable/SortableJS lists live there) — hence a custom `SplitHandle` over PrimeVue Splitter.

## Context

- **Visuals:** seven review screenshots in `visuals/` — canvas crush at 1440 (`04`), floating engine error (`05`), 1280/1024 squeeze and drawer-covers-properties (`09`, `10`), broken phone rendering (`12`), choice-name truncation + unlabeled properties scroll (`13`), and the good 900px full-page preview as the quality reference (`16`).
- **References:** see `references.md`.
- **Product alignment:** `docs/product/mission.md` — "the builder UI adopts ODK Web Forms' own design tokens, so authoring and preview feel like one product." This overhaul keeps that promise (differentiator #1) while fixing the layout rigidity; it also strengthens the offline/field-laptop story (Phase 2 PWA packaging) by making the builder usable on small laptops and tablets.

## Skills & Conventions Applied

See `standards.md` for details:

- `frontend-design:frontend-design` + `unops-toolkit:frontend-design` — token-driven styling, restraint/signature-element discipline.
- `unops-toolkit:interface-craft` — five-lens critique (used for the review), motion discipline for the new micro-interactions.
- `agent-browser` — hands-on review and the verification sweeps.
- Execution convention (user directive, 2026-07-09): use dynamic Workflow orchestration where appropriate; any subagent delegated planning work must itself run `/shape-spec` and update this spec folder.
