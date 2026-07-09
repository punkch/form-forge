import { displayText } from '../model/display'
import { flatten } from '../model/ops'
import { isContainer, type FormDocument } from '../model/types'
import type { Issue } from './issues'

/**
 * Empty groups/repeats serialize to body elements the ODK engine rejects
 * ("Unexpected body element for nodeset …"), so the preview store pauses
 * regeneration while any of these warnings exist.
 */
export const validateStructure = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  for (const node of flatten(doc.children)) {
    if (!isContainer(node) || node.children.length > 0) continue
    const kind = node.kind === 'repeat' ? 'Repeat' : 'Group'
    const name = displayText(node.label) || node.name
    issues.push({
      severity: 'warning',
      code: 'structure.empty-container',
      message: `${kind} "${name}" has no questions yet — add a question or delete the ${node.kind}.`,
      scope: { nodeId: node.id },
    })
  }
  return issues
}
