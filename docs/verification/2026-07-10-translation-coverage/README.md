# Verification — Full translation coverage & per-language editing (2026-07-10)

Manual agent-browser pass against the production build (`pnpm build` +
`pnpm preview`, chromium 1440×900), after all automated gates passed. Spec:
`docs/specs/2026-07-10-2006-translation-coverage/`. Feature: a complete,
always-editable translation grid (label + hint everywhere, constraint/required
messages where they apply, guidance hints behind a toggle) and a
language-aware properties panel with a compact editing-language control,
per-input language badges, and fallback-as-placeholder editing.

Test form built in-app: a blank form "Translation Coverage Verify" with a
**Text** question and an **Integer** question, French (fr) added via the
Translations dialog. The Integer question was given a constraint (`. >= 0`,
no message) and later marked Required.

## Automated gates

- `pnpm lint` — clean (exit 0)
- `pnpm typecheck` — clean (exit 0)
- `pnpm test` — 87 files / 794 tests, all pass (exit 0)
- `pnpm test:coverage` — 87 files / 794 tests pass; floors met (core 86/78/88,
  stores 80/85, persistence 90/92) — exit 0
- `pnpm test:e2e` — full cross-browser run (chromium + firefox), pre-review-fix:
  75 passed / 1 pre-existing skip. Post-review-fix, `tests/e2e/translations.spec.ts`
  re-run on chromium: **5/5 passed** (removing a language strips translations;
  constraint-without-message grid row + rare-fields toggle; add/translate/switch
  display language + itext export; French-only hint round-trips XLSForm
  export/re-import; panel editing-language writes selected key + clearing removes
  only that key)
- `tests/golden/` — untouched. `git status` shows no changes to tracked golden
  fixtures; only the pre-existing untracked `tests/golden/complex/` is present
  (out of scope per the shape doc). No serializer/writer/reader change was made.

## Findings verified in-app

| # | Check | Evidence | Result |
|---|-------|----------|--------|
| 1 | Grid shows Label **and** Hint rows for every question even when the hint is empty in every language | `v02-grid-label-hint-rows.webp` — after adding French, grid lists `text · Label`, `text · Hint`, `integer · Label`, `integer · Hint`; both Hint rows are empty editable cells (Default and French both blank). Header counter `French (fr) 2/4` (denominator counts the empty hints) | ✅ |
| 2 | A constraint with **no** message adds an editable constraint-message row | `v03-constraint-message-row.webp` — after setting `. >= 0` (no message) on the Integer question, the grid gains `integer · Constraint message` with empty editable Default + French cells; counter grows `2/4 → 2/5` | ✅ |
| 3 | "Show rarely-used fields" default OFF hides guidance-hint rows; ON reveals them and the denominator grows | `v03` (toggle off: no guidance rows, `2/5`) → `v04-rarely-used-on-guidance-rows.webp` (toggle on: `text · Guidance hint` + `integer · Guidance hint` appear, counter `2/5 → 2/7`) | ✅ |
| 4 | A French-only hint (default left empty) updates completeness and persists across close/reopen | `v05-french-hint-3of7.webp` — typed `Indice en francais` into the `text · Hint` French cell only; Default cell stays empty; counter `2/7 → 3/7`. Closed and reopened the dialog: the French hint is still present with the Default cell still empty (rarely-used reset to off, so header reads `3/5`) | ✅ |
| 5 | Panel editing-language control appears (≥1 language); French shows badges on localized inputs; empty French shows the default as **placeholder** (not editable text); typing writes French only | `v06-panel-editing-lang-control.webp` (compact "Editing language" control in the panel header, defaults to Default) → `v07-french-badges.webp` (French selected: `French (fr)` badges on Label, Hint, Guidance hint; **none** on Name or Default value) → `v08-label-placeholder-fr-empty.webp` (cleared French label → input empty, `placeholder="Integer question"` shown greyed, French badge present) → typed `Question entiere FR` → `v09-default-unchanged.webp` (switched to Default: label reads `Integer question`, no badge — default untouched, French write isolated) | ✅ |
| 6 | Marking a question Required adds a required-message input in the Logic section that writes the selected language | `v10-required-message-fr.webp` — Required toggled on, Logic section gains a **Required message** input (French badge); typed `Champ obligatoire FR`. `v11-grid-required-msg-french-only.webp` — grid `integer · Required message` row: Default empty, French `Champ obligatoire FR` (wrote the French key only) | ✅ |
| 7 | Media rows | No media row initially — confirmed the grid never showed Image/Audio/Video/Big-image rows (no media ref exists on any node/choice). **N/A for the write path:** the properties panel has no media input (out of scope per the shape doc — media refs are authored via import), so there is no in-app UI that creates the first media ref. Media-ref translation (row appears where a ref already exists) is covered by the golden/unit round-trip gates, not reachable from the UI here | N/A |
| 8 | Export readiness "untranslated" count excludes always-empty hint/guidance rows | `v12-export-readiness-no-warnings.webp` — with every content string translated and only the always-empty `integer · Hint` / `integer · Constraint message` French cells blank, the Export menu summary reads **"Ready · no warnings"** (0 untranslated — the always-empty rows are not counted). Then a Default-only hint (`Enter a whole number`, French left empty) was added to create exactly one genuine gap: `v13-export-readiness-1-untranslated.webp` — summary becomes **"Ready · 1 warning · 1 untranslated"**. The count is 1, not 2+, so the empty constraint-message / guidance rows are correctly excluded | ✅ |
| 9 | Full preview renders the form with translations | `v14-live-preview.webp` (live side-panel) and `v15-full-preview-translations.webp` (`#/forms/<id>/preview`) — web-forms renders the Integer question's French label `Question entiere FR` (with required `*`), the Text question's French hint `Indice en francais`, and a French `Envoyer` submit button. No language switcher appears because the form has a single named language (French; default unset), so web-forms offers no selector — expected per "if available" | ✅ |

## Notes

- **Migration on first language (item 1/5 context).** Adding the first language
  copies existing untagged label text into that language, so both questions'
  Label cells showed `Text question` / `Integer question` in the French column
  immediately. To exercise the placeholder path in item 5 I cleared the
  Integer question's French label (removing only the French key), which then
  rendered the default as a greyed placeholder.
- **One state, two access points (decision #5).** After selecting French via the
  panel "Editing language" control, reopening the Translations dialog showed its
  "Show in editor" select already set to `French (fr)` — the panel control and
  the dialog selector are bound to the same `editor.displayLanguage`.
- **Canvas honours the display language.** With French selected, the Integer
  question's canvas card label switched to `Question entiere FR`, matching the
  preview.
- **Item 8 semantics.** The readiness "untranslated" count reflects real gaps
  (a string present in some language but missing in a declared one). Rows empty
  in every language — the point of the "complete grid" change — are not counted,
  which is what keeps the count at 1 rather than being inflated by the empty
  constraint-message and guidance-hint cells.
- Preview server stopped and the chromium session closed after the pass; port
  4173 freed.

**Verified 2026-07-10.**
