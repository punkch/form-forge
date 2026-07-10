# Full translation coverage & discoverable per-language editing — Shaping Notes

## Scope

ODK/XLSForm supports the `::Language (code)` suffix on far more than labels:
`hint`, `guidance_hint`, `constraint_message`, `required_message`, the media
columns (`image`, `audio`, `video`, `big-image`) and choice labels + choice
media. **The core model, serializer, XLSForm writer and XLSForm reader already
round-trip all of these** (`transformLocalizedTexts`, `putLocalized`/`readMedia`,
the itext serializer). The gap is entirely in the UI, in two places:

1. **The translation grid hides sites that are empty in every language.**
   `collectTranslationSites` filters with `hasAnyValue`, so a form whose
   questions only have labels shows *only* label rows — you cannot add a
   French hint or constraint message from the grid until a default-language
   value exists first. Media sites never appear at all.

2. **Per-language editing from the properties panel is undiscoverable and
   inconsistent.** The only per-language mechanism today is the Translations
   dialog's "Show in editor" select, which sets `editor.displayLanguage`.
   `BasicSection` label/hint honour it but *display the fallback as editable
   text*; `LogicSection` (constraint message) and `ChoicesSection` (choice
   label) ignore it and always write the default language; required message
   and guidance hint have no panel input at all.

This work closes both gaps: a complete, always-editable grid (including media
and rarely-used fields), and a properties panel where every localized input is
language-aware, visibly labelled with the language being edited, and shows the
fallback as a placeholder rather than as editable text.

**Out of scope:** translating the form title (XLSForm has no localized title),
audio/video recording, a media picker / per-language attachment upload UX
(media cells are free-text filenames in v1), and *adding* a brand-new media
ref for a slot that is empty in every language (no media input exists in the
panel yet — a separate feature). The grid translates media refs that already
exist; it does not create the first one.

## Decisions (resolved with team-lead before promotion)

1. **Grid completeness — relevance rule, not `hasAnyValue`.** `label` + `hint`
   rows are shown for every question/group/repeat even when empty;
   `constraint_message` when `bind.constraint` is set; `required_message` when
   `bind.required` is set; `guidance_hint` behind a component-local
   **"Show rarely-used fields"** toggle in the grid toolbar (default **off**).
   Core exports the relevance decision; the grid owns the toggle and hides
   guidance-hint rows when it is off.

2. **Media rows appear only where a ref already exists** in at least one
   language (node and choice `image`/`audio`/`video`/`big-image`) — not
   always-on. Cells are free-text filename inputs that reference form
   attachments by filename, the same contract as `fetchFormAttachment`
   (`src/preview/fetchFormAttachment.ts`).

3. **Grid layout stays flat rows with richer context strings.** The current
   grid is a single flat `<table>` keyed by `siteKey`; the context column
   already carries the node/choice name (`age · Hint`, `states / tx`). Adding
   per-node header rows would mean restructuring the table (row groups /
   spans) for no functional gain. Media rows extend the same pattern
   (`age · Image`, `states / tx · Image`). **No per-node grouping.**

4. **One `useEditingLanguage()` composable + one shared `LocalizedInput`
   component.** The composable wraps `editor.displayLanguage` (resolving the
   `null` sentinel to `DEFAULT_LANG`) and exposes the active `Lang`, whether a
   non-default language is being edited, and the badge label. `LocalizedInput`
   renders the **exact-language** value (`exactText`, never `displayText`), so
   the fallback never appears as editable text; when the selected language is
   empty the fallback shows as **placeholder**. Every localized input in the
   panel adopts it: label, hint, constraint message, **new** required message,
   **new** guidance hint, and choice labels.

5. **A compact editing-language control in the properties panel**, rendered
   below the panel header only when the form has ≥1 language, bound to the same
   `editor.displayLanguage` state as the dialog's "Show in editor". One state,
   two access points.

6. **Custom translated columns stay grid-only** (they already flow through
   `transformLocalizedTexts`; no panel affordance). Stats (`translated/total`)
   recompute over the expanded, currently-visible site list. **Canvas choice-
   label rendering is a non-issue and explicitly deferred:** choices are not
   rendered on the canvas at all (`TreeNodeCard` renders question labels only;
   choices appear only in the properties panel and the live preview), so there
   is no canvas choice-label to make language-aware — the properties
   `ChoicesSection` already becomes language-aware via `LocalizedInput`.

