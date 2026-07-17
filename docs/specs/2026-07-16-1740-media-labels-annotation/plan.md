# Image/media labels & annotation — spec-first delivery plan

Spec folder: `docs/specs/2026-07-16-1740-media-labels-annotation/`
Execution: dynamic Workflow with parallel agents — **implementation agents on cheaper models** (haiku for mechanical catalog/fixture work, sonnet for standard implementation), orchestration + review at session level. Then full suite + agent-browser verification log + `/code-review` (findings fixed immediately) + conventional commits (no Co-Authored-By trailers).

## Context

ODK supports two image-in-design mechanisms this feature brings to the builder:

- **Label media** — XLSForm `media::image` / `media::big-image` / `media::audio` / `media::video` columns on both the **survey** and **choices** sheets, translatable per language (`media::image::French (fr)`) → XForm itext `<value form="image">jr://images/x.png</value>` (big-image → `form="big-image"`; audio/video → `jr://audio/`, `jr://video/`). Referenced files are required form attachments.
- **Image annotation** — the `image` type with `annotate`/`draw`/`signature` appearances; the annotate widget takes a template image via the **`default` column**. Verified by pyxform-4.5.0 probe: any non-dynamic image-question default is prefixed to `jr://images/<file>` in the primary instance, idempotently, appearance-independent — the file is a required attachment.

**Engine already complete for label media** (verified): `MediaRefs` on nodes + choices (`src/core/model/types.ts:29-34,68,116`), XForm round-trip (`serializer.ts:51-56,122-168`, `parser-itext.ts:25-30,88-111`; golden `translated.xlsx`), XLSForm both sheets ± language (`columns.ts:90-95`, `writer.ts:34-39`, `reader.ts:151-160`), ref-counting/Missing rows/rename (`rename-attachment.ts:32-55,79-125` → AttachmentsDialog), `ref.missing-attachment` validation (`validate/refs.ts:74-105`), preview resolution (`fetchFormAttachment` matches by filename). Registry has `draw`/`annotate`/`signature` + `max-pixels` (`question-types.ts:501-523`).

**Gaps (the feature):**
1. **No authoring UI** — media refs enter only via import; `collectTranslationSites` gates media rows on `hasAnyText` (`translations.ts:272-300`), so nothing creates them.
2. **Annotate default image unwired** — serializer emits `defaultValue` verbatim (`serializer.ts:198-207`; pyxform-parity gap); image defaults invisible to `collectAttachmentReferences`/`renameAttachmentRefs`/`validateRefs` → no ref count, no Missing row, no rename rewrite, no warning.
3. **No golden fixture** for annotate/draw/signature, default image, big-image, audio/video media.

**Shaping decisions (user-confirmed):** all four media kinds in the authoring UI; authoring from question properties **and** per-choice rows; Default becomes an attachment picker for **all** image questions; no visuals — follow existing panel patterns, verify with agent-browser + interface-craft; reference set and standards set confirmed (below); shared-media semantics + new-language pre-fill per the section below; the prerequisite translation-grid work **landed as commit cf4d331** (`docs/specs/2026-07-16-1712-translations-default-language/`) and this plan is reconciled against it; user approved implementation in auto mode via dynamic Workflow (implementation agents on cheaper models — sonnet for standard work, haiku only for mechanical edits).

