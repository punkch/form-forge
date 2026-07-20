# Product Roadmap

Superseded planning documents (`PRODUCT_PLAN.md`, `REQUIREMENTS.md`, `TECHNICAL_SPECIFICATION.md`, `.agent-os/product/roadmap.md`) described an 18-month, backend-connected, Material-Design-3 program. This roadmap replaces them (2026-07-09): the product is client-side-only and styled to match ODK Web Forms.

## Phase 1: MVP — the rebuild (delivered 2026-07-09; v1.0.0 released 2026-07-10)

Delivered as 8 specs (see `docs/specs/`):

1. **Product docs & foundation** — scaffold (Vue 3.5 / Vite 8 / TS 5.9 / Pinia / Dexie), ODK design tokens, app shell, form library with IndexedDB persistence and autosave.
2. **Expression engine & validation** — `${field}` ↔ XPath rewriting, symbol table, form-level validators.
3. **Builder editor** — palette, question tree with drag-and-drop + keyboard commands, property panel, expression inputs with autocomplete, problems panel, undo/redo.
4. **XForm serializer & live preview** — pyxform-parity XML generation (itext, itemsets, setvalue, entities) and embedded `@getodk/web-forms` preview with submit testing.
5. **Choices, cascades & translations** — shared choice lists, cascading-select editor, multi-language translation grid.
6. **XForm import** — lossless XML parsing with round-trip guarantees.
7. **XLSForm import/export, ZIP & attachments** — native in-browser .xlsx reader/writer with row-level import reports, media attachments, ZIP export.
8. **Hardening & release readiness** — full e2e suite, pyxform golden-test matrix, accessibility, performance, docs.

**MVP success criteria:** import `all-widgets.xml` and the ODK XLSForm template cleanly; round-trip without data loss; preview any authored form in the real engine; export a ZIP that ODK Central accepts; core-engine test coverage ≥90%.

## Phase 2: Post-Launch — DELIVERED 2026-07-10

Delivered in five implementation waves (timestamped spec folders under
`docs/specs/`, verification logs under `docs/verification/`):

- **Workspace export/import** — lossless `.formforge.zip` archives (whole
  workspace or single form) with new-id imports and duplicate warnings.
- **Form templates** — bundled bilingual starter gallery + local
  save-as-template (Dexie v2).
- **External dataset tooling** — property-panel CSV/GeoJSON upload feeding
  the live preview (itemsets, `pulldata()`), column-aware value/label
  dropdowns, unknown-column validation, 500-row preview table.
- **UI internationalization** — vue-i18n foundation, typed English catalog,
  RTL-ready (logical CSS properties, `dir` switching); future locales drop
  in as catalog files.
- **Iframe embed mode** — `?embed=1` + origin-pinned postMessage API
  (load/save with attachments, host-controlled exports, memory or local
  persistence); reference host at `public/embed-demo.html`.
- **PWA packaging** — installable, fully-offline app shell (engine chunk
  precached) with a hybrid self-update policy (auto on load/idle, toast
  mid-edit).
- **CI/CD** — `ci.yml` quality+e2e, release-please release PRs on `main`,
  GitHub Pages deploy gated on e2e (see the ci-cd spec user-guide for the
  one-time setup + v1.0.0 `Release-As` bootstrap).
- **In-app help** — field popovers, per-type help drawer, searchable
  reference of all 36 question types, offline, adapted from docs.getodk.org.
- **Visual logic builder** — structured condition editor for
  relevance/constraints with a lossless raw escape hatch; calculation
  template helper.
- **Deeper entity support** — update/upsert flows golden-pinned to
  pyxform 4.5.0, Entities settings tab, per-question `save_to`, follow-up
  form wizard.
- Fixed: the preview showing the previously opened form after switching.
- Fixed: a `range` question with unset bounds crashed the live preview with
  an undismissable engine dialog — the serializer now fills `start`/`end`/
  `step` from registry defaults, validation warns on missing required
  parameters, and the preview detects web-forms' load-failure dialog and
  routes it through the builder's own recoverable error state
  (`docs/specs/2026-07-10-1945-range-preview-crash/`).
