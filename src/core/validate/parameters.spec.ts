import { describe, expect, it } from 'vitest'

import { doc, q } from '../../../tests/helpers/doc-builders'
import { validateParameters } from './parameters'

describe('validateParameters', () => {
  it('warns when a range is missing its required bounds', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('range', 'rating', 'Rate 1-10')] })
    const issues = validateParameters(d)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      code: 'parameters.missing-required',
    })
    expect(issues[0].message).toContain('start and end')
    expect(issues[0].message).toContain('Rate 1-10')
  })

  it('reports only the missing bound and uses the singular form', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('range', 'rating', 'Rate', { body: { parameters: { start: '1' } } })],
    })
    const issues = validateParameters(d)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('the end parameter.')
  })

  it('stays silent when required bounds are present (step optional)', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('range', 'rating', 'Rate', { body: { parameters: { start: '1', end: '10' } } })],
    })
    expect(validateParameters(d)).toHaveLength(0)
  })

  it('ignores question types without required parameters', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A'), q('integer', 'n', 'N')] })
    expect(validateParameters(d)).toHaveLength(0)
  })
})
