import { beforeEach, describe, expect, it } from 'vitest'

import { addAttachment } from '@/persistence/attachments-repo'
import { db } from '@/persistence/db'

import { makeFetchFormAttachment } from './fetchFormAttachment'

describe('makeFetchFormAttachment', () => {
  beforeEach(async () => {
    await db.attachments.clear()
  })

  it('serves stored attachments for jr:// URLs with their mediatype', async () => {
    await addAttachment('form-1', 'villages.csv', new Blob(['name,label\na,A'], { type: 'text/csv' }))
    const fetchAttachment = makeFetchFormAttachment('form-1')
    const response = await fetchAttachment(new URL('jr://file-csv/villages.csv'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(await response.text()).toContain('name,label')
  })

  it('404s for unknown files and other forms\' attachments', async () => {
    await addAttachment('form-1', 'logo.png', new Blob(['x'], { type: 'image/png' }))
    const fetchAttachment = makeFetchFormAttachment('form-2')
    expect((await fetchAttachment(new URL('jr://images/logo.png'))).status).toBe(404)
    expect((await fetchAttachment(new URL('jr://images/missing.png'))).status).toBe(404)
  })

  it('decodes URL-encoded filenames', async () => {
    await addAttachment('form-1', 'my file.csv', new Blob(['a'], { type: 'text/csv' }))
    const fetchAttachment = makeFetchFormAttachment('form-1')
    expect((await fetchAttachment(new URL('jr://file-csv/my%20file.csv'))).status).toBe(200)
  })
})
