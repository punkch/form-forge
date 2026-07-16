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

/**
 * Localized display strings for the registry's English `title`/`description`/
 * `CATEGORY_LABELS`. Provided by `useTypeLabels()`; this module stays free of
 * vue-i18n so the matching/grouping rules remain plain testable functions.
 */
export interface TypeLocalizer {
  title: (def: QuestionTypeDefinition) => string
  description: (def: QuestionTypeDefinition) => string
  category: (category: QuestionCategory) => string
}

/**
 * Matches a question type on its title, type token, description and synonyms —
 * in English always (so `select_one` or "text" match in any locale), plus the
 * localized title/description when a localizer is given.
 */
export const matchesTypeSearch = (
  def: QuestionTypeDefinition,
  query: string,
  localize?: TypeLocalizer
): boolean =>
  matchesFields(query, [
    def.title,
    def.type,
    def.description,
    ...(def.searchKeywords ?? []),
    ...(localize === undefined ? [] : [localize.title(def), localize.description(def)]),
  ])

export interface TypeGroup {
  category: QuestionCategory
  label: string
  items: QuestionTypeDefinition[]
}

/**
 * Question types matching `query`, grouped by category in `CATEGORY_ORDER`
 * with empty groups dropped — the shared grouping the palette and the help
 * reference both render. Group labels come from the localizer when given,
 * else the registry's English `CATEGORY_LABELS`.
 */
export const groupTypesBySearch = (query: string, localize?: TypeLocalizer): TypeGroup[] => {
  const all = getAllQuestionTypes().filter((def) => matchesTypeSearch(def, query, localize))
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: localize === undefined ? CATEGORY_LABELS[category] : localize.category(category),
      items: all.filter((def) => def.category === category),
    }))
    .filter((group) => group.items.length > 0)
}
