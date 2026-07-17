# References for Media Labels & Annotation

## Similar implementations (in-repo)

### Itemset-file uploader (the picker template)

- **Location:** `src/components/properties/TypeConfigSection.vue` (~:138–225)
- **Relevance:** the only existing properties-panel file-attach flow.
- **Key patterns:** status line with `data-state` (attached/missing), upload button + hidden input, `AttachmentConflictDialog` Replace/Keep-both/Skip with `firstFreeAttachmentName` suffixing, stored-as rename notice.

### One-undo-step upload + doc mutation

- **Location:** `src/composables/useAttachmentUpload.ts` — `attachFile(file, filenameOverride?, { undoLabel, alsoMutate })`
- **Relevance:** blob → attachments repo → `doc.attachments` rebuild → companion doc field, all in a single undo entry. The media picker and default-image picker write through this.

### Language-aware editing

- **Location:** `src/components/properties/LocalizedInput.vue`, `src/composables/useEditingLanguage.ts`
- **Relevance:** parent-owns-mutation contract, fallback-as-placeholder, language badge; post-cf4d331 named-language semantics (Shape A/Shape B).

### Translation sites & media model

- **Location:** `src/core/model/translations.ts` (`MEDIA_KINDS`, `mediaFilenames`, `collectTranslationSites`, `setSiteText` — the public write seam; `setMediaText` is module-private), `src/components/translations/TranslationGrid.vue` (`node-media`/`choice-media` rows, frozen siteKey testids)
- **Relevance:** the grid already edits existing media refs per language; authoring creates the refs it displays.

### e2e patterns

- **Location:** `tests/e2e/dataset-tooling.spec.ts` (attachments dialog, prop uploads, conflict flow), `tests/e2e/translations.spec.ts` (grid cell selectors)

## External / probe results (pyxform 4.5.0, authoritative for parity)

- `default=template.png` on ANY image question → instance default `jr://images/template.png`; idempotent when already prefixed; appearance-independent. Body: `<upload mediatype="image/*" appearance="annotate">`.
- Choice `media::image` + `media::big-image` → itext `<value form="image">` + `<value form="big-image">`, both under `jr://images/`.
- Unsuffixed `media::image` in a multilingual form lands ONLY in the default-language translation block; pyxform warns per missing language ("Language 'X' is missing the survey image column"). No runtime cross-language fallback → shared images must be duplicated per language (the fan-out design).
- Question-label media in a monolingual form forces itext with `lang="default"` + `default="true()"`.
- Spec docs: XLSForm media columns (xlsform.org), image widgets incl. annotate default-image pattern (docs.getodk.org/form-question-types), `max-pixels` parameter.

## Prerequisite work reconciled against

- Commit `cf4d331` — `docs/specs/2026-07-16-1712-translations-default-language/`: Shape A (monolingual, `DEFAULT_LANG` sentinel) / Shape B (named languages, `settings.defaultLanguage`), `addLanguage` first-language sentinel merge (covers media via `transformLocalizedTexts`), `removeLanguage` last-removal sentinel restore, editing-language pickers named-languages-only.
- Golden `tests/golden/src/translated.xlsx` — pins multilingual question-label + choice-label image itext.
- Golden `tests/golden/src/widgets.xlsx` — pins `max-pixels` → `orx:max-pixels`.
