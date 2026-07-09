# Spec 01 — User Guide & Manual Test Scenarios

After this spec, the app provides a working shell: a Form Library backed by browser storage, and an (empty-for-now) editor route. Building questions, preview, and import/export arrive in Specs 03–07.

## What you can do

1. **Open the app** (`pnpm dev`) — you land on the Form Library at `/#/`.
2. **Create a form** — "New form" prompts for a title; a form record appears with title, form ID, version, and last-updated time.
3. **Rename / duplicate / delete** — via each card's actions menu. Delete asks for confirmation.
4. **Open a form** — navigates to `/#/forms/<id>`: the editor shell (header with form title, save indicator, disabled Preview/Export placeholders; empty canvas area with a hint).
5. **Persistence** — reload the browser: your forms are still there (IndexedDB). No network requests are made.

## Manual test scenarios

| # | Steps | Expected |
|---|---|---|
| 1 | Load `/` first time | Empty-state hint with "New form" action; ODK look (Roboto, blue #3e9fcc accents, light slate surfaces) |
| 2 | Create form "Household Survey" | Card appears; form_id auto-slug `household_survey`; version = today-based |
| 3 | Reload page | Form still listed |
| 4 | Rename form | Title updates in list and editor header |
| 5 | Duplicate form | Copy appears with " (copy)" suffix and new id |
| 6 | Delete form | Confirmation dialog; card removed; reload confirms gone |
| 7 | Open form, edit title, kill tab, reopen | No data loss (autosave) |
| 8 | Browser devtools → Network | No requests besides static assets |
