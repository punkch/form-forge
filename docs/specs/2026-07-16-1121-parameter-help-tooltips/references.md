# References — parameter-specific help popovers

## Code studied (verified 2026-07-16, corrected line numbers)

- `src/components/properties/TypeConfigSection.vue`
  - Both label branches carry the generic popover: `:236` (boolean/Checkbox
    branch) and `:239` (non-boolean branch, with a `<template v-if="param.required"> *</template>`
    marker) each render `v-tooltip.left="param.description"` on the label
    `<span>` plus `<HelpPopover field="parameters" />` — i.e. every parameter
    row in a section emits the identical `data-testid="field-help-parameters"`
    / `field-help-body-parameters`, a duplicate-testid bug this feature also
    fixes.
  - `paramPlaceholder` (`:115-123`) feeds the plain `InputText` (`:262`) and
    the dataset-column `Select` (`:255` region, `datasetColumnOptions`
    branch) as a placeholder; falls back to
    `param.defaultValue !== undefined ? String(param.defaultValue) : ''`.
  - The options-bearing `Select` (`:241-248`) uses
    `:placeholder="String(param.defaultValue ?? '')"` (`:245`) — a
    `??`-based fallback, distinct from `paramPlaceholder`'s `!== undefined`
    check; both must keep working after this change (neither is touched by
    this feature beyond the `HelpPopover` call switching from `field=` to
    `:param=`).
  - `setParameter`/`paramValue` (`:50-60`) — untouched; parameter values
    still round-trip as strings keyed by `param.name`.
- `src/components/help/HelpPopover.vue`
  - `field: HelpFieldKey` prop declared at `:11`.
  - Trigger `<span>` at `:30-41`; testid `` `field-help-${field}` `` at
    `:35`; the not-a-`<button>` rationale is in the comment at `:22-29` —
    read it before changing the trigger, the reasoning (implicit-label
    forwarding) still applies verbatim to a `param`-mode trigger.
  - Popover body at `:42-50`; `data-testid="field-help-body-${field}"` at
    `:43`; renders `whatItIs` (`:44`) then the `help.ui.popover.xlsformColumn`
    label (`:46`) + `<code>{{ t(entry.xlsformColumn) }}</code>` (`:47`).
  - Scoped CSS at `:53-88` — `.help-popover-body`, `.help-popover-column`
    (flex row, muted text, `<code>` chip) are the classes to extend for the
    options/default/required lines; `.help-trigger-icon` (the shared "?"
    look) is defined in `src/styles/builder.css:126-136`, not in this file —
    don't duplicate it.
- `src/i18n/locales/en/help.json`
  - `fieldHelp.parameters` block at `:210-213` (`whatItIs` + `xlsformColumn:
    "parameters"`) — the entry to delete once `HelpPopover` no longer keys
    into it (`HelpPopover` is confirmed its only consumer — no other
    component reads `fieldHelp.parameters`).
  - `help.ui.drawer.optionsList` at `:29` — `"({options})"`, the drawer's
    inline parenthesized rendering; the popover wants a distinct, labelled
    block ("Options: …"), so this is precedent for the *shape* of an options
    interpolation, not a key to reuse as-is.
  - `help.ui.popover.xlsformColumn` at `:31-33` (inside the `popover` block,
    itself at `:31`) — `"XLSForm column"`; reusable verbatim for the new
    popover's mapping line (both field-mode and param-mode popovers say
    "XLSForm column").
- `src/help/content.ts`
  - `fieldHelp` map (`:73-94`) — the `parameters:` entry (`:79`) is the one
    being deleted; `HelpFieldKey` (`:96`) narrows automatically once it's
    gone.
  - `TypeHelp`/`FieldHelp` interfaces (`:13-25`) — `FieldHelp` is unaffected;
    no new interface is needed for the param-mode popover since it reads
    `QuestionTypeParameter` directly (already exported from
    `src/core/registry/question-types.ts`), not a `content.ts` map.
- `src/components/help/QuestionTypeHelpContent.vue`
  - The drawer's PARAMETERS table (`:62-90`) is the established precedent
    for rendering registry parameter fields verbatim: `param.description`
    (`:80`), `help.ui.drawer.optionsList` interpolation when
    `param.options` (`:81-83`), `param.defaultValue` in a `<code>` (`:85`),
    a required marker (`:77`). The popover mirrors this shape at
    row-granularity; this table itself is explicitly out of scope (untouched).
