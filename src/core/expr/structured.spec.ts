import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  emptyTree,
  parseStructured,
  serializeStructured,
  trySerializeStructured,
  type Condition,
  type ConditionGroup,
  type ConditionTree,
  type ComparisonOp,
  type GroupItem,
  type Join,
  type Operand,
} from './structured'

const field = (name: string): Operand => ({ type: 'field', name })
const self: Operand = { type: 'self' }

const cmp = (operand: Operand, op: ComparisonOp, literal: number | string): Condition =>
  ({ kind: 'comparison', operand, op, literal })
const sel = (operand: Operand, value: string, negated = false): Condition =>
  ({ kind: 'selected', operand, value, negated })
const len = (operand: Operand, op: ComparisonOp, value: number): Condition =>
  ({ kind: 'string-length', operand, op, value })
const rex = (operand: Operand, pattern: string): Condition =>
  ({ kind: 'regex', operand, pattern })
const group = (join: Join, items: GroupItem[]): ConditionGroup =>
  ({ kind: 'group', join, items })

describe('parseStructured', () => {
  it('parses a single comparison against a number', () => {
    expect(parseStructured('${age} >= 18')).toEqual(group('and', [cmp(field('age'), '>=', 18)]))
  })

  it('parses a comparison against the empty string', () => {
    expect(parseStructured("${q1} != ''")).toEqual(group('and', [cmp(field('q1'), '!=', '')]))
  })

  it('parses self comparisons and decimal literals', () => {
    expect(parseStructured('. > 10.51 and . < 18.39')).toEqual(
      group('and', [cmp(self, '>', 10.51), cmp(self, '<', 18.39)])
    )
  })

  it('parses selected() and not(selected())', () => {
    expect(parseStructured("selected(${q1}, 'nurse')")).toEqual(
      group('and', [sel(field('q1'), 'nurse')])
    )
    expect(parseStructured("not(selected(${q2}, 'b'))")).toEqual(
      group('and', [sel(field('q2'), 'b', true)])
    )
  })

  it('coerces unquoted numeric selected() values to strings', () => {
    expect(parseStructured('selected(${q1}, -88) or selected(${q2}, -88)')).toEqual(
      group('or', [sel(field('q1'), '-88'), sel(field('q2'), '-88')])
    )
  })

  it('parses string-length() over self and fields', () => {
    expect(parseStructured('string-length(.) > 5')).toEqual(group('and', [len(self, '>', 5)]))
    expect(parseStructured('string-length(${q1}) > 3')).toEqual(
      group('and', [len(field('q1'), '>', 3)])
    )
  })

  it('parses regex() predicates (with and without a space after the comma)', () => {
    expect(parseStructured("regex(., '^[A-Za-z]{0,6}$')")).toEqual(
      group('and', [rex(self, '^[A-Za-z]{0,6}$')])
    )
    expect(parseStructured("regex(.,'^\\(?[0-9]{3}\\)?-?[0-9]{3}-?[0-9]{4}$')")).toEqual(
      group('and', [rex(self, '^\\(?[0-9]{3}\\)?-?[0-9]{3}-?[0-9]{4}$')])
    )
  })

  it('parses homogeneous and/or chains', () => {
    expect(parseStructured("${q1} < 12.5 or selected(${q2}, 'y')")).toEqual(
      group('or', [cmp(field('q1'), '<', 12.5), sel(field('q2'), 'y')])
    )
  })

  it('parses one level of parenthesized groups', () => {
    expect(
      parseStructured(
        '(${computed_months} >= 6 and ${computed_months} < 24) or (${months} >= 6 and ${months} < 24)'
      )
    ).toEqual(
      group('or', [
        group('and', [cmp(field('computed_months'), '>=', 6), cmp(field('computed_months'), '<', 24)]),
        group('and', [cmp(field('months'), '>=', 6), cmp(field('months'), '<', 24)]),
      ])
    )
  })

  it('parses the acceptance expression', () => {
    expect(
      parseStructured("${age} >= 18 and (selected(${type}, 'refugee') or selected(${type}, 'idp'))")
    ).toEqual(
      group('and', [
        cmp(field('age'), '>=', 18),
        group('or', [sel(field('type'), 'refugee'), sel(field('type'), 'idp')]),
      ])
    )
  })

  it('rejects heterogeneous joins within one group', () => {
    expect(parseStructured('${a} = 1 and ${b} = 2 or ${c} = 3')).toBeNull()
  })

  it('rejects two conditions with no join between them', () => {
    expect(parseStructured('${a} = 1 ${b} = 2')).toBeNull()
  })

  it('rejects an identifier that only starts with a join keyword', () => {
    // `andx` is not the `and` keyword (tryJoin requires ws/`(`/end after it).
    expect(parseStructured('${a} = 1 andx ${b} = 2')).toBeNull()
  })

  it('rejects nesting deeper than one level', () => {
    expect(parseStructured('((${a} = 1))')).toBeNull()
    expect(parseStructured('${a} = 1 and (${b} = 2 or (${c} = 3 and ${d} = 4))')).toBeNull()
  })

  it('rejects empty and unbalanced input', () => {
    expect(parseStructured('')).toBeNull()
    expect(parseStructured('   ')).toBeNull()
    expect(parseStructured('(${a} = 1')).toBeNull()
    expect(parseStructured('${a} = 1)')).toBeNull()
    expect(parseStructured("${a} = 'unterminated")).toBeNull()
  })

  it('rejects field-to-field comparisons and arithmetic', () => {
    expect(parseStructured('${end} > ${start}')).toBeNull()
    expect(parseStructured('${price} * ${quantity}')).toBeNull()
    expect(parseStructured('${a} + 1 = 2')).toBeNull()
  })

  // Golden classification: every cheatsheet expression from the expression
  // engine spec's tables classifies as visual (parses) or raw (null).
  const goldens: Array<[string, 'visual' | 'raw']> = [
    // relevance.md
    ["${q1} != ''", 'visual'],
    ['${age} < 18', 'visual'],
    ['${random_value} < 0.5', 'visual'],
    ['(${computed_months} >= 6 and ${computed_months} < 24) or (${months} >= 6 and ${months} < 24)', 'visual'],
    ["selected(${q1}, 'nurse')", 'visual'],
    ['selected(${q1}, -88) or selected(${q2}, -88) or selected(${q3}, -88)', 'visual'],
    ["${q1} < 12.5 or selected(${q2}, 'y')", 'visual'],
    ["not(selected(${q2}, 'b'))", 'visual'],
    ['string-length(${q1}) > 3', 'visual'],
    ['false()', 'raw'],
    // constraints.md
    ['. <= 10', 'visual'],
    ['. > 10.51 and . < 18.39', 'visual'],
    ['string-length(.) > 5', 'visual'],
    ['. >= today()', 'raw'],
    [". >= date('2015-08-01')", 'raw'],
    ['count-selected(.) <= 3', 'raw'],
    ["not(selected(., 'none') and count-selected(.) > 1)", 'raw'],
    ["if(selected(., 'none'), count-selected(.) = 1, true())", 'raw'],
    ["if(selected(., 'none'), count-selected(.) = 1, count-selected(.) = 2)", 'raw'],
    ["regex(., '^[A-Za-z]{0,6}$')", 'visual'],
    ["regex(.,'^[A-Z]{3}+_+[A-Z]{3}+_+[0-9]{4}+_+[0-9]{3,4}$')", 'visual'],
    ["regex(., '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[a-zA-Z]{2,4}$')", 'visual'],
    ["regex(.,'^\\(?[0-9]{3}\\)?-?[0-9]{3}-?[0-9]{4}$')", 'visual'],
    [". = 9999 or (selected(${q1}, 'yes') and . <= 0) or (selected(${q1}, 'no') and . > 0)", 'visual'],
    // list_lookups.md / misc raw shapes
    ["instance('fuel')/root/item[code = ${fuel_code}]/price", 'raw'],
    ["pulldata('fuel', 'price', 'code', 'diesel')", 'raw'],
    ['${price} * ${quantity}', 'raw'],
    ["if(${age} > 17, 'adult', 'minor')", 'raw'],
    ["concat(${first}, ' ', ${last})", 'raw'],
    ['today()', 'raw'],
  ]

  it.each(goldens)('classifies %s as %s', (expr, expected) => {
    const tree = parseStructured(expr)
    if (expected === 'visual') expect(tree).not.toBeNull()
    else expect(tree).toBeNull()
  })
})

