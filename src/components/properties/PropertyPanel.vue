<script setup lang="ts">
import { computed } from 'vue'

import BasicSection from '@/components/properties/BasicSection.vue'
import ChoicesSection from '@/components/properties/ChoicesSection.vue'
import LogicSection from '@/components/properties/LogicSection.vue'
import TypeConfigSection from '@/components/properties/TypeConfigSection.vue'
import { getQuestionType } from '@/core/registry/question-types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const editor = useEditorStore()

const node = computed(() => form.getNode(editor.selectedNodeId))
const def = computed(() => {
  const n = node.value
  if (n === null) return undefined
  return getQuestionType(n.kind === 'question' ? n.type : n.kind)
})
</script>

<template>
  <aside class="property-panel" aria-label="Question properties" data-testid="property-panel">
    <div v-if="node === null" class="property-empty">
      <i class="pi pi-sliders-h" />
      <p>Select a question to edit its properties.</p>
    </div>

    <template v-else>
      <header class="property-header">
        <i :class="def?.icon ?? 'pi pi-question'" />
        <span>{{ def?.title ?? node.kind }}</span>
      </header>
      <div class="property-sections">
        <BasicSection :key="`basic-${node.id}`" :node="node" />
        <TypeConfigSection :key="`config-${node.id}`" :node="node" />
        <ChoicesSection
          v-if="node.kind === 'question' && def?.requiresChoices"
          :key="`choices-${node.id}`"
          :node="node"
        />
        <LogicSection :key="`logic-${node.id}`" :node="node" />
      </div>
    </template>
  </aside>
</template>

<style scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--odk-base-background-color);
  border-left: var(--builder-panel-border);
}

.property-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  text-align: center;
  padding: var(--odk-spacing-xl);
}

.property-empty i {
  font-size: 2rem;
  color: var(--odk-light-muted-text-color);
}

.property-header {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-l);
  border-bottom: var(--builder-panel-border);
  font-weight: 500;
}

.property-header i {
  color: var(--odk-muted-text-color);
}

.property-sections {
  flex: 1;
  overflow-y: auto;
  padding: var(--odk-spacing-l);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-xxl);
}
</style>
