/**
 * Import round-trip gate: every pyxform golden must survive
 * parse → serialize with full semantic equality (canonicalized).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseXForm } from '../../src/core/xform/parser'
import { serializeXForm } from '../../src/core/xform/serializer'
import { canonicalizeXForm } from '../helpers/xml-canonicalize'

const goldenDir = fileURLToPath(new URL('./expected', import.meta.url))

describe('golden round-trip (parse → serialize)', () => {
  for (const file of readdirSync(goldenDir).filter((f) => f.endsWith('.xml')).sort()) {
    it(`round-trips ${file}`, () => {
      const original = readFileSync(join(goldenDir, file), 'utf8')

      const { document, issues: parseIssues } = parseXForm(original)
      expect(parseIssues.filter((i) => i.severity === 'error')).toEqual([])

      const { xml, issues: serializeIssues } = serializeXForm(document)
      expect(serializeIssues.filter((i) => i.severity === 'error')).toEqual([])

      expect(canonicalizeXForm(xml)).toBe(canonicalizeXForm(original))
    })
  }
})
