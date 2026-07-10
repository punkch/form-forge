import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import TranslationGrid from '@/components/translations/TranslationGrid.vue'
import TranslationsDialog from '@/components/translations/TranslationsDialog.vue'
import { newDocument } from '@/core/model/factory'
import { addLanguage } from '@/core/model/translations'
import { DEFAULT_LANG, type QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const FR = 'French (fr)'

describe('TranslationsDialog', () => {
  let pinia: Pinia
  let nameId: string

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    const editor = useEditorStore()
    form.doc = newDocument('T')
    nameId = form.addNode('text', null) as string
    form.updateNode(nameId, 'Edit label', (n) => {
      n.name = 'name'
      n.label = { [DEFAULT_LANG]: 'Your name?' }
      n.hint = { [DEFAULT_LANG]: 'Full name' }
    })
    editor.activeDialog = 'translations'
  })

  const mountDialog = async (): Promise<VueWrapper> => {
    const wrapper = mountWith(pinia, TranslationsDialog, {
      global: { stubs: { teleport: true } },
    })
    await nextTick()
    return wrapper
  }

  const addLang = async (wrapper: VueWrapper, name: string, code: string): Promise<void> => {
    await wrapper.find('[data-testid="new-language-name"]').setValue(name)
    await wrapper.find('[data-testid="new-language-code"]').setValue(code)
    await wrapper.find('[data-testid="add-language"]').trigger('click')
  }

  it('adds a language under the canonical "Name (code)" key', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    expect(form.doc?.languages).toEqual([FR])
    expect(wrapper.find(`[data-testid="language-row-${FR}"]`).exists()).toBe(true)
  })

  it('migrates default text into the FIRST added language', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [DEFAULT_LANG]: 'Your name?', [FR]: 'Your name?' })
    expect(node.hint).toEqual({ [DEFAULT_LANG]: 'Full name', [FR]: 'Full name' })
  })

  it('rejects duplicate languages', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    await wrapper.find('[data-testid="new-language-name"]').setValue('French')
    await wrapper.find('[data-testid="new-language-code"]').setValue('fr')
    await nextTick()
    expect(wrapper.text()).toContain('already exists')
    expect((wrapper.find('[data-testid="add-language"]').element as HTMLButtonElement).disabled).toBe(true)
    expect(form.doc?.languages).toEqual([FR])
  })

  it('removing a language needs a confirm and strips its keys everywhere', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')

    await wrapper.find(`[data-testid="remove-language-${FR}"]`).trigger('click')
    expect(form.doc?.languages).toEqual([FR])
    expect(wrapper.find('[data-testid="remove-confirm"]').exists()).toBe(true)

    await wrapper.find('[data-testid="remove-confirm-button"]').trigger('click')
    expect(form.doc?.languages).toEqual([])
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [DEFAULT_LANG]: 'Your name?' })
  })

  it('sets the default language setting', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'default-language')
    select!.vm.$emit('update:modelValue', FR)
    await nextTick()
    expect(form.doc?.settings.defaultLanguage).toBe(FR)
  })

  it('drives editor.displayLanguage and resets it when the language is removed', async () => {
    const editor = useEditorStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'display-language')
    select!.vm.$emit('update:modelValue', FR)
    await nextTick()
    expect(editor.displayLanguage).toBe(FR)

    await wrapper.find(`[data-testid="remove-language-${FR}"]`).trigger('click')
    await wrapper.find('[data-testid="remove-confirm-button"]').trigger('click')
    expect(editor.displayLanguage).toBeNull()
  })
})

