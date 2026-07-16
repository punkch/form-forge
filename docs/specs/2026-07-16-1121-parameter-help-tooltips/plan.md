# Parameter-specific help popovers — Plan

## Context

Every type-specific parameter row in the properties panel — audit's
"Location priority"/"Location min interval"/"Track changes", range's
"Start"/"End"/"Step", image's "Max pixels", a select's "Randomize"/"Seed" —
renders the same generic "?" popover today: the `fieldHelp.parameters` entry,
which describes the XLSForm `parameters` *column* in the abstract and tells
the user nothing about the specific row they're filling in — not the unit,
not the allowed tokens, not the default, not the exact `parameters`-column key
it maps to. The information already exists on the registry
(`QuestionTypeParameter.description`/`options`/`defaultValue`/`required` in
`src/core/registry/question-types.ts`) and the help drawer's PARAMETERS table
already renders it in full — it just never reaches the field where the user
is typing. This feature makes the popover parameter-specific, sourced from
the same registry metadata, so the two surfaces (drawer, popover) can never
drift. A registry metadata audit against docs.getodk.org rides along as a
separate, data-only commit.

Two current bugs get fixed as a side effect: every parameter row in a section
today renders `data-testid="field-help-parameters"` (a duplicate id within
one panel), and boolean parameters with `defaultValue: false` have no
explicit "what happens if I leave this unchecked" affordance beyond the
checkbox itself.

## Resolved decisions (settled, not to be revisited)

1. The registry (`QuestionTypeParameter`) is the only source the popover
   reads — no parallel help catalog for parameters.
2. The `v-tooltip.left="param.description"` hover on the label stays
   unchanged; the popover becomes the complete, accessible surface
   alongside it.
3. The generic `help.fields.parameters` entry (`help.json:210-213`,
   `content.ts:79`) is deleted in the same change that removes its only call
   sites (`TypeConfigSection.vue:236,239`).
4. `paramPlaceholder` keeps showing the default in the input; the popover's
   "Default" line is additive.
5. Boolean parameters show "Default: false" explicitly — the popover checks
   `param.defaultValue !== undefined`, never truthiness, so `false` renders.
6. The registry metadata audit is a separate commit, data-only
   (`description`/`options`/`defaultValue` — never parameter `name`s or any
   value a form actually serializes), so `tests/golden/` needs no
   regeneration.
7. The options list renders in the popover even when the input itself is
   already a `Select` showing the same tokens (the Select shows tokens
   without meaning or the XLSForm-key mapping).
8. Component shape: extend `HelpPopover.vue` with an optional
   `param?: QuestionTypeParameter` prop (not a sibling component) — the two
   modes are mutually exclusive per call site and share the trigger/Popover/
   CSS chrome; only the body branches.

## Task 1 — Extend `HelpPopover.vue` with a `param` mode

**File:** `src/components/help/HelpPopover.vue`

- Add `param?: QuestionTypeParameter` to `defineProps`, importing the type
  from `@/core/registry/question-types`. `field` becomes optional too
  (`field?: HelpFieldKey`) — a given instance receives exactly one of the
  two; callers never pass both.
- Replace the single `field`-keyed testid/body with two computed ids and a
  template branch:

  ```ts
  const testId = computed(() =>
    props.param !== undefined ? `field-help-param-${props.param.name}` : `field-help-${props.field}`
  )
  const bodyTestId = computed(() =>
    props.param !== undefined ? `field-help-body-param-${props.param.name}` : `field-help-body-${props.field}`
  )
  const entry = computed(() => (props.field !== undefined ? fieldHelp[props.field] : undefined))
  ```

  The trigger `<span>` keeps its existing markup/handlers/`aria-label`
  verbatim (`:data-testid="testId"` replaces the current inline template
  literal); nothing about the not-a-`<button>` rationale changes.

