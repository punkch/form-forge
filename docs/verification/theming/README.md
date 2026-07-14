# Theming — manual verification pass (2026-07-13)

Light/dark/system colour scheme + accent presets that restyle the builder chrome
**and** the embedded web-forms preview together. Verified in-browser
(agent-browser, Chromium) against the Vite dev server, plus the automated suites.

## Automated gates (all green)

- `pnpm typecheck` — clean.
- `pnpm lint` — clean.
- `pnpm test` — 117 files, **1051 unit/component tests** pass.
- `pnpm verify:webforms` — 7 checks incl. the two new guards: *web-forms installs
  PrimeVue with `darkModeSelector:false`* and *generated CSS up to date*.
- `pnpm build` — production build succeeds (PWA precache generated).
- `pnpm test:e2e` — **93 passed, 1 skipped** (chromium + firefox), including the
  4 new `theming.spec.ts` cases below.
- `/code-review` — five-lens parallel review; all actionable findings fixed
  (EmbedTheme aliased to ThemeScheme, dead `i18nKey`/`shell.theme` labels removed,
  idempotent controller teardown, inline-script version gate, generator flat-CSS
  guard, a11y group/label wiring, +coverage for the OS-scheme and single-dimension
  embed-override branches).

## The load-bearing spike (the reason this design exists)

The live preview mounts a *second* PrimeVue runtime in the same document that
rewrites the shared `<style data-primevue-style-id>` elements on every mount.
The whole mechanism (committed override CSS keyed on `:root[data-ff-theme="dark"]`,
specificity 0,2,0, in Vite-owned stylesheets) exists to survive that clobber.

Observed with the preview open in dark mode:

- Before preview mount: 30 `style[data-primevue-style-id]` elements.
- After the web-forms child mounts (`.odk-form` present, 28 inputs): **46**
  such elements — the child rewrote/added its own — yet `data-ff-theme` stayed
  `dark`, `--p-surface-900` stayed `#0f172a`, and the generated dark rules were
  still present. **Dark survived the clobber.**
- Preview form background resolved to `rgb(2, 6, 23)` (slate-950), text white —
  the embedded preview re-themes together with the chrome.

Screenshots: `04-dark-editor-preview.png` (chrome + dark preview side by side).

## What was exercised

| Check | Result | Shot |
| --- | --- | --- |
| Light default (no pref) | `data-ff-theme=light`, white bg, `theme-color=#3e9fcc` | — |
| Dark chrome (library) | dark slate surfaces, white text, `theme-color=#0f172a` | `02` |
| Dark editor (cards, category icons) | cohesive; blue/purple/green icon accents intact | `03` |
| Dark preview (the clobber test) | preview dark, survives web-forms mount | `04` |
| Accent — amber (light) | `--p-primary-500=#f59e0b`, dark-text contrast `#0f172a` (AA) | `05` |
| Accent — purple (dark) | `--p-primary-color=#8183f4` (purple-400) | `06` |
| Settings → Appearance section | scheme select + 6 accent swatches, blue selected | `07` |
| Header ThemeToggle | present in library + editor headers (`pi pi-desktop` for system) | `08` |
| Accent swatch click | green → `data-ff-accent=green`, `#0f7c39`, persisted | `09` |
| Header toggle cycle | system → light → dark, each persisted to `odk-builder:ui:v1` | — |
| No-FOUC on reload | `data-ff-theme` present on first paint (e2e) | — |
| Persistence across reload | chosen dark survives reload (e2e) | — |

## Follow-up fix — dark preview readability (2026-07-14)

Reported: question labels/options in the web-forms preview rendered dark-on-dark
in dark mode. Root cause: web-forms wraps each question in PrimeVue Card/Panel/
Select/… whose text-colour tokens (`--p-card-color`, `--p-panel-color`,
`--p-select-color`, …) reference content/text colour scheme-agnostically, get no
Aura dark block (so the generator emits none), and under `darkModeSelector:false`
do not track the dark `--p-content-color` override — so they stuck at a fixed
dark surface step (`#020617`). Fixed by remapping those tokens (plus the
web-forms `.panel-title`/`.label-number` chrome) to the light-in-dark ODK text
tokens in `builder-dark.css`. Verified in-browser (`10-dark-preview-fixed.png`):
every label/option/input is light; light mode unchanged (labels stay
dark-on-light); the two primary buttons keep Aura's dark-text-on-primary-400
contrast (by design). Guarded by a new assertion in the e2e clobber test (a
preview label's rendered colour must be light in dark).

## Notes

- Green renders the AA-nudged `#0f7c39` (raw anchor `#16A34A` fails white-on-500
  AA); amber uses a dark-text contrast override; both per the resolved decisions.
- Toggle hidden while embedded (host owns appearance, like the Settings page).
- The one accent-swatch "miss" during testing was a below-the-fold click
  artifact; re-tested with the swatch scrolled into view — applies + persists.
