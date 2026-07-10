import { describe, expect, it } from 'vitest'

import { choice, doc, group, q } from '../../../tests/helpers/doc-builders'
import {
  addLanguage,
  collectTranslationSites,
  isRarelyUsedSite,
  languageKey,
  removeLanguage,
  setSiteText,
  siteKey,
  translationStats,
  untranslatedCellCount,
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
  it('walks relevant node fields in document order, then choice labels', () => {
    const d = sampleDoc()
    const sites = collectTranslationSites(d)
    expect(sites.map((s) => s.context)).toEqual([
      'name · Label',
      'name · Hint',
      'name · Constraint message',
      'name · Guidance hint',
      'g · Label',
      'g · Hint',
      'g · Guidance hint',
      'state · Label',
      'state · Hint',
      'state · Guidance hint',
      'states / tx',
      'states / wa',
    ])
  })

  it('always emits label, hint and guidance hint even with no value yet', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a'), q('text', 'b', 'Real label')],
    })
    const sites = collectTranslationSites(d)
    expect(sites.map((s) => s.context)).toEqual([
      'a · Label', 'a · Hint', 'a · Guidance hint',
      'b · Label', 'b · Hint', 'b · Guidance hint',
    ])
    expect(sites.every((s) => s.text !== undefined)).toBe(true)
  })

  it('emits a constraint-message site only when bind.constraint is set', () => {
    const withConstraint = doc({
      title: 'T',
      formId: 't',
      children: [q('integer', 'age', 'Age?', { bind: { constraint: '. > 0' } })],
    })
    const without = doc({
      title: 'T',
      formId: 't',
      children: [q('integer', 'age', 'Age?')],
    })
    expect(collectTranslationSites(withConstraint).map((s) => s.context))
      .toContain('age · Constraint message')
    expect(collectTranslationSites(without).map((s) => s.context))
      .not.toContain('age · Constraint message')
  })

  it('emits a required-message site only when bind.required is set', () => {
    const required = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A', { bind: { required: 'true()' } })],
    })
    const optional = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A')],
    })
    expect(collectTranslationSites(required).map((s) => s.context))
      .toContain('a · Required message')
    expect(collectTranslationSites(optional).map((s) => s.context))
      .not.toContain('a · Required message')
  })

  it('emits node and choice media sites only where a ref exists', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('text', 'a', 'A', { media: { image: { [FR]: 'a_fr.png' }, video: {} } }),
        q('text', 'b', 'B'),
      ],
      choiceLists: {
        states: [
          { name: 'tx', label: { [DEFAULT_LANG]: 'Texas' }, media: { audio: { [DEFAULT_LANG]: 'tx.mp3' } } },
          choice('wa', 'Washington'),
        ],
      },
    })
    const contexts = collectTranslationSites(d).map((s) => s.context)
    expect(contexts).toContain('a · Image')
    expect(contexts).not.toContain('a · Video')
    expect(contexts).not.toContain('b · Image')
    expect(contexts).toContain('states / tx · Audio')
    expect(contexts).not.toContain('states / wa · Audio')
  })
})

