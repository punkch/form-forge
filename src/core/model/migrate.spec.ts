import { describe, expect, it } from 'vitest'

import { doc, group, q } from '../../../tests/helpers/doc-builders'
import { migrateDoc } from './migrate'

describe('migrateDoc', () => {
  it('passes a schemaVersion 1 document through unchanged', () => {
    const original = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A')] })
    const raw: unknown = JSON.parse(JSON.stringify(original))
    const { doc: migrated, issues } = migrateDoc(raw)
    expect(issues).toEqual([])
    expect(migrated).toEqual(JSON.parse(JSON.stringify(original)))
  })

  it('rejects a missing schema version', () => {
    const raw = JSON.parse(JSON.stringify(doc({ title: 'T', formId: 't', children: [] })))
    delete raw.schemaVersion
    const { doc: migrated, issues } = migrateDoc(raw)
    expect(migrated).toBeNull()
    expect(issues).toEqual([expect.objectContaining({
      severity: 'error',
      code: 'doc.schema-version-unsupported',
    })])
  })

  it('rejects a greater schema version', () => {
    const raw = JSON.parse(JSON.stringify(doc({ title: 'T', formId: 't', children: [] })))
    raw.schemaVersion = 2
    const { doc: migrated, issues } = migrateDoc(raw)
    expect(migrated).toBeNull()
    expect(issues[0].code).toBe('doc.schema-version-unsupported')
    expect(issues[0].message).toContain('schema version 2')
  })

  it.each([null, 'text', 42, ['array']])('rejects non-object input %j', (raw) => {
    const { doc: migrated, issues } = migrateDoc(raw)
    expect(migrated).toBeNull()
    expect(issues[0].code).toBe('doc.malformed')
  })

  it('rejects an object missing required top-level fields', () => {
    const { doc: migrated, issues } = migrateDoc({ schemaVersion: 1, settings: {} })
    expect(migrated).toBeNull()
    expect(issues[0].code).toBe('doc.malformed')
  })

  it.each([
    ['not-a-node'],
    [{ id: 'x', name: 'n' }], // missing kind
    [{ id: 'x', name: 'n', kind: 42 }], // non-string kind
    [{ id: 'x', name: 'n', kind: 'group' }], // container with no children array
  ])('rejects a malformed top-level child %j', (badChild) => {
    const raw = JSON.parse(JSON.stringify(doc({ title: 'T', formId: 't', children: [] })))
    raw.children = [badChild]
    const { doc: migrated, issues } = migrateDoc(raw)
    expect(migrated).toBeNull()
    expect(issues[0].code).toBe('doc.malformed')
  })

  it('rejects a malformed node nested inside a container', () => {
    const raw = JSON.parse(JSON.stringify(doc({ title: 'T', formId: 't', children: [] })))
    raw.children = [{ id: 'g', name: 'grp', kind: 'group', children: [{ id: 'q', name: 'q' }] }]
    const { doc: migrated, issues } = migrateDoc(raw)
    expect(migrated).toBeNull()
    expect(issues[0].code).toBe('doc.malformed')
  })

  it('accepts a well-formed nested container', () => {
    const original = doc({ title: 'T', formId: 't', children: [group('g', 'G', [q('text', 'a', 'A')])] })
    const { doc: migrated, issues } = migrateDoc(JSON.parse(JSON.stringify(original)))
    expect(issues).toEqual([])
    expect(migrated).not.toBeNull()
  })
})
