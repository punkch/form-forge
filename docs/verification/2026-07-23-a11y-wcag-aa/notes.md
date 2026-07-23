# Verification — a11y WCAG AA remediation (2026-07-23)

Local build (`pnpm build && pnpm preview`, :4173), agent-browser pass + interface-craft
critique. Automated results first, then the critique.

## Automated gates (all green)

- `pnpm lint` / `pnpm typecheck` / `pnpm test` (148 files, 1680 tests) — clean.
- `pnpm test:e2e` — 135 passed, 1 skipped (pre-existing), chromium + firefox.
- `pnpm audit:a11y --theme both --contrast both --accent default` — **0 violations**
  across 4 modes × 13 states (was: 5 violation families on the live site).
- `pnpm audit:a11y --theme both --contrast normal --accent all` — **0 violations**
  across all 12 accent modes.

## Screenshots

| File | What it shows |
| --- | --- |
| `01-new-form-gallery-light.png` | Template cards — muted text now surface-600, clearly readable |
| `02-editor-light-purple.png` | Editor: darker readable "Ready" chip, purple essentially unchanged |
| `03-library-light-blue.png` | Blue accent clamped: deep readable blue primary button + links |
| `04-library-light-amber.png` | Amber accent clamped: dark bronze button (biggest visual shift) |
| `05-library-dark-purple.png` | Dark theme — visually unchanged |
| `06-library-light-hc.png` | High contrast light — visually unchanged |
| `07-purple-icon-vs-clamped.png` | Brand #6366f1 vs clamped light-UI purple #5457cd side by side |

## Interface critique (design-critique lenses, scoped to this diff's visual delta)

**Context.** A professional form-builder for data-collection specialists; routine desk work,
long sessions. The change is a color-system correction, not a redesign — the bar is "nothing
feels broken or off-brand afterwards."

**First impressions.** The app reads crisper. Muted metadata that used to sit at 2.5–3.8:1
was genuinely hard to read on the template cards and now reads effortlessly. The Ready chip
finally looks like a deliberate status, not a faded lawn-sign. Blue's primary button gains
presence it always lacked. Amber is the one accent where the correction is loud.

**Visual design.**
- **Muted-tier collapse** — `--odk-muted-text-color` and `--odk-light-muted-text-color`
  both resolve to surface-600 in light mode now (the only step clearing 4.5:1 on the
  `#f8f8f8` card), so template description, question-count and preview line share one tone.
  In-card text hierarchy now relies on position alone. Impact is mild — the lines have
  distinct content shapes — but if tiering is wanted back, differentiate by size/weight
  (e.g. preview at 13px), not by lightening color. No change needed now.
- **Amber identity shift** — the clamped amber primary (`#875706`) reads bronze/olive, while
  the Settings swatch still shows bright `#f59e0b`. A user who picks "amber" gets a darker
  world than the swatch promised. This is inherent to AA amber-on-light; if it grates, the
  swatch could preview the *effective* UI color — a future consideration, deliberately not
  in this change.
- **Purple delta** — clamped `#5457cd` vs brand `#6366f1` is visible side by side
  (screenshot 07) but the two never co-occur in one viewport: the brand hex lives in the
  favicon/PWA icons and browser-chrome `theme-color`, the clamped one in in-page UI. Same
  family, no clash. Feeds the deferred icons decision.

**Interface design.** No structural or flow changes; the tree-role, label and locale fixes
are invisible to sighted mouse users and materially better for AT users (grid cells now
announce "age · Label — fr" instead of "edit text").

**Consistency & conventions.** Dark and high-contrast modes byte-identical in behavior and
visually unchanged; the clamp only emits blocks where a pairing failed, so passing accents
(green light, most of dark) render exactly as before. Hover/active states keep a darker-step
gradient rather than collapsing — button feedback preserved.

**User context.** Beneficiaries are low-vision users and anyone on a poor projector/monitor —
the audience ODK tooling actually serves in the field. Nothing got harder for anyone else.

**Top opportunities (follow-ups, not blockers).**
1. Decide the icons question with screenshot 07 (keep brand icons vs regenerate to `#5457cd`).
2. If in-card text tiering is missed, reintroduce it via size/weight.
3. Consider making Settings accent swatches show the effective (clamped) light-mode color.

## Code review outcome (five lenses, post-implementation)

10 findings; 8 applied, 2 deliberately skipped. The one **medium correctness bug**:
the AA file's literal `--odk-primary-*` aliases (0,3,0) out-specified high contrast's
0,2,0 alias redirect, dropping accent-as-text to AA levels (teal 4.94:1) in **light HC**
— fixed with a 0,3,0 re-assert block in `builder-contrast.css` (wins by load-bearing
import order, pinned by `theme-contrast-ratio.spec.ts`) and verified live: HC-teal
`--odk-primary-text-color` resolves to the AAA-clamped `#07514b`. Also applied: audit
script imports the accent roster from `constants.ts` (regex dropped), shared `AppLocale`
union exported from `src/i18n/index.ts`, NodeList tree/group contract hoisted into one
computed, arrow-const style pass, and 4 new/extended specs (primevue-locale unit,
node-list roles component, grid + default-field aria-label assertions). Skipped: the
generators' per-scheme `palette()` recompute (mirrors existing precedent, build-time
only) and a resolved-hex ratio gate for the `var()`-based builder.css remaps (covered
by the CI axe job). Final: 1689 unit/component tests, 135 e2e, audit clean.

**Verification gotcha for future passes:** the PWA service worker serves the previous
build's precache to a browser profile that visited it — unregister SW + clear caches
(or use a fresh profile) before trusting computed styles against a rebuild. The
`audit:a11y` script is immune (fresh Playwright profiles).