**Design refinements adopted from detailed planning** (verified against the code): new pure module `src/core/model/defaults.ts` hosting `isDynamicDefault` (moved from serializer with a compat re-export), `JR_IMAGES_PREFIX`, `stripImagePrefix`, `imageDefaultFilename`; parser strip happens in `finalizeQuestion` (`parser.ts:791-849` — instance skeletons are `type:'text'` until then), not at `buildNode`; XLSForm reader strips as post-row normalization (column setters run before type resolution); validator reuses code `ref.missing-attachment` with a NEW message string for default images (existing three messages stay byte-stable); TWO golden fixtures — `annotate` (annotate/draw/signature + defaults + max-pixels, incl. a plain image+default pinning appearance-independence) and `media_labels` (single-language form pinning the untested `lang="default"` itext media path) — regenerated SELECTIVELY (`make-goldens.py annotate media_labels`; full regen churns every .xlsx); UI splits into a dumb `AttachmentPicker.vue` (select-from-attachments + upload + status, parent owns mutation like LocalizedInput) and a `LabelMediaSection` block; BasicSection keeps the plain InputText when a stored default `isDynamicDefault` (legacy escape hatch); upload sanitizes filenames containing `(`/`)` (they'd classify as dynamic — reuse the storedAs rename-notice pattern); scope: image defaults only (audio/video default prefixing unprobed — out of scope); NO migrateDoc migration (idempotent strip-on-read normalizes on touch); write seam is `setSiteText` (`setMediaText` is module-private).

## Shared media across translations (design)

Spec reality (pyxform 4.5.0 probe-verified): XForms itext has **no cross-language fallback for media forms** — each `<translation>` block needs its own `<value form="image">`; an unsuffixed XLSForm `media::image` column lands only in the default language (pyxform warns per missing language) and other languages show no image. The convention is the same filename in every language column. The **file itself is stored once** — every language references the single attachment by name via the same `jr://images/<filename>` URL.

Builder behavior ("people rarely translate images"), **reconciled with commit cf4d331** (default-pseudo-language retirement: Shape A = monolingual, zero languages, text under the `DEFAULT_LANG` sentinel; Shape B = named languages only, `settings.defaultLanguage` always set; first `addLanguage` MOVES sentinel text into that language via `mergeDefaultInto`; subsequent languages start empty):
- **Fan-out at pick time**: the picker writes the same filename to every current language in one undo step — Shape A: single write to `DEFAULT_LANG`; Shape B: one `setSiteText` per named language. The grid shows every cell filled; overriding one language (e.g. a diagram with embedded French text) is a normal grid edit.
- **Replace/clear from the picker** rewrites only languages still holding the old filename — deliberate per-language overrides survive. The filename resulting from the conflict flow (keep-both suffix) fans out identically.
- **Divergence state**: when per-language values differ (Shape B), the picker shows "varies by language" with a pointer to the translations grid instead of a single filename.
- **New-language pre-fill**: first-language add already migrates media for free (`mergeDefaultInto` walks media via `transformLocalizedTexts`). For **subsequent** languages, `addLanguage` (`translations.ts:142-151`) copies each media slot's `settings.defaultLanguage` filename into the new language (text labels still start empty; `removeLanguage`'s last-removal sentinel restore already covers media). Pure-core change + unit spec.
- Serializers are untouched; XLSForm export naturally emits per-language `media::*::<lang>` columns via the existing `putLocalized` path; Shape A emits unsuffixed columns / `lang="default"` itext.

---

## Task 1: Save spec documentation

Create `docs/specs/2026-07-16-1740-media-labels-annotation/` with:

