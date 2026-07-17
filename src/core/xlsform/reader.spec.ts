import { describe, expect, it } from 'vitest'

import { DEFAULT_LANG, type GroupNode, type QuestionNode, type RepeatNode } from '../model/types'
import { isSheetScope, type Issue } from '../validate/issues'
import { parseParameters, readXlsForm } from './reader'
import { writeWorkbook } from './workbook-write'

/** Builds a real in-memory workbook from raw rows (all cells as text). */
const workbook = async (sheets: Record<string, string[][]>): Promise<ArrayBuffer> => {
  const bytes = await writeWorkbook(
    Object.entries(sheets).map(([name, rows]) => ({ name, rows }))
  )
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

const read = async (sheets: Record<string, string[][]>) => readXlsForm(await workbook(sheets))

const errors = (issues: Issue[]): Issue[] => issues.filter((i) => i.severity === 'error')

const sheetRow = (issue: Issue): [string, number] => {
  if (!isSheetScope(issue.scope)) throw new Error('expected sheet scope')
  return [issue.scope.sheet, issue.scope.row]
}

describe('parseParameters', () => {
  it.each([
    ['start=1 end=10 step=1', { start: '1', end: '10', step: '1' }],
    ['randomize=true, seed=42', { randomize: 'true', seed: '42' }],
    ['randomize=true,seed=42', { randomize: 'true', seed: '42' }],
    ['quality=low', { quality: 'low' }],
    ['', {}],
  ])('parses %j', (raw, expected) => {
    expect(parseParameters(raw)).toEqual(expected)
  })
})

describe('readXlsForm', () => {
  it('errors when the survey sheet is missing', async () => {
    const { document, issues } = await read({ settings: [['form_id'], ['x']] })
    expect(issues).toEqual([expect.objectContaining({ severity: 'error', code: 'sheet.missing-survey' })])
    expect(document.children).toEqual([])
  })

  it('maps survey columns onto the model', async () => {
    const { document, issues } = await read({
      Survey: [
        ['type', 'name', 'label', 'hint', 'required', 'read only', 'relevant', 'constraint',
          'constraint message', 'calculation', 'appearance', 'default', 'save_to'],
        ['text', 'a', 'A?', 'a hint', 'yes', 'no', '${b} = 1', '. != ""', 'bad a', '', 'multiline', 'x', 'prop_a'],
        ['integer', 'b', 'B?', '', 'true()', 'yes', '', '', '', '1 + 2', '', '', ''],
      ],
    })
    expect(errors(issues)).toEqual([])
    const [a, b] = document.children as QuestionNode[]
    expect(a).toMatchObject({
      kind: 'question',
      type: 'text',
      name: 'a',
      label: { [DEFAULT_LANG]: 'A?' },
      hint: { [DEFAULT_LANG]: 'a hint' },
      bind: {
        required: 'true()',
        relevant: '${b} = 1',
        constraint: '. != ""',
        constraintMessage: { [DEFAULT_LANG]: 'bad a' },
      },
      body: { appearance: 'multiline' },
      defaultValue: 'x',
      saveTo: 'prop_a',
    })
    expect(a.bind.readonly).toBeUndefined() // 'no' → omitted
    expect(b.bind).toMatchObject({ required: 'true()', readonly: 'true()', calculation: '1 + 2' })
  })

  it('keeps a bare image default cell as-is', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'default'],
        ['image', 'photo', 'template.png'],
      ],
    })
    expect(errors(issues)).toEqual([])
    expect((document.children[0] as QuestionNode).defaultValue).toBe('template.png')
  })

  it('strips a jr://images/-prefixed image default cell in an imported sheet', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'default'],
        ['image', 'photo', 'jr://images/template.png'],
      ],
    })
    expect(errors(issues)).toEqual([])
    expect((document.children[0] as QuestionNode).defaultValue).toBe('template.png')
  })

  it('leaves a non-image default cell verbatim (no prefix stripping)', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'default'],
        ['text', 'a', 'jr://images/not-stripped.png'],
      ],
    })
    expect(errors(issues)).toEqual([])
    expect((document.children[0] as QuestionNode).defaultValue).toBe('jr://images/not-stripped.png')
  })

  it('collects languages in first-seen header order and localizes text/media', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'label::English (en)', 'label::Français (fr)', 'media::image::English (en)'],
        ['text', 'a', 'Hi', 'Salut', 'a.png'],
      ],
      choices: [
        ['list_name', 'name', 'label::Deutsch (de)'],
        ['l', 'x', 'X'],
      ],
    })
    expect(errors(issues)).toEqual([])
    expect(document.languages).toEqual(['English (en)', 'Français (fr)', 'Deutsch (de)'])
    const a = document.children[0] as QuestionNode
    expect(a.label).toEqual({ 'English (en)': 'Hi', 'Français (fr)': 'Salut' })
    expect(a.media).toEqual({ image: { 'English (en)': 'a.png' } })
    expect(document.choiceLists.l.choices[0].label).toEqual({ 'Deutsch (de)': 'X' })
  })

  it('builds nested groups and repeats via the stack machine', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'label', 'repeat_count', 'appearance'],
        ['begin group', 'g', 'G', '', 'field-list'],
        ['text', 'a', 'A', '', ''],
        ['begin_repeat', 'r', 'R', '${n}', ''],
        ['text', 'b', 'B', '', ''],
        ['end repeat', '', '', '', ''],
        ['end_group', '', '', '', ''],
        ['integer', 'n', 'N', '', ''],
      ],
    })
    expect(errors(issues)).toEqual([])
    const g = document.children[0] as GroupNode
    expect(g).toMatchObject({ kind: 'group', name: 'g', body: { appearance: 'field-list' } })
    expect(g.children.map((n) => n.name)).toEqual(['a', 'r'])
    const r = g.children[1] as RepeatNode
    expect(r).toMatchObject({ kind: 'repeat', repeatCount: '${n}' })
    expect(r.children.map((n) => n.name)).toEqual(['b'])
    expect(document.children[1].name).toBe('n')
  })

  it('reports structural mismatches with 1-based row numbers', async () => {
    const { issues } = await read({
      survey: [
        ['type', 'name'],
        ['end_group', ''],
        ['begin_repeat', 'r'],
        ['end_group', ''],
        ['begin_group', 'g'],
      ],
    })
    const codes = issues.map((i) => [i.code, ...sheetRow(i)])
    expect(codes).toContainEqual(['structure.unmatched-end', 'survey', 2])
    expect(codes).toContainEqual(['structure.mismatched-end', 'survey', 4])
    expect(codes).toContainEqual(['structure.unclosed', 'survey', 5])
  })

  it('skips unknown types and rows without a type or name', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'label'],
        ['floop', 'x', 'X'],
        ['', 'y', 'Y'],
        ['text', '', 'Z'],
        ['select_one', 'm', 'M'],
        ['text', 'ok', 'OK'],
      ],
    })
    expect(document.children.map((n) => n.name)).toEqual(['ok'])
    const codes = issues.map((i) => [i.code, i.severity, ...sheetRow(i)])
    expect(codes).toContainEqual(['type.unknown', 'error', 'survey', 2])
    expect(codes).toContainEqual(['row.no-type', 'warning', 'survey', 3])
    expect(codes).toContainEqual(['name.missing', 'error', 'survey', 4])
    expect(codes).toContainEqual(['type.missing-list', 'error', 'survey', 5])
  })

  it('resolves pyxform type aliases and legacy metadata types', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'label'],
        ['trigger', 'ack', 'Noted?'],
        ['imei', 'device', ''],
        ['photo', 'pic', 'Pic'],
        ['location', 'loc', 'Loc'],
        ['simserial', 'sim', ''],
        ['subscriberid', 'subscriber', ''],
      ],
    })
    expect(errors(issues)).toEqual([])
    const kids = document.children as QuestionNode[]
    expect(kids.map((k) => k.type)).toEqual([
      'acknowledge', 'deviceid', 'image', 'geopoint', 'simserial', 'subscriberid',
    ])
  })

  it('parses select variants, from-file itemsets and rank', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'label', 'choice_filter', 'parameters'],
        ['select_one colors', 'c', 'C', '', ''],
        ['select multiple colors', 'm', 'M', 'state=${c}', ''],
        ['select all that apply colors', 's', 'S', '', ''],
        ['rank colors', 'r', 'R', '', ''],
        ['select_one_from_file v.csv', 'v', 'V', '', 'value=id label=title'],
        ['select multiple from file g.geojson', 'g', 'G', '', ''],
        ['csv-external', 'lookup', '', '', ''],
        ['dateTime', 'dt', 'DT', '', ''],
      ],
      choices: [
        ['list_name', 'name', 'label'],
        ['colors', 'red', 'Red'],
      ],
    })
    expect(errors(issues)).toEqual([])
    const kids = document.children as QuestionNode[]
    expect(kids.map((k) => [k.type, k.listRef ?? k.itemsetFile])).toEqual([
      ['select_one', 'colors'],
      ['select_multiple', 'colors'],
      ['select_multiple', 'colors'],
      ['rank', 'colors'],
      ['select_one_from_file', 'v.csv'],
      ['select_multiple_from_file', 'g.geojson'],
      ['csv-external', undefined],
      ['datetime', undefined],
    ])
    expect(kids[1].choiceFilter).toBe('state=${c}')
    expect(kids[4].body.parameters).toEqual({ value: 'id', label: 'title' })
  })

  it('routes passthrough and unknown columns to their escape hatches', async () => {
    const { document, issues } = await read({
      survey: [
        ['type', 'name', 'instance::my_attr', 'bind::jr:max', 'body::accuracy', 'my_note', 'my_note::English (en)'],
        ['text', 'a', 'iv', 'bv', 'cv', 'plain', 'translated'],
      ],
    })
    expect(errors(issues)).toEqual([])
    const a = document.children[0] as QuestionNode
    expect(a.instanceAttrs).toEqual({ my_attr: 'iv' })
    expect(a.bind.custom).toEqual({ 'jr:max': 'bv' })
    expect(a.body.custom).toEqual({ accuracy: 'cv' })
    expect(a.customColumns).toEqual({
      my_note: { [DEFAULT_LANG]: 'plain', 'English (en)': 'translated' },
    })
  })

  it('reads choices with media, geometry and extra cascade columns', async () => {
    const { document, issues } = await read({
      choices: [
        ['list_name', 'name', 'label', 'image', 'geometry', 'state'],
        ['d', 'n1', 'North One', 'n1.png', '7.9 38.6 0 0', 'north'],
        ['d', 's1', 'South One', '', '', 'south'],
        ['plain', 'x', 'X', '', '', ''],
        ['', 'orphan', 'O', '', '', ''],
        ['broken', '', 'no name', '', '', ''],
      ],
      survey: [['type', 'name'], ['select_one d', 'q']],
    })
    const d = document.choiceLists.d
    expect(d.choices[0]).toEqual({
      name: 'n1',
      label: { [DEFAULT_LANG]: 'North One' },
      media: { image: { [DEFAULT_LANG]: 'n1.png' } },
      geometry: '7.9 38.6 0 0',
      extras: { state: 'north' },
    })
    expect(d.extraColumnOrder).toEqual(['state'])
    expect(document.choiceLists.plain.extraColumnOrder).toBeUndefined()
    const codes = issues.map((i) => [i.code, i.severity])
    expect(codes).toContainEqual(['choices.missing-list-name', 'warning'])
    expect(codes).toContainEqual(['choices.missing-name', 'error'])
  })

  it('reads settings incl. aliases, custom keys and extra-row warnings', async () => {
    const { document, issues } = await read({
      survey: [['type', 'name'], ['text', 'a']],
      settings: [
        ['title', 'id_string', 'version', 'instance_name', 'default_language', 'style',
          'public_key', 'submission_url', 'allow_choice_duplicates', 'weird_key'],
        ['My Form', 'my_form', '007', 'concat(${a})', 'English (en)', 'pages',
          'KEY', 'https://x.example', 'yes', 'kept'],
        ['Ignored', '', '', '', '', '', '', '', '', ''],
      ],
    })
    expect(document.settings).toEqual({
      formTitle: 'My Form',
      formId: 'my_form',
      version: '007',
      instanceName: 'concat(${a})',
      defaultLanguage: 'English (en)',
      style: 'pages',
      publicKey: 'KEY',
      submissionUrl: 'https://x.example',
      allowChoiceDuplicates: true,
      custom: { weird_key: 'kept' },
    })
    expect(issues.map((i) => i.code)).toContain('settings.extra-rows')
  })

  it('reads the entities sheet', async () => {
    const { document, issues } = await read({
      survey: [['type', 'name', 'save_to'], ['text', 'hh', 'household_name']],
      entities: [
        ['list_name', 'label', 'create_if', 'update_if', 'entity_id'],
        ['households', '${hh}', '${hh} != ""', 'false()', 'uuid()'],
      ],
    })
    expect(errors(issues)).toEqual([])
    expect(document.entities).toEqual({
      datasetName: 'households',
      label: '${hh}',
      createIf: '${hh} != ""',
      updateIf: 'false()',
      entityId: 'uuid()',
    })
    expect((document.children[0] as QuestionNode).saveTo).toBe('household_name')
  })

  it('preserves unknown sheets verbatim and warns on legacy separators', async () => {
    const { document, issues } = await read({
      survey: [['type', 'name', 'label:English (en)'], ['text', 'a', 'A']],
      'my notes': [['whatever', 'cells'], ['1', '2']],
    })
    expect(document.unknown?.extraSheets).toEqual({
      'my notes': [['whatever', 'cells'], ['1', '2']],
    })
    expect(issues).toContainEqual(expect.objectContaining({
      code: 'column.legacy-separator',
      severity: 'warning',
      scope: { sheet: 'survey', row: 1, column: 'label:English (en)' },
    }))
  })

  it('never throws on non-workbook bytes', async () => {
    const junk = new TextEncoder().encode('not an xlsx').buffer as ArrayBuffer
    const { document, issues } = await readXlsForm(junk)
    expect(document.children).toEqual([])
    expect(issues.some((i) => i.severity === 'error')).toBe(true)
  })
})
