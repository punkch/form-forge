# Spec 06: XForm XML Parser (Lossless Import) — Shaping Notes

## Scope

The core import engine: `src/core/xform/parser.ts` (+ `parser-itext.ts`,
`xml-reader.ts`) turning ODK XForm XML into a `FormDocument` — the exact
inverse of `serializer.ts`. Pure TS; the DOM comes from `globalThis.DOMParser`
(browsers natively, `@xmldom/xmldom` polyfilled in `tests/setup/unit.ts`).
UI wiring (ImportDialog) is out of scope here — this delivers the module and
its round-trip guarantees.

## Decisions

- **Round-trip is the contract**: `tests/golden/roundtrip.spec.ts` parses all
  8 pyxform goldens and requires `canonicalize(serialize(parse(x))) ===
  canonicalize(x)`. Zero skips — including entities (create + update paths).
- **Two-phase parse**: phase 1 builds the node tree (names/kinds/containers)
  from the primary-instance skeleton alone, so a symbol table over the
  file's *actual* root name exists before any expression work; phase 2 folds
  binds, body controls, itext, setvalues and entities into the tree, reverse-
  rewriting XPath → `${}` via the conservative `rewriteFromXPath` (ambiguous
  or exotic paths stay raw XPath, which remains valid everywhere).
- **Repeats**: a path is a repeat when the body has a `<repeat nodeset>` for
  it OR an instance copy carries `jr:template`. Consecutive same-name copies
  collapse to one (defaults read from the non-template copy). A `<group>`
  wrapping only label/hint + its repeat is folded into the RepeatNode.
- **Type inference order**: body control (select1/select/rank/trigger/range/
  upload-by-mediatype/input-by-bind-type) → model action (`odk:setgeopoint`
  → start-geopoint, `odk:recordaudio` → background-audio) → preload combo
  (registry reverse lookup; `uid` on meta/instanceID is never a question) →
  bare `calculate` → hidden field ('text' + `import.hidden-field` warning).
  `input+string+readonly="true()"` without calculate imports as `note`.
- **itext**: `translation/@lang` strings become `doc.languages` verbatim
  (including a literal `default` lang on legacy forms — it doubles as the
  DEFAULT_LANG key, so folding is a no-op); `@default='true()'` →
  `settings.defaultLanguage`. pyxform's `-` placeholder is dropped on import
  (the serializer regenerates it), so missing translations round-trip as
  missing. Media values lose their `jr://` prefix; `form="guidance"` →
  `guidanceHint`. `<output value>` folds to `${name}` only when the value
  reverse-rewrites to exactly one unambiguous ref; otherwise the expression
  stays as visible text with an `import.dropped-output` warning.
- **Selects**: itemsets unwrap `randomize(..., seed)` into parameters, split
  `instance('X')/root/item[pred]`, and reverse-rewrite the predicate into
  `choiceFilter` (context = the question, so `current()/../f` folds too).
  A src-instance reference becomes `itemsetFile` + `*_from_file`; an inline
  instance is materialized into `choiceLists[X]` (itextId labels resolved,
  other item children → `extras` + `extraColumnOrder`; `geometry` lives in
  extras since the serializer emits extras verbatim). Legacy inline `<item>`
  lists synthesize a list named after the question (uniquified).
- **Entities**: `meta/entity` @dataset/@create/@update + the `@id` setvalue
  (`uuid()` ⇒ no entityId) + the label bind's calculate reconstruct the full
  `EntityDeclaration`; `create="1"`/`update="1"` mean "unconditional" and map
  to absent createIf/updateIf.
- **Lossless escape hatches**: unknown bind attrs → `bind.custom` (canonical
  `prefix:localName` per namespace URI — prefixes themselves are never
  matched), unknown body attrs → `body.custom`, instance attrs →
  `instanceAttrs`, unknown bind *types* on inputs → kept in `bind.custom` so
  they override on export. Unreferenced secondary instances, unrecognized
  model children, orphan binds and unknown top-level body elements are
  preserved verbatim in `unknown.xformFragments` (serialized with
  XMLSerializer/xmldom `toString`, accepting namespace redeclarations).
- **Malformed XML never throws**: `parseXForm` returns an empty document plus
  an `import.parse-error` issue (browser `<parsererror>` detection + xmldom
  ParseError catch, console noise silenced via `onError`).
- **Known lossy-but-stable spots** (all warned, all idempotent after one
  round-trip): `<tag>` children inside uploads (OSM), unknown upload
  mediatypes (→ `file`), non-`data` instance roots (renamed on export),
  appearance on repeat wrapper groups (our serializer never emits it).

## Context

- **References:** `src/core/xform/serializer.ts` (the inverse operation),
  `tests/golden/expected/*.xml` (pyxform 4.5.0 ground truth),
  `tests/fixtures/all-widgets.xml` (2019 legacy fixture: 73 questions,
  inline items, itext image choices, French translation, OSM upload).
- **Verification:** 33 new tests (173 total) — 8 golden round-trips,
  22 parser unit/edge tests (incl. the all-widgets double-parse stability
  gate), 3 serialize→parse→serialize round-trips for entities-update,
  bare repeats and guidance hints.
