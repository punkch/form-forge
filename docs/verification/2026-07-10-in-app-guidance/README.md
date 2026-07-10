# Verification — In-app guidance for workflow features (2026-07-10)

Manual agent-browser pass against the production build (`pnpm build` +
`pnpm preview`, chromium 1440×900), after all automated gates passed. Spec:
`docs/specs/2026-07-10-2007-in-app-guidance/`. Feature: a third help category —
**workflow guides** — added inside the existing unified help drawer (8 guides:
translations, logic, datasets, entities, backup, templates, autosave, keyboard),
reachable from a library "Help & guides" button and from contextual "?" triggers
in the Translations dialog, the logic builder, the choices/dataset areas and the
entity section; plus two dismissable, ui-store-persisted first-use callouts for
the only two places where a silent behavior changes the author's data
(Translations display-language retargeting, logic builder forced-raw mode).

Test form built in-app: a blank form "Guidance Verify" with two **Text**
questions, a **Select one** (inline choices), a **Select one from file**, and an
entity list `households` set up via Form settings → Entities.

## Automated gates

- `pnpm lint` — clean (exit 0)
- `pnpm typecheck` — clean (exit 0)
- `pnpm test` — 94 files / 842 tests, all pass (exit 0). New guidance specs
  included: `tests/unit/guides-content.spec.ts`, `tests/unit/ui-callouts.spec.ts`,
  `tests/component/help-guides.spec.ts`, `library-help.spec.ts`,
  `guide-callout.spec.ts`, `translations-guidance.spec.ts`,
  `choices-guide-trigger.spec.ts`.
- `pnpm test:coverage` — floors met (core 86/78/88, stores 80/85,
  persistence 90/92) — exit 0. Overall: statements 81.61%, branches 73.84%,
  functions 76.04%, lines 83.26%; `src/help` 100% statements.
- `pnpm test:e2e` — full cross-browser run (chromium + firefox): **85 passed /
  1 skipped** (the pre-existing skip), exit 0. Targeted re-run of the new
  `tests/e2e/guides.spec.ts` on chromium: **5/5 passed** (drawer guide list +
  search + steps; Translations "?" → translations guide; translations callout
  first-open/dismiss/reload-persist; logic "?" → logic guide + forced-raw
  callout; library toolbar "?" → guide list).
- `pnpm build` — green. The help drawer is code-split: `FormLibraryView.vue`
  pulls `QuestionTypeHelpDrawer.vue` via `defineAsyncComponent(() => import(…))`
  and renders it under `v-if`, so the drawer (and the guide content it carries)
  is not in the library chunk — confirmed lazy.
- `tests/golden/` — untouched. `git status` shows no changes to tracked golden
  fixtures; only the pre-existing untracked `tests/golden/complex/` is present.
  No serializer/writer/reader change was made.