describe('isRarelyUsedSite', () => {
  it('flags only guidance-hint node sites', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('text', 'a', 'A', {
          bind: { constraint: '. != ""', required: 'true()' },
          media: { image: { [DEFAULT_LANG]: 'a.png' } },
        }),
      ],
      choiceLists: { states: [choice('tx', 'Texas')] },
    })
    const sites = collectTranslationSites(d)
    const rare = sites.filter((s) => isRarelyUsedSite(s.ref)).map((s) => s.context)
    expect(rare).toEqual(['a · Guidance hint'])
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

  it('writes node media slots and removes emptied keys', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A', { media: { image: { [DEFAULT_LANG]: 'a.png' } } })],
      languages: [FR],
    })
    const ref = { kind: 'node-media', nodeId: d.children[0].id, slot: 'image' } as const
    setSiteText(d, ref, FR, 'a_fr.png')
    expect(d.children[0].media?.image).toEqual({ [DEFAULT_LANG]: 'a.png', [FR]: 'a_fr.png' })
    setSiteText(d, ref, FR, '')
    expect(d.children[0].media?.image).toEqual({ [DEFAULT_LANG]: 'a.png' })
  })

  it('clearing the last media value removes the slot and then media itself', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A', { media: { image: { [FR]: 'a_fr.png' } } })],
      languages: [FR],
    })
    setSiteText(d, { kind: 'node-media', nodeId: d.children[0].id, slot: 'image' }, FR, '')
    expect(d.children[0].media).toBeUndefined()
  })

  it('deletes an emptied media slot while a sibling slot survives', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A', {
        media: { image: { [FR]: 'a_fr.png' }, audio: { [DEFAULT_LANG]: 'a.mp3' } },
      })],
      languages: [FR],
    })
    // Emptying the image slot's only value drops that slot, but the audio
    // sibling keeps the media object alive — no whole-object removal.
    setSiteText(d, { kind: 'node-media', nodeId: d.children[0].id, slot: 'image' }, FR, '')
    expect(d.children[0].media).toEqual({ audio: { [DEFAULT_LANG]: 'a.mp3' } })
  })

  it('writes choice media slots', () => {
    const d = sampleDoc()
    const ref = { kind: 'choice-media', listName: 'states', choiceIndex: 0, slot: 'audio' } as const
    setSiteText(d, ref, FR, 'tx_fr.mp3')
    expect(d.choiceLists.states.choices[0].media?.audio).toEqual({ [FR]: 'tx_fr.mp3' })
    setSiteText(d, ref, FR, '')
    expect(d.choiceLists.states.choices[0].media).toBeUndefined()
  })

  it('ignores unknown refs', () => {
    const d = sampleDoc()
    expect(() => {
      setSiteText(d, { kind: 'node', nodeId: 'nope', field: 'label' }, FR, 'x')
      setSiteText(d, { kind: 'node-media', nodeId: 'nope', slot: 'image' }, FR, 'x')
      setSiteText(d, { kind: 'choice', listName: 'nope', choiceIndex: 0 }, FR, 'x')
      setSiteText(d, { kind: 'choice-media', listName: 'nope', choiceIndex: 0, slot: 'image' }, FR, 'x')
    }).not.toThrow()
  })
})

describe('untranslatedCellCount', () => {
  it('returns 0 when the form declares no languages', () => {
    expect(untranslatedCellCount(sampleDoc())).toBe(0)
  })

  it('excludes empty authoring rows, counting only text-bearing sites', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A')],
      languages: [FR],
    })
    // 'a' has a label but an empty hint and guidance hint — those always-
    // editable rows are authoring affordances, not missing translations. Only
    // the label counts, and it lacks its FR value → exactly one missing cell.
    expect(untranslatedCellCount(d)).toBe(1)
  })

  it('counts missing cells across every declared language', () => {
    const d = sampleDoc()
    addLanguage(d, FR) // first language: migrates default text into FR
    addLanguage(d, ES) // subsequent: no migration, so ES starts empty
    // Seven sites carry text (label/hint/constraint-message of 'name', the two
    // group/state labels, both choice labels). FR is fully migrated; ES has
    // none → the ES column accounts for all seven missing cells.
    expect(untranslatedCellCount(d)).toBe(7)
  })
})

describe('translationStats + siteKey', () => {
  it('counts non-empty values per language', () => {
    const d = sampleDoc()
    addLanguage(d, FR)
    addLanguage(d, ES)
    const sites = collectTranslationSites(d)
    expect(translationStats(sites, FR)).toEqual({ translated: 7, total: 12 })
    expect(translationStats(sites, ES)).toEqual({ translated: 0, total: 12 })
  })

  it('produces stable, distinct keys across all four kinds', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A', { media: { image: { [DEFAULT_LANG]: 'a.png' } } })],
      choiceLists: {
        states: [{ name: 'tx', label: { [DEFAULT_LANG]: 'Texas' }, media: { audio: { [DEFAULT_LANG]: 'tx.mp3' } } }],
      },
    })
    const keys = collectTranslationSites(d).map((s) => siteKey(s.ref))
    expect(new Set(keys).size).toBe(keys.length)
    const nodeId = d.children[0].id
    expect(keys).toContain(`node:${nodeId}.label`)
    expect(keys).toContain(`node-media:${nodeId}.image`)
    expect(keys).toContain('choice:states[0]')
    expect(keys).toContain('choice-media:states[0].audio')
  })
})
