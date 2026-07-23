# Accessibility remediation — WCAG AA across themes, contrast modes & accents

## Context

A Lighthouse + axe-core audit of the live app (https://punkch.github.io/form-forge/, 2026-07-23)
found that while the Lighthouse landing-page a11y score is 95, driving the real UI
(editor, dialogs, menus) across 16 mode combinations (2 themes × 2 contrast levels ×
6 accents) surfaces **5 violation families** — 4 rated critical by axe:

1. **`aria-required-children`** (critical) — `<main role="tree">` (`FormEditorView.vue:383-399`)
   wraps the GuideCallout (`role="note"`) and the empty-state heading; invalid tree children.
2. **`label`** (critical) — properties-panel "Default" InputText (`prop-default`,
   `BasicSection.vue:147-167`) and every Translations-grid `cell-input`
   (`TranslationGrid.vue:149-171`) have no programmatic label.
3. **`button-name`** (critical) — the Translations dialog's PrimeVue maximize button has no
   accessible name (PrimeVue Dialog renders it with none; PrimeVue installed with no `locale`).
4. **`aria-allowed-attr`** (critical) — PrimeVue emits `aria-level` on export-menu
   `role="menuitem"` items (TieredMenu internals) and `aria-modal="true"` on the help
   drawer's `role="complementary"` root.
5. **`color-contrast`** (serious, systemic) — no AA guarantee in normal-contrast mode.
   Accent-as-text on light: blue 2.98, purple 4.46 (default!), teal 3.74, amber 2.15,
   rose 4.48-on-raised-surface; green passes. Accent-independent: muted text
   (`--odk-light-muted-text-color`) 2.56 light / 3.75 dark; muted-on-card 3.78; "Ready"
   problems chip (green-500 `#22c55e`) 2.27 — leaks even into high-contrast light; the
   ConditionBuilder SelectButton unchecked label 4.34 on `#f1f5f9`.

High-contrast mode is otherwise fully clean — the AAA clamp machinery works; normal mode
has no AA equivalent. Audit tooling already delivered (uncommitted): `scripts/a11y-audit.mjs`,
`pnpm audit:a11y`, `axe-core` devDep, CLAUDE.md command entry.

**Shaping decisions (user-confirmed):**
- Accent AA fix = **auto-clamp in the generator** (mirror the AAA clamp at 4.5:1).
- Regression gate = **CI, reduced matrix** (full accent matrix stays a manual act).
- Scope = **strictly a11y**; meta description + perf work → roadmap backlog entry.
- Icons/brand: purple `#6366f1` is baked into `public/favicon.svg`, the 5 PNG icons,
  `index.html` (static theme-color meta + inline no-FOUC ACCENTS map) and `vite.config.ts`
  `theme_color`. Decision: **decide after seeing it** — the clamp leaves brand hex500
  constants untouched (swatches/manifest/icons stay `#6366f1`); verification includes a
  visual purple-vs-icon comparison; regeneration only if visibly off (follow-up).

## Task 1: Save spec documentation

Create `docs/specs/2026-07-23-<HHMM>-a11y-wcag-aa-remediation/` with plan.md (this plan in
full), shape.md, standards.md, references.md, user-guide.md.

## Task 2: Accent AA clamp (generator) — `scripts/theme-css-lib.mjs` + new generated file

Machinery to reuse (all in `theme-css-lib.mjs`): `contrastRatio` (:154-177),
`pickClampStep(scale, bgHex)` (:203-216, parameterize its `AAA_FLOOR=7` to accept 4.5),
`pickContrastText` (:219-222), `ALL_ACCENT_ANCHORS` (6-entry incl. blue, :191-194),
`generateAccentContrastCss` (:243-277) as the structural template.

- New `AA_FLOOR = 4.5` and a new `generateAccentAaCss()` emitting a NEW committed file
  `src/styles/generated/theme-accents-aa.css`. Selectors: light `:root[data-ff-accent="<id>"]`
  (0,2,0 — beats the runtime `:root` emission), dark `:root[data-ff-theme="dark"][data-ff-accent="<id>"]`.
  NO `data-ff-contrast` key, so it applies in normal mode; the high-contrast file's compound
  selectors (0,3,0 / 0,4,0) still win when HC is on. Import order: after `theme-accents.css`,
  before `theme-contrast-accents.css` (verify actual import site during implementation).
- Clamp **applied tokens only**, never the `--p-primary-*` scale: `--p-primary-color`,
  `--p-primary-hover-color`, `--p-primary-active-color` (hover/active = adjacent darker steps
  when available, to keep hover feedback; fall back to collapse like the AAA clamp),
  `--p-primary-contrast-color` (re-picked via `pickContrastText`), `--p-highlight-background`,
  `--p-highlight-color` — **plus** the ODK accent-as-text aliases `--odk-primary-text-color`
  and `--odk-primary-border-color` → the clamped value (mirrors `builder-contrast.css:53-54`).
  This covers both consumer families (PrimeVue buttons/links/tabs AND `--odk-*` links).
- Clamp backgrounds = **worst-case normal surfaces**, added as a shared constant in
  `src/theme/constants.ts` next to `HIGH_CONTRAST_SURFACES` (e.g. `NORMAL_AA_SURFACES`):
  light `#f8fafc` (raised slate-50 — stricter than white, fixes `.callout-learn-more`),
  dark `#1e293b` (raised slate-800 — stricter than the `#0f172a` base). Emit only blocks
  that change something (dark mostly passes already); blue gets a block (its base scale is
  the byte-pinned runtime emission — a `data-ff-accent="blue"` override file is legal, per
  the existing HC clamp precedent; do NOT touch `generateAccentsCss`/`ACCENT_GEN`'s
  pinned 5-entry blue-skip).
- Wire into `scripts/generate-theme-css.mjs` (write the 4th file), run `pnpm generate:theme`.
- **Gate**: extend `tests/unit/theme-generated.spec.ts` — byte-identity for the new file +
  self-consistency assertions modeled on the existing AAA block (:48-115) at floor 4.5
  against `NORMAL_AA_SURFACES`, for all 6 accents × both schemes (assert the *resolved*
  applied token passes, whether or not a block was emitted).

## Task 3: Muted-token & component color remaps (hand-authored CSS)

`src/styles/odk-tokens.css` is byte-parity-locked — all remaps go in `builder.css` /
`builder-dark.css` / `builder-contrast.css`. PrimeVue's runtime CSS is unlayered and
injected last, so same-specificity `:root{}` overrides LOSE — scope overrides as
`:root[data-ff-theme]` (0,2,0; the attr is always present) or within existing themed blocks.

- **Muted text, light/normal** (`builder.css`): remap `--odk-muted-text-color` (now
  surface-500 `#718095`, 3.78 on the `#f8f8f8` card bg) and `--odk-light-muted-text-color`
  (surface-400 `#94a3b8`, 2.56 on white) to steps that clear 4.5 against BOTH `#ffffff` and
  `#f8f8f8` (compute with the lib's `contrastRatio`; keep two visual tiers if the scale
  allows, else differentiate by tier collapse — verify visually in the UX pass).
- **Muted text, dark** (`builder-dark.css:19-20`): the failing tier is `#64748b` on `#0f172a`
  (3.75) — bump the tier(s) one step lighter until ≥4.5 vs `#0f172a` AND `#1e293b`.
- **"Ready" chip** (`ProblemsButton.vue:86-97`, `severity="success" text`): override
  `--p-button-text-success-color` — normal light: a green ≥4.5 on white (≈ green-700
  `#15803d`); dark already passes (green-400 via theme-dark.css). **Also fix the HC leak**:
  add a success-color remap in `builder-contrast.css` clearing 7:1 per scheme, and extend
  `tests/unit/theme-contrast-ratio.spec.ts` if the token is expressible in its literal-hex
  format (it only parses literal hexes).
- **SelectButton unchecked label** (`ConditionBuilder.vue:268-279`; token
  `--p-togglebutton-color` = surface-500 `#64748b`, 4.34 on its `#f1f5f9` track): override to
  a step ≥4.5 vs `#f1f5f9` (≈ surface-600 `#475569`) in `builder.css`; check dark equivalent.
- All new/changed declarations must satisfy the stylelint undefined-var guard (tokens used
  here all exist in the importFrom lists — no config change expected).

## Task 4: ARIA/semantics fixes

- **4a. Tree role move** — `FormEditorView.vue:383-399`: drop `role`/`aria-multiselectable`/
  `:aria-label` from `<main class="editor-canvas">`. `NodeList.vue:84-111`: bind on the inner
  `.node-list` `<TransitionGroup tag="div">` (it contains ONLY TreeNodeCards):
  `:role="root ? 'tree' : 'group'"`, root also gets `aria-multiselectable="true"` +
  `:aria-label="t('shell.editor.formStructure')"`. MUST gate on `props.root` (NodeList is
  recursive via `TreeNodeCard.vue:275`); nested lists become `role="group"` (valid inside
  treeitem). Empty state (`NodeList.vue:99-107`) and GuideCallout stay outside the tree.
  Safe: nothing in src/ or tests queries `role=tree`/`.editor-canvas`; keyboard scoping keys
  off `.canvas-panel` (`FormEditorView.vue:191`); TreeNodeCard already has `role="treeitem"`
  + `aria-selected` (`TreeNodeCard.vue:197-210`).
- **4b. Default field** — `BasicSection.vue:147-167`: the wrapper can't be a `<label>` (the
  AttachmentPicker branch), so add `:aria-label="t('properties.basic.defaultValue')"` to the
  else-branch InputText (repo's established pattern for non-wrappable controls).
- **4c. Translations grid** — `TranslationGrid.vue:149-171`: per-cell `:aria-label` composed
  as `` `${site.context} — ${columnLabel}` `` (`site.context` is the exact human row label,
  e.g. "age · Label"; columnLabel = the language string, or the sentinel column's resolved
  Text/Unassigned header) on both sentinel and language cell inputs.
- **4d. Maximize button** — `TranslationsDialog.vue:84-93`: use the typed prop (repo has NO
  `pt` usage; prefer typed props): `:maximize-button-props="{ 'aria-label': t('dialogs.translations.maximize') }"`
  — new key in en + fr + es catalogs (MessageSchema parity is vue-tsc-enforced).
- **4e. PrimeVue aria locale** — `main.ts:55-60` + `src/i18n/setLocale.ts`: new module
  `src/i18n/primevue-locale.ts` exporting a per-locale (en/fr/es) PrimeVue `locale.aria`
  object (typed `Record<AppLocale, …>` so parity is compiler-checked; vendor strings stay
  out of the app MessageSchema). Seed it in the `app.use(PrimeVue, {locale})` options AND
  update the reactive config inside `setLocale` on switch (boot calls `setLocale` before
  mount — seed covers init, setLocale covers switches). This localizes Dialog/Drawer close
  buttons (they read `locale.aria.close`) for free.
- **4f. Help drawer role** — `QuestionTypeHelpDrawer.vue:74-79`: PrimeVue Drawer hardcodes
  `role="complementary"` but merges `ptmi('root')` last; try a plain `role="dialog"` attr on
  `<Drawer>` first (attrs flow through ptmi and should win), verify in the served app; if it
  doesn't stick, use `:pt="{ root: { role: 'dialog' } }"` (would be the repo's first `pt` —
  acceptable, documented in the spec).
