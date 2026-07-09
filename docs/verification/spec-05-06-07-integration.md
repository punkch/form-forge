# Specs 05+06+07 integration verification (agent-browser + Playwright)

Three parallel worktree agents built the features; this pass verified the
merged + wired result in a real browser.

## XForm import (Spec 06)

- [x] Library → Import form → drop/pick `all-widgets.xml`: report shows
      **0 errors, 8 warnings** (documented OSM `<tag>` drops).
- [x] Importing creates "All widgets · all-widgets · v2019121101 ·
      **73 questions**"; the editor shows 83 cards (73 questions + 10 groups).
- [x] The imported legacy form renders in the live ODK engine: 132 form
      controls, no engine error, language dropdown present (French
      translation survived import → serialize).
- [x] Unsupported file (.txt) → clear error, Import disabled (e2e).

## XLSForm import/export (Spec 07)

- [x] `cascade.xlsx` (pyxform golden source) imports with "No problems
      found" and opens in the editor with 4 questions.
- [x] Export SplitButton: XForm XML download contains the cascade itemset
      predicate; XLSForm download is a valid xlsx (PK container); ZIP
      downloads (all asserted in tests/e2e/import-export.spec.ts).

## Choices, cascades, translations (Spec 05)

- [x] CascadeEditor recognizes the imported `state=${state}` filter and
      opens in visual mode (Filter column: state) with an Advanced toggle.
- [x] **Cascade works live in the engine**: districts hidden until a state
      is chosen; picking North reveals North One/North Two but not South One.
- [x] Editor "⋮" menu opens Form settings / Translations / Choice lists /
      Attachments dialogs.
- [x] Translations dialog: adding French (fr) migrates existing default
      text (no '-' placeholders in the preview) and shows the 11-row
      translation grid with completeness headers.
- [x] Single-language forms correctly show no language dropdown in the
      engine; multi-language (all-widgets) does.

## Bugs found & fixed during verification

1. **DataCloneError on import** — the parsed FormDocument sat in a deep
   `ref`, so IndexedDB received a reactive Proxy and refused to clone it.
   Fixed with `shallowRef` in ImportDialog + a regression test asserting
   parser output is `structuredClone`-safe (tests/unit/clone-safety.spec.ts).
2. **ESLint scanning agent worktrees** — leftover `.claude/worktrees/`
   produced 447k phantom errors; worktrees removed after merge and
   `.claude/**` ignored.
3. **Translation grid coalescing** — written against the pre-merge mutate
   signature; now passes `{ coalesce: true }` explicitly.

**Verified 2026-07-09.** Gates: 306 unit/component tests, 14 e2e
(chromium+firefox), lint/typecheck/build clean. Screenshot:
`screenshots/spec0567-cascade-preview.png`.
