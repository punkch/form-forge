/**
 * Structured condition model for the visual logic builder.
 *
 * `parseStructured` recognizes exactly the grammar the visual editor can
 * build — comparisons, selected()/not(selected()), string-length() and
 * regex() predicates over `${field}` or `.` operands, joined by homogeneous
 * `and`/`or` within a group, with at most ONE level of parenthesized
 * sub-groups. Anything outside that grammar (arithmetic, instance() lookups,
 * date functions, unparenthesized mixed joins, deeper nesting) returns
 * `null`, which the UI maps to raw mode.
 *
 * `serializeStructured` is deterministic — single spaces, single-quoted
 * string literals (pyxform convention; double quotes only when the value
 * itself contains a single quote), nested groups always parenthesized —
 * so visual → save → reopen is byte-stable and
 * `parseStructured(serializeStructured(t))` deep-equals `t` for canonical
 * trees (single-item groups join with 'and').
 *
 * Pure module: no Vue/Pinia imports, like the rest of src/core/.
 */

export type ComparisonOp = '=' | '!=' | '<' | '<=' | '>' | '>='
export type Join = 'and' | 'or'

export interface FieldOperand { type: 'field', name: string }
export interface SelfOperand { type: 'self' }
export type Operand = FieldOperand | SelfOperand

/** `${field} >= 18`, `. != ''`, ... */
export interface Comparison {
  kind: 'comparison'
  operand: Operand
  op: ComparisonOp
  literal: number | string
}

/** `selected(${q}, 'v')` / `not(selected(., 'v'))`. Value is always a string. */
export interface SelectedPred {
  kind: 'selected'
  operand: Operand
  value: string
  negated: boolean
}

/** `string-length(.) > 5`, `string-length(${q}) = 4`, ... */
export interface StringLengthPred {
  kind: 'string-length'
  operand: Operand
  op: ComparisonOp
  value: number
}

/** `regex(., '^[A-Za-z]+$')` — pattern stored verbatim (XPath has no escapes). */
export interface RegexPred {
  kind: 'regex'
  operand: Operand
  pattern: string
}

export type Condition = Comparison | SelectedPred | StringLengthPred | RegexPred
export type GroupItem = Condition | ConditionGroup

export interface ConditionGroup {
  kind: 'group'
  join: Join
  items: GroupItem[]
}

/** The root group. Nested groups may appear in `items` (one level only). */
export type ConditionTree = ConditionGroup

export const emptyTree = (): ConditionTree => ({ kind: 'group', join: 'and', items: [] })

// --- Parser ---------------------------------------------------------------

/** Internal sentinel thrown to abort parsing; surfaces as `null`. */
const FAIL = Symbol('structured-parse-fail')

/** XLSForm field name inside ${...}; matches the project's name validation. */
const REF_AT = /^\$\{\s*([A-Za-z_][\w.-]*)\s*\}/
/** Number literal whose String() form re-emits identically (no exponents). */
const NUM_AT = /^-?(?:\d+(?:\.\d+)?|\.\d+)/

const isWs = (ch: string | undefined): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'

