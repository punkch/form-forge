# References — French + Spanish UI localization

File:line references verified against code on 2026-07-16. These correct and
sharpen the backlog doc's "current implementation" notes, which were
directionally right but approximate in a few places (exact file/line count,
what exactly is registration-driven, and — the biggest correction — the
real scope of the "mixed-language surface" the registry/Issue policy
produces).

## `src/i18n/index.ts`

- `MessageSchema = typeof en` (`:9`) — English is the compile-time source
  of truth for every locale.
- `createI18n<{ message: MessageSchema }, 'en', false>({ legacy: false,
  globalInjection: true, locale: 'en', fallbackLocale: 'en', messages: {
  en } })` (`:37-43`). Registering `fr`/`es` means adding both to the
  `messages` object here (and, for the plural fix, a `pluralRules: { fr:
  ... }` entry alongside it — vue-i18n's `createI18n` option accepts both
  `pluralRules` and the legacy-aliased `pluralizationRules`; use
  `pluralRules`, matching the Composition-mode types already in use).
- `SUPPORTED_LOCALES: Record<string, string> = { en: 'English' }` (`:52`) —
  gains `fr: 'Français'`, `es: 'Español'`. This map **only labels** a
  locale; it does not register it.
- `localeOptions()` (`:55-56`): `` i18n.global.availableLocales.map((code)
  => ({ code, label: SUPPORTED_LOCALES[code] ?? code })) `` — confirms the
  backlog doc's claim exactly: **the Settings picker's options are
  registration-driven.** Adding `fr`/`es` to `messages` in `createI18n` is
  what adds picker options; `SettingsView.vue` needs **no edit** for the
  picker itself to grow two entries.
- `useAppI18n()` (`:65-68`) / `translate` (`:71`) — unaffected; both are
  generic over `MessageSchema`, not over a specific locale's content.

## `src/i18n/locales/en/`

- **Exactly 15 namespace files, 1,198 lines total** (`wc -l
  src/i18n/locales/en/*.json`, excluding `index.ts`): `appSettings.json`,
  `canvas.json`, `central.json`, `common.json`, `dialogs.json`,
  `guides.json`, `help.json`, `importExport.json`, `library.json`,
  `palette.json`, `preview.json`, `properties.json`, `settings.json`,
  `shell.json`, `stores.json`. Each file's sole top-level key is its own
  namespace (e.g. `palette.json` → `{ "palette": { … } } `) — the shape
  `@intlify/eslint-plugin-vue-i18n` depends on.
- `locales/en/index.ts` spreads all 15 into one `en` object (alphabetical
  import order, spread order is `common, shell, library, palette, canvas,
  properties, preview, dialogs, help, guides, importExport, settings,
  appSettings, stores, central` — order doesn't matter for a flat-merge
  spread since no two files share a top-level key, but new locale
  `index.ts` files should mirror this file's structure/comment verbatim so
  the three locales stay visibly parallel).
- Line counts by file at the time of writing (informational, will shift as
  Wave-1 features add keys before this feature starts — re-check per
  Sequencing in `shape.md`): `help.json` 21,410 bytes / `guides.json`
  13,284 bytes are by far the largest (the help drawer's actual prose and
  the workflow guides' content — **both are normal, fully translated
  namespaces**, not English-locked).

## `src/i18n/setLocale.ts`

- The single entry point for switching locale at runtime: sets
  `i18n.global.locale.value`, `document.documentElement.lang`, and `.dir`
  (`textDirection`, `:4-5`, RTL only for a `startsWith('ar')` check —
  irrelevant to `fr`/`es`, both `ltr`).
- Callers, confirmed by grep: `src/main.ts:77` (boot, from the persisted
  `ui.locale`), `src/views/SettingsView.vue:70` (`changeLocale`, paired
  with `ui.locale = code` at the next line — the store watcher persists
  it), `src/components/importexport/WorkspaceArchiveDialog.vue:125`
  (backup-import preference apply), `src/stores/embed.ts:33` (host
  `locale` config, session-only — never written to `ui` store, see next
  section). No other callers exist; this feature adds no new caller — the
  first-run detection path (Decision 6, `shape.md`) still goes through
  `setLocale` at `main.ts:77`, just after possibly overwriting `ui.locale`
  first.

## `src/stores/embed.ts` and `src/embed/protocol.ts` — confirmed no change needed

- `EmbedConfig.locale?: string` already exists (`protocol.ts:37`, comment
  "BCP-47 UI language tag, e.g. 'en'"). An embed host that sets `locale:
  'fr'` today would already flow through `setLocale('fr')` at
  `embed.ts:33` (`if (partial.locale !== undefined) setLocale(partial.locale)`)
  — it just had no matching catalog to resolve to (vue-i18n falls back to
  `en` silently via `fallbackLocale`). Registering the catalogs is the only
  change needed for embed hosts to gain real French/Spanish; the protocol
  and the embed store are both already correct and stay untouched.
