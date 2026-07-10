import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'

import { useFormStore } from './form'

// NOTE: fake timers deadlock fake-indexeddb (it schedules internally), so
// these tests wait out the real dataset-refresh (250ms) and validation
// (300ms) debounces.
const settle = async (ms = 700): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, ms))

describe('form store — dataset columns', () => {
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

  const csvFile = (name: string, content: string): File =>
    new File([content], name, { type: 'text/csv' })

  it('parses uploaded csv columns and validates value/label params against them', async () => {
    const store = await loadFresh()
    const { attachFile } = useAttachmentUpload()

    const id = store.addNode('select_one_from_file', null) as string
    store.updateNode(id, 'set file', (n) => {
      if (n.kind === 'question') n.itemsetFile = 'villages.csv'
    })
    await attachFile(csvFile('villages.csv', 'name,label,district\nv1,Village 1,d1\n'))
    await settle()

    // Columns become available under the referenced filename...
    expect(store.datasetColumnsByFilename.get('villages.csv'))
      .toEqual(['name', 'label', 'district'])
    // ...and the defaults (name/label) exist, so no dataset issues yet.
    expect(store.issues.filter((i) => i.code.startsWith('dataset.'))).toEqual([])

    // A misspelled value parameter produces a warning pointing at the node.
    store.updateNode(id, 'set param', (n) => { n.body.parameters = { value: 'nmae' } })
    await settle(500)
    const issue = store.issues.find((i) => i.code === 'dataset.unknown-column')
    expect(issue).toMatchObject({ severity: 'warning', scope: { nodeId: id } })
    expect(store.issuesByNode.get(id)?.some((i) => i.code === 'dataset.unknown-column')).toBe(true)

    // Fixing the parameter clears it again.
    store.updateNode(id, 'fix param', (n) => { n.body.parameters = { value: 'district' } })
    await settle(500)
    expect(store.issues.some((i) => i.code === 'dataset.unknown-column')).toBe(false)
  })

  it('keeps unparseable datasets silent (null columns)', async () => {
    const store = await loadFresh()
    const { attachFile } = useAttachmentUpload()

    const id = store.addNode('select_one_from_file', null) as string
    store.updateNode(id, 'set file', (n) => {
      if (n.kind === 'question') n.itemsetFile = 'sites.geojson'
    })
    store.updateNode(id, 'set param', (n) => { n.body.parameters = { value: 'whatever' } })
    await attachFile(new File(['{ not json'], 'sites.geojson', { type: 'application/geo+json' }))
    await settle()

    expect(store.datasetColumnsByFilename.get('sites.geojson')).toBeNull()
    expect(store.issues.some((i) => i.code.startsWith('dataset.'))).toBe(false)
  })

  it('re-parses when a replacement upload mints a new attachment id', async () => {
    const store = await loadFresh()
    const { attachFile } = useAttachmentUpload()

    const id = store.addNode('select_one_from_file', null) as string
    store.updateNode(id, 'set file', (n) => {
      if (n.kind === 'question') n.itemsetFile = 'villages.csv'
    })
    await attachFile(csvFile('villages.csv', 'name,label\nv1,V1\n'))
    await settle()
    expect(store.datasetColumnsByFilename.get('villages.csv')).toEqual(['name', 'label'])

    await attachFile(csvFile('villages.csv', 'name,label,region\nv1,V1,r1\n'))
    await settle()
    expect(store.datasetColumnsByFilename.get('villages.csv')).toEqual(['name', 'label', 'region'])

    const node = store.getNode(id) as QuestionNode
    expect(node.itemsetFile).toBe('villages.csv')
  })
})