- Template body — branch on `param`:

  ```html
  <div v-if="param" class="help-popover-body" :data-testid="bodyTestId">
    <p>{{ param.description }}</p>
    <p v-if="param.options" class="help-popover-column">
      <span>{{ t('help.ui.popover.optionsLabel') }}</span>
      <code>{{ param.options.join(', ') }}</code>
    </p>
    <p v-if="param.defaultValue !== undefined" class="help-popover-column">
      <span>{{ t('help.ui.popover.defaultLabel') }}</span>
      <code>{{ String(param.defaultValue) }}</code>
    </p>
    <p v-if="param.required" class="help-popover-required">{{ t('help.ui.popover.requiredLabel') }}</p>
    <p class="help-popover-column">{{ t('help.ui.popover.parameterMapping', { name: param.name }) }}</p>
    <p class="help-popover-hint">{{ t('help.ui.popover.syntaxHint') }}</p>
  </div>
  <div v-else class="help-popover-body" :data-testid="bodyTestId">
    <p>{{ t(entry!.whatItIs) }}</p>
    <p class="help-popover-column">
      <span>{{ t('help.ui.popover.xlsformColumn') }}</span>
      <code>{{ t(entry!.xlsformColumn) }}</code>
    </p>
  </div>
  ```

  (The `field`-mode branch is the existing markup, unchanged in substance —
  only reindented under `v-else` and repointed at `bodyTestId`.)

- CSS: add `.help-popover-required` (reuse existing typography — no new
  color, inherits `.help-popover-body p`'s `line-height`; add
  `font-weight: 500` to read as a light label) and `.help-popover-hint`
  (`color: var(--odk-muted-text-color); font-size: 0.85em;`) to the scoped
  `<style>` block. Both reuse `--odk-*` tokens already referenced elsewhere
  in this file — no new bare custom property, so the stylelint
  `value-no-unknown-custom-properties` gate needs no allowlist change.
- `.help-popover-column` (existing class) is reused for the options/default
  rows and the `parameterMapping` line — no new class needed for those.

## Task 2 — i18n catalog: add popover keys, remove the generic entry

**Files:** `src/i18n/locales/en/help.json`, `src/help/content.ts`

- Add under the existing `help.ui.popover` object (`help.json:31-33`,
  alongside `xlsformColumn`):
  - `"optionsLabel": "Options"`
  - `"defaultLabel": "Default"`
  - `"requiredLabel": "Required"`
  - `"parameterMapping": "XLSForm column parameters · key {name}"`
    (i.e. "XLSForm column parameters · key {name}" — a literal middle dot;
    interpolated with `{ name: param.name }`)
  - `"syntaxHint": "Space-separated key=value pairs"`

  `help.ui.popover.xlsformColumn` ("XLSForm column") is unchanged and stays
  used only by the field-mode branch.
- Delete the `fieldHelp.parameters` block from `help.json` (`:210-213`:
  `"parameters": { "whatItIs": "...", "xlsformColumn": "parameters" }`).
- In `src/help/content.ts`, delete the `parameters:` line from the
  `fieldHelp` map (`:79`). `HelpFieldKey` (`:96`, `keyof typeof fieldHelp`)
  narrows automatically — no call site outside `TypeConfigSection.vue`
  passes `field="parameters"` (verified: grepped, only those two lines).
- No new `MessageKey`s are needed for `content.ts` beyond what already
  exists — the new `help.ui.popover.*` keys are referenced as literal
  string keys directly in `HelpPopover.vue`'s template calls to `t(...)`,
  the same pattern the existing `xlsformColumn` label already uses (it is
  not indexed through `content.ts` either).
- `@intlify/vue-i18n/no-missing-keys` (error-level) will catch any typo in
  the new keys at lint time; run `pnpm lint` before moving on.

## Task 3 — Wire `TypeConfigSection.vue` to the new popover mode

**File:** `src/components/properties/TypeConfigSection.vue`

