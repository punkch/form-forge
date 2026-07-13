import { afterEach, describe, expect, it, vi } from 'vitest'

import { createCentralClient } from './client'
import { CentralError } from './types'

interface RecordedCall {
  url: string
  init: RequestInit
}

/** A fake `fetchImpl` that records each call and delegates to a handler. */
const recordingFetch = (
  handler: (url: string, init: RequestInit) => Response | Promise<Response>
): { fetchImpl: typeof fetch, calls: RecordedCall[] } => {
  const calls: RecordedCall[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} })
    return handler(String(input), init ?? {})
  }) as typeof fetch
  return { fetchImpl, calls }
}

/** A fake `fetchImpl` that rejects the way a browser `fetch` does on a CORS
 * block / offline device. */
const rejectingFetch = (): typeof fetch =>
  (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const headersOf = (call: RecordedCall): Record<string, string> =>
  call.init.headers as Record<string, string>

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createCentralClient — URL joining', () => {
  it('appends /v1/... to a plain base URL', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse([]))
    await createCentralClient({ baseUrl: 'http://localhost:8123', fetchImpl }).listProjects('t')
    expect(calls[0].url).toBe('http://localhost:8123/v1/projects')
  })

  it('preserves an opaque path prefix', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse([]))
    await createCentralClient({ baseUrl: 'http://localhost:8123/my-central', fetchImpl }).listProjects('t')
    expect(calls[0].url).toBe('http://localhost:8123/my-central/v1/projects')
  })

  it('never double-slashes when the base URL has trailing slashes', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse([]))
    await createCentralClient({ baseUrl: 'http://localhost:8123/my-central//', fetchImpl }).listProjects('t')
    expect(calls[0].url).toBe('http://localhost:8123/my-central/v1/projects')
  })
})

describe('createCentralClient — default fetch binding', () => {
  it('falls back to a bound globalThis.fetch when no fetchImpl is injected', async () => {
    const globalFetch = vi.fn(async () => jsonResponse([{ id: 1, name: 'P', verbs: [] }]))
    vi.stubGlobal('fetch', globalFetch)

    const client = createCentralClient({ baseUrl: 'http://localhost:8123' })
    const projects = await client.listProjects('t')

    expect(globalFetch).toHaveBeenCalledTimes(1)
    expect(projects).toEqual([{ id: 1, name: 'P', verbs: [] }])
  })
})

