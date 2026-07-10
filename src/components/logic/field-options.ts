/**
 * Field metadata for the visual logic builder: every question in the form,
 * with the bind type and (for selects) the internal choice list reference the
 * operator/value widgets adapt to.
 */
import { displayText } from '@/core/model/display'
import { flatten } from '@/core/model/ops'
import type { FormDocument, FormNode } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'

export interface LogicFieldOption {
  /** Field name as referenced by ${name}. */
  name: string
  /** Human label for the picker: "Label (name)" or just the name. */
  label: string
  /** XForm bind type ('string', 'int', 'decimal', 'date', ...). */
  bindType: string
  /** Internal choice list name for select_one/select_multiple/rank. */
  listRef?: string
}

const optionFor = (node: FormNode): LogicFieldOption => {
  const def = node.kind === 'question' ? getQuestionType(node.type) : undefined
  const label = displayText(node.label)
  const option: LogicFieldOption = {
    name: node.name,
    label: label === '' ? node.name : `${label} (${node.name})`,
    bindType: def?.xform.bindType ?? 'string',
  }
  if (node.kind === 'question' && node.listRef !== undefined) option.listRef = node.listRef
  return option
}

/** All referenceable questions, in document order, excluding `excludeId`. */
export const logicFieldOptions = (doc: FormDocument, excludeId?: string): LogicFieldOption[] =>
  flatten(doc.children)
    .filter((n) => n.kind === 'question' && n.id !== excludeId)
    .map(optionFor)

/** Metadata for the `.` (current answer) operand of the node being edited. */
export const selfFieldOption = (node: FormNode, selfLabel: string): LogicFieldOption => {
  const option = optionFor(node)
  return { ...option, name: '.', label: selfLabel }
}

/** Whether a field's value widget edits numbers (int/decimal) rather than text. */
export const isNumericField = (option: LogicFieldOption | undefined): boolean =>
  option !== undefined && (option.bindType === 'int' || option.bindType === 'decimal')

/** The starting literal for a fresh comparison against `option`: 0 for numeric
 * fields, '' otherwise. Shared so the builder's default and a row's operator
 * change agree on the seed value. */
export const defaultLiteral = (option: LogicFieldOption | undefined): number | string =>
  isNumericField(option) ? 0 : ''
