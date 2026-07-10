/**
 * Column-aware validation for questions backed by attached dataset files.
 * Runs only against files whose columns the caller managed to parse
 * (columnsByFilename value non-null); absent files keep refs.ts's
 * ref.missing-attachment warning and unparseable ones stay silent.
 */
import { datasetFormatOf, defaultDatasetParams } from '../datasets/parse'
import { maskStringLiterals } from '../expr/tokenizer'
import { visit } from '../model/ops'
import type { FormDocument } from '../model/types'
import { effectiveItemsetFile, getQuestionType } from '../registry/question-types'
import { info, warning, type Issue } from './issues'

/** Operators/literals that scan like bare names but never reference columns. */
const XPATH_WORDS = new Set(['and', 'or', 'mod', 'div', 'not', 'true', 'false'])

/**
 * Bare names a choice_filter compares against dataset columns. Deliberately
 * conservative (info-severity consumers): string literals and `${field}`
 * refs are masked out, function calls, axis/path steps (`../x`, `ns:x`,
 * `@attr`, `$var`) and XPath operator words are skipped, so anything left is
 * an itemset child reference — i.e. a column name.
 */
export const filterColumnCandidates = (expr: string): string[] => {
  const masked = maskStringLiterals(expr)
    .replace(/\$\{[^}]*\}/g, (ref) => ' '.repeat(ref.length))
  const names = new Set<string>()
  const re = /[A-Za-z_][\w.-]*/g
  let match: RegExpExecArray | null
  while ((match = re.exec(masked)) !== null) {
    const before = masked[match.index - 1]
    const after = masked[match.index + match[0].length]
    if (before !== undefined && /[\w.:/$@-]/.test(before)) continue
    if (after === '(' || after === ':') continue
    if (XPATH_WORDS.has(match[0])) continue
    names.add(match[0])
  }
  return [...names]
}

/**
 * Warns when a from-file question's effective value/label column (explicit
 * parameter or the per-format ODK default) is missing from the attached
 * file's parsed columns; choice_filter column references get best-effort
 * info-severity notes.
 */
export const validateDatasets = (
  doc: FormDocument,
  columnsByFilename: ReadonlyMap<string, readonly string[] | null>
): Issue[] => {
  const issues: Issue[] = []

  visit(doc.children, (node) => {
    if (node.kind !== 'question') return undefined
    const def = getQuestionType(node.type)
    if (def?.requiresFile !== true) return undefined
    // Only from-file selects consume value/label/choice_filter columns;
    // csv-external is an opaque instance() source.
    if (!(def.parameters ?? []).some((p) => p.name === 'value')) return undefined

    const filename = effectiveItemsetFile(node)
    if (filename === undefined) return undefined
    const format = datasetFormatOf(filename)
    if (format !== 'csv' && format !== 'geojson') return undefined
    const columns = columnsByFilename.get(filename)
    if (columns === undefined || columns === null || columns.length === 0) return undefined
    const known = new Set(columns)

    const defaults = defaultDatasetParams(format)
    for (const role of ['value', 'label'] as const) {
      const explicit = node.body.parameters?.[role]
      const column = explicit !== undefined && explicit.trim() !== '' ? explicit.trim() : defaults[role]
      if (known.has(column)) continue
      issues.push(warning(
        'dataset.unknown-column',
        explicit !== undefined && explicit.trim() !== ''
          ? `The ${role} column "${column}" does not exist in "${filename}".`
          : `"${filename}" has no "${column}" column — set the ${role} parameter to one of its columns.`,
        { nodeId: node.id }
      ))
    }

    if (node.choiceFilter !== undefined && node.choiceFilter.trim() !== '') {
      for (const name of filterColumnCandidates(node.choiceFilter)) {
        if (known.has(name)) continue
        issues.push(info(
          'dataset.filter-unknown-column',
          `choice_filter references "${name}", which is not a column of "${filename}".`,
          { nodeId: node.id }
        ))
      }
    }
    return undefined
  })

  return issues
}
