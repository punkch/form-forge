/**
 * Minimal deterministic XML builder/printer for the XForm serializer.
 * Byte-stable across environments (no DOM dependency) so golden tests
 * compare identically in browser and Node.
 */

export interface XmlNode {
  name: string
  attrs?: Record<string, string | undefined>
  children?: XmlChild[]
}

/** Strings are text content; { raw } is inserted verbatim (preserved
 * fragments from imports). */
export type XmlChild = XmlNode | string | { raw: string }

export const el = (
  name: string,
  attrs?: Record<string, string | undefined>,
  ...children: XmlChild[]
): XmlNode => ({ name, attrs, children })

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttr = (value: string): string =>
  escapeText(value).replace(/"/g, '&quot;')

const isRaw = (child: XmlChild): child is { raw: string } =>
  typeof child === 'object' && 'raw' in child

const attrString = (attrs: Record<string, string | undefined> | undefined): string => {
  if (attrs === undefined) return ''
  let out = ''
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined) continue
    out += ` ${name}="${escapeAttr(value)}"`
  }
  return out
}

const hasTextChild = (children: XmlChild[]): boolean =>
  children.some((c) => typeof c === 'string')

const renderInline = (node: XmlNode): string => {
  const children = node.children ?? []
  if (children.length === 0) return `<${node.name}${attrString(node.attrs)}/>`
  let inner = ''
  for (const child of children) {
    if (typeof child === 'string') inner += escapeText(child)
    else if (isRaw(child)) inner += child.raw
    else inner += renderInline(child)
  }
  return `<${node.name}${attrString(node.attrs)}>${inner}</${node.name}>`
}

const render = (node: XmlNode, indent: string, depth: number): string => {
  const pad = indent.repeat(depth)
  const children = node.children ?? []
  if (children.length === 0) {
    return `${pad}<${node.name}${attrString(node.attrs)}/>`
  }
  // Mixed or text content renders inline to avoid introducing whitespace.
  if (hasTextChild(children)) {
    return pad + renderInline(node)
  }
  const inner = children
    .map((child) => {
      if (isRaw(child)) return indent.repeat(depth + 1) + child.raw
      return render(child as XmlNode, indent, depth + 1)
    })
    .join('\n')
  return `${pad}<${node.name}${attrString(node.attrs)}>\n${inner}\n${pad}</${node.name}>`
}

export const serializeXml = (root: XmlNode, opts: { indent?: string } = {}): string =>
  `<?xml version="1.0"?>\n${render(root, opts.indent ?? '  ', 0)}\n`
