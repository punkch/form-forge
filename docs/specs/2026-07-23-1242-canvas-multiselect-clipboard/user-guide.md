# User guide & manual-test scenarios — canvas multi-select, clipboard, toolbar, insert-from-template

## What you can do now

### Select several questions at once
- **Ctrl+Click** (⌘+Click on Mac) a card to add it to / remove it from the selection.
- **Shift+Click** selects the range between the last clicked card and this one (visible cards,
  top to bottom).
- **Ctrl+A** selects every top-level question. **Esc** or clicking empty canvas clears the
  selection. A **"N selected"** chip appears in the canvas toolbar with a × to clear.
- Selecting a group selects its whole subtree for operations — you don't need to select the
  children individually.

### Cut, copy, paste, delete the selection
- Use the canvas toolbar buttons or **Ctrl+X / Ctrl+C / Ctrl+V / Delete**.
- Paste lands predictably: into the selected open group (at its end), otherwise right after the
  selection, otherwise at the end of the form. Pasted questions are selected and the first one
  is scrolled into view with a brief flash.
- **Paste works across forms**: cut or copy in one form, open another (even in another browser
  tab), paste there. Names are de-duplicated, choice lists are brought along (reused when
  identical, renamed when conflicting), translations are matched by language; anything dropped
  or adjusted is reported in a toast. Attachment *files* are not copied — referenced filenames
  appear as Missing rows in the Attachments dialog until you upload them.
- Every bulk action is **one undo step** (Ctrl+Z).

### Move the selection together
- **Alt+Arrow Up/Down** moves the whole selection up/down as a block; **Alt+Arrow Right**
  indents it into the group above; **Alt+Arrow Left** outdents it.
- **Drag any selected card** — the rest of the selection follows and gathers after it at the
  drop position, including into a group. One undo step.

### The canvas toolbar
- Left: Undo/Redo (moved here from the top bar), Cut/Copy/Paste/Delete with shortcut tooltips.
- Right: the **gear** opens the form menu (Form settings, Translations, Choice lists,
  Attachments) plus **"Insert from template…"**.
- The form name in the top bar is now just a title.

### Insert from template
- Gear → "Insert from template…" → pick a starter or one of your saved templates. Its questions
  are appended to the end of the open form as ordinary editable questions (ids and names are
  made unique). One click, one undo step.

### Learn it in-app
- Help drawer → new **"Working in the canvas"** guide; the **Keyboard** and **Templates** guides
  are extended. A one-time callout on the canvas points to the new guide (dismissable).

## Manual-test scenarios (agent-browser pass)

1. **Multi-select visuals**: build a 5-question form; Ctrl+Click 2, Shift+Click a range; verify
   selected styling on all cards in light AND dark theme; chip shows count; × clears.
2. **Toolbar states**: with nothing selected, cut/copy/delete disabled; empty buffer → paste
   disabled with "Nothing to paste" tooltip; select → enabled with shortcut tooltips.
3. **Cut/paste same form**: ctrl-click two non-adjacent questions → Ctrl+X → select a group →
   Ctrl+V → both land inside the group in document order; ONE Ctrl+Z restores everything.
4. **Cross-form paste**: copy in form A, back to library, open form B, paste — questions land at
   end; names deduped; choice list reused/renamed per policy; toast reports dropped languages
   when B lacks A's languages.
5. **Cross-tab paste**: two tabs; copy in tab 1 → paste button in tab 2 enables (storage event)
   → paste works.
6. **Multi-drag**: ctrl-click 3 → drag one into a group → all 3 gather there in order; followers
   FLIP-animate; ONE undo restores.
7. **Alt+Arrows**: multi-selection moves as a block; edge cases: at top, Alt+Up does nothing (no
   undo entry).
8. **Insert from template**: gear → Insert from template → pick starter → appended + revealed;
   Ctrl+Z removes all inserted nodes at once. Local template + empty-gallery state.
9. **Embed demo** (`public/embed-demo.html`): copy/paste still works via memory buffer
   (partitioned storage degrades silently).
10. **Guides**: new canvas guide listed/searchable; keyboard + templates guides show new steps;
    callout appears once on canvas, dismiss persists; repeat in French and Spanish (Settings →
    Interface language).
11. **Reduced motion**: OS setting on → no flash/FLIP animation jank; behavior intact.
12. **Regression**: form menu flows (settings/translations/choice lists/attachments) from the
    gear; single-click select + properties panel; single-node drag; palette add unchanged.
