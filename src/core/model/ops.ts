import { newId } from './ids'
import { isContainer, type ContainerNode, type FormDocument, type FormNode } from './types'

/** Depth-first visit of every node; return false from the callback to stop. */
export const visit = (
  nodes: FormNode[],
  fn: (node: FormNode, parent: ContainerNode | null, index: number) => boolean | undefined,
  parent: ContainerNode | null = null
): boolean => {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (fn(node, parent, i) === false) return false
    if (isContainer(node) && visit(node.children, fn, node) === false) return false
  }
  return true
}

export const flatten = (nodes: FormNode[]): FormNode[] => {
  const out: FormNode[] = []
  visit(nodes, (n) => { out.push(n); return undefined })
  return out
}

export const findNode = (doc: FormDocument, id: string): FormNode | null => {
  let found: FormNode | null = null
  visit(doc.children, (n) => {
    if (n.id === id) { found = n; return false }
    return undefined
  })
  return found
}

export interface NodeLocation {
  node: FormNode
  parent: ContainerNode | null
  /** Index within the parent's children (or doc.children when parent is null). */
  index: number
}

export const locateNode = (doc: FormDocument, id: string): NodeLocation | null => {
  let found: NodeLocation | null = null
  visit(doc.children, (node, parent, index) => {
    if (node.id === id) { found = { node, parent, index }; return false }
    return undefined
  })
  return found
}

const siblingsOf = (doc: FormDocument, parent: ContainerNode | null): FormNode[] =>
  parent === null ? doc.children : parent.children

/** Insert under parentId (null = root) at index (append when omitted). */
export const insertNode = (
  doc: FormDocument,
  node: FormNode,
  parentId: string | null,
  index?: number
): boolean => {
  let target: FormNode[] | null = null
  if (parentId === null) {
    target = doc.children
  } else {
    const parent = findNode(doc, parentId)
    if (parent === null || !isContainer(parent)) return false
    target = parent.children
  }
  const at = index === undefined ? target.length : Math.max(0, Math.min(index, target.length))
  target.splice(at, 0, node)
  return true
}

export const removeNode = (doc: FormDocument, id: string): FormNode | null => {
  const loc = locateNode(doc, id)
  if (loc === null) return null
  siblingsOf(doc, loc.parent).splice(loc.index, 1)
  return loc.node
}

/** True when `candidateAncestor` is (or contains) `id`. Guards cyclic moves. */
export const containsNode = (candidateAncestor: FormNode, id: string): boolean => {
  if (candidateAncestor.id === id) return true
  if (!isContainer(candidateAncestor)) return false
  let found = false
  visit(candidateAncestor.children, (n) => {
    if (n.id === id) { found = true; return false }
    return undefined
  })
  return found
}

/** Move a node to a new parent/index. Rejects moves into the node's own subtree. */
export const moveNode = (
  doc: FormDocument,
  id: string,
  newParentId: string | null,
  index: number
): boolean => {
  const loc = locateNode(doc, id)
  if (loc === null) return false
  if (newParentId !== null) {
    const newParent = findNode(doc, newParentId)
    if (newParent === null || !isContainer(newParent)) return false
    if (containsNode(loc.node, newParentId)) return false
  }
  // Removing first shifts indices in the old sibling list; compensate when
  // moving forward within the same list.
  const sameList = (loc.parent === null && newParentId === null) ||
    (loc.parent !== null && loc.parent.id === newParentId)
  siblingsOf(doc, loc.parent).splice(loc.index, 1)
  const adjusted = sameList && index > loc.index ? index - 1 : index
  return insertNode(doc, loc.node, newParentId, adjusted)
}

/**
 * Deep-clone a subtree with fresh ids and de-duplicated names.
 * JSON round-trip instead of structuredClone: the model is plain data, and
 * this stays transparent to Vue's reactive proxies (which structuredClone
 * refuses to clone).
 */
export const cloneSubtree = (doc: FormDocument, node: FormNode): FormNode => {
  const clone = JSON.parse(JSON.stringify(node)) as FormNode
  const rename = (n: FormNode): void => {
    n.id = newId()
    n.name = uniqueName(doc, n.name)
    if (isContainer(n)) n.children.forEach(rename)
  }
  rename(clone)
  return clone
}

export const allNames = (doc: FormDocument): Set<string> => {
  const names = new Set<string>()
  visit(doc.children, (n) => { names.add(n.name); return undefined })
  return names
}

/** Derive a unique field name from a base, appending _2, _3, ... as needed. */
export const uniqueName = (doc: FormDocument, base: string): string => {
  const names = allNames(doc)
  let candidate = base
  let i = 1
  while (names.has(candidate)) candidate = `${base}_${++i}`
  return candidate
}

export const countQuestions = (doc: FormDocument): number =>
  flatten(doc.children).filter((n) => n.kind === 'question').length
