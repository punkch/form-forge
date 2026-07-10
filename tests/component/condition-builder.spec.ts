import type { VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import CalculationHelper from '@/components/logic/CalculationHelper.vue'
import ConditionBuilder from '@/components/logic/ConditionBuilder.vue'
import { newDocument } from '@/core/model/factory'
import { DEFAULT_LANG, type FormNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { useUiStore } from '@/stores/ui'

import { freshPinia, mountWith } from './helpers'

const ACCEPTANCE = "${age} >= 18 and (selected(${type}, 'refugee') or selected(${type}, 'idp'))"

describe('ConditionBuilder', () => {
  let pinia: Pinia
  let targetId: string

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.mutate('Seed', (d) => {
      d.choiceLists.statuses = {
        name: 'statuses',
        choices: [
          { name: 'refugee', label: { [DEFAULT_LANG]: 'Refugee' } },
          { name: 'idp', label: { [DEFAULT_LANG]: 'IDP' } },
        ],
      }
    })
    // Leading note: regression fixture for the default-operand bug (notes hold
    // no value, so they must never appear in — or seed — conditions).
    const noteId = form.addNode('note', null) as string
    form.updateNode(noteId, 'Edit name', (n) => { n.name = 'intro' })
    const ageId = form.addNode('integer', null) as string
    form.updateNode(ageId, 'Edit name', (n) => { n.name = 'age' })
    const typeId = form.addNode('select_one', null) as string
    form.updateNode(typeId, 'Edit name', (n) => {
      n.name = 'type'
      if (n.kind === 'question') n.listRef = 'statuses'
    })
    const dobId = form.addNode('date', null) as string
    form.updateNode(dobId, 'Edit name', (n) => { n.name = 'dob' })
    targetId = form.addNode('text', null) as string
    form.updateNode(targetId, 'Edit name', (n) => { n.name = 'target' })
  })

  const target = (): FormNode => useFormStore().getNode(targetId) as FormNode

  const mountBuilder = (
    modelValue: string,
    field: 'relevant' | 'constraint' = 'relevant'
  ): VueWrapper =>
    mountWith(pinia, ConditionBuilder, { props: { modelValue, field, node: target() } })

  const findByTestid = (wrapper: VueWrapper, name: string, testid: string) => {
    const component = wrapper
      .findAllComponents({ name })
      .find((c) => c.attributes('data-testid') === testid)
    expect(component, `${name} ${testid}`).toBeDefined()
    return component!
  }

  const emitOn = async (
    wrapper: VueWrapper,
    name: string,
    testid: string,
    value: unknown
  ): Promise<void> => {
    findByTestid(wrapper, name, testid).vm.$emit('update:modelValue', value)
    await wrapper.vm.$nextTick()
  }

  const lastEmitted = (wrapper: VueWrapper): string => {
    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeDefined()
    return (events as unknown[][])[events!.length - 1][0] as string
  }

  describe('mode derivation', () => {
    it('opens parseable expressions visually', () => {
      const wrapper = mountBuilder('${age} >= 18')
      expect(wrapper.find('[data-testid="logic-visual-relevant"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="expr-relevant"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="cond-relevant-0"]').exists()).toBe(true)
    })

    it('opens instance() lookups in raw mode with the visual tab locked', () => {
      const wrapper = mountBuilder("instance('fuel')/root/item[code = ${age}]/price")
      expect(wrapper.find('[data-testid="expr-relevant"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="logic-visual-relevant"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="logic-raw-note-relevant"]').exists()).toBe(true)
      const modeToggle = findByTestid(wrapper, 'SelectButton', 'logic-mode-relevant')
      const options = modeToggle.props('options') as Array<{ value: string, disabled: boolean }>
      expect(options.find((o) => o.value === 'visual')?.disabled).toBe(true)
    })

    it('opens empty expressions in raw mode with the visual tab enabled', () => {
      const wrapper = mountBuilder('')
      expect(wrapper.find('[data-testid="expr-relevant"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="logic-raw-note-relevant"]').exists()).toBe(false)
      const modeToggle = findByTestid(wrapper, 'SelectButton', 'logic-mode-relevant')
      const options = modeToggle.props('options') as Array<{ value: string, disabled: boolean }>
      expect(options.find((o) => o.value === 'visual')?.disabled).toBe(false)
    })
  })

  describe('visual editing', () => {
    it('renders field / operator / value from the expression', () => {
      const wrapper = mountBuilder('${age} >= 18')
      expect(findByTestid(wrapper, 'Select', 'cond-relevant-0-field').props('modelValue')).toBe('age')
      expect(findByTestid(wrapper, 'Select', 'cond-relevant-0-op').props('modelValue')).toBe('>=')
      // int bind type → numeric input.
      expect(findByTestid(wrapper, 'InputNumber', 'cond-relevant-0-value').props('modelValue')).toBe(18)
    })

    it('row edits emit the re-serialized expression', async () => {
      const wrapper = mountBuilder('${age} >= 18')
      await emitOn(wrapper, 'InputNumber', 'cond-relevant-0-value', 21)
      expect(lastEmitted(wrapper)).toBe('${age} >= 21')
      await emitOn(wrapper, 'Select', 'cond-relevant-0-op', '<')
      expect(lastEmitted(wrapper)).toBe('${age} < 18')
    })

    it('select fields get a choice dropdown for selected() values', async () => {
      const wrapper = mountBuilder("selected(${type}, 'refugee')")
      const value = findByTestid(wrapper, 'Select', 'cond-relevant-0-value')
      expect((value.props('options') as Array<{ value: string }>).map((o) => o.value))
        .toEqual(['refugee', 'idp'])
      value.vm.$emit('update:modelValue', 'idp')
      await wrapper.vm.$nextTick()
      expect(lastEmitted(wrapper)).toBe("selected(${type}, 'idp')")
    })

    it('unresolvable field names degrade to text inputs, never to raw mode', () => {
      const wrapper = mountBuilder('${ghost} > 5')
      expect(wrapper.find('[data-testid="logic-visual-relevant"]').exists()).toBe(true)
      expect(findByTestid(wrapper, 'InputText', 'cond-relevant-0-value').props('modelValue')).toBe('5')
    })

    it('renders the acceptance expression as a row plus a nested group', async () => {
      const wrapper = mountBuilder(ACCEPTANCE)
      expect(wrapper.find('[data-testid="cond-relevant-0"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="cond-group-relevant-1"]').exists()).toBe(true)
      expect(findByTestid(wrapper, 'SelectButton', 'cond-join-relevant').props('modelValue')).toBe('and')
      expect(findByTestid(wrapper, 'SelectButton', 'cond-join-relevant-1').props('modelValue')).toBe('or')
      await emitOn(wrapper, 'Select', 'cond-relevant-1-0-value', 'idp')
      expect(lastEmitted(wrapper))
        .toBe("${age} >= 18 and (selected(${type}, 'idp') or selected(${type}, 'idp'))")
    })

    it('adds a default condition and a group through the affordances', async () => {
      // New conditions seed with the nearest preceding answerable field (dob),
      // not the form's first field.
      const wrapper = mountBuilder('${age} >= 18')
      await wrapper.find('[data-testid="cond-add-relevant"]').trigger('click')
      expect(lastEmitted(wrapper)).toBe("${age} >= 18 and ${dob} = ''")
      await wrapper.find('[data-testid="cond-add-group-relevant"]').trigger('click')
      expect(lastEmitted(wrapper)).toBe("${age} >= 18 and (${dob} = '')")
    })

    it('builds from empty after switching to visual', async () => {
      const wrapper = mountBuilder('')
      findByTestid(wrapper, 'SelectButton', 'logic-mode-relevant').vm.$emit('update:modelValue', 'visual')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="logic-visual-relevant"]').exists()).toBe(true)
      await wrapper.find('[data-testid="cond-add-relevant"]').trigger('click')
      expect(lastEmitted(wrapper)).toBe("${dob} = ''")
    })

    it('removing the last row emits the empty expression and stays visual', async () => {
      const wrapper = mountBuilder('${age} >= 18')
      await wrapper.find('[data-testid="cond-relevant-0-remove"]').trigger('click')
      expect(lastEmitted(wrapper)).toBe('')
      // An empty expression normally derives raw mode — the explicit removal
      // must pin visual so the editor doesn't flip under the author.
      expect(wrapper.find('[data-testid="logic-visual-relevant"]').exists()).toBe(true)
    })
  })

  describe('answerable fields only', () => {
    it('excludes notes from the field dropdown', () => {
      const wrapper = mountBuilder('${age} >= 18')
      const options = findByTestid(wrapper, 'Select', 'cond-relevant-0-field')
        .props('options') as Array<{ name: string }>
      expect(options.map((o) => o.name)).toEqual(['age', 'type', 'dob'])
    })

    it('defaults a new relevance condition to the nearest preceding answerable field', async () => {
      // target is preceded by intro (note), age, type and dob — dob wins.
      const wrapper = mountBuilder('')
      findByTestid(wrapper, 'SelectButton', 'logic-mode-relevant').vm.$emit('update:modelValue', 'visual')
      await wrapper.vm.$nextTick()
      await wrapper.find('[data-testid="cond-add-relevant"]').trigger('click')
      expect(lastEmitted(wrapper)).toBe("${dob} = ''")

      await wrapper.setProps({ modelValue: "${dob} = ''" })
      expect(findByTestid(wrapper, 'Select', 'cond-relevant-0-field').props('modelValue')).toBe('dob')
    })

    it('disables adding relevance conditions when no other answerable field exists', async () => {
      // Fresh doc: just a note and the target — relevance has nothing to branch on.
      const lonePinia = freshPinia()
      const form = useFormStore()
      form.doc = newDocument('T')
      const noteId = form.addNode('note', null) as string
      form.updateNode(noteId, 'Edit name', (n) => { n.name = 'intro' })
      const loneId = form.addNode('text', null) as string
      form.updateNode(loneId, 'Edit name', (n) => { n.name = 'alone' })
      const wrapper = mountWith(lonePinia, ConditionBuilder, {
        props: { modelValue: '', field: 'relevant' as const, node: form.getNode(loneId) as FormNode },
      })
      findByTestid(wrapper, 'SelectButton', 'logic-mode-relevant').vm.$emit('update:modelValue', 'visual')
      await wrapper.vm.$nextTick()
      // PrimeVue Button reads `disabled` from $attrs, so assert the DOM attribute.
      const addButton = findByTestid(wrapper, 'Button', 'cond-add-relevant')
      expect(addButton.attributes('disabled')).toBeDefined()
    })
  })

  describe('never destroys expressions', () => {
    it('keeps an unparseable expression verbatim in the raw editor', () => {
      const expr = "if(${age} > 17, 'adult', 'minor')"
      const wrapper = mountBuilder(expr)
      const textarea = wrapper.find('[data-testid="expr-relevant"]')
      expect((textarea.element as HTMLTextAreaElement).value).toBe(expr)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    it('switching visual → raw → visual never emits a rewrite', async () => {
      const wrapper = mountBuilder(ACCEPTANCE)
      const modeToggle = findByTestid(wrapper, 'SelectButton', 'logic-mode-relevant')
      modeToggle.vm.$emit('update:modelValue', 'raw')
      await wrapper.vm.$nextTick()
      expect((wrapper.find('[data-testid="expr-relevant"]').element as HTMLTextAreaElement).value)
        .toBe(ACCEPTANCE)
      modeToggle.vm.$emit('update:modelValue', 'visual')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('[data-testid="logic-visual-relevant"]').exists()).toBe(true)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })
  })

  describe('constraint presets', () => {
    it('offers self (.) in the field picker and fills rows from a preset', async () => {
      const wrapper = mountBuilder('', 'constraint')
      await emitOn(wrapper, 'Select', 'constraint-presets', 'range')
      expect(lastEmitted(wrapper)).toBe('. >= 0 and . <= 100')

      await wrapper.setProps({ modelValue: '. >= 0 and . <= 100' })
      expect(wrapper.find('[data-testid="cond-constraint-0"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="cond-constraint-1"]').exists()).toBe(true)
      expect(findByTestid(wrapper, 'Select', 'cond-constraint-0-field').props('modelValue')).toBe('.')
    })

    it('regex presets serialize to visual regex() predicates', async () => {
      const wrapper = mountBuilder('', 'constraint')
      await emitOn(wrapper, 'Select', 'constraint-presets', 'email')
      expect(lastEmitted(wrapper))
        .toBe("regex(., '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[a-zA-Z]{2,4}$')")
    })

    it('does not offer presets on relevant', () => {
      const wrapper = mountBuilder('', 'relevant')
      expect(wrapper.find('[data-testid="constraint-presets"]').exists()).toBe(false)
    })
  })

  describe('guidance', () => {
    // The structured grammar cannot parse if() — the canonical forced-raw case.
    const FORCED_RAW = "if(${age} > 17, 'adult', 'minor')"

    beforeEach(() => {
      // Callout dismissals persist to localStorage via the ui store; isolate.
      localStorage.clear()
    })

    it('renders the logic guide trigger once, on the relevant builder only', () => {
      // LogicSection always mounts the relevant builder whenever it mounts the
      // constraint one, so this keeps guide-trigger-logic unique per panel.
      const relevant = mountBuilder('${age} >= 18')
      expect(relevant.findAll('[data-testid="guide-trigger-logic"]')).toHaveLength(1)
      const constraint = mountBuilder('. >= 0', 'constraint')
      expect(constraint.find('[data-testid="guide-trigger-logic"]').exists()).toBe(false)
    })

    it('the trigger opens the help drawer at the logic guide', async () => {
      const editor = useEditorStore()
      const wrapper = mountBuilder('')
      await wrapper.find('[data-testid="guide-trigger-logic"]').trigger('click')
      expect(editor.helpGuideId).toBe('logic')
      expect(editor.activeDialog).toBe('help-reference')
    })

    it('shows the logicRaw callout only in forced raw mode', () => {
      expect(mountBuilder(FORCED_RAW).find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(true)
      // Visual mode and the empty raw editor are not the forced-raw trap.
      expect(mountBuilder('${age} >= 18').find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(false)
      expect(mountBuilder('').find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(false)
    })

    it('a forced-raw constraint alone carries the callout', () => {
      const constraint = mountBuilder(FORCED_RAW, 'constraint')
      expect(constraint.find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(true)
    })

    it('forced-raw relevance plus forced-raw constraint show one callout, not two', () => {
      useFormStore().updateNode(targetId, 'Edit relevance', (n) => { n.bind.relevant = FORCED_RAW })
      const relevant = mountBuilder(FORCED_RAW, 'relevant')
      const constraint = mountBuilder(FORCED_RAW, 'constraint')
      expect(relevant.find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(true)
      expect(constraint.find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(false)
    })

    it('dismissing the callout hides it globally, across both builders', async () => {
      const relevant = mountBuilder(FORCED_RAW)
      await relevant.find('[data-testid="guide-callout-dismiss-logicRaw"]').trigger('click')
      expect(relevant.find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(false)
      expect(useUiStore().isCalloutDismissed('logicRaw')).toBe(true)
      // A builder mounted later (e.g. the constraint) never re-nags.
      const constraint = mountBuilder(FORCED_RAW, 'constraint')
      expect(constraint.find('[data-testid="guide-callout-logicRaw"]').exists()).toBe(false)
    })
  })
})

describe('CalculationHelper', () => {
  let pinia: Pinia
  let calcId: string

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    const priceId = form.addNode('decimal', null) as string
    form.updateNode(priceId, 'Edit name', (n) => { n.name = 'price' })
    const qtyId = form.addNode('integer', null) as string
    form.updateNode(qtyId, 'Edit name', (n) => { n.name = 'quantity' })
    calcId = form.addNode('calculate', null) as string
  })

  const mountHelper = (modelValue: string): VueWrapper =>
    mountWith(pinia, CalculationHelper, {
      props: { modelValue, node: useFormStore().getNode(calcId) as FormNode },
    })

  it('inserts an arithmetic template over real numeric fields', async () => {
    const wrapper = mountHelper('')
    wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', '${price} + ${quantity}')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe('${price} + ${quantity}')
  })

  it('offers templates built from the form fields', () => {
    const wrapper = mountHelper('')
    const options = wrapper.findComponent({ name: 'Select' }).props('options') as Array<{ value: string }>
    expect(options.map((o) => o.value)).toEqual([
      '${price} + ${quantity}',
      "if(${price} = '', 'a', 'b')",
      "concat(${price}, ' ', ${quantity})",
      'int(decimal-date-time(${quantity}) - decimal-date-time(${price}))',
    ])
  })

  it('appends space-separated to an existing calculation instead of replacing it', async () => {
    const wrapper = mountHelper('${price} * 2')
    wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', '${quantity}')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toBe('${price} * 2 ${quantity}')
  })
})
