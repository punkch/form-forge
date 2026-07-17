import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import AttachmentsDialog from '@/components/attachments/AttachmentsDialog.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// The upload/rename/replace paths all go through the attachments repo; mock
// it so no IndexedDB blobs are involved and calls can be asserted.
const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async () => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
  renameAttachment: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

const findTestId = (wrapper: VueWrapper, id: string): ReturnType<VueWrapper['find']> =>
  wrapper.find(`[data-testid="${id}"]`)

const findAllTestId = (wrapper: VueWrapper, id: string): ReturnType<VueWrapper['findAll']> =>
  wrapper.findAll(`[data-testid="${id}"]`)

const mountDialog = (pinia: Pinia): VueWrapper =>
  mountWith(pinia, AttachmentsDialog, { global: { stubs: { teleport: true } } })

const openDialog = async (): Promise<void> => {
  useEditorStore().activeDialog = 'attachments'
  await flushPromises()
}

const csvFile = (name: string, content = 'name,label\na,A\n'): File =>
  new File([content], name, { type: 'text/csv' })

const setInputFiles = async (wrapper: VueWrapper, testid: string, files: File[]): Promise<void> => {
  const input = wrapper.find(`[data-testid="${testid}"]`)
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}

const addNode = (type: string): QuestionNode => {
  const form = useFormStore()
  const id = form.addNode(type, null) as string
  return form.getNode(id) as QuestionNode
}

