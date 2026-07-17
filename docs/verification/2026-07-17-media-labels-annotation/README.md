# Manual verification — media labels & annotation (2026-07-17)

Agent-browser pass against the production build (`pnpm build` + `pnpm preview` on :4173),
Chromium via CDP. Feature spec: `docs/specs/2026-07-16-1740-media-labels-annotation/`.

## Scenarios verified

1. **Default-image picker on image questions** — a blank form + Image question shows the
   Default field as an attachment picker (Select + Upload) instead of a text input, with the
   template-image hint ("This is the template image shown before annotating, drawing, or
   signing."). Uploading `sitemap.png` flips the status line to
   "sitemap.png is attached". → `01-default-image-attached.png`
2. **Add label media menu** — the Basics section's "Add label media" button opens the
   four-kind menu (Image / Big image / Audio / Video). → `02-add-media-menu.png`
3. **Label media upload** — adding an Image slot and uploading `label-pic.png` shows the
   attached row (`prop-media-image-status` = "label-pic.png is attached").
   → `03-label-media-attached.png`
4. **Live preview renders both** — the web-forms preview shows the label image on the
   question AND the template image as the annotate widget's current value (two blob-URL
   images resolved via `fetchFormAttachment`). → `04-preview-renders-label-and-template.png`
5. **Choice media popover** — a Select-one question's choice rows carry `choice-media-<i>`
   buttons; the popover offers all four kinds; uploading `choice-red.png` to the first
   choice shows "choice-red.png is attached". → `05-choice-media-popover.png`,
   `06-choice-image-attached.png`
6. **Attachments dialog counts image defaults** — three attachments each show
   "Used by 1 question" (label media, choice media AND the annotate default all counted by
   `collectAttachmentReferences`). → `07-attachments-ref-counts.png`
7. **Missing-row + Problems warning** — deleting `sitemap.png` produces a Missing row in the
   dialog and the Problems panel shows the new validator message
   `Default image "sitemap.png" is referenced but has not been uploaded.`
   → `08-missing-default-image-row.png`, `09-problems-default-image-warning.png`
8. **First-language media move** — adding French (fr) as the first named language moves the
   sentinel media values into it: the grid's `node-media`/`choice-media` rows show
   `label-pic.png` / `choice-red.png` in the French column. → `10-grid-media-rows-french.png`
9. **Missing state on the picker** — with the file deleted, the default-image picker shows
   the warning status ("sitemap.png has not been uploaded yet", `data-state=missing`).
   → `11-default-image-missing-state.png`
10. **Non-image default unchanged** — the Select-one question still renders the plain
    `prop-default` text input (incidentally exercised during the pass).

## Code review (five lenses, findings fixed in-tree)

Five parallel review agents (reuse / quality / efficiency / correctness / style+tests) ran
over the full diff after the browser pass. All findings were fixed before commit:

- **Correctness**: the choice-media popover targeted its choice by position and survived
  list mutations — structural edits now close it and `@hide` clears the index (plus the
  index-keyed activated-slots map); `uploadMediaRef` read the slot's old state before the
  upload's async gap — it now re-reads inside the mutate callback, so a concurrent write
  can't be silently dropped.
- **Efficiency**: the serializer's per-list itext verdict is computed once per pass
  (`Ctx.mediaLists`) instead of rescanned at every use site; the choice rows' media flags
  are memoized in one computed.
- **Reuse/quality**: `attachedFilenames`, `kindLabel`, the slot-visibility trio and the
  picker-row builder (`MediaPickerRow`) were deduplicated into `useMediaAttachment`;
  site-ref builders use the exported `TranslationSiteRef` type; `ref`-shadowing
  identifiers renamed.
- **i18n**: fr media keys aligned on *libellé* (was *étiquette*, inconsistent with the
  rest of the catalog).
- **Tests added**: the upload conflict flow (replace / keep-both / skip), filename
  sanitizing, varying-slot clear/upload semantics, override-preserving replace,
  serializer two-lists itext split, addLanguage pre-fill no-clobber guard.

## Automated gates at time of pass

- `pnpm vitest run` — 1366/1366 after review fixes (unit + component + golden
  parity/round-trip, incl. the new `annotate` + `media_labels` fixtures)
- `pnpm typecheck`, `pnpm lint` — clean
- `pnpm test:e2e` — 119 passed, 1 skipped (media-labels spec stress-tested 4× green;
  two isolated one-off firefox flakes in unrelated runs each passed 3× in isolation)
