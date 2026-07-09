/**
 * Canonicalizes XForm XML for semantic comparison against pyxform goldens:
 * attributes sorted, expression whitespace normalized (string-literal-aware),
 * itext <text> entries sorted by id, secondary instances sorted by id,
 * insignificant whitespace dropped.
 */
import { DOMParser } from '@xmldom/xmldom'

import { maskStringLiterals } from '../../src/core/expr/tokenizer'

type AnyNode = {
  nodeType: number
  nodeName: string
  nodeValue: string | null
  childNodes: ArrayLike<AnyNode>
  attributes?: ArrayLike<{ name: string, value: string }>
  getAttribute?: (name: string) => string | null
}

const ELEMENT = 1
const TEXT = 3

/** Collapse whitespace runs; drop spaces adjacent to brackets/commas outside
 * string literals so pyxform's ref padding compares equal. */
export const normalizeExpression = (value: string): string => {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  const masked = maskStringLiterals(collapsed)
  const glue = new Set(['(', '[', ')', ']', ',', '=', '<', '>'])
  let out = ''
  for (let i = 0; i < collapsed.length; i++) {
    if (collapsed[i] === ' ' && masked[i] === ' ') {
      const prev = out.at(-1)
      const next = collapsed[i + 1]
      if ((prev !== undefined && glue.has(prev)) || (next !== undefined && glue.has(next))) continue
    }
    out += collapsed[i]
  }
  return out
}

const sortChildren = (parent: AnyNode, children: AnyNode[]): AnyNode[] => {
  const isElement = (n: AnyNode): boolean => n.nodeType === ELEMENT
  if (parent.nodeName === 'translation') {
    return [...children].sort((a, b) => {
      if (!isElement(a) || !isElement(b)) return 0
      const idA = a.getAttribute?.('id') ?? ''
      const idB = b.getAttribute?.('id') ?? ''
      return idA.localeCompare(idB)
    })
  }
  if (parent.nodeName === 'model') {
    // Keep document order except: secondary <instance id=...> sorted by id
    // (pyxform emits external-file instances before internal lists).
    const secondary = children.filter((c) => isElement(c) && c.nodeName === 'instance' && c.getAttribute?.('id'))
    const sorted = [...secondary].sort((a, b) =>
      (a.getAttribute?.('id') ?? '').localeCompare(b.getAttribute?.('id') ?? ''))
    let cursor = 0
    return children.map((c) => (secondary.includes(c) ? sorted[cursor++] : c))
  }
  return children
}

const renderNode = (node: AnyNode, depth: number): string[] => {
  if (node.nodeType === TEXT) {
    const text = (node.nodeValue ?? '').replace(/\s+/g, ' ').trim()
    return text === '' ? [] : [`${'  '.repeat(depth)}#text ${text}`]
  }
  if (node.nodeType !== ELEMENT) return []

  const attrs = [...(node.attributes ?? [])
    ? Array.from(node.attributes as ArrayLike<{ name: string, value: string }>)
    : []]
    .map((a) => `${a.name}="${normalizeExpression(a.value)}"`)
    .sort()
    .join(' ')

  const line = `${'  '.repeat(depth)}<${node.nodeName}${attrs === '' ? '' : ' ' + attrs}>`
  // Drop whitespace-only text nodes BEFORE sorting so pretty-printed and
  // single-line inputs sort identically.
  const meaningful = Array.from(node.childNodes).filter((child) =>
    child.nodeType !== TEXT || (child.nodeValue ?? '').trim() !== '')
  const children = sortChildren(node, meaningful)
  return [line, ...children.flatMap((child) => renderNode(child, depth + 1))]
}

export const canonicalizeXForm = (xml: string): string => {
  const parsed = new DOMParser().parseFromString(xml, 'text/xml') as unknown as { documentElement: AnyNode }
  return renderNode(parsed.documentElement, 0).join('\n')
}
