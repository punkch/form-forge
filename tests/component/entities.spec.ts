import { enableAutoUnmount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import PropertyPanel from '@/components/properties/PropertyPanel.vue'
import FormSettingsDialog from '@/components/settings/FormSettingsDialog.vue'
import { newDocument } from '@/core/model/factory'
import type { FormDocument, QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// PrimeVue's TabList (FormSettingsDialog tabs) arms a 150 ms inkbar timer on
// mount and never clears it; unmounting nulls its refs so the late callback
// no-ops instead of racing the happy-dom teardown (rare full-suite flake).
enableAutoUnmount(afterEach)

describe('entities UI', () => {
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
  })

  const docOf = (): FormDocument => useFormStore().doc as FormDocument

  const selectNew = (type: string): string => {
    const form = useFormStore()
    const editor = useEditorStore()
    const id = form.addNode(type, null) as string
    editor.select(id)
    return id
  }

  describe('EntitySection in the property panel', () => {
    it('is hidden without an entity declaration and appears once one exists', async () => {
      selectNew('text')
      const wrapper = mountWith(pinia, PropertyPanel)
      expect(wrapper.find('[data-testid="prop-section-entity"]').exists()).toBe(false)

      docOf().entities = { datasetName: 'households' }
      await nextTick()
      expect(wrapper.find('[data-testid="prop-section-entity"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="prop-save-to"]').exists()).toBe(true)
    })

    it('stays hidden for value-less questions (notes)', async () => {
      docOf().entities = { datasetName: 'households' }
      selectNew('note')
      const wrapper = mountWith(pinia, PropertyPanel)
      expect(wrapper.find('[data-testid="prop-section-entity"]').exists()).toBe(false)
    })

    it('edits flow into node.saveTo and clear when emptied', async () => {
      docOf().entities = { datasetName: 'households' }
      const id = selectNew('text')
      const form = useFormStore()
      const wrapper = mountWith(pinia, PropertyPanel)

      await wrapper.find('[data-testid="prop-save-to"]').setValue('household_name')
      expect((form.getNode(id) as QuestionNode).saveTo).toBe('household_name')

      await wrapper.find('[data-testid="prop-save-to"]').setValue('')
      expect((form.getNode(id) as QuestionNode).saveTo).toBeUndefined()
    })

    it('shows entity validation issues for the question inline', async () => {
      docOf().entities = { datasetName: 'households', label: 'x' }
      const id = selectNew('text')
      const form = useFormStore()
      form.issues = [{
        severity: 'error',
        code: 'entities.reserved-save-to',
        message: 'save_to must not be "name" or "label" (any casing) — reserved.',
        scope: { nodeId: id },
      }]
      const wrapper = mountWith(pinia, PropertyPanel)
      await nextTick()
      const issue = wrapper.find('[data-testid="save-to-issue"]')
      expect(issue.exists()).toBe(true)
      expect(issue.text()).toContain('save_to')
    })

    it('opens the staged saveTo help popover', async () => {
      docOf().entities = { datasetName: 'households' }
      selectNew('text')
      const wrapper = mountWith(pinia, PropertyPanel, { global: { stubs: { teleport: true } } })
      await wrapper.find('[data-testid="field-help-saveTo"]').trigger('click')
      await nextTick()
      await nextTick()
      expect(wrapper.find('[data-testid="field-help-body-saveTo"]').exists()).toBe(true)
    })

    it('renders the entities guide trigger and opens the guide on click', async () => {
      docOf().entities = { datasetName: 'households' }
      selectNew('text')
      const editor = useEditorStore()
      const wrapper = mountWith(pinia, PropertyPanel)

      const trigger = wrapper.find('[data-testid="guide-trigger-entities"]')
      expect(trigger.exists()).toBe(true)

      await trigger.trigger('click')
      expect(editor.helpGuideId).toBe('entities')
      expect(editor.activeDialog).toBe('help-reference')
    })
  })

  describe('FormSettingsDialog entities tab', () => {
    const mountDialog = async (): Promise<ReturnType<typeof mountWith>> => {
      const editor = useEditorStore()
      editor.activeDialog = 'settings'
      const wrapper = mountWith(pinia, FormSettingsDialog, {
        global: { stubs: { teleport: true } },
      })
      await nextTick()
      await nextTick()
      await wrapper.find('[data-testid="settings-tab-entities"]').trigger('click')
      await nextTick()
      return wrapper
    }

    it('keeps the general tab fields (existing testids) as the first tab', async () => {
      const editor = useEditorStore()
      editor.activeDialog = 'settings'
      const wrapper = mountWith(pinia, FormSettingsDialog, {
        global: { stubs: { teleport: true } },
      })
      await nextTick()
      await nextTick()
      expect(wrapper.find('[data-testid="setting-form-title"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="setting-form-id"]').exists()).toBe(true)
    })

    it('declares an entity list and edits the declaration', async () => {
      const wrapper = await mountDialog()
      expect(wrapper.find('[data-testid="entity-dataset-name"]').exists()).toBe(false)

      await wrapper.find('[data-testid="entity-declare"]').trigger('click')
      await nextTick()
      expect(docOf().entities).toEqual({ datasetName: '' })

      await wrapper.find('[data-testid="entity-dataset-name"]').setValue('households')
      expect(docOf().entities?.datasetName).toBe('households')
    })

    it('removes the declaration', async () => {
      docOf().entities = { datasetName: 'households' }
      const wrapper = await mountDialog()
      await wrapper.find('[data-testid="entity-remove"]').trigger('click')
      expect(docOf().entities).toBeUndefined()
    })

    it('sets up a follow-up form in a single undo step', async () => {
      docOf().entities = { datasetName: 'households', label: '${hh_name}' }
      const form = useFormStore()
      const before = docOf().children.length
      const wrapper = await mountDialog()

      await wrapper.find('[data-testid="entity-follow-up"]').trigger('click')
      await nextTick()

      const added = docOf().children[0] as QuestionNode
      expect(added.type).toBe('select_one_from_file')
      expect(added.itemsetFile).toBe('households.csv')
      expect(docOf().entities?.entityId).toBe(`\${${added.name}}`)
      expect(docOf().entities?.updateIf).toBe('true()')
      expect(wrapper.find('[data-testid="entity-follow-up-done"]').text()).toContain(added.name)

      form.undo()
      expect(docOf().children).toHaveLength(before)
      expect(docOf().entities?.entityId).toBeUndefined()
      expect(docOf().entities?.updateIf).toBeUndefined()
    })

    it('lists save_to mappings and navigates to the question on click', async () => {
      docOf().entities = { datasetName: 'households', label: 'x' }
      const id = selectNew('text')
      const form = useFormStore()
      form.updateNode(id, 'edit', (n) => { if (n.kind === 'question') n.saveTo = 'household_name' })
      const editor = useEditorStore()
      editor.select(null)

      const wrapper = await mountDialog()
      const rows = wrapper.findAll('[data-testid="entity-save-to-row"]')
      expect(rows).toHaveLength(1)
      expect(rows[0].text()).toContain('household_name')

      await rows[0].find('button').trigger('click')
      expect(editor.selectedNodeId).toBe(id)
      expect(editor.revealNodeId).toBe(id)
      expect(editor.activeDialog).toBeNull()
    })
  })
})
