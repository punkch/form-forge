import { describe, expect, it, vi } from 'vitest'

import type { CentralClient } from './client'
import { importFormFromCentral } from './import'
import { CentralError, type CentralAttachmentDescriptor } from './types'

/** A minimal, self-contained published XForm — enough for parseXForm to build a
 * document. Attachments are supplied separately by the fake client (the parser
 * never fills doc.attachments — that is exactly what import.ts must repair). */
const XFORM = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Import Test</h:title>
    <model>
      <instance>
        <data id="import_test" version="202607131200">
          <name/>
        </data>
      </instance>
      <bind nodeset="/data/name" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/name"><label>Name</label></input>
  </h:body>
</h:html>`

const desc = (
  name: string,
  exists: boolean,
  type?: string
): CentralAttachmentDescriptor => ({ name, exists, type })

interface FakeOptions {
  xml?: string
  getXml?: () => Promise<string>
  descriptors?: CentralAttachmentDescriptor[]
  listAttachments?: () => Promise<CentralAttachmentDescriptor[]>
  /** Blob per attachment name; a name absent here downloads an empty blob. */
  blobs?: Record<string, Blob>
}

const makeClient = (opts: FakeOptions = {}): CentralClient => {
  const getPublishedFormXml = vi.fn(opts.getXml ?? (async () => opts.xml ?? XFORM))
  const listPublishedAttachments = vi.fn(
    opts.listAttachments ?? (async () => opts.descriptors ?? [])
  )
  const downloadPublishedAttachment = vi.fn(
    async (_t: string, _p: number, _f: string, name: string) =>
      opts.blobs?.[name] ?? new Blob([])
  )
  // Only the three methods import.ts touches are implemented; the rest exist so
  // the object satisfies CentralClient without being exercised.
  const unused = vi.fn(async () => { throw new Error('not used by import') })
  return {
    getPublishedFormXml,
    listPublishedAttachments,
    downloadPublishedAttachment,
    createSession: unused,
    deleteSession: unused,
    listProjects: unused,
    listForms: unused,
    getDraftFormXml: unused,
    createForm: unused,
    updateDraft: unused,
    uploadDraftAttachment: unused,
    listDraftAttachments: unused,
  } as unknown as CentralClient
}

describe('importFormFromCentral', () => {
  it('assembles the document and populates doc.attachments from Central\'s list', async () => {
    const client = makeClient({
      descriptors: [desc('logo.png', true, 'image/png'), desc('options.csv', true, 'text/csv')],
      blobs: {
        'logo.png': new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
        'options.csv': new Blob(['a,b\n1,2'], { type: 'text/csv' }),
      },
    })

    const { document, issues, attachments } = await importFormFromCentral({
      client,
      token: 'tok-1',
      projectId: 7,
      xmlFormId: 'import_test',
    })

    // Sanity: the XForm actually parsed.
    expect(document.settings.formId).toBe('import_test')
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])

    // The load-bearing assertion: parseXForm left attachments empty; import.ts
    // rebuilt them from the descriptor list.
    expect(document.attachments).toHaveLength(2)
    expect(document.attachments).toEqual([
      { id: '', filename: 'logo.png', mediatype: 'image/png', size: 3, role: 'media' },
      { id: '', filename: 'options.csv', mediatype: 'text/csv', size: 7, role: 'csv' },
    ])

    // The downloaded blobs come back in archive currency.
    expect(attachments.map((a) => a.filename)).toEqual(['logo.png', 'options.csv'])
    expect(attachments[0].blob).toBeInstanceOf(Blob)
    expect(attachments[0].mediatype).toBe('image/png')

    // The token / project / form id are threaded through to the client.
    expect(client.getPublishedFormXml).toHaveBeenCalledWith('tok-1', 7, 'import_test')
    expect(client.listPublishedAttachments).toHaveBeenCalledWith('tok-1', 7, 'import_test')
  })

  it('downloads all existing attachments and keeps descriptor order despite out-of-order resolution', async () => {
    // The downloads run concurrently; this fake resolves the SECOND attachment
    // before the first (first waits on a deferred promise the second releases).
    // A correct implementation must still emit results in descriptor order.
    let releaseFirst: () => void = () => {}
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })

    const client = makeClient({
      descriptors: [desc('first.png', true, 'image/png'), desc('second.csv', true, 'text/csv')],
    })
    vi.mocked(client.downloadPublishedAttachment).mockImplementation(
      async (_t: string, _p: number, _f: string, name: string) => {
        if (name === 'first.png') {
          await firstGate
          return new Blob([new Uint8Array([1])], { type: 'image/png' })
        }
        // The second download completes immediately, then releases the first.
        releaseFirst()
        return new Blob(['a,b'], { type: 'text/csv' })
      }
    )

    const { document, attachments } = await importFormFromCentral({
      client,
      token: 't',
      projectId: 1,
      xmlFormId: 'f',
    })

    // Both existing attachments were requested.
    expect(client.downloadPublishedAttachment).toHaveBeenCalledTimes(2)
    expect(client.downloadPublishedAttachment).toHaveBeenCalledWith('t', 1, 'f', 'first.png')
    expect(client.downloadPublishedAttachment).toHaveBeenCalledWith('t', 1, 'f', 'second.csv')

    // Ordering follows the descriptor list, not completion order.
    expect(attachments.map((a) => a.filename)).toEqual(['first.png', 'second.csv'])
    expect(document.attachments.map((r) => r.filename)).toEqual(['first.png', 'second.csv'])
    expect(document.attachments.map((r) => r.role)).toEqual(['media', 'csv'])
  })

  it('skips exists:false descriptors and never downloads them', async () => {
    const client = makeClient({
      descriptors: [desc('present.png', true, 'image/png'), desc('missing.csv', false, 'text/csv')],
      blobs: { 'present.png': new Blob([new Uint8Array([9])], { type: 'image/png' }) },
    })

    const { document, attachments } = await importFormFromCentral({
      client,
      token: 't',
      projectId: 1,
      xmlFormId: 'f',
    })

    expect(document.attachments).toHaveLength(1)
    expect(document.attachments[0].filename).toBe('present.png')
    expect(attachments).toHaveLength(1)
    // The not-yet-uploaded attachment was never fetched.
    expect(client.downloadPublishedAttachment).toHaveBeenCalledTimes(1)
    expect(client.downloadPublishedAttachment).toHaveBeenCalledWith('t', 1, 'f', 'present.png')
  })

  it('defaults the mediatype to application/octet-stream when the download has no Content-Type', async () => {
    const client = makeClient({
      descriptors: [desc('data.bin', true, 'application/x-thing')],
      // A blob with no `type` models a response that carried no Content-Type.
      blobs: { 'data.bin': new Blob([new Uint8Array([0, 1, 2, 3])]) },
    })

    const { document, attachments } = await importFormFromCentral({
      client,
      token: 't',
      projectId: 1,
      xmlFormId: 'f',
    })

    expect(document.attachments[0].mediatype).toBe('application/octet-stream')
    expect(document.attachments[0].role).toBe('other')
    expect(attachments[0].mediatype).toBe('application/octet-stream')
  })

  it('returns empty attachments when the form has none', async () => {
    const client = makeClient({ descriptors: [] })

    const { document, attachments } = await importFormFromCentral({
      client,
      token: 't',
      projectId: 1,
      xmlFormId: 'f',
    })

    expect(document.attachments).toEqual([])
    expect(attachments).toEqual([])
    expect(client.downloadPublishedAttachment).not.toHaveBeenCalled()
  })

  it('propagates the client\'s CentralError (kind preserved) on a transport failure', async () => {
    const client = makeClient({
      getXml: async () => { throw new CentralError('nope', { kind: 'auth', status: 401 }) },
    })

    await expect(importFormFromCentral({
      client,
      token: 't',
      projectId: 1,
      xmlFormId: 'f',
    })).rejects.toMatchObject({ kind: 'auth', status: 401 })
  })

  it('propagates a download failure', async () => {
    const client = makeClient({
      descriptors: [desc('logo.png', true, 'image/png')],
    })
    vi.mocked(client.downloadPublishedAttachment).mockRejectedValueOnce(
      new CentralError('gone', { kind: 'not-found', status: 404 })
    )

    await expect(importFormFromCentral({
      client,
      token: 't',
      projectId: 1,
      xmlFormId: 'f',
    })).rejects.toMatchObject({ kind: 'not-found' })
  })
})