- **4g. Export-menu `aria-level`** — `ExportMenu.vue:190-201`: TieredMenu hardcodes
  `aria-level`/`aria-setsize`/`aria-posinset` on menuitems. Attempt
  `:pt="{ pcMenu: { item: { 'aria-level': null } } }"` (Vue drops null attrs); verify in the
  DOM. If the hoisted attr survives, DOCUMENT as a known upstream PrimeVue 4.3.3
  non-conformance in the spec + a code comment, and exclude nothing from the audit script
  (the finding stays visible, deliberately accepted until a PrimeVue bump).

## Task 5: CI regression gate (reduced matrix)

Wire `pnpm audit:a11y` into `.github/workflows/ci.yml` (details per the CI exploration:
job placement next to the existing e2e job, serve the built app on :4173 the same way
playwright's webServer does). Reduced matrix: `--theme both --contrast both --accent default`
plus a worst-case spot check `--theme light --contrast normal --accent blue`. Use
`--url http://localhost:4173/<base-path>/`. The script already exits 1 on violations.
Full 24-mode matrix stays a documented manual act (CLAUDE.md).

## Task 6: Docs & bookkeeping (same change)

- CLAUDE.md: new hard invariant — normal-mode AA clamp + gate (mirroring the AAA entry),
  audit:a11y CI gate note; keep the Commands entry current.
- README Features + `docs/product/roadmap.md`: mark a11y remediation delivered; add the
  backlog entry "Performance & SEO" (meta description, code splitting / lazy-load
  web-forms + xlsx, FCP/LCP ~12s on throttled mobile, 750 KiB unused JS / 373 KiB unused CSS).
- `docs/specs/backlog/` recreated for the perf proposal per repo convention.

## Verification

1. `pnpm generate:theme` produces a stable committed diff; `pnpm test` green including the
   new/extended gates (`theme-generated.spec.ts` AA assertions, `theme-contrast-ratio.spec.ts`);
   `pnpm lint` (stylelint var guard) + `pnpm typecheck` (fr/es catalog parity) green.
2. `pnpm build && pnpm preview`, then `pnpm audit:a11y --url http://localhost:4173/ --theme both
   --contrast both --accent default --json …` → expect ZERO violations except (possibly) the
   documented 4g aria-level exception; then `--accent all` light+dark spot sweep.
3. `pnpm test:e2e` — canvas keyboard flows, translations dialog, export menu unaffected.
4. agent-browser UX pass (logged to `docs/verification/`): screenshot clamped accents
   (esp. purple vs the `#6366f1` favicon/PWA icons — the deferred icons decision), muted-text
   tiers, Ready chip, both themes + HC; `/unops-toolkit:interface-craft` critique of the same
   screens; fold findings into the fix batch.
5. `/unops-toolkit:code-review` on the diff; apply verified findings; re-run suites.
6. Re-run the live audit after deploy (manual) to confirm Lighthouse a11y 100 / axe clean.
