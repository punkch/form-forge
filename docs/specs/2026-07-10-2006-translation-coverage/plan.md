# Plan — Full translation coverage & discoverable per-language editing (2026-07-10)

## Context

Promoted from `docs/specs/backlog/translation-coverage.md`. ODK/XLSForm allows
the `::Language (code)` suffix on labels, hints, guidance hints, constraint and
required messages, the four media columns, and choice labels + choice media.
The native engine already round-trips **all** of these: `transformLocalizedTexts`
walks every `LocalizedText`, the XLSForm writer's `putLocalized`/`putMedia`
and reader's `localizedValue`/`readMedia` handle per-language columns, and the
XForm serializer emits itext for every one. **The gap is only in the UI** — the
translation grid hides empty/media sites, and the properties panel's localized
inputs are inconsistent and undiscoverable. Scope, the six resolved decisions,
and out-of-scope items are in `shape.md`; reusable patterns and exact file
roles are in `references.md`; invariants in `standards.md`.

**Key de-risking fact:** no change to `src/core/xform/`, `src/core/xlsform/`,
or `tests/golden/` is required or expected. The serializer stays pinned to
pyxform 4.5.0 and its golden gates stay green untouched. If a golden diff
appears during implementation, treat it as a regression to investigate, not to
regenerate.

Branch note: CLAUDE.md says "work on development" but no such branch exists and
all recent work + release-please target `main` — commits go to `main`, matching
actual practice.

## Parallelization overview

Four work packages, no two editing the same file. The core package (WP1) is the
only dependency for the grid package (WP3); the properties package (WP2) is
independent of WP1 (it uses existing `display.ts` + the editor store). WP4
integrates.

```
Wave 1 (parallel):   WP1 core            WP2 properties panel
Wave 2:              WP3 grid  (needs WP1)      (WP2 continues / done)
Wave 3:              WP4 integration + e2e + verify  (needs WP1, WP2, WP3)
```

- **WP1 → WP3:** WP3 renders the new site kinds (media) and relevance-driven
  rows produced by WP1's `collectTranslationSites`/`setSiteText`/`siteKey`.
- **WP2** touches only `src/components/properties/*`, two new shared files, the
  properties + help i18n, and properties component tests — nothing WP1/WP3 own.
- **WP4** is the only package that edits `tests/e2e/translations.spec.ts` and
  runs the full suite; it should need **no** product-source edits (only a
  test-fix touch if integration surfaces one, coordinated with the owning WP).

File ownership (authoritative — an agent edits only files under its WP):

| File | WP |
| --- | --- |
| `src/core/model/translations.ts` | WP1 |
| `src/core/model/translations.spec.ts` | WP1 |
| `tests/unit/translation-roundtrip.spec.ts` (new) | WP1 |
| `src/composables/useEditingLanguage.ts` (new) | WP2 |
| `src/components/properties/LocalizedInput.vue` (new) | WP2 |
| `src/components/properties/BasicSection.vue` | WP2 |
| `src/components/properties/LogicSection.vue` | WP2 |
| `src/components/properties/ChoicesSection.vue` | WP2 |
| `src/components/properties/PropertyPanel.vue` | WP2 |
| `src/i18n/locales/en/properties.json` | WP2 |
| `src/help/content.ts` | WP2 |
| `src/i18n/locales/en/help.json` | WP2 |
| `tests/component/display-language.spec.ts` | WP2 |
| `tests/component/property-panel.spec.ts` | WP2 |
| `tests/component/localized-input.spec.ts` (new) | WP2 |
| `src/components/translations/TranslationGrid.vue` | WP3 |
| `src/i18n/locales/en/dialogs.json` | WP3 |
| `tests/component/translations.spec.ts` | WP3 |
| `tests/e2e/translations.spec.ts` | WP4 |

---

## Task 1: Save spec documentation — DONE

`docs/specs/2026-07-10-2006-translation-coverage/` with plan.md (this file),
shape.md, standards.md, references.md, user-guide.md. No visuals (structural
change; none provided).

---

## Task 2 (WP1): Core — relevance-driven sites, media refs, expanded set

