import { describe, expect, it } from 'vitest'

import { getAllQuestionTypes, getQuestionType } from '@/core/registry/question-types'
import { docsUrl, fieldHelp, getTypeHelp, typeHelp } from '@/help/content'
import { groupTypesBySearch, matchesTypeSearch } from '@/help/search'
import { en } from '@/i18n/locales/en'

/** Walks a dotted catalog key through the en message tree. */
const resolveKey = (key: string): unknown =>
  key.split('.').reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    en
  )

const expectCatalogText = (key: string, context: string): void => {
  const value = resolveKey(key)
  expect(typeof value, `${context}: ${key} missing from en catalog`).toBe('string')
  expect((value as string).length, `${context}: ${key} is empty`).toBeGreaterThan(0)
}

describe('help content consistency', () => {
  const types = getAllQuestionTypes()

  it('every question type carries a docsAnchor', () => {
    for (const def of types) {
      expect(def.docsAnchor, `${def.type} has no docsAnchor`).toBeTruthy()
    }
  })

  it('docsUrl resolves every type to an absolute ODK docs URL', () => {
    for (const def of types) {
      const url = docsUrl(def)
      expect(url, def.type).toMatch(/^https:\/\/docs\.getodk\.org\//)
    }
  })

  it('bare anchors land on the question-types page, absolute ones stay as-is', () => {
    const selectOne = getQuestionType('select_one')
    const audit = getQuestionType('audit')
    expect(selectOne && docsUrl(selectOne)).toBe('https://docs.getodk.org/form-question-types/#single-select-widget')
    expect(audit && docsUrl(audit)).toBe('https://docs.getodk.org/form-audit-log/')
  })

  it('every question type has extended help resolving to catalog text', () => {
    for (const def of types) {
      const help = getTypeHelp(def.type)
      expect(help, `${def.type} has no typeHelp entry`).toBeDefined()
      if (help === undefined) continue
      expectCatalogText(help.whatItDoes, def.type)
      expectCatalogText(help.xlsformNotes, def.type)
    }
  })

  it('has no orphan typeHelp entries for unregistered types', () => {
    for (const type of Object.keys(typeHelp)) {
      expect(getQuestionType(type), `typeHelp entry '${type}' has no registry type`).toBeDefined()
    }
  })

  it('every appearance and parameter in the registry has a description', () => {
    for (const def of types) {
      for (const appearance of def.appearances ?? []) {
        expect(appearance.description.length, `${def.type}/${appearance.name}`).toBeGreaterThan(0)
      }
      for (const param of def.parameters ?? []) {
        expect(param.description.length, `${def.type}/${param.name}`).toBeGreaterThan(0)
      }
    }
  })

  it('every field help entry resolves to catalog text', () => {
    for (const [field, entry] of Object.entries(fieldHelp)) {
      expectCatalogText(entry.whatItIs, field)
      expectCatalogText(entry.xlsformColumn, field)
    }
  })
})

describe('matchesTypeSearch', () => {
  const selectOne = getQuestionType('select_one')
  if (selectOne === undefined) throw new Error('select_one missing from registry')

  it('matches on title, type token and description, case-insensitively', () => {
    expect(matchesTypeSearch(selectOne, 'Select One')).toBe(true)
    expect(matchesTypeSearch(selectOne, 'select_one')).toBe(true)
    expect(matchesTypeSearch(selectOne, 'single choice')).toBe(true)
    expect(matchesTypeSearch(selectOne, 'barcode')).toBe(false)
  })

  it('matches everything on an empty or whitespace query', () => {
    expect(matchesTypeSearch(selectOne, '')).toBe(true)
    expect(matchesTypeSearch(selectOne, '   ')).toBe(true)
  })

  it('matches on search synonyms absent from the title, token and description', () => {
    const image = getQuestionType('image')
    if (image === undefined) throw new Error('image missing from registry')
    // "photo"/"picture" appear only in searchKeywords, nowhere in Image's text.
    expect(matchesTypeSearch(image, 'photo')).toBe(true)
    expect(matchesTypeSearch(image, 'Picture')).toBe(true)
  })
})

describe('groupTypesBySearch', () => {
  it('surfaces every geo type for the "gps" synonym', () => {
    const matched = groupTypesBySearch('gps').flatMap((g) => g.items.map((def) => def.type))
    expect(matched).toEqual(expect.arrayContaining(['geopoint', 'geotrace', 'geoshape']))
  })

  it('groups matches by category and drops empty groups', () => {
    // "photo" only hits image (media) → exactly one non-empty group.
    const groups = groupTypesBySearch('photo')
    expect(groups).toHaveLength(1)
    expect(groups[0].category).toBe('media')
    expect(groups[0].items.map((def) => def.type)).toContain('image')
  })
})
