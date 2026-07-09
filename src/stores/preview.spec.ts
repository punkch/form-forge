import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'

import { useFormStore } from './form'
import { usePreviewStore } from './preview'

const settle = async (ms = 900): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, ms))

describe('preview store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const form = useFormStore()
    form.doc = newDocument('Preview')
  })

  it('generates XML immediately on start and remounts on change', async () => {
    const form = useFormStore()
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    expect(preview.status).toBe('ready')
    expect(preview.xml).toContain('<h:title>Preview</h:title>')
    const keyBefore = preview.instanceKey

    form.addNode('integer', null)
    await settle()
    expect(preview.instanceKey).toBeGreaterThan(keyBefore)
    expect(preview.xml).toContain('type="int"')
  })

  it('keeps the last good XML and flags stale when the form breaks', async () => {
    const form = useFormStore()
    const id = form.addNode('text', null) as string
    const preview = usePreviewStore()
    preview.start()
    const goodXml = preview.xml

    form.updateNode(id, 'Edit relevant', (n) => { n.bind.relevant = '${ghost} = 1' })
    await settle()
    expect(preview.status).toBe('invalid')
    expect(preview.stale).toBe(true)
    expect(preview.xml).toBe(goodXml)

    form.updateNode(id, 'Edit relevant', (n) => { n.bind.relevant = undefined })
    await settle()
    expect(preview.status).toBe('ready')
    expect(preview.stale).toBe(false)
  })

  it('refreshNow bypasses the debounce and reportEngineError surfaces', () => {
    const form = useFormStore()
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    preview.refreshNow()
    expect(preview.status).toBe('ready')
    preview.reportEngineError('boom')
    expect(preview.status).toBe('engine-error')
    expect(preview.engineError).toBe('boom')
  })

  it('respects the autoRefresh toggle', async () => {
    const form = useFormStore()
    form.addNode('text', null)
    const preview = usePreviewStore()
    preview.start()
    preview.autoRefresh = false
    const keyBefore = preview.instanceKey
    form.addNode('integer', null)
    await settle()
    expect(preview.instanceKey).toBe(keyBefore)
    expect(preview.stale).toBe(true)
    preview.autoRefresh = true
    preview.refreshNow()
    expect(preview.stale).toBe(false)
  })
})
