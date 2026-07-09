import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseXForm } from '@/core/xform/parser'

describe('parsed documents are structured-clone safe', () => {
  it('all-widgets.xml document survives structuredClone', () => {
    const xml = readFileSync('tests/fixtures/all-widgets.xml', 'utf8')
    const { document } = parseXForm(xml)
    expect(() => structuredClone(document)).not.toThrow()
  })
})
