import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { countQuestions } from '@/core/model/ops'

import { buildTemplates, templateJson, writeTemplates } from '../../scripts/make-templates'

const templatesDir = fileURLToPath(new URL('../../src/templates', import.meta.url))

/**
 * The bundled template JSON files are generated artifacts
 * (scripts/make-templates.ts). The generator is deterministic, so the
 * checked-in files must match its output byte for byte — this both guards
 * against hand-edits drifting from the generator and keeps the generator
 * itself type-checked and honest.
 *
 * To regenerate after changing the generator:
 *   REGENERATE_TEMPLATES=1 pnpm vitest run tests/unit/templates-generator.spec.ts
 */
describe('bundled template generator', () => {
  if (process.env.REGENERATE_TEMPLATES === '1') {
    it('regenerates src/templates/*.json', () => {
      writeTemplates(templatesDir)
      expect(true).toBe(true)
    })
  }

  it('builds four valid templates with 8-15 questions each', () => {
    const built = buildTemplates()
    expect(built.map((t) => t.slug)).toEqual([
      'household-survey',
      'individual-registration',
      'site-monitoring-visit',
      'feedback-satisfaction',
    ])
    for (const { doc } of built) {
      expect(countQuestions(doc)).toBeGreaterThanOrEqual(8)
      expect(countQuestions(doc)).toBeLessThanOrEqual(15)
      // Bilingual EN+FR content.
      expect(doc.languages).toEqual(['English (en)', 'French (fr)'])
    }
  })

  it('checked-in JSON matches the generator output byte for byte', () => {
    for (const { slug, doc } of buildTemplates()) {
      const onDisk = readFileSync(join(templatesDir, `${slug}.json`), 'utf8')
      expect(onDisk, `${slug}.json is stale — regenerate with REGENERATE_TEMPLATES=1`).toBe(templateJson(doc))
    }
  })
})