- `src/core/registry/question-types.ts`
  - `QuestionTypeParameter` interface at `:11-18`
    (`name, description, type: 'string'|'number'|'boolean', required?,
    defaultValue?, options?`).
  - Parameter tables read while shaping (line numbers as of 2026-07-16):
    - `range` (`:193-197`): `start` (number, default `1`, required),
      `end` (number, default `10`, required), `step` (number, default `1`).
    - `select_one`/`select_multiple` (`:258-261`, `:282-285`): `randomize`
      (boolean, default `false`), `seed` (string).
    - `select_one_from_file`/`select_multiple_from_file` (`:300-305`,
      `:324-329`): adds `value` (string, default `'name'`) and `label`
      (string, default `'label'`) on top of `randomize`/`seed`.
    - `geopoint` (`:444-448`): `capture-accuracy` (number),
      `warning-accuracy` (number), `allow-mock-accuracy` (boolean, default
      `false`).
    - `image` (`:511-513`): `max-pixels` (number, no default) — "Downscale
      the long edge to this many pixels".
    - `audio` (`:535-537`): `quality` (string, `options: ['normal', 'low',
      'voice-only', 'external']`, default `'normal'`) — **already has
      options**; the backlog doc's "audio quality values" gap claim was
      wrong, verified against this line.
    - `background-audio` (`:551-553`): `quality` (string, `options:
      ['normal', 'low', 'voice-only']` — no `external`, default `'normal'`).
    - `audit` (`:734-741`): `location-priority` (string, `options:
      ['no-power', 'low-power', 'balanced', 'high-accuracy']`, no default),
      `location-min-interval` (number, no default, description says
      "Minimum seconds…"), `location-max-age` (number, no default,
      "Maximum seconds…"), `track-changes` / `track-changes-reasons` /
      `identify-user` (all boolean, default `false`).
  - Genuine registry-audit gaps to check against docs.getodk.org during the
    metadata commit: `image.max-pixels` semantics/units (the description
    already says "pixels" — confirm it matches the docs' own wording and
    whether a default is documented), the audit interval parameters' units
    (descriptions already say "seconds" — confirm against docs), and any
    default values the docs specify that the registry currently omits
    (e.g. whether `location-priority`/`location-min-interval`/
    `location-max-age` have documented defaults).

## Tests read

- `tests/component/property-panel.spec.ts`
  - "field help popovers" describe block (`:132-174`): `mountPanel`/`openHelp`
    helpers, four `it`s covering `name`, `appearance`, `choiceList`,
    `relevant` — **none** open a `parameters` popover today, so there is no
    existing param-popover assertion to migrate, only new ones to add.
  - "sentence-cases parameter display labels without touching keys"
    (`:123-130`): asserts `prop-param-randomize`/`prop-param-seed` testids
    and label text — asserts input ids, not help ids; unaffected by this
    change, left as-is.
- `tests/unit/help-content.spec.ts` — `fieldHelp` is walked generically via
  `Object.entries` (`:73-77`, "every field help entry resolves to catalog
  text") with no per-key enumeration and no orphan-key check for
  `fieldHelp`, so deleting the `parameters` entry shrinks the iterated set
  with no special-casing needed. The "every appearance and parameter in the
  registry has a description" check (`:61-70`) already covers any
  registry-audit additions for free.
- `tests/component/help.spec.ts` — drawer/reference/popover open-close
  coverage; no reference to `field="parameters"` or the drawer's
  `help-parameters` testid needs to change (the drawer table is out of
  scope).
- e2e: no test anywhere references `field-help-parameters` (grepped
  `tests/e2e/`); the old duplicate id has no e2e consumer to update.

## Related delivered specs worth reading

- `docs/specs/2026-07-10-0850-in-app-help/` — delivered the registry
  `docsAnchor`, the typed `src/help/content.ts` catalog, `HelpPopover.vue`
  itself (drawer/reference call sites), and the "registry-driven, English
  renders verbatim" policy this feature extends into the popover. Its
  `shape.md` explicitly lists "inserting `<HelpPopover field="…">` next to
  each property-panel field label" as a deliberate follow-up — this feature
  and its already-landed `field="parameters"` call sites are that follow-up,
  now being made parameter-specific instead of generic.
- `docs/specs/2026-07-15-1729-workspace-full-backup/` — the most recent
  delivered spec in this repo's shape-spec format; used here as the
  structural/tone exemplar for `shape.md` and `user-guide.md`.

## New test ids introduced

`field-help-param-<name>` (trigger), `field-help-body-param-<name>` (popover
body) — one pair per `QuestionTypeParameter.name` rendered in
`TypeConfigSection.vue`. Additive; the old `field-help-parameters` /
`field-help-body-parameters` ids are retired (component spec updated in
lockstep; no e2e consumer existed).
