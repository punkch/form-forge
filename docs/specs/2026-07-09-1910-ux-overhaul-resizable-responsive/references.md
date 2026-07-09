# References for the UX/Layout Overhaul

## Code studied during shaping

### Editor layout (the code being replaced)

- **Location:** `src/views/FormEditorView.vue:159-247`
- **Relevance:** the fixed CSS grid (`250px 1fr 360px`, `.with-preview` → `250px 1fr 320px 420px`), the `@media (max-width:1279px)` `position:fixed` preview drawer, the `@media (max-width:1100px)` narrowing, and the `onMounted` `innerWidth < 1280` palette hack — all removed/replaced by mode classes + inline width vars + `SplitHandle` gutters.
- **Key patterns to keep:** panels as plain grid children behind `v-if`; `.canvas-inner { max-width:760px }`; the `#actions` header slot wiring.

### Preview pipeline

- **Location:** `src/components/preview/PreviewPanel.vue`, `src/components/preview/PreviewHost.vue`, `src/preview/webFormsLoader.ts`, `src/stores/preview.ts`
- **Relevance:** PreviewHost mounts a child Vue app (no iframe) with `@getodk/web-forms`; remounts via `instanceKey`; engine errors revert to `lastGoodXml`. The error containment fix (destroy child on every error path) and the content-width presets hook in here. `preview.ts`'s 500ms debounce + `errorCount` gate is where `blockReason` (empty-group pause) plugs in.
- **Key patterns:** `generation` counter guarding async races; keep it.

### State stores

- **Location:** `src/stores/editor.ts` (transient UI state; `reset()` runs per form load), `src/stores/form.ts` (undo transactions, `addNode`), `src/stores/workspace.ts`
- **Relevance:** justified the new persisted `ui` store being separate from `editor` (reset semantics), and `revealNodeId`/`activePane` living in `editor`.

### Canvas

- **Location:** `src/components/canvas/TreeNodeCard.vue`, `src/components/canvas/NodeList.vue`
- **Relevance:** category chips, `.just-added` highlight and scroll-to hook into the card; drag-add feedback into `NodeList.onListUpdate`. Preserve: Alt+arrow keyboard nav, roving focus, badges, group/repeat left borders, undo drag transactions.

### Properties panel

- **Location:** `src/components/properties/PropertyPanel.vue`, `BasicSection.vue`, `TypeConfigSection.vue`, `ChoicesSection.vue`, `LogicSection.vue`, `prop-section.css`
- **Relevance:** wrapped by the new `PropSection` collapsibles; ChoicesSection row grid fix + drag-reorder goes through the existing `editChoices` undo path.

### Validation registry

- **Location:** `src/core/validate/` (index registers validators; issues carry `severity`/`code`/`scope.nodeId`)
- **Relevance:** the new `structure.ts` validator (`structure.empty-container` warning) follows the existing validator shape and feeds `ProblemsButton` + card badges for free.

### Hard constraint

- **Location:** `tests/unit/theme-parity.spec.ts`
- **Relevance:** blocks any edit to `odk-preset.ts`/`odk-tokens.css`; all new styling must be `--builder-*`.

## Prior spec convention

- **Location:** `docs/specs/2026-07-09-1650-builder-editor-ui/` (and siblings)
- **Relevance:** this project documents each work package as a dated spec folder; this spec extends the convention with the shape-spec file set (plan/shape/standards/references/user-guide/visuals).

## External quality bar

- ODK Web Forms' own full-page rendering (this repo's `/forms/:id/preview` route, `visuals/16-fullpreview-1440.png`) — the in-pane preview should feel like a windowed version of exactly this.
- Category color accents follow the same pattern as the existing repeat-node accent (`--p-orange-500` with hex fallback).
