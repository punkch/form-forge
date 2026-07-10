import { parseStructured, type ConditionGroup } from '../expr/structured'
import { checkBalance, extractRefs } from '../expr/tokenizer'
import { buildSymbolTable } from '../expr/symbol-table'
import type { FormDocument } from '../model/types'
import { collectExpressionSites } from './expression-sites'
import { warning, type Issue } from './issues'

/** True when the parsed tree compares a field against the empty string —
 * usually a visual-builder seed literal the author forgot to fill in.
 * Only `= ''` matches the seed shape; `!= ''` is the legitimate
 * "is answered" idiom and must not warn. */
const comparesAgainstEmpty = (group: ConditionGroup): boolean =>
  group.items.some((item) => {
    if (item.kind === 'group') return comparesAgainstEmpty(item)
    if (item.kind === 'comparison') return item.op === '=' && item.literal === ''
    if (item.kind === 'selected') return item.value === ''
    return false
  })

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

    // Conditions comparing against '' are usually a visual-builder default
    // the author never filled in; raw expressions the grammar can't parse
    // are left alone (parseStructured returns null for them).
    if (site.field === 'relevant' || site.field === 'constraint') {
      const tree = parseStructured(site.expr)
      if (tree !== null && comparesAgainstEmpty(tree)) {
        issues.push(warning(
          'expr.empty-condition-value',
          `The ${site.field} condition on "${site.node.name}" compares against an empty value.`,
          { nodeId: site.node.id }
        ))
      }
    }
  }

  return issues
}