describe('TranslationGrid', () => {
  let pinia: Pinia
  let nameId: string

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    nameId = form.addNode('text', null) as string
    form.updateNode(nameId, 'Edit label', (n) => {
      n.name = 'name'
      n.label = { [DEFAULT_LANG]: 'Your name?' }
    })
    form.mutate('Seed choices', (d) => {
      d.choiceLists.states = {
        name: 'states',
        choices: [
          { name: 'tx', label: { [DEFAULT_LANG]: 'Texas' } },
          { name: 'wa', label: { [DEFAULT_LANG]: 'Washington' } },
        ],
      }
      addLanguage(d, FR)
    })
  })

  const mountGrid = (): VueWrapper => mountWith(pinia, TranslationGrid)

  it('lists question texts (including empty-but-relevant rows) then choice labels', () => {
    const wrapper = mountGrid()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[0].text()).toContain('name · Label')
    expect(rows[1].text()).toContain('name · Hint')
    expect(rows[2].text()).toContain('states / tx')
    expect(rows[3].text()).toContain('states / wa')
    expect(wrapper.find(`[data-testid="lang-header-${FR}"]`).exists()).toBe(true)
  })

  it('cell edits write the exact language key', async () => {
    const form = useFormStore()
    const wrapper = mountGrid()
    const cell = wrapper.find(`[data-testid="cell-node:${nameId}.label-${FR}"]`)
    await cell.setValue('Votre nom ?')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [DEFAULT_LANG]: 'Your name?', [FR]: 'Votre nom ?' })
  })

  it('an empty hint row is editable and writes only the typed language', async () => {
    const form = useFormStore()
    const wrapper = mountGrid()
    const cell = wrapper.find(`[data-testid="cell-node:${nameId}.hint-${FR}"]`)
    expect((cell.element as HTMLInputElement).value).toBe('')
    await cell.setValue('Nom complet')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.hint).toEqual({ [FR]: 'Nom complet' })
  })

  it('shows message rows once their bind expression is set', async () => {
    const form = useFormStore()
    form.updateNode(nameId, 'Edit logic', (n) => {
      n.bind.constraint = 'string-length(.) > 1'
      n.bind.required = 'true()'
    })
    const wrapper = mountGrid()
    expect(wrapper.find(`[data-testid="row-node:${nameId}.constraintMessage"]`).text())
      .toContain('name · Constraint message')
    expect(wrapper.find(`[data-testid="row-node:${nameId}.requiredMessage"]`).exists()).toBe(true)
    const cell = wrapper.find(`[data-testid="cell-node:${nameId}.constraintMessage-${FR}"]`)
    await cell.setValue('Trop court')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.bind.constraintMessage).toEqual({ [FR]: 'Trop court' })
  })

  it('hides guidance hint behind the rarely-used toggle; stats follow the toggle', async () => {
    const wrapper = mountGrid()
    expect(wrapper.find(`[data-testid="row-node:${nameId}.guidanceHint"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="lang-completeness-${FR}"]`).text()).toBe('3/4')
    await wrapper.find('[data-testid="show-rarely-used"] input').setValue(true)
    expect(wrapper.find(`[data-testid="row-node:${nameId}.guidanceHint"]`).text())
      .toContain('name · Guidance hint')
    expect(wrapper.find(`[data-testid="lang-completeness-${FR}"]`).text()).toBe('3/5')
  })

  it('media refs surface as editable filename rows', async () => {
    const form = useFormStore()
    form.updateNode(nameId, 'Edit media', (n) => {
      n.media = { image: { [DEFAULT_LANG]: 'photo.png' } }
    })
    const wrapper = mountGrid()
    expect(wrapper.find(`[data-testid="row-node-media:${nameId}.image"]`).text())
      .toContain('name · Image')
    const cell = wrapper.find(`[data-testid="cell-node-media:${nameId}.image-${FR}"]`)
    await cell.setValue('photo_fr.png')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.media?.image).toEqual({ [DEFAULT_LANG]: 'photo.png', [FR]: 'photo_fr.png' })
  })

  it('shows per-language completeness counts', async () => {
    const form = useFormStore()
    // addLanguage migrated defaults, so FR starts translated where a default
    // existed (label + both choices); the always-on hint row stays empty.
    form.mutate('Clear one', (d) => {
      delete d.choiceLists.states.choices[1].label?.[FR]
    })
    const wrapper = mountGrid()
    expect(wrapper.find(`[data-testid="lang-completeness-${FR}"]`).text()).toBe('2/4')
  })

  it('filters to untranslated rows only without changing the stats', async () => {
    const form = useFormStore()
    form.mutate('Clear one', (d) => {
      delete d.choiceLists.states.choices[1].label?.[FR]
    })
    const wrapper = mountGrid()
    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
    await wrapper.find('[data-testid="untranslated-only"] input').setValue(true)
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('name · Hint')
    expect(rows[1].text()).toContain('states / wa')
    expect(wrapper.find(`[data-testid="lang-completeness-${FR}"]`).text()).toBe('2/4')
  })

  it('asks to add a language when none exist', () => {
    const form = useFormStore()
    form.mutate('Drop language', (d) => { d.languages = [] })
    const wrapper = mountGrid()
    expect(wrapper.text()).toContain('Add a language')
  })
})
