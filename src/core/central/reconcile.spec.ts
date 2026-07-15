import { describe, expect, it } from 'vitest'

import type { CentralFormSummary } from './types'
import { freshnessFor, reconcileTarget } from './reconcile'

describe('freshnessFor', () => {
  it('is unknown when no last-published hash was recorded', () => {
    expect(freshnessFor('abc', undefined)).toBe('unknown')
  })

  it('is fresh when the current hash matches the last-published hash', () => {
    expect(freshnessFor('abc', 'abc')).toBe('fresh')
  })

  it('is changed when the hashes differ', () => {
    expect(freshnessFor('abc', 'def')).toBe('changed')
  })
})

describe('reconcileTarget', () => {
  const target = { xmlFormId: 'my-form', lastPublishedVersion: '2026010100' }

  it('matches when Central holds the same published version', () => {
    const summaries: CentralFormSummary[] = [
      { xmlFormId: 'my-form', version: '2026010100', publishedAt: '2026-01-01T00:00:00Z' },
    ]
    expect(reconcileTarget(target, summaries)).toEqual({ kind: 'matches' })
  })

  it('reports version-differs with the Central version when versions differ', () => {
    const summaries: CentralFormSummary[] = [
      { xmlFormId: 'my-form', version: '2026070100', publishedAt: '2026-07-01T00:00:00Z' },
    ]
    expect(reconcileTarget(target, summaries)).toEqual({
      kind: 'version-differs',
      centralVersion: '2026070100',
    })
  })

  it('is never-published when no summary matches the target form id', () => {
    const summaries: CentralFormSummary[] = [
      { xmlFormId: 'other-form', version: '2026010100', publishedAt: '2026-01-01T00:00:00Z' },
    ]
    expect(reconcileTarget(target, summaries)).toEqual({ kind: 'never-published' })
  })

  it('is never-published when the matching form is still a draft (publishedAt null)', () => {
    const summaries: CentralFormSummary[] = [
      { xmlFormId: 'my-form', version: '2026010100', publishedAt: null },
    ]
    expect(reconcileTarget(target, summaries)).toEqual({ kind: 'never-published' })
  })

  it('is never-published against an empty forms list', () => {
    expect(reconcileTarget(target, [])).toEqual({ kind: 'never-published' })
  })
})
