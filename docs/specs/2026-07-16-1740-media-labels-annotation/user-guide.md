# Media Labels & Annotation — User Guide

## Add an image (or audio/video) to a question label

1. Select the question (or group/repeat) on the canvas.
2. In the properties panel, under the label, open **Add label media** and pick a kind — Image, Big image (a zoomable full-resolution variant), Audio, or Video.
3. Upload a file or choose one already attached to the form. The file is stored once as a form attachment; the label shows it in every language.
4. The live preview renders the media with the question label immediately.

## Add image labels to choices (picture select)

1. Select the select question and open its **Choices** section.
2. Click the media button on a choice row and attach an image (other kinds are available too).
3. Repeat per choice. Combined with select appearances, this gives image-choice ("picture select") questions.

## Translate media per language

Media is shared across languages by default — picking a file fills every language with the same filename. To show a different file in one language (e.g. a diagram with embedded French text):

1. Open **Form → Translations**.
2. Find the question/choice's Image (or Audio/Video/Big image) row and edit the filename in that language's column.
3. Upload the language-specific file via **Form → Attachments** if it isn't attached yet.

When languages diverge, the properties-panel picker shows "varies by language" and points you to the grid. Adding a new language pre-fills media from the default language, so images keep showing without extra work.

## Annotate a template image

1. Add an **Image** question and set its appearance to **Annotate**.
2. In **Default**, pick or upload the template image (e.g. a body diagram or site map). Enumerators draw on top of it during data collection.
3. If you pick a filename before uploading the file, the Problems panel warns and **Form → Attachments** shows a *Missing* row — upload there to resolve it.

The template also works with the plain image widget; Draw and Signature appearances give a blank sketch pad / signature pad instead.

## Renames and exports

- Renaming an attachment (Form → Attachments → Rename) rewrites every reference: label media in all languages, choice media, and annotate template defaults.
- **XLSForm export** writes `media::image`/`media::big-image`/`media::audio`/`media::video` columns (per language in multilingual forms) and the bare filename in the `default` column.
- **XForm/ZIP export** writes itext `<value form="image">jr://images/…</value>` entries and `jr://images/…` instance defaults, with media files under `media/` in the ZIP — ready for ODK Central.

## Manual test scenarios

1. Question label image: attach → preview shows it → attachments dialog ref-count 1 → delete file → Problems warning + Missing row → re-upload → clean.
2. Choice images: attach to two choices → picture-select renders in preview → grid shows per-choice Image rows.
3. Annotate: image + annotate + default template → export XLSForm → re-import → default preserved bare; XForm export carries `jr://images/` default.
4. Multilingual: add French to an English form → media pre-filled → override one language's image in the grid → picker shows "varies by language".
5. Rename `diagram.png` → `site-diagram.png` → all references (label media, choice media, default) follow; export confirms.
