import { describe, expect, it } from 'vitest'

import { choice, doc, group, q, repeat } from '../../../tests/helpers/doc-builders'
import type { FormDocument } from '../model/types'
import { readWorkbook } from './workbook-read'
import { writeXlsForm } from './writer'

const EN = 'English (en)'
const FR = 'Français (fr)'

const sheetsOf = async (d: FormDocument): Promise<Map<string, string[][]>> => {
  const bytes = await writeXlsForm(d)
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const out = new Map<string, string[][]>()
  for (const [key, sheet] of readWorkbook(data).sheets) out.set(key, sheet.rows)
  return out
}

describe('writeXlsForm', () => {
  it('derives canonical column order filtered to used columns', async () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('text', 'a', 'A', { bind: { required: 'true()', constraint: '. != ""' }, defaultValue: 'x' }),
        q('integer', 'b', 'B', { body: { appearance: 'thousands-sep' } }),
      ],
    })
    const survey = (await sheetsOf(d)).get('survey')
    expect(survey?.[0]).toEqual(['type', 'name', 'label', 'required', 'constraint', 'appearance', 'default'])
    expect(survey?.[1]).toEqual(['text', 'a', 'A', 'true()', '. != ""', '', 'x'])
  })

  it('emits an image default column as a bare filename (model convention)', async () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('image', 'photo', 'Photo', { defaultValue: 'template.png' })],
    })
    const survey = (await sheetsOf(d)).get('survey')
    const header = survey?.[0] as string[]
    expect(survey?.[1][header.indexOf('default')]).toBe('template.png')
  })

  it('strips a legacy jr://images/-prefixed image default on export', async () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('image', 'photo', 'Photo', { defaultValue: 'jr://images/template.png' })],
    })
    const survey = (await sheetsOf(d)).get('survey')
    const header = survey?.[0] as string[]
    expect(survey?.[1][header.indexOf('default')]).toBe('template.png')
  })

  it('expands translated columns after their base in language order', async () => {
    const d = doc({
      title: 'T',
      formId: 't',
      languages: [EN, FR],
      children: [
        q('text', 'a', undefined, {
          label: { [EN]: 'Hi', [FR]: 'Salut' },
          hint: { default: 'plain hint', [FR]: 'indice' },
          media: { image: { [EN]: 'a.png' } },
        }),
      ],
    })
    const survey = (await sheetsOf(d)).get('survey')
    expect(survey?.[0]).toEqual([
      'type', 'name',
      `label::${EN}`, `label::${FR}`,
      'hint', `hint::${FR}`,
      `image::${EN}`,
    ])
    expect(survey?.[1]).toEqual(['text', 'a', 'Hi', 'Salut', 'plain hint', 'indice', 'a.png'])
  })

  it('writes begin/end markers, type tokens and repeat_count by DFS', async () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        group('g', 'G', [
          q('select_one', 'c', 'C', { listRef: 'colors' }),
          repeat('r', 'R', [
            q('rank', 'p', 'P', { listRef: 'colors' }),
          ], { repeatCount: '3' }),
        ]),
        q('select_one_from_file', 'v', 'V', { itemsetFile: 'villages.csv' }),
      ],
      choiceLists: { colors: [choice('red', 'Red')] },
    })
    const survey = (await sheetsOf(d)).get('survey')
    expect(survey?.map((row) => row[0])).toEqual([
      'type', 'begin_group', 'select_one colors', 'begin_repeat', 'rank colors',
      'end_repeat', 'end_group', 'select_one_from_file villages.csv',
    ])
    const header = survey?.[0] as string[]
    const repeatRow = survey?.[3] as string[]
    expect(repeatRow[header.indexOf('repeat_count')]).toBe('3')
  })

  it('appends passthrough and custom columns in first-seen order', async () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('text', 'a', 'A', {
          instanceAttrs: { my_attr: 'iv' },
          bind: { custom: { 'jr:max': '5' } },
          customColumns: { note_col: 'plain', shiny: { [EN]: 'S' } },
        }),
        q('text', 'b', 'B', { body: { custom: { accuracy: '10' } } }),
      ],
    })
    const survey = (await sheetsOf(d)).get('survey')
    expect(survey?.[0]).toEqual([
      'type', 'name', 'label',
      'instance::my_attr', 'bind::jr:max', 'note_col', `shiny::${EN}`, 'body::accuracy',
    ])
  })

  it('writes choices with media, geometry and extras per extraColumnOrder', async () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('select_one', 'x', 'X', { listRef: 'd' })],
      choiceLists: {
        d: [
          { name: 'n1', label: { default: 'N1' }, media: { image: { default: 'n1.png' } }, geometry: '1 2 0 0', extras: { state: 'north', zone: 'z1' } },
          { name: 's1', label: { default: 'S1' }, extras: { state: 'south' } },
        ],
      },
    })
    d.choiceLists.d.extraColumnOrder = ['zone', 'state']
    const choices = (await sheetsOf(d)).get('choices')
    expect(choices).toEqual([
      ['list_name', 'name', 'label', 'image', 'geometry', 'zone', 'state'],
      ['d', 'n1', 'N1', 'n1.png', '1 2 0 0', 'z1', 'north'],
      ['d', 's1', 'S1', '', '', '', 'south'],
    ])
  })

  it('writes settings, entities and extra sheets', async () => {
    const d = doc({
      title: 'My Form',
      formId: 'my_form',
      version: '007',
      children: [q('text', 'hh', 'HH', { saveTo: 'name' })],
      settings: { allowChoiceDuplicates: true, custom: { weird_key: 'kept' } },
      entities: { datasetName: 'households', label: '${hh}', createIf: '1 = 1' },
    })
    d.unknown = { extraSheets: { notes: [['k', 'v'], ['1', '2']] } }
    const sheets = await sheetsOf(d)
    expect(sheets.get('settings')).toEqual([
      ['form_title', 'form_id', 'version', 'allow_choice_duplicates', 'weird_key'],
      ['My Form', 'my_form', '007', 'yes', 'kept'],
    ])
    expect(sheets.get('entities')).toEqual([
      ['list_name', 'label', 'create_if'],
      ['households', '${hh}', '1 = 1'],
    ])
    expect(sheets.get('notes')).toEqual([['k', 'v'], ['1', '2']])
  })

  it('omits choices/settings/entities sheets when empty', async () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A')] })
    d.settings = {}
    const sheets = await sheetsOf(d)
    expect([...sheets.keys()]).toEqual(['survey'])
  })
})
