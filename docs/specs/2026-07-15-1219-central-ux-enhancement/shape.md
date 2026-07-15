# Central integration — UX enhancement (drawer + hub) — Shaping Notes

> Promoted 2026-07-15 from `docs/specs/backlog/central-ux-enhancement.md`.
> Follow-up to the delivered `docs/specs/2026-07-13-1331-central-publishing/`.
> **UX-only re-shaping** of the shipped Central surfaces — no change to the core
> client, crypto vault, persistence seam, or network protocol (beyond one
> additive persistence column).

## Scope

Re-shape the existing ODK Central surfaces from a **stack of interrupting
overlays split across three locations** into a **single non-modal per-form
"Central" drawer** (editor) and a mirroring **library-level Central drawer**
(import), carrying a unified hub: standing vault-lock state, all tracked
destinations for the form, per-destination freshness + one-click re-publish, and
an inline "publish to a new destination" flow.

**In scope:** the Publish dialog, the Import "From Central" branch, the
vault-unlock interaction, and how connection state + publish history + version
freshness surface on a form.

**The one data-model change** is additive: a `lastPublishedContentHash` column
on `publishTargets` (a db-version bump + migration, no schema redesign), with an
optional companion `lastKnownServerHash`.

**Out of scope:** `src/core/central/` transport/vault, the
`centralServers`/`centralVault` tables, the `publishTargets` *shape* beyond that
one additive column, the network protocol, the CORS story, and the Settings
server-CRUD section (`CentralServersSection.vue` stays as-is — correctly inline,
not modal).

## Decisions

### Design direction (decided with the user, 2026-07-15)
- **Non-modal side drawer carrying a unified per-form hub** — the same panel
  language as the editor's resizable palette/preview panes (grid shell +
  `SplitHandle`). The user picked the drawer *mechanism* and asked it *carry the
  hub content*. Committed scope is **the full arc through Phase 3**, not just the
  stacking fix.

### The four decisions locked at promotion (2026-07-15)
1. **Unlock timing → one-time session gate.** The first time the drawer opens
   with a saved password, a single unlock resolves for the whole session; the
   drawer then opens straight to hub content. No unlock modal ever stacks over a
   flow. (Chosen over an inline-per-flow gate for calmness; both remove
   stacking.)
2. **Import home → library-level Central drawer.** A drawer on the Form Library
   mirroring the editor's, replacing the source-toggle-inside-Import-dialog
   shape. File import stays in the Import dialog.
3. **Editor entry → toolbar "Central" toggle, styled like Preview.** Replace the
   Publish action button with a `Central` toggle in the same `AppHeader
   #actions` slot: `pi pi-cloud` icon + "Central" label, `severity` +
   `aria-pressed` reflecting drawer-open state, same
   `central.hasServers && !embed.active` gate. Decided via an Interface Craft
   five-lens pass: the drawer *is* a resizable pane like Preview, so modeling its
   control as anything other than the Preview-style toggle would add a third
   idiom for "open/close a pane"; and publishing is too consequential to hide
   behind an unlabeled affordance. The two options ("toolbar button" vs
   "panel-toggle") converge on a labeled toggle that is both discoverable and
   consistent.
4. **Reconcile → local freshness + on-demand "Check server".** The freshness
   chip is purely local (content-hash vs `lastPublishedContentHash`, no network).
   Version state is last-known cache; a per-row **Check server** does a metadata
   read (`listForms` → `version` + `hash`, no XML pull). Publish reacts to
   Central's actual `409` (bump + retry). No automatic network on drawer open.
   **Never pre-bump from local cache** — Central is authoritative.

### Model clarifications (carried from shaping)
- **Vault / connection is a single global state.** One passphrase-derived,
  session-lifetime AES-GCM key in the core module closure decrypts *every*
  server's password. "Connected" is not per-server: unlock once → all servers
  with saved credentials are usable. UI shows **one** vault control (header) and
  per-row **freshness**, never a per-server lock/connect chip. The one genuine
  per-server exception is a server with **no saved password** → surface a "needs
  password (Settings)" affordance, not a lock state.
- **A destination is the triple `(serverId, projectId, xmlFormId)`**, persisted
  one row per destination in `publishTargets`. Multi-destination tracking is a
  **surfacing** change (the store already has `listTargetsForForm` /
  `upsertTarget`). `targetMatchesSelection` currently matches server + project
  only — it must use the full triple so a renamed form isn't collapsed.
- **One builder version = the next thing to push.** `doc.settings.version`
  (default `yyyymmddHHMM`) is the single source of truth for the next publish to
  any destination. No per-destination version strings in the document.
- **We upload DRAFTS; a human promotes them.** Publish is `publish=false`; the
  definition lands as the form's draft and stays there until a Central user
  promotes it in Central's UI. "Published to Staging" in the hub means "draft
  uploaded to Staging." Kept: **draft-only** (no `publish=true` option).
- **Freshness is content-based**, hashing the serialized XForm **excluding the
  `version` attribute**, so a bump-only edit isn't read as content drift.

## Context

- **Visuals:** the published review Artifact (*ODK Central integration — UX
  review*, `central-ux-review`, favicon ☁️) — annotated five-lens critique +
  before/after + the Phase-3 hi-fi mockup with the 4-state gallery. Source
  archived at `visuals/central-ux-review.html`.
- **References:** the delivered central-publishing spec
  (`docs/specs/2026-07-13-1331-central-publishing/`), and the existing surfaces
  inventoried in `references.md`.
- **Product alignment:** Phase 3 of `docs/product/roadmap.md` (Central
  integration, delivered) — this hardens its UX. Honors all repo hard invariants
  (core purity, backend-seam parity, i18n-only strings in the `central`
  namespace, `data-testid` preservation, embed-safe gate).

## Skills & Conventions Applied

- **interface-craft** (five-lens design critique) — used to produce the review
  Artifact and to decide the editor entry point (toolbar Central toggle).
- **agent-browser** — the live walkthrough that surfaced the modal stacking, and
  the verification pass for every new surface (logged to `docs/verification/`).
- **artifact-design** — the published review deliverable.
- Repo conventions (CLAUDE.md hard invariants): core purity, persistence backend
  seam, pinned serializer (golden parity), i18n-only strings, conventional
  commits **without** a `Co-Authored-By` trailer.
