# Form Forge for ODK — UX/Layout Overhaul (Design-Review Driven)

## Context

A hands-on design review of the builder (agent-browser sweep at 390–1920px, five-lens critique) confirmed the user's complaints and found more:

- **The preview cannot be widened.** It is a hard-coded 420px grid column (`src/views/FormEditorView.vue:174-184`). At 1440px the canvas — the primary work surface — collapses to 290px: cards truncate ("Select on…"), badges wrap. No panel anywhere is resizable and nothing is persisted.
- **Broken responsive story.** Below 1280px the preview becomes a `position:fixed` overlay that fully covers the properties panel (edit-and-watch impossible). Below 768px a warning banner renders on top of a broken but still-interactive layout. The full-page preview route actually works well on phones, but nothing routes users there.
- **Error containment failure.** An empty group crashes the ODK engine and the raw error ("Unexpected body element for nodeset /data/group") floats in a box over the canvas/properties — wrong place, wrong words, no link to the offending node.
- **Panel/detail issues.** Properties panel is one unlabeled scroll (logic buried below fold); choice "name" column truncates at ~40px ("op…"); click-to-add appends silently off-screen; header wraps at tablet widths; empty states are undesigned; every question card looks identical regardless of type; mixed label casing ("randomize", "seed").
- **Strengths to preserve:** token discipline (`--odk-*`/`--p-*`, theme-parity-tested against `@getodk/web-forms`), canvas keyboard nav, undo/autosave, the 900px full-page preview.

Goal (user): state-of-the-art UX while preserving ODK colors and the ODK Web Forms family look.

## Approved decisions (AskUserQuestion, all "Recommended" options chosen)

