import { describe, expect, it } from 'vitest'

import { instantiateTemplate } from '@/core/model/factory'
import { migrateDoc } from '@/core/model/migrate'
import { countQuestions } from '@/core/model/ops'
import { validateDocument } from '@/core/validate'
import { serializeXForm } from '@/core/xform/serializer'
import { templatePreview } from '@/persistence/templates-repo'
import { bundledTemplates } from '@/templates'

const errorsOf = (issues: Array<{ severity: string }>): Array<{ severity: string }> =>
  issues.filter((i) => i.severity === 'error')

describe('bundled template registry', () => {
  it('registers the four starters', () => {
    expect(bundledTemplates.map((t) => t.id)).toEqual([
      'household-survey',
      'individual-registration',
      'site-monitoring-visit',
      'feedback-satisfaction',
    ])
  })

  for (const entry of bundledTemplates) {
    describe(entry.id, () => {
      it('loads through the migrateDoc gate and is valid', async () => {
        const doc = await entry.load()
        // load() already ran migrateDoc; assert the raw doc passes too.
        expect(migrateDoc(doc).doc).not.toBeNull()
        expect(errorsOf(validateDocument(doc))).toEqual([])
        expect(errorsOf(serializeXForm(doc).issues)).toEqual([])
      })

      it('has honest precomputed gallery metadata', async () => {
        const doc = await entry.load()
        expect(entry.questionCount).toBe(countQuestions(doc))
        expect(entry.preview).toEqual(templatePreview(doc))
      })

      it('instantiates into a valid, independent document', async () => {
        const doc = await entry.load()
        const instance = instantiateTemplate(doc, 'My New Form')
        expect(errorsOf(validateDocument(instance))).toEqual([])
        expect(instance.settings.formTitle).toBe('My New Form')
        expect(instance.settings.formId).toBe('my_new_form')
        expect(instance.attachments).toEqual([])
        // Every node id is freshly minted.
        const sourceIds = new Set<string>()
        const collect = (nodes: typeof doc.children): void => {
          for (const node of nodes) {
            sourceIds.add(node.id)
            if ('children' in node) collect(node.children)
          }
        }
        collect(doc.children)
        const assertFresh = (nodes: typeof instance.children): void => {
          for (const node of nodes) {
            expect(sourceIds.has(node.id)).toBe(false)
            if ('children' in node) assertFresh(node.children)
          }
        }
        assertFresh(instance.children)
      })
    })
  }
})
