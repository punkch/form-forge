# Feature backlog

Shaping documents for features that are **proposed but not scheduled**. Each
follows the shape.md conventions (scope, approach, decisions, open
questions). When a feature is scheduled, promote it to a timestamped
`docs/specs/` folder via `/shape-spec`, resolve its open questions with the
user, and plan implementation then.

Phase 2 (2026-07-10) delivered everything previously listed here — those
shaping docs were promoted into their timestamped `docs/specs/` folders
(where each spec's `references.md`/`shape.md` records the provenance) and
the originals remain in git history.

## Pending proposals

| Spec | Effort | Blocked on |
| --- | --- | --- |
| [central-publishing](central-publishing.md) | M–L | CORS spike against a real ODK Central instance (GO/NO-GO); the only feature touching a network |
| [renovate-dependency-updates](renovate-dependency-updates.md) | S | Repo pushed to GitHub + a PAT/App token for the Renovate action |
| [translation-coverage](translation-coverage.md) | M | Nothing — ready to schedule |
| [in-app-guidance](in-app-guidance.md) | S–M | Nothing — pairs well with translation-coverage |

Efforts use the project's S/M/L scale (S ≈ ≤2 days, M ≈ 3–5, L ≈ 1–2 weeks).
