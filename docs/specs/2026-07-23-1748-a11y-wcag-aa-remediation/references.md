# References — Accessibility remediation (WCAG AA)

## Audit data (2026-07-23, live app)

Unique axe violations across all audited states (WCAG 2.x A/AA ruleset):

| Rule | Impact | Where seen |
| --- | --- | --- |
| `aria-required-children` | critical | editor canvas, every theme/contrast/accent mode |
| `label` | critical | `prop-default` input (editor); 6-7 `cell-input`s (Translations dialog) |
| `button-name` | critical | Translations dialog maximize button |
| `aria-allowed-attr` | critical | export menu (`aria-level` ×5), help drawer (`aria-modal` on complementary) |
| `color-contrast` | serious | see matrix below |

Accent-as-text contrast (light scheme, `--p-primary-500`; computed with the repo's own
`contrastRatio`): blue `#3e9fcc` 2.98 · purple `#6366f1` 4.47 · green `#0f7c39` 5.30 ✓ ·
teal `#0d9488` 3.74 · amber `#f59e0b` 2.15 · rose `#e11d48` 4.70-on-white but 4.48 on
`#f8fafc`. Dark scheme (`--p-primary-400` on `#0f172a`): all six pass; green/rose dip to
3.94/3.85 on the raised `#1e293b` callout surface.

Accent-independent: `--odk-light-muted-text-color` (surface-400 `#94a3b8`) 2.56 on white /
(`#64748b`) 3.75 on `#0f172a`; `--odk-muted-text-color` (surface-500 `#718095`) 3.78 on the
`#f8f8f8` template cards; "Ready" chip `--p-button-text-success-color` (green-500 `#22c55e`)
2.27 on white **including high-contrast light** (the only HC leak); SelectButton unchecked
label (`--p-togglebutton-color` `#64748b`) 4.34 on `#f1f5f9`.

Lighthouse (root, throttled mobile): performance 54 (FCP 11.9s / LCP 12.2s, 750 KiB unused
JS, 373 KiB unused CSS — monolithic bundle), a11y 95, best-practices 100, SEO 90 (missing
meta description only). `#/settings` a11y 100.

## Reference implementations (this codebase)

### The high-contrast AAA clamp — template for the AA clamp
- **Location:** `scripts/theme-css-lib.mjs` — `contrastRatio` (:154-177), `pickClampStep`
  (:203-216), `pickContrastText` (:219-222), `ALL_ACCENT_ANCHORS` (:191-194, 6 entries incl.
  blue), `generateAccentContrastCss` (:243-277); output `src/styles/generated/theme-contrast-accents.css`.
- **Key patterns to borrow:** walk the palette outward from 500 to the least-extreme step
  clearing the floor; clamp *applied* tokens (`--p-primary-color`/hover/active/contrast,
  highlight pair), never the scale; blue gets its own override block even though normal-mode
  `generateAccentsCss` (`ACCENT_GEN`, 5 entries) deliberately skips it — that skip is pinned.
- **Gate template:** `tests/unit/theme-generated.spec.ts` (byte-identity :24-45,
  self-consistency ratio assertions :48-115) and `tests/unit/theme-contrast-ratio.spec.ts`
  (literal-hex parsing of hand-authored contrast CSS, floors 7:1 text / 3:1 border, pinned
  to `HIGH_CONTRAST_SURFACES` in `src/theme/constants.ts:97-100`).

### The override-layer discipline
- `src/styles/odk-tokens.css` — byte-parity with web-forms, NEVER hand-edited; defines
  `--odk-muted-text-color: var(--p-surface-500)` (:34), `--odk-light-muted-text-color:
  var(--p-surface-400)` (:35), `--odk-primary-text-color: var(--p-primary-500)` (:22).
- `src/styles/builder-dark.css` (:19-20 muted remaps, :31-32 accent-as-text → primary-400)
  and `builder-contrast.css` (:40-41/:86-87 muted, :53-54 accent aliases → `--p-primary-color`)
  show the remap pattern per mode.

### ARIA fix surfaces
- Canvas tree: `src/views/FormEditorView.vue:383-399` (role on `<main>`), `src/components/
  canvas/NodeList.vue:84-111` (VueDraggable host > empty-state + `.node-list` TransitionGroup;
  recursive via `TreeNodeCard.vue:275` — role move MUST gate on `props.root`), `TreeNodeCard.vue:197-210`
  (already `role="treeitem"` + `aria-selected`). Nothing in src/tests queries `role=tree`;
  keyboard scope keys off `.canvas-panel` (`FormEditorView.vue:191`).
- Label patterns: `BasicSection.vue:105-143` (implicit `<label class="prop-field">` wrap) vs
  the Default field `<div>` exception (:147-167); aria-label is the repo pattern for
  non-wrappable controls.
- Translations grid model: `TranslationGrid.vue:149-171` cells; `site.context` human row
  label + `siteKey()` from `src/core/model/translations.ts:356-361, :472-483`.
- Typed-prop precedent (repo has ZERO `pt` usage): `menuButtonProps` in `ExportMenu.vue:199`;
  Dialog `maximizeButtonProps` exists in PrimeVue 4.3.3 (`dialog/index.mjs:130`, button
  rendered with no aria-label :571-586); Drawer hardcodes `role="complementary"` but merges
  `ptmi('root')` last (`drawer/index.mjs:300-307`); TieredMenu hoists `aria-level`/`aria-setsize`/
  `aria-posinset` onto menuitems (`tieredmenu/index.mjs:219`); Dialog/Drawer close buttons read
  `config.locale.aria.close` — wiring PrimeVue locale localizes them for free.
- Locale wiring: `src/main.ts:55-60` (PrimeVue installed with no `locale`),
  `src/i18n/setLocale.ts` (single locale-switch entry point, currently i18n+`<html lang>` only).

## Audit tooling

`scripts/a11y-audit.mjs` (`pnpm audit:a11y`) — Playwright + axe-core sweep of a running
instance, 13 UI states per theme×contrast×accent mode; accent roster parsed from
`src/theme/constants.ts`; exits 1 on violations. Delivered with this work package.

## Brand-color coupling (for the deferred icons decision)

`#6366f1` appears in: `public/favicon.svg` (fill), the 4 PWA PNGs + `apple-touch-icon.png`
(rendered from it, no generation script exists), `index.html:8` (static theme-color meta),
`index.html:22` (inline no-FOUC ACCENTS map — duplicates `constants.ts` hex500s),
`vite.config.ts:35` (manifest `theme_color`).
