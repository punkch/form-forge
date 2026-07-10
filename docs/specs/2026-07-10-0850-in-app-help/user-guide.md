# In-App Help System — Manual Verification

Run `pnpm dev` and open the app.

| # | Steps | Expected |
|---|---|---|
| 1 | Create a form, click the "?" button at the right of the header | The "Question type reference" dialog opens on a searchable, category-grouped list of all question types; footer credits the ODK Documentation with a link to docs.getodk.org |
| 2 | Type `select` into the search box | Only matching types remain (Select one/multiple, from-file variants…); groups with no matches disappear; nonsense input shows "No question types match your search." |
| 3 | Click **Select one** | The dialog swaps to the type's help inline: what it does, "In XLSForm" notes, an appearances table (`minimal`, `likert`, … with Collect/Enketo badges), a parameters table (`randomize`, `seed`), and a "Read more in the ODK docs" link |
| 4 | Click the read-more link | A new tab opens on `docs.getodk.org/form-question-types/#single-select-widget` (exact section, not the page top) |
| 5 | Click "All question types", then Esc | Back returns to the list; Esc closes the dialog. Reopening starts fresh on the list |
| 6 | Hover a palette row (e.g. Range) and click the "?" that appears | A right-side drawer opens: category-colored icon, title, `range` token chip, behavior text, appearances with "combines with …" notes, parameters with required markers and defaults |
| 7 | Add an Integer question, click the "?" in the property-panel header | The same drawer opens for Integer (counter appearance, Collect-only badge) |
| 8 | Turn off the network (offline) and repeat steps 1–3 and 6 | Everything renders identically — content is bundled; only the external read-more link needs a network |
| 9 | Keyboard only: Tab to the header "?", Enter, type a search, Tab to an entry, Enter, Tab to "All question types" | The whole reference is operable without a mouse; focus is visible on list entries |
| 10 | (Component-level, no UI yet) `HelpPopover` with `field="relevant"` | Renders a "?" trigger; clicking shows what the field does plus "XLSForm column `relevant`" — property sections adopt it in the follow-up |
