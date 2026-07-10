import { describe, expect, it } from 'vitest'

import { doc, q } from '../../../tests/helpers/doc-builders'
import type { FormDocument } from '../model/types'
import { validateEntities } from './entities'

const entityDoc = (spec: {
  entities?: FormDocument['entities']
  children?: FormDocument['children']
}): FormDocument => doc({
  title: 'T',
  formId: 't',
  children: spec.children ?? [q('text', 'hh_name', 'Name', { saveTo: 'household_name' })],
  entities: spec.entities ?? { datasetName: 'households', label: '${hh_name}' },
})

describe('validateEntities — declaration', () => {
  it('accepts a well-formed create declaration', () => {
    expect(validateEntities(entityDoc({}))).toEqual([])
  })

  it('errors on a missing dataset name', () => {
    const issues = validateEntities(entityDoc({ entities: { datasetName: '', label: 'x' } }))
    expect(issues.map((i) => i.code)).toEqual(['entities.no-dataset'])
  })

  it('errors on an invalid dataset name', () => {
    const issues = validateEntities(entityDoc({ entities: { datasetName: 'bad name', label: 'x' } }))
    expect(issues.map((i) => i.code)).toEqual(['entities.invalid-dataset'])
  })

  it('errors when update_if is set without entity_id', () => {
    const issues = validateEntities(entityDoc({
      entities: { datasetName: 'households', label: 'x', updateIf: 'true()' },
    }))
    expect(issues.map((i) => i.code)).toEqual(['entities.update-without-id'])
  })

  it('errors when create_if is set without a label', () => {
    const issues = validateEntities(entityDoc({
      entities: { datasetName: 'households', createIf: 'true()' },
    }))
    expect(issues.map((i) => i.code)).toEqual(['entities.create-without-label'])
  })

  it('warns about an inert declaration', () => {
    const issues = validateEntities(entityDoc({ entities: { datasetName: 'households' } }))
    expect(issues.map((i) => i.code)).toEqual(['entities.inert-declaration'])
    expect(issues[0].severity).toBe('warning')
  })
})

describe('validateEntities — save_to', () => {
  it.each(['name', 'label', 'NAME', 'Label'])('rejects the reserved property "%s"', (property) => {
    const node = q('text', 'a', 'A', { saveTo: property })
    const issues = validateEntities(entityDoc({ children: [node] }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'error',
      code: 'entities.reserved-save-to',
      scope: { nodeId: node.id },
    })
  })

  it('rejects invalid property names', () => {
    const node = q('text', 'a', 'A', { saveTo: 'my prop' })
    const issues = validateEntities(entityDoc({ children: [node] }))
    expect(issues.map((i) => i.code)).toEqual(['entities.invalid-save-to'])
  })

  it('errors on duplicate save_to targets, flagging the later question', () => {
    const first = q('text', 'a', 'A', { saveTo: 'prop' })
    const second = q('text', 'b', 'B', { saveTo: 'prop' })
    const issues = validateEntities(entityDoc({ children: [first, second] }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'error',
      code: 'entities.duplicate-save-to',
      scope: { nodeId: second.id },
    })
    expect(issues[0].message).toContain('"a"')
  })

  it('checks save_to even when no entity list is declared', () => {
    const node = q('text', 'a', 'A', { saveTo: 'label' })
    const d = doc({ title: 'T', formId: 't', children: [node] })
    delete d.entities
    const issues = validateEntities(d)
    expect(issues.map((i) => i.code)).toEqual(['entities.reserved-save-to'])
  })
})

describe('validateEntities — follow-up consistency', () => {
  const followUp = (children: FormDocument['children']): FormDocument => entityDoc({
    children,
    entities: { datasetName: 'households', updateIf: 'true()', entityId: '${household}' },
  })

  it('accepts an update form consuming <dataset>.csv', () => {
    const issues = validateEntities(followUp([
      q('select_one_from_file', 'household', 'Household', { itemsetFile: 'households.csv' }),
    ]))
    expect(issues).toEqual([])
  })

  it('warns when an update form has no question selecting from <dataset>.csv', () => {
    const issues = validateEntities(followUp([q('text', 'household', 'Household')]))
    expect(issues.map((i) => i.code)).toEqual(['entities.follow-up-no-source'])
    expect(issues[0].severity).toBe('warning')
    expect(issues[0].message).toContain('households.csv')
  })

  it('warns when entity_id comes from a select reading a different file', () => {
    const source = q('select_one_from_file', 'household', 'Household', { itemsetFile: 'villages.csv' })
    const issues = validateEntities(followUp([
      source,
      q('select_one_from_file', 'other', 'Other', { itemsetFile: 'households.csv' }),
    ]))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      code: 'entities.dataset-file-mismatch',
      scope: { nodeId: source.id },
    })
  })

  it('stays silent when entity_id references a plain text question', () => {
    const issues = validateEntities(followUp([
      q('text', 'household', 'Household ID'),
      q('select_one_from_file', 'pick', 'Pick', { itemsetFile: 'households.csv' }),
    ]))
    expect(issues).toEqual([])
  })
})
