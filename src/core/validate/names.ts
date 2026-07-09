import { buildNodeIndex } from '../model/index-utils'
import type { FormDocument } from '../model/types'
import type { Issue } from './issues'

/**
 * ODK field names must be valid XML element names; pyxform additionally
 * allows dots and dashes after the first character.
 */
export const NAME_RE = /^[A-Za-z_][A-Za-z0-9._-]*$/

const RESERVED_NAMES = new Set(['meta', 'instanceID', 'instanceName'])

export const validateNames = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  const index = buildNodeIndex(doc)

  for (const [name, entries] of index.byName) {
    for (const entry of entries) {
      if (!NAME_RE.test(name)) {
        issues.push({
          severity: 'error',
          code: 'name.invalid',
          message: `"${name}" is not a valid field name. Names must start with a letter or underscore and contain only letters, numbers, dots, dashes and underscores.`,
          scope: { nodeId: entry.node.id },
        })
      }
      if (RESERVED_NAMES.has(name)) {
        issues.push({
          severity: 'error',
          code: 'name.reserved',
          message: `"${name}" is reserved for form metadata.`,
          scope: { nodeId: entry.node.id },
        })
      }
    }
    if (entries.length > 1) {
      // Duplicate names among siblings are always invalid; across branches
      // they break ${} references, so flag every duplicate as an error.
      for (const entry of entries) {
        issues.push({
          severity: 'error',
          code: 'name.duplicate',
          message: `Field name "${name}" is used ${entries.length} times. Names must be unique within a form.`,
          scope: { nodeId: entry.node.id },
        })
      }
    }
  }

  return issues
}
