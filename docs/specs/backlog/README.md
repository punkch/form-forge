# Feature backlog

Shaping documents for features that are **proposed but not scheduled**. Each
follows the shape.md conventions (scope, approach, decisions, open
questions). When a feature is scheduled, promote it to a timestamped
`docs/specs/` folder via `/shape-spec`, resolve its open questions with the
user, and plan implementation then.

Phase 2 (2026-07-10) delivered everything previously listed here — those
shaping docs were promoted into their timestamped `docs/specs/` folders
(where each spec's `references.md`/`shape.md` records the provenance) and
the originals remain in git history. The Phase 3 burn-down (also
2026-07-10) promoted settings-page
(`docs/specs/2026-07-10-2005-settings-page/`) and
renovate-dependency-updates
(`docs/specs/2026-07-10-2008-renovate-dependency-updates/`),
translation-coverage (`docs/specs/2026-07-10-2006-translation-coverage/`)
and in-app-guidance (`docs/specs/2026-07-10-2007-in-app-guidance/`) the
same way.

## Pending proposals

| Spec | Effort | Blocked on |
| --- | --- | --- |
| [central-publishing](central-publishing.md) | L | CORS spike against a real ODK Central instance (GO/NO-GO); the only feature touching a network. Covers publish **and** import via project/form pickers + multi-server records; server management UI lives on the settings page (extension point shipped 2026-07-10) |

Efforts use the project's S/M/L scale (S ≈ ≤2 days, M ≈ 3–5, L ≈ 1–2 weeks).
