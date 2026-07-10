import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import LocalizedInput from '@/components/properties/LocalizedInput.vue'
import { newDocument } from '@/core/model/factory'
import { DEFAULT_LANG, type LocalizedText } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const FR = 'French (fr)'

describe('LocalizedInput', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    // useEditingLanguage clamps the editing language to one the form declares,
    // so tests that select French must first declare it on the doc.
    const form = useFormStore()
    form.doc = newDocument('T')
    form.doc.languages.push(FR)
  })

  const mountInput = (
    value: LocalizedText | undefined,
    props: Record<string, unknown> = {}
  ): VueWrapper =>
    mountWith(pinia, LocalizedInput, {
      props: { value, dataTestid: 'prop-hint', ...props },
    })

  const input = (wrapper: VueWrapper): HTMLInputElement =>
    wrapper.find('[data-testid="prop-hint"]').element as HTMLInputElement

  it('shows the default-language value with no display language, without a badge', () => {
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello', [FR]: 'Bonjour' })
    expect(input(wrapper).value).toBe('Hello')
    expect(wrapper.find('[data-testid="prop-hint-lang-badge"]').exists()).toBe(false)
  })

  it('shows exactly the selected language value and a language badge', () => {
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello', [FR]: 'Bonjour' })
    expect(input(wrapper).value).toBe('Bonjour')
    const badge = wrapper.find('[data-testid="prop-hint-lang-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe(FR)
  })

  it('renders an empty value with the fallback as placeholder when the selected language is empty', () => {
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello' }, { placeholder: 'type here' })
    expect(input(wrapper).value).toBe('')
    expect(input(wrapper).placeholder).toBe('Hello')
  })

  it('falls back to the caller placeholder when no language has a value', () => {
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountInput(undefined, { placeholder: 'type here' })
    expect(input(wrapper).value).toBe('')
    expect(input(wrapper).placeholder).toBe('type here')
  })

  it('clamps to the default language when the display language is not declared', async () => {
    // The form only declares FR; a stale display language (e.g. left over after
    // an undo removed it) must not render or write into the removed language.
    const editor = useEditorStore()
    editor.displayLanguage = 'German (de)'
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello', [FR]: 'Bonjour' })
    expect(input(wrapper).value).toBe('Hello')
    expect(wrapper.find('[data-testid="prop-hint-lang-badge"]').exists()).toBe(false)
    await wrapper.find('[data-testid="prop-hint"]').setValue('Hi')
    expect(wrapper.emitted('edit')).toEqual([['Hi', DEFAULT_LANG]])
  })

  it('emits the typed string with the language it targets', async () => {
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello' })
    await wrapper.find('[data-testid="prop-hint"]').setValue('Salut')
    expect(wrapper.emitted('edit')).toEqual([['Salut', FR]])
  })

  it('targets the default language when no display language is set', async () => {
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello' })
    await wrapper.find('[data-testid="prop-hint"]').setValue('Hi')
    expect(wrapper.emitted('edit')).toEqual([['Hi', DEFAULT_LANG]])
  })

  it('renders a textarea when multiline, keeping the data-testid on the field', () => {
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello' }, { multiline: true })
    const field = wrapper.find('[data-testid="prop-hint"]')
    expect(field.element.tagName).toBe('TEXTAREA')
    expect((field.element as HTMLTextAreaElement).value).toBe('Hello')
  })

  it('emits value and language from the multiline textarea', async () => {
    const editor = useEditorStore()
    editor.displayLanguage = FR
    const wrapper = mountInput({ [DEFAULT_LANG]: 'Hello' }, { multiline: true })
    const field = wrapper.find('[data-testid="prop-hint"]')
    expect(field.element.tagName).toBe('TEXTAREA')
    await field.setValue('Salut')
    expect(wrapper.emitted('edit')).toEqual([['Salut', FR]])
  })
})