**Files owned:** `src/core/model/translations.ts`,
`src/core/model/translations.spec.ts`, `tests/unit/translation-roundtrip.spec.ts` (new).

**Depends on:** nothing. **Blocks:** WP3.

Pure TypeScript only — no Vue/Pinia/i18n imports (CLAUDE.md invariant). Keep all
existing exports' names/signatures stable except where extended below; the grid
and the existing spec import them.

1. **Media slot type + titles.** Add
   `export type MediaSlot = 'image' | 'audio' | 'video' | 'bigImage'`
   (align with `MediaRefs` keys in `types.ts`). Add
   `const MEDIA_SLOT_TITLES: Record<MediaSlot, string>` =
   `{ image: 'Image', audio: 'Audio', video: 'Video', bigImage: 'Big image' }`
   (English context strings, rendered verbatim in the grid like the existing
   `NODE_FIELD_TITLES` — this is the same "core emits English display strings"
   pattern as `Issue.message`, not a localized string).

2. **Extend `TranslationSiteRef`** to a four-way union:
   ```ts
   export type TranslationSiteRef =
     | { kind: 'node', nodeId: string, field: NodeTextField }
     | { kind: 'node-media', nodeId: string, slot: MediaSlot }
     | { kind: 'choice', listName: string, choiceIndex: number }
     | { kind: 'choice-media', listName: string, choiceIndex: number, slot: MediaSlot }
   ```

3. **`siteKey`** — extend to cover the two new kinds with stable, distinct keys,
   e.g. `node-media:${nodeId}.${slot}` and
   `choice-media:${listName}[${choiceIndex}].${slot}`. Keep existing `node:`/
   `choice:` keys byte-identical (the grid's `data-testid="row-…"`/`cell-…`
   depend on them — see `references.md`).

4. **`collectTranslationSites` — relevance rule replaces `hasAnyValue`.** For
   each node in document order push sites in this order:
   - `label` — **always** (question, group, repeat).
   - `hint` — **always**.
   - `constraintMessage` — when `node.bind.constraint` is a non-empty string.
   - `requiredMessage` — when `node.bind.required` is a non-empty string.
   - `guidanceHint` — **always** (grid hides it behind the toggle; see below).
   - node media: for each `MediaSlot`, a `node-media` site **only when
     `node.media?.[slot]` has a value in at least one language** (reuse the
     existing `hasAnyValue` predicate for media only).

   Then per choice list, in order: `label` when it has any value (keep the
   current behaviour — a choice with no label yet is not a translation site;
   `label` is not "always" for choices because empty choices are common and
   authored in `ChoicesSection`, not the grid), then `choice-media` sites where
   a media ref exists.

   Context strings:
   - node text: `` `${node.name} · ${NODE_FIELD_TITLES[field]}` `` (unchanged).
   - node media: `` `${node.name} · ${MEDIA_SLOT_TITLES[slot]}` ``.
   - choice label: `` `${list.name} / ${choice.name}` `` (unchanged).
   - choice media: `` `${list.name} / ${choice.name} · ${MEDIA_SLOT_TITLES[slot]}` ``.

   Export a predicate/constant the grid uses to hide rarely-used rows without
   re-deriving field knowledge:
   `export const RARELY_USED_FIELDS: readonly NodeTextField[] = ['guidanceHint']`
   plus a tiny helper `export const isRarelyUsedSite = (ref: TranslationSiteRef): boolean`
   returning true for `kind === 'node'` refs whose `field` is in
   `RARELY_USED_FIELDS`. (Keeps the "which fields are rare" knowledge in core;
   the grid just filters.)

5. **`setSiteText`** — handle `node-media` and `choice-media`:
   - resolve node/choice as today; get/create `owner.media ??= {}`;
     `owner.media[slot] = setText(owner.media[slot], value, lang)`; if that
     becomes `undefined`, `delete owner.media[slot]`; if `media` is then an
     empty object, `delete owner.media`. This keeps a cleared media translation
     from leaving `{}` debris (matches how `removeLanguage` expects clean media —
     see `translations.spec.ts` "strips media refs" case). Reuse `setText` from
     `display.ts` so the "empty removes only that lang key" semantics are shared.

