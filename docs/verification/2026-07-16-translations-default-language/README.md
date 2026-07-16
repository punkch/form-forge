# Manual verification — retire the "Default" language column (2026-07-16)

Agent-browser pass against the production build (`pnpm preview`, :4173),
Chromium. Spec: `docs/specs/2026-07-16-1712-translations-default-language/`.
All seven planned scenarios pass.

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| a | New blank form → Translations shows a single editable **Text** column (no Default), "untranslated only" toggle and language selects hidden | ✅ | `01-zero-lang-text-column.png` |
| b | Add French (fr) → content MOVES (grid: String + "French (fr) 1/2", Text column gone), Default-language + Show-in-editor selects appear reading French (fr), panel editing-language reads French (fr) with **no Default option** and no badge, canvas label unchanged; toolbar **Undo restores** the Text column with the content intact | ✅ | `02-first-language-converted.png`, `03-panel-no-default-option.png` |
| c | Add Spanish (es) (second language → no migration, 0/2) → editing Spanish shows the language badge and the French text as a **placeholder**, never editable text | ✅ | `04-spanish-badge-fallback.png` |
| g | Live preview language menu lists exactly French (fr) + Spanish (es), French pre-selected (the default language / `default="true()"`) — no "default" entry | ✅ | `05-preview-named-langs-only.png` |
| d | Import a mixed XLSForm (bare `label` + `label::French (fr)`; one row conflicting, one bare-only, one French-only) → bare-only text auto-merged into French; the conflict keeps both: warning-tinted **Unassigned** column + hint, ProblemsButton shows `"q1" has text not assigned to any language.` with a location chip; preview renders all three merged labels | ✅ | `06-mixed-import-unassigned.png`, `07-problems-unassigned-warning.png` |
| d2 | Clearing the conflicting Unassigned cell reactively removes the column, the hint, and the warning | ✅ | `08-conflict-resolved.png` |
| e | Removing the only language shows the last-language warning ("Removes French (fr). Its text becomes the form's untranslated text.") and returns every value to the single Text column — nothing lost | ✅ | `09-remove-last-warning.png` |
| f | Export shape (verified against the real writer/serializer with a converted bilingual doc): survey sheet has **no bare `label` column**, `default_language` = French (fr); XForm emits named `<translation>` blocks only, first with `default="true()"`, zero `lang="default"` | ✅ | one-off spec run (below) |

Scenario (f) note: the writer (unchanged by this feature) only emits a
`::Language` column once that language has at least one value — a
freshly-added, still-untranslated language contributes no column. Pre-existing
behavior, out of scope.

Automated gates at the same commit: `pnpm test` 1278 tests green (goldens
unregenerated — no engine files in the diff), `pnpm test:coverage` floors met,
`pnpm lint` + `pnpm typecheck` clean, full Playwright e2e matrix green on
chromium + firefox (113 passed / 1 skipped).

Five-lens code review (reuse / quality / efficiency / correctness /
style+tests) ran on the diff; all findings fixed in the same commit: a real
grid bug (the "untranslated only" filter, left on when the last language is
removed mid-dialog-session, emptied the grid under a hidden toggle — now
inert in Shape A, regression-tested), a `display.ts ↔ translations.ts` module
cycle (broken by moving `primaryLang` into display.ts, re-exported from
translations.ts), the Translations dialog re-deriving `useEditingLanguage`
logic in local computeds (folded onto the composable, which now also exposes
the shared `languageOptions`), and four test-coverage gaps (empty-string
target = move not conflict; literal-"default" language removal ×2; grid
literal-"default" testid-collision guard; validator media/custom-column
branches). Informational findings (migrate.ts throwing on corrupt archives —
wrapped by both callers; the deliberately-unenforced defaultLanguage
invariant for imports) were accepted without change.
