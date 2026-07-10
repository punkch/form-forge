import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { useAppI18n } from '@/i18n'
import { setLocale } from '@/i18n/setLocale'

// Render-function component (no runtime template compiler in tests) proving
// the shared i18n instance from tests/setup/component.ts reaches useI18n().
const CancelLabel = defineComponent({
  name: 'CancelLabel',
  setup () {
    const { t } = useAppI18n()
    return () => h('button', { type: 'button' }, t('common.cancel'))
  },
})

// Type-level negative check (never executed): unknown catalog keys must be
// compile errors — vue-tsc fails here if StrictTranslate ever loosens.
const badKeyIsACompileError = () => {
  const { t } = useAppI18n()
  // @ts-expect-error 'common.doesNotExist' is not a catalog key
  return t('common.doesNotExist')
}
void badKeyIsACompileError

describe('i18n plugin wiring', () => {
  it('resolves catalog messages through the globally installed instance', () => {
    const wrapper = mount(CancelLabel)
    expect(wrapper.text()).toBe('Cancel')
  })

  it('setLocale syncs the locale with <html lang> and text direction', () => {
    setLocale('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')

    setLocale('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
    expect(mount(CancelLabel).text()).toBe('Cancel')
  })
})
