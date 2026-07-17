import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import ImportDialog from '@/components/importexport/ImportDialog.vue'
import { useImportLanding } from '@/composables/useImportLanding'
import { exportZip } from '@/core/export/zip'
import { newDocument } from '@/core/model/factory'
import type { FormDocument } from '@/core/model/types'
import { buildWorkspaceArchive } from '@/core/workspace/archive'
import { db } from '@/persistence/db'
import type { FormRecord } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'

import { freshPinia, mountWith } from './helpers'

// useConfirm auto-accepts so the danger "replace" path runs without a mounted
// ConfirmDialog — same seam import-from-central.spec.ts uses.
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: (opts: { accept?: () => void }) => opts.accept?.() }),
}))
// spy: true keeps the real implementations but lets single tests inject
// failures (the land-error path) and assert call counts.
vi.mock('@/persistence/forms-repo', { spy: true })

const FORM_ID = 'zip_bundle_form'

/** A document with one attachment ref, ready for `exportZip`. */
const bundleDoc = (formId = FORM_ID): FormDocument => {
  const d = newDocument('Zip Bundle Form')
  d.settings.formId = formId
  d.settings.version = '1'
  d.attachments = [{ id: 'a1', filename: 'sites.csv', mediatype: 'text/csv', size: 8, role: 'csv' }]
  return d
}

/** A per-form ZIP bundle (form.xml + media/sites.csv), matching `exportZip`'s layout. */
const bundleZipFile = async (formId = FORM_ID): Promise<File> => {
  const blobs = new Map<string, Blob | Uint8Array>([['a1', new Blob(['a,b\n1,2\n'], { type: 'text/csv' })]])
  const { data } = await exportZip(bundleDoc(formId), blobs, 'xform')
  return new File([data as BlobPart], 'bundle.zip')
}

/** A `.formforge.zip` workspace archive — the deliberate "wrong dialog" case. */
const workspaceArchiveZipFile = async (): Promise<File> => {
  const data = await buildWorkspaceArchive([], '0.0.0-test', new Date(0).toISOString())
  return new File([data as BlobPart], 'workspace.zip')
}

const Empty = defineComponent({ template: '<div />' })

const makeRouter = (): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'library', component: Empty },
      { path: '/editor/:formId', name: 'editor', component: Empty },
    ],
  })

const findId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

const mountDialog = (router: Router): VueWrapper =>
  mountWith(freshPinia(), ImportDialog, {
    props: { visible: true },
    global: {
      stubs: { teleport: true },
      plugins: [router],
    },
  })

const dropFile = async (wrapper: VueWrapper, file: File): Promise<void> => {
  await vi.waitUntil(() => findId(wrapper, 'import-dropzone').exists())
  await findId(wrapper, 'import-dropzone').trigger('drop', { dataTransfer: { files: [file] } })
  await vi.waitUntil(() => findId(wrapper, 'import-report').exists())
}

