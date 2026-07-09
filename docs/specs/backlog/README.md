# Post-launch feature specs (backlog)

Shaping documents for the Phase 2 features in
[`docs/product/roadmap.md`](../../product/roadmap.md). Each follows the
shape.md conventions (scope, approach, decisions, open questions) but is a
**proposal**: when a feature is scheduled, promote it to a timestamped
`docs/specs/` folder via `/shape-spec`, resolve its open questions with the
user, and plan implementation then.

## Recommended order

| # | Spec | Effort | Why this order |
| --- | --- | --- | --- |
| 1 | [workspace-export-import](workspace-export-import.md) | S | Backup/restore is the top ask for a local-first tool; pure reuse of existing pieces |
| 2 | [form-templates](form-templates.md) | S–M | Big onboarding win; builds directly on workspace import |
| 3 | [external-dataset-tooling](external-dataset-tooling.md) | M | Rounds off the *_from_file / csv-external story shipped in Spec 07 |
| 4 | [pwa-packaging](pwa-packaging.md) | S–M | Makes "field laptop/tablet" deployment real; low risk |
| 5 | [visual-logic-builder](visual-logic-builder.md) | L | Highest differentiation, needs the most design care |
| 6 | [entities-advanced](entities-advanced.md) | M | Valuable but paced by the ODK Entities spec itself |
| 7 | [central-publishing](central-publishing.md) | M–L | Deliberately last: only feature touching a network, and gated on a CORS spike |

Efforts use the project's S/M/L scale (S ≈ ≤2 days, M ≈ 3–5, L ≈ 1–2 weeks).