export const parseStructured = (expr: string): ConditionTree | null => {
  const src = expr
  let pos = 0

  const fail = (): never => { throw FAIL }
  const atEnd = (): boolean => pos >= src.length
  const skipWs = (): void => { while (isWs(src[pos])) pos++ }
  const expectChar = (ch: string): void => {
    if (src[pos] !== ch) fail()
    pos++
  }

  /** Consumes `name` + optional ws + `(` when present at pos. */
  const tryCall = (name: string): boolean => {
    if (!src.startsWith(name, pos)) return false
    let after = pos + name.length
    while (isWs(src[after])) after++
    if (src[after] !== '(') return false
    pos = after + 1
    return true
  }

  const parseOperand = (): Operand => {
    if (src[pos] === '$') {
      const match = REF_AT.exec(src.slice(pos))
      if (match === null) return fail()
      pos += match[0].length
      return { type: 'field', name: match[1] }
    }
    if (src[pos] === '.') {
      const next = src[pos + 1]
      if (next !== undefined && next >= '0' && next <= '9') return fail() // `.5` is a number
      pos++
      return { type: 'self' }
    }
    return fail()
  }

  const parseOp = (): ComparisonOp => {
    const two = src.slice(pos, pos + 2)
    if (two === '!=' || two === '<=' || two === '>=') {
      pos += 2
      return two
    }
    const one = src[pos]
    if (one === '=' || one === '<' || one === '>') {
      pos += 1
      return one
    }
    return fail()
  }

  const parseNumber = (): number => {
    const match = NUM_AT.exec(src.slice(pos))
    if (match === null) return fail()
    pos += match[0].length
    return Number(match[0])
  }

  /** XPath 1.0 string literal — no escaping, so scan to the closing quote. */
  const parseStringLit = (): string => {
    const quote = src[pos]
    if (quote !== "'" && quote !== '"') return fail()
    const close = src.indexOf(quote, pos + 1)
    if (close === -1) return fail()
    const value = src.slice(pos + 1, close)
    pos = close + 1
    return value
  }

  const parseLiteral = (): number | string => {
    const ch = src[pos]
    if (ch === "'" || ch === '"') return parseStringLit()
    return parseNumber()
  }

  /** After `selected(` was consumed: `operand, value)`. */
  const parseSelectedCore = (negated: boolean): SelectedPred => {
    skipWs()
    const operand = parseOperand()
    skipWs()
    expectChar(',')
    skipWs()
    const raw = parseLiteral()
    const value = typeof raw === 'number' ? String(raw) : raw
    skipWs()
    expectChar(')')
    return { kind: 'selected', operand, value, negated }
  }

  const parseCondition = (): Condition => {
    if (tryCall('not')) {
      skipWs()
      if (!tryCall('selected')) return fail()
      const pred = parseSelectedCore(true)
      skipWs()
      expectChar(')')
      return pred
    }
    if (tryCall('selected')) return parseSelectedCore(false)
    if (tryCall('string-length')) {
      skipWs()
      const operand = parseOperand()
      skipWs()
      expectChar(')')
      skipWs()
      const op = parseOp()
      skipWs()
      const value = parseNumber()
      return { kind: 'string-length', operand, op, value }
    }
    if (tryCall('regex')) {
      skipWs()
      const operand = parseOperand()
      skipWs()
      expectChar(',')
      skipWs()
      const pattern = parseStringLit()
      skipWs()
      expectChar(')')
      return { kind: 'regex', operand, pattern }
    }
    const operand = parseOperand()
    skipWs()
    const op = parseOp()
    skipWs()
    const literal = parseLiteral()
    return { kind: 'comparison', operand, op, literal }
  }

  /** `and`/`or` keyword followed by whitespace, `(` or end of input. */
  const tryJoin = (): Join | null => {
    for (const join of ['and', 'or'] as const) {
      if (src.startsWith(join, pos)) {
        const after = src[pos + join.length]
        if (after === undefined || isWs(after) || after === '(') {
          pos += join.length
          return join
        }
      }
    }
    return null
  }

  const parseTerm = (depth: number): GroupItem => {
    skipWs()
    if (src[pos] === '(') {
      if (depth > 0) return fail() // one nesting level only
      pos++
      const nested = parseChain(depth + 1)
      skipWs()
      expectChar(')')
      return nested
    }
    return parseCondition()
  }

  const parseChain = (depth: number): ConditionGroup => {
    const items: GroupItem[] = [parseTerm(depth)]
    let join: Join | null = null
    for (;;) {
      skipWs()
      if (atEnd() || src[pos] === ')') break
      const next = tryJoin()
      if (next === null) return fail()
      if (join === null) join = next
      else if (join !== next) return fail() // heterogeneous joins need parens
      items.push(parseTerm(depth))
    }
    return { kind: 'group', join: join ?? 'and', items }
  }

  try {
    skipWs()
    if (atEnd()) return null
    const root = parseChain(0)
    skipWs()
    if (!atEnd()) return fail()
    return root
  } catch (error) {
    if (error === FAIL) return null
    throw error
  }
}

