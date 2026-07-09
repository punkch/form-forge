import { describe, expect, it } from 'vitest'

import { choice, doc, q } from '../../../tests/helpers/doc-builders'
import { isDynamicDefault, serializeXForm } from './serializer'

describe('isDynamicDefault', () => {
  it.each([['today()', true], ['${age}', true], ['1.5', false], ['yes', false], ['2026-01-01', false]])(
    '%s → %s', (value, expected) => {
      expect(isDynamicDefault(value)).toBe(expected)
    })
})

describe('serializeXForm details', () => {
  it('reports unknown refs as issues and keeps the token', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A', { bind: { relevant: '${ghost} = 1' } })],
    })
    const { xml, issues } = serializeXForm(d)
    expect(issues.some((i) => i.code === 'expr.unknown-ref')).toBe(true)
    expect(xml).toContain('${ghost} = 1')
  })

  it('emits requiredMessage, guidance hints and custom bind/body attrs', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('text', 'a', 'A', {
          hint: { default: 'hint text' },
          guidanceHint: { default: 'longer guidance' },
          bind: {
            required: 'true()',
            requiredMessage: { default: 'This one is required' },
            custom: { 'odk:custom-bind': 'x' },
          },
          body: { custom: { 'body-attr': 'y' } },
        }),
      ],
    })
    const { xml } = serializeXForm(d)
    // guidance forces itext
    expect(xml).toContain('<itext>')
    expect(xml).toContain('form="guidance"')
    expect(xml).toContain('jr:requiredMsg="jr:itext(\'/data/a:jr:requiredMsg\')"')
    expect(xml).toContain('odk:custom-bind="x"')
    expect(xml).toContain('body-attr="y"')
  })

  it('emits csv-external as an external secondary instance only', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('csv-external', 'lookup'),
        q('text', 'a', 'A'),
      ],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('<instance id="lookup" src="jr://file-csv/lookup.csv"/>')
    expect(xml).not.toContain('<lookup/>')
    expect(xml).not.toContain('nodeset="/data/lookup"')
  })

  it('re-emits preserved unknown fragments verbatim', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a', 'A')],
    })
    d.unknown = {
      xformFragments: [
        { location: 'model', xml: '<instance id="mystery"><root/></instance>' },
        { location: 'body', xml: '<odk:custom-widget ref="/data/a"/>' },
      ],
    }
    const { xml } = serializeXForm(d)
    expect(xml).toContain('<instance id="mystery"><root/></instance>')
    expect(xml).toContain('<odk:custom-widget ref="/data/a"/>')
  })

  it('escapes XML special characters in labels and attributes', () => {
    const d = doc({
      title: 'T & Co <forms>',
      formId: 't',
      children: [
        q('text', 'a', 'Is 5 < 6 & "quoted"?', {
          bind: { constraint: '. < 10 and . > "x"' },
        }),
      ],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('T &amp; Co &lt;forms&gt;')
    expect(xml).toContain('Is 5 &lt; 6 &amp; "quoted"?')
    expect(xml).toContain('constraint=". &lt; 10 and . &gt; &quot;x&quot;"')
  })

  it('uses from-file value/label parameter overrides in itemsets', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('select_one_from_file', 'site', 'Site?', {
          itemsetFile: 'sites.geojson',
          body: { parameters: { value: 'id', label: 'title' } },
        }),
      ],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('src="jr://file/sites.geojson"')
    expect(xml).toContain('<value ref="id"/>')
    expect(xml).toContain('<label ref="title"/>')
  })

  it('keeps unused choice lists out of the model', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('select_one', 'pick', 'Pick', { listRef: 'used' })],
      choiceLists: {
        used: [choice('a', 'A')],
        orphan: [choice('b', 'B')],
      },
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('instance id="used"')
    expect(xml).not.toContain('orphan')
  })
})
