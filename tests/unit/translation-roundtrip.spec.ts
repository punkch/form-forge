/**
 * Proves the translation-coverage acceptance round-trips end-to-end through
 * the EXISTING engine (no writer/reader/serializer change): a French-only
 * hint with no default value and an image::French (fr) media ref survive
 * XLSForm write→read and XForm serialize→parse, re-export byte-stably, and
 * clearing a language key removes only that key.
 */
import { describe, expect, it } from 'vitest'

import { flatten } from '@/core/model/ops'
import { collectTranslationSites, setSiteText } from '@/core/model/translations'
import { DEFAULT_LANG, type FormDocument, type FormNode } from '@/core/model/types'
import { parseXForm } from '@/core/xform/parser'
import { serializeXForm } from '@/core/xform/serializer'
import { readXlsForm, writeXlsForm } from '@/core/xlsform'
import { readWorkbook } from '@/core/xlsform/workbook-read'

import { doc, q } from '../helpers/doc-builders'
import { canonicalizeXForm } from '../helpers/xml-canonicalize'

const FR = 'French (fr)'

/** A form with a French-only hint (no default value) and a French-only
 * image ref — the two shapes the grid now exposes for editing. */
const sample = (): FormDocument =>
  doc({
    title: 'T',
    formId: 't',
    languages: [FR],
    children: [
      q('text', 'name', undefined, {
        label: { [DEFAULT_LANG]: 'Your name?', [FR]: 'Votre nom ?' },
        hint: { [FR]: 'indice fr' },
        media: { image: { [FR]: 'photo_fr.png' } },
      }),
    ],
  })

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const surveyRows = (data: ArrayBuffer): string[][] =>
  readWorkbook(data).sheets.get('survey')?.rows ?? []

const findByName = (nodes: FormNode[], name: string): FormNode | undefined =>
  flatten(nodes).find((n) => n.name === name)

describe('translation round-trips (existing engine, no serializer change)', () => {
  it('French-only hint and image ref survive XLSForm write→read', async () => {
    const bytes = await writeXlsForm(sample())
    const { document } = await readXlsForm(toArrayBuffer(bytes))
    const node = findByName(document.children, 'name')
    expect(node?.hint).toEqual({ [FR]: 'indice fr' })
    expect(node?.media?.image).toEqual({ [FR]: 'photo_fr.png' })
    expect(node?.label).toEqual({ [DEFAULT_LANG]: 'Your name?', [FR]: 'Votre nom ?' })
    expect(document.languages).toEqual([FR])
  })

  it('French-only hint itext survives XForm serialize→parse', () => {
    const { xml } = serializeXForm(sample())
    const parsed = parseXForm(xml)
    const node = findByName(parsed.document.children, 'name')
    expect(node?.hint).toEqual({ [FR]: 'indice fr' })
    expect(node?.media?.image).toEqual({ [FR]: 'photo_fr.png' })
    expect(parsed.document.languages).toEqual([FR])
  })

  it('XForm re-serializes canonically identical after a parse round-trip', () => {
    const first = serializeXForm(sample())
    const reparsed = parseXForm(first.xml)
    const second = serializeXForm(reparsed.document)
    expect(canonicalizeXForm(second.xml)).toBe(canonicalizeXForm(first.xml))
  })

  it('image::French (fr) is collected as a site and re-exports byte-stable', async () => {
    const d = sample()
    const contexts = collectTranslationSites(d).map((s) => s.context)
    expect(contexts).toContain('name · Image')

    const firstBytes = await writeXlsForm(d)
    const reread = await readXlsForm(toArrayBuffer(firstBytes))
    const secondBytes = await writeXlsForm(reread.document)

    const firstRows = surveyRows(toArrayBuffer(firstBytes))
    const secondRows = surveyRows(toArrayBuffer(secondBytes))
    expect(secondRows).toEqual(firstRows)

    const header = firstRows[0]
    const column = header.indexOf(`image::${FR}`)
    expect(column).toBeGreaterThan(-1)
    const nameRow = firstRows.slice(1).find((row) => row[1] === 'name')
    expect(nameRow?.[column]).toBe('photo_fr.png')

    const recollected = collectTranslationSites(reread.document).map((s) => s.context)
    expect(recollected).toContain('name · Image')
  })

  it('clearing a language key removes only that key', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      languages: [FR],
      children: [
        q('text', 'name', 'Your name?', {
          hint: { [DEFAULT_LANG]: 'plain hint', [FR]: 'indice fr' },
          media: { image: { [DEFAULT_LANG]: 'photo.png', [FR]: 'photo_fr.png' } },
        }),
      ],
    })
    const nodeId = d.children[0].id
    setSiteText(d, { kind: 'node', nodeId, field: 'hint' }, FR, '')
    expect(d.children[0].hint).toEqual({ [DEFAULT_LANG]: 'plain hint' })
    setSiteText(d, { kind: 'node-media', nodeId, slot: 'image' }, FR, '')
    expect(d.children[0].media?.image).toEqual({ [DEFAULT_LANG]: 'photo.png' })
  })
})
