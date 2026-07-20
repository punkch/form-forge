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
import * as templatesRepo from '@/persistence/templates-repo'
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

/** Opens a form card's row menu and clicks "Save as template" — there's no
 * testid on the PrimeVue Menu popup items, so it's driven by role + label
 * like the e2e suite (tests/e2e/templates.spec.ts). */
const openSaveTemplateDialog = async (wrapper: VueWrapper, formId: string): Promise<void> => {
  await findTestId(wrapper, `form-card-${formId}`).find('[data-testid="form-card-menu"]').trigger('click')
  await vi.waitUntil(() => wrapper.findAll('li[role="menuitem"]').length > 0)
  const item = wrapper.findAll('li[role="menuitem"]').find((li) => li.text().includes('Save as template'))
  await item!.find('a,div,span').trigger('click')
  await vi.waitUntil(() => findTestId(wrapper, 'save-template-name').exists())
}

/** …and additionally waits for the Replace / Save-a-copy prompt to render. */
const openSaveTemplateDialogExpectingCollision = async (wrapper: VueWrapper, formId: string): Promise<void> => {
  await openSaveTemplateDialog(wrapper, formId)
  await vi.waitUntil(() => findTestId(wrapper, 'save-template-collision').exists())
}

beforeEach(async () => {
  await db.forms.clear()
  await db.templates.clear()
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

  it('surfaces a collision warning when saving a template under an existing name', async () => {
    // "Save as template" prefills the name from the form title, which already
    // matches the existing template — the collision fires on open. The stored
    // title differs in case AND padding from the form title, so this also pins
    // that the match trims and lower-cases BOTH sides rather than comparing raw.
    await templatesRepo.addTemplate(newDocument('Old'), '  source form  ', 'Existing description')
    const record = await formsRepo.createForm(newDocument('Source Form'))

    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, `form-card-${record.formId}`).exists())
    await openSaveTemplateDialogExpectingCollision(wrapper, record.formId)

    expect((findTestId(wrapper, 'save-template-name').element as HTMLInputElement).value).toBe('Source Form')
    expect(findTestId(wrapper, 'save-template-collision').exists()).toBe(true)
    expect(findTestId(wrapper, 'save-template-collision').text()).toContain('source form')
    // The footer "Save template" confirm stays mounted (no layout jump) but is
    // disabled while colliding — the real choice is the Replace/Save-a-copy panel.
    const confirmButton = findTestId(wrapper, 'save-template-confirm')
    expect(confirmButton.exists()).toBe(true)
    expect((confirmButton.element as HTMLButtonElement).disabled).toBe(true)
    expect(findTestId(wrapper, 'save-template-collision-hint').exists()).toBe(true)
    expect(findTestId(wrapper, 'save-template-collision-replace').exists()).toBe(true)
    expect(findTestId(wrapper, 'save-template-collision-copy').exists()).toBe(true)
  })

  it('does not act on Enter while colliding, and flashes the collision panel instead', async () => {
    await templatesRepo.addTemplate(newDocument('Old'), 'Source Form', 'Existing description')
    const record = await formsRepo.createForm(newDocument('Source Form'))

    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, `form-card-${record.formId}`).exists())
    await openSaveTemplateDialogExpectingCollision(wrapper, record.formId)

    const wrap = wrapper.find('.save-template-collision-wrap')
    expect(wrap.classes()).not.toContain('attention-flash')

    await findTestId(wrapper, 'save-template-name').trigger('keyup.enter')

    expect(await db.templates.count()).toBe(1)
    expect(findTestId(wrapper, 'save-template-collision').exists()).toBe(true)
    expect(wrapper.find('.save-template-collision-wrap').classes()).toContain('attention-flash')
  })

  it('auto-suffixes "Save a copy" instead of duplicating the exact name', async () => {
    await templatesRepo.addTemplate(newDocument('Old'), 'Source Form', 'Existing description')
    const record = await formsRepo.createForm(newDocument('Source Form'))

    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, `form-card-${record.formId}`).exists())
    await openSaveTemplateDialogExpectingCollision(wrapper, record.formId)

    await findTestId(wrapper, 'save-template-collision-copy').trigger('click')
    await vi.waitUntil(async () => (await db.templates.count()) === 2)

    const titles = (await templatesRepo.listTemplates()).map((tpl) => tpl.title).sort()
    expect(titles).toEqual(['Source Form', 'Source Form (2)'])

    // Re-open and save a copy again — the next free suffix is (3).
    await openSaveTemplateDialogExpectingCollision(wrapper, record.formId)
    await findTestId(wrapper, 'save-template-collision-copy').trigger('click')
    await vi.waitUntil(async () => (await db.templates.count()) === 3)

    const titlesAfter = (await templatesRepo.listTemplates()).map((tpl) => tpl.title).sort()
    expect(titlesAfter).toEqual(['Source Form', 'Source Form (2)', 'Source Form (3)'])
  })

  it('replaces the colliding template in place, keeping its id and createdAt', async () => {
    const existing = await templatesRepo.addTemplate(newDocument('Old'), 'Source Form', 'Existing description')
    const record = await formsRepo.createForm(newDocument('Source Form'))

    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, `form-card-${record.formId}`).exists())
    await openSaveTemplateDialogExpectingCollision(wrapper, record.formId)

    await findTestId(wrapper, 'save-template-description').setValue('Replaced description')
    await findTestId(wrapper, 'save-template-collision-replace').trigger('click')

    await vi.waitUntil(async () => (await db.templates.get(existing.id))?.description === 'Replaced description')
    expect(await db.templates.count()).toBe(1)
    const stored = await db.templates.get(existing.id)
    expect(stored?.createdAt).toBe(existing.createdAt)
  })

  it('saves a copy alongside the colliding template', async () => {
    await templatesRepo.addTemplate(newDocument('Old'), 'Source Form', 'Existing description')
    const record = await formsRepo.createForm(newDocument('Source Form'))

    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, `form-card-${record.formId}`).exists())
    await openSaveTemplateDialogExpectingCollision(wrapper, record.formId)

    await findTestId(wrapper, 'save-template-collision-copy').trigger('click')

    await vi.waitUntil(async () => (await db.templates.count()) === 2)
  })

  it('will not save a template under a whitespace-only name', async () => {
    const record = await formsRepo.createForm(newDocument('Blank Name'))

    const wrapper = mountView(makeRouter())
    await vi.waitUntil(() => findTestId(wrapper, `form-card-${record.formId}`).exists())
    await openSaveTemplateDialog(wrapper, record.formId)

    await findTestId(wrapper, 'save-template-name').setValue('   ')
    // The confirm is disabled outright, and forcing the click still persists nothing.
    const confirmButton = findTestId(wrapper, 'save-template-confirm')
    expect((confirmButton.element as HTMLButtonElement).disabled).toBe(true)
    await confirmButton.trigger('click')

    expect(await db.templates.count()).toBe(0)
    expect(findTestId(wrapper, 'save-template-name').exists()).toBe(true)
  })
})
