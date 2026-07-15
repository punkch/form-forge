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
same way. **central-publishing** and **theming** were both promoted and
delivered 2026-07-13
(`docs/specs/2026-07-13-1331-central-publishing/` and
`docs/specs/2026-07-13-1840-theming/`); their shaping docs remain here as
provenance records.

## Pending proposals

_None active._ New significant work is shaped here first (via `/shape-spec`),
then promoted to a timestamped `docs/specs/` folder as implementation starts.

Efforts use the project's S/M/L scale (S ≈ ≤2 days, M ≈ 3–5, L ≈ 1–2 weeks).

## Delivered (kept here as provenance)

| Spec | Delivered | Notes |
| --- | --- | --- |
| [workspace-full-backup](workspace-full-backup.md) | 2026-07-15 | Whole-workspace backup (format v2) now carries Central server config + publish targets by default, and (opt-in on export, with a warning, while the vault is unlocked) the credential vault + saved passwords for a turnkey restore. Single-form/shared exports stay credential-free (v1). Implementation spec: `docs/specs/2026-07-15-1729-workspace-full-backup/` |
| [central-publishing](central-publishing.md) | 2026-07-13 | Publish drafts + import published forms across multiple ODK Central servers; passphrase-encrypted credential vault; per-form publish targets; device-local, excluded from *shares*, and included in a whole-workspace backup only when the user opts in (2026-07-15). CORS is a server-side requirement (recipes + `scripts/central-cors-proxy.{sh,ps1}` local proxy). Implementation spec: `docs/specs/2026-07-13-1331-central-publishing/` |
| [theming](theming.md) | 2026-07-13 | Light/dark/system color scheme + six accent presets restyling builder chrome **and** the embedded web-forms preview; host-controllable in embed mode. Delivered as committed static override CSS (`:root[data-ff-theme]`/`[data-ff-accent]`) generated from the pinned `@primeuix/styled` emission — the byte-identical PrimeVue parity + `darkModeSelector: false` invariant stays untouched, drift-gated. Implementation spec: `docs/specs/2026-07-13-1840-theming/` |
