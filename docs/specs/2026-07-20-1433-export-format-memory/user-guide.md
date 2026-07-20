# Export Format Memory — User Guide & Manual Test Scenarios

## What changed

The editor's **Export** button now remembers the last format you exported for
each form and uses it as the default next time you open that form.

- The main button states the format it will produce: **Export · XForm**,
  **Export · XLSForm**, **Export · ZIP (XForm)**, or **Export · ZIP (XLSForm)**.
- The dropdown (the chevron) lists **every** available format, with a check mark
  next to the one the main button will use. The readiness summary ("Ready · no
  warnings", or how many problems block export) still sits at the top.
- Choosing a format from the dropdown exports it **and** makes it the new
  default for that form — the main button updates (with a subtle label fade) to
  the format you picked.

Memory is stored on your device (in the browser) and is per form. It is
included in **Settings → Export workspace** and restored by **Import
workspace**, so your remembered formats travel with your backup.

## Manual test scenarios

1. **Default with no history.** Create or open a form you've never exported.
   The main button reads **Export · XForm**. The dropdown shows all four formats
   with the check next to XForm XML.

2. **Remember a dropdown choice.** Open the dropdown, pick **XLSForm (.xlsx)**.
   The `.xlsx` downloads. The main button now reads **Export · XLSForm** and the
   dropdown's check has moved to the XLSForm row.

3. **Persistence across reloads.** After scenario 2, reload the page and reopen
   the same form. The main button still reads **Export · XLSForm**.

4. **Per-form independence.** Set form A to XLSForm (scenario 2). Open a
   different form B — its main button is still **Export · XForm** (its own
   memory, untouched by A).

5. **Primary click uses the remembered format.** With form A on
   **Export · XLSForm**, click the main button (not the dropdown). It exports
   the `.xlsx` directly.

6. **Deleting a form clears its memory.** Delete a form you'd set to a non-XForm
   format, then recreate/import a form and confirm nothing stale carries over
   (no user-visible artifact — this guards against leaked map entries).

7. **Errors still block export.** With a form that has validation errors, the
   dropdown's summary reads "N problems block export" and choosing any format
   shows the "Fix errors before exporting" toast without downloading — but the
   format you picked is still remembered for next time.

8. **Workspace backup round-trip.** Set a couple of forms to different formats,
   **Settings → Export workspace**, then **Import workspace** into a fresh
   browser profile. Each form's remembered format is restored.

9. **Embed host disabled the remembered format.** In an embed host that
   disables (say) XLSForm after a form was remembered as XLSForm, the main
   button falls back to the first still-available format (XForm), and the
   dropdown lists only the enabled formats.

10. **French / Spanish.** Switch the interface language to Français, then
    Español. The main button reads **Exporter · …** / **Exportar · …**. Confirm
    the editor header does not overflow or clip the longer labels (especially
    **Exporter · ZIP (XForm)**).

11. **Reduced motion.** With OS "reduce motion" on, switching formats updates
    the label with no visible fade (the global reduced-motion rule neutralises
    the animation).