- **UX polish pass (2026-07-10 design critique)** — implemented all findings
  of the Interface Craft five-lens review
  (`docs/specs/2026-07-10-1810-ui-critique-fixes/`): logic-builder trust
  (notes excluded from operands, nearest-preceding defaults,
  `expr.empty-condition-value` warning), problems panel location chips +
  grouping + "Ready" state, export readiness summary, two-line canvas
  labels + labeled logic badges, always-labeled Preview/Export + panel/
  desktop icons, richer library cards + formatted versions, New-form
  create hint, unified help drawer (reference modal removed), and a drafted
  upstream issue for the web-forms number-input contradiction.

## Phase 3: Backlog burn-down & continuous polish (2026-07-10 → ongoing; backlog cleared 2026-07-16)

Delivered:

- **Settings page** (`docs/specs/2026-07-10-2005-settings-page/`) — gear on
  the library header (replaces the ⋯ overflow menu) routing to `#/settings`:
  workspace export/import, UI-language picker persisted to `ui.locale`, About
  (app version, storage-persistence status), extension points for the future
  update-check and Central-server sections; route and gear absent in embed
  mode.
- **Renovate dependency updates**
  (`docs/specs/2026-07-10-2008-renovate-dependency-updates/`) — weekly
  self-hosted Renovate workflow + `renovate.json` encoding the pin
  discipline (PrimeVue/@primeuix and xlsx frozen, web-forms
  dashboard-approval only, TS <7). Awaiting the owner-created
  `RENOVATE_TOKEN` secret for its first run.
- **Full translation coverage**
  (`docs/specs/2026-07-10-2006-translation-coverage/`) — the grid lists
  every relevant translatable site even when empty (constraint/required
  messages gated on their bind rules, guidance hints behind a rarely-used
  toggle; since 2026-07-17 hint rows sit behind their own "Show hints"
  toggle, defaulting on only when a hint carries text) plus node/choice
  media rows; the properties panel gains an
  explicit editing-language control and `LocalizedInput` everywhere
  (fallback as placeholder, per-language writes for constraint/required
  messages, guidance hints and choice labels); export readiness counts
  only sites with a value in ≥1 language. Core/serializer layers already
  round-tripped all of it — pure UI exposure, goldens untouched.
- **In-app guidance** (`docs/specs/2026-07-10-2007-in-app-guidance/`) —
  eight workflow guides (translations, logic builder, external datasets,
  entities + follow-up wizard, workspace backup, templates, autosave &
  snapshots, tree keyboard commands) as a searchable Guides section in the
  unified help drawer, contextual "?" triggers on their home surfaces
  (Translations dialog, logic builder, dataset/entity sections, library
  toolbar), and dismissable first-use callouts for the two silent-behavior
  traps (display-language retargeting, raw-mode logic fallback) persisted
  in the ui store. Text-only, fully offline, all copy in the typed i18n
  catalog.
- **Canvas card footer actions**
  (`docs/specs/2026-07-10-2342-canvas-card-footer-actions/`) — question
  cards restructured after an approved Interface Craft review: labels wrap
  fully (2-line clamp removed), badges + duplicate/delete moved into the
  footer row right-aligned with their space permanently reserved
  (opacity reveal, `pointer-events` guard) so hovering never reflows the
  card, chip/chevron anchored to the first title line, footer crowding
  guards, touch always-visible actions, and a fixed keyboard Tab path to
  the buttons (broken pre-change by the `display: none` reveal).
- **ODK Central integration — publish + import**
  (`docs/specs/2026-07-13-1331-central-publishing/`) — the first network
  feature, strictly opt-in and invisible until a server is registered.
  Register multiple ODK Central servers (App Settings); publish the open
  form's draft (definition + attachments) to a chosen project, surfacing
  Central's warnings verbatim with update-existing / bump-version recovery on
  a 409 collision; import a published form back through the existing import
  pipeline (replace-or-copy on collision); per-form publish targets remember
  destinations for one-click re-deploys across dev/staging/prod. Credentials
  live in a passphrase-derived WebCrypto vault (non-extractable AES-GCM, key
  and session tokens memory-only); server/vault/target data is device-local and
  excluded from *single-form / shareable* exports by construction and by test
  (a whole-workspace backup carries it by design — see the full-backup entry
  below). CORS is a documented server-side requirement (nginx/Caddy recipes in
  the spec user-guide; a local-proxy helper ships as
  `scripts/central-cors-proxy.{sh,ps1}`). Minimum supported Central: 2024.3.

