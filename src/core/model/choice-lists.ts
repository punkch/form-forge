/**
 * Pure helpers for shared choice lists and simple cascading-select filters.
 * No Vue imports — src/core stays pure TypeScript.
 */
import { visit } from './ops'
import type { ChoiceList, FormDocument, QuestionNode } from './types'

/** listName → questions bound to it, in document order. */
export const listUsage = (doc: FormDocument): Map<string, QuestionNode[]> => {
  const usage = new Map<string, QuestionNode[]>()
  for (const name of Object.keys(doc.choiceLists)) usage.set(name, [])
  visit(doc.children, (node) => {
    if (node.kind === 'question' && node.listRef !== undefined) {
      const users = usage.get(node.listRef)
      if (users === undefined) usage.set(node.listRef, [node])
      else users.push(node)
    }
    return undefined
  })
  return usage
}

/**
 * Rename a list and update every question's listRef in the same pass.
 * Fails on unknown/empty/colliding names.
 */
export const renameChoiceList = (
  doc: FormDocument,
  oldName: string,
  newName: string
): boolean => {
  const list = doc.choiceLists[oldName]
  if (list === undefined || newName === '' || newName === oldName) return false
  if (doc.choiceLists[newName] !== undefined) return false
  delete doc.choiceLists[oldName]
  list.name = newName
  doc.choiceLists[newName] = list
  visit(doc.children, (node) => {
    if (node.kind === 'question' && node.listRef === oldName) node.listRef = newName
    return undefined
  })
  return true
}

/** Delete a list, clearing the listRef of any question still bound to it. */
export const deleteChoiceList = (doc: FormDocument, name: string): boolean => {
  if (doc.choiceLists[name] === undefined) return false
  delete doc.choiceLists[name]
  visit(doc.children, (node) => {
    if (node.kind === 'question' && node.listRef === name) node.listRef = undefined
    return undefined
  })
  return true
}

/** Extra (cascade/filter) columns: declared order first, then any stragglers
 * found on individual choices. */
export const extraColumns = (list: ChoiceList): string[] => {
  const columns = [...(list.extraColumnOrder ?? [])]
  for (const choice of list.choices) {
    for (const key of Object.keys(choice.extras ?? {})) {
      if (!columns.includes(key)) columns.push(key)
    }
  }
  return columns
}

/** Add a filter column to the list: order entry + an extras key per choice. */
export const ensureFilterColumn = (list: ChoiceList, column: string): void => {
  const order = list.extraColumnOrder ?? []
  if (!order.includes(column)) order.push(column)
  list.extraColumnOrder = order
  for (const choice of list.choices) {
    if (choice.extras?.[column] === undefined) {
      choice.extras = { ...choice.extras, [column]: '' }
    }
  }
}

export interface SimpleChoiceFilter {
  /** The choices-sheet column being matched. */
  column: string
  /** The referenced parent field name (inside ${...}). */
  parentField: string
}

const SIMPLE_FILTER = /^\s*([A-Za-z_][\w.-]*)\s*=\s*\$\{([A-Za-z_][\w.-]*)\}\s*$/

/** Parse a `column=${parent}` filter; anything else returns null (raw mode). */
export const parseSimpleChoiceFilter = (expr: string | undefined): SimpleChoiceFilter | null => {
  if (expr === undefined) return null
  const match = SIMPLE_FILTER.exec(expr)
  if (match === null) return null
  return { column: match[1], parentField: match[2] }
}

export const buildSimpleChoiceFilter = (column: string, parentField: string): string =>
  `${column}=\${${parentField}}`
