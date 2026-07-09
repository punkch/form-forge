import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SaveIndicator from '@/components/shell/SaveIndicator.vue'

describe('SaveIndicator', () => {
  it.each([
    ['saved', 'All changes saved'],
    ['saving', 'Saving…'],
    ['dirty', 'Unsaved changes'],
    ['error', 'Save failed'],
  ] as const)('renders the %s state', (state, text) => {
    const wrapper = mount(SaveIndicator, { props: { state } })
    expect(wrapper.text()).toContain(text)
    expect(wrapper.classes()).toContain(state)
  })
})
