import { checkBalance, extractRefs } from '../expr/tokenizer'
import { buildSymbolTable } from '../expr/symbol-table'
import type { FormDocument } from '../model/types'
import { collectExpressionSites } from './expression-sites'
import type { Issue } from './issues'

export const validateExpressions = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  const symbols = buildSymbolTable(doc)

  for (const site of collectExpressionSites(doc)) {
    for (const balance of checkBalance(site.expr)) {
      issues.push({
        severity: 'error',
        code: balance.code,
        message: `${site.field}: ${balance.message}.`,
        scope: { nodeId: site.node.id },
      })
    }

    for (const name of extractRefs(site.expr)) {
      const resolution = symbols.resolve(name)
      if (resolution.status === 'missing') {
        issues.push({
          severity: 'error',
          code: 'expr.unknown-ref',
          message: `${site.field} references \${${name}}, which does not exist.`,
          scope: { nodeId: site.node.id },
        })
      } else if (resolution.status === 'ambiguous') {
        issues.push({
          severity: 'error',
          code: 'expr.ambiguous-ref',
          message: `${site.field} references \${${name}}, which matches ${resolution.entries.length} fields.`,
          scope: { nodeId: site.node.id },
        })
      } else if (site.field === 'constraint' && name === site.node.name) {
        issues.push({
          severity: 'warning',
          code: 'expr.self-ref',
          message: `Constraints should refer to the field's own value as "." instead of \${${name}}.`,
          scope: { nodeId: site.node.id },
        })
      }
    }
  }

  return issues
}
