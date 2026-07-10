# Verification — Settings page (2026-07-10)

Manual agent-browser pass against the production build (`pnpm build` +
`pnpm preview`, chromium 1440×900), after all automated gates passed. Feature:
a dedicated `#/settings` route reachable from a header gear that replaces the
old library `⋯` overflow menu — Workspace export/import, app language, and an
About/storage block; suppressed in embed mode.

## Automated gates

- `pnpm lint` — clean
- `pnpm typecheck` — clean
- `pnpm test` — 85 files / 754 tests, all pass
- `pnpm test:coverage` — floors met (core 86/78/88, stores 80/85,
  persistence 90/92)
- `pnpm test:e2e` — 69 passed, 0 failed, 0 flaky (chromium + firefox)
  pre-review-fix; `settings` + `workspace-archive` specs re-run green on
  chromium post-review-fix

## Findings verified in-app

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Library header shows a gear (aria-label "Settings"), no `⋯` overflow menu anywhere; gear routes to `#/settings` | `v01-library-gear.webp`, `v05-card-actions-menu.webp` — header has only Import form / New form / Settings (gear); clicking it lands on `http://localhost:4173/#/settings` | ✅ |
| 2 | Settings page: back arrow + "Settings" title; Workspace section (Export **disabled** on empty library + Import); Language select showing "English"; About with "Form Forge for ODK v1.0.0-RC1" + a Storage: line | `v02-settings-empty-library.webp` — Export workspace greyed (`disabled=true`); "Form Forge for ODK v1.0.0-RC1"; "Storage: best effort — the browser may clear data under storage pressure…" | ✅ |
| 3 | After creating a form, Export workspace is enabled and downloads `formforge-workspace-<yyyy-mm-dd>.formforge.zip` | `v03-settings-export-enabled.webp` — Export now `disabled=false`; click produced `formforge-workspace-2026-07-10.formforge.zip` (1392 B, valid zip: manifest.json + forms/&lt;id&gt;/form.json + meta.json) landed in `~/Downloads` | ✅ |
| 4 | Import workspace opens the archive dialog; cancel works | `v04-import-dialog.webp` — "Import workspace" dialog ("Drop a workspace archive (.formforge.zip) here", Choose a file / Cancel / Import-disabled); Cancel closes it back to the settings page | ✅ |
| 5 | Back button returns to the library with the created form's card present; footer workspace-backup link still exports | `v05-card-actions-menu.webp` — "Back to forms" returns to `#/`, "Settings Verify Form" card present; footer "export a workspace backup" link produced `formforge-workspace-2026-07-10.formforge.zip` (file landed) | ✅ |
| 6 | The form card's own menu still has a working "Export archive" (downloads `<formId>.formforge.zip`) | `v05-card-actions-menu.webp` — card menu Rename/Duplicate/Save as template/**Export archive**/Delete; click produced `settings_verify_form.formforge.zip` (valid zip). Filename is the ODK form_id per `src/composables/useWorkspaceExport.ts:33` (`<formId || 'form'>.formforge.zip`), not the internal UUID | ✅ |
| 7 | Embed mode must NOT render settings — waiting view instead, no gear | `v06-embed-waiting-no-settings.webp` — app framed with `?embed=1#/settings` shows the "Waiting for host…" EmbedWaitingView, no gear, no Settings. See note below | ✅ |
| 8 | Direct deep link `#/settings` in a fresh non-embed tab renders settings correctly | `v07-deeplink-settings.webp` — fresh top-level load of `http://localhost:4173/#/settings` renders the full settings page (Back / Workspace / Language / About) | ✅ |

## Notes

- **Item 7 — how embed mode is actually detected.** Opening
  `http://localhost:4173/?embed=1#/settings` in a **top-level** browser tab
  renders the settings page normally, because embed mode is not active there.
  By design `src/embed/detect.ts:19` gates activation on `?embed=1` **and**
  `window.parent !== window` (i.e. the app must be framed) — a stray query
  param can't disable the standalone app. To reproduce genuine embed mode I
  loaded the app inside an iframe pointed at `?embed=1#/settings`; that shows
  the "Waiting for host…" waiting view (`v06`). The suppression is structural:
  `src/router/index.ts:24-30` only registers the `/settings` route when not
  embedded, so in embed mode `#/settings` falls through the catch-all
  (`:pathMatch(.*)*`) to `/`, which in embed mode is the EmbedWaitingView.
  Settings is therefore genuinely unreachable when embedded — not merely
  hidden behind the host handshake.
- Single-form "Export archive" and whole-workspace "Export workspace" produce
  byte-identical `.formforge.zip` structure (manifest + `forms/<uuid>/…`); they
  differ only in the download filename (`<formId>.formforge.zip` vs
  `formforge-workspace-<date>.formforge.zip`).
- Downloads were confirmed both by capturing the download anchor's `download`
  attribute in-page and by the file landing in `~/Downloads`.

**Verified 2026-07-10.**
