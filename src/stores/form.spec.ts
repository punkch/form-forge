import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { buildNodesPayload } from '@/core/clipboard/payload'
import { newDocument } from '@/core/model/factory'
import { gatherNodesAfter } from '@/core/model/multi-ops'
import { flatten } from '@/core/model/ops'
import { DEFAULT_LANG } from '@/core/model/types'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'

import { backendCases } from '../../tests/helpers/backends'
import { doc, group, q } from '../../tests/helpers/doc-builders'
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

  it('sweepOrphanAttachments protects a superseded record still reachable via undo history', async () => {
    const store = await loadFresh()
    const { attachFile } = useAttachmentUpload()
    const csv = (): File => new File(['name,label\n'], 'data.csv', { type: 'text/csv' })
    const first = await attachFile(csv())
    await attachFile(csv()) // re-upload under the same name → replace; supersedes `first`

    await store.sweepOrphanAttachments()

    expect(await attachmentsRepo.getAttachment(first?.id as string)).toBeDefined()
  })

  it('sweepOrphanAttachments protects a record referenced only by a redoStack entry', async () => {
    const store = await loadFresh()
    const { attachFile } = useAttachmentUpload()
    const csv = (): File => new File(['name,label\n'], 'data.csv', { type: 'text/csv' })
    await attachFile(csv())
    const second = await attachFile(csv())

    store.undo() // doc reverts to the first ref; `second` is now reachable only via redoStack

    await store.sweepOrphanAttachments()

    expect(await attachmentsRepo.getAttachment(second?.id as string)).toBeDefined()
  })

  it('sweepOrphanAttachments removes a record once neither the doc nor undo/redo history references it', async () => {
    const store = await loadFresh()
    const { attachFile } = useAttachmentUpload()
    const csv = (): File => new File(['name,label\n'], 'data.csv', { type: 'text/csv' })
    const first = await attachFile(csv())
    const second = await attachFile(csv())

    store.undo() // doc=[first]; redoStack holds the only remaining reference to `second`
    store.addNode('text', null) // a fresh mutate clears redoStack, discarding that last reference

    await store.sweepOrphanAttachments()

    expect(await attachmentsRepo.getAttachment(first?.id as string)).toBeDefined()
    expect(await attachmentsRepo.getAttachment(second?.id as string)).toBeUndefined()
  })

  it('load merges a mixed record (load-time migration) and schedules a save', async () => {
    const FR = 'French (fr)'
    const mixed = doc({
      title: 'T',
      formId: 't',
      languages: [FR],
      children: [
        q('text', 'a', 'Moved'), // sentinel-only label → moves to FR
        q('text', 'b', undefined, {
          label: { [DEFAULT_LANG]: 'Old', [FR]: 'New' }, // conflict → both kept
        }),
      ],
    })
    const record = await formsRepo.createForm(mixed)
    const store = useFormStore()
    await store.load(record.id)

    expect(store.doc?.children[0].label).toEqual({ [FR]: 'Moved' })
    expect(store.doc?.children[1].label).toEqual({ [DEFAULT_LANG]: 'Old', [FR]: 'New' })
    // The merge is a migration, not an edit: no undo entry, but it persists.
    expect(store.canUndo).toBe(false)
    expect(store.saveState).toBe('dirty')
    await store.flushSave()
    const saved = await formsRepo.getForm(record.id)
    expect(saved?.doc.children[0].label).toEqual({ [FR]: 'Moved' })
  })

  it('load keeps a clean record saved with an empty undo stack', async () => {
    const store = await loadFresh()
    expect(store.saveState).toBe('saved')
    expect(store.canUndo).toBe(false)
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

  describe('multi-select / clipboard actions', () => {
    /**
     * Drains the undo stack while counting entries, then replays redo the
     * same number of times to restore state exactly. The only way to get an
     * exact undo-depth reading through the store's public canUndo/undo/redo
     * surface (there's no exposed stack length), and — since undo/redo are
     * exact snapshot inverses — leaves the store's state untouched.
     */
    const undoDepth = (store: ReturnType<typeof useFormStore>): number => {
      let count = 0
      while (store.canUndo) { store.undo(); count++ }
      for (let i = 0; i < count; i++) store.redo()
      return count
    }

    it('copyNodes adds zero undo entries', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const b = store.addNode('text', null) as string
      const before = undoDepth(store)

      const payload = store.copyNodes([a, b])

      expect(payload?.nodes.map((n) => n.id)).toEqual([a, b])
      expect(undoDepth(store)).toBe(before)
    })

    it('copyNodes returns null for an empty selection', async () => {
      const store = await loadFresh()
      expect(store.copyNodes([])).toBeNull()
    })

    it('cutNodes removes the selection in exactly one undo entry, restored by a single undo', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const b = store.addNode('text', null) as string
      const c = store.addNode('text', null) as string
      const before = undoDepth(store)

      const payload = store.cutNodes([a, c])

      expect(payload?.nodes.map((n) => n.id)).toEqual([a, c])
      expect(store.doc?.children.map((n) => n.id)).toEqual([b])
      expect(undoDepth(store)).toBe(before + 1)

      store.undo()
      expect(store.doc?.children.map((n) => n.id)).toEqual([a, b, c])
    })

    it('cutNodes early-returns before mutate on an empty selection', async () => {
      const store = await loadFresh()
      const before = undoDepth(store)
      expect(store.cutNodes([])).toBeNull()
      expect(undoDepth(store)).toBe(before)
    })

    it('deleteNodes removes the selection in exactly one undo entry, restored by a single undo', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const b = store.addNode('text', null) as string
      const before = undoDepth(store)

      store.deleteNodes([a])

      expect(store.doc?.children.map((n) => n.id)).toEqual([b])
      expect(undoDepth(store)).toBe(before + 1)

      store.undo()
      expect(store.doc?.children.map((n) => n.id)).toEqual([a, b])
    })

    it('deleteNodes early-returns before mutate on an empty/unknown selection', async () => {
      const store = await loadFresh()
      const before = undoDepth(store)
      store.deleteNodes(['does-not-exist'])
      expect(undoDepth(store)).toBe(before)
    })

    it('pasteNodes inserts in exactly one undo entry, restored by a single undo', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const payload = store.copyNodes([a])!
      const before = undoDepth(store)

      const result = store.pasteNodes(payload)

      expect(result?.insertedIds).toHaveLength(1)
      expect(store.doc?.children).toHaveLength(2)
      expect(undoDepth(store)).toBe(before + 1)

      store.undo()
      expect(store.doc?.children).toHaveLength(1)
    })

    it('pasteNodes falls back to root-append before mutate when the target parent is missing or not a container', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const leaf = store.addNode('integer', null) as string // not a container
      const payload = store.copyNodes([a])!

      const missingTarget = store.pasteNodes(payload, { parentId: 'does-not-exist' })
      expect(missingTarget).not.toBeNull()
      expect(store.doc?.children.at(-1)?.id).toBe(missingTarget?.insertedIds[0])

      const nonContainerTarget = store.pasteNodes(payload, { parentId: leaf })
      expect(nonContainerTarget).not.toBeNull()
      expect(store.doc?.children.at(-1)?.id).toBe(nonContainerTarget?.insertedIds[0])
    })

    it('pasteNodes returns null before mutate for an empty payload', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const payload = store.copyNodes([a])!
      const before = undoDepth(store)

      expect(store.pasteNodes({ ...payload, nodes: [] })).toBeNull()
      expect(undoDepth(store)).toBe(before)
    })

    it('cross-doc paste remaps a source-only language onto the target primary and keeps the two-clean-shapes invariant', async () => {
      const FR = 'French (fr)'
      const sourceDoc = doc({
        title: 'Source',
        formId: 'src',
        languages: [FR],
        defaultLanguage: FR,
        children: [q('text', 'src_a', undefined, { label: { [FR]: 'Bonjour' } })],
      })
      const payload = buildNodesPayload(sourceDoc, [sourceDoc.children[0].id])!

      const store = await loadFresh() // target doc: zero languages (Shape A)
      const result = store.pasteNodes(payload)

      expect(result?.dormantLanguages).toEqual([])
      const pasted = store.doc?.children.find((n) => n.id === result?.insertedIds[0])
      expect(pasted?.label).toEqual({ [DEFAULT_LANG]: 'Bonjour' })
    })

    it('insertTemplate appends the whole template tree at doc end in one undo entry', async () => {
      const store = await loadFresh()
      const existing = store.addNode('text', null) as string
      const before = undoDepth(store)

      const templateDoc = doc({
        title: 'Starter',
        formId: 'starter',
        children: [q('text', 't_a', 'A'), group('t_g', 'G', [q('text', 't_b', 'B')])],
      })

      const result = store.insertTemplate(templateDoc)

      expect(result?.insertedIds).toHaveLength(2)
      expect(store.doc?.children.map((n) => n.id)).toEqual([existing, ...result!.insertedIds])
      expect(undoDepth(store)).toBe(before + 1)

      store.undo()
      expect(store.doc?.children.map((n) => n.id)).toEqual([existing])
    })

    it('insertTemplate returns null before mutate for an empty template', async () => {
      const store = await loadFresh()
      const before = undoDepth(store)
      const emptyTemplate = doc({ title: 'Empty', formId: 'empty', children: [] })
      expect(store.insertTemplate(emptyTemplate)).toBeNull()
      expect(undoDepth(store)).toBe(before)
    })

    it('moveSelectionBy moves the whole top-most selection as one block, one undo entry', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const b = store.addNode('text', null) as string
      const c = store.addNode('text', null) as string
      const before = undoDepth(store)

      store.moveSelectionBy([b, c], -1)

      expect(store.doc?.children.map((n) => n.id)).toEqual([b, c, a])
      expect(undoDepth(store)).toBe(before + 1)

      store.undo()
      expect(store.doc?.children.map((n) => n.id)).toEqual([a, b, c])
    })

    it('moveSelectionBy aborts (zero undo entries) when a top-most node is already at its list edge', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const b = store.addNode('text', null) as string
      const before = undoDepth(store)

      store.moveSelectionBy([a, b], -1) // a is already first — aborts the WHOLE op

      expect(store.doc?.children.map((n) => n.id)).toEqual([a, b])
      expect(undoDepth(store)).toBe(before)
    })

    it('indentSelection indents the block into the preceding container, one undo entry', async () => {
      const store = await loadFresh()
      const groupId = store.addNode('group', null) as string
      const a = store.addNode('text', null) as string
      const b = store.addNode('text', null) as string
      const before = undoDepth(store)

      store.indentSelection([a, b])

      const groupNode = store.doc?.children[0]
      expect(store.doc?.children.map((n) => n.id)).toEqual([groupId])
      expect(groupNode !== undefined && 'children' in groupNode && groupNode.children.map((n) => n.id)).toEqual([a, b])
      expect(undoDepth(store)).toBe(before + 1)

      store.undo()
      expect(store.doc?.children.map((n) => n.id)).toEqual([groupId, a, b])
    })

    it('indentSelection aborts when the first selected node has no preceding container', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const before = undoDepth(store)

      store.indentSelection([a])

      expect(store.doc?.children.map((n) => n.id)).toEqual([a])
      expect(undoDepth(store)).toBe(before)
    })

    it('outdentSelection outdents every node that has a parent, one undo entry', async () => {
      const store = await loadFresh()
      const groupId = store.addNode('group', null) as string
      const a = store.addNode('text', groupId) as string
      const b = store.addNode('text', groupId) as string
      const before = undoDepth(store)

      store.outdentSelection([a, b])

      expect(store.doc?.children.map((n) => n.id)).toEqual([groupId, a, b])
      expect(undoDepth(store)).toBe(before + 1)

      store.undo()
      const groupNode = store.doc?.children[0]
      expect(groupNode !== undefined && 'children' in groupNode && groupNode.children.map((n) => n.id)).toEqual([a, b])
    })

    it('outdentSelection aborts when nothing in the selection has a parent', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const before = undoDepth(store)

      store.outdentSelection([a])

      expect(store.doc?.children.map((n) => n.id)).toEqual([a])
      expect(undoDepth(store)).toBe(before)
    })

    it('drag transaction: begin -> vdp-style splice + gatherNodesAfter -> end collapses to ONE undo entry', async () => {
      const store = await loadFresh()
      const a = store.addNode('text', null) as string
      const groupId = store.addNode('group', null) as string
      const b = store.addNode('text', null) as string
      const c = store.addNode('text', null) as string
      // Selection [a, c, b] dragged onto b (the anchor) — simulates a
      // multi-drag gather: vdp's own splice of the dragged card already
      // landed by the time onDragEnd fires; this test exercises the
      // gather step store-side, bracketed by begin/endTransaction exactly
      // as NodeList.vue's onDragEnd does (never via mutate()).
      const before = undoDepth(store)

      store.beginTransaction('Move question')
      gatherNodesAfter(store.doc!, [a, c, b], b)
      store.endTransaction()

      expect(undoDepth(store)).toBe(before + 1)
      expect(store.doc?.children.map((n) => n.id)).toEqual([groupId, b, a, c])

      store.undo()
      expect(store.doc?.children.map((n) => n.id)).toEqual([a, groupId, b, c])
    })
  })
})

