# Standards & invariants that constrain this feature

Pulled from `CLAUDE.md` "Hard invariants", scoped to what this change actually
touches (`src/components/shell/`, `src/views/FormEditorView.vue`,
`src/components/shell/ProblemsButton.vue`, i18n locales, e2e specs). This is a
pure Vue-shell/CSS/i18n reshuffle — it never touches `src/core/`,
`src/persistence/`, or a store shape, so most of the data-layer invariants
(workspace-backup format, pyxform goldens, both-backend persistence specs) do
not apply here; they're listed anyway, marked not-applicable, so a reviewer
doesn't have to go hunting for why they're absent.

- **UI strings only via vue-i18n** (typed per-namespace catalog,
  `useAppI18n()` in components; `no-missing-keys` eslint rule is an error).
  Every new label (the "Form" menu button, its aria-label, the Central
  zero-state tooltip) is a new key under `shell.editor.*` or `central.drawer.*`
  in `src/i18n/locales/en/*.json` — never an inline string. The retired
  `shell.editor.moreTools` key is deleted once nothing renders it.
- **Rendered English is byte-stable unless intentionally changed** — e2e tests
  assert exact strings. The four form-tools item labels ("Form settings",
  "Translations", "Choice lists", "Attachments") are carried over **verbatim**
  from the retired ⋮ menu into the new Form menu; only the *trigger* changes
  (testid + surrounding chrome), never the item text, so no test needs its
  label assertions rewritten — only its testid/click-path.
- **Preserve `data-testid`s, or update every e2e consumer in the same
  change.** `editor-more` is retired outright (replaced by `form-menu`); every
  consumer (`tests/e2e/dataset-tooling.spec.ts`,
  `tests/e2e/translations.spec.ts`, `tests/e2e/entities.spec.ts`,
  `tests/e2e/guides.spec.ts`, `tests/e2e/workspace-archive.spec.ts`) is
  rewritten in the same change — see `plan.md` for the exact lines.
  `theme-toggle` keeps its testid (it isn't removed, only relocated — and it
  was never removed from the DOM at all, since the library header already
  renders its own `ThemeToggle` instance unconditionally); the one e2e
  consumer that clicked it *from the editor* (`tests/e2e/theming.spec.ts`)
  is rewritten to click it from the library header instead. `central-button`
  and `palette-toggle` keep their testids unchanged (icon/behaviour changes
  only).
- **No new undefined CSS custom properties** — the stylelint gate
  (`value-no-unknown-custom-properties` in `stylelint.config.mjs`) runs over
  `src/**/*.{css,vue}`. The new `ToolbarSeparator.vue` and any cluster-spacing
  CSS reuse existing `--odk-spacing-*`/`--odk-border-color`/
  `--builder-spacing-xs` tokens; no bare `var(--new-token)` without a
  fallback or a config entry. `pnpm lint` (which runs stylelint) must pass.
- **ProblemsButton's asserted output is pinned** by
  `tests/component/problems-button.spec.ts`: the exact severity classes
  (`p-button-danger`/`p-button-success`/`p-button-secondary`), the exact
  status icon classes (`.pi-times-circle`/`.pi-exclamation-triangle`/
  `.pi-check-circle`), and the exact rendered text ("Ready" or the issue
  count) must all still be present after adding the chevron affordance — the
  chevron is additive markup, not a replacement of any of the above.
- **Embed gating is unchanged and still enforced**: Central (both the normal
  and the new zero-state variant) and the theme toggle stay hidden whenever
  `embed.active` is true; Export continues to gate per-kind via
  `embed.exportEnabled`. The Form menu itself has no embed-specific behaviour
  called out in scope — it is not gated (embed hosts still get form-content
  tools; nothing in the backlog or the resolved rulings says otherwise) but
  double-check this against `tests/e2e/embed.spec.ts` during verification.
- **Conventional commits** — one commit for the whole change once
  verification passes; release-please derives the version bump from the
  commit type (this is a `feat` — it changes user-visible IA, not just a
  `fix`).

### Not applicable to this change (listed for completeness)

- `src/core/` purity — untouched; this change has no core-layer code.
- Workspace-backup format version / `WORKSPACE_FORMAT_VERSION` — no persisted
  field changes.
- pyxform golden pins — no serializer changes.
- Both-backend persistence specs (`tests/helpers/backends.ts`) — no
  persistence-layer code changes.

## Process skills used for this delivery

- **Dynamic Workflows with Sonnet implementors** execute `plan.md`'s
  task breakdown; this is a single-stream, low-risk change (no parallel
  sub-streams needed beyond the noted coordination with the
  attachment-manager stream over two shared e2e files).
- **`/agent-browser` + `/interface-craft`** verify the reshuffled header
  visually at the three widths in `plan.md`'s Verification section, since
  automated tests are blind to CSS layout/grouping/visual hierarchy — the
  entire point of this change is perceptual, not behavioural.
- **`/code-review`** (five lenses, no plan mode) runs over the diff before
  commit; findings are fixed immediately, not deferred to a follow-up.
- **`docs/verification/`** gets a dated write-up + screenshots from the
  agent-browser pass, following the shape of
  `docs/specs/2026-07-15-1219-central-ux-enhancement/user-guide.md`'s
  "Manual test scenarios" section (this spec's own `user-guide.md` supplies
  the scenario list to run).
