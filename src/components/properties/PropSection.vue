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
    <div class="prop-section-fold" :class="{ collapsed }">
      <div class="prop-section-fold-clip">
        <div class="prop-section-body" :data-testid="`prop-section-body-${sectionKey}`">
          <slot />
        </div>
      </div>
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
  transition: transform var(--builder-motion-duration-s) var(--builder-motion-ease-standard);
}

.prop-section-chevron.collapsed {
  transform: rotate(-90deg);
}

.prop-section-fold {
  display: grid;
  grid-template-rows: 1fr;
  transition:
    grid-template-rows var(--builder-motion-duration-m) var(--builder-motion-ease-standard),
    visibility 0s;
}

/* Delayed visibility swap removes collapsed content from the a11y tree and tab
   order once the fold finishes — same net effect display:none had. */
.prop-section-fold.collapsed {
  grid-template-rows: 0fr;
  visibility: hidden;
  transition:
    grid-template-rows var(--builder-motion-duration-m) var(--builder-motion-ease-standard),
    visibility 0s var(--builder-motion-duration-m);
}

/* Padding-free clip layer: .prop-section-body's padding would otherwise floor the
   collapsed height at its padding box. */
.prop-section-fold-clip {
  overflow: hidden;
  min-height: 0;
}

.prop-section-body {
  padding: var(--odk-spacing-s) var(--odk-spacing-l) var(--odk-spacing-l);
}
</style>
