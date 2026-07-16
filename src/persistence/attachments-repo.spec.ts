import { beforeEach, describe, expect, it } from 'vitest'

import { backendCases } from '../../tests/helpers/backends'
import * as attachmentsRepo from './attachments-repo'

// Contract suite: renameAttachment must behave identically on the Dexie
// default and embed mode's memory backend (tests/helpers/backends.ts).
describe.each(backendCases)('attachments repo — renameAttachment ($name backend)', ({ setup }) => {
  beforeEach(setup)

  it('renames an existing record in place, keeping its blob and id', async () => {
    const record = await attachmentsRepo.addAttachment('form-1', 'sites.csv', new Blob(['a,b']))

    await attachmentsRepo.renameAttachment(record.id, 'villages.csv')

    const listed = await attachmentsRepo.listAttachments('form-1')
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(record.id)
    expect(listed[0].filename).toBe('villages.csv')
    expect(listed[0].size).toBe(record.size)
  })

  it('throws when the id does not exist', async () => {
    await expect(attachmentsRepo.renameAttachment('missing-id', 'x.csv')).rejects.toThrow()
  })
})
