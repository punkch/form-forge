# Skills & Conventions for Central UX enhancement

The following skills and conventions apply to this work.

---

## interface-craft (skill)

- **Source:** `plugin:unops-toolkit:interface-craft` →
  `references/design-critique.md`
- **Why it applies:** the whole feature is a UX re-shaping; the review Artifact
  and the entry-point decision were produced with the five-lens critique.
- **Key points:** critique through five lenses in order (context → first
  impressions → visual design → interface design → consistency → user context);
  be specific/decisive/quantitative; severity ranks structural > behavioral >
  visual. Consistency lens drove the entry-point call: the Central drawer is a
  resizable pane like Preview, so its toggle must reuse Preview's idiom.

## agent-browser (skill)

- **Source:** `userSettings:agent-browser` — load via `agent-browser skills get
  core` before use.
- **Why it applies:** the live walkthrough surfaced the modal-stacking bug;
  verification of every new Central surface (drawer steps, destinations,
  freshness, add-new, import drawer, unlock gate) runs through it with
  screenshots logged to `docs/verification/`.
- **Key points:** accessibility-tree snapshots + `@eN` refs; run against the
  built app on `:4173` (matches `pnpm test:e2e`); scroll + re-capture for
  overlay/transition timing.

## artifact-design (skill)

- **Source:** bundled `artifact-design`.
- **Why it applies:** the review deliverable is a published Artifact; any updated
  mockup redeploys to the same URL.
- **Key points:** self-contained (CSP blocks external hosts — inline CSS/JS,
  data-URI images), theme-aware, stable `<title>`/favicon across redeploys.

---

## Repository hard invariants (CLAUDE.md) — binding

- **`src/core/` is pure TS** — no Vue/Pinia/Dexie/vue-i18n imports. The
  content-fingerprint helper must live in core as pure TS and never localize.
- **Persistence goes through the backend seam** (`src/persistence/backend.ts`).
  The new `lastPublishedContentHash` column ships in both the Dexie default and
  the memory backend; repo signatures stay identical; specs run on both via
  `tests/helpers/backends.ts`.
- **Serializer behavior is pinned to pyxform 4.5.0** by `tests/golden/`. The
  content hash relies on the serializer being byte-deterministic — do not change
  serializer output; hashing excludes only the `version` attribute.
- **Version pins** — PrimeVue 4.3.3 + `@primeuix` byte-match `@getodk/web-forms`
  (`pnpm verify:webforms`); no PrimeVue drift. New UI uses existing PrimeVue
  components already in the bundle.
- **Generated theme CSS is committed + drift-gated** — new surfaces style via
  existing `--odk-*` / `--builder-*` tokens; no hand edits to
  `src/styles/generated/*`.
- **UI strings only via vue-i18n** — reuse the `central` namespace; new copy is
  additive; keep rendered English byte-stable where a surface is only re-homed;
  eslint `no-missing-keys` is an error.
- **Preserve `data-testid`s** — existing Central testids must survive so e2e
  keeps passing where a surface is only re-homed; new surfaces add their own.
- **Embed-safe** — no Central affordances in embed; the drawer follows the same
  `central.hasServers && !embed.active` gate as today's Publish button.
- **Conventional commits** — release-please derives versions; **no
  `Co-Authored-By` trailer** (global user instruction, overrides defaults).

## Coverage floors (must not regress)

`pnpm test:coverage` enforces: core 86/78/88, stores 80/85, persistence 90/92.
New core helper (content hash), store changes, and the persistence migration
must ship with tests that keep these floors green.
