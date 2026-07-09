# Spec 08: Hardening & Release Readiness — Shaping Notes

## Scope

Quality flooring for the MVP: coverage gates, e2e breadth, accessibility and
responsive behavior, cross-browser download robustness.

## Delivered

- **Coverage thresholds** enforced in vitest.config.ts, pinned slightly
  under achieved coverage so regressions fail CI: `src/core/**` 86% stmts /
  78% branches / 88% lines; `src/stores/**` 80/85; `src/persistence/**`
  90/92. New unit tests brought stores from 58% → 83–91%
  (preview store state machine, workspace liveQuery flows,
  parseFormFile dispatch/sniffing, fetchFormAttachment).
- **E2E suite: 9 scenarios × chromium + firefox (18 green, verified stable
  across consecutive runs)** — library CRUD/persistence, editor keyboard
  flows + problems panel, live-preview loop with submission round-trip,
  XLSForm/XForm import with download-content assertions, translations
  (language add/migration, grid edit, display-language switch, itext in the
  exported XML, language removal).
- **Accessibility**: roving arrow-key focus through canvas cards (↑/↓ move
  focus; Alt+arrows still move nodes), aria-live save indicator, labeled
  icon buttons throughout, focus ring parity with web-forms.
- **Responsive**: palette collapses to a header toggle (auto-hidden under
  1280px); below 1280px the preview becomes a fixed right-hand drawer so
  canvas + properties keep usable widths; <768px keeps the unsupported
  banner.
- **Cross-browser fix**: programmatic downloads append the anchor to the
  DOM (Firefox requirement).

## Deliberate deferrals (tracked in docs/specs/backlog/)

- Canvas virtualization for >200-question forms — the 83-card all-widgets
  form renders without jank; virtualize when a real form proves the need.
- Translation grid virtualization (same reasoning).
- PWA/offline shell — shaped in backlog/pwa-packaging.md.

## Evidence

`../verification/spec-08-hardening.md`, screenshots, and the CI-order
scripts: lint → typecheck → test (319) → build → test:e2e (18).