- Embed sessions **never** run the first-run auto-detection (Decision 6) —
  they always pass `locale` explicitly (or omit it and get `en`, unchanged
  behaviour), and `main.ts`'s embed branch (`:58-74`) returns before the
  non-embed-only detection block would run (see next section).

## `src/main.ts` — boot sequence (confirmed exact lines for Task 6 in `plan.md`)

- `embed.active` branch (`:58-74`) runs the memory backend + embed bridge
  and is fully separate from the non-embed branch (`:68-74`, the
  `migrateLegacyDb` call).
- `setLocale(useUiStore(pinia).locale)` at `:77` is the **single existing
  line** the first-run auto-detection inserts before. It runs
  unconditionally today (both embed and non-embed paths reach it) — the
  new detection logic must be gated to the **non-embed** path only (an
  `if (!embed.active) { … }` guard around the detection block, or
  equivalently placed inside the existing `else` branch at `:68-74` before
  it closes — either works; `plan.md` picks the explicit `!embed.active`
  guard directly above line 77 for locality).
- `initThemeController(useUiStore(pinia))` at `:81` — unrelated, unaffected
  by this feature.

## `src/stores/ui.ts` — locale persistence internals

- `STORAGE_KEY = 'odk-builder:ui:v1'` (`:14`, pre-rebrand key kept on
  purpose), `STORAGE_VERSION = 1` (`:15`).
- `loadPersisted()` (`:70-83`): returns `{}` when `localStorage.getItem`
  is `null` (never-visited browser) **or** when the stored blob's
  `version` doesn't match `STORAGE_VERSION` **or** on any parse error —
  in all three cases `persisted.locale` is `undefined`, indistinguishable
  from "an older stored blob that predates the `locale` field ever being
  added." Both cases are legitimately "no preference was ever chosen" and
  should trigger auto-detection.
- `locale = ref(typeof persisted.locale === 'string' && persisted.locale
  !== '' ? persisted.locale : 'en')` (`:105`) — the exact guard the new
  `localeWasStored` flag (Task 6) must reuse so the two never disagree:
  `const localeWasStored = typeof persisted.locale === 'string' &&
  persisted.locale !== ''`, computed once at store-setup time, right after
  this line.
- The `watch([...])` block (`:203-227`) persists on any tracked ref
  change, `locale` included (`:204`) — unaffected; `localeWasStored` is a
  plain boolean, not a ref, and is not added to the watch list (it only
  needs to be read once, at boot).
- Return statement (`:229-250`) — `localeWasStored` is added to the
  returned object alongside `locale` (`:236`), read-only from the outside
  (no setter needed; `main.ts` only ever reads it once).
- `exportPreferences`/`applyPreferences` (`:159-201`) already treat
  `locale` as an opaque validated string — no changes needed for `fr`/`es`
  values to round-trip through a workspace backup's `preferences.json`.
- Existing spec coverage: `src/stores/ui.spec.ts`, `describe('ui store
  locale persistence', …)` (`:12` onward) already covers persist/restore/
  default/empty-string cases with an explicit `STORAGE_KEY` seed — Task 6
  extends this exact `describe` block with `localeWasStored` assertions
  for the same four scenarios (nothing stored, valid stored, empty-string
  stored, version-mismatch stored).

## `src/views/SettingsView.vue`

- `languages = computed(() => localeOptions())` (`:67`) and the `<Select
  data-testid="settings-language-select" ... />` (`:165-174`) already
  render whatever `localeOptions()` returns — **no edit needed** once `fr`/
  `es` are registered.
- `changeLocale` (`:69-72`): `setLocale(code); ui.locale = code` — the
  pattern any new call site (there is none needed here) would follow.
