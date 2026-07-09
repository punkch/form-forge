import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'
import { isContainer } from '@/core/model/types'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'
import { useFormStore } from '@/stores/form'

/**
 * Pins the addNode parent/index contract that click-to-add insertion
 * (FormEditorView.addFromPalette) relies on: append inside a container,
 * insert after a sibling by index, append at the end by default.
 */
describe('palette insertion via addNode', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.forms.clear()
    await db.snapshots.clear()
  })

  const loadFresh = async (): Promise<ReturnType<typeof useFormStore>> => {
    const record = await formsRepo.createForm(newDocument('Test'))
    const store = useFormStore()
    await store.load(record.id)
    return store
  }

  it('appends at the form end when no parent or index is given', async () => {
    const store = await loadFresh()
    const first = store.addNode('text', null)
    const second = store.addNode('integer', null)
    expect(store.doc?.children.map((n) => n.id)).toEqual([first, second])
  })

  it('appends inside a group when the group is the parent', async () => {
    const store = await loadFresh()
    const groupId = store.addNode('group', null) as string
    const inGroup = store.addNode('text', groupId)
    const group = store.getNode(groupId)
    expect(group !== null && isContainer(group) && group.children.map((n) => n.id)).toEqual([inGroup])
  })

  it('inserts after a selected sibling via the index parameter', async () => {
    const store = await loadFresh()
    const first = store.addNode('text', null)
    const last = store.addNode('integer', null)
    // Insert "after the first node" = index 1.
    const middle = store.addNode('decimal', null, 1)
    expect(store.doc?.children.map((n) => n.id)).toEqual([first, middle, last])
  })

  it('clamps an out-of-range index to an append', async () => {
    const store = await loadFresh()
    const first = store.addNode('text', null)
    const second = store.addNode('integer', null, 99)
    expect(store.doc?.children.map((n) => n.id)).toEqual([first, second])
  })

  it('an indexed insert round-trips undo/redo', async () => {
    const store = await loadFresh()
    const first = store.addNode('text', null)
    const last = store.addNode('integer', null)
    const middle = store.addNode('decimal', null, 1)
    expect(store.doc?.children.map((n) => n.id)).toEqual([first, middle, last])
    store.undo()
    expect(store.doc?.children.map((n) => n.id)).toEqual([first, last])
    store.redo()
    expect(store.doc?.children.map((n) => n.id)).toEqual([first, middle, last])
  })
})
