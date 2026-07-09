import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { newDocument } from '@/core/model/factory'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'
import { useFormStore } from '@/stores/form'
import { usePreviewStore } from '@/stores/preview'

/** Outlasts validation (300ms) + preview (500ms) debounces. */
const settle = async (ms = 900): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Regression suite for the stale-form preview bug: the preview store is
 * app-global, so opening a different form must clear the previous form's
 * XML instead of showing it under the new form's record id.
 */
describe('preview store across form switches', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.forms.clear()
    await db.snapshots.clear()
  })

  /** Creates + loads form "Alpha" with one text question, preview ready. */
  const openAlphaWithPreview = async (): Promise<{
    form: ReturnType<typeof useFormStore>
    preview: ReturnType<typeof usePreviewStore>
  }> => {
    const record = await formsRepo.createForm(newDocument('Alpha'))
    const form = useFormStore()
    await form.load(record.id)
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    expect(preview.status).toBe('ready')
    expect(preview.xml).toContain('<h:title>Alpha</h:title>')
    return { form, preview }
  }

  it('close() clears the preview back to idle', async () => {
    const { form, preview } = await openAlphaWithPreview()
    // Leave a pending debounce behind to prove reset() cancels it.
    form.addNode('integer', null)
    await form.close()
    await nextTick()
    expect(preview.xml).toBeNull()
    expect(preview.status).toBe('idle')
    expect(preview.stale).toBe(false)
    expect(preview.blockReason).toBeNull()
    await settle()
    // The debounced regenerate from the pre-close edit never resurrects it.
    expect(preview.xml).toBeNull()
    expect(preview.status).toBe('idle')
  })

  it('loading a blank form never shows the previous form\'s XML', async () => {
    const { form, preview } = await openAlphaWithPreview()
    const beta = await formsRepo.createForm(newDocument('Beta'))
    await form.load(beta.id)
    await nextTick()
    expect(preview.xml).toBeNull()
    expect(preview.hasPreview).toBe(false)
    // Blank root pauses regeneration; the panel shows the empty state.
    expect(preview.blockReason).toContain('no questions')
    await settle()
    expect(preview.xml).toBeNull()
  })

  it('clears an engine error left behind by the previous form', async () => {
    const { form, preview } = await openAlphaWithPreview()
    preview.reportEngineError('boom', true)
    expect(preview.status).toBe('engine-error')
    const beta = await formsRepo.createForm(newDocument('Beta'))
    await form.load(beta.id)
    await nextTick()
    expect(preview.engineError).toBeNull()
    expect(preview.engineErrorRecovered).toBe(false)
    expect(preview.status).not.toBe('engine-error')
  })

  it('editing the new form to validity regenerates its own XML', async () => {
    const { form, preview } = await openAlphaWithPreview()
    const beta = await formsRepo.createForm(newDocument('Beta'))
    await form.load(beta.id)
    await nextTick()
    expect(preview.xml).toBeNull()

    form.addNode('text', null)
    await settle()
    expect(preview.status).toBe('ready')
    expect(preview.stale).toBe(false)
    expect(preview.blockReason).toBeNull()
    expect(preview.xml).toContain('<h:title>Beta</h:title>')
    expect(preview.xml).not.toContain('Alpha')
  })

  it('a brand-new blank form starts with no preview and no error state', async () => {
    const record = await formsRepo.createForm(newDocument('Fresh'))
    const form = useFormStore()
    await form.load(record.id)
    const preview = usePreviewStore()
    preview.start()
    expect(preview.xml).toBeNull()
    expect(preview.hasPreview).toBe(false)
    expect(preview.stale).toBe(false)
    expect(preview.engineError).toBeNull()
    expect(preview.blockReason).toContain('no questions')
  })
})
