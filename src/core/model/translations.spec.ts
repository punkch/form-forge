import { describe, expect, it } from 'vitest'

import { choice, doc, group, q } from '../../../tests/helpers/doc-builders'
import {
  addLanguage,
  collectTranslationSites,
  languageKey,
  removeLanguage,
  setSiteText,
  siteKey,
  translationStats,
} from './translations'
import { DEFAULT_LANG, type FormDocument } from './types'

const FR = 'French (fr)'
const ES = 'Spanish (es)'

const sampleDoc = (): FormDocument =>
  doc({
    title: 'T',
    formId: 't',
    children: [
      q('text', 'name', 'Your name?', {
        hint: { [DEFAULT_LANG]: 'Full name' },
        bind: { constraint: '. != ""', constraintMessage: { [DEFAULT_LANG]: 'Required!' } },
      }),
      group('g', 'Details', [
        q('select_one', 'state', 'State?', { listRef: 'states' }),
      ]),
    ],
    choiceLists: {
      states: [choice('tx', 'Texas'), choice('wa', 'Washington')],
    },
  })

describe('languageKey', () => {
  it('combines name and code', () => {
    expect(languageKey('French', 'fr')).toBe('French (fr)')
    expect(languageKey('  French ', ' fr ')).toBe('French (fr)')
  })

  it('falls back to the bare name without a code', () => {
    expect(languageKey('French')).toBe('French')
    expect(languageKey('French', '')).toBe('French')
  })
})

describe('collectTranslationSites', () => {
  it('walks labels, hints and messages in document order, then choice labels', () => {
    const d = sampleDoc()
    const sites = collectTranslationSites(d)
    expect(sites.map((s) => s.context)).toEqual([
      'name · Label',
      'name · Hint',
      'name · Constraint message',
      'g · Label',
      'state · Label',
      'states / tx',
      'states / wa',
    ])
  })

  it('skips sites with no value in any language', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a'), q('text', 'b', 'Real label')],
    })
    const sites = collectTranslationSites(d)
    expect(sites.map((s) => s.context)).toEqual(['b · Label'])
  })
})

describe('addLanguage', () => {
  it('adds the language once', () => {
    const d = sampleDoc()
    expect(addLanguage(d, FR)).toBe(true)
    expect(addLanguage(d, FR)).toBe(false)
    expect(d.languages).toEqual([FR])
  })

  it('rejects empty and the default sentinel', () => {
    const d = sampleDoc()
    expect(addLanguage(d, '')).toBe(false)
    expect(addLanguage(d, DEFAULT_LANG)).toBe(false)
  })

  it('migrates every default value into the FIRST language, keeping default', () => {
    const d = sampleDoc()
    addLanguage(d, FR)
    const name = d.children[0]
    expect(name.label).toEqual({ [DEFAULT_LANG]: 'Your name?', [FR]: 'Your name?' })
    expect(name.hint).toEqual({ [DEFAULT_LANG]: 'Full name', [FR]: 'Full name' })
    expect(name.bind.constraintMessage).toEqual({ [DEFAULT_LANG]: 'Required!', [FR]: 'Required!' })
    expect(d.choiceLists.states.choices[0].label).toEqual({ [DEFAULT_LANG]: 'Texas', [FR]: 'Texas' })
  })

  it('does not migrate for subsequent languages', () => {
    const d = sampleDoc()
    addLanguage(d, FR)
    addLanguage(d, ES)
    expect(d.children[0].label).toEqual({ [DEFAULT_LANG]: 'Your name?', [FR]: 'Your name?' })
    expect(d.languages).toEqual([FR, ES])
  })
})

describe('removeLanguage', () => {
  it('strips the key from every LocalizedText in the doc', () => {
    const d = sampleDoc()
    addLanguage(d, FR)
    setSiteText(d, { kind: 'choice', listName: 'states', choiceIndex: 0 }, FR, 'Texas (fr)')
    expect(removeLanguage(d, FR)).toBe(true)
    expect(d.languages).toEqual([])
    expect(d.children[0].label).toEqual({ [DEFAULT_LANG]: 'Your name?' })
    expect(d.children[0].hint).toEqual({ [DEFAULT_LANG]: 'Full name' })
    expect(d.choiceLists.states.choices[0].label).toEqual({ [DEFAULT_LANG]: 'Texas' })
  })

  it('clears texts that end up empty and the default-language setting', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', undefined, { label: { [FR]: 'Seulement FR' } })],
      languages: [FR],
      defaultLanguage: FR,
    })
    removeLanguage(d, FR)
    expect(d.children[0].label).toBeUndefined()
    expect(d.settings.defaultLanguage).toBeUndefined()
  })

  it('returns false for unknown languages', () => {
    const d = sampleDoc()
    expect(removeLanguage(d, FR)).toBe(false)
  })

  it('strips media refs and custom columns too', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('text', 'a', 'A', {
          media: { image: { [DEFAULT_LANG]: 'a.png', [FR]: 'a_fr.png' } },
          customColumns: { 'custom::col': { [FR]: 'only fr' } },
        }),
      ],
      languages: [FR],
    })
    removeLanguage(d, FR)
    const node = d.children[0]
    expect(node.media?.image).toEqual({ [DEFAULT_LANG]: 'a.png' })
    expect(node.customColumns).toEqual({})
  })
})

describe('setSiteText', () => {
  it('writes node fields and bind messages by ref', () => {
    const d = sampleDoc()
    const nameId = d.children[0].id
    setSiteText(d, { kind: 'node', nodeId: nameId, field: 'label' }, FR, 'Votre nom ?')
    setSiteText(d, { kind: 'node', nodeId: nameId, field: 'constraintMessage' }, FR, 'Obligatoire !')
    expect(d.children[0].label?.[FR]).toBe('Votre nom ?')
    expect(d.children[0].bind.constraintMessage?.[FR]).toBe('Obligatoire !')
  })

  it('writes choice labels and removes emptied keys', () => {
    const d = sampleDoc()
    const ref = { kind: 'choice', listName: 'states', choiceIndex: 1 } as const
    setSiteText(d, ref, FR, 'Washington (fr)')
    expect(d.choiceLists.states.choices[1].label?.[FR]).toBe('Washington (fr)')
    setSiteText(d, ref, FR, '')
    expect(d.choiceLists.states.choices[1].label).toEqual({ [DEFAULT_LANG]: 'Washington' })
  })

  it('ignores unknown refs', () => {
    const d = sampleDoc()
    expect(() => {
      setSiteText(d, { kind: 'node', nodeId: 'nope', field: 'label' }, FR, 'x')
      setSiteText(d, { kind: 'choice', listName: 'nope', choiceIndex: 0 }, FR, 'x')
    }).not.toThrow()
  })
})

describe('translationStats + siteKey', () => {
  it('counts non-empty values per language', () => {
    const d = sampleDoc()
    addLanguage(d, FR)
    addLanguage(d, ES)
    const sites = collectTranslationSites(d)
    expect(translationStats(sites, FR)).toEqual({ translated: 7, total: 7 })
    expect(translationStats(sites, ES)).toEqual({ translated: 0, total: 7 })
  })

  it('produces stable, distinct keys', () => {
    const d = sampleDoc()
    const keys = collectTranslationSites(d).map((s) => siteKey(s.ref))
    expect(new Set(keys).size).toBe(keys.length)
  })
})
