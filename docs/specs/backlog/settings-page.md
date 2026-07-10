# Settings page behind a gear icon — shaping (backlog)

## Problem

App-level actions hide behind an unlabeled ⋯ overflow menu on the library
header (`library-overflow-menu`: export/import workspace), and app-level
preferences have no home at all: the UI-language preference already exists
and persists (`ui.locale`, applied via `setLocale`) but has no control
anywhere, and [central-publishing](central-publishing.md) will need a
durable surface for managing server records. A settings page gives these a
discoverable, growable home.

## Scope

- Replace the library header's ⋯ button with a **gear** that navigates to
  a routed settings page (`#/settings`, `SettingsView.vue`) with a back
  link to the library.
- Sections:
  - **Workspace** — export the whole library / import an
    `.formforge.zip` archive; same flows as today's overflow menu
    (`WorkspaceArchiveDialog` and `workspace-io` reused as-is).
  - **Language** — UI-language picker over the supported UI catalogs,
    labeled by native name, persisted to `ui.locale`. Only `en` ships
    today, so the picker initially shows one entry; the machinery
    (`setLocale` already handles `lang`/`dir` for future RTL) is then
    ready for the first additional catalog. This is the app UI language —
    unrelated to form translations ([translation-coverage](translation-coverage.md)).
  - **Central servers** — add/edit/remove server records, test
    connection, connect/disconnect. Ships with central-publishing; the
    section stays hidden until that feature exists.
- Embed mode keeps its trimmed shell: no gear, settings route blocked
  (workspace io and server records don't apply to the embed memory
  backend).

Out of scope: per-form settings (`FormSettingsDialog` stays in the
editor), theming, and form-translation management (translations dialog).

## Approach

- New route + view using the library page's shell conventions; sections as
  plain page panels, not nested dialogs.
- i18n: add a `SUPPORTED_LOCALES` descriptor (code + native display name)
  beside `createI18n`; the picker maps over it. Catalogs stay
  per-namespace JSON under `src/i18n/locales/<code>/`.
- The gear replaces `library-overflow-menu`; e2e helpers that reach
  workspace export/import through the menu migrate to the settings page
  (`settings-gear`, `settings-*` testids) in the same change — the
  "preserve data-testids" invariant means updating every consumer
  together, not keeping the dead menu.

## Decisions (proposed)

- The library header keeps Import form / New form as primary buttons —
  only the overflow menu is replaced by the gear.
- Settings is a routed page, not a dialog: it will grow (server records),
  is deep-linkable from docs/help, and avoids dialog-on-dialog stacking
  for the archive import flow.
- No gear in the editor view for now; settings is reached from the
  library. Revisit if a second entry point proves necessary.

## Open questions

- Should workspace export also stay one click away on the library page
  (e.g. keep an "Export all" button) or is the settings page enough?
- UI language in embed mode: honor a host-provided locale via a future
  embed-protocol field, or keep embeds on the default until asked?
- Add a Settings > About section (app version, storage-persistence status,
  PWA update check) — cheap while we're here, or scope creep?

## Acceptance

The gear on the library header routes to `/settings`; workspace
export/import work from there with the existing tests migrated; the
language section lists supported catalogs and a switch persists across
reload (asserted with a test catalog until a second real one lands); embed
mode shows no gear and the route is blocked; full e2e suite green after
the testid migration.