### Supporting decisions

- **No serializer/writer/reader/golden change.** Every field in scope already
  round-trips. This is the biggest risk-reducer: `tests/golden/` stays
  untouched and green. If any golden diff appears, something is wrong.
- **Empty-in-selected-language input renders empty** (value = `exactText`),
  fallback in the placeholder. This is a deliberate, visible behaviour change
  from today's "fallback shown as editable text". Existing component tests that
  assert the *presence* of a value keep a real value in the selected language
  and stay green; a new case covers the placeholder-fallback behaviour.
- **Clearing a cell/input removes only the selected language key** (existing
  `setText` semantics — `value === ''` deletes `next[lang]`). Acceptance
  asserts this for the panel path too.
- Rendered-English byte-stability applies; new copy is intentional and lands
  with its tests. `data-testid`s preserved; new affordances get new testids.
- `tests/golden/complex/` (untracked, pre-existing) is out of scope — not
  touched, not committed.

## Context

- **Visuals:** None. This is a structural/coverage change to existing surfaces
  (translations dialog grid, properties panel), not a new visual design.
- **References:** see `references.md` — the core translations module, the
  existing grid/dialog, the properties sections, display helpers, the XLSForm
  media columns, and `fetchFormAttachment`.
- **Product alignment:** `docs/product/roadmap.md` Phase 3 lists translation
  coverage; the backlog doc `docs/specs/backlog/translation-coverage.md` is the
  source. Complements the pending `in-app-guidance` proposal (which explains
  these concepts) without conflicting.

## Skills & Conventions Applied

See `standards.md` — CLAUDE.md hard invariants (core purity: no Vue in
`src/core`; UI strings only via the typed vue-i18n catalog; `data-testid`
preservation; serializer pinned to pyxform 4.5.0 via `tests/golden/` — here,
untouched), the delivery process (spec folder → parallel Workflow → verify →
`/code-review` → conventional commit → update README/roadmap/CLAUDE.md), and
the coverage floors.

## Code review outcome (2026-07-10, five lenses)

Byte-stability and data-testid audits passed; efficiency clean (both
`collectTranslationSites` consumers verified off the edit hot path; the
export readiness summary only computes on menu open). Findings applied:

- **Stale editing language clamped** (the one real bug): `form.undo` could
  shrink `doc.languages` while `editor.displayLanguage` still pointed at
  the removed language — panel inputs would write orphan translations into
  an undeclared language. `useEditingLanguage` now clamps to the default
  language whenever the selection isn't declared; the dialog's
  remove-path reset is pinned by a test.
- `LogicSection` message inputs now gate on trimmed `hasText`, matching
  the grid/validators (whitespace-only expressions no longer offer a
  message input the grid hides).
- The "text in ≥1 language" predicate exported once from core as
  `hasAnyText` (`v !== ''` semantics) and the export-readiness untranslated
  count moved into a unit-tested core helper (`untranslatedCellCount`);
  `ExportMenu` and the translation validator consume it. The serializer's
  `hasAnyMedia` was deliberately NOT switched — it aggregates MediaRefs
  slots with trim semantics, so consolidation risked golden drift.
- `RARELY_USED_FIELDS` made module-private; `LocalizedInput`'s prop
  renamed `modelValue` → `value` (it is not a v-model — it emits
  `edit(value, lang)`).
- Added tests: sibling-media-slot cleanup, Textarea emit path, stale-
  language clamp, dialog display-language reset.

Deferred (recorded, deliberately not done): per-language stats single-pass
micro-optimization and shared `useEditingLanguage` computeds (both
measured negligible); `isRarelyUsedSite` parameter symmetry; unifying
three seam-comment phrasings; a `localizedSetter` factory for the
sections' 2-line setter boilerplate (matches the files' explicit style);
`removeLanguage`'s pre-existing `{ image: undefined }` leftover (harmless,
pre-dates this feature).