- **plan.md** — copy of this plan IN FULL (do not summarize).
- **shape.md** — Scope: authoring UI for label media (4 kinds, questions + choices) + annotate default-image wiring + goldens. Decisions: the user-confirmed choices above; `defaultValue` modeled as bare filename with `jr://images/` applied at serialize time (pyxform parity, probe-verified); reuse `ref.missing-attachment` (no new issue codes); translations grid gating unchanged (authoring creates rows); shared-media = fan-out at pick time + override-preserving replace/clear + addLanguage pre-fill (see design section — copy it into shape.md). Context: no visuals; product alignment — extends the delivered 2026-07-10-2006 translation-coverage spec (which exposed media rows read-only) and roadmap Phase-1 item 7 (attachments); engine layers already round-trip everything; sequenced after the 2026-07-16-1712 translations-default-language work.
- **standards.md** — CLAUDE.md hard invariants that bind here: pure-TS core (`src/core/` no Vue/Pinia/Dexie/i18n); UI strings via vue-i18n with **en/fr/es lockstep** (vue-tsc gate; glossary in `docs/specs/2026-07-16-1125-ui-localization-fr-es/`); golden policy pinned to pyxform 4.5.0 (regeneration is a deliberate act via `scripts/make-goldens.py`); stylelint undefined-CSS-var guard; preserve `data-testid`s; Issue messages byte-stable; conventional commits. Delivery process: dynamic Workflow (cheaper models for implementation agents), full suite, agent-browser pass logged to `docs/verification/`, `/code-review` five lenses with immediate fixes.
- **references.md** — itemset-file uploader pattern `src/components/properties/TypeConfigSection.vue:170-225` (status/upload/conflict keep-both via `AttachmentConflictDialog` + `firstFreeAttachmentName`); `src/composables/useAttachmentUpload.ts` `attachFile({undoLabel, alsoMutate})` one-undo-step upload+mutate; `LocalizedInput.vue` + `useEditingLanguage` language-aware editing; `TranslationGrid.vue` media rows (`node-media`/`choice-media` site kinds, frozen siteKey testids); `tests/e2e/dataset-tooling.spec.ts` attachments/upload e2e patterns; pyxform probe results (jr://images idempotent prefix on image defaults).
- **user-guide.md** — scenarios: add an image (or audio/video/big-image) to a question label; add image labels to choices (picture-select); translate media per language in the grid; set an annotate template image and resolve the Missing-attachment prompt; rename an attachment and see references follow; export XLSForm/XForm and verify `media::*` columns / itext / `jr://images/` default.
- **visuals/** — omit (none provided).

## Task 2: Core — image default as a first-class attachment reference (+ golden)

Pure TS. Model keeps `defaultValue` a **bare filename**.

1. New `src/core/model/media-default.ts`: `JR_IMAGES_PREFIX = 'jr://images/'`; `imageDefaultFilename(node)` — bare filename for an image-type question's non-empty, non-dynamic default, stripping a leading prefix. Single source of truth for serializer, validator, rename traversal, UI (old persisted docs with prefixed values behave without migration).
2. `src/core/xform/serializer.ts` (`instanceNode` ~:198-207): image-type static default → `JR_IMAGES_PREFIX + bare` (idempotent). Dynamic defaults unchanged.
3. `src/core/xform/parser.ts:436` (staticDefault intake): strip prefix for image-type uploads. Lossless for pyxform output (strip+re-prefix fixed point); hand-authored bare defaults canonicalize on re-serialize (document; matches pyxform).
4. `src/core/xlsform/reader.ts`: strip `jr://images/` in the default column; `writer.ts`: verify bare emission (likely no change).
5. Mirrored traversal (contract doc at `rename-attachment.ts:8-12`): `collectAttachmentReferences` adds the image-default site; `renameAttachmentRefs` rewrites `defaultValue`; `validateRefs` emits existing `ref.missing-attachment` for a default naming a file absent from `doc.attachments`. AttachmentsDialog Missing rows/counts then work with zero UI change.
6. Optional: idempotent bare-ification in `migrateDoc` (`src/core/model/migrate.ts`, no schemaVersion bump).
7. `addLanguage` (`src/core/model/translations.ts`): pre-fill each media slot's default-language filename into the newly added language (text labels stay empty) + unit spec.
8. **Golden fixture** `media_annotate` added to the `FORMS` dict in `scripts/make-goldens.py`: image+annotate+default+max-pixels; image+draw; image+signature; note with `media::audio`+`media::video`; translated `media::image::…`; select_one with choice `media::image`+`media::big-image`. Regen: `uv run --with openpyxl --with pyxform scripts/make-goldens.py media_annotate` (same commit as the serializer fix; parity + round-trip gates auto-discover).
9. Unit specs: rename-attachment (default counted/renamed; non-image + dynamic ignored); validate/refs (missing default warns; present clean); serializer (bare→prefixed, idempotence, non-image untouched); parser (prefixed→bare, byte-identical round-trip, bare canonicalizes); xlsform reader strip / writer bare; addLanguage media pre-fill.

## Task 3: UI — media authoring

Reuse: `useAttachmentUpload.attachFile({alsoMutate})`, `setMediaText` (`translations.ts:321-334`, prunes empty slots), `useEditingLanguage`, `AttachmentConflictDialog` flow, `roleFor` unchanged.

1. New `src/composables/useMediaAttachment.ts`: wraps `attachFile` with `alsoMutate` to set a media slot or `defaultValue` in one undo step; exposes existing-attachment options filtered by kind (`image/*` for image+bigImage, `audio/*`, `video/*`).
2. New `src/components/properties/MediaSlotPicker.vue`: one row per set slot. Owner prop: `{kind:'node'}` | `{kind:'choice'}` | `{kind:'default-image'}` + slot. States: **set** (mono filename + view/replace/clear), **missing** (warning tint + Upload, mirroring `prop-itemset-status[data-state]`), **varies by language** (per-language values diverge → show state + pointer to the translations grid). Actions: "Upload file…" (accept per kind) and "Use existing…" (Select over matching attachments). **Writes fan out to all current languages in one undo step; replace/clear rewrites only languages still holding the old filename** (see shared-media design). Default-image mode unlocalized. Testids: `media-slot-<slot>`, `media-upload-<slot>`, `media-existing-<slot>`, `media-clear-<slot>`, `media-status-<slot>`.
3. `BasicSection.vue`: "Label media" group under Label/Hint — set slots render picker rows; "Add label media" menu (`prop-add-media`) lists unset kinds. Image questions: Default `InputText` → picker in default-image mode (no e2e uses `prop-default` — verified; keep testid on picker root). Groups/repeats get the same group (model supports node media everywhere).
4. `ChoicesSection.vue`: per-choice icon button (`choice-media-<index>`, badge dot when set) opening a Popover with the same add-menu/rows, image first. One extra grid column; defined CSS tokens only (stylelint gate).
5. Translations grid: unchanged (rows appear once authoring creates refs; per-language overrides live there).
6. i18n: new keys in `en/properties.json` (labelMedia, addMedia, mediaKind.*, media actions, defaultImage label/hint = annotate-template guidance, choices tooltip), mirrored into `fr/` + `es/` same commit (glossary terminology). Existing English strings stay byte-stable.
7. Help: extend `help.json` `types.image` (annotate template) + field help for label media/default image (HelpPopover), ×3 locales.
8. Component specs (happy-dom): MediaSlotPicker states + conflict flow; BasicSection add-media + default swap; ChoicesSection popover.

## Task 4: e2e

New `tests/e2e/media-labels.spec.ts` (model on `dataset-tooling.spec.ts`): (a) attach label image via properties → AttachmentsDialog ref count → preview renders it; (b) annotate + default picked before upload → Problems warning + Missing row → upload resolves; (c) choice image → grid `choice-media` row → per-language override; (d) rename attachment rewrites default + media refs; (e) XLSForm export carries `media::image` + `default` columns. Preserve all existing data-testids.

## Task 5: Verification, docs, delivery

1. Full suite: `pnpm test` (incl. new golden gates), `pnpm typecheck` (fr/es lockstep), `pnpm lint`, `pnpm test:e2e`.
2. Agent-browser manual pass (author question/choice media, annotate template, Missing-row resolution, rename, live preview, exports) logged to `docs/verification/`; `/interface-craft` critique of the new picker.
3. `/code-review` (five lenses, no plan mode); fix findings immediately.
4. Update README Features, `docs/product/roadmap.md`, CLAUDE.md (code-map rows for MediaSlotPicker/useMediaAttachment; note image defaults joined the attachment mirror-traversal).
5. Conventional commits per increment: `feat(core)` (Task 2 incl. golden) → `feat(properties)` / `feat(choices)` (Task 3) → `test(e2e)` (Task 4) → `docs` (Task 5). No self-attribution trailers.

## Risks

- **Round-trip losslessness**: strip/prefix fixed point; explicit specs both directions; bare hand-authored defaults canonicalize (documented, pyxform-consistent).
- **Previously imported docs** may persist prefixed defaults — every read site goes through `imageDefaultFilename`; optional migrate normalization.
- **fr/es drift** fails typecheck — keys land in all three locales per commit.
- **Choices row layout** — stylelint CSS-var guard; follow existing grid tokens.
