# CLAUDE.md — repository index

**Form Forge for ODK** — client-side-only Vue 3.5 SPA: a visual builder for ODK forms with a native
TypeScript XLSForm/XForm engine and a live `@getodk/web-forms` preview.
**No backend, no telemetry — everything stays in the browser.** Ships as
static files (GitHub Pages), installable as an offline PWA, embeddable in an
iframe via a postMessage API.

> **Keep this file up to date.** Whenever a feature is delivered, a module
> is added/moved, a convention changes, or a pin is bumped: update this
> index, the README Features section (✅/⬜), and `docs/product/roadmap.md`
> in the same change. This file is the entry point for future AI sessions —
> stale entries cost more than missing ones.

## Commands

```bash
pnpm dev / build / preview          # vite; BASE_PATH=/repo/ for sub-path builds
pnpm test                           # vitest: unit (node) + component (happy-dom)
pnpm test:e2e                       # playwright chromium+firefox vs built app on :4173
pnpm lint / typecheck               # eslint (neostandard + i18n rules) + stylelint (undefined-CSS-var guard) / vue-tsc
pnpm test:coverage                  # enforces floors: core 86/78/88, stores 80/85, persistence 90/92
uv run --with openpyxl --with pyxform scripts/make-goldens.py [fixture…]   # regen goldens (deliberate act)
pnpm exec tsx scripts/make-templates.ts                                    # regen bundled starter templates
pnpm generate:theme                                                        # regen committed theme CSS (deliberate; drift-gated)
```

## Hard invariants

- **`src/core/` is pure TS** — no Vue/Pinia/Dexie/vue-i18n imports, ever.
  Core emits `Issue`s with stable `code` strings (factories in
  `src/core/validate/issues.ts`). The English `message` is rendered
  verbatim in the UI (ProblemsButton, inline field errors); codes are used
  for filtering/grouping, not localization. e2e tests assert message
  substrings — don't reword existing messages casually.
- **Persistence goes through the backend seam** (`src/persistence/backend.ts`).
  Repos keep identical signatures across the Dexie default and the embed
  memory backend; specs run on both via `tests/helpers/backends.ts`.
- **The whole-workspace backup must round-trip the entire data model** — the
  workspace archive (`src/core/workspace/archive.ts` +
  `src/persistence/workspace-io.ts`, Settings → Export/Import workspace) is the
  user's complete backup/restore. **When you add or change a persisted Dexie
  table or field, extend the backup to carry it and bump
  `WORKSPACE_FORMAT_VERSION` in lockstep** (with a reader that still accepts the
  prior version) — a table left out silently loses that data on restore. Bump
  only when an older reader would *misread* the archive; a purely additive
  optional section (read best-effort, absent = handled) rides the current version
  instead, because the reader hard-rejects any archive **newer** than it supports
  — so a needless bump makes a slightly-stale app refuse an entire backup over a
  section it could have safely ignored. Persisted tables NOT carried, on purpose:
  **snapshots** (per-form undo/version history — ephemeral, auto-pruned working
  state, not authored content).
  **Delivered (format v2, 2026-07-15):** the whole-workspace backup now carries
  the Central section — server *config* (name/URL/email) + publish targets are
  written **always**; the credential vault + each server's `encryptedPassword`
  are **opt-in on export** (unchecked "Include saved Central passwords" box, gated
  on the vault being unlocked, shown with a warning). `gatherWorkspaceBackup({
  includeCredentials })` strips secrets **in the gather step**, so a secret never
  reaches the pure builder unless opted in; `importWorkspaceBackup` restores with
  id-remapping (server dedupe by `(baseUrl,email)`; 3-way vault branch: no-creds /
  fresh-turnkey / existing-vault-drops-passwords+warns).
  The backup also carries **device UI preferences** (theme/accent/interface
  language/panel widths/…) as a `preferences.json` section — non-secret, always
  included, owned + validated by the ui store (`exportPreferences`/
  `applyPreferences`); on import the dialog applies them live (theme controller
  watches the store; language additionally needs `setLocale`).
  It also carries the user's **locally saved templates** (the "New form from
  template" gallery) as a `templates.json` section — non-secret, always included
  (written only when non-empty), each doc migrated on read and stripped of
  attachment refs (templates never carry blobs); `importWorkspaceBackup` restores
  them as new records with fresh ids (never overwrites) and **dedupes** against
  the existing gallery by `templateSignature` (trimmed case-folded title +
  `\u0000` + JSON of the attachment-stripped doc — the escape sequence, never a
  raw NUL byte), reporting `templatesImported`/`templatesSkipped`. Templates ride
  **formatVersion 2 without a bump** (additive optional section — see the bump
  rule above). `buildWorkspaceArchive`'s 4th arg is a `WorkspaceBackupSections`
  bag (`{ central, preferences?, templates? }`) — present ⇒ formatVersion 2,
  absent ⇒ v1 share.
  The *single-form / shared* export path is the deliberate exception: it stays
  **credential-free by construction** and **formatVersion 1** —
  `exportFormArchive` calls `buildWorkspaceArchive` with **no** `backup` arg
  (`gatherArchiveForms` reads only forms + attachments;
  `tests/unit/central-export-isolation.spec.ts` pins the share path), so handing a
  form to a colleague never ships Central data or secrets. Backup round-trip is
  pinned by `tests/unit/workspace-full-backup.spec.ts` (both backends).