beforeEach(async () => {
  await db.forms.clear()
  await db.attachments.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ImportDialog — ZIP bundles', () => {
  it('lands a bundle zip as a form with its attachment records, then navigates to the editor', async () => {
    const router = makeRouter()
    const push = vi.spyOn(router, 'push')
    const wrapper = mountDialog(router)

    await dropFile(wrapper, await bundleZipFile())
    await findId(wrapper, 'import-confirm').trigger('click')
    await flushPromises()

    const forms = await formsRepo.listForms()
    expect(forms).toHaveLength(1)
    expect(forms[0].formId).toBe(FORM_ID)

    const attachments = await db.attachments.where('formRecordId').equals(forms[0].id).toArray()
    expect(attachments).toHaveLength(1)
    expect(attachments[0].filename).toBe('sites.csv')

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'editor', params: { formId: forms[0].id } })
    )
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })

  it('offers copy vs replace on a formId collision, and copy adds a second form', async () => {
    const seed = newDocument('Existing Survey')
    seed.settings.formId = FORM_ID
    const existing = await formsRepo.createForm(seed)

    const wrapper = mountDialog(makeRouter())
    await dropFile(wrapper, await bundleZipFile())

    await findId(wrapper, 'import-confirm').trigger('click')
    await flushPromises()
    expect(findId(wrapper, 'import-collision').exists()).toBe(true)
    expect(findId(wrapper, 'import-confirm').exists()).toBe(false)

    await findId(wrapper, 'import-collision-copy').trigger('click')
    await flushPromises()

    const forms = await formsRepo.listForms()
    expect(forms).toHaveLength(2)
    expect(forms.some((f) => f.id === existing.id)).toBe(true)
  })

  it('replaces the existing form in place on collision, keeping its record id', async () => {
    const seed = newDocument('Existing Survey')
    seed.settings.formId = FORM_ID
    const existing = await formsRepo.createForm(seed)

    const router = makeRouter()
    const push = vi.spyOn(router, 'push')
    const wrapper = mountDialog(router)
    await dropFile(wrapper, await bundleZipFile())

    await findId(wrapper, 'import-confirm').trigger('click')
    await flushPromises()
    await findId(wrapper, 'import-collision-replace').trigger('click')
    await flushPromises()

    const forms = await formsRepo.listForms()
    expect(forms).toHaveLength(1)
    expect(forms[0].id).toBe(existing.id)
    // The record was overwritten with the imported document.
    expect(forms[0].title).toBe('Zip Bundle Form')
    const attachments = await db.attachments.where('formRecordId').equals(existing.id).toArray()
    expect(attachments).toHaveLength(1)
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'editor', params: { formId: existing.id } })
    )
  })

  it('rejects a workspace archive with a pointer to Settings, and keeps import disabled', async () => {
    const wrapper = mountDialog(makeRouter())
    await dropFile(wrapper, await workspaceArchiveZipFile())

    expect(findId(wrapper, 'import-report').text()).toContain('workspace archive')
    expect((findId(wrapper, 'import-confirm').element as HTMLButtonElement).disabled).toBe(true)
    expect(await formsRepo.listForms()).toHaveLength(0)
  })

  it('surfaces a landing failure in the dialog and keeps it open', async () => {
    vi.mocked(formsRepo.createFormWithArchiveAttachments)
      .mockRejectedValueOnce(new Error('quota exceeded'))
    const wrapper = mountDialog(makeRouter())
    await dropFile(wrapper, await bundleZipFile())

    await findId(wrapper, 'import-confirm').trigger('click')
    await flushPromises()

    expect(findId(wrapper, 'import-landing-error').text()).toContain('quota exceeded')
    // The dialog never closed and nothing landed.
    expect(wrapper.emitted('update:visible')).toBeUndefined()
    expect(await formsRepo.listForms()).toHaveLength(0)
  })
})

describe('useImportLanding', () => {
  it('skips the collision lookup entirely for an empty formId', async () => {
    const record = await formsRepo.createForm(newDocument('Seeded'))
    vi.mocked(formsRepo.listForms).mockClear()

    const onLanded = vi.fn()
    const { landOrCollide, collisionPending } = useImportLanding({
      isActive: () => true,
      onLanded,
      onError: vi.fn(),
    })
    await landOrCollide('', async () => record)

    expect(formsRepo.listForms).not.toHaveBeenCalled()
    expect(collisionPending.value).toBe(false)
    expect(onLanded).toHaveBeenCalledWith(record)
  })

  it('ignores re-entrant land calls while one is in flight (double-click guard)', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const onLanded = vi.fn()
    const { land, landing } = useImportLanding({ isActive: () => true, onLanded, onError: vi.fn() })

    const create = async (): Promise<FormRecord> => {
      await gate
      return await formsRepo.createForm(newDocument('Once'))
    }
    const first = land(create)
    const second = land(create)
    expect(landing.value).toBe(true)

    release()
    await Promise.all([first, second])

    expect(await formsRepo.listForms()).toHaveLength(1)
    expect(onLanded).toHaveBeenCalledTimes(1)
    expect(landing.value).toBe(false)
  })
})