## Findings verified in-app

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Library "Help & guides" (`?`) button opens the help drawer with a **Guides** section listing all **8** guides **above** the question-type reference | `v01-library-help-drawer-guides.webp` — drawer titled "Question type reference"; GUIDES section lists Translating a form / Building logic visually / External datasets / Entities & follow-up forms / Backing up your workspace / Starting from a template / Autosave & snapshots / Keyboard commands, then INPUT / CHOICE / … type groups below | ✅ |
| 2 | Drawer search narrows the guides; clearing restores | `v02-drawer-search-logic.webp` — typing `logic` leaves only "Building logic visually" in the GUIDES section (backup and the other 7 gone, no type groups match); clearing the box restored all 8 guides (verified by count) | ✅ |
| 3 | Logic guide opens: title in drawer header, summary + numbered steps, "Read more" → docs.getodk.org/form-logic/; back returns to the list | `v03-logic-guide-detail.webp` — header "Building logic visually", 6 numbered steps, `guide-read-more` href = `https://docs.getodk.org/form-logic/`. The back button returned to the list (GUIDES + type reference present) | ✅ |
| 4 | Templates guide renders steps with **no** "Read more" link | `v04-templates-guide-no-readmore.webp` — header "Starting from a template", 4 numbered steps; `guide-read-more` count = 0 (app-specific guide carries no `docsUrl`) | ✅ |
| 5 | Translations dialog header has a "?" trigger; **first** open shows the translations callout (display-language retargeting / no fallback language); dismiss it; close+reopen — gone; reload — still gone | `v05-translations-callout-first-open.webp` — header "Open guide" trigger + callout "Check which language you are editing" with Learn more + Dismiss. After dismiss the callout count → 0; closing and reopening kept it 0; reloading the page and reopening kept it 0 (persisted in the `ui` store). Trigger stays present throughout | ✅ |
| 6 | Translations dialog "?" click closes the modal and opens the drawer at the translations guide | `v06-translations-trigger-opens-guide.webp` — after clicking `guide-trigger-translations`: `translations-dialog` count = 0, `help-drawer` count = 1, `help-guide-translations` present, header "Translating a form" | ✅ |
| 7 | Logic builder: an unrepresentable expression as relevance shows the `logicRaw` callout **exactly once**; the logic "?" opens the logic guide; dismissal persists | `v07-logicraw-callout.webp` — set relevance (Raw) to `if(${text_1} > 1, 'a', 'b')` on the 2nd Text question; Visual toggle became disabled and the single callout "Why is Visual disabled?" appeared (`guide-callout-logicRaw` count = 1). `guide-trigger-logic` opened `help-guide-logic` ("Building logic visually"). Dismissing → count 0; re-selecting the question kept it 0 with Visual still disabled (expression preserved) | ✅ |
| 8 | A select question's Choices area shows a labeled **Learn more** "?" opening the external-datasets guide; a file-backed select shows the datasets "?" in its type-config area | `v08-datasets-guide-from-choices.webp` — the Select-one CHOICES section's labeled "Learn more" (`guide-trigger-datasets`) opened `help-guide-datasets` ("External datasets (CSV & GeoJSON)"). `v09-datasets-guide-from-typeconfig.webp` — the Select-one-from-file "Choices file" row's "Open guide" trigger opened the same datasets guide | ✅ |
| 9 | Entity section trigger opens the entities guide | `v10-entities-guide-from-section.webp` — after setting up the `households` entity list, a Text question's ENTITY section showed a labeled "Learn more" (`guide-trigger-entities`) that opened `help-guide-entities` ("Entities & follow-up forms") | ✅ |
| 10 | Accessibility: the Translations dialog's accessible name is "Translations" (`aria-labelledby` resolves to the title span) | `v11-translations-dialog-a11y.webp` + DOM inspection: `role="dialog"`, `aria-label` = null, `aria-labelledby="translations-dialog-title"` → a `<span>` with text `Translations`; computed accessible name = "Translations" | ✅ |

## Notes

- **Item 7 reference validity.** The first Text question is auto-named `text`
  (not `text_1`), so the `${text_1}` reference in the sample relevance surfaced a
  Problems entry "relevant references `${text_1}`, which does not exist." This is
  expected and does not affect the check: the `logicRaw` callout is driven by
  *representability* (an `if()` function cannot be shown visually), independent of
  whether the referenced field exists — the callout still appeared exactly once
  and Visual was correctly disabled.
- **One dismissal, everywhere, forever.** Both callouts are keyed by id in the
  `ui` store's `dismissedCallouts`; item 5 confirmed the translations dismissal
  survives close/reopen and a full page reload, and item 7 confirmed the
  `logicRaw` dismissal survives a question re-selection.
- **Two access points, one guide.** The Translations dialog's "?" (item 6) and
  the library/editor Help drawer both land on the same `help-guide-translations`
  content; contextual triggers deep-link into the shared drawer rather than
  opening a second surface.
- **Screenshot path note (process only).** agent-browser resolves screenshot
  paths from the daemon's launch cwd (repo root), not the shell `cd`; the `v01`–
  `v11` files were moved into this folder after capture. No product impact.
- Preview server stopped and the chromium session closed after the pass; port
  4173 freed.

**Verified 2026-07-10.**
