import type { Issue } from '../validate/issues'
import { findRefs } from './tokenizer'
import type { SymbolTable } from './symbol-table'

/**
 * Where the expression will live in the XForm — determines how same-repeat
 * references are anchored (pyxform parity; pinned by golden tests):
 * - 'bind' / 'output': plain relative paths (../sibling) inside repeats,
 *   absolute paths everywhere else.
 * - 'itemset-predicate' (choice_filter): same-repeat refs are anchored with
 *   current()/ because the evaluation context is the itemset node.
 */
export type RewriteMode = 'bind' | 'output' | 'itemset-predicate'

export interface RewriteToXPathOptions {
  symbols: SymbolTable
  /** Absolute instance path of the node owning the expression. */
  contextPath?: string
  mode: RewriteMode
  /** For issue scoping. */
  nodeId?: string
}

export interface RewriteResult {
  result: string
  issues: Issue[]
}

const splitPath = (path: string): string[] => path.split('/').filter((s) => s !== '')

/** Relative XPath from `fromPath`'s node to `toPath`'s node (../x/y form). */
export const relativePath = (fromPath: string, toPath: string): string => {
  const from = splitPath(fromPath)
  const to = splitPath(toPath)
  let common = 0
  while (common < from.length - 1 && common < to.length && from[common] === to[common]) common++
  // Relative steps evaluate from the context node itself, so reaching a
  // sibling needs one '..' — climb (from.length - common) levels.
  const ups = from.length - common
  const downs = to.slice(common)
  return `${'../'.repeat(ups)}${downs.join('/')}` || '.'
}

/**
 * Rewrites `${name}` references to XPath node references. Unknown or
 * ambiguous names are reported as issues and left untouched so nothing is
 * silently lost. Raw XPath (no `${}`) passes through unchanged.
 */
export const rewriteToXPath = (expr: string, opts: RewriteToXPathOptions): RewriteResult => {
  const refs = findRefs(expr)
  if (refs.length === 0) return { result: expr, issues: [] }

  const issues: Issue[] = []
  const contextEntry = opts.contextPath !== undefined
    ? opts.symbols.entryByPath(opts.contextPath)
    : null
  const contextRepeat = contextEntry !== null ? opts.symbols.nearestRepeatPath(contextEntry) : null

  let out = ''
  let cursor = 0
  for (const ref of refs) {
    out += expr.slice(cursor, ref.start)
    cursor = ref.end

    const resolution = opts.symbols.resolve(ref.name)
    if (resolution.status === 'missing') {
      issues.push({
        severity: 'error',
        code: 'expr.unknown-ref',
        message: `Unknown field reference \${${ref.name}}.`,
        scope: { nodeId: opts.nodeId },
      })
      out += expr.slice(ref.start, ref.end)
      continue
    }
    if (resolution.status === 'ambiguous') {
      issues.push({
        severity: 'error',
        code: 'expr.ambiguous-ref',
        message: `\${${ref.name}} matches ${resolution.entries.length} fields; names must be unique to be referenced.`,
        scope: { nodeId: opts.nodeId },
      })
      out += expr.slice(ref.start, ref.end)
      continue
    }

    const targetPath = resolution.entry.path
    const sameRepeat = contextRepeat !== null &&
      opts.contextPath !== undefined &&
      (targetPath === contextRepeat || targetPath.startsWith(`${contextRepeat}/`))

    if (sameRepeat && opts.contextPath !== undefined) {
      const rel = relativePath(opts.contextPath, targetPath)
      out += opts.mode === 'itemset-predicate' ? `current()/${rel}` : rel
    } else {
      out += targetPath
    }
  }
  out += expr.slice(cursor)
  return { result: out, issues }
}
