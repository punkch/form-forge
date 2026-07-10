/**
 * End-to-end XLSForm bridge parity: reading each golden workbook with our
 * native reader and serializing the resulting FormDocument must reproduce
 * pyxform 4.5.0's XForm output (canonicalized). The writer round-trip
 * (write → read) must preserve the document and its serialized XForm.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { FormDocument } from '../../src/core/model/types'
import { readXlsForm } from '../../src/core/xlsform/reader'
import { writeXlsForm } from '../../src/core/xlsform/writer'
import { serializeXForm } from '../../src/core/xform/serializer'
import { canonicalizeXForm } from '../helpers/xml-canonicalize'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))
const expectedDir = fileURLToPath(new URL('./expected', import.meta.url))

const fixtures = readdirSync(srcDir).filter((f) => f.endsWith('.xlsx')).sort()

const readFixture = (file: string): ArrayBuffer => {
  const buf = readFileSync(join(srcDir, file))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

/** Node ids are freshly generated on every read; strip them for comparison. */
const stripIds = (doc: FormDocument): unknown =>
  JSON.parse(JSON.stringify(doc, (key, value) => (key === 'id' ? undefined : value)))

describe('XLSForm reader parity with pyxform 4.5.0', () => {
  it('has all eleven golden fixtures', () => {
    expect(fixtures).toHaveLength(11)
  })

  for (const file of fixtures) {
    const name = file.replace(/\.xlsx$/, '')
    it(`reads and serializes ${file} to match ${name}.xml`, async () => {
      const { document, issues } = await readXlsForm(readFixture(file))
      expect(issues.filter((i) => i.severity === 'error')).toEqual([])

      const { xml, issues: serializeIssues } = serializeXForm(document)
      expect(serializeIssues.filter((i) => i.severity === 'error')).toEqual([])

      const expected = readFileSync(join(expectedDir, `${name}.xml`), 'utf8')
      expect(canonicalizeXForm(xml)).toBe(canonicalizeXForm(expected))
    })
  }
})

describe('XLSForm writer round-trip', () => {
  for (const file of fixtures) {
    it(`write(read(${file})) preserves the document`, async () => {
      const first = await readXlsForm(readFixture(file))
      const bytes = await writeXlsForm(first.document)
      const second = await readXlsForm(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      )
      expect(second.issues.filter((i) => i.severity === 'error')).toEqual([])
      expect(stripIds(second.document)).toEqual(stripIds(first.document))

      // Stronger: both documents serialize to the same canonical XForm.
      const xmlFirst = serializeXForm(first.document).xml
      const xmlSecond = serializeXForm(second.document).xml
      expect(canonicalizeXForm(xmlSecond)).toBe(canonicalizeXForm(xmlFirst))
    })
  }
})
