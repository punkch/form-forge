import { maskStringLiterals } from './tokenizer'
import type { SymbolTable } from './symbol-table'

export interface RewriteFromXPathOptions {
  symbols: SymbolTable
  /** Absolute instance path of the node owning the expression (for ../ refs). */
  contextPath?: string
}

const NAME = '[A-Za-z_][\\w.-]*'

/**
 * Absolute instance paths: /data/group/field. Must not be glued to a
 * preceding name, ')' or ']' — that would be a path applied to a function
 * result (e.g. instance('x')/root/item) or predicate, which we must leave
 * alone. Trailing steps stop before '[' predicates.
 */
const ABSOLUTE_RE = new RegExp(`(?<![\\w)\\]])(/${NAME}(?:/${NAME})*)`, 'g')

/** current()/../a or ../../a style relative chains. */
const RELATIVE_RE = new RegExp(`(?<![\\w)\\]/])((?:current\\(\\)/)?(?:\\.\\./)+${NAME}(?:/${NAME})*)`, 'g')

const resolveRelative = (chain: string, contextPath: string): string | null => {
  const parts = chain.split('/')
  const context = contextPath.split('/').filter((s) => s !== '')
  // Start at the context node; '..' climbs from it.
  const stack = [...context]
  for (const part of parts) {
    if (part === '..') {
      if (stack.length === 0) return null
      stack.pop()
    } else {
      stack.push(part)
    }
  }
  return `/${stack.join('/')}`
}

/**
 * Conservatively rewrites XPath node references back to `${name}` form:
 * only when the path resolves to a known node whose name is unambiguous.
 * Anything else (instance() lookups, predicates, ambiguous names, paths we
 * can't resolve) is left as raw XPath, which remains valid everywhere.
 */
export const rewriteFromXPath = (expr: string, opts: RewriteFromXPathOptions): string => {
  const masked = maskStringLiterals(expr)

  interface Replacement { start: number, end: number, text: string }
  const replacements: Replacement[] = []

  const tryPath = (path: string): string | null => {
    const entry = opts.symbols.entryByPath(path)
    if (entry === null) return null
    const resolution = opts.symbols.resolve(entry.node.name)
    if (resolution.status !== 'ok') return null
    return `\${${entry.node.name}}`
  }

  let match: RegExpExecArray | null

  ABSOLUTE_RE.lastIndex = 0
  while ((match = ABSOLUTE_RE.exec(masked)) !== null) {
    const text = tryPath(match[1])
    if (text !== null) {
      replacements.push({ start: match.index, end: match.index + match[1].length, text })
    }
  }

  if (opts.contextPath !== undefined) {
    RELATIVE_RE.lastIndex = 0
    while ((match = RELATIVE_RE.exec(masked)) !== null) {
      const chain = match[1].replace(/^current\(\)\//, '')
      const resolved = resolveRelative(chain, opts.contextPath)
      if (resolved === null) continue
      const text = tryPath(resolved)
      if (text !== null) {
        replacements.push({ start: match.index, end: match.index + match[1].length, text })
      }
    }
  }

  if (replacements.length === 0) return expr
  replacements.sort((a, b) => a.start - b.start)

  let out = ''
  let cursor = 0
  for (const rep of replacements) {
    if (rep.start < cursor) continue // overlapping match, keep the first
    out += expr.slice(cursor, rep.start) + rep.text
    cursor = rep.end
  }
  out += expr.slice(cursor)
  return out
}
