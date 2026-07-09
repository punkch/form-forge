import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/persistence/db'

import { useWorkspaceStore } from './workspace'

const tick = async (): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, 150))

describe('workspace store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.forms.clear()
  })

  it('creates forms and reflects them via liveQuery', async () => {
    const workspace = useWorkspaceStore()
    workspace.startWatching()
    const record = await workspace.createForm('Watched Form')
    await tick()
    expect(workspace.forms.map((f) => f.id)).toContain(record.id)
    expect(workspace.loading).toBe(false)
    workspace.stopWatching()
  })

  it('rename, duplicate and delete flow through to the repo', async () => {
    const workspace = useWorkspaceStore()
    const record = await workspace.createForm('Original')
    await workspace.renameForm(record.id, 'Renamed')
    expect((await db.forms.get(record.id))?.title).toBe('Renamed')

    const copy = await workspace.duplicateForm(record.id)
    expect(copy?.title).toBe('Renamed (copy)')

    await workspace.deleteForm(record.id)
    expect(await db.forms.get(record.id)).toBeUndefined()
    expect(await db.forms.get(copy!.id)).toBeDefined()
  })
})
