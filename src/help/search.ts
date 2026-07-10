import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getAllQuestionTypes,
  type QuestionCategory,
  type QuestionTypeDefinition,
} from '@/core/registry/question-types'

/**
 * Case-insensitive substring match of `query` against any of `fields`. An empty
 * (or whitespace-only) query matches everything. The single matching rule
 * shared by the palette, the help reference and the workflow-guide list.
 */
export const matchesFields = (query: string, fields: string[]): boolean => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return fields.some((field) => field.toLowerCase().includes(needle))
}

/** Matches a question type on its title, type token, description and synonyms. */
export const matchesTypeSearch = (def: QuestionTypeDefinition, query: string): boolean =>
  matchesFields(query, [def.title, def.type, def.description, ...(def.searchKeywords ?? [])])

export interface TypeGroup {
  category: QuestionCategory
  label: string
  items: QuestionTypeDefinition[]
}

/**
 * Question types matching `query`, grouped by category in `CATEGORY_ORDER`
 * with empty groups dropped — the shared grouping the palette and the help
 * reference both render.
 */
export const groupTypesBySearch = (query: string): TypeGroup[] => {
  const all = getAllQuestionTypes().filter((def) => matchesTypeSearch(def, query))
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: all.filter((def) => def.category === category),
    }))
    .filter((group) => group.items.length > 0)
}
