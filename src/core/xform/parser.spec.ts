import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { flatten } from '../model/ops'
import type { FormDocument, QuestionNode } from '../model/types'
import { parseXForm } from './parser'
import { serializeXForm } from './serializer'
import { parseXml, XmlParseError } from './xml-reader'
import { doc as buildDoc, q, repeat } from '../../../tests/helpers/doc-builders'
import { canonicalizeXForm } from '../../../tests/helpers/xml-canonicalize'

const allWidgetsXml = readFileSync(
  fileURLToPath(new URL('../../../tests/fixtures/all-widgets.xml', import.meta.url)),
  'utf8'
)

const question = (doc: FormDocument, name: string): QuestionNode => {
  const node = flatten(doc.children).find((n) => n.kind === 'question' && n.name === name)
  if (node === undefined || node.kind !== 'question') throw new Error(`no question named ${name}`)
  return node
}

describe('parseXml', () => {
  it('parses well-formed XML', () => {
    const doc = parseXml('<a><b/></a>')
    expect(doc.documentElement.localName).toBe('a')
  })

  it('throws XmlParseError on malformed input', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(XmlParseError)
    expect(() => parseXml('definitely not xml')).toThrow(XmlParseError)
  })
})

describe('parseXForm on all-widgets.xml (legacy fixture)', () => {
  const { document: doc, issues } = parseXForm(allWidgetsXml)

  it('parses without errors', () => {
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('finds all 73 questions (72 bind-backed + the bindless trigger control)', () => {
    const questions = flatten(doc.children).filter((n) => n.kind === 'question')
    expect(questions).toHaveLength(73)
  })

  it('reads settings from the primary instance and title', () => {
    expect(doc.settings.formTitle).toBe('All widgets')
    expect(doc.settings.formId).toBe('all-widgets')
    expect(doc.settings.version).toBe('2019121101')
  })

  it('detects the default and French languages from itext', () => {
    expect(doc.languages).toEqual(['default', 'French (fr)'])
    expect(doc.settings.defaultLanguage).toBe('default')
  })

  it('maps legacy widgets onto registry types', () => {
    expect(question(doc, 'intro').type).toBe('note')
    expect(question(doc, 'string_widget').type).toBe('text')
    expect(question(doc, 'integer_widget').type).toBe('integer')
    expect(question(doc, 'bearing_widget').type).toBe('decimal')
    expect(question(doc, 'bearing_widget').body.appearance).toBe('bearing')
    expect(question(doc, 'barcode_widget').type).toBe('barcode')
    expect(question(doc, 'date_time_widget').type).toBe('datetime')
    expect(question(doc, 'geotrace_widget').type).toBe('geotrace')
    expect(question(doc, 'image_widget').type).toBe('image')
    expect(question(doc, 'audio_widget').type).toBe('audio')
    expect(question(doc, 'file_widget').type).toBe('file')
    expect(question(doc, 'my_trigger').type).toBe('acknowledge')
    expect(question(doc, 'rank_widget').type).toBe('rank')
  })

  it('keeps static instance defaults', () => {
    expect(question(doc, 'url_widget').defaultValue).toBe('http://opendatakit.org/')
  })

  it('keeps the ex_printer_widget calculation from its bind', () => {
    expect(question(doc, 'ex_printer_widget').bind.calculation)
      .toBe("concat('123456789','<br>','QRCODE','<br>','Text')")
  })

  it('extracts range parameters from body attributes', () => {
    expect(question(doc, 'range_decimal_widget').body.parameters)
      .toEqual({ start: '1.5', end: '5.5', step: '0.5' })
  })

  it('synthesizes choice lists from legacy inline <item> children', () => {
    const select = question(doc, 'select_one_widget')
    expect(select.type).toBe('select_one')
    expect(select.listRef).toBe('select_one_widget')
    const list = doc.choiceLists.select_one_widget
    expect(list.choices.map((c) => c.name)).toEqual(['a', 'b', 'c', 'd'])
    expect(list.choices[0].label).toEqual({ default: 'A' })
  })

  it('folds itext image choice labels into choice.media.image', () => {
    const list = doc.choiceLists.grid_widget
    expect(list.choices[0].label).toEqual({ default: 'A' })
    expect(list.choices[0].media?.image).toEqual({ default: 'a.jpg' })
    // The French translation was pyxform's '-' placeholder — dropped.
    expect(list.choices[0].label?.['French (fr)']).toBeUndefined()
  })

  it('materializes the itemset-backed places list with extras', () => {
    const select = question(doc, 'select_one_from_map_widget')
    expect(select.listRef).toBe('places')
    expect(select.choiceFilter).toBe('true()')
    const list = doc.choiceLists.places
    expect(list.choices.map((c) => c.name)).toEqual(['a', 'b', 'c', 'd'])
    expect(list.choices[0].extras?.geometry).toBe('46.5841618 7.0801379 0 0')
    expect(list.extraColumnOrder).toEqual(['geometry'])
  })

  it('folds itext node labels with media', () => {
    const select = question(doc, 'select_one_image_map')
    expect(select.label?.default).toBe('Image select one widget')
    expect(select.media?.image).toEqual({ default: 'body.svg', 'French (fr)': 'body.svg' })
  })

  it('imports the unsupported osm upload as a file question with a warning', () => {
    expect(question(doc, 'osm_building').type).toBe('file')
    expect(issues.some((i) => i.code === 'import.unknown-mediatype')).toBe(true)
  })

  it('is stable under parse → serialize → parse → serialize', () => {
    const first = serializeXForm(doc)
    expect(first.issues.filter((i) => i.severity === 'error')).toEqual([])
    const reparsed = parseXForm(first.xml)
    expect(reparsed.issues.filter((i) => i.severity === 'error')).toEqual([])
    const second = serializeXForm(reparsed.document)
    expect(canonicalizeXForm(second.xml)).toBe(canonicalizeXForm(first.xml))
  })
})

describe('parseXForm edge cases', () => {
  it('reports malformed XML as an error issue without throwing', () => {
    const { document, issues } = parseXForm('<h:html><oops')
    expect(document.children).toEqual([])
    expect(issues.some((i) => i.severity === 'error' && i.code === 'import.parse-error')).toBe(true)
  })

  it('rejects non-XForm documents', () => {
    const { issues } = parseXForm('<root><child/></root>')
    expect(issues.some((i) => i.severity === 'error' && i.code === 'import.not-an-xform')).toBe(true)
  })

  const wrap = (model: string, body = ''): string => `<?xml version="1.0"?>
    <h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml"
            xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms"
            xmlns:odk="http://www.opendatakit.org/xforms">
      <h:head><h:title>Edge</h:title><model>${model}</model></h:head>
      <h:body>${body}</h:body>
    </h:html>`

  it('preserves unknown bind attributes in bind.custom and re-emits them', () => {
    const xml = wrap(
      `<instance><data id="edge"><a/><meta><instanceID/></meta></data></instance>
       <bind nodeset="/data/a" type="string" fancy="42" odk:mystery="x"/>`,
      '<input ref="/data/a"><label>A</label></input>'
    )
    const { document, issues } = parseXForm(xml)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    const a = question(document, 'a')
    expect(a.bind.custom).toEqual({ fancy: '42', 'odk:mystery': 'x' })
    const { xml: out } = serializeXForm(document)
    expect(out).toContain('fancy="42"')
    expect(out).toContain('odk:mystery="x"')
  })

  it('preserves unreferenced secondary instances via unknown.xformFragments', () => {
    const xml = wrap(
      `<instance><data id="edge"><a/><meta><instanceID/></meta></data></instance>
       <instance id="lookup" src="jr://file-csv/lookup.csv"/>
       <bind nodeset="/data/a" type="string" calculate="instance('lookup')/root/item[1]/name"/>`
    )
    const { document, issues } = parseXForm(xml)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(document.unknown?.xformFragments).toHaveLength(1)
    expect(document.unknown?.xformFragments?.[0].location).toBe('model')
    expect(document.unknown?.xformFragments?.[0].xml).toContain('jr://file-csv/lookup.csv')

    const first = serializeXForm(document)
    expect(first.xml).toContain('jr://file-csv/lookup.csv')
    const second = serializeXForm(parseXForm(first.xml).document)
    expect(canonicalizeXForm(second.xml)).toBe(canonicalizeXForm(first.xml))
  })

  it('imports bind-only calculate nodes as calculate questions', () => {
    const xml = wrap(
      `<instance><data id="edge"><a/><b/><meta><instanceID/></meta></data></instance>
       <bind nodeset="/data/a" type="string"/>
       <bind nodeset="/data/b" type="string" calculate=" /data/a "/>`,
      '<input ref="/data/a"><label>A</label></input>'
    )
    const { document } = parseXForm(xml)
    const b = question(document, 'b')
    expect(b.type).toBe('calculate')
    expect(b.bind.calculation).toBe('${a}')
  })

  it('flags bind-only nodes without calculate as hidden fields', () => {
    const xml = wrap(
      `<instance><data id="edge"><a/><meta><instanceID/></meta></data></instance>
       <bind nodeset="/data/a" type="string"/>`
    )
    const { document, issues } = parseXForm(xml)
    expect(question(document, 'a').type).toBe('text')
    expect(issues.some((i) => i.code === 'import.hidden-field')).toBe(true)
  })

  it('warns when an entity update block carries no entity id expression', () => {
    const xml = wrap(
      `<instance><data id="edge"><a/><meta>
         <entity dataset="households" update="1" baseVersion=""><label/></entity>
         <instanceID/>
       </meta></data></instance>
       <bind nodeset="/data/a" type="string"/>
       <bind nodeset="/data/meta/entity/@update" calculate="true()" readonly="true()" type="string"/>
       <bind nodeset="/data/meta/entity/label" calculate=" /data/a " readonly="true()" type="string"/>`,
      '<input ref="/data/a"><label>A</label></input>'
    )
    const { document, issues } = parseXForm(xml)
    expect(document.entities?.datasetName).toBe('households')
    expect(document.entities?.entityId).toBeUndefined()
    expect(issues.some((i) => i.code === 'import.entity')).toBe(true)
  })

  it('strips the jr://images/ prefix from an image upload default', () => {
    const xml = wrap(
      `<instance><data id="edge"><photo>jr://images/template.png</photo><meta><instanceID/></meta></data></instance>
       <bind nodeset="/data/photo" type="binary"/>`,
      '<upload ref="/data/photo" mediatype="image/*"><label>Photo</label></upload>'
    )
    const { document, issues } = parseXForm(xml)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    const photo = question(document, 'photo')
    expect(photo.type).toBe('image')
    expect(photo.defaultValue).toBe('template.png')
  })

  it('keeps a raw default verbatim for an unknown upload mediatype (fallback file type)', () => {
    const xml = wrap(
      `<instance><data id="edge"><doc>jr://images/template.png</doc><meta><instanceID/></meta></data></instance>
       <bind nodeset="/data/doc" type="binary"/>`,
      '<upload ref="/data/doc" mediatype="mystery/*"><label>Doc</label></upload>'
    )
    const { document } = parseXForm(xml)
    const d = question(document, 'doc')
    expect(d.type).toBe('file')
    expect(d.defaultValue).toBe('jr://images/template.png')
  })
})

describe('parseXForm round-trips of serializer output', () => {
  const roundtrip = (source: FormDocument): FormDocument => {
    const first = serializeXForm(source)
    expect(first.issues.filter((i) => i.severity === 'error')).toEqual([])
    const { document, issues } = parseXForm(first.xml)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    const second = serializeXForm(document)
    expect(canonicalizeXForm(second.xml)).toBe(canonicalizeXForm(first.xml))
    return document
  }

  it('reconstructs entity updates (updateIf + entityId)', () => {
    const source = buildDoc({
      title: 'Entity Update',
      formId: 'entity_update',
      children: [
        q('text', 'hh_id', 'Household id'),
        q('text', 'hh_name', 'Household name', { saveTo: 'household_name' }),
      ],
      entities: {
        datasetName: 'households',
        label: '${hh_name}',
        updateIf: "${hh_name} != ''",
        entityId: '${hh_id}',
      },
    })
    const parsed = roundtrip(source)
    expect(parsed.entities).toEqual({
      datasetName: 'households',
      label: '${hh_name}',
      updateIf: "${hh_name} != ''",
      entityId: '${hh_id}',
    })
    expect(question(parsed, 'hh_name').saveTo).toBe('household_name')
  })

  it('round-trips an unlabelled repeat (bare <repeat> body element)', () => {
    const source = buildDoc({
      title: 'Bare Repeat',
      formId: 'bare_repeat',
      children: [
        repeat('item', undefined, [q('text', 'part', 'Part name')]),
      ],
    })
    const parsed = roundtrip(source)
    const item = parsed.children[0]
    expect(item.kind).toBe('repeat')
    expect(item.label).toBeUndefined()
  })

  it('round-trips a prefixed image default byte-identically', () => {
    const source = buildDoc({
      title: 'Annotate',
      formId: 'annotate',
      children: [q('image', 'photo', 'Photo', { defaultValue: 'template.png' })],
    })
    const parsed = roundtrip(source)
    expect(question(parsed, 'photo').defaultValue).toBe('template.png')
  })

  it('canonicalizes a bare hand-authored image default to the jr://images/-prefixed form on re-serialize', () => {
    // A hand-authored bare default (never seen a serializer) parses back
    // through this document's own instance defaultValue verbatim; what
    // matters is that re-serializing it always emits the pyxform-matching
    // jr://images/ prefix — the model never stores the prefix itself.
    const source = buildDoc({
      title: 'Annotate',
      formId: 'annotate',
      children: [q('image', 'photo', 'Photo', { defaultValue: 'template.png' })],
    })
    const { xml } = serializeXForm(source)
    expect(xml).toContain('<photo>jr://images/template.png</photo>')
    expect(xml).not.toContain('<photo>template.png</photo>')
  })

  it('round-trips guidance hints through itext', () => {
    const source = buildDoc({
      title: 'Guidance',
      formId: 'guidance',
      children: [
        q('text', 'a', 'Question A', {
          hint: { default: 'Short hint' },
          guidanceHint: { default: 'Much longer guidance' },
        }),
      ],
    })
    const parsed = roundtrip(source)
    const a = question(parsed, 'a')
    expect(a.hint).toEqual({ default: 'Short hint' })
    expect(a.guidanceHint).toEqual({ default: 'Much longer guidance' })
  })
})
