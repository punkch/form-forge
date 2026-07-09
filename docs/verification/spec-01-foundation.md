# Spec 01 verification checklist (agent-browser)

Run `pnpm dev`, open the served URL at 1280×800.

- [x] Library loads at `/#/` with empty state ("No forms yet"), ODK look: Roboto type, white/slate surfaces, `#3e9fcc` primary button, 6px radii.
- [x] "New form" opens a dialog; creating "Household Survey" navigates to the editor.
- [x] Editor shows header (back button, title, save indicator "All changes saved"), disabled Preview/Export placeholders, canvas placeholder.
- [x] Back to library: form card shows title, `household_survey` id, version, "0 questions", updated time.
- [x] Reload the page: form still listed (IndexedDB persistence).
- [x] Card menu → Rename works and updates the card ("Household Survey 2026").
- [x] Card menu → Duplicate creates "… (copy)" with `household_survey_copy` id.
- [x] Card menu → Delete asks for confirmation and removes the card.
- [x] Browser console free of errors; no network requests beyond the dev server.
- [x] Screenshots captured under `screenshots/spec01-*.png`.

**Verified 2026-07-09** with agent-browser (Chrome 150), all items passing.

## Finding fixed during verification

PrimeVue 4.3.3's component CSS rendered with unresolved `dt('…')` design-token
calls because pnpm resolved newer transitive `@primeuix/styles@1.2.5` /
`@primeuix/utils@0.6.x` than primevue 4.3.3 was built for (buttons showed
gray UA styling instead of ODK blue). Fixed by pnpm overrides pinning
`@primeuix/styles@1.0.3`, `@primeuix/styled@0.5.1`, `@primeuix/utils@0.5.4`
(package.json → `pnpm.overrides`). Any future PrimeVue bump must revisit
these pins together with the web-forms parity check.