- Boolean branch (currently `:236`):
  ```html
  <span v-tooltip.left="param.description">{{ paramLabel(param.name) }}<HelpPopover :param="param" /></span>
  ```
- Non-boolean branch (currently `:239`):
  ```html
  <span v-tooltip.left="param.description">{{ paramLabel(param.name) }}<template v-if="param.required"> *</template><HelpPopover :param="param" /></span>
  ```
- No other change in this file: `paramPlaceholder`, `setParameter`,
  `paramValue`, the options `Select`'s `:placeholder="String(param.defaultValue ?? '')"`,
  and the dataset-column `Select` are all untouched.

## Task 4 — Component test updates (in lockstep)

**File:** `tests/component/property-panel.spec.ts`

- Extend the existing "field help popovers" `describe` block (`:132-174`):
  add a case that selects a type with an options-bearing audit-style
  parameter (e.g. `selectNew('audit')`), opens
  `field-help-param-location-priority` via the existing `openHelp` helper,
  and asserts the returned body text:
  - contains the registry description ("Location tracking priority");
  - contains all four option tokens (`no-power`, `low-power`, `balanced`,
    `high-accuracy`);
  - contains the parameter-mapping line's key
    (`location-priority`) — i.e. assert on `t('help.ui.popover.parameterMapping', …)`'s
    rendered text, or just assert the substring `location-priority` appears
    once outside the option list.
- Add a second case covering a boolean parameter with `defaultValue: false`
  (e.g. `select_one`'s `randomize`, or an audit boolean like
  `track-changes`): open `field-help-param-randomize` (or the audit
  equivalent) and assert the body contains the literal text "false" (the
  rendered `Default` line), proving `!== undefined` (not truthiness) drives
  the render.
- Add a third case for a from-file `value`/`label` column parameter (e.g.
  `selectNew('select_one_from_file')`, open `field-help-param-value`) and
  assert the body shows `Default` `name` (its registry default) — this
  parameter also drives a dataset-column `Select` in the row itself, so this
  case pins that the popover still renders correctly for a param whose input
  is not a plain `InputText`.
- Do **not** touch the existing four cases (`name`, `appearance`,
  `choiceList`, `relevant`) — none of them ever exercised `parameters`, they
  stay byte-identical.
- Do **not** touch "sentence-cases parameter display labels without
  touching keys" (`:123-130`) — it asserts `prop-param-*` input testids, not
  help testids, and is unaffected.
- **`tests/unit/help-content.spec.ts`** needs no edit: `fieldHelp` is walked
  via `Object.entries` with no per-key enumeration or orphan check, so it
  automatically reflects the smaller map once `parameters` is removed from
  `content.ts`.
- **`tests/component/help.spec.ts`** needs no edit: it exercises the drawer/
  reference dialog and the generic popover instantiation pattern, none of
  which reference `field="parameters"` or the retired testids.

## Task 5 — Registry metadata audit (separate commit)

**File:** `src/core/registry/question-types.ts`

Data-only pass, cross-checked against the live pages at
`https://docs.getodk.org/form-question-types/`, `/form-audit-log/`:

- `image.max-pixels` (`:511-513`): confirm the description's phrasing
  ("Downscale the long edge to this many pixels") matches the docs' own
  semantics; add a default if the docs specify one ODK Collect/Enketo
  actually applies when the key is omitted, otherwise leave `defaultValue`
  unset.
- `audit`'s `location-min-interval` / `location-max-age`
  (`:736-737`): confirm "seconds" is the correct unit per the docs and that
  no default is being silently dropped; add `defaultValue` if the docs
  document one.
- Sweep every other parameter table (`range`, `select_one[_multiple]`,
  `*_from_file`, `geopoint`, `audio`, `background-audio`) for any option
  token, unit, or default the docs specify that the registry currently
  omits. `audio.quality` already carries its full option set
  (`['normal', 'low', 'voice-only', 'external']`, default `'normal'`) —
  **do not** re-add it as if it were missing (this was a backlog-doc
  transcription error, corrected during shaping).
