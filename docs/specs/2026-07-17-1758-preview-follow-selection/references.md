# Preview follows canvas selection — References

## web-forms bundle findings (verified 2026-07-17 against the pinned version)

All verified by direct inspection of
`node_modules/@getodk/web-forms/dist/index-*.js` — the version-pin
invariant (byte-matched PrimeVue/preset, `pnpm verify:webforms`) is what
makes coupling to these DOM details acceptable. Re-verify on any web-forms
bump.

- **`OdkWebForm` events**: exactly `["loaded", "submit", "submitChunked"]`.
  `loaded` fires with **no payload** when `loadFormState` resolves — i.e.
  before the question DOM flushes. Submit events are presence-gated on the
  matching `onSubmit*` vnode prop.
- **Question DOM**: only the leaf `FormQuestion` component creates
  `<div id="<nodeId>_container" class="question-container">` (controls:
  Input, Select, Rank, Upload, Note, Range, Trigger). Groups/repeats render
  through other components and never get the class. `nodeId` is
  `nodeID(createUniqueId())` — opaque, not derived from the field ref; the
  ref appears nowhere in the DOM.
- **Label/hint markup**: each control renders
  `<div class="control-text"><label for="<nodeId>">…</label>` +
  `<div class="hint">…</div></div>` (`ControlText` → `ControlLabel` /
  `ControlHint`). Choice options render their own `<label>`s *outside*
  `.control-text`, so `.control-text label` is unambiguous. Label media
  blocks sit inside the `<label>` but contribute no textContent (alt
  attributes only).
- **Relevance**: the question list renders
  `node.currentState.relevant ? <FormQuestion/> : nothing` — non-relevant
  questions are absent from the DOM, not hidden.
- **Repeats**: children render once per instance → duplicate label runs in
  the DOM.

## In-repo precedents

- `src/components/canvas/TreeNodeCard.vue:69-77` — reduced-motion-aware
  `scrollIntoView` (`matchMedia` gate, `behavior: reduced ? 'auto' :
  'smooth'`) + the 900ms "just added" flash idiom this feature mirrors.
- `src/styles/builder.css:67-75` — motion tokens incl.
  `--builder-motion-duration-flash: 900ms`; `:192` the global
  reduced-motion blanket (0.01ms durations).
- `src/components/preview/PreviewHost.vue` — generation counter pattern
  (`myGeneration !== generation` guards) every async callback must respect.
- `src/stores/preview.ts` — `instanceKey++` per successful regeneration is
  what remounts the child app (and why scroll resets today).
- `src/stores/editor.ts:19,41` — `selectedNodeId` / `select()`.
- `src/core/model/ops.ts` — `flatten`, `findNode`, `visit`, `isContainer`.
- `src/core/model/display.ts` — `LocalizedText` handling conventions
  (`displayText`, `primaryLang`) — the follow list deliberately uses *all*
  language values instead, because the preview has its own language picker.
- `src/core/registry/question-types.ts` — `getQuestionType(type)?.xform
  .bodyElement === null` ⇒ model-only (calculate, metadata, actions).
- `vitest.config.ts` — the `unit` project (node env) already includes
  `src/preview/**/*.spec.ts`; no config change needed for the co-located
  spec.

## Deterministic upgrade path (not in scope)

Upstream PR to `@getodk/web-forms` stamping `data-reference` on
`.question-container` (the engine knows `currentState.reference`), or a
`pnpm patch` against the pinned version emitting the form state with
`loaded`. Either would turn the heuristic into an exact lookup; the
heuristic stays as fallback.
