# ODK Central integration (publish + import) — Shaping Notes

Promoted from `docs/specs/backlog/central-publishing.md` on 2026-07-13. That
backlog doc is the provenance record (CORS spike, resolved decisions); this
folder is the implementation spec. Everything below is settled — no open
questions remain for v1.

## Scope

The only backlog feature that talks to a network. It must not compromise the
product's core guarantee — **no backend, nothing leaves the device by
default** — so the whole feature is invisible until a user opts in by adding a
server, every network call is user-initiated, and no server/credential
material ever enters an export.

Ships:

- **Opt-in server records** — register multiple ODK Central servers (display
  name + base URL, optional stored password), managed from the App Settings
  page at its existing extension point (`SettingsView.vue` line 124). Device-
  local only.
- **Encrypted credential vault** — per-server passwords stored encrypted at
  rest under one passphrase-derived, session-lifetime key (details below).
- **Publish as draft** — create or update a form draft on a chosen Central
  project (`POST .../forms?ignoreWarnings=true&publish=false` then per-
  attachment `POST .../draft/attachments/:name`), surfacing Central's
  validation response verbatim. Publishing the draft to live stays in
  Central's own UI (review happens there — deliberate).
- **Publish targets (per form, device-local)** — each library form keeps a
  list of destinations it has published to (server + project + xmlFormId +
  last version/time). Import seeds the source as the first target; each
  successful publish upserts one. The Publish dialog opens pre-filled with the
  most recent target and lists the others as one-click re-deploys — the
  multi-environment story (same form on dev/staging/prod) is "pick a known
  target", never re-navigating pickers.
- **Import from Central** — server → project → form pickers, download the
  published XForm definition + attachments, feed them through the existing
  import pipeline, land in the library with the same row-level report as file
  import. Collision (formId already in library) offers **replace** (destructive,
  confirmed) or copy (non-destructive default).
- Shared server/project/form pickers between publish and import; a lazy vault
  unlock prompt on the first Central action of a session.

## Decisions (all resolved 2026-07-13)

- **CORS: GO with a server-side requirement.** Spike against a real Central
  (central-backend v2024.3.1) confirmed every API call works but CORS is
  blocked by default. The client cannot fix this alone — it ships documentation
  (nginx/Caddy CORS recipes, or same-origin Fallback A). See `user-guide.md`
  for the copy-paste recipes. Minimum supported Central: **2024.3**.
- **Credential vault (user, 2026-07-13):** PBKDF2-SHA-256 (OWASP-current
  iterations) with a per-device random salt derives a **non-extractable**
  AES-GCM `CryptoKey` from a user-chosen passphrase. Each stored password is
  `{iv, ciphertext}` with a fresh IV. A key-check value (a known constant
  encrypted at vault creation) validates the passphrase at unlock without
  touching real secrets — AES-GCM auth failure = wrong passphrase, caught
  immediately. The key lives in a **module closure in pure-TS core**, never in
  reactive/Pinia/devtools-visible state. Prompted lazily on the first Central
  action of a session (create on first-ever use, unlock thereafter). One
  passphrase covers all servers. Forgotten-passphrase reset wipes stored
  passwords (server records survive) under a fresh salt. Threat model, stated
  honestly: encryption-at-rest protects stored passwords on stolen/shared
  devices and against casual IndexedDB inspection — **not** against code
  running in an already-unlocked page.
- **Session tokens** stay memory-only per server in a closure Map, with a
  "connected as…" indicator. Disconnect (and vault lock) wipes key + tokens.
- **Import the published XForm XML** (our parser round-trips it losslessly),
  not the `.xlsx` Central may hold. Importing an unpublished draft is out of
  scope for v1.
- **Import collision = offer replace.** Replace is destructive (overwrites
  local edits), behind an explicit danger-styled confirm. Copy is the
  non-destructive default.
- **Import seeds a publish target** pointing at the source server/project/form.
  Targets live outside the FormDocument, so exports stay clean.