- Constraint: only `description`, `options`, `defaultValue` may change.
  Parameter `name`s and anything that changes what a form actually
  serializes are out of scope for this task — `tests/golden/` must pass
  unchanged with **no** golden regeneration
  (`uv run --with openpyxl --with pyxform scripts/make-goldens.py` is not
  run for this task).
- `tests/unit/help-content.spec.ts`'s "every appearance and parameter in the
  registry has a description" check (`:61-70`) covers any additions for
  free — run it after the audit, no test file edit needed unless a
  parameter's `description` becomes empty (it must not).
- Commit this task's diff separately from Tasks 1–4's diff (conventional
  commit, e.g. `fix(registry): fill parameter metadata gaps against ODK
  docs` vs. `feat(help): parameter-specific help popovers`).

## Task 6 — Docs sweep

- `CLAUDE.md` — no code-map path changes (no new files, no moved files); if
  the `src/help/` row's prose is judged stale after this change, update it
  to mention parameter-specific popovers, but this is optional polish, not
  required (the row already says `HelpPopover.vue` generically).
- `docs/specs/backlog/README.md` — move the `parameter-help-tooltips` row
  from "Pending proposals" to "Delivered (kept here as provenance)" once
  implementation lands, pointing at
  `docs/specs/2026-07-16-1121-parameter-help-tooltips/`, following the
  existing table's format for other delivered rows.
- README Features section / `docs/product/roadmap.md` — this is a UX
  refinement of an already-shipped help affordance, not a new headline
  feature; no entry is expected to be needed, but check both files for any
  sentence describing the generic parameters popover before signing off.

## Verification

- `pnpm lint` — `no-missing-keys` on the new `help.ui.popover.*` references;
  stylelint on the two new CSS classes.
- `pnpm typecheck` — `HelpPopover`'s narrowed prop usage, `HelpFieldKey`
  shrinking by one member.
- `pnpm test` — `tests/unit/help-content.spec.ts`,
  `tests/component/property-panel.spec.ts`, `tests/component/help.spec.ts`.
- `pnpm test:coverage` — confirm the touched areas (`src/components/help/`,
  `src/components/properties/`) stay within the existing floors (no
  persistence/store code touched, so the persistence/stores floors are
  unaffected).
- `tests/golden/` (part of `pnpm test`) must pass unchanged after Task 5;
  if it doesn't, a parameter *value* was accidentally touched — revert and
  redo the audit as metadata-only.
- `/agent-browser`: open the properties panel for a question of each shape
  touched by the new tests — an audit question (`location-priority`, an
  options param), a `select_one` (`randomize`, a boolean param with
  `defaultValue: false`), and a `select_one_from_file` (`value`, a
  from-file column param) — click each parameter's "?" trigger, screenshot
  the open popover, and confirm: the description reads correctly, the
  options list (where present) shows the exact tokens, "Default: false"
  renders explicitly for the boolean case, and the mapping line reads
  "XLSForm column parameters · key `<name>`". Also confirm the `v-tooltip`
  hover on the label still fires on mouse-over (unchanged).
- `/interface-craft`: critique the popover's layout with the new rows
  (options list wrapping on a long token list, spacing between the new
  lines and the existing description, the "Required" line's weight) — this
  automated-test-blind layout is exactly what the standing UI-change
  verification convention (`/agent-browser` + `/interface-craft`) exists to
  catch.
- Log the pass (screenshots + notes on what was checked, one file per
  scenario) to `docs/verification/2026-07-16-parameter-help-tooltips/`,
  following the naming convention of prior verification folders (e.g.
  `docs/verification/2026-07-15-central-ux/`).
- `/code-review` (five lenses, no plan mode) on the full wave diff before
  the final commit; fix findings immediately rather than deferring.