6. **`translationStats`** — no signature change; it already counts over whatever
   site list it is handed. The grid will hand it the visible (toggle-filtered)
   list.

7. **Tests — `translations.spec.ts` (extend):**
   - `collectTranslationSites` now emits label + hint for a question with no
     values (was: skipped) — update the existing "skips sites with no value"
     test to the new contract (label + hint always present; still no constraint/
     required/guidance rows without their triggers).
   - constraint-message site appears iff `bind.constraint` set; required-message
     iff `bind.required` set.
   - guidance-hint site always emitted; `isRarelyUsedSite` true for it, false for
     label/hint/messages/media/choice.
   - node media + choice media sites appear only where a ref exists; context
     strings exact.
   - `setSiteText` writes/removes `node-media` and `choice-media`; clearing the
     last media value removes the slot and then `node.media`.
   - `siteKey` distinct+stable across all four kinds.
   - Update the existing `translationStats` counts (the sample doc now yields
     more sites — recompute expected totals).

8. **Tests — `tests/unit/translation-roundtrip.spec.ts` (new)** — proves the
   acceptance round-trips end-to-end through the *existing* core (no writer/
   reader change): build a `FormDocument` with (a) a **French-only hint** (no
   default), (b) a node `image::French (fr)` ref, then:
   - `writeXlsform` → `readXlsform` deep-equals the input for those fields
     (French-only hint preserved; `image` media round-trips) — import the real
     `src/core/xlsform` entry points used elsewhere (see `references.md`).
   - `serialize` (XForm) → `parse` preserves the French-only hint's itext.
   - byte-stability: `readXlsform(bytes)` then `writeXlsform` yields a workbook
     whose `image::French (fr)` column matches (compare the canonical row model,
     as the writer specs do). Use `tests/helpers/xml-canonicalize` for the XForm
     side.

**Acceptance covered here:** French-only hint round-trips XLSForm + XForm;
`image::French (fr)` round-trips byte-stable; grid site set is the expanded
list; clearing a media translation removes only that language key.

---

## Task 3 (WP2): Properties panel — language-aware everywhere

**Files owned:** `src/composables/useEditingLanguage.ts` (new),
`src/components/properties/LocalizedInput.vue` (new), `BasicSection.vue`,
`LogicSection.vue`, `ChoicesSection.vue`, `PropertyPanel.vue`,
`src/i18n/locales/en/properties.json`, `src/help/content.ts`,
`src/i18n/locales/en/help.json`, `tests/component/display-language.spec.ts`,
`tests/component/property-panel.spec.ts`,
`tests/component/localized-input.spec.ts` (new).

**Depends on:** nothing (existing `display.ts` + editor store). **Blocks:** WP4.

1. **`useEditingLanguage()` composable.** Wraps the editor store:
   - `editingLang: ComputedRef<Lang>` = `editor.displayLanguage ?? DEFAULT_LANG`.
   - `isTranslating: ComputedRef<boolean>` = a non-default language is selected
     (`editor.displayLanguage !== null`).
   - `languageBadge: ComputedRef<string | null>` = the selected language key
     when translating, else `null` (the badge caption; the key like
     `French (fr)` is already human-readable — no i18n needed for the value).
   - `options: ComputedRef<{ label, value }[]>` mirroring the dialog's
     `displayLanguageOptions` (Default sentinel `value: null` + each
     `doc.languages`) for the panel control — but the "Default" label is i18n,
     so accept a translator or compute options in the component. Simpler: expose
     only the state here and build options in `PropertyPanel.vue` with `t(...)`.
     **Decide in code**; keep the composable Vue-only (it's a composable, not
     core) and free of i18n if options are built in the component.

