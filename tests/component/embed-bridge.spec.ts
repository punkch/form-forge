import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import {
  buildWorkspaceArchive,
  readWorkspaceArchive,
  type ArchiveFormInput,
} from '@/core/workspace/archive'
import { startEmbedBridge } from '@/embed/bridge'
import {
  PROTOCOL_CHANNEL,
  PROTOCOL_VERSION,
  type BuilderMessage,
  type SaveFormResultMessage,
} from '@/embed/protocol'
import { dexieBackend, getPersistenceBackend, setPersistenceBackend } from '@/persistence/backend'
import { createMemoryBackend } from '@/persistence/memory-backend'
import { useEmbedStore } from '@/stores/embed'
import { useFormStore } from '@/stores/form'

const HOST_ORIGIN = 'https://host.example'

const sampleDoc = {
  schemaVersion: 1,
  settings: { formTitle: 'Embedded sample', formId: 'embedded_sample', version: '1' },
  languages: [],
  children: [
    { id: 'q1', name: 'visitor_name', kind: 'question', type: 'text', bind: {}, body: {}, label: { default: 'Visitor name' } },
    { id: 'q2', name: 'visitor_age', kind: 'question', type: 'integer', bind: {}, body: {}, label: { default: 'Visitor age' } },
  ],
  choiceLists: {},
  attachments: [],
}

