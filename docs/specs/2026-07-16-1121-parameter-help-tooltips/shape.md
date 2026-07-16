# Parameter-specific help popovers — shape

## Scope

Every type-specific parameter row in the properties panel (audit's "Location
priority", range's "Start"/"End"/"Step", image's "Max pixels", a select's
"Randomize"/"Seed", …) currently renders the same generic "?" popover — the
`fieldHelp.parameters` entry, which describes the XLSForm `parameters` column
in the abstract and says nothing about the specific row the user is filling
in. This feature replaces it with a **parameter-specific** popover: the
registry's own `description`, the allowed `options` tokens, the `defaultValue`
(explicitly, including `false`), a required marker, and the exact
`parameters`-column key it serializes to. The registry (`QuestionTypeParameter`
on `src/core/registry/question-types.ts`) is the only source read — the help
drawer's PARAMETERS table already renders the same fields, so the two surfaces
share one source and cannot drift.

A registry metadata audit against docs.getodk.org (filling gaps in
descriptions/options/defaults where the docs say more than the registry
currently does) rides in the same change, as a separate, data-only commit.

**Out of scope:** appearance help (already has its own `fieldHelp.appearance`
popover and drawer table), localizing registry descriptions (would break core
purity or force an ~N×40-key catalog — the registry-English-verbatim policy
stands), any change to the help drawer's PARAMETERS table, and the other
`fieldHelp` popovers (name/hint/relevant/…, all untouched).

## Decisions

All four items proposed in the backlog doc are adopted as settled rulings:

1. **The registry stays the single source of truth.** Popover and drawer both
   read `QuestionTypeParameter` directly; there is no parallel help catalog
   for parameters, so the two surfaces cannot drift apart.
2. **The `v-tooltip` hover on the parameter label is kept** as a light
   pointer-user affordance. The popover becomes the complete, accessible
   surface (keyboard-reachable, visible on touch); the hover stays as a cheap
   bonus for mouse users. Nothing about `v-tooltip.left="param.description"`
   changes.
3. **The generic `help.fields.parameters` entry is removed**, along with its
   `help.json` copy, once nothing renders it. `HelpPopover` is its only
   consumer and both call sites (`TypeConfigSection.vue:236,239`) move to the
   new parameter-specific rendering in the same change, so the removal is
   safe and immediate — a deliberate copy removal, not accidental byte drift.
4. **`paramPlaceholder` keeps showing the default** in the input itself. The
   popover's "Default" line is additive information, not a replacement for
   the placeholder.

Three further rulings resolve the backlog doc's open questions:

5. **Boolean parameters show "Default: false" explicitly** in the popover
   (not just an unchecked checkbox). This confirms the XLSForm-column
   mechanics the popover exists to explain: an omitted key means the default
   applies. The rendering condition is `param.defaultValue !== undefined`
   (not truthiness), so `false` renders, not vanishes.
6. **Registry metadata enrichment lands in the same change, as a separate
   commit.** It is a pure `question-types.ts` data edit — descriptions,
   `options` arrays and `defaultValue`s only. Parameter **names** and
   **values** that get serialized into a form are untouched, so
   `tests/golden/` stays green with no golden regeneration. This is committed
   independently of the popover/component work so each commit's diff reads
   as one concern.
7. **The options list stays in the popover even when the input is already a
   Select showing the same tokens.** The Select shows the tokens without
   meaning; the popover is where the mapping to the XLSForm key and the
   "these are the exact strings to write" framing lives, which the Select
   alone doesn't convey (and matters for hand-editing an exported .xlsx).

## Component shape

`HelpPopover.vue` gains an optional `param?: QuestionTypeParameter` prop
alongside its existing `field?: HelpFieldKey` prop, rather than a sibling
`ParameterHelpPopover.vue`: the two modes are mutually exclusive at every call
site (a caller passes one or the other, never both) and share everything
except the popover body — the accessibility-hardened trigger (the
not-a-real-`<button>` rationale, the `@click.prevent`/keyboard handlers, the
`aria-label`), the `Popover` wiring, and the shared CSS — so branching one
template on which prop is set costs far less than re-deriving that trigger
boilerplate in a second component.

## Context

Promoted 2026-07-16 from `docs/specs/backlog/parameter-help-tooltips.md`; open
questions resolved with the user 2026-07-16; the backlog doc's "current
implementation" claims were re-verified against the code on 2026-07-16 — one
correction of substance: the backlog listed audio's `quality` parameter as a
gap (missing option tokens), but `question-types.ts:536` already carries
`options: ['normal', 'low', 'voice-only', 'external']`; the genuine gaps for
the registry audit are image's `max-pixels` (units/semantics), the audit
parameters' interval units (seconds), and any defaults the docs specify that
the registry omits. All other file:line references in the backlog doc matched
the code as read and are carried into `references.md` with exact line numbers.

## Skills & conventions applied

Implementation runs via dynamic Workflows (Sonnet implementors, one task
stream). UI-touching work gets an `/agent-browser` pass plus an
`/interface-craft` critique before sign-off (automated tests are blind to
popover layout/wrapping). `/code-review` (five lenses, no plan mode) runs on
the diff before commit, findings fixed immediately. Verification is logged to
`docs/verification/2026-07-16-parameter-help-tooltips/`.
