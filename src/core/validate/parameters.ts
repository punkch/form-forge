import { displayText } from '../model/display'
import { flatten } from '../model/ops'
import type { FormDocument } from '../model/types'
import { getQuestionType } from '../registry/question-types'
import { hasText } from '../util/guards'
import type { Issue } from './issues'

/**
 * Question types whose registry marks a parameter `required` (range's
 * start/end today) must carry it, or the ODK engine refuses to load the form
 * ("Expected attribute start is not defined"). The serializer fills defaults
 * so the preview still loads, but the author should set real bounds — hence a
 * warning rather than a silent default.
 */
export const validateParameters = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  for (const node of flatten(doc.children)) {
    if (node.kind !== 'question') continue
    const def = getQuestionType(node.type)
    const required = (def?.parameters ?? []).filter((p) => p.required)
    if (required.length === 0) continue
    const params = node.body.parameters ?? {}
    const missing = required.filter((p) => !hasText(params[p.name])).map((p) => p.name)
    if (missing.length === 0) continue
    const name = displayText(node.label) || node.name
    issues.push({
      severity: 'warning',
      code: 'parameters.missing-required',
      message: `${def!.title} "${name}" needs the ${missing.join(' and ')} parameter${missing.length > 1 ? 's' : ''}.`,
      scope: { nodeId: node.id },
    })
  }
  return issues
}
