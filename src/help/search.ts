import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getAllQuestionTypes,
  type QuestionCategory,
  type QuestionTypeDefinition,
} from '@/core/registry/question-types'

/**
 * Case-insensitive substring match on title, type token, description and the
 * type's search synonyms — the single matching rule shared by the palette and
 * the help reference. An empty (or whitespace-only) query matches everything.
 */
export const matchesTypeSearch = (def: QuestionTypeDefinition, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return def.title.toLowerCase().includes(needle) ||
    def.type.toLowerCase().includes(needle) ||
    def.description.toLowerCase().includes(needle) ||
    (def.searchKeywords ?? []).some((kw) => kw.toLowerCase().includes(needle))
}

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
