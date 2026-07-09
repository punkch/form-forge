import { visit } from '../model/ops'
import type { FormDocument, FormNode } from '../model/types'

export interface ExpressionSite {
  node: FormNode
  /** Which property holds the expression (for messages). */
  field: 'required' | 'readonly' | 'relevant' | 'constraint' | 'calculation'
  | 'choiceFilter' | 'repeatCount' | 'trigger' | 'default'
  expr: string
}

const has = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== ''

/** Every expression-bearing property in document order. */
export const collectExpressionSites = (doc: FormDocument): ExpressionSite[] => {
  const sites: ExpressionSite[] = []
  visit(doc.children, (node) => {
    const push = (field: ExpressionSite['field'], expr: string | undefined): void => {
      if (has(expr)) sites.push({ node, field, expr })
    }
    push('required', node.bind.required)
    push('readonly', node.bind.readonly)
    push('relevant', node.bind.relevant)
    push('constraint', node.bind.constraint)
    push('calculation', node.bind.calculation)
    push('trigger', node.trigger)
    if (node.kind === 'question') push('choiceFilter', node.choiceFilter)
    if (node.kind === 'repeat') push('repeatCount', node.repeatCount)
    // Defaults are only expressions when they reference other fields or call
    // functions; static literals are skipped by the ${}-scan downstream.
    push('default', node.defaultValue)
    return undefined
  })
  return sites
}
