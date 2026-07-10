# Form Templates & Starter Gallery — Manual Verification

Run `pnpm dev` and verify:

| # | Steps | Expected |
|---|---|---|
| 1 | Library → New form | Dialog shows a "Blank form" card, four bundled template cards (title, description, question count, first-labels preview) and the form-title field |
| 2 | Type a title and press Enter (touch nothing else) | A blank form opens in the editor — same flow as before templates existed |
| 3 | New form → click "Household survey" | Confirm step: template summary, "All templates" back button, title prefilled with "Household survey" |
| 4 | Keep the title, Create | Editor opens with 13 questions incl. a "Household member" repeat; problems button shows "No problems found."; preview renders in the engine |
| 5 | In the preview, switch form language | English and French labels/choices both present (bilingual content) |
| 6 | Back to library → row menu on any form → Save as template | Dialog with name prefilled from the form title, description field, note that attachments are not included |
| 7 | Save, then reload the page → New form | The saved template appears in the gallery with a "Local" tag, description, count and preview |
| 8 | Click the local template → Create | A new form instantiates from it; the source form is untouched |
| 9 | New form → hover a local template → trash button | Deletes the local template from the gallery (bundled ones have no delete) |
| 10 | Create two forms from the same template | Both open fine; ids/names don't collide (fresh node ids, distinct record ids) |

Automated coverage: `tests/e2e/templates.spec.ts`,
`tests/component/new-form-dialog.spec.ts`,
`tests/unit/templates-generator.spec.ts`,
`tests/unit/templates-registry.spec.ts`,
`src/persistence/templates-repo.spec.ts`, `src/core/model/factory.spec.ts`.