- **Version conflict (409.3) offers a version bump.** Central rejects
  re-publishing an existing version string; the Publish dialog offers to bump
  and retry.
- **e2e via mocked Central** (Playwright route interception, same-origin) —
  real Central integration testing stays manual with a checklist.

## Decisions made during planning (refine/extend the shaping doc — flagged)

1. **Version bump helper — the shaping doc's "existing settings.version
   generator" does not exist as a bump helper.** `defaultVersion()` DOES exist
   (module-private, `src/core/model/factory.ts:17`, `yyyymmddHHMM`), but re-
   running it within the same minute yields an identical string, so a naive
   bump can fail to change the version and Central re-rejects. We add an
   exported `bumpVersion(current)` with a **distinct-from-current guarantee**
   (append/increment a counter suffix on same-minute collision).
2. **CORS-vs-network classification uses a `navigator.onLine` heuristic.** A
   CORS-blocked preflight and a genuine offline failure both reach JS as an
   opaque `TypeError: Failed to fetch`, indistinguishable at the network layer.
   The client emits `kind:'network'` when `navigator.onLine === false`, else
   `kind:'cors'` (online-but-blocked is almost always CORS). Both keep the
   setup-recipe link prominent. This is a refinement the shaping doc did not
   specify.
3. **Import collision uses a NEW atomic seam method
   `replaceFormWithArchiveAttachments`** (added to `PersistenceBackend` + both
   impls) rather than `deleteFormCascade` + create. Rationale: atomicity (no
   window where the old form is gone but the new write failed) and **record-id
   stability** (the library card, editor URL, and any publish targets keyed to
   that record id survive the replace).
4. **UnlockVaultDialog mounts once, app-globally in `App.vue`** (beside
   `<ConfirmDialog/>`), driven by the central store via a promise-gated
   `ensureUnlocked()`. The editor store's `activeDialog` union is editor-reset-
   prone and cannot back a dialog reachable from library/settings.
5. **All Central UI *and* store strings live in one `central` i18n namespace**
   (`central.json`), including store-surfaced copy under `central.store.*`
   (rather than `stores.central.*`). This keeps the shared i18n files owned by a
   single Wave-1 package so no later UI package edits them. Guide copy is the
   only exception — it lives in `guides.json` (its established home).
6. **db v3 adds three tables in one migration:** `centralServers`,
   `centralVault` (single fixed-id row for salt + key-check), and
   `publishTargets`. Recon saw only the first two (it ran against an earlier
   doc revision); `publishTargets` is fully incorporated here.

## Context

- **Visuals:** None (text-driven feature; follows existing dialog/section/
  page styling — PrimeVue 4.3.3, the settings-section and prop-field classes).
- **References:** see `references.md` — recon-verified file:line integration
  points across persistence, import pipeline, settings UI, stores/editor,
  i18n/tests, and core/help.
- **Product alignment:** Phase 3 backlog. This is the durable home the routed
  App Settings page (`2026-07-10-2005-settings-page`) left an extension point
  for. It is the first network code in the entire app.

## Skills & Conventions Applied

See `standards.md`:

- **unops-toolkit:shape-spec** — used to promote this backlog proposal into
  the timestamped spec folder (this document set).
- **CLAUDE.md hard invariants** — core purity (no Vue/Pinia/Dexie/vue-i18n in
  `src/core/central`), persistence backend-seam parity (Dexie + memory),
  UI strings only via the typed per-namespace i18n catalog, `data-testid`
  preservation, byte-stable rendered English, conventional commits with **no
  `Co-Authored-By` trailer**.
- **Delivery process** — spec folder → dynamic Workflow with parallel agents →
  verification (full suite + agent-browser pass logged to `docs/verification/`)
  → `/code-review` (five lenses) with immediate fixes → conventional commit(s)
  → update README Features, roadmap, and CLAUDE.md.
