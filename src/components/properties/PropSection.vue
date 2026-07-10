<script setup lang="ts">
import { computed } from 'vue'

import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  title: string
  /** Persistence key in ui.propSectionsCollapsed (basics|appearance|choices|logic). */
  sectionKey: string
}>()

const ui = useUiStore()

const collapsed = computed(() => ui.propSectionsCollapsed[props.sectionKey] === true)
</script>

<template>
  <section class="prop-section-block">
    <button
      type="button"
      class="prop-section-header"
      :aria-expanded="!collapsed"
      :data-testid="`prop-section-${sectionKey}`"
      @click="ui.toggleSection(sectionKey)"
    >
      <i class="pi pi-chevron-down prop-section-chevron" :class="{ collapsed }" aria-hidden="true" />
      <span>{{ title }}</span>
    </button>
    <div v-show="!collapsed" class="prop-section-body" :data-testid="`prop-section-body-${sectionKey}`">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.prop-section-block + .prop-section-block {
  border-top: 1px solid var(--odk-border-color);
}

.prop-section-header {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  width: 100%;
  padding: var(--odk-spacing-m) var(--odk-spacing-l);
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: start;
  color: var(--odk-muted-text-color);
}

.prop-section-header:hover {
  color: var(--odk-text-color);
}

.prop-section-chevron {
  font-size: 0.65rem;
  transition: transform 0.15s ease;
}

.prop-section-chevron.collapsed {
  transform: rotate(-90deg);
}

@media (prefers-reduced-motion: reduce) {
  .prop-section-chevron {
    transition: none;
  }
}

.prop-section-body {
  padding: var(--odk-spacing-s) var(--odk-spacing-l) var(--odk-spacing-l);
}
</style>