1. **Preview**: drag-handle splitter (min 360px – 60vw), width persisted, device-width presets in the preview toolbar (Phone 360 / Tablet 768 / Fill) with a subtle device frame; double-click handle resets.
2. **Full adaptive layout**: wide (≥1280) multi-pane resizable; laptop (1024–1279) palette becomes overlay drawer, preview docks and never covers properties; tablet (768–1023) single-pane with Canvas/Properties/Preview tabs; phone (<768) polished "continue on a larger screen" screen on the editor route only — library and full-page preview stay usable.
3. **Visual polish within the ODK look**: keep Roboto + ODK blue (#3e9fcc scale); add question-category color accents, labeled collapsible property sections, designed empty states, micro-interactions (scroll-to + highlight on add, smooth panel transitions, `prefers-reduced-motion` respected). `odk-preset.ts` and `odk-tokens.css` untouched (theme-parity test); all new chrome vars are `--builder-*` in `builder.css`.
4. **All panels resizable/collapsible with persisted widths**; properties auto-collapses to a 44px rail when nothing is selected.

## Architecture decisions

- **Custom `SplitHandle.vue`** (~130 lines), not PrimeVue Splitter: pixel-based widths in CSS grid vars, panels stay plain grid children behind `v-if` (Splitter re-inits on dynamic panels, is percent-only, has no collapse/reset API, and would wrap the SortableJS canvas DOM). Pointer Events + `setPointerCapture` (mouse+touch), `role="separator"` with arrow-key resize (±16px, Shift ±64px, Home/End, Enter=reset), dblclick reset, `data-testid="split-<panel>"`.
- **New persisted `src/stores/ui.ts`** (localStorage key `odk-builder:ui:v1`, versioned, clamped on load, try/catch for private mode): `paletteWidth` (200–340, def 250), `propertiesWidth` (300–560, def 360), `previewWidth` (360–60vw, def 420), `previewPreset` ('phone'|'tablet'|'fill'), `paletteVisible` (moves here from editor store), `propSectionsCollapsed`. localStorage not Dexie: widths needed synchronously at first paint; device-level prefs. Editor store keeps transient state and gains `activePane` (tablet tabs) + `revealNodeId` (scroll-to signal); `previewVisible` stays transient.
- **`src/composables/useBreakpoint.ts`** — matchMedia singleton returning mode `'wide'|'laptop'|'tablet'|'blocked'` (breaks at 768/1024/1280). Mode picks the grid template; ui widths apply only where the panel is docked. Wide mode enforces canvas `minmax(360px,1fr)`; a derived `effectivePaletteVisible` auto-tucks the palette when the sum wouldn't fit (non-destructive — persisted flag untouched).
- **Preview presets set CONTENT width, not pane width**: `.preview-mount { width:min(var(--builder-preview-content-width,100%),100%); margin-inline:auto }` + device frame (border/radius/shadow, muted gutter) when preset ≠ fill; selecting a preset auto-widens the pane to `contentPx + 40` clamped to 60vw. Frame CSS lives in builder-owned wrappers, never inside the web-forms subtree.
- **Engine-error containment**: `PreviewHost` calls `destroyChild()` on every error path before reporting (removes web-forms' escaping error UI); new `PreviewErrorState.vue` renders a friendly in-pane message with Retry + full-page link. New `src/core/validate/structure.ts` emits a warning for empty groups/repeats (`structure.empty-container`); `preview.ts` gains `blockReason` — regeneration pauses with a "Preview paused — Group "x" is empty…" banner while the last good preview stays.

## Tasks

### Task 1: Save spec documentation

Create `docs/specs/2026-07-09-1910-ux-overhaul-resizable-responsive/` with:

- **plan.md** — this plan in FULL (do not summarize).
- **shape.md** — shaping notes: scope (review-driven UX overhaul), the four approved decisions with the options that were rejected, constraints (ODK colors, theme parity, client-side only), product alignment (mission.md: "builder UI adopts ODK Web Forms' own design tokens so authoring and preview feel like one product").
- **standards.md** — skills/conventions applied: `frontend-design:frontend-design` + `unops-toolkit:frontend-design` (token-driven styling, no hard-coded colors, restraint/signature-element discipline — adapted: this project's tokens are `--odk-*`/`--builder-*`, not the UNOPS brand set), `unops-toolkit:interface-craft` (five-lens critique methodology used for the review; storyboard/reduced-motion discipline for the new micro-interactions), `agent-browser` (verification sweeps).
- **references.md** — key files studied: `FormEditorView.vue:167-246` (grid layout being replaced), `PreviewPanel.vue`/`PreviewHost.vue` (child-app mount, error path), `stores/editor.ts`/`preview.ts` (state split), `TreeNodeCard.vue` (badges/keyboard nav to preserve), `tests/unit/theme-parity.spec.ts` (hard constraint), prior spec convention `docs/specs/2026-07-09-1650-builder-editor-ui/`.
- **user-guide.md** — how to use resizable panels, presets, tablet tabs, phone behavior; manual test scenarios mirroring Task 7's sweep.
- **visuals/** — copy the review screenshots from the session scratchpad (`/tmp/user/1000/claude-1000/-home-punkch-Projects-odk-builder/7d5343ff-a8ff-4872-9ea3-2314b87af577/scratchpad/`): `04-builder-populated-1440.png` (canvas crush), `05-preview-1440.png` (floating engine error), `09-builder-1280.png`, `10-builder-1024.png` (drawer covering properties), `12-builder-390.png` (broken mobile), `13-properties-select-1440.png` (choice truncation, unlabeled scroll), `16-fullpreview-1440.png` (the good reference).

### Task 2: Foundations — ui store, breakpoints, housekeeping

- Create `src/stores/ui.ts` (fields/limits above; `setPanelWidth` clamps; `resetPanelWidth`; watch-persist).
- Create `src/composables/useBreakpoint.ts`.
- Add to `src/styles/builder.css`: `--builder-palette-width/-properties-width/-preview-width` defaults, `--builder-properties-rail-width:44px`, `--builder-preview-content-phone:360px`/`-tablet:768px`, 8 category accent pairs (`--builder-cat-input: var(--p-sky-600,#0284c7)` + `-tint: var(--p-sky-50,…)`; select=violet, datetime=teal, media=rose, location=green, display=slate, structure=primary, meta=gray). Delete the `@media (max-width:767px)` banner block; remove banner markup from `src/App.vue`.
- Move `paletteVisible` from editor store to ui store (update consumers in `FormEditorView.vue`).
- Remove unused `primeflex` from `package.json`.
- **Accept:** typecheck/lint/vitest green; prefs survive reload; corrupted localStorage → defaults; UI otherwise unchanged.

### Task 3: Wide-mode resizable layout + properties rail

- Create `src/components/shell/SplitHandle.vue` (spec above).
- Rework `FormEditorView.vue`: replace fixed `grid-template-columns` variants + both media queries with mode classes + inline width vars; insert SplitHandle gutters (6px, 10px hit area); canvas `minmax(360px,1fr)`; `effectivePaletteVisible` fit rule; delete the `onMounted` innerWidth<1280 palette hack.
- `PropertyPanel.vue`: rail mode when `selectedNodeId===null` (44px strip, icon, tooltip, `data-testid="property-rail"`), slide transition gated on `prefers-reduced-motion`.
- **Accept:** each handle drags and persists across reload; dblclick/Enter resets; keyboard resize with correct `aria-valuenow`; deselect → rail and canvas reclaims space; existing `editor.spec.ts` + `preview.spec.ts` pass at 1280×720.

### Task 4: Adaptive modes — laptop, tablet, blocked, responsive header

- Laptop (1024–1279): palette becomes overlay drawer (280px, elevation, close on add/Esc/outside); preview stays a docked grid column (min 320) — remove the `position:fixed` drawer entirely; properties never covered (clamped ≤340).
- Tablet (768–1023): new `src/components/shell/EditorTabs.vue` (Canvas/Properties/Preview bound to `editor.activePane`; canvas kept alive via `v-show` to preserve DnD state, preview lazy `v-if`; dot on Properties tab when a node is selected).
- Blocked (<768): new `src/components/shell/BlockedEditorScreen.vue` on the editor route only — form title, friendly copy, buttons "Open form preview" (`router.push({name:'preview'})`) and "Back to forms". Library + `/forms/:id/preview` remain fully usable.
- `AppHeader.vue`: `min-width:0` + ellipsis title, `SaveIndicator` no-wrap/shrink-0; at laptop/tablet fold ExportMenu + palette toggle into the existing overflow `Menu`, Preview button icon-only.
- **Accept:** at 1100px preview open leaves properties editable; at 900px tabs switch panes and DnD works after returning to Canvas; at 390px editor shows blocked screen with working preview link; no header wrap at 820px.

### Task 5: Preview — toolbar, device presets, error containment, empty-group gating

- New `src/components/preview/PreviewToolbar.vue`: title, refresh, preset segmented group (`data-testid="preview-preset-phone|tablet|fill"`), full-page, close (keep existing testids).
- `PreviewHost.vue`: `contentWidth` prop → `--builder-preview-content-width`; `.preview-mount` clamp + `.device-framed` styling; `destroyChild()` immediately on every engine-error path.
- New `src/components/preview/PreviewErrorState.vue`: friendly message, collapsible raw error, Retry (`preview.refreshNow()`), full-page link; rendered strictly inside the pane.
- New `src/core/validate/structure.ts` (`structure.empty-container` warning for empty group/repeat, registered in validate index); `stores/preview.ts` gains `blockReason` gating with a "Preview paused — …" banner while last good XML stays mounted.
- Preset selection auto-widens pane (`max(previewWidth, contentPx+40)` clamped to 60vw); dblclick reset keeps preset.
- **Accept:** presets resize framed content and persist; empty group → card warning badge + paused banner, last preview intact, **no floating error box anywhere**; forced engine error shows the in-pane friendly state with working Retry.

### Task 6: Canvas & palette polish

- `TreeNodeCard.vue`: 28×28 rounded icon chip tinted by category (`.cat-<category>` → `--builder-cat-*`/`-tint`); keep group/repeat left borders (chips are the only new color — restraint). Watch `editor.revealNodeId` → `scrollIntoView` (smooth only if motion OK) + `.just-added` highlight ~900ms fading from `--p-primary-50`.
- `FormEditorView.addFromPalette`: insert after the selected node (inside if it's an expanded container), set `revealNodeId`. `NodeList.vue`: set `revealNodeId` on drag-adds too.
- Merge the empty canvas hint + stray dashed drop zone into one designed empty-drop state ("Your form starts here — drag a question type from the palette, or click one to add it."), drop target intact, `data-testid="canvas-empty"` kept.
- `QuestionPalette.vue`: subtle per-category icon tinting; overlay-drawer variant styles.
- **Accept:** click-add with a mid-form selection inserts after it, scrolls + highlights; single designed empty state accepts drops; reduced-motion disables animations.

### Task 7: Properties panel restructure

- New `src/components/properties/PropSection.vue` (title, sectionKey, chevron, `aria-expanded`, default-expanded, collapse state persisted in `ui.propSectionsCollapsed`).
- `PropertyPanel.vue`: sticky header (type icon + label + `<code>name</code>`) inside the scroll container; wrap sections as Basics / Appearance / Choices / Logic.
- `ChoicesSection.vue`: rows become `grid-template-columns: auto minmax(96px,2fr) 3fr auto` (drag handle, name, label, delete); VueDraggable reorder with `handle=".choice-drag"` wired through the existing `editChoices` undo path; keep `choice-name-*`/`choice-label-*` testids.
- `TypeConfigSection.vue`: sentence-case display labels ("Randomize", "Seed") — registry names untouched.
- **Accept:** collapse state persists; no choice-name truncation at min panel width; choice drag-reorder round-trips undo; existing component-test selectors still resolve.

### Task 8: Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (theme-parity.spec.ts must pass untouched), `pnpm test:e2e`.
- New e2e: `tests/e2e/layout.spec.ts` (splitter drag + reload persistence; viewport sweep 390/900/1100/1440 asserting blocked screen / tabs / docked non-covering preview / full grid), `tests/e2e/preview-presets.spec.ts` (content width + persistence; empty-group containment — assert no element overlaps the property panel's bounding box and the paused banner shows).
- agent-browser manual sweep at 390/820/1024/1280/1440/1920: build a form, drag every handle, toggle preview + presets, empty-group flow, keyboard-only resize, `prefers-reduced-motion` emulation.
- **Accept:** all suites green (chromium + firefox); no overlap or horizontal scrollbars at any sweep width.

## Execution strategy (per user direction)

- **Dynamic workflows where appropriate.** Execute via the Workflow tool rather than single-threaded work where structure pays off:
  - Tasks 2–4 (foundations → wide layout → adaptive modes) run **sequentially** — each builds on the previous grid rework; orchestrating them in parallel would conflict in `FormEditorView.vue`.
  - Tasks 5–7 (preview/error containment, canvas polish, properties restructure) are **independent after Task 4** — fan them out as a parallel workflow phase with `isolation: 'worktree'` (they touch disjoint components), then merge.
  - Task 8 verification runs as a workflow: parallel agents for typecheck/lint/unit, e2e, and the agent-browser viewport sweep (one agent per width band), followed by an adversarial verify pass on any reported failure before it's accepted as real.
- **Delegated planning uses /shape-spec.** Any subagent handed planning or re-planning work must itself invoke the `unops-toolkit:shape-spec` skill and write/update the spec folder (`docs/specs/2026-07-09-1910-ux-overhaul-resizable-responsive/`) — spec docs are updated at the point of delegation, not back-filled by the main agent. Task 1 (spec save) therefore happens first and any mid-implementation re-scoping re-enters shape-spec to amend `shape.md`/`plan.md`.

## Risks

1. Playwright's default 1280×720 sits exactly on the wide threshold — the palette auto-tuck rule protects `preview.spec.ts`; re-run after Tasks 3 and 4.
2. Selector churn (`palette-toggle`, `preview-*`, `canvas-empty`) — keep every existing `data-testid` on new elements; `PropSection` must not swallow component-test `find()`s (default expanded).
3. Splitter × SortableJS: gutters are outside draggable lists; ignore handle `pointerdown` during an open drag transaction.
4. Web-forms CSS/error UI bleed: containment depends on `destroyChild()` on *every* error path (errorHandler + catch); test with the empty-group form.
5. Laptop docked preview squeezes canvas to ~360px — card badges need overflow guards.
6. Theme parity: no new tokens in `odk-tokens.css`, no edits to `odk-preset.ts`; `--p-{color}-*` accent references carry hex fallbacks.
7. Grid transitions can jank with the engine mounted: transition only discrete toggles (`.animating` class), never during drag; clamp loaded widths to the current viewport on first paint.

## Verification summary

Run Task 8 in full. Key manual checks: (1) preview widens by drag and by preset, persists across reload; (2) 1100px — edit a property while watching the docked preview; (3) 390px — editor shows the blocked screen, "Open form preview" fills the form; (4) empty group — paused banner in-pane, no floating error; (5) theme-parity + full e2e suites green.