describe('serializeStructured', () => {
  it('emits deterministic single-spaced output with single-quoted literals', () => {
    const tree = group('and', [
      cmp(field('age'), '>=', 18),
      group('or', [sel(field('type'), 'refugee'), sel(field('type'), 'idp')]),
    ])
    expect(serializeStructured(tree)).toBe(
      "${age} >= 18 and (selected(${type}, 'refugee') or selected(${type}, 'idp'))"
    )
  })

  it('uses double quotes only when the literal contains a single quote', () => {
    expect(serializeStructured(group('and', [cmp(self, '=', "it's")]))).toBe('. = "it\'s"')
  })

  it('serializes the empty tree to the empty string', () => {
    expect(serializeStructured(emptyTree())).toBe('')
  })

  it('round-trips the acceptance expression byte-identically', () => {
    const expr = "${age} >= 18 and (selected(${type}, 'refugee') or selected(${type}, 'idp'))"
    const tree = parseStructured(expr)
    expect(tree).not.toBeNull()
    expect(serializeStructured(tree as ConditionTree)).toBe(expr)
  })

  it('is stable: serialize(parse(serialize(parse(e)))) equals serialize(parse(e))', () => {
    const exprs = [
      "${q1} != ''",
      '. > 10.51 and . < 18.39',
      'selected(${q1}, -88) or selected(${q2}, -88)',
      "regex(.,'^\\(?[0-9]{3}\\)?-?[0-9]{3}-?[0-9]{4}$')",
      ". = 9999 or (selected(${q1}, 'yes') and . <= 0) or (selected(${q1}, 'no') and . > 0)",
    ]
    for (const expr of exprs) {
      const once = serializeStructured(parseStructured(expr) as ConditionTree)
      const twice = serializeStructured(parseStructured(once) as ConditionTree)
      expect(twice).toBe(once)
    }
  })
})

