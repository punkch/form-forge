# Post-launch feature specs (backlog)

Shaping documents for the Phase 2 features in
[`docs/product/roadmap.md`](../../product/roadmap.md). Each follows the
shape.md conventions (scope, approach, decisions, open questions) but is a
**proposal**: when a feature is scheduled, promote it to a timestamped
`docs/specs/` folder via `/shape-spec`, resolve its open questions with the
user, and plan implementation then.

## Status (updated 2026-07-09)

The Phase 2 delivery plan schedules everything below **except
central-publishing** (gated on a CORS spike against a real ODK Central
instance). Docs marked *(scheduled)* are being promoted to timestamped spec
folders as their implementation wave starts.

## Delivery order

| Wave | Spec | Effort | Notes |
| --- | --- | --- | --- |
| 0 | *(bug fix — no backlog doc)* preview stale-form fix | XS | Preview showed the previously opened form |
| 0 | [ci-cd-release](ci-cd-release.md) (ci.yml part) | S | CI gates all later waves |
| 1 | [ui-i18n](ui-i18n.md) | M | Before new UI so components use t() from day one |
| 1 | [workspace-export-import](workspace-export-import.md) | S | Archive format feeds templates + embed payloads |
| 2 | [external-dataset-tooling](external-dataset-tooling.md) (upload part) | S | Property-panel CSV upload → preview pulldata/itemsets |
| 2 | [form-templates](form-templates.md) | S–M | Starters authored via workspace archives |
| 2 | [iframe-embed-api](iframe-embed-api.md) | M | postMessage load/save, host-controlled export |
| 3 | [external-dataset-tooling](external-dataset-tooling.md) (tooling part) | M | Column dropdowns, dataset preview table |
| 3 | [pwa-packaging](pwa-packaging.md) | S–M | Fully offline + hybrid self-update |
| 3 | [ci-cd-release](ci-cd-release.md) (release+deploy part) | S | release-please → GitHub Pages, v1.0.0 |
| 3 | [in-app-help](in-app-help.md) | M | Popovers + type drawer + browsable reference |
| 4 | [visual-logic-builder](visual-logic-builder.md) | L | Highest differentiation, needs the most design care |
| 4 | [entities-advanced](entities-advanced.md) | M | Goldens-first for update flows |
| — | [central-publishing](central-publishing.md) | M–L | **Stays in backlog**: gated on the CORS spike |
| — | [renovate-dependency-updates](renovate-dependency-updates.md) | S | **Backlog proposal** (2026-07-10): needs the repo pushed + a PAT/App token first |

Efforts use the project's S/M/L scale (S ≈ ≤2 days, M ≈ 3–5, L ≈ 1–2 weeks).