- `tests/e2e/settings.spec.ts:15` currently asserts
  `page.getByTestId('settings-language-select')).toContainText('English')`
  — still true and unaffected (English stays the default-locale value in
  that test's fresh-session context); the new e2e cases (Task 7) are
  additional tests, not edits to this line.

## Mixed-language surfaces — the actual, verified scope (corrects the backlog doc)

The backlog doc's "current implementation" section said the help drawer's
"registry-driven tables" render English "by policy." True, but the scope
is **narrower** than "the help drawer" — most of the help drawer **is** a
normal, fully translatable catalog namespace:

- `src/help/content.ts` (`:1-9` doc-comment): "the actual English text
  lives in the i18n catalog (`src/i18n/locales/en/help.json` and
  `guides.json`); this module is the typed index into it." `typeHelp`
  (`:28-67`) and `fieldHelp` (`:73-94`) map registry keys to `MessageKey`s
  — e.g. `help.types.text.whatItDoes` — which **are** ordinary catalog
  strings, translated like any other namespace content.
- What actually stays English, confirmed by grep against
  `src/components/`: `src/components/palette/QuestionPalette.vue:51`
  (`v-tooltip.right="def.description"`) and `:58`
  (`<span>{{ def.title }}</span>`) render `QuestionTypeDefinition.title`/
  `.description` straight from `src/core/registry/question-types.ts`
  (`:127-128` etc. — plain English string literals, e.g. `title: 'Text',
  description: 'Prompt for a free-text response'`). Same registry fields
  render in `src/components/properties/PropertyPanel.vue:77` (type-picker
  header) and `src/components/properties/TypeConfigSection.vue:236,239`
  (`v-tooltip.left="param.description"`, parameter-row tooltips).
- The help drawer's own appearance/parameter tables
  (`src/components/help/QuestionTypeHelpContent.vue:38-85`) are the
  clearest example of the **mixed** surface in one place: column headers
  (`t('help.ui.drawer.colName')` etc., `:38-40,68-70`) are ordinary
  translated catalog strings, but the **cell values** —
  `appearance.description` (`:51`) and `param.description` (`:80`) — come
  straight from the same core registry and stay English inside an
  otherwise-translated table.
- `Issue` messages (`src/core/validate/issues.ts`, rendered verbatim in
  `ProblemsButton` and inline field errors per `CLAUDE.md`'s hard
  invariant) are the other stable English surface — unaffected by, and
  unrelated to, the help drawer.

`user-guide.md` documents exactly this corrected, narrower list.

## ODK ecosystem glossary sources (fetched 2026-07-16)

- `getodk/central-frontend`, `apps/central/src/locales/fr.json` /
  `es.json` (master branch) — Central's own shipped French/Spanish admin
  UI. Confirmed terms: `plural.form` → `Formulaire | Formulaires |
  Formulaires` (fr) / `Formulario | Formularios | Formularios` (es);
  `resource.submission` → `Soumission` (fr) / `Envío` (es);
  `audit.action.form.update_publish` → `Publier l'ébauche` (fr) /
  `Publicar borrador` (es) — confirms **draft = ébauche/borrador**,
  **publish = publier/publicar**; `resource.formAttachments` → `Fichiers
  joints du formulaire` (fr) / `Adjuntos de formulario` (es);
  `resource.config` → `Configuration du serveur` (fr) / `Configuración del
  servidor` (es); `resource.entityList` → `Liste d'entités` (fr) / `Lista
  de entidades` (es); `resource.formPreview` → `Aperçu du Formulaire` (fr)
  / `Vista previa del formulario` (es).
- `getodk/collect`, `strings/src/main/res/values-{fr,es}/strings.xml`
  (master branch) — Collect's Android app, form-*filling* vocabulary:
  `required_answer_error` → `Réponse obligatoire!` (fr) / `¡Respuesta
  obligatoria!` (es) — confirms **required = obligatoire/obligatorio**;
  `choices` → `Choix` (fr) / `Opciones` (es); `constraint_behavior_title`
  → `Traitement de contraintes` (fr) / `Manejo de restricciones` (es);
  `guidance_hint_title` → `Afficher les instructions supplémentaires
  (guidance hints)` (fr, notably keeping the English term parenthetically)
  / `Mostrar guías de preguntas` (es).
- Neither source covers form-*authoring* vocabulary specific to this app
  (appearance, skip logic/`relevant`, choice-list *file*, itemset) since
  Central doesn't build forms and Collect only fills them — `glossary.md`
  (Task 1 in `plan.md`) coins these consistently with the confirmed terms
  above (e.g. following `constraint_behavior` → `contrainte`/`restricción`
  for the noun "constraint" used elsewhere in the properties panel).

## Related delivered specs worth reading

- `docs/specs/2026-07-10-2006-translation-coverage/` — the i18n foundation
  itself: the typed catalog, `no-missing-keys`, the registration-driven
  picker, `setLocale`, the embed `locale` key. This feature is a pure
  content addition on top of that infrastructure — no schema/mechanism
  changes.
- `docs/specs/2026-07-10-2007-in-app-guidance/` — delivered the
  `guides.json` content and the help drawer's Guides section; useful
  context for what that namespace's strings look like and where they
  render, since it's one of the two largest files to translate.
- `docs/specs/2026-07-09-2235-embed-postmessage-api/` — the `locale`
  embed config key (`user-guide.md:75,91`) this feature's docs sweep
  updates with an `fr`/`es` example, with no protocol change.
- `docs/specs/2026-07-15-1729-workspace-full-backup/` — the
  `preferences.json` section that already carries `ui.locale` through a
  whole-workspace backup; a good model for the shape/plan/references/
  standards/user-guide doc set this promotion follows.
