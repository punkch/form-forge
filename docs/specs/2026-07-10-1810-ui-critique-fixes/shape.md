# UI Critique Fixes — Shaping Notes

## Scope

Implement every finding and recommendation from the 2026-07-10 whole-app
design critique (Interface Craft five-lens methodology, run against the
v1.0.0-RC1 production build; 32 states captured — key evidence in
`visuals/`). Eleven work items:

**Primary (the critique's Top Opportunities, ranked)**

1. **Logic builder trust** — exclude note fields from the ConditionBuilder
   operand dropdown, default new conditions to the nearest preceding
   answerable question, and raise a validation *warning* when a visual
   condition has an empty comparison value (today: silently accepted,
   "No problems found").
2. **Problems locations** — every Problems entry names the question it
   belongs to (label or path) and duplicate messages are grouped; the
   duplicate-name error currently prints the identical sentence twice with
   no location.
3. **Label truncation** — question labels in canvas cards wrap to two lines
   instead of single-line ellipsis, so the four-pane 1440 px layout stops
   clipping the canvas's primary content.
4. **Badge legibility** — the unlabeled card glyphs (`*`, diamond,
   circle-slash…) get decoded via tooltips/labels following the pattern the
   choice-list chip already uses (icon + word + count).
5. **Header hierarchy** — Preview and Export keep text labels at every
   width; the palette toggle swaps its hamburger for a panel-left glyph.

**Secondary findings**

6. Blocked-screen icon: replace the four-way move arrow with a
   screen-size-appropriate glyph.
7. Library version strings: deemphasize/format `v202607101734`.
8. New Form dialog: explain the disabled Create button (helper hint).
9. Unified help surface: header Help opens the same right-side drawer
   (starting on the searchable type list); the centered reference modal is
   removed; per-type "?" buttons keep deep-linking.
10. Library rows: **full card redesign** — richer cards (type/summary info,
    question-count chip, language badge when multilingual, last-edited
    emphasis, formatted version) while preserving `data-testid`s.
11. Readiness reward: Problems button gains a positive "Ready" state when
    the form is clean, and the Export split-button menu shows a one-line
    readiness summary (problems / untranslated strings / attachments) —
    exactly the critique's "uncommon care" recommendation; **no** blocking
    pre-flight dialog.

**Documentation-only**

12. Upstream issue draft for `@getodk/web-forms`: required integer widget
    renders "0" while the engine treats the value as empty → "This field is
    required" under a visibly filled field (see `references.md` for the
    draft; visual evidence `visuals/26-preview-field-error.webp`).

## Decisions

- **User confirmed 2026-07-10**: draft the upstream issue rather than
  patching web-forms locally (preserves the byte-identical preset
  invariant); header-Help-opens-drawer over keeping two containers; library
  rows get the full card redesign; readiness stays non-blocking, exactly as
  the critique recommended (Ready state + Export-menu summary).
- Empty condition values are a **warning**, not an error — they don't block
  export, they inform.
- Rendered-English byte-stability applies: copy changes are intentional
  here, so affected string-asserting tests are updated in the same change.
- All existing `data-testid`s are preserved (e2e depends on them); new
  affordances get new testids.
- `tests/golden/complex/` (untracked, pre-existing) is out of scope — not
  touched, not committed.

## Context

- **Visuals:** `visuals/` holds the 12 critique screenshots that evidence
  each finding. Full annotated critique artifact:
  https://claude.ai/code/artifact/31d25974-e92f-41fb-b6aa-daacb8f76653
- **References:** see `references.md` (existing patterns to reuse:
  choice-list chip, help registry + `groupTypesBySearch`, Issue factories,
  useBreakpoint).
- **Product alignment:** the help-surface unification is a prerequisite-
  friendly step for the pending `docs/specs/backlog/in-app-guidance.md`
  proposal, which already plans a "guides section in the existing help
  drawer"; nothing here conflicts with the Phase 3 backlog.

## Skills & Conventions Applied

See `standards.md` — CLAUDE.md hard invariants (core purity, i18n-only UI
strings, backend seam untouched, testid preservation, conventional
commits), delivery process (spec folder → dynamic Workflow implementation →
verification log → /code-review → commit), coverage floors.
