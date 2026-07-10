# Skills & Conventions — Full translation coverage & per-language editing

The following invariants and conventions govern this work. All are from
`CLAUDE.md` (project instructions) and the established delivery process; no
external skill was named by the user for this spec.

---

## CLAUDE.md hard invariants

- **`src/core/` is pure TypeScript** — no Vue/Pinia/Dexie/vue-i18n imports.
  WP1 (`translations.ts`) stays pure. Core emits English display strings
  (`NODE_FIELD_TITLES`, the new `MEDIA_SLOT_TITLES`) rendered verbatim in the
  grid, exactly as `Issue.message` is rendered verbatim — these are **not**
  vue-i18n strings and are correct to hard-code in core.
- **UI strings only via vue-i18n** — new UI copy (guidance-hint label, required-
  message label, panel editing-language control, grid "Show rarely-used fields"
  toggle, help entries) goes in the typed per-namespace catalog
  (`src/i18n/locales/en/{properties,dialogs,help}.json`). `eslint`
  `no-missing-keys` is an error. **Split by file to keep package ownership
  clean:** WP2 owns `properties.json` + `help.json`; WP3 owns `dialogs.json`.
- **Keep rendered English byte-stable** unless intentionally changing copy —
  new keys are additive; the one deliberate behaviour change (fallback moves
  from input value to placeholder) lands with its updated test. Match the
  panel's "Default" option English to `dialogs.translations.defaultOption` to
  avoid two strings for one concept.
- **Preserve `data-testid`s** — e2e + component helpers depend on them. Reuse
  `prop-label`, `prop-hint`, `prop-constraint-message`, `choice-label-${i}`,
  `cell-${siteKey}-${lang}`, `row-${siteKey}`, `lang-completeness-${lang}`,
  `display-language`. New affordances get **new** testids
  (`panel-editing-language`, the rarely-used toggle, the LocalizedInput badge).
  `siteKey`'s existing `node:`/`choice:` forms must stay byte-identical; only
  add media forms.
- **Serializer pinned to pyxform 4.5.0 via `tests/golden/`.** This work needs
  **no** serializer/writer/reader change; goldens must stay green and unchanged.
  Do **not** run `scripts/make-goldens.py` — regeneration is a deliberate act,
  not part of this feature.
- **Persistence goes through the backend seam** (`src/persistence/backend.ts`).
  Untouched here; the cross-backend acceptance is satisfied by
  `collectTranslationSites` being pure — verify via `tests/helpers/backends.ts`
  without restructuring the seam.
- **Conventional commits** — release-please derives versions from them. One
  `feat(...)` commit for the delivered feature (or scoped per package if the
  team prefers), no `Co-Authored-By` trailer (global instruction).

---

## Coverage floors (`pnpm test:coverage`)

Enforced: core 86% branch / 78% ... (statements) / 88% (functions), stores
80/85, persistence 90/92 (see `package.json`/vitest config for the exact map).
WP1's new/changed core logic and WP2/WP3 component logic must keep these floors.
Each package ships its own tests (unit for core, component for UI, e2e for the
flow) so coverage doesn't regress at integration time.

---

## Delivery process (from CLAUDE.md)

Spec folder (this) → implement via **dynamic Workflows with parallel agents**
(WP1 ∥ WP2 in wave 1; WP3 after WP1; WP4 integration) → verify (full suite +
agent-browser pass logged to `docs/verification/`) → `/code-review` (five
lenses, no plan mode) and fix findings immediately → conventional commit per
feature → update `README.md` Features (✅/⬜), `docs/product/roadmap.md`, and
`CLAUDE.md` in the same change, and retire
`docs/specs/backlog/translation-coverage.md`.

---

## Verification commands

```bash
pnpm lint
pnpm typecheck
pnpm test            # unit (node) + component (happy-dom) + golden gates
pnpm test:coverage   # floors above
pnpm test:e2e        # playwright chromium + firefox vs built app on :4173
git status           # MUST show no diff under tests/golden/
```
