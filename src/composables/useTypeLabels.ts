import {
  type QuestionCategory,
  type QuestionTypeDefinition,
} from '@/core/registry/question-types'
import { type MessageKey, useAppI18n } from '@/i18n'
import { type TypeLocalizer } from '@/help/search'

/**
 * Localized display strings for question types and their palette categories.
 *
 * The registry (`src/core/registry/question-types.ts`) is pure data whose
 * `title`/`description`/`CATEGORY_LABELS` stay English; the UI translates them
 * here through the `types.*` catalog namespace, keyed by the registry's type
 * token and category id. Coverage of every registry entry in every locale is
 * pinned by `tests/unit/type-labels.spec.ts`, which is what makes the dynamic
 * key casts below safe.
 */
export interface TypeLabels extends TypeLocalizer {
  typeTitle: (def: QuestionTypeDefinition) => string
  typeDescription: (def: QuestionTypeDefinition) => string
  categoryLabel: (category: QuestionCategory) => string
}

export const useTypeLabels = (): TypeLabels => {
  const { t } = useAppI18n()

  const typeTitle = (def: QuestionTypeDefinition): string =>
    t(`types.byType.${def.type}.title` as MessageKey)
  const typeDescription = (def: QuestionTypeDefinition): string =>
    t(`types.byType.${def.type}.description` as MessageKey)
  const categoryLabel = (category: QuestionCategory): string =>
    t(`types.categories.${category}`)

  return {
    typeTitle,
    typeDescription,
    categoryLabel,
    title: typeTitle,
    description: typeDescription,
    category: categoryLabel,
  }
}