describe('AttachmentsDialog', () => {
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
    useEditorStore().activeDialog = null

    repo.addAttachment.mockReset()
    repo.deleteAttachment.mockClear()
    repo.listAttachments.mockClear()
    repo.pruneOrphans.mockClear()
    repo.renameAttachment.mockReset()
    repo.renameAttachment.mockResolvedValue(undefined)
    repo.addAttachment.mockImplementation(
      async (formRecordId: string, filename: string, blob: Blob) => ({
        id: `rec-${filename}-${repo.addAttachment.mock.calls.length}`,
        formRecordId,
        filename,
        mediatype: blob.type || 'application/octet-stream',
        size: blob.size,
        blob,
      })
    )
  })

  afterEach(async () => {
    // Every mutate above arms the store's 1.5 s debounced autosave, whose
    // flushSave() reaches the real (unmocked) forms repo and console.errors
    // on failure. If that timer fires after this file's last test, the log
    // lands during worker teardown and flakes the whole run
    // (EnvironmentTeardownError: onUserConsoleLog pending). Nulling doc and
    // recordId makes a late flushSave() early-return before touching
    // persistence or the console.
    await flushPromises()
    const form = useFormStore()
    form.doc = null
    form.recordId = null
  })

  // --- Task 5: row model, reference-count badge, missing rows, open sweep --

  it('renders one row per doc.attachments entry, without reading the list through the repo', async () => {
    const form = useFormStore()
    form.doc?.attachments.push({ id: 'a1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
    form.doc?.attachments.push({ id: 'a2', filename: 'logo.png', mediatype: 'image/png', size: 5, role: 'media' })
    const wrapper = mountDialog(pinia)
    await openDialog()

    const names = findAllTestId(wrapper, 'attachment-ref-count')
    expect(names).toHaveLength(2)
    expect(repo.listAttachments).not.toHaveBeenCalled()
  })

  it('offers the eye preview on image rows but not on other media', async () => {
    const form = useFormStore()
    form.doc?.attachments.push({ id: 'a1', filename: 'photo.png', mediatype: 'image/png', size: 4, role: 'media' })
    form.doc?.attachments.push({ id: 'a2', filename: 'notes.txt', mediatype: 'text/plain', size: 1, role: 'other' })
    const wrapper = mountDialog(pinia)
    await openDialog()

    const viewButtons = findAllTestId(wrapper, 'attachment-view')
    expect(viewButtons).toHaveLength(1)
    expect(findTestId(wrapper, 'attachment-preview-back').exists()).toBe(false)
  })

  it('drills into the preview in place and backs out to the list', async () => {
    const form = useFormStore()
    form.doc?.attachments.push({ id: 'a1', filename: 'photo.png', mediatype: 'image/png', size: 4, role: 'media' })
    const wrapper = mountDialog(pinia)
    await openDialog()

    await findTestId(wrapper, 'attachment-view').trigger('click')
    // Same dialog, same activeDialog slot — the view swaps, no second modal.
    await vi.waitUntil(() => findTestId(wrapper, 'attachment-preview-back').exists())
    expect(useEditorStore().activeDialog).toBe('attachments')
    expect(findTestId(wrapper, 'attachment-view').exists()).toBe(false)
    // getAttachment is mocked to undefined here, so the body lands on the
    // missing note — proof the shared AttachmentPreview is mounted inside.
    await vi.waitUntil(() => findTestId(wrapper, 'dataset-preview-missing').exists())

    await findTestId(wrapper, 'attachment-preview-back').trigger('click')
    await vi.waitUntil(() => findTestId(wrapper, 'attachment-view').exists())
    expect(findTestId(wrapper, 'attachment-preview-back').exists()).toBe(false)
    expect(useEditorStore().activeDialog).toBe('attachments')
  })

  it('never renders two rows for a replaced filename', async () => {
    const form = useFormStore()
    form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
    const wrapper = mountDialog(pinia)
    await openDialog()
    // Simulate a replace having landed: the ref for 'sites.csv' now points at a new id.
    form.mutate('replace', (d) => {
      d.attachments = [{ id: 'new-2', filename: 'sites.csv', mediatype: 'text/csv', size: 9, role: 'csv' }]
    })
    await flushPromises()

    const rows = wrapper.findAll('.attachment-row')
    expect(rows.filter((r) => r.text().includes('sites.csv'))).toHaveLength(1)
  })

  it('shows the reference-count badge for 0, 1 and N references', async () => {
    const form = useFormStore()
    form.doc?.attachments.push({ id: 'a1', filename: 'unused.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
    form.doc?.attachments.push({ id: 'a2', filename: 'districts.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
    const q1 = addNode('select_one_from_file')
    form.updateNode(q1.id, 'set', (n) => { if (n.kind === 'question') n.itemsetFile = 'districts.csv' })
    form.doc!.choiceLists.colors = {
      name: 'colors',
      choices: [{ name: 'red', media: { image: { default: 'districts.csv' } } }],
    }
    const wrapper = mountDialog(pinia)
    await openDialog()

    const badges = findAllTestId(wrapper, 'attachment-ref-count')
    const texts = badges.map((b) => b.text())
    expect(texts.some((t) => t.includes('Not referenced'))).toBe(true)
    expect(texts.some((t) => t.includes('Used by 2 questions'))).toBe(true)
  })

  it('renders the singular badge form for exactly one reference', async () => {
    const form = useFormStore()
    form.doc?.attachments.push({ id: 'a1', filename: 'districts.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
    const q1 = addNode('select_one_from_file')
    form.updateNode(q1.id, 'set', (n) => { if (n.kind === 'question') n.itemsetFile = 'districts.csv' })
    const wrapper = mountDialog(pinia)
    await openDialog()

    expect(findTestId(wrapper, 'attachment-ref-count').text()).toBe('Used by 1 question')
  })

  it('shows a Missing row for a referenced-but-not-uploaded file, incl. the implicit csv-external default', async () => {
    const form = useFormStore()
    const q1 = addNode('select_one_from_file')
    form.updateNode(q1.id, 'set', (n) => { if (n.kind === 'question') n.itemsetFile = 'villages.csv' })
    addNode('csv-external') // name auto-generated, e.g. "csv_external" → implicit "csv_external.csv"
    const wrapper = mountDialog(pinia)
    await openDialog()

    const missingChips = findAllTestId(wrapper, 'attachment-missing')
    expect(missingChips.length).toBe(2)
    expect(wrapper.text()).toContain('villages.csv')
    // No rename/delete/preview controls on a missing row.
    expect(findAllTestId(wrapper, 'attachment-rename')).toHaveLength(0)
  })

  it('an uploaded-but-unreferenced attachment never shows the Missing chip', async () => {
    const form = useFormStore()
    form.doc?.attachments.push({ id: 'a1', filename: 'spare.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
    const wrapper = mountDialog(pinia)
    await openDialog()

    expect(findAllTestId(wrapper, 'attachment-missing')).toHaveLength(0)
  })

  it('uploading via a Missing row\'s Upload button stores the file under the referenced name and flips the row to normal', async () => {
    const form = useFormStore()
    const q1 = addNode('select_one_from_file')
    form.updateNode(q1.id, 'set', (n) => { if (n.kind === 'question') n.itemsetFile = 'villages.csv' })
    const wrapper = mountDialog(pinia)
    await openDialog()

    expect(findAllTestId(wrapper, 'attachment-missing')).toHaveLength(1)
    await findTestId(wrapper, 'attachment-upload-missing').trigger('click')
    await setInputFiles(wrapper, 'attachment-replace-input', [csvFile('export.csv')])

    expect(repo.addAttachment).toHaveBeenCalledWith('r1', 'villages.csv', expect.any(File))
    expect(form.doc?.attachments.map((a) => a.filename)).toEqual(['villages.csv'])
    expect(findAllTestId(wrapper, 'attachment-missing')).toHaveLength(0)
    expect(findTestId(wrapper, 'attachment-stored-as').exists()).toBe(true)
    expect(findTestId(wrapper, 'attachment-stored-as').text()).toContain('villages.csv')
    expect(findTestId(wrapper, 'attachment-stored-as').text()).toContain('export.csv')
  })

  it('opening the dialog triggers the orphan sweep exactly once', async () => {
    mountDialog(pinia)
    expect(repo.pruneOrphans).not.toHaveBeenCalled()
    await openDialog()
    expect(repo.pruneOrphans).toHaveBeenCalledTimes(1)
  })

  // --- Task 6: rename modal ------------------------------------------------

  describe('rename', () => {
    const setupAttachedQuestion = (): QuestionNode => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'a1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const q = addNode('select_one_from_file')
      form.updateNode(q.id, 'set', (n) => { if (n.kind === 'question') n.itemsetFile = 'sites.csv' })
      return q
    }

    it('opens the modal prefilled with the current stem and a locked extension', async () => {
      setupAttachedQuestion()
      const wrapper = mountDialog(pinia)
      await openDialog()

      await findTestId(wrapper, 'attachment-rename').trigger('click')
      await flushPromises()

      const stemInput = findTestId(wrapper, 'rename-attachment-stem')
      expect((stemInput.element as HTMLInputElement).value).toBe('sites')
      expect(wrapper.find('[data-testid="rename-attachment-dialog"]').text()).toContain('.csv')
    })

    it('rejects an empty stem, a stem with a separator, and a collision — without closing or mutating', async () => {
      const form = useFormStore()
      setupAttachedQuestion()
      form.doc?.attachments.push({ id: 'a2', filename: 'villages.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()
      await findAllTestId(wrapper, 'attachment-rename')[0].trigger('click')
      await flushPromises()

      await findTestId(wrapper, 'rename-attachment-stem').setValue('')
      expect(findTestId(wrapper, 'rename-attachment-error').exists()).toBe(true)
      expect(findTestId(wrapper, 'rename-attachment-confirm').attributes('disabled')).toBeDefined()

      await findTestId(wrapper, 'rename-attachment-stem').setValue('a/b')
      expect(findTestId(wrapper, 'rename-attachment-error').exists()).toBe(true)

      await findTestId(wrapper, 'rename-attachment-stem').setValue('villages')
      expect(findTestId(wrapper, 'rename-attachment-error').exists()).toBe(true)

      await findTestId(wrapper, 'rename-attachment-confirm').trigger('click')
      await flushPromises()
      expect(repo.renameAttachment).not.toHaveBeenCalled()
      expect(form.doc?.attachments.map((a) => a.filename).sort()).toEqual(['sites.csv', 'villages.csv'])
      expect(findTestId(wrapper, 'rename-attachment-dialog').exists()).toBe(true) // still open
    })

    it('confirms a valid rename: repo call, doc ref, itemsetFile, and undo restores both', async () => {
      const form = useFormStore()
      const q = setupAttachedQuestion()
      const wrapper = mountDialog(pinia)
      await openDialog()
      await findTestId(wrapper, 'attachment-rename').trigger('click')
      await flushPromises()

      await findTestId(wrapper, 'rename-attachment-stem').setValue('villages')
      await findTestId(wrapper, 'rename-attachment-confirm').trigger('click')
      await flushPromises()

      expect(repo.renameAttachment).toHaveBeenCalledWith('a1', 'villages.csv')
      expect(form.doc?.attachments.map((a) => a.filename)).toEqual(['villages.csv'])
      expect((form.getNode(q.id) as QuestionNode).itemsetFile).toBe('villages.csv')

      form.undo()
      expect(form.doc?.attachments.map((a) => a.filename)).toEqual(['sites.csv'])
      expect((form.getNode(q.id) as QuestionNode).itemsetFile).toBe('sites.csv')
    })

    it('materializes an implicit csv-external reference into an explicit itemsetFile on rename', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'a1', filename: 'fuel_prices.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const q = addNode('csv-external')
      form.updateNode(q.id, 'rename node', (n) => { n.name = 'fuel_prices' })
      expect(q.itemsetFile).toBeUndefined()
      const wrapper = mountDialog(pinia)
      await openDialog()
      await findTestId(wrapper, 'attachment-rename').trigger('click')
      await flushPromises()

      await findTestId(wrapper, 'rename-attachment-stem').setValue('prices')
      await findTestId(wrapper, 'rename-attachment-confirm').trigger('click')
      await flushPromises()

      expect((form.getNode(q.id) as QuestionNode).itemsetFile).toBe('prices.csv')
    })
  })

  // --- Task 7: per-row replace ---------------------------------------------

  describe('per-row replace', () => {
    it('replacing with a same-named file shows no stored-as notice and does not delete the superseded record', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await findTestId(wrapper, 'attachment-replace').trigger('click')
      await setInputFiles(wrapper, 'attachment-replace-input', [csvFile('sites.csv')])

      expect(repo.deleteAttachment).not.toHaveBeenCalled()
      expect(findTestId(wrapper, 'attachment-stored-as').exists()).toBe(false)
      const refs = form.doc?.attachments.filter((a) => a.filename === 'sites.csv') ?? []
      expect(refs).toHaveLength(1)
      expect(refs[0].id).not.toBe('old-1')
    })

    it('replacing with a differently-named file shows the stored-as notice under that row only, keeping the filename', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      form.doc?.attachments.push({ id: 'old-2', filename: 'logo.png', mediatype: 'image/png', size: 5, role: 'media' })
      const q = addNode('select_one_from_file')
      form.updateNode(q.id, 'set', (n) => { if (n.kind === 'question') n.itemsetFile = 'sites.csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await findAllTestId(wrapper, 'attachment-replace')[0].trigger('click')
      await setInputFiles(wrapper, 'attachment-replace-input', [csvFile('export_2026.csv')])

      const notice = findTestId(wrapper, 'attachment-stored-as')
      expect(notice.exists()).toBe(true)
      expect(notice.text()).toContain('sites.csv')
      expect(notice.text()).toContain('export_2026.csv')
      expect(form.doc?.attachments.map((a) => a.filename).sort()).toEqual(['logo.png', 'sites.csv'])
      expect((form.getNode(q.id) as QuestionNode).itemsetFile).toBe('sites.csv')
    })

    it('undo after a per-row replace restores the prior record id under the same filename', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await findTestId(wrapper, 'attachment-replace').trigger('click')
      await setInputFiles(wrapper, 'attachment-replace-input', [csvFile('sites.csv')])
      expect(form.doc?.attachments.map((a) => a.id)).not.toEqual(['old-1'])

      form.undo()
      expect(form.doc?.attachments.map((a) => a.id)).toEqual(['old-1'])
    })
  })

  // --- Task 8: upload-conflict handling ------------------------------------

  describe('upload conflict', () => {
    it('shows the conflict dialog for a colliding upload; Replace updates the row in place', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await setInputFiles(wrapper, 'attachment-file-input', [csvFile('sites.csv')])

      const conflict = findTestId(wrapper, 'attachment-conflict-dialog')
      expect(conflict.text()).toContain('sites.csv')

      await findTestId(wrapper, 'attachment-conflict-replace').trigger('click')
      await flushPromises()

      expect(form.doc?.attachments.map((a) => a.filename)).toEqual(['sites.csv'])
      expect(form.doc?.attachments[0].id).not.toBe('old-1')
    })

    it('Keep both suffixes the new file to the first free slot', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await setInputFiles(wrapper, 'attachment-file-input', [csvFile('sites.csv')])
      await findTestId(wrapper, 'attachment-conflict-keep-both').trigger('click')
      await flushPromises()

      expect(form.doc?.attachments.map((a) => a.filename).sort()).toEqual(['sites-2.csv', 'sites.csv'])
    })

    it('Skip leaves the document unchanged', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await setInputFiles(wrapper, 'attachment-file-input', [csvFile('sites.csv')])
      await findTestId(wrapper, 'attachment-conflict-skip').trigger('click')
      await flushPromises()

      expect(form.doc?.attachments).toEqual([{ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' }])
    })

    it('a batch with two collisions: non-conflicting files upload immediately, and "apply to all" resolves the rest', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      form.doc?.attachments.push({ id: 'old-2', filename: 'villages.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await setInputFiles(wrapper, 'attachment-file-input', [
        csvFile('sites.csv'),
        csvFile('logo.png', 'binary'),
        csvFile('villages.csv'),
      ])

      // The non-conflicting file uploaded immediately; the dialog shows the first conflict.
      expect(form.doc?.attachments.some((a) => a.filename === 'logo.png')).toBe(true)
      expect(findTestId(wrapper, 'attachment-conflict-dialog').text()).toContain('sites.csv')

      await findTestId(wrapper, 'attachment-conflict-apply-all').find('input[type=checkbox]').setValue(true)
      await findTestId(wrapper, 'attachment-conflict-keep-both').trigger('click')
      await flushPromises()

      const filenames = form.doc?.attachments.map((a) => a.filename).sort()
      expect(filenames).toEqual(['logo.png', 'sites-2.csv', 'sites.csv', 'villages-2.csv', 'villages.csv'])
    })

    it('"apply to all" with Skip resolves the remaining conflicts without adding anything', async () => {
      const form = useFormStore()
      form.doc?.attachments.push({ id: 'old-1', filename: 'sites.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      form.doc?.attachments.push({ id: 'old-2', filename: 'villages.csv', mediatype: 'text/csv', size: 5, role: 'csv' })
      const wrapper = mountDialog(pinia)
      await openDialog()

      await setInputFiles(wrapper, 'attachment-file-input', [
        csvFile('sites.csv'),
        csvFile('villages.csv'),
      ])

      await findTestId(wrapper, 'attachment-conflict-apply-all').find('input[type=checkbox]').setValue(true)
      await findTestId(wrapper, 'attachment-conflict-skip').trigger('click')
      await flushPromises()

      // Nothing added, nothing replaced — both original ids survive.
      expect(form.doc?.attachments.map((a) => a.id).sort()).toEqual(['old-1', 'old-2'])
    })
  })
})
