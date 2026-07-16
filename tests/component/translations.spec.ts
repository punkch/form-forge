import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import TranslationGrid from '@/components/translations/TranslationGrid.vue'
import TranslationsDialog from '@/components/translations/TranslationsDialog.vue'
import { newDocument } from '@/core/model/factory'
import { addLanguage, removeLanguage } from '@/core/model/translations'
import { DEFAULT_LANG, type QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const FR = 'French (fr)'
const ES = 'Spanish (es)'

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

  it('MOVES default text into the FIRST added language and makes it the default', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [FR]: 'Your name?' })
    expect(node.hint).toEqual({ [FR]: 'Full name' })
    expect(form.doc?.settings.defaultLanguage).toBe(FR)
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
    // add→remove round-trip: the moved text returns to the sentinel key.
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [DEFAULT_LANG]: 'Your name?' })
    expect(form.doc?.settings.defaultLanguage).toBeUndefined()
  })

  it('warns that removing the ONLY language returns its text to untranslated', async () => {
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    await wrapper.find(`[data-testid="remove-language-${FR}"]`).trigger('click')
    const confirm = wrapper.find('[data-testid="remove-confirm"]')
    expect(confirm.text()).toContain(`Removes ${FR}. Its text becomes the form's untranslated text.`)
    expect(confirm.text()).not.toContain('Removes every')
  })

  it('keeps the plain remove warning while other languages remain', async () => {
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    await addLang(wrapper, 'Spanish', 'es')
    await wrapper.find(`[data-testid="remove-language-${ES}"]`).trigger('click')
    expect(wrapper.find('[data-testid="remove-confirm"]').text())
      .toContain(`Removes every ${ES} translation from the form.`)
  })

  it('sets the default language setting', async () => {
    const form = useFormStore()
    const wrapper = await mountDialog()
    await addLang(wrapper, 'French', 'fr')
    await addLang(wrapper, 'Spanish', 'es')
    expect(form.doc?.settings.defaultLanguage).toBe(FR)
    const select = wrapper
      .findAllComponents({ name: 'Select' })
      .find((c) => c.attributes('data-testid') === 'default-language')
    select!.vm.$emit('update:modelValue', ES)
    await nextTick()
    expect(form.doc?.settings.defaultLanguage).toBe(ES)
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
    // A clean multilingual doc carries no sentinel content — no sentinel column.
    expect(wrapper.findAll('input[data-testid$="-default"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="unassigned-hint"]').exists()).toBe(false)
  })

  it('cell edits write the exact language key', async () => {
    const form = useFormStore()
    const wrapper = mountGrid()
    const cell = wrapper.find(`[data-testid="cell-node:${nameId}.label-${FR}"]`)
    await cell.setValue('Votre nom ?')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [FR]: 'Votre nom ?' })
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
      n.media = { image: { [FR]: 'photo.png' } }
    })
    const wrapper = mountGrid()
    expect(wrapper.find(`[data-testid="row-node-media:${nameId}.image"]`).text())
      .toContain('name · Image')
    const cell = wrapper.find(`[data-testid="cell-node-media:${nameId}.image-${FR}"]`)
    await cell.setValue('photo_fr.png')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.media?.image).toEqual({ [FR]: 'photo_fr.png' })
  })

  it('shows per-language completeness counts', async () => {
    const form = useFormStore()
    // addLanguage MOVED the default text, so FR starts translated where a
    // default existed (label + both choices); the always-on hint row stays
    // empty. Clearing wa's only value removes that choice row entirely (choice
    // sites need text in at least one language), shrinking the total with it.
    form.mutate('Clear one', (d) => {
      delete d.choiceLists.states.choices[1].label?.[FR]
    })
    const wrapper = mountGrid()
    expect(wrapper.find(`[data-testid="lang-completeness-${FR}"]`).text()).toBe('2/3')
  })

  it('filters to untranslated rows only without changing the stats', async () => {
    const wrapper = mountGrid()
    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
    await wrapper.find('[data-testid="untranslated-only"] input').setValue(true)
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('name · Hint')
    expect(wrapper.find(`[data-testid="lang-completeness-${FR}"]`).text()).toBe('3/4')
  })

  it('zero-language form: a single Text column edits the sentinel key', async () => {
    const form = useFormStore()
    form.mutate('Back to shape A', (d) => { removeLanguage(d, FR) })
    const wrapper = mountGrid()
    const headers = wrapper.findAll('th')
    expect(headers).toHaveLength(2)
    expect(headers[1].text()).toBe('Text')
    expect(wrapper.find('[data-testid="untranslated-only"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="unassigned-hint"]').exists()).toBe(false)
    const cell = wrapper.find(`[data-testid="cell-node:${nameId}.label-default"]`)
    expect((cell.element as HTMLInputElement).value).toBe('Your name?')
    await cell.setValue('Full name?')
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [DEFAULT_LANG]: 'Full name?' })
  })

  it('mixed doc: Unassigned column + hint stay until the last sentinel cell clears', async () => {
    const form = useFormStore()
    form.updateNode(nameId, 'Leftover default', (n) => {
      n.label = { ...n.label, [DEFAULT_LANG]: 'Leftover text' }
    })
    const wrapper = mountGrid()
    expect(wrapper.find('[data-testid="unassigned-hint"]').exists()).toBe(true)
    expect(wrapper.findAll('th')[1].text()).toBe('Unassigned')
    const cell = wrapper.find(`[data-testid="cell-node:${nameId}.label-default"]`)
    expect((cell.element as HTMLInputElement).value).toBe('Leftover text')
    await cell.setValue('')
    expect(wrapper.find('[data-testid="unassigned-hint"]').exists()).toBe(false)
    expect(wrapper.findAll('input[data-testid$="-default"]')).toHaveLength(0)
    const node = form.getNode(nameId) as QuestionNode
    expect(node.label).toEqual({ [FR]: 'Your name?' })
  })

  it('a literal "default" language renders as a normal column, never doubled', () => {
    // Parser edge case: 'default' can be a declared language. The sentinel
    // column must not also render — one cell-…-default per row, no hint.
    const form = useFormStore()
    form.mutate('Declare literal default', (d) => {
      removeLanguage(d, FR)
      d.languages.push(DEFAULT_LANG)
    })
    const wrapper = mountGrid()
    expect(wrapper.find(`[data-testid="lang-header-${DEFAULT_LANG}"]`).exists()).toBe(true)
    expect(wrapper.find('[data-testid="unassigned-hint"]').exists()).toBe(false)
    const rows = wrapper.findAll('tbody tr')
    for (const row of rows) {
      expect(row.findAll('input[data-testid$="-default"]')).toHaveLength(1)
    }
  })

  it('the untranslated-only filter goes inert when the last language is removed mid-session', async () => {
    // The checkbox hides with zero languages but its state survives; without
    // the guard the grid would empty out under an unreachable toggle.
    const form = useFormStore()
    const wrapper = mountGrid()
    await wrapper.find('[data-testid="untranslated-only"] input').setValue(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    form.mutate('Remove last language', (d) => { removeLanguage(d, FR) })
    await nextTick()
    expect(wrapper.find('[data-testid="untranslated-only"]').exists()).toBe(false)
    const headers = wrapper.findAll('th')
    expect(headers[1].text()).toBe('Text')
    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
    expect(wrapper.find('[data-testid="grid-empty"]').exists()).toBe(false)
  })
})