describe('createCentralClient — requests', () => {
  it('createSession POSTs credentials as JSON with no auth header', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse({ token: 'sess-tok', csrf: 'c', expiresAt: '2026-07-13T00:00:00Z' }))
    const session = await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .createSession('a@b.com', 'pw')

    expect(session).toEqual({ token: 'sess-tok', csrf: 'c', expiresAt: '2026-07-13T00:00:00Z' })
    expect(calls[0].url).toBe('http://c/v1/sessions')
    expect(calls[0].init.method).toBe('POST')
    expect(headersOf(calls[0])['Content-Type']).toBe('application/json')
    expect(headersOf(calls[0]).Authorization).toBeUndefined()
    expect(calls[0].init.body).toBe(JSON.stringify({ email: 'a@b.com', password: 'pw' }))
  })

  it('deleteSession DELETEs the token path with a bearer header', async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response(null, { status: 200 }))
    await createCentralClient({ baseUrl: 'http://c', fetchImpl }).deleteSession('tok 1')
    expect(calls[0].url).toBe('http://c/v1/sessions/tok%201')
    expect(calls[0].init.method).toBe('DELETE')
    expect(headersOf(calls[0]).Authorization).toBe('Bearer tok 1')
  })

  it('listProjects GETs with a bearer header and coerces the array', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse([{ id: 1, name: 'Field', verbs: ['form.create'] }]))
    const projects = await createCentralClient({ baseUrl: 'http://c', fetchImpl }).listProjects('tok')
    expect(projects).toEqual([{ id: 1, name: 'Field', verbs: ['form.create'] }])
    expect(headersOf(calls[0]).Authorization).toBe('Bearer tok')
    expect(calls[0].init.method).toBe('GET')
    expect(headersOf(calls[0])['Content-Type']).toBeUndefined()
  })

  it('listForms includes never-published forms verbatim', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse([
        { xmlFormId: 'published', name: 'P', version: '1', publishedAt: '2026-07-13T00:00:00Z' },
        { xmlFormId: 'draft-only', publishedAt: null },
      ]))
    const forms = await createCentralClient({ baseUrl: 'http://c', fetchImpl }).listForms('tok', 7)
    expect(calls[0].url).toBe('http://c/v1/projects/7/forms')
    expect(forms).toHaveLength(2)
    expect(forms[1].publishedAt).toBeNull()
  })

  it('getPublishedFormXml returns the response text', async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response('<h:html/>', { status: 200 }))
    const xml = await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .getPublishedFormXml('tok', 3, 'my form')
    expect(xml).toBe('<h:html/>')
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms/my%20form.xml')
  })

  it('getDraftFormXml targets the draft.xml path', async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response('<h:html/>', { status: 200 }))
    await createCentralClient({ baseUrl: 'http://c', fetchImpl }).getDraftFormXml('tok', 3, 'survey')
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms/survey/draft.xml')
  })

  it('listPublishedAttachments coerces descriptors', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      jsonResponse([{ name: 'villages.csv', type: 'file', exists: true }]))
    const atts = await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .listPublishedAttachments('tok', 3, 'survey')
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms/survey/attachments')
    expect(atts).toEqual([{ name: 'villages.csv', type: 'file', hash: undefined, exists: true }])
  })

  it('downloadPublishedAttachment returns the blob body', async () => {
    const { fetchImpl, calls } = recordingFetch(() =>
      new Response(new Blob(['a,b\n1,2'], { type: 'text/csv' }), { status: 200 }))
    const blob = await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .downloadPublishedAttachment('tok', 3, 'survey', 'a b.csv')
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms/survey/attachments/a%20b.csv')
    expect(await blob.text()).toBe('a,b\n1,2')
  })

  it('createForm POSTs XML with the ignoreWarnings/publish query', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse({ xmlFormId: 'survey' }))
    await createCentralClient({ baseUrl: 'http://c', fetchImpl }).createForm('tok', 3, '<h:html/>')
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms?ignoreWarnings=true&publish=false')
    expect(calls[0].init.method).toBe('POST')
    expect(headersOf(calls[0])['Content-Type']).toBe('application/xml')
    expect(headersOf(calls[0]).Authorization).toBe('Bearer tok')
    expect(calls[0].init.body).toBe('<h:html/>')
  })

  it('createForm resolves the parsed response body (Central warnings)', async () => {
    const { fetchImpl } = recordingFetch(() =>
      jsonResponse({ xmlFormId: 'survey', warnings: ['unused choice list', 42] }))
    const outcome = await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .createForm('tok', 3, '<h:html/>')
    // Only genuine string warnings survive the boundary coercion.
    expect(outcome).toEqual({ warnings: ['unused choice list'] })
  })

  it('updateDraft resolves an empty outcome when the body carries no warnings', async () => {
    const { fetchImpl } = recordingFetch(() => jsonResponse({ xmlFormId: 'survey' }))
    const outcome = await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .updateDraft('tok', 3, 'survey', '<h:html/>')
    expect(outcome).toEqual({})
  })

  it('updateDraft POSTs XML to the draft path', async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response(null, { status: 200 }))
    await createCentralClient({ baseUrl: 'http://c', fetchImpl }).updateDraft('tok', 3, 'survey', '<h:html/>')
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms/survey/draft?ignoreWarnings=true')
    expect(calls[0].init.method).toBe('POST')
    expect(headersOf(calls[0])['Content-Type']).toBe('application/xml')
  })

  it('uploadDraftAttachment POSTs the blob with the given content type', async () => {
    const { fetchImpl, calls } = recordingFetch(() => new Response(null, { status: 200 }))
    const blob = new Blob(['a,b'], { type: 'text/csv' })
    await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .uploadDraftAttachment('tok', 3, 'survey', { name: 'a b.csv', blob, contentType: 'text/csv' })
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms/survey/draft/attachments/a%20b.csv')
    expect(calls[0].init.method).toBe('POST')
    expect(headersOf(calls[0])['Content-Type']).toBe('text/csv')
    expect(calls[0].init.body).toBe(blob)
  })

  it('listDraftAttachments targets the draft attachments path', async () => {
    const { fetchImpl, calls } = recordingFetch(() => jsonResponse([{ name: 'x.csv', exists: false }]))
    const atts = await createCentralClient({ baseUrl: 'http://c', fetchImpl })
      .listDraftAttachments('tok', 3, 'survey')
    expect(calls[0].url).toBe('http://c/v1/projects/3/forms/survey/draft/attachments')
    expect(atts[0].exists).toBe(false)
  })
})

