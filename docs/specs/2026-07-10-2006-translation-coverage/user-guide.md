# User Guide — Full translation coverage & per-language editing

## What changed

Form Forge now lets you translate **everything ODK supports**, and makes the
"which language am I editing?" question impossible to get wrong.

### The translation grid is complete

Open **Translations** (editor tools menu). Once you add a language, every
question and group shows editable **Label** and **Hint** rows — even before you
type anything, so you can enter a French hint without first inventing a default
one (ODK has no fallback language; a language-only value is valid).

Additional rows appear where they apply:
- **Constraint message** — whenever the question has a constraint.
- **Required message** — whenever the question is required.
- **Image / Audio / Video / Big image** — wherever the form already references a
  media file for that question or choice. Media cells are the **filename** of an
  attachment (for example `sign.png`), matching the file you uploaded under
  Attachments.
- **Guidance hint** — hidden by default to keep the grid focused. Turn on
  **"Show rarely-used fields"** (grid toolbar) to translate it.

The per-language completeness counter (`translated / total`) in each language
column now counts this fuller set, so it reflects real coverage.

### Editing one language at a time, everywhere

The properties panel now has a compact **editing-language** control (appears
once your form has at least one language), tied to the same setting as the
dialog's "Show in editor". Pick a language there and:
- Every localized input — **Label, Hint, Guidance hint, Constraint message,
  Required message, and choice Labels** — writes that language.
- Each input carries a small **language badge** so you always see which language
  you're typing into.
- If the selected language is empty for a field, the input shows the fallback
  text as a **placeholder** (greyed) rather than as editable text — so what you
  type is unambiguously the selected language, and you never accidentally
  overwrite the default with a copy of itself.

Clearing an input removes **only** the selected language's value; the default
(and other languages) stay intact.

Choice labels, constraint messages, and required messages used to always write
the default language regardless of the selector — that inconsistency is fixed.

## Manual test scenarios

Run against the built app (`pnpm build && pnpm preview`) or `pnpm dev`.

### 1. Empty rows are editable (no default required)
1. New form, add a **text** question, give it a label.
2. Translations → add language **French / fr**.
3. In the grid, confirm a **Hint** row exists for the question even though it
   has no hint yet. Type a French hint, leave the default hint empty.
4. Export XLSForm, re-import it. The French hint is still there (default hint
   still empty). ✅ *French-only hint round-trips.*

### 2. Constraint message from the grid
1. Add an **integer** question; in the Logic section set a constraint
   (e.g. `. >= 0`). Do not set a message.
2. Translations → confirm an editable **Constraint message** row appears for it.
   Fill a default and a French value. ✅

### 3. Required message + guidance hint
1. Mark a question **required**. Confirm a **Required message** row appears.
2. Toggle **"Show rarely-used fields"**; confirm **Guidance hint** rows appear
   and the completeness denominator grows; toggle off and they disappear. ✅

### 4. Media translation round-trips byte-stable
1. Import an XLSForm that has an `image::French (fr)` column (or add an image
   ref and a French image via the grid once a ref exists).
2. Confirm an **Image** row shows in the grid with the French filename.
3. Export XLSForm and diff the `image::French (fr)` column against the import —
   unchanged. ✅ *image::French (fr) re-exports byte-stable.*

### 5. Panel editing-language is unmistakable
1. With **French (fr)** selected in the panel editing-language control:
   - The control and each localized input show French.
   - A field with no French value shows the default as a **placeholder**, and
     the input is empty.
2. Type a **constraint message** — confirm (via export or the grid) it wrote the
   **French** key, not the default. ✅
3. Clear a French input — confirm the default value remains (only French
   removed). ✅

### 6. Monolingual forms are unchanged
1. A form with no added languages shows **no** editing-language control and the
   panel behaves exactly as before (everything writes the default). ✅

### 7. Nothing else moved
1. Add/remove language, migration into the first language, and the existing
   "Show untranslated only" filter all still work.
2. Export a multi-language form and confirm the XForm itext and XLSForm columns
   are unchanged from before this feature (golden gates green). ✅
