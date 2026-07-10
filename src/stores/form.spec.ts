import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { newDocument } from '@/core/model/factory'
import { flatten } from '@/core/model/ops'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'

import { useFormStore } from './form'

const namesAtRoot = (store: ReturnType<typeof useFormStore>): string[] =>
  (store.doc?.children ?? []).map((n) => n.name)

describe('form store', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.forms.clear()
    await db.snapshots.clear()
    await db.attachments.clear()
  })

  const loadFresh = async (): Promise<ReturnType<typeof useFormStore>> => {
    const record = await formsRepo.createForm(newDocument('Test'))
    const store = useFormStore()
    await store.load(record.id)
    return store
  }

  it('addNode / removeNodeById / duplicateNodeById are undoable', async () => {
    const store = await loadFresh()
    const id = store.addNode('text', null)
    expect(id).not.toBeNull()
    expect(store.doc?.children).toHaveLength(1)

    const dupId = store.duplicateNodeById(id as string)
    expect(dupId).not.toBeNull()
    expect(store.doc?.children).toHaveLength(2)
    expect(namesAtRoot(store)[1]).not.toBe(namesAtRoot(store)[0])

    store.removeNodeById(dupId as string)
    expect(store.doc?.children).toHaveLength(1)

    store.undo()
    expect(store.doc?.children).toHaveLength(2)
    store.redo()
    expect(store.doc?.children).toHaveLength(1)
  })

  it('moveBy / indent / outdent restructure the tree', async () => {
    const store = await loadFresh()
    const groupId = store.addNode('group', null) as string
    const textId = store.addNode('text', null) as string
    expect(store.doc?.children.map((n) => n.id)).toEqual([groupId, textId])

    store.moveBy(textId, -1)
    expect(store.doc?.children.map((n) => n.id)).toEqual([textId, groupId])
    store.moveBy(textId, 1)
    expect(store.doc?.children.map((n) => n.id)).toEqual([groupId, textId])

    store.indent(textId)
    const group = store.doc?.children[0]
    expect(group !== undefined && 'children' in group && group.children[0].id).toBe(textId)

    store.outdent(textId)
    expect(store.doc?.children.map((n) => n.id)).toEqual([groupId, textId])
  })

  it('coalesces rapid same-label edits into one undo entry', async () => {
    const store = await loadFresh()
    const id = store.addNode('text', null) as string
    store.updateNode(id, 'Edit label', (n) => { n.label = { default: 'H' } })
    store.updateNode(id, 'Edit label', (n) => { n.label = { default: 'He' } })
    store.updateNode(id, 'Edit label', (n) => { n.label = { default: 'Hey' } })
    store.undo()
    // One undo reverts the whole typing burst (back to pre-label state).
    const node = store.doc?.children[0]
    expect(node !== undefined && node.label?.default).not.toBe('Hey')
    store.undo()
    expect(store.doc?.children).toHaveLength(0)
  })

  it('endTransaction drops no-op drag snapshots', async () => {
    const store = await loadFresh()
    store.addNode('text', null)
    const before = store.canUndo
    store.beginTransaction('Move question')
    store.endTransaction()
    expect(store.canUndo).toBe(before)
    // and a real transaction is kept
    store.beginTransaction('Move question')
    store.doc?.children.splice(0, 1)
    store.endTransaction()
    store.undo()
    expect(store.doc?.children).toHaveLength(1)
  })

  // NOTE: fake timers deadlock fake-indexeddb (it schedules internally), so
  // these tests use flushSave() and short real waits instead.

  it('marks dirty after mutations and persists on flushSave', async () => {
    const store = await loadFresh()
    store.addNode('integer', null)
    expect(store.saveState).toBe('dirty')
    await store.flushSave()
    expect(store.saveState).toBe('saved')
    const record = await formsRepo.getForm(store.recordId as string)
    expect(flatten(record?.doc.children ?? [])).toHaveLength(1)
  })

  it('undo after replacing an attachment restores a still-present record', async () => {
    const store = await loadFresh()
    const { attachFile } = useAttachmentUpload()
    const csv = (): File => new File(['name,label\n'], 'data.csv', { type: 'text/csv' })

    const first = await attachFile(csv())
    const second = await attachFile(csv()) // re-upload under the same name → replace
    expect(store.doc?.attachments.map((a) => a.id)).toEqual([second?.id])

    // The superseded record was not deleted, so undo can restore its ref.
    store.undo()
    expect(store.doc?.attachments.map((a) => a.id)).toEqual([first?.id])
    expect(await attachmentsRepo.getAttachment(first?.id as string)).toBeDefined()
  })

  it('prunes orphaned attachment blobs on close', async () => {
    const store = await loadFresh()
    const recordId = store.recordId as string
    const kept = await attachmentsRepo.addAttachment(recordId, 'kept.csv', new Blob(['a']))
    const orphan = await attachmentsRepo.addAttachment(recordId, 'old.csv', new Blob(['b']))
    store.mutate('add ref', (d) => {
      d.attachments.push({ id: kept.id, filename: kept.filename, mediatype: kept.mediatype, size: kept.size, role: 'csv' })
    })

    await store.close()

    expect(await attachmentsRepo.getAttachment(kept.id)).toBeDefined()
    expect(await attachmentsRepo.getAttachment(orphan.id)).toBeUndefined()
  })

  it('recomputes issues after mutations (debounced)', async () => {
    const store = await loadFresh()
    const a = store.addNode('text', null) as string
    const b = store.addNode('integer', null) as string
    store.updateNode(b, 'Edit name', (n) => { n.name = store.getNode(a)?.name ?? 'x' })
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(store.issues.some((i) => i.code === 'name.duplicate')).toBe(true)
    expect(store.issuesByNode.get(a)?.length).toBeGreaterThan(0)
  })
})
