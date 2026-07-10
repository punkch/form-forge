# User Guide — App Settings

App Settings is where builder-wide preferences and whole-library actions live. It
is reached from the **gear** on the top-right of the Forms library, next to
*Import form* and *New form*. It replaces the old ⋯ menu.

## Opening settings

1. On the **Forms** library screen, click the **gear** icon (top-right).
2. The **Settings** page opens. Click **Back to forms** (top-left) to return.

## Workspace — backup and restore

Everything is stored in your browser only, so backups are how you move a whole
library between machines or guard against the browser clearing storage.

- **Export workspace** downloads a single `formforge-workspace-<date>.formforge.zip`
  containing every form and its attachments. (Disabled when the library is empty.)
- **Import workspace** opens a picker: drop or choose a `.formforge.zip`, review
  the parse report (forms found, any problems), then **Import**. Import never
  overwrites — every form comes in as a new copy; a form ID already in your
  library is imported anyway with a warning.

You can still export a **single** form (not the whole workspace) from that form's
⋯ menu on its library card ("Export archive"), and the library footer still
offers a one-click backup link when storage isn't persistent — those didn't move.

## Language

- The **Language** picker sets the language of the **builder interface** itself.
  It is separate from the *form translations* you manage inside a form.
- Today only **English** is available, so the picker shows one option. When more
  UI languages ship they appear here by their native name.
- Your choice is remembered on this device and reapplied next time you open the
  app (including text direction for right-to-left languages when those arrive).

## About

- **Version** — the app build you're running.
- **Storage** — whether the browser has granted *persistent* storage (your forms
  are protected from being cleared under storage pressure), *not* granted, or the
  status is unavailable in this browser.

## Embedded mode

When Form Forge is embedded in another application, there is no gear and the
Settings page is unavailable — the host application owns these concerns.

---

## Manual test scenarios (for the verification pass)

1. **Gear → settings → back.** Library gear opens `#/settings` (`settings-view`
   visible); *Back to forms* returns to the library.
2. **Export.** With ≥1 form, *Export workspace* downloads
   `formforge-workspace-<yyyy-mm-dd>.formforge.zip`. With 0 forms, the button is
   disabled.
3. **Round-trip.** Export → wipe IndexedDB → reload (library empty) → settings →
   *Import workspace* → choose the file → report shows the forms and "No problems
   found" → **Import** → forms and attachments are back.
4. **Language persistence.** (With a second catalog available) switch language,
   reload, and confirm the choice stuck and `<html lang>` matches.
5. **About.** Version line shows the build version; storage line reflects the
   grant state.
6. **Embed.** In the embed demo host, there is no gear and navigating the frame
   to `#/settings` lands on the waiting screen, not a settings page.