- **ODK Central integration — UX enhancement (drawer + hub)**
  (`docs/specs/2026-07-15-1219-central-ux-enhancement/`) — re-shaped the shipped
  Central surfaces from a stack of interrupting overlays (peak 3 stacked modals)
  into a single **non-modal Central panel** per form (editor slide-over) plus a
  matching **library panel** for import. One hub lists **every** tracked
  destination with a **content-based freshness** chip (Up to date / Changed) and
  one-click re-publish rendered inline; **Publish to a new destination** expands
  in the rail; a per-destination **Check server** reconciles versions via a
  metadata read (no XML pull). The vault unlocks **once per session inline** — no
  modal ever stacks over a flow. The only data-model change is additive: a
  `lastPublishedContentHash` on `publishTargets` (no Dexie version bump — a
  non-indexed field). Publishing stays **draft-only** (going live remains
  Central's own step). The old Publish dialog and the Import "From Central"
  toggle were retired.

- **Whole-workspace backup — complete restore (format v2)**
  (`docs/specs/2026-07-15-1729-workspace-full-backup/`) — made the
  `.formforge.zip` workspace backup a *complete* restore: it now carries the ODK
  Central section — server config + publish history **always**, and the credential
  vault + each server's saved (encrypted) password **opt-in on export** (an
  unchecked box gated on the vault being unlocked, shown with a warning) — **and**
  device UI preferences (colour scheme, accent, interface language, panel layout,
  dismissed hints), which apply live on import. Opting in makes a new-device
  restore turnkey (same passphrase unlocks, no re-typing); the default backup
  holds no secrets. Restore remaps form/server ids, dedupes servers by
  `(baseUrl, email)`, and never overwrites an existing vault (it warns and drops
  the imported passwords instead). The **single-form / shareable** export is
  unchanged — **format v1**, credential-free by construction — so handing a form
  to a colleague never ships Central data or preferences. Secrets are stripped in
  the gather step, so they never reach the pure archive builder unless opted in.
  The backup also carries the user's **locally saved form templates** (the "New
  form from template" gallery, an additive `templates.json` section restored as
  new records) so a new-device restore rebuilds the gallery too. The only
  persisted table left out by design is per-form **snapshots** (undo/version
  history — ephemeral working state).

