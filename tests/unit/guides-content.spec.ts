import { describe, expect, it } from 'vitest'

import { guideHelp, type GuideHelp, type GuideKey } from '@/help/content'
import { GUIDE_KEYS, guideDocsUrl } from '@/help/guides'
import { translate } from '@/i18n'
import { en } from '@/i18n/locales/en'

/** Walks a dotted catalog key through the en message tree. */
const resolveKey = (key: string): unknown =>
  key.split('.').reduce<unknown>(
    (node, part) =>
      node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    en
  )

const expectCatalogText = (key: string, context: string): void => {
  const value = resolveKey(key)
  expect(typeof value, `${context}: ${key} missing from en catalog`).toBe('string')
  expect((value as string).length, `${context}: ${key} is empty`).toBeGreaterThan(0)
}

const guides = guideHelp as Record<GuideKey, GuideHelp>
const CALLOUT_IDS = ['translations', 'logicRaw'] as const

describe('guide content consistency', () => {
  it('GUIDE_KEYS lists every registry guide exactly once', () => {
    expect([...GUIDE_KEYS].sort()).toEqual(Object.keys(guideHelp).sort())
    expect(new Set(GUIDE_KEYS).size).toBe(GUIDE_KEYS.length)
  })

  it('every guide resolves title, summary and each step to catalog text', () => {
    for (const key of GUIDE_KEYS) {
      const guide = guides[key]
      expectCatalogText(guide.title, key)
      expectCatalogText(guide.summary, key)
      expect(guide.steps.length, `${key} has no steps`).toBeGreaterThan(0)
      for (const step of guide.steps) expectCatalogText(step, key)
    }
  })

  it('step keys resolve through the vue-i18n runtime (numeric path segments work)', () => {
    for (const key of GUIDE_KEYS) {
      for (const step of guides[key].steps) {
        const text = translate(step)
        expect(text, `${key}: ${step} did not resolve at runtime`).not.toBe(step)
        expect(text.length).toBeGreaterThan(0)
      }
    }
  })

  it('registry step lists stay in sync with the catalog (no orphan step keys)', () => {
    const catalogGuides = (en as Record<string, unknown>).guides as Record<string, unknown>
    for (const key of GUIDE_KEYS) {
      const entry = catalogGuides[key] as Record<string, unknown>
      const catalogSteps = Object.keys(entry.steps as Record<string, string>)
      expect(catalogSteps.length, `${key}: catalog/registry step count drift`).toBe(guides[key].steps.length)
      const referenced = new Set<string>(guides[key].steps)
      for (const stepKey of catalogSteps) {
        expect(referenced.has(`guides.${key}.steps.${stepKey}`),
          `guides.${key}.steps.${stepKey} is not referenced by the registry`).toBe(true)
      }
    }
  })

  it('has no orphan guides.* catalog namespaces without a registry entry', () => {
    const catalogGuides = (en as Record<string, unknown>).guides as Record<string, unknown>
    const known = new Set<string>([...GUIDE_KEYS, 'ui', 'callouts'])
    for (const key of Object.keys(catalogGuides)) {
      expect(known.has(key), `guides.${key} has no guideHelp entry`).toBe(true)
    }
  })

  it('docsUrl is a well-formed docs.getodk.org URL where present, absent for app-specific guides', () => {
    for (const key of ['translations', 'logic', 'datasets', 'entities'] as GuideKey[]) {
      expect(guideDocsUrl(key), key).toMatch(/^https:\/\/docs\.getodk\.org\/[a-z0-9-]+\/$/)
    }
    for (const key of ['backup', 'templates', 'autosave', 'keyboard'] as GuideKey[]) {
      expect(guideDocsUrl(key), key).toBeUndefined()
    }
  })

  it('every guide carries search synonyms', () => {
    for (const key of GUIDE_KEYS) {
      expect(guides[key].searchKeywords?.length ?? 0, `${key} has no searchKeywords`).toBeGreaterThan(0)
    }
  })

  it('both callout ids resolve their title and body copy', () => {
    for (const id of CALLOUT_IDS) {
      expectCatalogText(`guides.callouts.${id}.title`, id)
      expectCatalogText(`guides.callouts.${id}.body`, id)
    }
  })

  it('the drawer/trigger chrome keys resolve', () => {
    for (const key of ['sectionTitle', 'openGuide', 'readMore', 'learnMore', 'dismissCallout', 'libraryHelp']) {
      expectCatalogText(`guides.ui.${key}`, 'guides.ui')
    }
  })
})
