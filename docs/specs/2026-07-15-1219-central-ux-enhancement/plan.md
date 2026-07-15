# Central integration — UX enhancement (drawer + hub) — Implementation Plan

> Promoted 2026-07-15 from `docs/specs/backlog/central-ux-enhancement.md`.
> This is the full plan. Shaping decisions live in `shape.md`; current-code
> anchors in `references.md`; standards in `standards.md`; user docs + manual
> test scenarios in `user-guide.md`.

## Why

A live pass (Interface Craft five-lens critique + an agent-browser walkthrough of
every Central surface) found the shipped feature is built as a **stack of
overlays that interrupt each other**, and one intent ("talk to my Central
server") is **split across three unrelated locations**.

- **8 distinct overlay surfaces**; **peak stacking depth of 3 modals** —
  confirmed live: selecting a server inside **Publish** throws the **Unlock
  vault** modal on top of it, and the forgotten-passphrase link opens a **reset
  confirm** on top of *that*.
- **3 disconnected entry points** for the same relationship: Publish (editor
  toolbar), Import-from-Central (a buried toggle inside the generic Import
  dialog), and connect/manage (Settings). Nothing on screen states connection
  status or where a form has been published.

## The four locked decisions (see shape.md)

1. **Unlock timing → one-time session gate** (first drawer-open with a saved
   password; then straight to hub content; `Lock` always in the header).
2. **Import home → library-level Central drawer** (retire the source toggle;
   File import stays in the Import dialog).
3. **Editor entry → toolbar "Central" toggle**, styled exactly like the Preview
   pane toggle (`pi pi-cloud` + "Central" label, active severity + `aria-pressed`,
   same `central.hasServers && !embed.active` gate).
4. **Reconcile → local freshness + on-demand "Check server"** (metadata read,
   no XML); publish reacts to Central's `409` (bump + retry); never pre-bump from
   local cache.

## Version management (engineering detail)

### What "the version" is
The builder document carries a **single** version string, `doc.settings.version`
(default `yyyymmddHHMM` from `defaultVersion()`, `src/core/model/version.ts`,
manually editable in Form Settings). The serializer stamps it onto the XForm
primary-instance root as the `version` attribute (`src/core/xform/serializer.ts`,
~line 650). There is exactly one version on the document at any time — the
**current draft version**: what would be stamped on whatever you publish *right
now*, to *any* destination.

### What each Central server holds
Publishing pushes the current document (with that one version) to a destination's
**draft** (`publish=false` — promoting draft→live stays in Central's UI,
deliberate). Central identifies form versions by the version string, **per
(project, xmlFormId)**, and **rejects re-publishing a version string it already
holds** for that form (`409.3`) — today's `bumpVersion` + retry path. Each server
has its **own, independent** version history.

We persist, per destination, only **what we last sent it**:
`publishTargets.lastPublishedVersion` + `lastPublishedAt`. We do **not** know a
server's full history nor whether its *live* (promoted) version differs from the
draft we pushed, without a live read.

### The model for the hub
1. **One builder version = the next thing to push.** The drawer shows it once
   ("Current draft · v…"), editable. No per-destination version strings in the
   document.
2. **Each destination row shows the version it last received** and how it relates
   to the current draft (matches / N behind). Legitimate divergence (dev ahead of
   prod) is **shown**, not fought.
3. **Freshness is content-based, not version-string-based.** At publish time
   store a **content fingerprint** per destination — a hash of the serialized
   XForm **excluding the `version` attribute** (so a bump-only edit isn't drift)
   — the new `lastPublishedContentHash` field. Row chip:
   - **Up to date** — current content hash == the hash last sent here.
   - **Changed** — content differs → the action reads **Publish update**.
4. **We upload DRAFTS; a human promotes them.** `publish=false`; the definition
   lands as the form's draft and stays there until a Central user publishes it
   live in Central's own UI. Label per-destination versions as **draft**; state
   that going live happens in Central. Kept: **draft-only** (no `publish=true`).
5. **Central is the source of truth for versions; our records are an optimistic
   cache.**
   - **Never bump from local cache alone.** React to Central's actual `409`
     (bump + retry — the safe default), or reconcile first by reading Central.
   - The **"N behind"** figure is **last-known** unless we reconcile; the hub
     says so and offers **Check server**.
   - **Content freshness (#3) is safe and Central-independent** — a purely local
     fact ("have *I* changed since I last published here").

### How "Check a server" reconciles (network tiers)
Cheapest first; the recommended "check a server" is the **middle** one.

0. **Purely local (no network) — the freshness chip.** current content hash vs
   `lastPublishedContentHash`. Drives Up to date / Changed; no "check" needed.
1. **Metadata read (recommended for "Check server").** One
   `GET /v1/projects/:id/forms` — Central returns each form's `version` +
   `publishedAt` (and, in Central's payload, `hash`/`sha256`). **Correction from
   shaping:** `CentralFormSummary` today parses only `xmlFormId, name, version,
   publishedAt` — it does **not** carry `hash` yet (`coerceFormSummary`,
   `types.ts:121`). So the v1 Check-server compare uses the **version string**
   (available now: `CentralFormSummary.version` vs our `lastPublishedVersion`),
   which is also the reliable cross-tool signal. To add content-hash comparison,
   **extend `coerceFormSummary` with `hash?`** (non-breaking) and compare Central's
   `hash` vs the MD5 of our current serialized XForm — subject to the
   canonicalization caveat below. Small JSON read, **no XML pull.** Note: the
   forms list carries the **published** version/hash; to check the **draft** we
   pushed, add a small `GET .../forms/:id/draft` metadata call or hash
   `getDraftXml`.
2. **Full XML pull (optional, heavy) — only for a real diff.**
   `getPublishedFormXml` / `getDraftFormXml` (the actual client method names).
   Reserve for a "compare definitions" affordance.

**Caveat — cross-tool canonicalization.** Central's `hash` is over *Central's*
XML. For a form *we* published, those bytes are ours (byte-deterministic,
golden-pinned serializer), so `hash` equality is meaningful. For a form that
originated elsewhere (XLSForm/pyxform, other tools), `hash` won't match even when
semantically identical — fall back to **version-string** comparison and label
"representation may differ"; never assert a content diff from a hash mismatch.
Optionally store the `hash` Central reports **at publish time**
(`lastKnownServerHash`) so a later check compares Central-now vs Central-then —
out-of-band detection immune to serializer differences.

### Worked timeline (Central-authoritative)
1. New form → builder `202607151401` (auto).
2. Publish to **Dev** → Dev **draft** `…1401`; target(Dev).version=`…1401`.
3. Edit a label → builder still `…1401`, content hash differs from Dev → Dev row
   **Changed** (local fact, no network).
4. **Publish update** to Dev → push current draft; **Central** decides: if
   `…1401` collides with a *published* version, `409` → bump → builder `…1632`,
   Dev draft → `…1632`. If `…1401` was only ever a draft, Central may accept the
   replace without a bump. Central drives it.
5. First publish to **Prod** → no conflict unless Prod already published that
   string. Rows converge as each is (re)published.
6. Someone promotes/edits the Dev draft in Central → cache stale; a **Check
   server** read updates the Dev row.

## Destination model
Identity = **(serverId, projectId, xmlFormId)**, one row per destination in
`publishTargets`. `listTargetsForForm` (all), `upsertTarget` (one), seed-on-import
already exist → multi-destination is a **surfacing** change. Fix
`targetMatchesSelection` (currently server+project only) to use the full triple.

---

## Implementation plan (task-by-task)

Delivery order follows the phases; each phase is independently shippable and
leaves the app green. Implement via dynamic Workflow with parallel agents where
tasks are independent; **verify every subagent's output** (read the diff, run the
relevant tests) before trusting it. UI/UX verification uses agent-browser.

### Task 1 — Save spec documentation (this folder) ✅ (in progress)
`plan.md` (this), `shape.md`, `standards.md`, `references.md`, `user-guide.md`,
`visuals/central-ux-review.html`. Update the backlog file to a promotion pointer.

### Task 2 — Phase 1: stop the stacking (low risk, ship first)
1. **Never stack the vault prompt.** Route `central.ensureUnlocked()` so the
   triggering surface resolves unlock inline/up-front, not via a modal thrown
   over the current one. Today `ensureUnlocked()` opens the app-global
   `UnlockVaultDialog` (`central.unlockPromptOpen`) from inside picker fetches
   (`CentralProjectPicker` → `central.listProjects`), producing modal-on-modal.
   Minimal Phase-1 form: resolve unlock **before** opening Publish/Import (an
   up-front session gate), so no picker fetch triggers a stacked modal.
2. **Equal full-width pickers** in Publish (Server select currently
   content-sized; Project full-width).
3. **Inline "setup guide" link** in the connection error (`central.errors.*` copy
   references a setup guide with no on-screen link; only the `?` `GuideTrigger
   guide="central"` exists).
4. **True segmented control** for the Import File / ODK-Central source toggle
   (currently two mismatched PrimeVue buttons).
Preserve all existing testids; keep e2e green.

### Task 3 — Data model: content fingerprint + migration
1. **Core helper** (pure TS, `src/core/central/` or `src/core/xform/`):
   `contentFingerprint(doc)` → hash of the serialized XForm with the root
   `version` attribute **excluded/neutralized**. Use a small dependency-free hash
   (e.g. the same approach Central uses conceptually, but ours only needs
   determinism + collision-resistance for equality) — decide SHA-256 via
   `crypto.subtle` (async) vs a sync FNV/MD5; MD5 lets us also compare against
   Central's `hash` in Tier 1. **Recommend MD5** of the version-neutralized XForm
   so the same helper feeds both freshness and the Tier-1 server compare. Keep it
   pure (no Vue/Pinia/Dexie/i18n).
2. **Persistence:** add `lastPublishedContentHash?: string` (and optional
   `lastKnownServerHash?: string`) to `PublishTargetRecord` (`db.ts`); bump the
   Dexie schema to **v4** (carry v3 stores unchanged; the new fields are not
   indexed, so the `.stores()` string may be unchanged — confirm and add a v4
   step for clarity/migration hook). Mirror in the memory backend; keep
   `publish-targets-repo` signatures identical across both.
3. **Write path:** `upsertTarget` records `lastPublishedContentHash` (and
   `lastKnownServerHash` from Central's publish response if available) at publish
   time.
4. Tests: core helper unit (version-independence: bump-only ⇒ same hash; label
   edit ⇒ different hash), persistence round-trip on both backends, coverage
   floors green.

### Task 4 — Phase 2: the Central drawer (editor)
1. **New non-modal drawer component** in the editor grid shell
   (`FormEditorView.vue`), same panel language as palette/preview
   (`SplitHandle`), gated `central.hasServers && !embed.active`. It replaces
   `editor.activeDialog = 'publish'` as the Publish entry.
2. **Toolbar Central toggle** — replace the Publish action button in `AppHeader
   #actions` with a Preview-style toggle: `pi pi-cloud` + `t('central.drawer…')`,
   `severity` reflecting open state, `aria-pressed`, `data-testid="central-button"`
   (keep `publish-button` testid alias if any e2e depends on it, or migrate the
   spec). Drawer open state lives in the `editor` store (mirror `previewVisible`).
3. **Publish as explicit steps** — Destination → Publishing → Result. Move the
   existing publish lifecycle, `409`-recovery (`updateExistingInstead` /
   `bumpAndRetry`), progress, and warnings from `PublishDialog.vue` **unchanged in
   behavior** — only the container + disclosure change. Reuse the existing pickers.
4. **One-time session unlock gate** — on first drawer open with a saved password,
   resolve `ensureUnlocked()` inside the drawer (a drawer face), once per session.
5. **Unified confirm/recovery pattern** — align destructive `ConfirmDialog` and
   inline `Message`-button 409-recovery into one in-drawer pattern.
6. Form stays visible throughout (no scrim/takeover).

### Task 5 — Phase 3: hub content
1. **Standing vault-lock state** + **list of every tracked destination**
   (`listTargetsForForm`). Each row: server · project · form id, last version +
   time, **freshness** chip (Up to date / Changed via Tier-0 local hash) — NOT a
   per-server connection chip.
2. **One-click re-publish per destination** (reuse the `redeploy` path); a
   *Changed* row's action reads **Publish update**. Progress + result render
   **inline on the row**.
3. **"Publish to a new destination" expands inline** (collapsible below the list),
   list stays visible; on success `upsertTarget` adds it.
4. **Per-row "Check server"** = Tier-1 metadata read (`listForms` → version +
   hash, no XML); show matches / N behind / changed-on-server; label
   "representation may differ" when hashes can't be compared (non-ours origin).
5. **Full-triple identity** — fix `targetMatchesSelection` to
   `(serverId, projectId, xmlFormId)`.
6. **No-password server** → "needs password (Settings)" affordance on the row /
   in the new-destination picker; not a lock state.

### Task 6 — Library-level Central drawer (import)
Re-home Import-from-Central into a library drawer mirroring the editor one; retire
the source-toggle-in-Import-dialog. Import still seeds its source as the first
tracked destination (`upsertTarget` on landing). Keep File import in the Import
dialog. Reuse the shared pickers and the same unlock session gate.

### Task 7 — Verify
`pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage` green; `pnpm
test:e2e` green. **Test migration is component-spec, not e2e:** no live-Central
Playwright e2e exists — re-point `tests/component/publish-dialog.spec.ts` at the
drawer and `tests/component/import-from-central.spec.ts` at the library drawer,
keeping testids where a surface is only re-homed;
`tests/component/central-servers-section.spec.ts` and the file-only
`tests/e2e/import-export.spec.ts` stay. Extend persistence specs for the new
field. agent-browser walkthrough of every scenario in `user-guide.md`;
screenshots + notes logged to `docs/verification/2026-07-15-central-ux/`.

### Task 8 — Code review + documentation
`/code-review` (five lenses, no plan mode), fix findings immediately. Then the
**full documentation sweep** (Task 9 below). Conventional commits per feature (no
`Co-Authored-By` trailer).

### Task 9 — Documentation sweep (explicit, comprehensive)
Update **every** doc surface the change touches — stale docs cost more than
missing ones (CLAUDE.md rule):
- **`README.md`** — Features section (✅/⬜): reflect the Central drawer + hub,
  multi-destination tracking, freshness/Check-server; refresh any Central
  screenshots/GIFs and prose that describe the old Publish/Import modals.
- **`docs/product/roadmap.md`** — mark the Central UX enhancement delivered under
  Phase 3; note the additive `lastPublishedContentHash` and the draft-only stance.
- **`CLAUDE.md`** — Code map (new drawer components, editor/library mounts, the
  content-hash core helper, db v4), the persistence bullet (new column),
  `src/components/central/` description, and the Documentation index (point the
  backlog stub at this spec folder; add this spec to the specs list).
- **In-app help/guide** — `src/i18n/locales/en/guides.json` `guides.central`
  steps: rewrite for the drawer/hub flow (open Central, unlock once, destinations,
  re-publish, add-new, Check-server, import drawer); confirm `guides.ts` order.
  Re-home `GuideTrigger guide="central"` into the drawer header.
- **This spec folder** — keep `user-guide.md` authoritative; log the
  agent-browser pass to `docs/verification/2026-07-15-central-ux/` with
  screenshots.
- **Central publishing user guide** — add a short "UX update" pointer in
  `docs/specs/2026-07-13-1331-central-publishing/user-guide.md` (or its README)
  so the delivered spec references the new surfaces.
- Grep the repo for lingering references to the retired surfaces (e.g.
  `activeDialog === 'publish'`, "Import From Central" toggle copy) in docs and
  comments, and update or remove them.

## Open items to confirm during build
- **Hash algorithm** — MD5 (enables Tier-1 server compare) vs SHA-256
  (`crypto.subtle`, async, no server-hash compare). Recommend MD5 of the
  version-neutralized XForm.
- **Draft-vs-published metadata for Check server** — forms list gives *published*
  version/hash; add a `getDraftMeta`/`getDraftXml` hash for the draft we push, or
  accept published-only comparison in v1.
- **e2e migration** — enumerate which Central specs move; keep testids stable
  where a surface is only re-homed (see `references.md` §13).
- **Drawer state store** — editor store (`drawer open` mirrors `previewVisible`)
  vs a small `central` store flag; keep editor for symmetry with Preview.

## Standards & process
Implement via dynamic Workflow with parallel agents; verify (full suite +
agent-browser pass logged to `docs/verification/`); run `/code-review`;
conventional commits (no `Co-Authored-By` trailer); update README, roadmap, and
CLAUDE.md.