// --- Serializer -----------------------------------------------------------
//
// XPath 1.0 has no string-escape mechanism and no way to write a number as an
// exponent literal, so two literal classes cannot be serialized at all:
//   1. a string containing BOTH ' and " (neither quote kind can wrap it), and
//   2. a number whose only finite spelling needs exponent notation.
// The serializer therefore returns `null` for any tree containing such a
// literal instead of emitting XPath that would fail to re-parse. Callers that
// only ever hold representable trees can use `serializeStructured`; editors
// that must react to unrepresentable input use `trySerializeStructured`.

/** Anchored number literal — the whole string must be a bare decimal so the
 * output re-parses via NUM_AT and Number() reproduces the same value. */
const NUM_FULL = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/

/**
 * Non-exponent decimal spelling of `n`, or `null` when none re-parses exactly.
 * Expands `String(n)` (the shortest round-tripping form) so no precision is
 * lost; the guard rejects only non-finite values in practice.
 */
const formatNumber = (n: number): string | null => {
  if (!Number.isFinite(n)) return null
  const s = String(n)
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(s)
  let plain: string
  if (match === null) {
    plain = s
  } else {
    const [, sign, intPart, fracPart = '', expStr] = match
    const digits = intPart + fracPart
    const point = intPart.length + Number(expStr) // decimal point index within `digits`
    if (point <= 0) plain = `${sign}0.${'0'.repeat(-point)}${digits}`
    else if (point >= digits.length) plain = `${sign}${digits}${'0'.repeat(point - digits.length)}`
    else plain = `${sign}${digits.slice(0, point)}.${digits.slice(point)}`
  }
  return NUM_FULL.test(plain) && Number(plain) === n ? plain : null
}

/** pyxform convention: single quotes; double when the value contains a single
 * quote. `null` when the value contains both quote kinds (unrepresentable). */
const quoteString = (value: string): string | null => {
  if (!value.includes("'")) return `'${value}'`
  if (!value.includes('"')) return `"${value}"`
  return null
}

const serializeLiteral = (literal: number | string): string | null =>
  typeof literal === 'number' ? formatNumber(literal) : quoteString(literal)

const serializeOperand = (operand: Operand): string =>
  operand.type === 'self' ? '.' : `\${${operand.name}}`

const serializeCondition = (condition: Condition): string | null => {
  switch (condition.kind) {
    case 'comparison': {
      const literal = serializeLiteral(condition.literal)
      return literal === null ? null : `${serializeOperand(condition.operand)} ${condition.op} ${literal}`
    }
    case 'selected': {
      const value = quoteString(condition.value)
      if (value === null) return null
      const core = `selected(${serializeOperand(condition.operand)}, ${value})`
      return condition.negated ? `not(${core})` : core
    }
    case 'string-length':
      return `string-length(${serializeOperand(condition.operand)}) ${condition.op} ${String(condition.value)}`
    case 'regex': {
      const pattern = quoteString(condition.pattern)
      return pattern === null ? null : `regex(${serializeOperand(condition.operand)}, ${pattern})`
    }
  }
}

const serializeGroup = (group: ConditionGroup, nested: boolean): string | null => {
  const parts: string[] = []
  for (const item of group.items) {
    const part = item.kind === 'group' ? serializeGroup(item, true) : serializeCondition(item)
    if (part === null) return null
    parts.push(part)
  }
  const joined = parts.join(` ${group.join} `)
  return nested ? `(${joined})` : joined
}

/**
 * Serializes `tree`, or returns `null` when it holds a literal XPath 1.0 cannot
 * represent (see the block comment above). Use this in editors so an
 * unrepresentable mid-edit tree never overwrites the saved expression.
 */
export const trySerializeStructured = (tree: ConditionTree): string | null =>
  tree.items.length === 0 ? '' : serializeGroup(tree, false)

/** Convenience for callers holding trees known to be representable (empty
 * string on the rare unrepresentable tree). Prefer `trySerializeStructured`
 * when the tree comes from live user input. */
export const serializeStructured = (tree: ConditionTree): string =>
  trySerializeStructured(tree) ?? ''