describe('trySerializeStructured (representability guard)', () => {
  it('rejects a string literal containing both quote kinds', () => {
    // XPath 1.0 has no escape mechanism, so neither quote can wrap this value.
    const dual = 'O\'Brien "Pub"'
    expect(trySerializeStructured(group('and', [cmp(self, '=', dual)]))).toBeNull()
    expect(trySerializeStructured(group('and', [sel(field('q'), dual)]))).toBeNull()
    expect(trySerializeStructured(group('and', [rex(self, dual)]))).toBeNull()
  })

  it('rejects unrepresentable literals nested inside a sub-group', () => {
    const tree = group('or', [
      cmp(field('age'), '>=', 18),
      group('and', [cmp(self, '=', 'a\'b"c')]),
    ])
    expect(trySerializeStructured(tree)).toBeNull()
  })

  it('still serializes strings that use only one quote kind', () => {
    expect(trySerializeStructured(group('and', [cmp(self, '=', "it's")]))).toBe('. = "it\'s"')
    expect(trySerializeStructured(group('and', [cmp(self, '=', 'say "hi"')]))).toBe('. = \'say "hi"\'')
  })

  it('renders exponent-prone numbers as plain decimals that re-parse', () => {
    for (const n of [0.0000001, 1e-7, 5e-8, 1e21, 1.5e22]) {
      const text = trySerializeStructured(group('and', [cmp(self, '=', n)]))
      expect(text).not.toBeNull()
      expect(text).not.toMatch(/[eE]/)
      expect(parseStructured(text as string)).toEqual(group('and', [cmp(self, '=', n)]))
    }
  })

  it('returns "" for the empty tree (never null)', () => {
    expect(trySerializeStructured(emptyTree())).toBe('')
  })
})

