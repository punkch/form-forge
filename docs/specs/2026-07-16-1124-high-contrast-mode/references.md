# References — high-contrast mode

Promoted 2026-07-16 from `docs/specs/backlog/high-contrast-mode.md` (kept as
the provenance record — accessibility research, WCAG targets, the
`forced-colors` distinction). The backlog doc's "why the existing
architecture makes this cheap-ish" section and its code pointers were
re-verified against the code on 2026-07-16; the notes below are the
**corrected** version — use these, not the backlog doc's, where they differ.

## Verified current implementation (2026-07-16)

**Groundwork status: none.** Grep-confirmed — no `data-ff-contrast`,
`prefers-contrast`, `forced-colors`, or `ContrastPref` anywhere in `src/`,
`scripts/`, or `index.html`. Every reference below is a file this feature
*extends* with a parallel third dimension, not one that already has partial
contrast support.

- **`src/theme/index.ts`** — `applyTheme` (lines 68–75) stamps only
  `data-ff-theme` (line 71) and `data-ff-accent` (line 72) plus the
  `color-scheme`/`theme-color` metas; no third attribute today.
  `initThemeController` (lines 104–123) watches
  `matchMedia('(prefers-color-scheme: dark)')` (line 109) and
  `[ui.theme, ui.accent]` (line 121) — a contrast preference needs a second
  `matchMedia('(prefers-contrast: more)')` listener here, gated the same way
  the existing one is (only re-applies while the *effective* preference is
  `system`). `setEmbedTheme` (lines 133–137) accumulates `theme`/`accent`
  overrides field-by-field; extend with a third `contrast` parameter using
  the same accumulate-and-persist-until-replaced semantics.
- **`index.html`** — the no-FOUC inline `<script>` (lines 19–48) reads
  `localStorage['odk-builder:ui:v1']`, resolves `theme`/`accent`, and stamps
  the attributes before first paint. It must gain the same dependency-free
  contrast resolution (read `pref.contrast`, resolve `system` via
  `matchMedia('(prefers-contrast: more)')`, stamp `data-ff-contrast` when the
  resolved value is `high`) and stay in lockstep with `src/theme/constants.ts`
  — pinned today by `tests/unit/theme-inline-script.spec.ts`, which needs
  equivalent new assertions.
- **`src/stores/ui.ts`** — `theme`/`accent` are persisted refs at lines
  107–109 (validated with `isThemeScheme`/`isAccentId`, defaulted from
  `constants.ts`). `applyPreferences` (lines 177–201) is lenient per-field —
  confirmed this means the additive `contrast` key needs **no**
  `WORKSPACE_FORMAT_VERSION` bump: an old archive without it leaves the
  default `system` in place, and an old build reading a field it doesn't
  recognize simply never assigns it.
