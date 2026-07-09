# Spec 02: Expression Engine & Validation — Shaping Notes

## Scope

The `${field}` ↔ XPath expression module (`src/core/expr/`) and the full
model-level validation layer (`src/core/validate/`), wired into the form
store's debounced `issues` pipeline. See `../2026-07-09-1602-product-docs-and-foundation/plan.md`
for the full program.

## Decisions

- **Not a full XPath parser.** The engines only need to (a) skip string
  literals reliably, (b) locate/rewrite `${name}` refs and path tokens, and
  (c) check quote/paren/bracket balance. A masking scanner
  (`maskStringLiterals`) + targeted regexes keep the code small and the
  behavior predictable; anything unrecognized passes through verbatim, which
  is what lossless round-tripping wants.
- **Expressions are stored in `${}` form**; raw XPath (imports we couldn't
  reverse-rewrite) is first-class and flows through both directions unchanged.
- **Path style rules (pyxform reference, pinned by Spec 04 goldens):**
  bind/output mode → absolute `/data/...` paths, except same-repeat targets
  which become `../`-relative; itemset-predicate mode (choice_filter) anchors
  same-repeat refs with `current()/`.
- **Reverse rewrite is conservative**: only absolute paths, `../` chains and
  `current()/` chains that resolve to a node whose name is globally unique
  become `${name}`; `instance('x')/...` lookups and ambiguous names stay raw.
- Unknown/ambiguous refs never throw — they surface as `Issue`s and the
  original token is preserved.
- Validators are pure `(doc) => Issue[]` composed by `validateDocument`:
  names, refs (lists/attachments/save_to/unknown types), expressions
  (balance + ref resolution + constraint self-ref warning), choices
  (duplicates/empty/unused), translations (partial-translation warnings),
  entities (create/update consistency). Errors gate the preview; warnings don't.
- ESLint's `no-template-curly-in-string` is disabled project-wide — `${field}`
  inside plain strings is the domain syntax.

## Context

- **References:** pyxform's `${}` rewriting semantics (docs.getodk.org/xlsform),
  xlsform-cheatsheet/relevance.md + constraints.md examples (all covered in
  the test tables).
- **Verification:** engine-only spec — verified by 48 new unit tests
  (tokenizer/to-xpath/from-xpath tables, fast-check round-trip property,
  one spec per validator). No browser surface yet; agent-browser verification
  of expression editing happens in Spec 03.