describe('round-trip property', () => {
  const nameArb = fc
    .tuple(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'),
      fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_.-'), { maxLength: 8 })
    )
    .map(([head, tail]) => head + tail.join(''))

  const operandArb: fc.Arbitrary<Operand> = fc.oneof(
    fc.constant<Operand>({ type: 'self' }),
    nameArb.map<Operand>((name) => ({ type: 'field', name }))
  )

  const opArb = fc.constantFrom<ComparisonOp>('=', '!=', '<', '<=', '>', '>=')

  // Strings may contain either or BOTH quote kinds — the guard, not the
  // generator, is responsible for rejecting the unrepresentable ones.
  const textArb = fc
    .array(fc.constantFrom(...' abcxyzABC059 @^$[]{}()+*?\\.,-_:/#'.split(''), "'", '"'), { maxLength: 12 })
    .map((chars) => chars.join(''))

  // Includes exponent-prone magnitudes so the number formatter's plain-decimal
  // expansion (not String()'s exponent form) is exercised end to end.
  const numberArb = fc.oneof(
    fc.integer({ min: -99999, max: 99999 }),
    fc.integer({ min: -999999, max: 999999 }).map((n) => n / 100),
    fc.constantFrom(0.0000001, 1e-7, 5e-8, 1e21, 1.5e22, 1e-30)
  )

  const conditionArb: fc.Arbitrary<Condition> = fc.oneof(
    fc.record({
      kind: fc.constant<'comparison'>('comparison'),
      operand: operandArb,
      op: opArb,
      literal: fc.oneof(numberArb.map((n): number | string => n), textArb),
    }),
    fc.record({
      kind: fc.constant<'selected'>('selected'),
      operand: operandArb,
      value: textArb,
      negated: fc.boolean(),
    }),
    fc.record({
      kind: fc.constant<'string-length'>('string-length'),
      operand: operandArb,
      op: opArb,
      value: fc.integer({ min: 0, max: 9999 }),
    }),
    fc.record({
      kind: fc.constant<'regex'>('regex'),
      operand: operandArb,
      pattern: textArb,
    })
  )

  const joinArb = fc.constantFrom<Join>('and', 'or')

  // Canonical group: single-item groups always join with 'and' (the joiner
  // never appears in the serialized text, so parse cannot recover 'or').
  const canonicalGroup = (items: GroupItem[], join: Join): ConditionGroup =>
    ({ kind: 'group', join: items.length > 1 ? join : 'and', items })

  const nestedGroupArb: fc.Arbitrary<ConditionGroup> = fc
    .tuple(fc.array(conditionArb, { minLength: 1, maxLength: 3 }), joinArb)
    .map(([items, join]) => canonicalGroup(items, join))

  const treeArb: fc.Arbitrary<ConditionTree> = fc
    .tuple(
      fc.array(fc.oneof(conditionArb, nestedGroupArb), { minLength: 1, maxLength: 4 }),
      joinArb
    )
    .map(([items, join]) => canonicalGroup(items, join))

  it('either the guard rejects the tree, or parse(serialize(t)) deep-equals t', () => {
    fc.assert(
      fc.property(treeArb, (tree) => {
        const text = trySerializeStructured(tree)
        // A dual-quote string anywhere makes the tree unrepresentable; the
        // guard returns null rather than emitting XPath that fails to re-parse.
        if (text === null) return
        expect(parseStructured(text)).toEqual(tree)
      }),
      { numRuns: 500 }
    )
  })
})