- **Template & backup UX polish — eight seam fixes from a UX review**
  (`docs/specs/2026-07-20-1434-template-backup-ux-polish/`) — closed the gaps
  between the template-management and backup features: **re-importing a backup
  no longer duplicates templates** (identical title+content skipped, counts
  reported in one combined toast); **"Save a copy" auto-suffixes** ("Name (2)",
  mirroring the attachments' keep-both pattern) instead of minting twins;
  the save-dialog **footer stays stable during a name collision** (Save is
  disabled with a hint, Enter fires an attention flash on the Replace/Save-a-copy
  panel instead of doing nothing silently); the template **edit dialog says how
  to update content** (Save as template → Replace); **Settings previews what the
  backup will contain** before export; icon-only actions got **tooltips**;
  description fields became **textareas**; and the template-saved toast now says
  where templates live.

- **Export format memory — the export button states and remembers its format**
  (`docs/specs/2026-07-20-1433-export-format-memory/`) — the editor's export
  SplitButton primary no longer says a bare "Export": it states the format it
  will produce ("Export · XForm", "Export · XLSForm", …) and **remembers the
  last format chosen per form**, GitHub-merge-button style. The dropdown now
  lists **all** enabled formats (the primary used to be absent from it) with the
  active one check-marked, and picking a format both runs the export and becomes
  the new primary — with a subtle motion-token label crossfade as feedback. The
  memory is a guarded additive ui-store map (`lastExportFormat`, keyed by form
  record id, pruned on form deletion; no `STORAGE_VERSION` bump) and rides the
  workspace backup's `preferences.json` for free. In embed mode a remembered
  format the host disabled falls back to the first enabled action.

- **Template management — curate the New form gallery**
  (`docs/specs/2026-07-20-1305-template-management/`) — turned the template
  gallery from read-only-plus-a-trash-can into something you can curate.
  Deleting a saved template now goes through the same **confirm** as deleting a
  form (it previously deleted on a single unconfirmed click, with no undo);
  saved templates can be **renamed/redescribed** after the fact; saving a
  template under a name that already exists offers **Replace** instead of
  silently creating a duplicate (mirroring `ImportCollisionPanel`'s Copy/Replace
  shape); and the four bundled **starters can be hidden** and restored
  individually or all at once. Hidden starters are a device-level ui-store
  preference (`hiddenBundledTemplates`, mirroring `dismissedCallouts`), so they
  ride the workspace backup's `preferences.json` for free — no archive change.
  Neither `STORAGE_VERSION` nor `WORKSPACE_FORMAT_VERSION` moved: both additions
  are additive and guarded, and bumping either would discard data an older
  reader could have safely ignored.

- **Theming — light/dark/system + accent presets**
  (`docs/specs/2026-07-13-1840-theming/`) — a light/dark/follow-OS color-scheme
  preference plus six accent presets (ODK blue default, purple, green, teal,
  amber, rose) that restyle the builder chrome **and** the embedded web-forms
  preview together, host-controllable in embed mode (additive `theme`/`accent`
  config keys, `system` accepted). Delivered as committed static override CSS
  keyed on `:root[data-ff-theme="dark"]` / `:root[data-ff-accent="…"]`, generated
  from the *pinned* `@primeuix/styled` emission (`pnpm generate:theme`) and
  drift-gated — so the byte-identical PrimeVue parity + `darkModeSelector: false`
  invariant stays untouched and the preview re-themes without flipping the
  runtime dark mode (which the preview's own PrimeVue would clobber). Default
  `system`; preference persisted in the ui store; no-FOUC pre-paint apply.

- **2026-07-16 burn-down — six specs delivered in one wave**
  (promoted together, open questions resolved with the user the same day;
  implemented as five parallel worktree streams + a localization wave):
  - **ZIP export variants** (`docs/specs/2026-07-16-1120-zip-export-variants/`)
    — the single "ZIP with attachments" split into *ZIP · XForm XML +
    attachments* and *ZIP · XLSForm + attachments*, shared core bundling,
    suffixed download filenames (`-xform.zip`/`-xlsform.zip`), one embed
    `zip` flag gating both.
  - **Parameter help popovers**
    (`docs/specs/2026-07-16-1121-parameter-help-tooltips/`) — every
    type-specific parameter's "?" is now parameter-specific (description,
    allowed tokens, default, required, exact `parameters` key), fed straight
    from the core registry; registry metadata gaps fixed against
    docs.getodk.org.
  - **Editor toolbar de-clutter**
    (`docs/specs/2026-07-16-1122-editor-toolbar-declutter/`) — the header
    regrouped into separated clusters; the four form tools promoted out of
    the anonymous ⋮ into a labeled "Form" menu (since 2026-07-17 the form
    title itself is that menu's button — the ⋮ kebab is retired); theme
    toggle relocated to the library header; zero-state Central button; the
    header stays intact down to tablet widths (and in fr/es).
  - **Attachment manager** (`docs/specs/2026-07-16-1123-attachment-manager/`)
    — fixed the same-name re-upload save-poisoning bug (DataCloneError)
    first, then: missing-required-attachment rows with one-click upload,
    rename with document-wide reference rewriting, per-row replace,
    explicit Replace/Keep-both/Skip conflict handling with apply-to-all,
    reference-count badges, undo-safe orphan sweeps.
  - **High-contrast mode** (`docs/specs/2026-07-16-1124-high-contrast-mode/`)
    — an orthogonal `normal|high|system` contrast preference
    (`prefers-contrast`-aware, `data-ff-contrast` attribute) with
    hand-authored AAA surfaces (decoration reduced to hard borders),
    generator-emitted per-accent 7:1 clamps drift-gated by a ratio test,
    an additive embed `contrast` key, and forced-colors fixes.
  - **French + Spanish UI**
    (`docs/specs/2026-07-16-1125-ui-localization-fr-es/`) — complete fr/es
    catalogs anchored to ODK Central/Collect's own translations (committed
    glossary), a French zero-count plural rule, first-run browser-language
    detection, per-locale contextual agent-browser QA passes with a
    layout-first fix round.

- **Translations — retire the "Default" language column**
  (`docs/specs/2026-07-16-1712-translations-default-language/`) — builder
  documents now always take one of the two shapes the ODK ecosystem expects:
  monolingual (no languages, a single "Text" grid column) or fully named
  languages (no "Default" pseudo-language anywhere). Adding the first language
  silently moves the form's text into it and makes it the default language
  (undo-able); removing the last language moves the text back. Mixed
  imports/legacy docs auto-merge on load, with conflicting leftovers kept
  visible in a warning-tinted "Unassigned" grid column plus an
  `i18n.unassigned-text` problem until resolved. The editing-language pickers
  offer only named languages (null = the form's default), factory seeds are
  language-aware, and multilingual XLSForm exports no longer emit bare
  `label`/`hint` columns. Serializer/parser/XLSForm io byte-untouched —
  goldens unregenerated. Grounded in XLSForm/XForms-spec/pyxform/Kobo research
  (see the spec's `references.md`).

- **Label media & image annotation**
  (`docs/specs/2026-07-16-1740-media-labels-annotation/`) — authoring UI for
  the engine's already-round-tripping label media: a "Label media" group in
  the properties panel (image / big-image / audio / video; upload or pick an
  existing attachment) on questions, groups and repeats, plus a per-choice
  media popover in the choices editor. Media is shared across languages by
  default (fan-out write in one undo step; per-language overrides stay in the
  grid; `addLanguage` pre-fills media into new languages). Image questions'
  Default becomes an attachment picker — the annotate-template pattern —
  modeled as a bare filename and serialized `jr://images/…` with pyxform
  parity; the default joined the shared attachment reference traversal
  (ref counts, Missing rows, rename rewrite, `ref.missing-attachment`
  warning). Two new goldens (`annotate`, `media_labels`) exposed and fixed a
  latent serializer bug: monolingual forms now decide itext **per entry**
  (media-carrying labels, guidance hints, media-carrying choice lists) like
  pyxform, instead of a document-wide flag; the parser folds pyxform's solo
  `lang="default"` translation block back to the monolingual shape so
  round-trips stay byte-identical.

- **Import per-form ZIP bundles**
  (`docs/specs/2026-07-17-1306-zip-bundle-import/`) — the library's "Import
  form" dialog now accepts the ZIP layout `exportZip` already produces
  (`form.xml`/`form.xlsx` at the root plus `media/<filename>`), closing the
  round trip the export side has had since Central publishing: attachments
  land with the form instead of being dropped. A `manifest.json` at the root
  (a `.formforge.zip` workspace archive) gets a helpful error pointing at
  Settings → Import workspace instead of silently mis-parsing; a bundle with
  both `form.xml` and `form.xlsx` imports the lossless XML and warns that the
  XLSForm copy was ignored. A form-id collision offers the same Copy/Replace
  prompt as Central import (replace keeps the existing record's id and its
  publish targets) — factored into a shared `ImportCollisionPanel` used by
  both the Import dialog and `LibraryCentralDrawer`; bare `.xml`/`.xlsx`
  import is untouched (still create-and-open). New pure-core
  `src/core/import-zip.ts` (`parseFormBundleZip`, `classifyZip`) rebuilds
  `document.attachments` from the `media/` entries the same way the Central
  importer already does. No persistence schema change — no Dexie or
  workspace-backup version bump.

- **Attachments — in-place preview & stable dialog frames** (2026-07-17
  follow-on to the attachment-manager spec, no separate spec folder) —
  image attachments get an eye-icon preview, and previewing from the
  Attachments dialog now drills in in-place (back-arrow header, Esc backs
  out one level) instead of stacking a second modal; the preview body is
  the shared `AttachmentPreview` (datasets as table/raw text, `image/*` as
  an object-URL `<img>`), with `DatasetPreviewDialog` remaining its
  standalone shell for the properties-panel "View file" path. The dialog
  keeps a constant top-anchored frame across list/preview swaps — extracted
  as the shared `.ff-stable-dialog` recipe in `builder.css` and also
  applied to the form-settings dialog (its General/Entities tabs previously
  resized and re-centered the frame; verification logged in the
  motion-polish folder).

- **Motion & transition polish**
  (`docs/specs/2026-07-17-1632-motion-polish/`) — app-wide, CSS-only motion
  pass per an Interface Craft review: a `--builder-motion-*` token block in
  `builder.css` (4 duration beats + 4 easing curves, zero literal timings
  anywhere) feeding a new `src/styles/motion.css` (shared named Vue
  transitions `route-*`/`drawer-start-*`/`drawer-end-*`/`scrim-fade-*`/
  `pane-fade-*` + `html`-prefixed PrimeVue overlay retunes). Route switches
  cross-fade (`out-in`), all three slide-over drawers now animate closed
  (previously enter-only yanks), canvas nodes and library cards get
  TransitionGroup enter/leave/move (composed with vue-draggable-plus via its
  `target` prop), PropSection collapse folds via `grid-template-rows`
  (replacing `v-show`), plus micro-interaction transitions (tabs, save
  indicator, split handle, library card hover). Reduced motion is honored by
  one global `:root`-wide blanket replacing the old `.editor *` killswitch.
  Two delivery-phase fixes: the root `NodeList` is keyed by `form.recordId`
  so a form switch remounts the canvas (the TransitionGroup must never
  cross-animate two docs), and the editor's Central zero-state now routes
  with `?section=central` — SettingsView owns the scroll since the route
  transition delays its mount past the push.

- **Preview follows canvas selection**
  (`docs/specs/2026-07-17-1758-preview-follow-selection/`) — selecting a
  node on the canvas scrolls the live preview to the matching rendered
  question (centered, reduced-motion aware) and flashes it; after every
  debounced regeneration/remount the preview re-scrolls to the selected
  question, so it stays on the field being edited instead of resetting to
  the top. web-forms exposes no id bridge (opaque `nodeId`s, no field ref
  in the DOM, `loaded` emits no payload), so the mapping is a pure
  label/hint + position heuristic (`src/preview/followSelection.ts`:
  all-language candidates, wildcard entries for `${…}` labels, prefix+suffix
  LCS with target-anchored resolution) against the ordered
  `.question-container` list — benign-failure by design. Also hoisted the
  attention-flash tint into shared `--builder-flash-*` tokens (fixing a
  near-white dark-mode flash in the canvas just-added pulse too). Upgrade
  path if ever needed: upstream `data-reference` PR to web-forms.

The backlog is clear: the 2026-07-16 burn-down promoted every open proposal,
and the `docs/specs/backlog/` folder was retired (2026-07-16) — delivered
shaping docs live in git history and each implementation spec's
`references.md`/`shape.md` records its provenance. New proposals recreate the
folder when they appear.

### Known follow-ups (unshaped, S-sized or below)

- **`track-changes-reasons` audit parameter is mistyped** — the registry
  models it as a boolean, but docs.getodk.org specifies the literal string
  token `on-form-edit`. Fixing it changes what forms serialize (registry
  `type` → `'string'` + `options`, plus the boolean-write logic in
  `TypeConfigSection.vue` and a golden check) — deliberately left out of
  the 2026-07-16 metadata-only registry audit commit.
- **PrimeVue built-in aria labels stay English under fr/es** — e.g. the
  Dialog close button's "Close" comes from PrimeVue's own `locale` config,
  not the app catalog. Needs a small per-locale PrimeVue locale map wired
  into `setLocale`.
- **Drag-and-drop upload into the Attachments dialog** — noted as a
  nice-to-have in the attachment-manager spec; the dialog now has the
  conflict/missing machinery it would compose with.
