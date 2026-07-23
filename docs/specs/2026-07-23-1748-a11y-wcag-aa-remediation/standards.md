# Standards — Accessibility remediation (WCAG AA)

## WCAG 2.x AA (target standard)

- **1.4.3 Contrast (Minimum):** ≥4.5:1 for normal text, ≥3:1 for large text/UI components.
  This work enforces 4.5:1 for all text-bearing accent and muted tokens in normal-contrast
  mode, measured against the app's worst-case surfaces (light `#f8fafc`, dark `#1e293b`),
  not just the base background. High-contrast mode keeps its existing 7:1 (AAA) floor.
- **4.1.2 Name, Role, Value:** every input gets a programmatic label; the canvas tree only
  contains valid tree children; no unsupported ARIA attributes. Verified by the axe-core
  WCAG A/AA ruleset via `pnpm audit:a11y`.

## Repo hard invariants that constrain this work (CLAUDE.md)

- `src/core/` purity — untouched by this work.
- **`odk-tokens.css` + `odk-preset.ts` are byte-parity-pinned to `@getodk/web-forms`**
  (`verify:webforms`, `theme-parity.spec.ts`) — all color fixes are override-layer only.
- **Generated theme CSS is committed + drift-gated** — the new `theme-accents-aa.css` joins
  `pnpm generate:theme` and the byte-identity gate in `theme-generated.spec.ts`; never
  hand-edit generated files.
- **No undefined CSS custom properties** — stylelint `value-no-unknown-custom-properties`
  runs on all touched CSS; only existing `--p-*`/`--odk-*` tokens are referenced.
- **UI strings only via vue-i18n** — new keys (e.g. the maximize-button label) land in
  en + fr + es simultaneously (`MessageSchema` parity is vue-tsc-enforced). PrimeVue vendor
  aria strings are the deliberate exception: a typed `Record<AppLocale, …>` module outside
  the app catalog.
- **Preserve `data-testid`s** — no testid changes anywhere in this work.
- **Keep rendered English byte-stable** — no copy changes; aria-labels are additive.
- **Conventional commits on `main`**, one commit for the feature after user confirmation.

## Conventions established by this work

- **Normal-mode AA clamp invariant** (new, to be added to CLAUDE.md): accent applied-tokens
  and ODK accent-as-text aliases are AA-clamped per scheme by `generateAccentAaCss`; the
  ratio gate lives in `theme-generated.spec.ts`; `NORMAL_AA_SURFACES` in
  `src/theme/constants.ts` is the single source of truth for the reference backgrounds.
- **PrimeVue escape-hatch preference:** typed `*Props` props first; plain attr second;
  `pt` only when nothing else reaches the part (and documented when introduced).
- **Accepted-exception register:** if PrimeVue's hoisted `aria-level` on menuitems cannot
  be stripped via `pt`, it is documented here and in a code comment as a known upstream
  non-conformance (PrimeVue 4.3.3, pinned), re-evaluated on any PrimeVue bump — NOT
  suppressed in the audit tooling.

## Skills applied

- `unops-toolkit:shape-spec` — this spec folder.
- `unops-toolkit:code-review` — post-implementation review (no plan mode), findings fixed
  immediately.
- `agent-browser` + `unops-toolkit:interface-craft` — UI diffs require a rendered-pixels
  pass; logged to `docs/verification/`.
- Workflow tool with parallel implementation agents (`sonnet` for standard stages, session
  model for orchestration/review) per the user's standing delivery workflow.
