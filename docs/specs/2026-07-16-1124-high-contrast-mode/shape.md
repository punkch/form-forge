# High-contrast mode (accessibility) — shaping notes

## Scope

Add an **orthogonal contrast preference**, `normal | high | system`, that
crosses with the existing `theme` (`light | dark | system`) preference — not a
fourth "high-contrast dark" theme. This yields four render states (light,
light+high, dark, dark+high) and matches the platform model (macOS "Increase
contrast", Windows contrast themes both ship light and dark variants).
`system` resolves via the `prefers-contrast: more` media query, exactly as
`theme: system` resolves via `prefers-color-scheme`.

Ships:

- **Contrast preference** `normal | high | system` (default `system`),
  persisted in the ui store beside `theme`/`accent`, carried in the workspace
  backup's `preferences.json` (additive key, no format-version bump).
- **`data-ff-contrast` attribute** (`"high"` or absent) stamped by `applyTheme`
  and the no-FOUC inline script; a second `matchMedia('(prefers-contrast:
  more)')` listener in the theme controller.
- **Hand-authored override CSS** (`src/styles/builder-contrast.css`) for both
  schemes: near-white/near-black surfaces, ≥7:1 text, ≥3:1 borders/dividers, a
  thicker guaranteed-contrast focus ring, disabled/secondary text raised above
  the AAA large-text floor, category-tint palette chips converted to borders +
  labels, shadows/scrims flattened to hard lines. Applies to chrome **and** the
  embedded preview via the existing token chain.
- **Generated accent AAA clamping** (`generateAccentContrastCss()` in
  `scripts/theme-css-lib.mjs`): for each accent (including `blue`, which emits
  no override in normal mode but needs one here) × each scheme, a compound
  block re-points the *applied* primary tokens — button background, link/
  accent text, focus ring, selection — at whichever step of the accent's
  already-computed 50–950 scale clears the AAA floor against the high-contrast
  surfaces, choosing white or dark button text per step.
- **Settings control**: a three-state select (Normal / High / System) in the
  Appearance section, beside the existing scheme select. The header's 3-state
  scheme toggle is unchanged (no contrast control added there).
- **Embed mode**: additive `contrast` key on `EmbedConfig` (`init` /
  `set-config`), coerced with a `constants.ts` guard, accepting `system`; host
  wins over the persisted preference while embedded (mirrors `theme`/
  `accent`); no protocol-version bump.
- **Forced-colors audit** (companion work item, not a theme): run the app
  under a Windows contrast theme / DevTools `forced-colors: active`
  emulation; fix focus indicators (`outline` over `box-shadow`), custom-
  control borders, icon `currentColor`, and swatches that must keep their real
  colour (`forced-color-adjust: none`). Small, targeted `@media
  (forced-colors: active)` tweaks only — the platform does the heavy lifting.
- Docs sweep on delivery: README Features, roadmap, CLAUDE.md (theme rows),
  the theming user-guide (cross-reference), and the embed-postmessage-api
  guide (new config key).

**Out of scope:** font-size/zoom preferences, reduced-motion (separate
concerns, future "Accessibility" settings siblings), a user-customizable
color picker, WCAG 3/APCA scoring (track it, don't build on it yet), and
re-theming beyond color + border + focus (no layout changes).

## Decisions

All resolved 2026-07-16 (promotion). The backlog's five "proposed decisions"
are adopted as written; its four "open questions" are resolved below.

1. **Orthogonal setting, not a new theme entry.** `contrast: normal | high |
   system` crosses with `theme`; there is no "high-contrast dark" scheme
   entry. Matches the OS model; the header toggle is untouched.
2. **Default `system`**, resolved via `prefers-contrast: more`. Users who
   already asked their OS for more contrast get it on first paint; nobody
   else sees any change.
3. **Accents survive via generated derived clamping.** A new
   `generateAccentContrastCss()` in the existing generator emits, per accent ×
   scheme, a compound block (`:root[data-ff-contrast="high"][data-ff-accent=
   "…"]` + the dark compound) that re-points the *applied* primary tokens
   (button bg, link/accent text, focus, selection — not the whole 50–950
   scale) at whichever palette step clears the AAA floor against the
   high-contrast surfaces, picking white or dark button text per step (the
   amber `--p-primary-contrast-color` precedent, applied systematically). A
   dependency-free WCAG contrast-ratio helper (~15 lines of hex math) joins
   `theme-css-lib.mjs`; the existing drift gate extends to the new file,
   making the ratio floors self-enforcing. `blue` (the default accent, which
   emits no override in normal mode) gets a clamp block here too, since its
   base scale wasn't chosen for AAA. Accepted trade-off: step-picking mutes
   some hue identity at 7:1 (amber reads brown-ish) — inherent to AAA
   contrast and consistent with what OS contrast themes do to accent colours.
4. **Surface CSS is hand-authored with a ratio-enforcing test; accent clamps
   are generated.** There is no upstream high-contrast emission for the
   surface/semantic layer (unlike dark mode, which was generated from the
   pinned `@primeuix/styled` emission), so that part is authored like
   `builder-dark.css`, and a new unit spec that parses it and checks WCAG
   ratios replaces the drift gate as its safety net. The accent-clamp CSS
   (decision 3) is generator-emitted and drift-gated like the existing accent
   file. The high-contrast surface hex values need one source of truth both
   the hand-authored CSS and the generator's ratio math agree on
   (`src/theme/constants.ts` exports them); the ratio test cross-checks the
   two.
5. **Forced-colors is an audit, not a theme.** Per MDN/Microsoft authoring
   guidance: the platform replaces page colours with a user palette
   regardless of our CSS, so the app's job is small, scoped
   `@media (forced-colors: active)` tweaks, not a fourth rendering mode.

Resolutions to the backlog's open questions:

- **High contrast reduces decoration, it doesn't just strengthen colour.**
  Category-tint backgrounds (the palette/canvas type chips) become a border +
  the existing label, and shadows flatten to hard 1px lines — matching what
  Windows/macOS contrast themes do system-wide. The exact selectors and
  values are settled during an `/interface-craft` design-critique pass in
  implementation, informed by the known candidates already identified in code
  (`TreeNodeCard.vue`'s `.type-chip.cat-*` rules, `--builder-scrim-bg`/
  `--builder-drawer-shadow`/`--builder-card-shadow`).
- **Settings control is a dedicated three-state select**, mirroring the
  existing scheme select — not a single "Increase contrast" switch. Keeps the
  three states (including "System") equally visible and discoverable.
- **`prefers-contrast: less` is treated as `normal`.** It is not acknowledged
  as a distinct state.
- **The embedded preview is re-contrasted.** Consistent with dark mode's
  stance (the preview already re-themes with the chrome via the shared token
  chain): re-contrasting it helps builder usability more than a WYSIWYG
  mismatch would cost, but the trade-off — the preview no longer shows
  exactly what an enumerator with default OS settings would see — is
  documented in `user-guide.md`.

## Context

Promoted 2026-07-16 from `docs/specs/backlog/high-contrast-mode.md` (kept as
the provenance record: the accessibility research, the WCAG/`forced-colors`
distinction, the feasibility read of the existing theming mechanism). Open
questions were resolved with the user 2026-07-16 (see Decisions above); the
backlog's "current implementation" claims were independently re-verified
against the code on 2026-07-16 and one correction was material enough to
change the plan's precision: **zero contrast groundwork exists in the
repository today** (grep-confirmed — no `data-ff-contrast`, `prefers-
contrast`, `forced-colors`, or `ContrastPref` anywhere in `src`, `scripts`, or
`index.html`), so every file this feature touches is a net-new addition to an
established pattern, not a tweak to existing contrast code. `references.md`
carries the corrected file:line pointers this promotion verified.

This feature is a straight extension of the delivered theming mechanism
(`docs/specs/2026-07-13-1840-theming/`): the token chain
(`--builder-*`→`--odk-*`→`--p-*`), the `data-ff-*` attribute pattern, the
apply layer, the no-FOUC script, ui-store persistence, and the additive embed
config precedent all already solved the structural problem a third
orthogonal dimension needs. The one genuine difference is that dark mode was
*generated* wholesale from the pinned `@primeuix/styled` emission and high
contrast has no equivalent upstream emission for its surface layer — hence
decision 4's split between hand-authored surfaces and generated accent
clamps.

## Skills & conventions applied

- **unops-toolkit:shape-spec** — used to promote this backlog proposal into
  this timestamped spec folder.
- **Delivery process (CLAUDE.md)** — spec folder → dynamic Workflow with
  parallel Sonnet implementors → verification (full suite + an
  `/agent-browser` pass across all four scheme×contrast states, chrome and
  preview, plus a `forced-colors` emulation audit, logged to
  `docs/verification/`) → an `/interface-craft` design-critique pass to
  settle the decoration-reduction specifics → `/code-review` (five lenses, no
  plan mode) with findings fixed immediately → conventional commit(s) →
  README/roadmap/CLAUDE.md docs sweep in the same change.
- **CLAUDE.md hard invariants** — `src/core` purity (untouched by this
  feature), the byte-identical PrimeVue preset + `darkModeSelector: false`
  invariant (unchanged; contrast rides the same static-CSS mechanism dark
  mode uses), the typed i18n catalog (`appSettings.appearance.*`),
  `data-testid` preservation, the stylelint undefined-custom-property gate,
  the workspace-backup additive-preferences rule, and conventional commits
  with **no `Co-Authored-By` trailer** (global user instruction).
