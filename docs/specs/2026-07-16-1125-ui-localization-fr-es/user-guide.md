# French + Spanish UI language — user guide

Form Forge's own interface — not the forms you build — can now be used in
**French** or **Spanish**, alongside English.

## Choosing a language

Open **Settings** (the gear icon on the library header) and pick a language
from the **UI language** list. The change applies immediately, everywhere
in the app, and is remembered on this device for next time.

If you've never chosen a language before (a brand-new install, or an
existing install from before this feature), Form Forge makes one best
guess the first time it loads: it looks at your browser/OS language and
switches to French or Spanish automatically if that's a close match (for
example, a browser set to Canadian French switches the app to French).
Nothing changes if your browser is already set to a language the app
doesn't ship, or if it's set to English — the app simply stays in English.
This is a one-time guess, not a live setting: once you pick a language in
Settings (or restore a workspace backup with a saved language preference),
that choice always wins from then on, even if your browser's language later
changes.

## What gets translated

The full application chrome: the form library, the editor and every
property-panel section, the question palette, choice-list and translations
tooling, the attachments panel, import/export menus and dialogs, the ODK
Central drawers (publish, import, unlock), Settings itself, the help
drawer's own written content (question-type explanations, field help, the
workflow guides), the problems panel's layout and labels, and every toast
and confirmation dialog.

## What stays in English

A few specific things are **not** translated, by design, regardless of
your chosen UI language:

- **Appearance and parameter descriptions** — both in the properties
  panel's parameter tooltips and in the help drawer's own reference
  tables. In those tables, the column headings ("Name", "Description",
  "Support") *are* translated; only the row content describing each
  specific appearance or parameter is English.
- **Validation problem messages** — the text of each item in the Problems
  list and the inline errors shown under a question's fields.
- **XLSForm type tokens** (`select_one`, `geopoint`, …) — shown beside the
  localized name in the help drawer and matched by the palette search in
  every language.

> Question-type **names, short descriptions and palette category
> headings** were originally on this list, but a same-day follow-up
> (user feedback on the shipped pass) localized them via the `types.*`
> catalog namespace — the registry keeps the English source of truth and
> the UI layer translates at render time (`useTypeLabels()`), so the
> core-purity rule is untouched.

These come from the form-definition engine at the core of the app, which
is deliberately kept free of any UI language so its behaviour (and the
exact wording tests and tooling rely on) never varies. If you spot one of
these while working in French or Spanish, that's expected — the control
around it (buttons, labels, section headings) is still in your chosen
language.

## What this does not affect

Choosing a UI language changes how *Form Forge itself* speaks to you. It
has no effect on:

- **The forms you design** — question labels, hints, and choice text are
  translated separately, per form, using the Translations panel. That
  feature is about the forms respondents will fill in; this one is about
  the builder you use to design them.
- **An embedded builder's language**, if a host application embeds Form
  Forge in an iframe — the host sets the language explicitly via its own
  configuration, and that always takes precedence over anything detected
  from the browser.
- **A workspace backup already carrying a language preference** — if you
  restore a `.formforge.zip` workspace backup that was exported with a
  saved UI language, that language is applied on import and becomes your
  device's preference from then on, exactly like manually picking it in
  Settings.

## Manual test scenarios

For the required per-locale `/agent-browser` contextual QA pass (see
`plan.md`). Each scenario should be repeated once for French and once for
Spanish; screenshot and log findings under
`docs/verification/2026-07-16-ui-localization-fr-es/{fr,es}/`.

1. **First load, no stored preference.** With browser language set to the
   target locale (or a regional variant, e.g. `fr-CA`) and no prior visit,
   load the app and confirm it opens directly in that language (Settings
   → UI language shows the matching option selected).
2. **Manual switch + persistence.** From a fresh English session, open
   Settings, switch UI language to the target locale, and confirm every
   visible string on the Settings page itself updates immediately. Reload
   the page and confirm the language stays chosen.
3. **Library.** New-form dialog, template gallery, form cards (menu,
   duplicate/delete/export actions), the empty-library state, storage
   footer hint.
4. **Editor shell.** Header actions, the canvas empty state, drag-and-drop
   hints, undo/redo, autosave indicator.
5. **Palette.** Every question-type group heading, type name and hover
   tooltip renders in the chosen language (localized since the same-day
   follow-up — see "What stays in English" above); the search box matches
   both the localized name and the English name/XLSForm token.
6. **Properties panel — every section** for at least one question of each
   broad kind (text, select, group/repeat, geo, media, calculate): label/
   hint/appearance/parameters fields, required/read-only/relevant/
   constraint rows, the entities "save to" section.
7. **Choices, translations, attachments panels.** Choice-list editor
   (add/rename/delete list, cascading-select linkage), the Translations
   dialog (language add/remove, per-field translation grid), the
   attachments manager (upload, rename, delete, conflict prompts if any).
8. **Import/export.** The export menu (all variants), the import dialog
   and its per-row conflict resolution, the XLSForm/XForm import error
   summaries.
9. **ODK Central.** The editor's Central drawer (destination list, new-
   destination form, publish flow states, check-server), the vault unlock
   dialog, the library's Central import drawer, and CentralServersSection
   in Settings.
10. **Settings page itself, in the target language.** Workspace export/
    import (including the "include saved passwords" warning copy),
    appearance (theme/accent), About section, storage-persistence line.
11. **Help drawer + guides.** Search, the question-type reference list and
    detail view (confirming the mixed-language table cells described
    above), each workflow guide's full text, first-use callouts.
12. **Problems popover + toasts.** Trigger a validation issue and a
    success/error toast (e.g. an export or an import) and confirm the
    popover/toast chrome (counts, buttons, grouping headers) is
    translated while the issue message text itself is the accepted
    English exception.
13. **Layout check throughout.** At each surface above, watch specifically
    for text overflow, truncation, wrapping that breaks alignment, or
    horizontal scroll appearing where it shouldn't — French strings are
    typically the longest of the three locales and are the most likely to
    surface a layout gap. Log every instance found; per the "fix the
    layout by default" posture, these become fix-round tasks, not reasons
    to shorten a translation.
14. **Plural counts.** Specifically re-check every list in "French
    plurals" (`shape.md` Decision 7) at count 0, 1, and a number ≥2 — e.g.
    trigger zero validation problems, one problem, and several problems,
    and confirm French reads "0 erreur" (singular), not "0 erreurs".
