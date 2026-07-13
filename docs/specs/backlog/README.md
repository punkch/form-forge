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
same way. **central-publishing** was promoted and delivered 2026-07-13
(`docs/specs/2026-07-13-1331-central-publishing/`); its shaping doc remains
here as the provenance record.

## Pending proposals

| Spec | Effort | Blocked on |
| --- | --- | --- |
| [theming](theming.md) | M | Nothing — a half-day generated-CSS spike is the first implementation task, not a gate. Light/dark/system + accent presets restyling builder chrome **and** the embedded web-forms preview via committed token-override CSS; parity invariant untouched |

Efforts use the project's S/M/L scale (S ≈ ≤2 days, M ≈ 3–5, L ≈ 1–2 weeks).

## Delivered (kept here as provenance)

| Spec | Delivered | Notes |
| --- | --- | --- |
| [central-publishing](central-publishing.md) | 2026-07-13 | Publish drafts + import published forms across multiple ODK Central servers; passphrase-encrypted credential vault; per-form publish targets; device-local and export-excluded. CORS is a server-side requirement (recipes + `scripts/central-cors-proxy.{sh,ps1}` local proxy). Implementation spec: `docs/specs/2026-07-13-1331-central-publishing/` |
