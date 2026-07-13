import { describe, expect, it, vi } from 'vitest'

import type { ArchiveAttachment } from '../workspace/archive'
import { CentralError } from './types'
import { publishForm, type PublishClient, type PublishOutcome, type PublishProgress } from './publish'

/** A recording fake `PublishClient`: every call is logged (in order) so tests
 * can assert the create/update-then-upload sequencing, and each method's result
 * is configurable per test. */
const makeClient = (opts: {
  create?: () => Promise<PublishOutcome | void>
  update?: () => Promise<PublishOutcome | void>
  upload?: () => Promise<void>
} = {}): { client: PublishClient, calls: string[] } => {
  const calls: string[] = []
  const client: PublishClient = {
    createForm: vi.fn(async (_t, _p, _xml) => {
      calls.push('createForm')
      return opts.create ? await opts.create() : undefined
    }),
    updateDraft: vi.fn(async (_t, _p, xmlFormId) => {
      calls.push(`updateDraft:${xmlFormId}`)
      return opts.update ? await opts.update() : undefined
    }),
    uploadDraftAttachment: vi.fn(async (_t, _p, _f, body) => {
      calls.push(`upload:${body.name}:${body.contentType}`)
      if (opts.upload) await opts.upload()
    }),
  }
  return { client, calls }
}

const attachment = (filename: string, mediatype = 'text/csv'): ArchiveAttachment =>
  ({ filename, mediatype, blob: new Blob(['data'], { type: mediatype }) })

const baseInput = {
  token: 'tok-123',
  projectId: 7,
  xmlFormId: 'water-survey',
  xml: '<h:html/>',
}

describe('publishForm', () => {
  it('creates a new form then uploads each attachment in order', async () => {
    const { client, calls } = makeClient()
    const attachments = [attachment('a.csv'), attachment('b.geojson', 'application/geo+json')]

    const result = await publishForm({ ...baseInput, client, mode: 'create', attachments })

    // create runs before any upload, and uploads run in list order.
    expect(calls).toEqual([
      'createForm',
      'upload:a.csv:text/csv',
      'upload:b.geojson:application/geo+json',
    ])
    expect(client.createForm).toHaveBeenCalledWith('tok-123', 7, '<h:html/>')
    expect(client.updateDraft).not.toHaveBeenCalled()
    // uploads target the resolved xmlFormId (create returns no xmlFormId).
    expect(client.uploadDraftAttachment).toHaveBeenNthCalledWith(
      1, 'tok-123', 7, 'water-survey', { name: 'a.csv', blob: expect.any(Blob), contentType: 'text/csv' })
    expect(result).toEqual({
      xmlFormId: 'water-survey',
      mode: 'create',
      attachmentsUploaded: 2,
      warnings: [],
    })
  })

  it('updates the existing draft instead of creating on update mode', async () => {
    const { client, calls } = makeClient()

    const result = await publishForm({
      ...baseInput,
      client,
      mode: 'update',
      attachments: [attachment('only.csv')],
    })

    expect(client.createForm).not.toHaveBeenCalled()
    expect(client.updateDraft).toHaveBeenCalledWith('tok-123', 7, 'water-survey', '<h:html/>')
    expect(calls).toEqual(['updateDraft:water-survey', 'upload:only.csv:text/csv'])
    expect(result.mode).toBe('update')
    expect(result.attachmentsUploaded).toBe(1)
  })

  it('passes Central warnings through verbatim', async () => {
    const { client } = makeClient({ create: async () => ({ warnings: ['unused choice list', 'label too long'] }) })

    const result = await publishForm({ ...baseInput, client, mode: 'create', attachments: [] })

    expect(result.warnings).toEqual(['unused choice list', 'label too long'])
  })

  it('coerces a malformed warnings payload to an empty list', async () => {
    // Non-array warnings, and a non-string entry mixed into an array.
    const nonArray = makeClient({ create: async () => ({ warnings: 'oops' } as unknown as PublishOutcome) })
    const mixed = makeClient({ update: async () => ({ warnings: ['ok', 42] as unknown as string[] }) })

    const a = await publishForm({ ...baseInput, client: nonArray.client, mode: 'create', attachments: [] })
    const b = await publishForm({ ...baseInput, client: mixed.client, mode: 'update', attachments: [] })

    expect(a.warnings).toEqual([])
    expect(b.warnings).toEqual(['ok'])
  })

  it('reports progress for the form phase then each attachment', async () => {
    const { client } = makeClient()
    const progress: PublishProgress[] = []
    const attachments = [attachment('a.csv'), attachment('b.csv')]

    await publishForm({
      ...baseInput,
      client,
      mode: 'create',
      attachments,
      onProgress: (p) => progress.push(p),
    })

    expect(progress).toEqual([
      { phase: 'form' },
      { phase: 'attachment', name: 'a.csv', index: 1, total: 2 },
      { phase: 'attachment', name: 'b.csv', index: 2, total: 2 },
    ])
  })

  it('publishes a form with no attachments (form phase only)', async () => {
    const { client, calls } = makeClient()

    const result = await publishForm({ ...baseInput, client, mode: 'create', attachments: [] })

    expect(calls).toEqual(['createForm'])
    expect(client.uploadDraftAttachment).not.toHaveBeenCalled()
    expect(result.attachmentsUploaded).toBe(0)
  })

  it('defaults a blank attachment mediatype to application/octet-stream', async () => {
    const { client, calls } = makeClient()

    await publishForm({
      ...baseInput,
      client,
      mode: 'update',
      attachments: [attachment('blob.bin', '')],
    })

    expect(calls).toContain('upload:blob.bin:application/octet-stream')
  })

  it('surfaces a 409 formId collision from the create step as a CentralError', async () => {
    const conflict = new CentralError('exists', { kind: 'conflict', code: '409.3', status: 409 })
    const { client } = makeClient({ create: async () => { throw conflict } })

    await expect(publishForm({ ...baseInput, client, mode: 'create', attachments: [attachment('a.csv')] }))
      .rejects.toBe(conflict)
    // The attachment upload never runs once the definition step fails.
    expect(client.uploadDraftAttachment).not.toHaveBeenCalled()
  })

  it('propagates an attachment upload failure', async () => {
    const boom = new CentralError('nope', { kind: 'http', status: 500 })
    const { client } = makeClient({ upload: async () => { throw boom } })

    await expect(publishForm({ ...baseInput, client, mode: 'update', attachments: [attachment('a.csv')] }))
      .rejects.toBe(boom)
  })
})
