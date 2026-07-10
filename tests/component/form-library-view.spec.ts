import type { VueWrapper } from '@vue/test-utils'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import { db } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'
import FormLibraryView from '@/views/FormLibraryView.vue'

import { freshPinia, mountWith } from './helpers'

const Empty = defineComponent({ template: '<div />' })

const makeRouter = (): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'library', component: Empty },
      { path: '/forms/:formId', name: 'editor', component: Empty },
      { path: '/settings', name: 'settings', component: Empty },
    ],
  })

const mountView = (router: Router): VueWrapper =>
  mountWith(freshPinia(), FormLibraryView, {
    global: {
      stubs: { teleport: true },
      plugins: [router, ToastService, ConfirmationService],
    },
  })

const findTestId = (wrapper: VueWrapper, id: string) => wrapper.find(`[data-testid="${id}"]`)

beforeEach(async () => {
  await db.forms.clear()
})

describe('FormLibraryView', () => {
  it('shows the empty state when no forms are stored', async () => {
    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, 'library-empty').exists())
    expect(findTestId(wrapper, 'library-empty').text()).toContain('No forms yet')
  })

  it('renders cards with question chip, languages badge, formatted version and edited date', async () => {
    const bilingual = newDocument('Water Survey')
    bilingual.languages = ['English (en)', 'French (fr)']
    bilingual.settings.version = '202607101734'
    insertNode(bilingual, createNode(bilingual, 'text'), null)
    await formsRepo.createForm(bilingual)

    const plain = newDocument('Household Census')
    plain.settings.version = '3'
    await formsRepo.createForm(plain)

    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, 'form-card-water_survey').exists())

    const card = findTestId(wrapper, 'form-card-water_survey')
    expect(card.text()).toContain('Water Survey')
    expect(card.text()).toContain('1 question')
    expect(card.text()).toContain('water_survey')
    // 12-digit timestamp version renders formatted; the raw value stays stored.
    expect(card.text()).toContain('v2026-07-10.1734')
    expect(card.text()).not.toContain('v202607101734')
    expect(card.find('[data-testid="form-card-languages"]').text()).toBe('EN · FR')
    expect(card.text()).toContain('Edited')
    expect(card.find('[data-testid="form-card-menu"]').exists()).toBe(true)

    const other = findTestId(wrapper, 'form-card-household_census')
    expect(other.text()).toContain('0 questions')
    // Non-timestamp versions pass through untouched.
    expect(other.text()).toContain('v3')
    // No declared languages → no badge.
    expect(other.find('[data-testid="form-card-languages"]').exists()).toBe(false)
  })

  it('routes to the settings page from the header gear', async () => {
    const router = makeRouter()
    const wrapper = mountView(router)
    await vi.waitUntil(() => findTestId(wrapper, 'library-empty').exists())

    const gear = findTestId(wrapper, 'settings-gear')
    expect(gear.exists()).toBe(true)
    expect(gear.attributes('aria-label')).toBe('Settings')

    await gear.trigger('click')
    await vi.waitUntil(() => router.currentRoute.value.name === 'settings')
  })

  it('opens the editor when the card body is clicked', async () => {
    const record = await formsRepo.createForm(newDocument('Water Survey'))

    const router = makeRouter()
    const wrapper = mountView(router)
    await vi.waitUntil(() => findTestId(wrapper, 'form-card-water_survey').exists())

    await findTestId(wrapper, 'form-card-water_survey').find('.form-card-main').trigger('click')
    await vi.waitUntil(() => router.currentRoute.value.name === 'editor')
    expect(router.currentRoute.value.params.formId).toBe(record.id)
  })
})
