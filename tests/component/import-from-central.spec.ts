import { flushPromises, type VueWrapper } from '@vue/test-utils'
import ToastService from 'primevue/toastservice'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import LibraryCentralDrawer from '@/components/central/LibraryCentralDrawer.vue'
import { newDocument } from '@/core/model/factory'
import type { FormDocument } from '@/core/model/types'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'

import { freshPinia, mountWith } from './helpers'

// --- Seams -------------------------------------------------------------------

// The three shared pickers are replaced with buttons that emit a fixed id — the
// import flow only needs server/project/form ids to reach import.ts.
const pickerStub = vi.hoisted(() => (testid: string, value: unknown) => {
  const lit = typeof value === 'string' ? `'${value}'` : String(value)
  return {
    default: {
      emits: ['update:modelValue', 'error'],
      template: `<button data-testid="${testid}" @click="$emit('update:modelValue', ${lit})">pick</button>`,
    },
  }
})
vi.mock('@/components/central/CentralServerPicker.vue', () => pickerStub('stub-pick-server', 'srv-1'))
vi.mock('@/components/central/CentralProjectPicker.vue', () => pickerStub('stub-pick-project', 5))
vi.mock('@/components/central/CentralFormPicker.vue', () => pickerStub('stub-pick-form', 'central_form'))

// useConfirm auto-accepts so the danger "replace" path runs without a mounted
// ConfirmDialog.
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: (opts: { accept?: () => void }) => opts.accept?.() }),
}))

// The fingerprint (seeded onto the origin target) is stubbed — freshness has its
// own spec; here we only assert the target is seeded.
vi.mock('@/core/central/fingerprint', () => ({ contentFingerprint: vi.fn(async () => 'hash-imported') }))

// The Central store is faked: importFormFromCentral returns a canned pulled
// form; the vault reads unlocked so the drawer shows the browse step.
const centralMock = vi.hoisted(() => ({
  hasServers: true,
  isUnlocked: true,
  importFormFromCentral: vi.fn(),
  upsertTarget: vi.fn(async () => ({})),
}))
vi.mock('@/stores/central', () => ({ useCentralStore: () => centralMock }))

const FORM_ID = 'central_form'

/** A canned "pulled from Central" document with a known formId. */
const pulledDoc = (): FormDocument => {
  const doc = newDocument('Central Form')
  doc.settings.formId = FORM_ID
  doc.settings.version = '202607131200'
  return doc
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

const mountDrawer = (router: Router): VueWrapper =>
  mountWith(freshPinia(), LibraryCentralDrawer, {
    props: { open: true },
    global: {
      stubs: { teleport: true },
      plugins: [router, ToastService],
    },
  })

/** Drive the flow: pick server/project/form, pull. */
const pull = async (wrapper: VueWrapper): Promise<void> => {
  await vi.waitUntil(() => findId(wrapper, 'stub-pick-server').exists())
  await findId(wrapper, 'stub-pick-server').trigger('click')
  await findId(wrapper, 'stub-pick-project').trigger('click')
  await findId(wrapper, 'stub-pick-form').trigger('click')
  await findId(wrapper, 'library-central-pull').trigger('click')
  await flushPromises()
}

beforeEach(async () => {
  await db.forms.clear()
  await db.attachments.clear()
  centralMock.importFormFromCentral.mockReset()
  centralMock.importFormFromCentral.mockResolvedValue({
    document: pulledDoc(),
    issues: [],
    attachments: [],
  })
  centralMock.upsertTarget.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LibraryCentralDrawer', () => {
  it('pulls a published form, renders the report, and lands a copy', async () => {
    const router = makeRouter()
    const push = vi.spyOn(router, 'push')
    const wrapper = mountDrawer(router)

    await pull(wrapper)

    expect(findId(wrapper, 'library-central-report').exists()).toBe(true)
    expect(centralMock.importFormFromCentral).toHaveBeenCalledWith('srv-1', 5, 'central_form')

    // No collision (empty library) → Import lands a copy.
    await findId(wrapper, 'library-central-import').trigger('click')
    await flushPromises()

    const forms = await formsRepo.listForms()
    expect(forms).toHaveLength(1)
    expect(forms[0].formId).toBe(FORM_ID)
    // The origin publish target is seeded (with the imported content fingerprint).
    expect(centralMock.upsertTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: 'srv-1',
        projectId: 5,
        xmlFormId: 'central_form',
        lastPublishedContentHash: 'hash-imported',
      })
    )
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'editor', params: { formId: forms[0].id } })
    )
  })

  it('surfaces a Central transport error with the central.errors copy, not readFailed', async () => {
    const { CentralError } = await import('@/core/central/types')
    centralMock.importFormFromCentral.mockRejectedValueOnce(
      new CentralError('nope', { kind: 'auth', status: 401 })
    )
    const wrapper = mountDrawer(makeRouter())

    await pull(wrapper)

    const err = findId(wrapper, 'library-central-error')
    expect(err.exists()).toBe(true)
    expect(err.text()).toContain('Sign-in failed')
    // The report never rendered — the pull failed.
    expect(findId(wrapper, 'library-central-report').exists()).toBe(false)
  })

  it('offers copy vs replace on a formId collision, and copy adds a second form', async () => {
    const seed = newDocument('Existing Survey')
    seed.settings.formId = FORM_ID
    const existing = await formsRepo.createForm(seed)

    const router = makeRouter()
    const push = vi.spyOn(router, 'push')
    const wrapper = mountDrawer(router)
    await pull(wrapper)

    // Import detects the collision instead of landing.
    await findId(wrapper, 'library-central-import').trigger('click')
    await flushPromises()
    expect(findId(wrapper, 'library-central-collision').exists()).toBe(true)
    expect(findId(wrapper, 'library-central-import').exists()).toBe(false)

    await findId(wrapper, 'library-central-collision-copy').trigger('click')
    await flushPromises()

    const forms = await formsRepo.listForms()
    expect(forms).toHaveLength(2)
    expect(forms.some((f) => f.id === existing.id)).toBe(true)
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ name: 'editor' }))
  })

  it('replaces the existing form in place, keeping its record id', async () => {
    const seed = newDocument('Existing Survey')
    seed.settings.formId = FORM_ID
    const existing = await formsRepo.createForm(seed)

    const wrapper = mountDrawer(makeRouter())
    await pull(wrapper)

    await findId(wrapper, 'library-central-import').trigger('click')
    await flushPromises()

    await findId(wrapper, 'library-central-collision-replace').trigger('click')
    await flushPromises()

    const forms = await formsRepo.listForms()
    expect(forms).toHaveLength(1)
    expect(forms[0].id).toBe(existing.id)
    // The record was overwritten with the pulled document.
    expect(forms[0].title).toBe('Central Form')
  })
})
