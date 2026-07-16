import { describe, expect, it } from 'vitest'

import { CATEGORY_ORDER, getAllQuestionTypes, getQuestionType } from '@/core/registry/question-types'
import { groupTypesBySearch, matchesTypeSearch, type TypeLocalizer } from '@/help/search'
import { en } from '@/i18n/locales/en'
import { es } from '@/i18n/locales/es'
import { fr } from '@/i18n/locales/fr'

/**
 * The `types.*` catalog namespace localizes the registry's English
 * `title`/`description`/`CATEGORY_LABELS` (rendered via `useTypeLabels()`,
 * which reaches these entries through a dynamic-key cast the type system
 * cannot check). This spec is what makes that cast safe: every registry type
 * and category must have an entry, in every locale, and the catalog must not
 * accumulate entries for types the registry no longer knows.
 */
const catalogs = { en, fr, es }

type TypesNamespace = typeof en.types

describe('types catalog ↔ registry coverage', () => {
  const types = getAllQuestionTypes()

  for (const [locale, catalog] of Object.entries(catalogs)) {
    const ns = (catalog as { types: TypesNamespace }).types

    it(`${locale}: every registry type has a non-empty title and description`, () => {
      for (const def of types) {
        const entry = ns.byType[def.type as keyof TypesNamespace['byType']]
        expect(entry, `${locale}: types.byType.${def.type} missing`).toBeDefined()
        expect(entry.title.length, `${locale}: types.byType.${def.type}.title empty`).toBeGreaterThan(0)
        expect(entry.description.length, `${locale}: types.byType.${def.type}.description empty`).toBeGreaterThan(0)
      }
    })

    it(`${locale}: every category has a non-empty label`, () => {
      for (const category of CATEGORY_ORDER) {
        const label = ns.categories[category]
        expect(typeof label, `${locale}: types.categories.${category} missing`).toBe('string')
        expect(label.length, `${locale}: types.categories.${category} empty`).toBeGreaterThan(0)
      }
    })

    it(`${locale}: has no orphan entries for unregistered types or categories`, () => {
      for (const type of Object.keys(ns.byType)) {
        expect(getQuestionType(type), `${locale}: types.byType.${type} has no registry type`).toBeDefined()
      }
      for (const category of Object.keys(ns.categories)) {
        expect(CATEGORY_ORDER, `${locale}: types.categories.${category} has no registry category`).toContain(category)
      }
    })
  }

  it('en mirrors the registry text verbatim (registry stays the source of truth)', () => {
    for (const def of types) {
      const entry = en.types.byType[def.type as keyof TypesNamespace['byType']]
      expect(entry.title, `en title for ${def.type}`).toBe(def.title)
      expect(entry.description, `en description for ${def.type}`).toBe(def.description)
    }
  })
})

describe('type search with a localizer', () => {
  const selectOne = getQuestionType('select_one')
  if (selectOne === undefined) throw new Error('select_one missing from registry')

  const esLocalizer: TypeLocalizer = {
    title: (def) => es.types.byType[def.type as keyof TypesNamespace['byType']].title,
    description: (def) => es.types.byType[def.type as keyof TypesNamespace['byType']].description,
    category: (category) => es.types.categories[category],
  }

  it('matches the localized title and description on top of the English fields', () => {
    expect(matchesTypeSearch(selectOne, 'selección única', esLocalizer)).toBe(true)
    expect(matchesTypeSearch(selectOne, 'una sola opción', esLocalizer)).toBe(true)
    // English keeps matching in any locale, so type tokens stay searchable.
    expect(matchesTypeSearch(selectOne, 'select_one', esLocalizer)).toBe(true)
    expect(matchesTypeSearch(selectOne, 'Select one', esLocalizer)).toBe(true)
  })

  it('labels groups through the localizer', () => {
    const groups = groupTypesBySearch('', esLocalizer)
    const select = groups.find((g) => g.category === 'select')
    expect(select?.label).toBe(es.types.categories.select)
  })
})
