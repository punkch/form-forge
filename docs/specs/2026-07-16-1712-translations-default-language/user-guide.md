# User guide — languages without the "Default" column

## How authoring languages works now

**Start monolingual.** A new form has no languages. Everything you type —
labels, hints, choice labels, messages — is simply the form's text. The
Translations dialog shows it in a single **Text** column, so you can still
bulk-edit everything in one place before deciding on languages.

**Add your first language.** In Translations → Add language, enter a name and
code (e.g. *French* / *fr*). The moment you add it, all of the form's existing
text becomes **French (fr)** text, and French (fr) becomes the form's **default
language** (the language a device shows first). Nothing is retyped, nothing is
lost — and Undo reverses the whole step. The Text column disappears; the grid
now has one column per language, exactly matching what ODK Collect, Enketo and
Web Forms will show in their language menus.

**Translate.** Add more languages and fill their columns. ODK has no fallback
language: a cell left empty stays empty on the device, so the per-language
counters (e.g. `20/36`) and the "Show untranslated only" toggle help you reach
completeness. The **Default language** picker chooses which language a device
opens with; it always names one of your languages.

**Editing language.** The editor's language control (properties panel and
Translations → "Show in editor") now offers only your named languages. When
nothing is selected it follows the form's default language — there is no
separate "Default" pseudo-language to edit anymore.

**Removing languages.** Removing a language deletes its text (with a
confirmation). Removing your *last* language returns its text to the plain
Text column, so a form never loses its content by going back to monolingual.

## Imported and older forms

Forms made elsewhere (or saved before this change) can mix untranslated text
with named languages. On open or import, Form Forge merges that automatically:
untranslated text fills the default language's empty cells and disappears.

If a string has *different* text in both places, nothing is thrown away: the
grid shows an **Unassigned** column holding the leftover text, and the
Problems panel warns (*"…has text not assigned to any language"*). Copy what
you want to keep into a language column and clear the Unassigned cell; the
column vanishes when the last leftover is resolved.

An XForm that genuinely declares `default` as a language (some pyxform output
does) is kept as a language literally named "default" — the same way ODK
Collect would list it.

## Why this changed

The old Default column had no counterpart in exports: with named languages,
XLSForm/XForm output only carries named languages, clients never show a
"default" fallback (a missing translation is blank or "-"), and mixing bare +
named columns is the most-warned-against multi-language mistake in the ODK
ecosystem. The builder now always produces the two clean shapes the tools
expect.

## Manual test scenarios

1. **New form** → Translations: single *Text* column; type a label there; it
   appears on the canvas.
2. **First language**: add French (fr) → text moves to the French column, Text
   column gone, Default language reads French (fr), properties panel editing
   language reads French (fr) with no translation badge; canvas unchanged.
   Undo → Text column and content return.
3. **Second language**: add Spanish (es) → French text shows as placeholder
   while editing Spanish; badge appears on Spanish edits; completeness counts
   correct; preview language menu lists exactly French + Spanish.
4. **Mixed import**: import an XLSForm with a bare `label` column AND
   `label::French (fr)`, including one row where both differ → Unassigned
   column + problems warning appear; clean rows merged silently. Clear the
   conflicting Unassigned cell → column and warning disappear.
5. **Remove last language**: with only French left, remove it (note the
   "text becomes the form's untranslated text" warning) → single Text column
   returns with the French content.
6. **Exports**: bilingual form → XLSForm export has `label::French (fr)` /
   `label::Spanish (es)` but no bare `label` column; XForm export has
   `<translation lang="French (fr)" default="true()">`.
7. **Zero-language export**: monolingual form exports inline labels exactly
   as before.
