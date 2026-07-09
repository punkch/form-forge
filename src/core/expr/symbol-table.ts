import { buildNodeIndex, type NodeIndex, type NodeIndexEntry } from '../model/index-utils'
import type { FormDocument } from '../model/types'

export type Resolution =
  | { status: 'ok', entry: NodeIndexEntry }
  | { status: 'missing' }
  | { status: 'ambiguous', entries: NodeIndexEntry[] }

export interface SymbolTable {
  index: NodeIndex
  resolve: (name: string) => Resolution
  /** Absolute instance path of the innermost repeat containing the entry. */
  nearestRepeatPath: (entry: NodeIndexEntry) => string | null
  entryByPath: (path: string) => NodeIndexEntry | null
}

export const buildSymbolTable = (doc: FormDocument): SymbolTable => {
  const index = buildNodeIndex(doc)
  const byPath = new Map<string, NodeIndexEntry>()
  for (const entry of index.byId.values()) byPath.set(entry.path, entry)

  const resolve = (name: string): Resolution => {
    const entries = index.byName.get(name)
    if (entries === undefined || entries.length === 0) return { status: 'missing' }
    if (entries.length > 1) return { status: 'ambiguous', entries }
    return { status: 'ok', entry: entries[0] }
  }

  const nearestRepeatPath = (entry: NodeIndexEntry): string | null => {
    for (let i = entry.ancestors.length - 1; i >= 0; i--) {
      const ancestor = index.byId.get(entry.ancestors[i])
      if (ancestor !== undefined && ancestor.node.kind === 'repeat') return ancestor.path
    }
    return null
  }

  return {
    index,
    resolve,
    nearestRepeatPath,
    entryByPath: (path) => byPath.get(path) ?? null,
  }
}
