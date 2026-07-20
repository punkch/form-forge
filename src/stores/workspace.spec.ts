// @vitest-environment happy-dom
// happy-dom (not the unit project's node env) because deleteForm now touches
// the ui store, which needs localStorage to persist into and a window for
// its viewport-relative panel clamps.
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/persistence/db'
import { useUiStore } from '@/stores/ui'

import { useWorkspaceStore } from './workspace'

const tick = async (): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, 150))

describe('workspace store', () => {
  beforeEach(async () => {
    localStorage.clear()
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

  it('prunes the remembered export format when a form is deleted', async () => {
    const workspace = useWorkspaceStore()
    const record = await workspace.createForm('Export Memory')
    useUiStore().setLastExportFormat(record.id, 'xlsform')
    expect(useUiStore().getLastExportFormat(record.id)).toBe('xlsform')

    await workspace.deleteForm(record.id)
    expect(useUiStore().getLastExportFormat(record.id)).toBeNull()
  })
})