2. **`LocalizedInput.vue` shared component.** Props:
   `modelValue: LocalizedText | undefined`, `multiline?: boolean`,
   `placeholder?: string`, `dataTestid?: string`, plus pass-through invalid/rows
   as needed; emits `update:modelValue` **as the raw typed string** (the parent
   owns the `setText` call + undo label so per-field undo strings stay correct),
   OR emit the already-`setText`-applied `LocalizedText` — **decide in code**;
   recommended: emit the typed string and expose the resolved `editingLang` so
   the parent writes `setText(text, value, editingLang)` inside its
   `updateNode`. Behaviour:
   - Renders `InputText` (single) or `Textarea auto-resize rows=1` (multiline)
     to match today's label (Textarea) vs hint/message (InputText).
   - **Value = `exactText(modelValue, editingLang)`** — never `displayText`. The
     fallback is *not* shown as editable text.
   - **Placeholder:** when `isTranslating` and the selected language is empty,
     show `displayText(modelValue)` (the fallback, i.e. default/first non-empty)
     as the placeholder; otherwise the caller's `placeholder`.
   - **Badge:** when `isTranslating`, render a small inline language badge
     (`languageBadge`) so the editor can see which language this input writes.
     Give it a class + a `data-testid` like `${dataTestid}-lang-badge`.
   - Preserve each field's existing `data-testid` on the actual input element
     (`prop-label`, `prop-hint`, `prop-constraint-message`, `choice-label-${i}`)
     so e2e/component selectors keep working (CLAUDE.md).

3. **`BasicSection.vue`** — replace the hand-rolled label + hint inputs with
   `LocalizedInput` (`multiline` for label). Add a **guidance-hint**
   `LocalizedInput` under hint, shown under the same `showLabel` condition
   (question/group, not meta/calculate). Wire through `updateNode` with a new
   undo label `properties.basic.undoEditGuidanceHint`. Keep name/default/toggles
   exactly as-is. Remove the now-unused local `editLang`/`displayText` label
   plumbing if fully superseded by the composable.

4. **`LogicSection.vue`** — the constraint-message input becomes a
   `LocalizedInput` that writes the **editing language** (today it calls
   `setText(...)` with no lang → always default; the fix is to pass
   `editingLang`). Add a **required-message** `LocalizedInput`, shown when
   `node.bind.required` is set (mirrors the constraint-message `v-if`), new undo
   label `properties.logic.undoEditRequiredMessage`, writing
   `n.bind.requiredMessage = setText(n.bind.requiredMessage, value, editingLang)`.

5. **`ChoicesSection.vue`** — the per-choice label input becomes a
   `LocalizedInput` writing `editingLang` (today `setChoiceLabel` uses `setText`
   with no lang → always default). Keep the drag/name/add/remove logic and the
   `coalesce` mutate path unchanged; only the label write becomes language-aware.

6. **`PropertyPanel.vue`** — add a **compact editing-language control** below the
   `.property-header`, rendered only when `form.doc.languages.length > 0`. A
   PrimeVue `Select` bound to `editor.displayLanguage` with options
   `[{ label: t('…default…'), value: null }, ...languages]` — identical state to
   the dialog's "Show in editor". `data-testid="panel-editing-language"`. When
   no languages exist, render nothing (monolingual forms see no new chrome).

7. **i18n — `properties.json`:** add
   `basic.guidanceHint`, `basic.undoEditGuidanceHint`,
   `logic.requiredMessage`, `logic.undoEditRequiredMessage`,
   and panel keys under a new `panel.editingLanguage` group
   (`label`/`ariaLabel`, and a "Default" option label — or reuse an existing
   default-language label; check `dialogs.translations.defaultOption` and mirror
   its English exactly to avoid drift). Add a `LocalizedInput` badge aria key if
   the badge needs a label (`properties.panel.editingLanguageBadge` →
   e.g. "Editing {lang}").

8. **Help — `src/help/content.ts` + `help.json`:** add `guidanceHint` and
   `requiredMessage` entries to `fieldHelp` (so the new inputs can carry a
   `HelpPopover field="guidanceHint"` / `field="requiredMessage"`), each with
   `help.fields.<key>.whatItIs` + `.xlsformColumn` strings in `help.json`
   (columns: `guidance_hint`, `required_message`). This keeps `HelpFieldKey`
   exhaustive and avoids a runtime lookup miss.

