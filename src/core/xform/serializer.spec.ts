import { describe, expect, it } from 'vitest'

import { choice, doc, q } from '../../../tests/helpers/doc-builders'
import { DEFAULT_LANG } from '../model/types'
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
    // guidance forces itext for the hint entry only — pyxform decides
    // per entry in monolingual forms: the label and the bind messages
    // stay inline (pinned by the media_labels/annotate goldens).
    expect(xml).toContain('<itext>')
    expect(xml).toContain('form="guidance"')
    expect(xml).toContain('<hint ref="jr:itext(\'/data/a:hint\')"/>')
    expect(xml).toContain('<label>A</label>')
    expect(xml).toContain('jr:requiredMsg="This one is required"')
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

  it('prefixes a static image default with jr://images/', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('image', 'photo', undefined, { defaultValue: 'template.png' })],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('<photo>jr://images/template.png</photo>')
  })

  it('is idempotent for an already-prefixed image default', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('image', 'photo', undefined, { defaultValue: 'jr://images/template.png' })],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('<photo>jr://images/template.png</photo>')
    expect(xml).not.toContain('jr://images/jr://images/')
  })

  it('leaves a dynamic image default untouched (no jr://images/ prefix, no static instance value)', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('image', 'photo', undefined, { defaultValue: '${other}' })],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('<photo/>')
    expect(xml).not.toContain('jr://images/')
  })

  it('leaves a non-image question default verbatim', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'name', undefined, { defaultValue: 'jr://images/should-not-prefix.png' })],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('<name>jr://images/should-not-prefix.png</name>')
  })

  it('fills range bounds from registry defaults when parameters are unset', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('range', 'rating', 'Rate')],
    })
    const { xml } = serializeXForm(d)
    // Every range needs start/end/step or the engine refuses to load the form.
    expect(xml).toContain('<range ref="/data/rating" start="1" end="10" step="1">')
  })

  it('keeps explicit range parameters over defaults', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('range', 'weight', 'Weight', { body: { parameters: { start: '0.5', end: '5.0', step: '0.5' } } })],
    })
    const { xml } = serializeXForm(d)
    expect(xml).toContain('start="0.5" end="5.0" step="0.5"')
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

  it('itexts only the choice list carrying media, leaving a plain sibling list inline (monolingual doc)', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [
        q('select_one', 'photoPick', 'Photo pick', { listRef: 'withMedia' }),
        q('select_one', 'plainPick', 'Plain pick', { listRef: 'plain' }),
      ],
      choiceLists: {
        withMedia: [{ ...choice('a', 'A'), media: { image: { [DEFAULT_LANG]: 'a.png' } } }],
        plain: [choice('x', 'X')],
      },
    })
    const { xml } = serializeXForm(d)

    // The media list gets an itextId (no inline <label>) + jr:itext(itextId) label ref…
    expect(xml).toContain('<itextId>withMedia-0</itextId>')
    expect(xml).toContain('<value form="image">jr://images/a.png</value>')
    expect(xml).toMatch(/<itemset nodeset="instance\('withMedia'\)\/root\/item">\s*<value ref="name"\/>\s*<label ref="jr:itext\(itextId\)"\/>\s*<\/itemset>/)

    // …while the plain sibling list keeps its inline <label> and plain ref="label".
    expect(xml).not.toContain('<itextId>plain-0</itextId>')
    expect(xml).toMatch(/<item>\s*<name>x<\/name>\s*<label>X<\/label>\s*<\/item>/)
    expect(xml).toMatch(/<itemset nodeset="instance\('plain'\)\/root\/item">\s*<value ref="name"\/>\s*<label ref="label"\/>\s*<\/itemset>/)
  })
})
