import { mount, type ComponentMountingOptions, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import type { Component } from 'vue'

/** Fresh pinia shared between the test body and mounted components. */
export const freshPinia = (): Pinia => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

// Loosely typed wrapper: VTU's precise generic wrapper type is not portable
// through a generic helper (TS2742), so this narrows to the base Component
// overload.
export const mountWith = (
  pinia: Pinia,
  component: Component,
  options: ComponentMountingOptions<Component> = {}
): VueWrapper =>
  mount(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [...(options.global?.plugins ?? []), pinia],
    },
  })
