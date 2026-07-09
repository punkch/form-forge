import { isContainer, type FormDocument, type FormNode } from './types'

export interface NodeIndexEntry {
  node: FormNode
  /** Absolute instance path, e.g. /data/group_a/age. */
  path: string
  /** Ancestor chain of node ids, outermost first. */
  ancestors: string[]
  /** True when the node lives inside a repeat. */
  inRepeat: boolean
}

export interface NodeIndex {
  byId: Map<string, NodeIndexEntry>
  /** name → entries; more than one entry means the name is ambiguous. */
  byName: Map<string, NodeIndexEntry[]>
}

export const INSTANCE_ROOT = 'data'

/** Build the id/name index with absolute instance paths. */
export const buildNodeIndex = (doc: FormDocument, instanceRoot = INSTANCE_ROOT): NodeIndex => {
  const byId = new Map<string, NodeIndexEntry>()
  const byName = new Map<string, NodeIndexEntry[]>()

  const walk = (nodes: FormNode[], prefix: string, ancestors: string[], inRepeat: boolean): void => {
    for (const node of nodes) {
      const path = `${prefix}/${node.name}`
      const entry: NodeIndexEntry = { node, path, ancestors, inRepeat }
      byId.set(node.id, entry)
      const list = byName.get(node.name)
      if (list === undefined) byName.set(node.name, [entry])
      else list.push(entry)
      if (isContainer(node)) {
        walk(node.children, path, [...ancestors, node.id], inRepeat || node.kind === 'repeat')
      }
    }
  }

  walk(doc.children, `/${instanceRoot}`, [], false)
  return { byId, byName }
}