- **`scripts/theme-css-lib.mjs`** — exports `generateThemeDarkCss`,
  `generateAccentsCss`, `accentPrimary500`, `ACCENT_GEN` (5 entries: purple,
  green, teal, amber, rose — lines 113–119; `blue` deliberately emits **no**
  override today since it's the base ODK scale). Under high contrast, `blue`
  **does** need a clamp block (decision 3 in `shape.md`) since its base scale
  wasn't chosen for AAA — the new `generateAccentContrastCss()` must cover
  all six accent ids, not just the five in `ACCENT_GEN`. The module also
  exports `DARK_SELECTOR` and a `ruleBlocks`/`assertFlat`/`darkCss` parsing
  trio (private) that the new generator can reuse or parallel for its own
  extraction needs.
- **`tests/unit/theme-generated.spec.ts`** — the drift gate (lines 22–28)
  asserts byte-identity between the committed generated files and a fresh
  regeneration for `theme-dark.css` and `theme-accents.css`. Extend with a
  third assertion for `theme-contrast-accents.css` /
  `generateAccentContrastCss()`.
- **`stylelint.config.mjs`** — the `importFrom` array (lines 33–47) lists
  every known-token source (`odk-tokens.css`, `builder.css`,
  `builder-dark.css`, the two existing generated files, the
  `--accent-swatch-color` runtime allowlist entry, and the live
  `primevueCustomProperties()` promise). Register the new
  `builder-contrast.css` and `theme-contrast-accents.css` here or any new
  custom property in either goes undetected by the undefined-property gate.
- **`src/views/SettingsView.vue`** — the Appearance section (lines 177–217)
  has the scheme `Select` (`data-testid="settings-theme-select"`, line 187)
  and the accent swatch row (`data-testid="settings-accent-swatches"`, line
  197; each swatch `data-testid="accent-swatch-<id>"`, line 209, built from
  `ACCENTS`). The new contrast control is a sibling `Select` in the same
  section with its own new testid (`settings-contrast-select`); its
  `changeTheme`-style handler (see `changeTheme`, line ~79) writes straight
  to a new `ui.contrast` ref.
- **`src/embed/protocol.ts`** — `EmbedConfig` (lines 32–47) currently has
  `theme?: EmbedTheme` / `accent?: AccentId`; `coerceEmbedConfig` (lines
  247–263) validates them with `isThemeScheme`/`isAccentId` at lines 260–261.
  Add `contrast?: EmbedContrast` (a wire alias of the new `ContrastPref`,
  mirroring how `EmbedTheme` aliases `ThemeScheme`) and a matching guard
  line.
- **`src/stores/embed.ts`** — `applyConfig` calls `setEmbedTheme(partial.
  theme, partial.accent)` when either is defined (lines ~34–37); extend the
  condition and call to include `partial.contrast`.
- **`src/styles/builder-dark.css`** — the hand-authored companion this
  feature's surface layer is modeled on. Concrete tokens a high-contrast pass
  will touch: `--odk-text-color`/`--odk-muted-text-color`/`--odk-border-
  color`/`--odk-base-background-color` (the alias layer, fixed scale steps,
  not auto-inverting); `--builder-scrim-bg`/`--builder-drawer-shadow`/
  `--builder-card-shadow` (raw `rgba` shadow/scrim literals to flatten to
  hard lines); the eight `--builder-cat-*`/`--builder-cat-*-tint` pairs (the
  category palette — decision: tints become borders + labels).
- **`src/components/canvas/TreeNodeCard.vue`** — `.type-chip.cat-*` rules
  (around lines 253–275) currently paint each category chip's background
  from `--builder-cat-<id>-tint` and its text/icon colour from
  `--builder-cat-<id>`. This is the concrete component the "tint backgrounds
  become borders + labels" decision touches — a high-contrast override needs
  an actual rule (`background: transparent; border: 1px solid …`), not just a
  custom-property remap, since the tint and the border are different CSS
  properties on the same rule today.
- **`src/styles/builder.css`** — the global `:focus-visible` rule (around
  line 82: `outline: 1px solid var(--p-primary-500, #3e9fcc); outline-offset:
  1px;`) is the focus ring high contrast must thicken and guarantee-contrast.
- **`src/styles/odk-tokens.css`** — `--odk-primary-text-color`/
  `--odk-primary-border-color` (point at the fixed `--p-primary-500` step)
  and `--odk-primary-light-background-color`/`--odk-primary-lighter-
  background-color` (fixed `--p-primary-100`/`--p-primary-50` steps) are
  ODK-alias tokens that reference specific scale steps rather than the
  "applied" `--p-primary-color` semantic token the generated accent-contrast
  blocks re-point — these aliases need their own high-contrast remap (in
  either the hand-authored or generated layer) or they will keep resolving
  to a mid-scale value that may not clear AAA even after the applied
  PrimeVue tokens are clamped.
- **`scripts/theme-css-lib.d.mts`** — hand-written type declarations for the
  plain-JS generator module (mirrors `webforms-bundle-lib.d.mts`); needs new
  exports added for `generateAccentContrastCss`, the WCAG ratio helper(s),
  and any new exported constant lists, or `vue-tsc` cannot resolve the new
  imports from `.ts` call sites (the unit test, the CLI wrapper).
- **`src/main.ts`** — imports the three theming stylesheets at lines 10–12
  (`theme-dark.css`, `theme-accents.css`, `builder-dark.css`) and calls
  `initThemeController(useUiStore(pinia))` at line 81. The two new
  stylesheets (`theme-contrast-accents.css` generated,
  `builder-contrast.css` hand-authored) are added to that import block;
  `initThemeController`'s call site is unchanged (the store instance already
  carries the new `contrast` ref once the store is extended).
- **`public/embed-demo.html`** — the reference host page already has
  `<select id="opt-theme">`/`<select id="opt-accent">` (around lines 66–82)
  wired to a `sendAppearance` handler; add a matching `opt-contrast` select
  for manual/demo verification of the new embed key.
- **`docs/specs/2026-07-09-2235-embed-postmessage-api/user-guide.md`** — its
  `init`/`set-config` config bullet list (around the "Config, all keys
  optional" section) was never updated when `theme`/`accent` were added
  during the theming delivery — it still only documents `exports`,
  `persistence`, `locale`. Adding `contrast` here is in scope per the
  backlog's docs-sweep item; bring `theme`/`accent` along in the same edit
  since they're a pre-existing gap this touches anyway.

## Related specs

- `docs/specs/2026-07-13-1840-theming/` — the mechanism this composes with:
  the generated-CSS approach, the attribute-selector specificity trick that
  survives the preview's PrimeVue-runtime clobbering, the apply layer, the
  no-FOUC script, and the additive embed-config precedent. Read `plan.md`'s
  "File map" section and `standards.md`'s "How to regenerate the theme CSS" /
  "The drift gate" / "Adding a new accent" sections before touching the
  generator.
- `docs/specs/2026-07-15-1729-workspace-full-backup/` — the
  `preferences.json` mechanism (`exportPreferences`/`applyPreferences`) this
  feature's persisted `contrast` field rides, and the precedent for "additive
  field, no format bump, lenient per-field restore."

## External research (from the backlog doc)

- WebAIM — Contrast and Color Accessibility (WCAG 2 SC 1.4.3/1.4.6/1.4.11):
  <https://webaim.org/articles/contrast/>
- MDN — `forced-colors` media feature:
  <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors>
- MDN — `forced-color-adjust`:
  <https://developer.mozilla.org/en-US/docs/Web/CSS/forced-color-adjust>
- Microsoft Edge blog — Styling for Windows high contrast with forced colors:
  <https://blogs.windows.com/msedgedev/2020/09/17/styling-for-windows-high-contrast-with-new-standards-for-forced-colors/>
- Smashing Magazine — Windows High Contrast Mode, Forced Colors Mode and CSS
  Custom Properties:
  <https://www.smashingmagazine.com/2022/03/windows-high-contrast-colors-mode-css-custom-properties/>
- Polypane — Forced colors explained, a practical guide:
  <https://polypane.app/blog/forced-colors-explained-a-practical-guide/>
- w3c/aria-practices #3062 — authoring practices for `prefers-contrast:
  more`: <https://github.com/w3c/aria-practices/issues/3062>