describe('createCentralClient — malformed success bodies', () => {
  it('coerces a non-JSON 200 body to safe defaults instead of throwing', async () => {
    const { fetchImpl } = recordingFetch(() => new Response('not json at all', { status: 200 }))
    const projects = await createCentralClient({ baseUrl: 'http://c', fetchImpl }).listProjects('tok')
    expect(projects).toEqual([])
  })
})

describe('createCentralClient — error classification', () => {
  it('classifies a fetch rejection as cors when the device is online', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const client = createCentralClient({ baseUrl: 'http://c', fetchImpl: rejectingFetch() })
    const err = await client.listProjects('tok').catch((e) => e as CentralError)
    expect(err).toBeInstanceOf(CentralError)
    expect((err as CentralError).kind).toBe('cors')
    expect((err as CentralError).status).toBeUndefined()
  })

  it('classifies a fetch rejection as network when the device is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const client = createCentralClient({ baseUrl: 'http://c', fetchImpl: rejectingFetch() })
    const err = await client.listProjects('tok').catch((e) => e as CentralError)
    expect((err as CentralError).kind).toBe('network')
  })

  it('classifies 401 and 403 as auth', async () => {
    for (const status of [401, 403]) {
      const client = createCentralClient({
        baseUrl: 'http://c',
        fetchImpl: recordingFetch(() => jsonResponse({ message: 'nope' }, status)).fetchImpl,
      })
      const err = await client.listProjects('tok').catch((e) => e as CentralError)
      expect((err as CentralError).kind).toBe('auth')
      expect((err as CentralError).status).toBe(status)
      expect((err as CentralError).message).toBe('nope')
    }
  })

  it('classifies a 409.3 formId collision as conflict with code and details', async () => {
    const body = {
      code: '409.3',
      message: 'A resource already exists with xmlFormId value(s) of survey.',
      details: { fields: ['xmlFormId'], values: ['survey'] },
    }
    const client = createCentralClient({
      baseUrl: 'http://c',
      fetchImpl: recordingFetch(() => jsonResponse(body, 409)).fetchImpl,
    })
    const err = await client.createForm('tok', 3, '<h:html/>').catch((e) => e as CentralError)
    expect((err as CentralError).kind).toBe('conflict')
    expect((err as CentralError).status).toBe(409)
    expect((err as CentralError).code).toBe('409.3')
    expect((err as CentralError).details).toEqual({ fields: ['xmlFormId'], values: ['survey'] })
    expect((err as CentralError).message).toBe(body.message)
  })

  it('classifies 404 as not-found', async () => {
    const client = createCentralClient({
      baseUrl: 'http://c',
      fetchImpl: recordingFetch(() => jsonResponse({}, 404)).fetchImpl,
    })
    const err = await client.getPublishedFormXml('tok', 3, 'missing').catch((e) => e as CentralError)
    expect((err as CentralError).kind).toBe('not-found')
    // No code/message on the body → the client's generic fallback message.
    expect((err as CentralError).code).toBeUndefined()
    expect((err as CentralError).message).toBe('Central request failed with HTTP 404.')
  })

  it('classifies any other non-OK status as http, falling back for a non-JSON body', async () => {
    const client = createCentralClient({
      baseUrl: 'http://c',
      fetchImpl: recordingFetch(() => new Response('Internal Server Error', { status: 500 })).fetchImpl,
    })
    const err = await client.listProjects('tok').catch((e) => e as CentralError)
    expect((err as CentralError).kind).toBe('http')
    expect((err as CentralError).status).toBe(500)
    expect((err as CentralError).message).toBe('Central request failed with HTTP 500.')
  })

  it('ignores a non-record error body (array) and uses the fallback message', async () => {
    const client = createCentralClient({
      baseUrl: 'http://c',
      fetchImpl: recordingFetch(() => jsonResponse(['unexpected'], 400)).fetchImpl,
    })
    const err = await client.listProjects('tok').catch((e) => e as CentralError)
    expect((err as CentralError).kind).toBe('http')
    expect((err as CentralError).status).toBe(400)
    expect((err as CentralError).message).toBe('Central request failed with HTTP 400.')
  })
})
