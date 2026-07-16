# Editor toolbar de-clutter — user guide & manual test scenarios

## What changed for the user

The form editor's top toolbar used to be one long row of look-alike icon
buttons, with the four tools that manage a form's actual content — **Form
settings**, **Translations**, **Choice lists**, **Attachments** — hidden
behind an unlabeled **⋮** button. The theme switcher (a device preference,
not something about this form) also lived there, mixed in with everything
else.

- **A labelled "Form" menu now sits next to the form's title**, on the left —
  the same place a document app puts its menus. Click it to reach **Form
  settings**, **Translations**, **Choice lists** and **Attachments** — the
  same four tools as before, just named instead of hidden behind a kebab.
- **The toolbar on the right is now grouped**, with a thin divider between
  each group, left to right:
  - **Undo / redo**
  - **View**: show/hide the question palette (now a clearer palette icon),
    show/hide the live preview
  - **Status**: the Problems button — still the same "Ready"/error-count
    chip, now with a small chevron so it reads as something you can click,
    not just a status light
  - **Output**: Export, and Central
  - Then **Help**
- **The colour-scheme (theme) toggle is gone from the editor.** It's still
  exactly where it always was on the **Form Library** page, and in
  **Settings**, unchanged — it just no longer clutters the per-form editor,
  since it's a device preference, not something about the form you're
  editing.
- **Central now always shows an entry point in the editor**, even before
  you've registered any server. If you haven't set one up yet, the **Central**
  button takes you straight to **Settings → Central servers** to add one,
  instead of being invisible until a server exists somewhere else.

Nothing about what these tools *do* has changed — Form settings, Translations,
Choice lists and Attachments open the exact same dialogs as before; Export
and Central behave exactly as before. This is purely about where things live
and how they're grouped.

## Manual test scenarios

Run against the built app (`pnpm build && pnpm preview`, or the e2e harness on
`:4173`). Log results + screenshots to `docs/verification/`.

### S1 — Form menu replaces the kebab
1. Open any form in the editor. Confirm there is **no** unlabeled **⋮**
   button anywhere in the header.
2. Confirm a **"Form"** button (with a small down-chevron) sits on the left,
   immediately next to the form's title.
3. Click it: a menu opens with exactly four items, in order — **Form
   settings**, **Translations**, **Choice lists**, **Attachments**.
4. Click each in turn (reopening the menu each time); confirm each opens the
   same dialog it always did.

### S2 — Toolbar clusters read as groups
1. At a wide viewport (≥1440px), look at the right-hand side of the header.
   Confirm visually distinct groups, separated by a thin vertical divider:
   undo/redo, then palette + preview, then the Problems chip, then Export +
   Central, then Help.
2. Confirm the palette toggle now shows a clearer "palette" glyph (not the
   previous abstract grid icon).
3. Confirm the Problems chip still reads "Ready" (or an error/warning count)
   exactly as before, but now carries a small chevron hinting it opens
   something when clicked. Click it — the same problems popover opens as
   before.

### S3 — Theme toggle left the editor
1. In the editor, confirm there is **no** colour-scheme toggle anywhere in
   the header.
2. Go **Back to forms** (the Form Library). Confirm the colour-scheme toggle
   is there, in the library header, exactly as before, and still works
   (cycles system → light → dark → system).
3. Open **Settings**; confirm the full appearance controls (scheme, accent)
   are still there too, unchanged.

### S4 — Central zero-state
1. In a fresh browser profile (or after removing every registered Central
   server in Settings), open any form in the editor.
2. Confirm the toolbar's output cluster still shows a **Central** button
   (it does **not** disappear just because no server is registered).
3. Click it: you land on **Settings**, scrolled to the **Central servers**
   section, ready to add one — not a dead end, not a popup.

### S5 — Central with a registered server, unchanged behaviour
1. Register a Central server (Settings → Central servers → Add server).
2. Open a form in the editor; confirm the **Central** button now toggles the
   Central drawer open/closed exactly as it did before this change (icon +
   label, highlights while open).

### S6 — Tablet width ships the same layout
1. Resize (or set the viewport) to a tablet width, e.g. 900×800.
2. Confirm `EditorTabs` (the canvas/properties/preview pane switcher) still
   renders below the header, unchanged.
3. Confirm the header itself — Form menu on the left, clustered actions on
   the right — looks and behaves identically to the wide-viewport layout
   (no folding of the Form menu into the tabs row, no hidden clusters).

### S7 — Embed mode stays clean
1. Load the app embedded (`public/embed-demo.html` or equivalent harness).
2. Confirm: no back-to-library button, no theme toggle (it was never in the
   editor to begin with, post-change), no Central button in **either** state
   (registered server or zero-state) — Central stays fully hidden in embed
   regardless of server count. The Form menu, Export, palette, preview,
   Problems and undo/redo continue to behave as they do outside embed
   (embed only gates Central, theme, and per-kind Export entries — nothing
   about the Form menu is embed-gated).
