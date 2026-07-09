import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'
import { DEFAULT_LANG } from '@/core/model/types'
import { useFormStore } from '@/stores/form'
import { usePreviewStore } from '@/stores/preview'

/** Outlasts validation (300ms) + preview (500ms) debounces. */
const settle = async (ms = 900): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, ms))

describe('preview store empty-container gating', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const form = useFormStore()
    form.doc = newDocument('Preview')
  })

  it('pauses regeneration on an empty group, keeping the last good XML', async () => {
    const form = useFormStore()
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    expect(preview.status).toBe('ready')
    expect(preview.blockReason).toBeNull()
    const goodXml = preview.xml
    const keyBefore = preview.instanceKey

    const groupId = form.addNode('group', null) as string
    form.updateNode(groupId, 'Edit label', (n) => { n.label = { [DEFAULT_LANG]: 'Household' } })
    await settle()

    expect(preview.blockReason).toBe('Preview paused — "Household" is empty. Groups need at least one question.')
    expect(preview.status).toBe('invalid')
    expect(preview.stale).toBe(true)
    expect(preview.xml).toBe(goodXml)
    expect(preview.instanceKey).toBe(keyBefore)
  })

  it('clears blockReason and resumes once the container has a question', async () => {
    const form = useFormStore()
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    const groupId = form.addNode('group', null) as string
    await settle()
    expect(preview.blockReason).not.toBeNull()

    form.addNode('text', groupId)
    await settle()
    expect(preview.blockReason).toBeNull()
    expect(preview.status).toBe('ready')
    expect(preview.stale).toBe(false)
  })

  it('uses repeat wording for empty repeats', async () => {
    const form = useFormStore()
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    form.addNode('repeat', null)
    await settle()
    expect(preview.blockReason).toContain('Repeats need at least one question.')
  })

  it('reports whether an engine error was recovered by a revert', () => {
    const form = useFormStore()
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    preview.reportEngineError('boom')
    expect(preview.engineErrorRecovered).toBe(false)
    preview.reportEngineError('boom', true)
    expect(preview.engineErrorRecovered).toBe(true)
    preview.refreshNow()
    expect(preview.engineError).toBeNull()
    expect(preview.engineErrorRecovered).toBe(false)
  })
})
