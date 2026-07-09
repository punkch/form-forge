# Preview Stale-Form Fix — Manual Verification

Run `pnpm dev` and open the app.

| # | Steps | Expected |
|---|---|---|
| 1 | Create form "Alpha", add a Text question labelled "Alpha question", open the preview pane | Preview renders "Alpha Form" with "Alpha question" |
| 2 | Click the back arrow to the library, create a new blank form "Beta" | Preview pane shows the empty state "The preview appears once the form has questions." — never Alpha's questions, no warning banner |
| 3 | Add a Text question "Beta question" to Beta | Within ~1s the preview renders Beta's form with "Beta question"; "Alpha question" never appears |
| 4 | Back to library, reopen "Alpha" | Preview renders Alpha again correctly and live-updates on edits (watchers survive the round trip) |
| 5 | In Alpha, break a constraint (e.g. `count(. > 1`) | Stale banner over the last good preview (unchanged single-form behavior) |
| 6 | While broken, go to library and open Beta | No stale banner, no Alpha content — Beta's own preview/empty state |
| 7 | Delete every question of a form with a rendered preview | Paused banner "the form has no questions yet" over the last good preview |
| 8 | Create a brand-new form and open the preview pane immediately | Only the friendly empty state; no error, no engine mount, no banner |