describe('embed bridge', () => {
  let pinia: Pinia
  let router: Router
  let posts: BuilderMessage[]
  let targets: string[]
  let stop: (() => void) | null = null

  const Empty = defineComponent({ template: '<div />' })

  beforeEach(() => {
    setPersistenceBackend(createMemoryBackend())
    pinia = createPinia()
    setActivePinia(pinia)
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'library', component: Empty },
        { path: '/forms/:formId', name: 'editor', component: Empty },
      ],
    })
    posts = []
    targets = []
    // Capture outbound messages instead of letting happy-dom loop them back.
    vi.spyOn(window, 'postMessage').mockImplementation(((message: BuilderMessage, targetOrigin: string) => {
      posts.push(message)
      targets.push(targetOrigin)
    }) as typeof window.postMessage)
  })

  afterEach(() => {
    stop?.()
    stop = null
    vi.restoreAllMocks()
  })

  const start = (hostOrigin: string | null = HOST_ORIGIN): void => {
    const embed = useEmbedStore(pinia)
    embed.active = true
    embed.hostOrigin = hostOrigin
    stop = startEmbedBridge({ router, pinia })
  }

  const dispatch = (data: unknown, origin: string = HOST_ORIGIN): void => {
    window.dispatchEvent(new MessageEvent('message', {
      data,
      origin,
      source: window as unknown as MessageEventSource,
    }))
  }

  const request = (type: string, requestId: string, extra: Record<string, unknown> = {}, origin?: string): void => {
    dispatch({ channel: PROTOCOL_CHANNEL, v: PROTOCOL_VERSION, type, requestId, ...extra }, origin)
  }

  const lastPost = (): BuilderMessage => posts[posts.length - 1]

  const initialize = async (config: Record<string, unknown> = {}): Promise<void> => {
    request('init', 'init-1', { config })
    await vi.waitFor(() => { expect(lastPost().type).toBe('init-result') })
  }

  it('posts ready on start, without any form data', () => {
    start()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ channel: PROTOCOL_CHANNEL, v: PROTOCOL_VERSION, type: 'ready' })
    expect((posts[0] as { appVersion: string }).appVersion).toBeTypeOf('string')
    expect(targets[0]).toBe(HOST_ORIGIN)
  })

  it('answers requests before init with a not-initialized error', () => {
    start()
    request('load-form', 'r1', { payload: { format: 'new' } })
    expect(lastPost()).toMatchObject({ type: 'error', code: 'not-initialized', requestId: 'r1' })
  })

  it('replies init-result with the protocol version and correlates the requestId', async () => {
    start()
    await initialize({ locale: 'en' })
    expect(lastPost()).toMatchObject({
      type: 'init-result',
      requestId: 'init-1',
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
    })
    expect(useEmbedStore(pinia).initialized).toBe(true)
    // After init every post targets the host's actual origin.
    expect(targets[targets.length - 1]).toBe(HOST_ORIGIN)
  })

  it('silently ignores messages from a non-pinned origin', () => {
    start()
    const before = posts.length
    request('init', 'evil-1', {}, 'https://evil.example')
    expect(posts).toHaveLength(before)
    expect(useEmbedStore(pinia).initialized).toBe(false)
  })

  it('silently ignores messages without the odk-builder channel', () => {
    start()
    const before = posts.length
    dispatch({ channel: 'someone-else', v: 1, type: 'init', requestId: 'x' })
    dispatch('plain string')
    expect(posts).toHaveLength(before)
  })

  it('rejects requests without a requestId as bad-request', async () => {
    start()
    await initialize()
    dispatch({ channel: PROTOCOL_CHANNEL, v: PROTOCOL_VERSION, type: 'save-form' })
    expect(lastPost()).toMatchObject({ type: 'error', code: 'bad-request' })
  })

  it('answers save-form without a loaded form with no-form-loaded', async () => {
    start()
    await initialize()
    request('save-form', 'save-0')
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'error', code: 'no-form-loaded', requestId: 'save-0' })
    })
  })

  it('rejects unknown load formats with unsupported-format', async () => {
    start()
    await initialize()
    request('load-form', 'load-x', { payload: { format: 'xlsform' } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'error', code: 'unsupported-format', requestId: 'load-x' })
    })
  })

  it('loads an object form, opens the editor and round-trips it through save-form', async () => {
    start()
    await initialize()

    const csv = new TextEncoder().encode('name\nabc').buffer as ArrayBuffer
    request('load-form', 'load-1', {
      payload: {
        format: 'object',
        doc: {
          ...sampleDoc,
          attachments: [{ id: 'old-att', filename: 'villages.csv', mediatype: 'text/csv', size: 8, role: 'csv' }],
        },
        attachments: [{ filename: 'villages.csv', mediatype: 'text/csv', data: csv }],
      },
    })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'load-form-result', requestId: 'load-1', ok: true })
    })

    // The bridge loaded the form store itself before replying (it does not rely
    // on the editor view mounting), so a save-form can follow immediately.
    const formId = router.currentRoute.value.params.formId as string
    expect(formId).toBeTypeOf('string')
    expect(useFormStore(pinia).recordId).toBe(formId)

    request('save-form', 'save-1', { options: { format: 'object' } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'save-form-result', requestId: 'save-1', ok: true })
    })
    const saved = lastPost() as SaveFormResultMessage
    expect(saved.meta).toMatchObject({
      formId: 'embedded_sample',
      title: 'Embedded sample',
      version: '1',
      errorCount: 0,
    })
    expect(saved.payload.format).toBe('object')
    if (saved.payload.format === 'object') {
      const doc = saved.payload.doc as typeof sampleDoc
      expect(doc.settings.formTitle).toBe('Embedded sample')
      expect(doc.children.map((c) => c.name)).toEqual(['visitor_name', 'visitor_age'])
      expect(saved.payload.attachments).toHaveLength(1)
      expect(saved.payload.attachments[0].filename).toBe('villages.csv')
      expect(new TextDecoder().decode(saved.payload.attachments[0].data)).toBe('name\nabc')
    }
  })

  it('creates a new form for format "new" and reports load failures for bad archives', async () => {
    start()
    await initialize()

    request('load-form', 'new-1', { payload: { format: 'new', title: 'Fresh' } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'load-form-result', requestId: 'new-1', ok: true })
    })
    expect(router.currentRoute.value.name).toBe('editor')

    request('load-form', 'bad-archive', { payload: { format: 'archive', data: new ArrayBuffer(4) } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'load-form-result', requestId: 'bad-archive', ok: false })
    })
    const result = lastPost() as { issues: Array<{ code: string }> }
    expect(result.issues.length).toBeGreaterThan(0)
  })

  it('emits a debounced state-changed event when the form turns dirty', async () => {
    start()
    await initialize()
    request('load-form', 'load-2', { payload: { format: 'new', title: 'Dirty test' } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'load-form-result', ok: true })
    })
    // Bridge already loaded the store (fix 6); edit through it directly.
    const form = useFormStore(pinia)
    expect(form.recordId).not.toBeNull()

    form.addNode('text', null)
    await vi.waitFor(() => {
      expect(posts.some((m) => m.type === 'state-changed')).toBe(true)
    })
    const state = posts.filter((m) => m.type === 'state-changed').pop()
    expect(state).toMatchObject({ type: 'state-changed', dirty: true, errorCount: 0 })
  })

  // --- transport & config edge cases ---------------------------------------

  const archiveForm = (title: string, formId: string): ArchiveFormInput => ({
    recordId: `rec-${formId}`,
    meta: { title, formId, version: '1', createdAt: 1000, updatedAt: 1000 },
    // sampleDoc's schemaVersion literal widens to `number` in this object
    // literal; the archive builder only serializes it, so cast to the doc type.
    doc: { ...sampleDoc, settings: { formTitle: title, formId, version: '1' } } as unknown as ArchiveFormInput['doc'],
    attachments: [],
  })

  const buildArchiveBuffer = async (forms: ArchiveFormInput[]): Promise<ArrayBuffer> => {
    const bytes = await buildWorkspaceArchive(forms, '2.0.0-test', new Date().toISOString())
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  }

  it('ignores messages whose source is not the parent window', () => {
    start()
    const before = posts.length
    window.dispatchEvent(new MessageEvent('message', {
      data: { channel: PROTOCOL_CHANNEL, v: PROTOCOL_VERSION, type: 'init', requestId: 'x' },
      origin: HOST_ORIGIN,
      source: null,
    }))
    expect(posts).toHaveLength(before)
    expect(useEmbedStore(pinia).initialized).toBe(false)
  })

  it('refuses init when no origin can be determined (never posts form data to "*")', () => {
    start(null) // no URL-pinned origin
    request('init', 'init-noorigin', { config: {} }, '') // empty event.origin
    expect(lastPost()).toMatchObject({ type: 'error', code: 'bad-request', requestId: 'init-noorigin' })
    expect(useEmbedStore(pinia).initialized).toBe(false)
  })

  it('applies set-config after init, merging export flags per key', async () => {
    start()
    await initialize({ exports: { xform: false } })
    const embed = useEmbedStore(pinia)
    expect(embed.config.exports).toEqual({ xform: false })

    request('set-config', 'cfg-1', { config: { exports: { zip: false } } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'set-config-result', requestId: 'cfg-1', ok: true })
    })
    // The earlier xform:false survives; zip:false merges in — neither re-enables the other.
    expect(embed.config.exports).toEqual({ xform: false, zip: false })
  })

  it('switches the persistence backend on init when no form is loaded', async () => {
    start()
    await initialize({ persistence: 'local' })
    expect(getPersistenceBackend()).toBe(dexieBackend)
  })

  it('rejects a persistence change while a form is loaded, keeping the other keys', async () => {
    start()
    await initialize({ persistence: 'memory' })
    const backendBefore = getPersistenceBackend()

    request('load-form', 'pl-1', { payload: { format: 'new', title: 'Loaded' } })
    await vi.waitFor(() => { expect(lastPost()).toMatchObject({ type: 'load-form-result', ok: true }) })

    request('set-config', 'cfg-persist', { config: { persistence: 'local', exports: { xform: false } } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'error', code: 'bad-request', requestId: 'cfg-persist' })
    })
    const embed = useEmbedStore(pinia)
    expect(embed.config.persistence).toBe('memory')       // persistence unchanged
    expect(embed.config.exports).toEqual({ xform: false }) // other keys still applied
    expect(getPersistenceBackend()).toBe(backendBefore)   // backend not swapped
  })

  it('deletes the previous bridge-created record on the next load (no orphans)', async () => {
    start()
    await initialize()
    const form = useFormStore(pinia)

    request('load-form', 'orphan-1', { payload: { format: 'new', title: 'First' } })
    await vi.waitFor(() => { expect(lastPost()).toMatchObject({ type: 'load-form-result', requestId: 'orphan-1', ok: true }) })
    const first = form.recordId
    expect(first).not.toBeNull()

    request('load-form', 'orphan-2', { payload: { format: 'new', title: 'Second' } })
    await vi.waitFor(() => { expect(lastPost()).toMatchObject({ type: 'load-form-result', requestId: 'orphan-2', ok: true }) })
    const second = form.recordId
    expect(second).not.toBe(first)
    // The record the first load created is gone; only the current one remains.
    expect(await getPersistenceBackend().getForm(first as string)).toBeUndefined()
    expect(await getPersistenceBackend().getForm(second as string)).toBeDefined()
  })

  it('saves in the default archive format and includes the form in the archive', async () => {
    start()
    await initialize()
    request('load-form', 'arc-load', { payload: { format: 'object', doc: sampleDoc, attachments: [] } })
    await vi.waitFor(() => { expect(lastPost()).toMatchObject({ type: 'load-form-result', ok: true }) })

    request('save-form', 'arc-save') // no options → default 'archive'
    await vi.waitFor(() => { expect(lastPost()).toMatchObject({ type: 'save-form-result', requestId: 'arc-save', ok: true }) })
    const saved = lastPost() as SaveFormResultMessage
    expect(saved.payload.format).toBe('archive')
    expect(saved.meta).toMatchObject({ formId: 'embedded_sample', title: 'Embedded sample' })
    if (saved.payload.format === 'archive') {
      const { forms } = await readWorkspaceArchive(saved.payload.data)
      expect(forms.map((f) => f.doc.settings.formTitle)).toEqual(['Embedded sample'])
    }
  })

  it('opens the first form of a multi-form archive (documented keeps-first)', async () => {
    start()
    await initialize()
    const data = await buildArchiveBuffer([archiveForm('Alpha', 'alpha'), archiveForm('Beta', 'beta')])
    request('load-form', 'multi', { payload: { format: 'archive', data } })
    await vi.waitFor(() => { expect(lastPost()).toMatchObject({ type: 'load-form-result', requestId: 'multi', ok: true }) })
    const form = useFormStore(pinia)
    expect(form.doc?.settings.formTitle).toBe('Alpha')
    // Only the first form was materialized as a record.
    expect(await getPersistenceBackend().listForms()).toHaveLength(1)
  })

  it('rejects an unknown save format with unsupported-format', async () => {
    start()
    await initialize()
    request('save-form', 'save-bad', { options: { format: 'pdf' } })
    await vi.waitFor(() => {
      expect(lastPost()).toMatchObject({ type: 'error', code: 'unsupported-format', requestId: 'save-bad' })
    })
  })
})