- **Serializer behavior is pinned to pyxform 4.5.0** by `tests/golden/`
  (parity + parse→serialize round-trip gates auto-discover every fixture).
- **Version pins with reasons** (`docs/product/tech-stack.md`): PrimeVue
  4.3.3 + @primeuix exactly match what `@getodk/web-forms` bundles (byte-
  identical preset, `pnpm verify:webforms` — now also guards
  `darkModeSelector: false` and generated-theme-CSS drift); `xlsx` comes
  from the cdn.sheetjs.com tarball (npm copy is stale); TypeScript `<7` for
  vue-tsc.
- **Generated theme CSS is committed + drift-gated** — dark/accent theming
  ships as committed static override CSS (`src/styles/generated/*.css`,
  keyed on `:root[data-ff-theme|data-ff-accent]`) produced by
  `pnpm generate:theme` from the *pinned* `@primeuix/styled` emission. Both
  PrimeVue installs keep `darkModeSelector: false` (runtime dark mode never
  enabled — the preview's own PrimeVue would clobber it). **Regenerate, never
  hand-edit** the generated files; the drift gate
  (`tests/unit/theme-generated.spec.ts` + `verify:webforms`) fails on a stale
  commit. Hand edits go in `src/styles/builder-dark.css` / `builder-contrast.css` (the latter AAA-gated by `tests/unit/theme-contrast-ratio.spec.ts`).
- **No undefined CSS custom properties** — a bare `var(--x)` whose token is
  never defined silently invalidates the whole declaration (a gap/padding
  collapses to 0); nothing else catches it (vue-tsc ignores CSS, eslint skips
  `.css`, happy-dom has no layout, Playwright checks testids/text). `pnpm lint`
  runs **stylelint** (`stylelint.config.mjs`, `value-no-unknown-custom-properties`)
  over `src/**/*.{css,vue}` to fail on it. Known tokens come via `importFrom`: our
  `--odk-*`/`--builder-*`/`--accent` from the static token files, and every
  runtime-injected PrimeVue `--p-*` computed live from the pinned `@primeuix`
  emission (`scripts/primevue-custom-properties.mjs` — can't drift). Fallback-
  guarded refs (`var(--x, fallback)`) are allowed; a new bare `:style`-injected
  prop must be added to the config's runtime allowlist (see `--accent-swatch-color`).
- **Motion only via `--builder-motion-*` tokens** — durations/easings live in
  `builder.css` `:root` (4 beats: xs 80/s 120/m 160/l 200ms + flash 900ms; 4
  curves incl. transform-only `pop`); NO literal timings in component CSS.
  Shared named `<Transition>` classes (`route-*`, `drawer-start/end-*`,
  `scrim-fade-*`, `pane-fade-*`) + `html`-prefixed PrimeVue overlay retunes
  (their runtime CSS is unlayered and injected last — same-specificity
  overrides lose) live in `src/styles/motion.css`. One global
  `prefers-reduced-motion` blanket in `builder.css` (0.01ms, so `transitionend`
  still fires) — no per-component gates. Exits stay ≤200ms (e2e `toBeHidden`
  races anything slower). The canvas root `NodeList` is keyed by
  `form.recordId` — its TransitionGroup must never cross-animate two docs.
  See `docs/specs/2026-07-17-1632-motion-polish/standards.md`.
- **UI strings only via vue-i18n** — typed per-namespace catalog in
  `src/i18n/locales/en/`, `useAppI18n()` in components, `translate` in
  stores; eslint `no-missing-keys` is an error. Keep rendered English
  byte-stable unless intentionally changing copy (tests assert strings).
  **French + Spanish ship as full catalogs mirroring en**
  (`MessageSchema = typeof en`, fr/es `satisfies` it): every en key you
  add/remove/rename MUST get the same change in
  `src/i18n/locales/{fr,es}/` or `pnpm typecheck` fails. Terminology per
  the glossary in `docs/specs/2026-07-16-1125-ui-localization-fr-es/`.
- **Preserve `data-testid`s** — e2e helpers depend on them.
- **Conventional commits** — release-please derives versions from them;
  work directly on `main` (release-please opens release PRs against it).

## Code map

| Path | What lives there |
| --- | --- |
| `src/core/model/` | FormDocument/FormNode types, factory (`newDocument`, `instantiateTemplate`, `defaultVersion`), ops (`visit`, `flatten`, `cloneSubtree`, `uniqueName`/`uniqueNameIn` [dedup vs an explicit growing set — N-sibling paste], `topMostNodes` [document-order selection subset, descendants-of-selected removed]), `multi-ops.ts` (`moveNodesBy`/`indentNodes`/`outdentNodes`/`gatherNodesAfter` — selection-block moves over `topMostNodes` with all-or-nothing abort [outdent skips per-node instead]; `gatherNodesAfter` is the multi-drag gather primitive; callers wrap in one `mutate` or the drag transaction), `migrateDoc`, display helpers, `version.ts` (`bumpVersion` distinct-from-current), `attachment-role.ts` (`roleFor`, `mediatypeFor` — extension→mediatype map, for zip-bundle entries which carry no Content-Type of their own; `attachmentRefsFor` — rebuilds `doc.attachments` from imported `{filename, mediatype, blob}` triples, shared by Central import and the zip-bundle importer; `DEFAULT_MEDIATYPE`, re-exported by `workspace/archive.ts`), `rename-attachment.ts` (`collectAttachmentReferences` — one traversal over every attachment reference site incl. the implicit csv-external `${name}.csv` default, node/choice label media AND image-question defaults, drives the dialog's ref counts AND missing-row detection; `renameAttachmentRefs` doc-wide rewrite; `firstFreeAttachmentName` keep-both suffixing; `splitFilename`), `defaults.ts` (`isDynamicDefault`, `JR_IMAGES_PREFIX`, `stripImagePrefix`, `imageDefaultFilename` — image defaults are modeled as BARE filenames; the jr://images/ prefix exists only in serialized XForms, applied/stripped at the xform boundary, pyxform-parity), `translations.ts` (also exports `MEDIA_KINDS`/`mediaFilenames`/`langsOf`/`mediaSlotState` shared with the refs validator and the media pickers, plus the `transformNodesLocalizedTexts`/`transformChoiceListsLocalizedTexts` sub-walkers that `transformLocalizedTexts` composes — the clipboard merge's language remap runs them over cloned, not-yet-inserted subtrees; `addLanguage` pre-fills media slots from the default language into subsequent languages — images are shared-by-default across translations) — owns the **two-clean-shapes invariant**: a doc has either zero languages (all text under the `'default'` sentinel key, serialized inline) or ≥1 named languages with NO sentinel content and `settings.defaultLanguage` always set. `primaryLang` resolves the form's main language; `addLanguage` MOVES sentinel text into the first language and makes it the default; `removeLanguage` restores sentinel text on last-language removal; `normalizeDefaultContent` auto-merges mixed imports/legacy docs at every load seam (`migrateDoc`, `parseFormFile`, Central import, form-store `load`) — leftover conflicts surface as the grid's "Unassigned" column + `i18n.unassigned-text` warnings. A **solo** `lang="default"` XForm translation block (pyxform's monolingual shape, forced by media/guidance itext) folds back to the zero-language shape on parse — byte-identical round-trip, pinned by the `media_labels` golden; `lang="default"` **alongside named languages** stays a named language (mixed import, resolved at the load seams). Monolingual serialization decides itext **per entry** like pyxform (media-carrying labels, guidance-carrying hints, media-carrying used choice lists — plain text and bind messages stay inline; see the serializer's `labelUsesItext`/`hintUsesItext`/`listUsesItext` trio) |
| `src/core/registry/question-types.ts` | ~40 question types: XForm mapping, appearances, parameters, `docsAnchor`, `searchKeywords`, `effectiveItemsetFile` |
| `src/core/expr/` | `${field}`↔XPath rewriting, tokenizer, symbol table, `structured.ts` (visual-logic condition grammar, `trySerializeStructured` representability guard) |
| `src/core/xform/` | serializer + parser (lossless round-trip incl. entities dialect) |
| `src/core/xlsform/` | .xlsx reader/writer; `workbook-read.ts` is the ONLY module allowed to import `xlsx` (also `readCsvRows`) |
| `src/core/datasets/` | CSV/GeoJSON parsing for previews + column metadata (500-row cap) |
| `src/core/export/zip.ts` | `exportZip(doc, blobs, variant)` builds a per-form ZIP — `form.xml` (variant `'xform'`, default) or `form.xlsx` via `writeXlsForm` (variant `'xlsform'`) at the root, plus `media/<filename>` per attachment; shared `export.missing-attachment` warning across both variants. Not the `.formforge.zip` workspace-backup format below |
| `src/core/import-zip.ts` | `parseFormBundleZip` + `classifyZip` — the inverse of `export/zip.ts`: parses a per-form ZIP bundle (root `form.xml`/`form.xlsx` + `media/<filename>`, no manifest) into an `ImportParseResult` with `document.attachments` rebuilt from the `media/` entries (Central-import pattern: placeholder `id: ''`, `roleFor`, `mediatypeFor`, size — the landing path's `remapAttachments` mints real ids by filename join); both forms present → `form.xml` wins + an `import.zip-both-forms` warning; root `manifest.json` → routed to the `import.workspace-archive` error instead ("Import it from Settings → Import workspace"). `parseFormFile` (`import-form.ts`) dispatches `.zip` here directly, and in its extensionless `PK`-sniff branch calls `classifyZip` first to tell a bundle/workspace-archive apart from a bare `.xlsx` before falling back to `readXlsForm` |
| `src/core/workspace/archive.ts` | `.formforge.zip` build/read (manifest + form.json + attachments); `ArchiveAttachment`, `DEFAULT_MEDIATYPE`. Format v2 adds a `central/` section + `preferences.json` + `templates.json` (`ArchiveTemplate[]` — docs migrated on read, attachment refs stripped); `buildWorkspaceArchive(forms, ver, at, backup?: WorkspaceBackupSections)` (backup ⇒ v2, else v1 share). Crypto bytes via a pure base64 codec; `readWorkspaceArchive` → `{forms, issues, central?, preferences?, templates?}` |
| `src/core/central/` | ODK Central integration, pure TS (first network code): injectable-`fetchImpl` `client.ts`, WebCrypto credential `vault.ts` (PBKDF2→non-extractable AES-GCM, module-closure key), `publish.ts`/`import.ts` sequences, DTOs + typed `CentralError` (`types.ts`), `fingerprint.ts` (`contentFingerprint` — SHA-256 of the serialized XForm **excluding the version attr**, drives publish freshness), `reconcile.ts` (`freshnessFor`, `reconcileTarget` — pure freshness/check-server verdicts). No Vue/Pinia/Dexie/i18n; never localizes |
| `src/core/validate/` | validators (structure, refs, expr, parameters, translations, datasets, entities) + `Issue` factories |
| `src/core/util/guards.ts` | shared `isRecord`, `hasText` |
| `src/core/clipboard/` | pure clipboard model, reused by paste AND insert-from-template: `payload.ts` (`NodesPayload` — nodes + reachable choice lists + languages + attachment *filenames* only, no blobs/entities/settings; `buildNodesPayload`/`serializeNodesPayload`/`parseNodesPayload`/`tryParseClipboardText` [sniffs the `"formforge-nodes"` envelope, never throws, rejects `version > 1`]; `CLIPBOARD_KIND`/`CLIPBOARD_VERSION`/`MAX_BUFFER_CHARS`), `merge.ts` (`mergeNodesIntoDoc(doc, payload, target) → MergeResult|null` — null ONLY on empty payload/invalid target with doc untouched; step order: language remap [5-row match via the shared `matchLanguage`: exact/code/name-part/source-primary→target-primary/kept-DORMANT-in-place — unmatched non-primary text stays under its source key, invisible until `addLanguage`'s `adoptDormantTranslations` pass surfaces it (same matcher); the XLSForm writer filters undeclared keys out of exports; sentinel debris still dropped, two-clean-shapes holds by construction] → choice-list import [add / reuse-if-deep-equal-post-remap / rename `name_2` + `listRef` rewrite; never union-merge] → fresh ids + name dedup [implicit csv-external `itemsetFile` materialized BEFORE rename] → saveTo strip-when-no-`doc.entities` [else `entities.saveto-without-declaration` would error the target] → `insertNode`; degradations (incl. `dormantLanguages`) report on `MergeResult` for the toast, not null) |
| `src/clipboard/` | app-level clipboard transport (browser APIs — the theme-style pure-vs-apply split): `buffer.ts` (in-memory slot + best-effort localStorage `formforge.clipboard.v1` mirror ≤ `MAX_BUFFER_CHARS`, newest-`copiedAt` wins on read; `onClipboardBufferChange` also listens to window `storage` events ⇒ cross-tab paste reactivity), `system.ts` (fire-and-forget `navigator.clipboard` write, ClipboardEvent get/set with `application/json` + `text/plain`) |
| `src/stores/` | `form` (doc, mutate/undo, autosave, datasetColumns; clipboard/bulk actions `copyNodes`/`cutNodes`/`deleteNodes`/`pasteNodes`/`insertTemplate` + multi-move `moveSelectionBy`/`indentSelection`/`outdentSelection` — each early-returns BEFORE `mutate` [it pushes undo unconditionally] so one gesture = exactly one undo entry; multi-moves pre-flight the core helper on a throwaway clone so an aborted move adds NO entry; `pasteNodes` resolves a stale/non-container target to root-append pre-mutate; `load` runs `normalizeDefaultContent` on the Dexie clone — the one load path that bypasses `migrateDoc`), `workspace` (library), `preview` (debounced regen, reset-on-switch), `editor` (anchor `selectedNodeId` [meaning unchanged — properties/preview/tabs all key off it] + multi-selection `selectedNodeIds: Set` [invariant: anchor ∈ set unless empty; mutators assign a FRESH Set, the `collapsedIds` reactivity pattern] via `select`/`toggleSelect`/`selectRange`/`selectMany`/`pruneSelection`; dialogs + `centralDrawerOpen`), `ui` (persisted prefs incl. locale + `theme`/`accent` + `hiddenBundledTemplates` [starter-template ids the user hid, mirroring the `dismissedCallouts` string-array pattern — `hide`/`unhide`/`reset`/`isBundledTemplateHidden`] + `lastExportFormat` [guarded per-form-recordId map of `ExportFormatId` driving the export SplitButton's remembered primary; `set`/`get`/`forgetExportFormat`, pruned by the workspace store's `deleteForm`; on backup restore the archive dialog rekeys it through the import's `formIdMap` (`remapPreferencesFormIds` in workspace-io) since restored forms get fresh ids]; `exportPreferences`/`applyPreferences` for the workspace backup's `preferences.json`, so any new pref rides the backup for free — **never bump `STORAGE_VERSION` for an additive guarded field**, `loadPersisted` drops the whole blob on mismatch and would wipe every saved pref), `embed`, `central` (server list via liveQuery, promise-gated `ensureUnlocked` + inline-gate `hasVaultMeta`, publish/import actions; session tokens + in-flight connects in closures, NOT reactive state) |
| `src/composables/` | shared view logic: `useWorkspaceExport` (`exportWorkspace({includeCredentials})` → v2 backup with Central section; `exportFormArchive` → v1 share, no `central` arg), `useStoragePersistence`, `useEditingLanguage` (panel editing-language state; `displayLanguage: null` = follow `primaryLang`, so multilingual docs never write sentinel text), `useDownload`, `usePublishFlow` (the Central drawer's publish state machine — serialize → publishForm → upsertTarget w/ content hash; 409 update-instead/bump recovery), `useTypeLabels` (localized question-type names/descriptions/category labels from the `types.*` catalog namespace — registry stays English source of truth; coverage pinned by `tests/unit/type-labels.spec.ts`), `useImportLanding` (shared import-landing state machine — guarded, re-entrancy-safe land + formId-collision lookup feeding `ImportCollisionPanel`; used by `ImportDialog`'s ZIP-bundle path and `LibraryCentralDrawer`, hosts keep their own finish/error hooks), `useSelectionActions` (the ONE UI surface for selection/clipboard — toolbar, global keys, native ClipboardEvents and TreeNodeCard all route here: `canCut/canCopy/canDelete/canPaste` [paste reactive via `onClipboardBufferChange`], copy/cut/delete/`pasteClipboard`, `handleCopy/Cut/PasteEvent` [event data first, buffer fallback], paste-target rule mirroring `addFromPalette` [open container → append; else after selection; else root end], post-paste `selectMany` + reveal + informational toast on drops/missing-files/stripped-saveTo), `useMediaAttachment` (label-media/default-image write logic: fan-out to all current languages in one undo step, override-preserving replace/clear, filename sanitize + `AttachmentConflictDialog` flow — shared by `LabelMediaSection`, the choice media popover and the default-image picker); app version helper in `src/version.ts`; `src/shortcuts.ts` (`shortcutMod()` — the one navigator.platform read, fills the `{mod}` slot in shortcut tooltips: canvas toolbar + UndoRedoButtons) |
| `src/persistence/` | backend seam + Dexie impl (db name `form-forge` — `CURRENT_DB_NAME`; v3: forms/attachments/snapshots/templates + centralServers/centralVault/publishTargets; `PublishTargetRecord` also carries an optional `lastPublishedContentHash` — a non-indexed field, so **no** version bump), memory backend, `migrate-legacy-db.ts` (one-time startup rename copy `odk-form-builder`→`form-forge`, then deletes the legacy DB; run from `main.ts` on the non-embed path before any store opens `db`), repos (`duplicateForm`, `createFormWithArchiveAttachments`, `remapAttachments`, `replaceFormWithArchiveAttachments` atomic import-replace, `renameAttachment` [in-place filename update on both backends — `filename` is unindexed, no schema bump], `central-servers-repo`, `publish-targets-repo`), `workspace-io`, `templates-repo` (`listTemplates`/`addTemplate`/`updateTemplate` [metadata-only rename] /`replaceTemplate` [overwrite-on-save, preserves `createdAt`] /`deleteTemplate` + pure `firstFreeTemplateTitle` [case-insensitive "Name (n)" keep-both suffixing], all via the seam's `getTemplate`/`putTemplate`; one shared `deriveTemplateFields` clones the doc, strips attachment refs and recomputes questionCount/preview). `gatherArchiveForms` never reads the Central tables (**share-path** isolation, test-enforced). The whole-workspace backup adds `gatherWorkspaceBackup({includeCredentials})` (reads servers + publish targets + templates always; vault + `encryptedPassword` only when opted in — strips secrets in the gather step) and `importWorkspaceBackup` (restore with form/server id remap, server dedupe by `(baseUrl,email)`, 3-way vault branch, templates re-inserted as new records with fresh ids) — see `docs/specs/2026-07-15-*-workspace-full-backup/` |
| `src/preview/` | web-forms loader (isolated child Vue app), `fetchFormAttachment` (jr:// → attachments by filename), `followSelection.ts` (pure label/hint+position matcher mapping the selected canvas node to web-forms' rendered `.question-container` list — no id bridge exists; `PreviewHost` exposes `followQuestion` + a DOM-ready `loaded` emit, `PreviewPanel` watches `editor.selectedNodeId` [flash] and re-follows after every remount [no flash], so the preview stays on the question being edited) |
| `src/embed/` | postMessage protocol v1 (types/guards, incl. additive `theme`/`accent`/`contrast` config keys → `setEmbedTheme`), bridge (origin-pinned), detection; demo host `public/embed-demo.html` |
| `src/pwa/` | `updatePolicy.ts` (hybrid auto/prompt decision), `registerSW.ts`, persistent-storage request |
| `src/help/` | registry-driven help content map (types, fields, `guideHelp` workflow guides — nine incl. the `canvas` multi-select/clipboard guide) + shared type search (`groupTypesBySearch`), guide order in `guides.ts`; guide UI in `src/components/help/` (drawer, GuideContent, GuideTrigger, GuideCallout with `ui.dismissedCallouts` — callout ids: `translations`, `logicRaw`, `multiSelect` [rendered atop the editor canvas, links to the canvas guide]) |
| `src/i18n/` | createI18n setup, typed `MessageSchema` (= typeof en — fr/es `satisfies` it, so vue-tsc fails on any key drift), `setLocale` (lang/dir for future RTL), per-namespace `locales/{en,fr,es}/*.json` (en is the byte-stable source of truth; fr/es terminology anchored to the ODK-ecosystem glossary in the 1125 spec folder), `pluralRules.ts` (fr: count 0 is singular for 2-form keys), `detectLocale.ts` (first-run navigator.language match, non-embed boot only; stored pref/backup/embed always win) |
| `src/templates/` | bundled starter FormDocument JSONs + lazy registry (regenerate via `scripts/make-templates.ts`); exports `migrateTemplateDoc` — the shared migrate-or-throw guard used by the bundled loader, NewFormDialog's local-template path and InsertTemplateDialog |
| `src/theme/` | theming apply layer: `constants.ts` (PURE — `ThemeScheme`/`AccentId`/`ContrastPref`, `ACCENTS`, `resolveScheme`/`resolveContrast`, `HIGH_CONTRAST_SURFACES` [single source of truth the generator's ratio math + hand-authored CSS + ratio test all share], guards; shared by store/embed/UI/inline-script/generator), `index.ts` (`applyTheme`, `initThemeController` [called in `main.ts`; watches prefers-color-scheme AND prefers-contrast], `setEmbedTheme({theme?,accent?,contrast?})`, owns `<html data-ff-theme data-ff-accent data-ff-contrast>` + dynamic metas). Preferences persisted in the ui store (`theme`/`accent`/`contrast`), embed-overridable (additive `contrast` config key), no-FOUC inline script in `index.html` |
| `src/styles/` | `odk-tokens.css` (light `--odk-*`, byte-parity with web-forms) + `builder.css` (also hosts the fr/es `html[lang]`-scoped compact-header rules, the `--builder-motion-*` token block + the shared `--builder-flash-tint`/`--builder-flash-ring` attention-flash pair [translucent color-mix — the dark theme never remaps the raw `--p-primary-50` scale, so opaque light tints flash near-white in dark], the global reduced-motion blanket and the `.ff-stable-dialog` fixed-frame modal recipe [top anchor + fixed-height body + draggable off — attachments and form-settings dialogs]) + `motion.css` (shared named Vue transition classes + `html`-prefixed PrimeVue overlay retunes — see Motion invariant); `odk-preset.ts` (byte-identical PrimeVue preset + inert `colorScheme.dark` that only feeds the generator); `generated/{theme-dark,theme-accents,theme-contrast-accents}.css` (COMMITTED, drift-gated — regenerate via `pnpm generate:theme`, never hand-edit; the contrast-accents file clamps every accent×scheme to ≥7:1 and is additionally ratio-gated by `tests/unit/theme-generated.spec.ts` against the actual surface); `builder-dark.css` + `builder-contrast.css` (hand-authored remaps — contrast surfaces are AAA-enforced by `tests/unit/theme-contrast-ratio.spec.ts`). Generators: `scripts/generate-theme-css.mjs` (CLI) + `scripts/theme-css-lib.mjs` (pure, incl. the WCAG `contrastRatio` helper + `generateAccentContrastCss`) |
| `src/components/` | UI by area: palette, canvas (`CanvasToolbar` — non-scrolling panel header ABOVE the canvas scroll area: relocated `UndoRedoButtons`, Cut [`pi-file-export` — PrimeIcons has no scissors]/Copy/Paste/Delete icon buttons driven by `useSelectionActions`, "N selected" chip + clear ×, and the gear [`data-testid="form-menu"` — the relocated whole form menu + "Insert from template…", same menuitem labels so all e2e menu flows survive]; `TreeNodeCard` — click matrix [plain/ctrl-toggle/shift-range over visible `.node-card[data-node-id]` DOM order], a pointerdown flag keeps `@focus` from collapsing the set mid-Ctrl+Click [keyboard focus still single-selects], Delete/Alt+Arrows are selection-aware [multi ⇒ whole-selection ops, single ⇒ unchanged]; `NodeList` — gather-on-drop multi-drag: dragged id from `evt.item.dataset.nodeId`, and when it's part of a >1 top-most selection, `gatherNodesAfter` runs on the live doc inside the existing begin/endTransaction bracket [NEVER via `mutate`] so the whole gesture is one undo entry), properties (+ `logic/` ConditionBuilder, EntitySection; `HelpPopover` has a `param` mode rendering registry `QuestionTypeParameter` metadata per row — testids `field-help-param-<name>`; `AttachmentPicker` [dumb single-slot media picker: select-existing-by-mediatype or upload, attached/missing/varies states, testid prefix per slot] + `LabelMediaSection` [per-node "Label media" rows + `prop-media-add` menu, all four `MEDIA_KINDS`]; image questions swap the Default InputText for the picker in `prop-default-image` mode unless the stored value `isDynamicDefault`), preview, choices (per-choice media popover via `choice-media-<i>` icon buttons), translations, importexport (+ FileDropzone [now also accepts `.zip` bundles]; `ExportMenu` derives primary + dropdown from one enabled-actions list — the primary states its format ("Export · XForm"…) and follows the ui store's per-form `lastExportFormat` (`.find(remembered) ?? actions[0]`, which also covers embed-hidden formats); the dropdown lists ALL enabled formats with the active one check-marked, and a pick runs + remembers; `ImportCollisionPanel` [presentational Copy/Replace collision prompt, shared by `ImportDialog`'s ZIP-bundle path, `LibraryCentralDrawer`'s Central import and `FormLibraryView`'s save-as-template (a template-name collision, not just formId), each with its own i18n copy/testid prefix] — Import form now lands a `.zip` bundle with its attachments via `createFormWithArchiveAttachments`/`replaceFormWithArchiveAttachments`, prompting Copy/Replace on a form_id collision (replace behind a danger confirm, keeps the existing record's id and publish targets); bare `.xml`/`.xlsx` import is unchanged, still create-and-open), attachments (`AttachmentsDialog` renders `doc.attachments` refs + Missing rows for design-referenced-but-not-uploaded files, never raw repo records; `RenameAttachmentDialog` [stem-only, locked extension], `AttachmentConflictDialog` [Replace/Keep both/Skip + apply-to-all]), datasets (`AttachmentPreview` shared preview body — datasets as table/raw text, images [mediatype `image/*`] as an object-URL `<img>`, dataset extensions take precedence; `DatasetPreviewDialog` is its standalone modal shell for the properties-panel "View file" path — the Attachments dialog instead drills in in-place: back-arrow header, top-anchored constant-width frame [never re-centers], Esc backs out one level), help, library (`NewFormDialog` is the template-management surface: bundled + local cards share one `.actionable-card` shape [wrapper div + inner `-main` button + sibling icon Buttons — a card can't be a bare `<button>` once it carries actions]; local cards edit title/description [`updateTemplate`, `template-edit-*` testids — "rename" in this repo means the *form* rename dialog] and delete behind a `confirm.require`; bundled starters hide/unhide into a **collapsed-by-default** "Hidden starters (N)" disclosure with Restore-all in its header, backed by the ui store's `hiddenBundledTemplates` — collapsed on purpose, since an always-open list would undo the decluttering hiding exists for. Starter action testids are id-keyed `new-form-starter-{hide,unhide}-<id>` like `new-form-template-<id>`; local-card actions are NOT id-keyed because the `new-form-local-template` wrapper already scopes a row (e2e does `localCard.getByTestId(...)`). The gallery binds `:close-on-escape="!nestedOverlayOpen"` so one Esc backs out ONE level — the confirm/edit overlay and the gallery otherwise both act on the same keydown. `FormLibraryView`'s save-as-template **reuses `ImportCollisionPanel`** for its Replace/Save-a-copy prompt on a case-insensitive title collision, with a `savingTemplate` re-entrancy latch [`addTemplate` mints a fresh id, so a double-click would persist twice]; during a collision the footer Save stays mounted-but-disabled (never vanishes mid-aim) with a hint, Enter fires an attention-flash on the panel (flash tokens, reset on `animationend`), and **Save a copy auto-suffixes** via `firstFreeTemplateTitle` ("Name (2)", templates-repo, mirrors `firstFreeAttachmentName`); the template-saved toast points at New form. `InsertTemplateDialog` — slim read-only picker gated on `activeDialog === 'insert-template'`: bundled starters [respecting hidden ones] + local templates, one click → `form.insertTemplate` → close + select/reveal, no confirm step [fully undoable]; card CSS deliberately duplicated from NewFormDialog rather than extracted), settings, shell (`ToolbarSeparator`, `UndoRedoButtons` [rendered by `CanvasToolbar`, NOT the header — the library header no longer shows dead undo/redo], `AppHeader` — `#title-actions` hosts the editor's plain form-title span [`editor-form-title`]; the form menu lives on the canvas toolbar's gear which keeps `data-testid="form-menu"`; the ⋮ kebab stays retired — e2e navigates via `form-menu`), `central/` (server pickers, the non-modal `CentralDrawer` [editor slide-over hub] + `DestinationRow`/`NewDestinationForm`/`PublishFlowStatus`/`DrawerUnlock`, `LibraryCentralDrawer` [import], CentralServersSection, app-global UnlockVaultDialog; with no servers the editor shows a `central-zero-state` button routing to Settings). The editor Publish dialog and the Import "From Central" toggle were retired into the drawers. Shared `centralErrorKey` in `src/i18n/central-errors.ts` |
| `src/views/` | FormLibraryView, FormEditorView (resizable grid shell; `.canvas-panel` = `CanvasToolbar` + the scrolling `role="tree" aria-multiselectable` canvas [toolbar is a non-scrolling sibling, never `position:sticky`]; global keydown adds Delete/Ctrl+A/Escape selection handling — scoped to events from `.canvas-panel` or `body`, and Escape additionally requires NO PrimeVue overlay in the DOM [overlays close on the SAME keydown before this window handler runs, so an `activeDialog` guard alone races and would clear the selection as a side effect]; document-level copy/cut/paste ClipboardEvents delegate to `useSelectionActions`; a `form.revision` watch prunes stale selection ids after undo/drag/delete; multiSelect GuideCallout atop `.canvas-inner`), FullPreviewView, SettingsView (#/settings: workspace io [the export row shows a what's-in-the-backup summary line: forms · templates · preferences · credentials-when-opted], UI language, About; blocked in embed), EmbedWaitingView |
| `tests/` | `unit/` + co-located `*.spec.ts`, `component/` (happy-dom), `e2e/` (playwright; helpers.ts), `golden/` (pyxform parity), `helpers/` (doc-builders, xml-canonicalize, backends) |
| `.github/` | `ci.yml` (quality ∥ e2e), `release-please.yml` (main), `deploy.yml` (Pages, e2e-gated), composite setup action |

## Documentation index

- `docs/product/` — mission, roadmap (Phase 1 + delivered Phase 2 + Phase 3
  incl. delivered Central integration), tech-stack (pins + rationale).
- `docs/specs/<YYYY-MM-DD-HHMM-slug>/` — one folder per delivered work
  package: `plan.md` (full), `shape.md` (scope/decisions), `references.md`,
  `standards.md`, `user-guide.md`. Notable user guides: **ci-cd-github-pages**
  (release/Pages setup, Release-As v1.0.0 bootstrap — never put `release-as`
  in release-please-config.json, it sticks), **embed-postmessage-api**
  (host integration), and **2026-07-13-1331-central-publishing**
  (server-side CORS recipes + threat model; the local-proxy helper ships as
  `scripts/central-cors-proxy.{sh,ps1}` — bash + PowerShell, byte-identical
  Caddyfile output, writes to gitignored `.local/`).
- `docs/specs/2026-07-15-1219-central-ux-enhancement/` — **delivered** re-shape
  of the Central surfaces into a non-modal per-form drawer + hub (editor
  `CentralDrawer`, library import drawer, inline once-per-session vault gate,
  multi-destination tracking + content-based freshness + Check-server, additive
  `lastPublishedContentHash`).
- `docs/specs/2026-07-16-1740-media-labels-annotation/` — **delivered** label
  media authoring (properties-panel "Label media" + per-choice popover, all
  four `MEDIA_KINDS`, shared-across-languages fan-out with grid overrides) and
  the annotate default-image pattern (image Default = attachment picker; bare
  filename in the model, `jr://images/…` at the xform boundary; joined the
  attachment reference traversal). Its `shape.md` records the two
  delivery-phase serializer/parser decisions: per-entry itext for monolingual
  docs and solo-`lang="default"` folding (revises a 1712 non-goal note).
- `docs/specs/backlog/` — retired 2026-07-16 (everything delivered); recreate
  the folder when a new proposal appears. Delivered shaping docs live in git
  history; unshaped follow-up ideas are tracked in the roadmap's "Known
  follow-ups" section.
- `docs/verification/` — agent-browser manual pass logs + screenshots per
  feature.
- `tests/golden/README.md` — golden regeneration policy (pyxform 4.5.0).

## Delivery process (established with the user)

New significant work: shape it in `docs/specs/backlog/` (create the folder
when a new proposal appears) → promote to a timestamped spec folder
(shape-spec layout above) as implementation starts →
implement via dynamic Workflows with parallel agents → verify (full suite +
agent-browser pass logged to `docs/verification/`) → run `/code-review`
(five lenses, no plan mode) and fix findings immediately → conventional
commit per feature → update README Features, roadmap, and THIS file.
