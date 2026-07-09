# Skills & Conventions for the UX/Layout Overhaul

The following skills and conventions apply to this work.

---

## frontend-design (skill, `frontend-design:frontend-design`)

- **Source:** plugin `frontend-design` (claude-plugins-official), `skills/frontend-design/SKILL.md`
- **Why it applies:** governs the visual-polish scope (decision 3) — deliberate, subject-grounded design choices instead of templated defaults.
- **Key points for this work:** spend boldness in one place — the signature element is the device-framed preview with width presets; everything else stays quiet. Build to the quality floor without announcing it: responsive down to the supported sizes, visible keyboard focus, `prefers-reduced-motion` respected. Copy is design material: error and empty states direct the user ("Your form starts here…", "Preview paused — Group "x" is empty…"), never apologize or dump engine internals.

## frontend-design (skill, `unops-toolkit:frontend-design`)

- **Source:** `unops-toolkit` plugin, `skills/frontend-design/SKILL.md`
- **Why it applies:** mandates token-driven styling with zero hard-coded colors or layout widths.
- **Adaptation:** this project's runtime token files are `src/styles/odk-tokens.css` + `src/styles/builder.css` (NOT the UNOPS brand set bundled with the skill — the skill itself says the project's own tokens are the source of truth). All new values are `--builder-*` variables; `--p-{color}-*` references carry hex fallbacks following the existing `var(--p-orange-500, #f97316)` pattern.

## interface-craft (skill, `unops-toolkit:interface-craft`)

- **Source:** `unops-toolkit` plugin, `skills/interface-craft/SKILL.md` (+ `references/design-critique.md`)
- **Why it applies:** the five-lens critique methodology (context → first impressions → visual → interface → consistency → user context) produced the review findings that drive this spec. The motion principles (named constants, no magic numbers in markup, spring/ease discipline, reduced-motion) govern the new micro-interactions (scroll-to + `.just-added` highlight, rail slide, panel transitions). The project has no Framer Motion — animations are CSS-only, which the skill's shape-over-idiom rule permits.

## agent-browser (skill)

- **Source:** `~/.claude/skills/agent-browser`
- **Why it applies:** used for the hands-on review sweep and required again for Task 8's manual verification sweep at 390/820/1024/1280/1440/1920.

---

## Project conventions (hard constraints)

- **Theme parity:** `tests/unit/theme-parity.spec.ts` requires `src/styles/odk-preset.ts` and `src/styles/odk-tokens.css` to match the `@getodk/web-forms` bundle. Neither file may be edited; no new `--odk-*` tokens.
- **Builder chrome variables** live in `src/styles/builder.css` under the `--builder-*` namespace; component styling is scoped CSS referencing tokens.
- **Test IDs:** existing `data-testid` attributes (`palette-toggle`, `preview-button`, `canvas-empty`, `choice-name-*`, …) must survive on the new elements — the e2e and component suites select by them.
- **Execution convention (user directive, 2026-07-09):** use dynamic Workflow orchestration where structure pays off; any subagent delegated planning/re-planning must itself invoke `unops-toolkit:shape-spec` and update this spec folder rather than leaving spec updates to the main agent.
