# App Settings Page — Shaping Notes

## Scope

A routed **App Settings** page (`#/settings`, `SettingsView.vue`) reached from a
gear on the library header, replacing the current unlabeled ⋯ overflow menu.
Sections that ship now:

- **Workspace** — export the whole library / import a `.formforge.zip` archive
  (the existing `WorkspaceArchiveDialog` + `workspace-io` reused as-is).
- **Language** — a UI-language picker over the supported UI catalogs, labeled by
  native name, persisted to `ui.locale` via the existing `setLocale`. Only `en`
  ships today (one option); this is the *builder UI* language, unrelated to form
  translations.
- **About** (minimal) — app version + storage-persistence status.

Out of scope: per-form settings (`FormSettingsDialog` stays in the editor),
theming, form-translation management, and a **Central servers** section (ships
with the still-blocked central-publishing; only an extension-point marker is
left). No PWA "check for updates" action (see decisions).

## Decisions

All backlog "open questions" are resolved (per the team lead):

1. **Gear replaces the ⋯ menu; no extra header button.** Settings is one click
   away; the library header keeps only Import form / New form as primary buttons.
   The single-form "Export archive" (card menu) and the footer "export a
   workspace backup" hint link **stay direct** on the library — they are
   contextual one-click safety actions, so they are not routed through settings.
2. **Minimal About:** app version (`__APP_VERSION__`, surfaced at build time) +
   storage-persistence status (`isStoragePersistent()`). **No update check** — the
   existing `useSwUpdate` (`src/pwa/registerSW.ts`) exposes only `applyUpdate()`
   and keeps its `ServiceWorkerRegistration` in a closure; a manual "check now"
   would mean reshaping that careful PWA flow and inventing a "no update
   available" UI state. Not trivially cheap → omitted, noted as an extension
   point.
3. **Embed mode:** no gear (the library is unreachable in embed anyway), and the
   `/settings` route is not registered when embedded, so `#/settings` falls
   through the router catch-all → redirect to `/` (the waiting screen). Workspace
   IO and server records don't apply to the embed memory backend. Host-provided
   locale for embeds stays out of scope.
4. **Language:** add a `SUPPORTED_LOCALES` descriptor (code + native name) beside
   `createI18n`; the picker's options derive from `i18n.global.availableLocales`
   named via that descriptor, so production shows only `en` while a test that
   registers a catalog via `setLocaleMessage` gets a second option to switch to —
   no const mutation. Persists to `ui.locale` through the existing store watcher;
   applied via `setLocale` (which already syncs `<html lang>`/`dir` for future
   RTL).
5. **Central servers does NOT ship** — extension-point comment only.
6. **e2e helpers migrate** from `library-overflow-menu` to `settings-gear` /
   `settings-*` testids in the same change; the dead menu is removed (the
   "preserve data-testids" invariant means migrating every consumer together, not
   keeping the corpse).

Two code-level clashes found during exploration and worked around:

- **i18n namespace `settings` is already the per-form `FormSettingsDialog`** →
  the new page uses a **new `appSettings` namespace**.
- **Testids `settings-dialog` / `settings-tab-*` belong to that dialog** → the
  page uses distinct `settings-gear` / `settings-view` / `settings-back` /
  `settings-export-workspace` / `settings-import-workspace` /
  `settings-language-select` / `settings-about*` (no collision).

## Context

- **Visuals:** None (text-only feature; follows existing page/section styling).
- **References:** see `references.md` — `FullPreviewView.vue` (routed page with a
  back bar), `FormLibraryView.vue` (overflow menu + export helpers + footer +
  storage status being moved/replaced), `WorkspaceArchiveDialog` + `workspace-io`
  (reused), `src/i18n/*` (`createI18n`, `setLocale`, per-namespace catalog),
  `src/stores/ui.ts` (`ui.locale` persistence), `src/router/index.ts` (hash
  history + embed gating), `src/pwa/*`.
- **Product alignment:** the routed, growable settings surface is the durable
  home the pending `central-publishing` proposal needs; nothing here ships that
  feature, only the extension point. Consistent with the Phase 3 backlog.

## Skills & Conventions Applied

See `standards.md` — CLAUDE.md hard invariants (core purity is untouched here;
i18n-only UI strings via the typed per-namespace catalog; persistence backend
seam untouched; `data-testid` preservation with a deliberate menu→gear
migration; rendered-English byte-stability), the vue-i18n foundation, and the
delivery process (spec folder → dynamic Workflow implementation → verification
log → `/code-review` → conventional commits → docs/index updates).

## Code review outcome (2026-07-10, five lenses)

No correctness bugs; efficiency clean (the WorkspaceArchiveDialog even moved
out of the eager library chunk into the lazy settings chunk). Five small
findings — four applied immediately:

- `appVersion()` deduplicated into `src/version.ts` (was copied in
  `useWorkspaceExport` and `embed/bridge.ts`).
- The durable-storage probe extracted to `useStoragePersistence()` (was
  duplicated in FormLibraryView and SettingsView).
- `exportArchive` made module-private in `useWorkspaceExport` (no external
  consumer; public surface is `exportWorkspace`/`exportFormArchive`).
- Component tests now pin all three storage-status lines (persistent /
  not persistent / unknown) with a mocked `isStoragePersistent`.

Two deferred as recommendations (both optional, neither a regression):

- Centralize yyyy-mm-dd local-date formatting (`useWorkspaceExport` filename
  stamp vs an inline equivalent in `ConditionRow.vue`) — semantically
  distinct uses; revisit if a third appears.
- Error toast on export failure — a throw from archive gathering/building is
  an unhandled rejection with no user feedback; identical to the pre-refactor
  behavior. Candidate for a small follow-up alongside a general
  storage-error surface.