9. **Tests:**
   - `tests/component/localized-input.spec.ts` (new): value shows the selected
     language exactly; empty selected language → input empty + fallback in
     placeholder (assert `placeholder` attr, not value); typing emits the string
     / writes only the selected language; badge visible only when translating;
     `data-testid` preserved.
   - `tests/component/display-language.spec.ts` (extend): the existing
     BasicSection cases stay green (node has an FR value). Add: with FR selected
     and FR **empty**, the label input value is `''` and the fallback is in the
     placeholder (the deliberate behaviour change); hint + guidance-hint honour
     the editing language; constraint message and choice label now write the
     selected language (regression for the two "always wrote default" bugs).
   - `tests/component/property-panel.spec.ts` (extend): `panel-editing-language`
     is absent with 0 languages, present with ≥1, and toggling it updates
     `editor.displayLanguage` (and is reflected by a localized input).

**Acceptance covered here:** with "French (fr)" selected the panel visibly
indicates it (badge + control), typing a constraint message writes the French
key not default, clearing an input removes only the French key.

---

## Task 4 (WP3): Translation grid — completeness, media, rarely-used toggle

**Files owned:** `src/components/translations/TranslationGrid.vue`,
`src/i18n/locales/en/dialogs.json`, `tests/component/translations.spec.ts`.

**Depends on:** WP1. **Blocks:** WP4.

1. **Rows come from the expanded `collectTranslationSites`.** No change to how
   `sites` is computed (still `collectTranslationSites(form.doc)`), but it now
   returns the fuller set (WP1). Grid cells already use `exactText` (no
   fallback) — correct as-is; keep that.

2. **"Show rarely-used fields" toggle** in `.grid-toolbar` (next to the existing
   "untranslated only" checkbox). Component-local `ref(false)`. Compute
   `baseSites = showRarelyUsed ? sites : sites.filter(s => !isRarelyUsedSite(s.ref))`
   (import `isRarelyUsedSite` from core). `rows` = `untranslatedOnly` filter over
   `baseSites`. **Stats compute over `baseSites`** (the expanded, toggle-aware,
   but untranslated-filter-independent list) so `translated/total` matches what
   the toggle exposes — decision 6.

3. **Media rows** render with the same `InputText` cell as text rows (media
   cells are free-text filenames — decision 2). The context column already
   distinguishes them (`age · Image`, `states / tx · Image`). No picker. Give
   the cells the same `data-testid` shape (`cell-${siteKey}-${lang}` /
   `-default`) via the extended `siteKey`. Optionally add a subtle "filename"
   affordance (class or placeholder) — keep minimal.

4. **i18n — `dialogs.json`:** add `translationGrid.showRarelyUsed`
   (e.g. "Show rarely-used fields"). Do **not** add media/field context strings
   here — those come from core (English, verbatim), like `Issue.message`.

5. **Tests — `translations.spec.ts` (extend):**
   - A question with only a label now shows label **and** hint rows (empty hint
     cell editable) — the core-completeness reaching the grid.
   - A constraint set with no message shows an editable constraint-message row;
     a required question shows a required-message row.
   - guidance-hint row hidden by default; visible after toggling
     "Show rarely-used fields"; stats denominator grows when toggled on.
   - A node with an `image` ref shows a media row; editing its FR cell writes the
     filename to `node.media.image['French (fr)']`.
   - Completeness `x/total` reflects `baseSites` and is independent of
     "untranslated only".
   - Keep the existing dialog tests (add-language, migration, remove) green —
     they live in the same file but test `TranslationsDialog` (unowned here but
     unchanged).

**Acceptance covered here:** a form with a constraint but no message shows an
editable constraint-message row; grid completeness stats count the expanded
site list; media refs surface as editable filename rows.

---

## Task 5 (WP4): Integration, e2e, verification

**Files owned:** `tests/e2e/translations.spec.ts`. Runs the full suite; expects
**no product-source edits** (only a coordinated test-fix if integration surfaces
one).

**Depends on:** WP1, WP2, WP3.

