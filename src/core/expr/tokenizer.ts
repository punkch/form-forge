/**
 * Lightweight scanner for XLSForm/XPath expressions.
 *
 * This is deliberately NOT a full XPath parser: the engines only need to
 * (a) skip string literals reliably, (b) locate `${name}` references, and
 * (c) sanity-check bracket/quote balance. Anything else passes through
 * verbatim, which is exactly what lossless round-tripping wants.
 */

export interface BalanceIssue {
  code: 'expr.unterminated-string' | 'expr.unbalanced'
  message: string
  position: number
}

const OPENERS: Record<string, string> = { ')': '(', ']': '[' }

/**
 * Replaces the contents of string literals with space padding of equal
 * length so regex passes can operate on the expression without touching (or
 * being confused by) quoted text. Indices are preserved.
 */
export const maskStringLiterals = (expr: string): string => {
  let out = ''
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === "'" || ch === '"') {
      const close = expr.indexOf(ch, i + 1)
      if (close === -1) {
        // Unterminated: mask to the end so downstream passes stay safe.
        out += ch + ' '.repeat(expr.length - i - 1)
        return out
      }
      out += ch + ' '.repeat(close - i - 1) + ch
      i = close + 1
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** Checks quote/paren/bracket balance, ignoring string-literal content. */
export const checkBalance = (expr: string): BalanceIssue[] => {
  const issues: BalanceIssue[] = []

  // Quotes first (on the raw string).
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === "'" || ch === '"') {
      const close = expr.indexOf(ch, i + 1)
      if (close === -1) {
        issues.push({
          code: 'expr.unterminated-string',
          message: `Unterminated ${ch === "'" ? 'single' : 'double'}-quoted string`,
          position: i,
        })
        break
      }
      i = close + 1
    } else {
      i++
    }
  }

  const masked = maskStringLiterals(expr)
  const stack: Array<{ ch: string, pos: number }> = []
  for (let j = 0; j < masked.length; j++) {
    const ch = masked[j]
    if (ch === '(' || ch === '[') {
      stack.push({ ch, pos: j })
    } else if (ch === ')' || ch === ']') {
      const top = stack.pop()
      if (top === undefined || top.ch !== OPENERS[ch]) {
        issues.push({
          code: 'expr.unbalanced',
          message: `Unmatched "${ch}"`,
          position: j,
        })
        return issues
      }
    }
  }
  for (const open of stack) {
    issues.push({
      code: 'expr.unbalanced',
      message: `Unclosed "${open.ch}"`,
      position: open.pos,
    })
  }
  return issues
}

export interface RefOccurrence {
  /** The field name inside ${...}, trimmed. */
  name: string
  start: number
  /** Index just past the closing brace. */
  end: number
}

const REF_RE = /\$\{\s*([^}]*?)\s*\}/g

/** All ${name} occurrences outside string literals, with positions. */
export const findRefs = (expr: string): RefOccurrence[] => {
  const masked = maskStringLiterals(expr)
  const out: RefOccurrence[] = []
  let match: RegExpExecArray | null
  REF_RE.lastIndex = 0
  while ((match = REF_RE.exec(masked)) !== null) {
    out.push({ name: match[1], start: match.index, end: match.index + match[0].length })
  }
  return out
}

/** Distinct ${} reference names used in an expression. */
export const extractRefs = (expr: string): string[] =>
  [...new Set(findRefs(expr).map((r) => r.name))]
