# Template & backup UX polish — manual verification (agent-browser)

Date: 2026-07-20 · Build: `pnpm build` @ 15:19 (post-implementation), preview on :4173
Spec: `docs/specs/2026-07-20-1434-template-backup-ux-polish/`

> Process note: an earlier full e2e run silently reused a **stale** preview
> server (Playwright `reuseExistingServer`) — the server was killed, the app
> rebuilt, and every check below (and the final e2e run) ran against the fresh
> build.

## Checks

| # | Item | Check | Result |
| --- | --- | --- | --- |
| 1 | Save-toast hint | "Site visit — find it under New form." | ✅ |
| 2 | Collision: stable footer | "Save template" stays mounted + disabled; hint "This name is already taken — choose Replace or Save a copy below."; panel shows Save a copy / Replace | ✅ (`01-collision-stable-footer.png`) |
| 3 | Enter cue while colliding | Enter persists nothing (0 toasts) and fires `.attention-flash` on the collision panel | ✅ |
| 4 | Save-a-copy auto-suffix | Second save under "Site visit" stores "Site visit (2)" (toast + gallery) | ✅ |
| 5 | Tooltips on icon actions | Hovering the edit pencil shows a `.p-tooltip` (aria-label text) | ✅ (`02-tooltip-on-edit-icon.png`) |
| 6 | Edit-dialog content hint + textarea | Hint "Editing changes the name and description only…" renders; description is a 2-row textarea | ✅ (`03-edit-dialog-hint-textarea.png`) |
| 7 | Settings export summary | "This backup will include 1 form · 2 templates · app preferences." under Export workspace | ✅ (`04-settings-export-summary.png`) |
| 8 | Backup round-trip dedupe | Real download → re-import of the same archive: ONE combined toast "1 form imported · 2 already present", no second templates toast, gallery still exactly 2 local templates | ✅ (`05-import-preview.png`, `06-dedupe-combined-toast.png`) |

## Notes

- The archive itself was inspected: `templates.json` present alongside
  `preferences.json` and the `central/` section.
- Forms still duplicate on re-import **by design** (with the existing
  `duplicate-form-id` warning); only templates dedupe — matching the spec.
- Automated gates on the fresh build: `pnpm typecheck` ✅, `pnpm lint` ✅
  (after one eslint --fix line-wrap pass on workspace-io.ts),
  `pnpm test` 1496/1496 ✅, full `pnpm test:e2e` re-run — see commit notes.