1. **e2e — extend `tests/e2e/translations.spec.ts`** (Playwright, preserve
   existing tests):
   - Add a text question with a constraint (via the logic section) but no
     message; open Translations; assert an editable constraint-message row
     exists for it and fill a default + French value.
   - Enter a **French-only hint** in the grid (leave default empty), export
     XLSForm, re-import it, and assert the French hint survived (round-trip at
     the app level; complements WP1's unit round-trip).
   - Select "French (fr)" as the panel editing language; assert
     `panel-editing-language` shows it and the label input carries the language
     badge; type a constraint message and assert the exported itext has the
     French `required`/`constraint` message under the French translation only.
   - Clear a French input in the panel; assert the default value remains
     (only the French key removed).
   - Reuse `tests/e2e/helpers.ts` (`createForm`, `addQuestion`); keep asserted
     English substrings byte-stable with the new i18n copy.

2. **Cross-backend check.** The acceptance line "stats count the expanded site
   list on both backends' persisted docs" is satisfied because
   `collectTranslationSites` is pure and backend-agnostic; add/confirm a check
   (component or unit) that runs the collect over a doc persisted+reloaded
   through `tests/helpers/backends.ts` if not already implied. If the existing
   backend parametrization doesn't reach this path, note it and add a minimal
   assertion; do **not** restructure the backend seam.

3. **Verification commands (all must pass):**
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm test:coverage      # floors: core 86/78/88, stores 80/85, persistence 90/92
   pnpm test:e2e           # chromium + firefox vs built app
   ```
   Golden gates run inside `pnpm test`; they must stay **green and unchanged**
   (no `make-goldens.py` run — regeneration is a deliberate act and is *not*
   part of this work). Confirm `git status` shows no diff under `tests/golden/`.

4. **Agent-browser manual pass** (per delivery process): add a language, verify
   the grid shows always-on label/hint rows, a constraint-message row, media
   rows, and the rarely-used toggle; verify the panel editing-language control +
   badge + placeholder-fallback; export and re-import. Log to
   `docs/verification/` with screenshots.

5. **Docs (delivery process):** update `README.md` Features (✅ translation
   coverage), `docs/product/roadmap.md`, and `CLAUDE.md` (translations module
   note if signatures changed), and remove/park
   `docs/specs/backlog/translation-coverage.md` per the promotion convention.
   Then `/code-review` (five lenses, no plan mode), fix findings, conventional
   commit.

---

## Acceptance criteria (from the backlog doc — mapped to packages)

- Constraint set, no message → editable constraint-message row in the grid. **WP3**
- French-only hint round-trips XLSForm export/import and XForm serialize/parse. **WP1** (unit) + **WP4** (e2e)
- `image::French (fr)` imports, appears in the grid, re-exports byte-stable. **WP1** (byte-stable unit) + **WP3** (appears) + **WP4** (import path)
- "French (fr)" selected → panel visibly indicates it; typing a constraint
  message writes the French key (not default). **WP2** + **WP4**
- Clearing an input removes only the French key. **WP2** (panel) + **WP1** (`setText` semantics) + **WP4** (e2e)
- Grid completeness stats count the expanded site list on both backends'
  persisted docs. **WP1** (pure collect) + **WP3** (stats over baseSites) + **WP4** (cross-backend)

## Risks / watch-items

- **Behaviour change:** localized inputs stop showing the fallback as editable
  text in translate-mode. Any existing assertion expecting the fallback *in the
  input value* must move to the placeholder. Audited: `display-language.spec.ts`
  BasicSection cases use a node that has the FR value, so they stay green; the
  change is additive there.
- **`siteKey` stability:** existing `node:`/`choice:` keys must stay byte-
  identical (grid testids + per-cell undo coalescing depend on them). Only *add*
  media key forms.
- **Empty-media cleanup:** `setSiteText` must delete an emptied media slot and an
  emptied `media` object so `removeLanguage`'s "strips media refs" expectation
  and re-collection stay correct.
- **i18n default-label drift:** the panel's "Default" option English must match
  the dialog's `dialogs.translations.defaultOption` to avoid two different
  strings for the same concept (tests assert English).
- **No golden regen.** If serializer output changes, a real bug was introduced —
  investigate, do not regenerate.
