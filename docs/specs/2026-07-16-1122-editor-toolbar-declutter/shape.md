<!--
  Shape spec (promoted from docs/specs/backlog/editor-toolbar-declutter.md,
  2026-07-16). Regroups the editor header; no stores/persistence/core changes.
-->

# Editor toolbar de-clutter & form-tools promotion — shape

**Status:** ready for implementation · **Effort:** S (1–2 days) · **Depends
on:** none (pure shell/component reshuffle).

## Problem

The editor header packs up to 12 interactive targets into one undifferentiated
row: back, undo, redo, palette toggle, Problems ("Ready"), Preview, Export
(split button = 2 targets), Central (when servers exist), an unlabeled ⋮
overflow, theme toggle, help. Seven are icon-only with identical muted
styling and no grouping — history, layout, validation, view, output,
publishing, content management, device preference and meta-help concerns sit
interleaved with uniform presentation, so the toolbar can only be learned by
serially reading tooltips.

Meanwhile the four surfaces that manage the form's actual **content** — Form
settings, Translations, Choice lists, Attachments — are hidden behind the
unlabeled ⋮ ("More form tools"). For the bundled bilingual templates,
Translations and Choice lists are core authoring workflow, not overflow.
This is an information-architecture inversion: transient view toggles
(palette, preview) and a device preference (theme) hold prime toolbar space
while persistent form-scoped tools require discovering an anonymous kebab
menu. (Verified 2026-07-16 with an interface-craft critique over a live
agent-browser session at 1440×900; the user independently reported the same
perception.)

## Context

Promoted 2026-07-16 from `docs/specs/backlog/editor-toolbar-declutter.md`;
open questions resolved with the user 2026-07-16; current-implementation
claims verified against code 2026-07-16 (see `references.md` for the
corrected file:line pointers — the backlog doc's line numbers for
`FormEditorView.vue` were re-checked against the current tree and one
consumer claim was corrected: `central-button` has no e2e/component test
consumer at all, so it is fully free to relocate/relabel).

## Scope

- Re-group the `AppHeader`/`FormEditorView` `#actions` row into visibly
  separated clusters (below); the four form-scoped tools become a labeled
  disclosure — no anonymous kebab for core surfaces.
- Move the theme toggle out of the editor header entirely (it already exists,
  unconditionally, in the library header — no relocation logic needed there,
  just removal from `AppHeader.vue`).
- Re-glyph the palette toggle (`pi-objects-column` → `pi-palette`, matching
  the feature's own name, `QuestionPalette.vue`); give `ProblemsButton` an
  actionable affordance (trailing chevron) while preserving its exact
  status-at-a-glance rendering (severity classes, "Ready"/count text) pinned
  by `tests/component/problems-button.spec.ts`.
- Add a zero-state Central entry point in the editor toolbar for forms with no
  registered server (previously: no Central affordance at all until a server
  existed elsewhere).
- Keep every embed gate; migrate every e2e testid/label consumer of the
  retired `editor-more` kebab in the same change; add i18n keys for new
  labels, remove the now-unrendered `shell.editor.moreTools` key.
- Verification: `/agent-browser` pass at wide (1440×900), laptop (1100×800)
  and tablet (900×800) widths, with and without a registered Central server,
  critique with `/interface-craft`, log to `docs/verification/`.

**Out of scope:** the contents of the four form-tools dialogs themselves (the
attachments dialog rework is a separate stream,
[attachment-manager](../backlog/attachment-manager.md)); the Central drawer's
own contents/behaviour (`CentralDrawer.vue` and friends are untouched — the
zero-state button routes to Settings' existing "Add server" flow rather than
teaching the drawer a new empty state); the Export menu's entries
([zip-export-variants](../backlog/zip-export-variants.md)); any library-view
header changes beyond the theme toggle already living there; keyboard
shortcuts or descriptions on the Form menu's items (deferred polish, see
below).

## Decisions

All four of the backlog's "proposed decisions" are adopted as settled, plus
the four previously-open questions are resolved:

1. **Theme toggle leaves the editor header, full stop.** It remains in the
   library header only (already unconditionally rendered there via
   `FormLibraryView.vue`); Settings also exposes the full appearance controls.
   It is a device preference persisted in the `ui` store, not a document
   action, so it has no business in the per-form editor chrome.
2. **The ⋮ kebab is retired.** Its four items (Form settings, Translations,
   Choice lists, Attachments) move to a labeled disclosure button.
3. **Undo/redo stay in the header**, unchanged, first in the right-hand
   cluster order (keyboard shortcuts exist; the buttons carry the tooltip
   labels already).
4. **Export and Central stay as siblings** in an output cluster; no merging
   into one "Share" button — Central is stateful/drawer-based, Export is
   immediate, different verbs.
5. **Form-tools menu placement: LEFT, next to the title.** This reads as a
   document-app idiom ("this form's menus" — Word/Docs-style), and keeps it
   visually distinct from the right-hand action clusters. Label copy is
   **"Form"** (a single word keeps the header single-row at narrow widths);
   final microcopy may be tuned during the `/interface-craft` review but
   ships as "Form" first.
6. **Preview keeps its labelled button.** The earlier UX-polish pass
   deliberately made Preview always-labelled; that stands. The palette toggle
   stays icon-only (paired visually with Preview in the view cluster) but
   gets the clearer `pi-palette` glyph.
7. **Central zero-state: show, don't hide.** When no server is registered,
   the toolbar still shows a "Central" button; clicking it navigates to
   Settings and scrolls the existing Central-servers section into view,
   rather than silently having no Central affordance at all. Still hidden in
   embed mode regardless of server count.
8. **Tablet mode ships the same change as desktop, in the same PR** — no
   special-casing, no folding the Form menu into `EditorTabs`' second row.
   `EditorTabs` remains exactly what it is today (a pane switcher for
   canvas/properties/preview in tablet mode); the header reshuffle applies
   identically regardless of `useBreakpoint().mode`.
9. **Menu items do not gain keyboard shortcuts or descriptions now** —
   recorded as deferred polish, not part of this change.

Clustering target, left → right: **[Form menu, next to the title] ‖
[history: undo/redo] · [view: palette, preview] · [status: Problems] ·
[output: Export, Central] · [meta: help]**, with a thin vertical separator
between each right-hand cluster (a new small presentational component,
`ToolbarSeparator.vue`, reused between `AppHeader.vue`'s own boundaries and
`FormEditorView.vue`'s internal cluster boundaries — see `plan.md`).

## Skills & conventions applied

- Implementation runs through dynamic Workflows with Sonnet implementors
  following `plan.md` literally.
- UI-touching changes get an `/agent-browser` pass at the three widths above
  (with and without a registered Central server) followed by an
  `/interface-craft` critique before the change is considered done; both are
  logged to `docs/verification/` per the established process
  (`docs/specs/2026-07-15-1219-central-ux-enhancement/user-guide.md` is the
  template for the verification write-up style).
- `/code-review` (five lenses, no plan mode) runs over the diff; findings are
  fixed immediately, not deferred.
- Conventional commit once verification passes; README Features, roadmap and
  `CLAUDE.md` get the routine "delivered" touch-ups as part of the delivery
  process, not as a task inside this plan.
