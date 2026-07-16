# Retire the "Default" language column — Shaping Notes

## Scope

Remove the "Default" pseudo-language from the authoring surfaces and make
builder-authored documents always one of two clean shapes:

- **Shape A (zero languages):** all text under the `DEFAULT_LANG` (`'default'`)
  sentinel key; serialized inline. The Translations grid shows a single
  editable "Text" column.
- **Shape B (≥1 language):** all text under named language keys, no sentinel
  content, `settings.defaultLanguage` always one of `doc.languages`. The grid
  shows only named-language columns; the editing-language pickers offer only
  named languages.

Adding the first language silently MOVES all sentinel content into it and
makes it the form's default language (undo-able). Mixed documents (imports,
legacy saves) auto-merge at every load/import boundary; unresolvable conflicts
stay visible (grid "Unassigned" column + `i18n.unassigned-text` warning) until
the user clears them.

Also in scope: delete the fully-delivered `docs/specs/backlog/` folder,
migrating the three follow-ups that lived only in its README into the roadmap.

## Decisions

1. **Zero-language grid**: keep ONE editable column for the form's text (bulk
   editing stays possible before any language exists).
2. **Conversion**: silent + automatic on first-language add; content moves;
   that language becomes `settings.defaultLanguage`; no prompt; normal undo.
3. **Mixed docs**: auto-merge on load — sentinel text fills the primary
   language's empty cells then clears; on conflict the named language wins for
   display but the sentinel cell stays visible until resolved. Import stays
   silent; the validator + grid surface leftovers.
4. **Backlog**: delete the whole folder (git history is provenance); recreate
   when a new proposal appears.

Accepted consequences:

- Multilingual XLSForm exports no longer emit bare `label`/`hint` columns
  (ecosystem-correct; downstream tooling reading bare columns will find them
  absent).
- The Default-language select loses its clear "×" — Shape B always has a
  default.
- Removing the only language keeps unresolved Unassigned text and drops the
  removed language's value in those conflict cells (never silently overwrite;
  undo recovers).

Non-goals / explicitly unchanged:

- Serializer, parser, XLSForm reader/writer are byte-for-byte untouched;
  normalization is model-level only (goldens stay pinned to pyxform 4.5.0).
- A third-party XForm with a literal `<translation lang="default">` keeps
  `'default'` as a named language (matches client behavior); no rename-language
  feature in this spec.

## Context

- **Visuals:** three screenshots (see `visuals/README.md`) — the redundant
  Default grid column, the blank/Default/named editing-language dropdown, and
  the preview's named-languages-only picker.
- **References:** see `references.md` — full codebase map + ODK ecosystem
  research (XLSForm docs, XForms spec, pyxform source/issues, Kobo, ODK Build).
- **Product alignment:** Phase 3 backlog burn-down; deepens the
  "pyxform-parity, ecosystem-correct engine" mission. Roadmap updated in the
  same change.

## Why (research summary)

Every layer of the ODK stack treats bare+named mixing as a bug: pyxform makes
a language literally named "default" and pads all gaps with `"-"` (disabling
any fallback); XLSForm docs say the bare column "will be treated as if it were
a separate language" and recommend fully-tagged columns; clients have no
fallback language (missing string = blank/dash; `default_language` only picks
the pre-selected language); Kobo's model is "define the default language first
— existing text belongs to it"; ODK Build's unnamed default caused Central
rejections. pyxform 4.5.0 golden output (`tests/golden/expected/translated.xml`)
contains only named `<translation>` blocks with `default="true()"` on the
default one — the "Default" column had no representation in exports.