// Regression coverage for the same-filename re-upload save-poisoning bug: a
// re-upload under an existing filename, while another attachment is already
// present, used to leave a nested reactive Proxy inside doc.attachments —
// structuredClone() (inside snapshotDoc) then threw DataCloneError on every
// following flushSave/mutate/undo/redo, for the rest of the session. Runs on
// both backends since the observable symptom (save/mutate throwing) is
// store-level, not backend-specific.
describe.each(backendCases)('form store attachment save resilience ($name backend)', ({ setup }) => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await setup()
  })

  it('a same-name re-upload with another attachment present does not poison saving', async () => {
    const record = await formsRepo.createForm(newDocument('Test'))
    const store = useFormStore()
    await store.load(record.id)
    const { attachFile } = useAttachmentUpload()

    const sitesA = new File(['name,label\na,A\n'], 'sites.csv', { type: 'text/csv' })
    const logo = new File(['x'], 'logo.png', { type: 'image/png' })
    const sitesB = new File(['name,label\nb,B\n'], 'sites.csv', { type: 'text/csv' })

    await attachFile(sitesA)
    await attachFile(logo)
    const second = await attachFile(sitesB) // repro: re-upload under an existing filename

    expect(store.doc?.attachments.map((a) => a.filename).slice().sort()).toEqual(['logo.png', 'sites.csv'])
    const sitesRef = store.doc?.attachments.find((a) => a.filename === 'sites.csv')
    expect(sitesRef?.id).toBe(second?.id)

    await store.flushSave()
    expect(store.saveState).toBe('saved')

    // A further, unrelated mutation must not throw and must save normally.
    expect(() => store.addNode('text', null)).not.toThrow()
    expect(store.saveState).toBe('dirty')
    await store.flushSave()
    expect(store.saveState).toBe('saved')
  })
})
