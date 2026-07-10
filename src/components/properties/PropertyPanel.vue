<script setup lang="ts">
import { computed } from 'vue'

import BasicSection from '@/components/properties/BasicSection.vue'
import ChoicesSection from '@/components/properties/ChoicesSection.vue'
import LogicSection from '@/components/properties/LogicSection.vue'
import PropSection from '@/components/properties/PropSection.vue'
import TypeConfigSection, { hasTypeConfig } from '@/components/properties/TypeConfigSection.vue'
import { getQuestionType } from '@/core/registry/question-types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

withDefaults(defineProps<{
  /** Collapsed to a slim rail (docked layouts with no selection). */
  railed?: boolean
}>(), { railed: false })

const { t } = useAppI18n()

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
  <aside class="property-panel" :class="{ railed }" :aria-label="t('properties.panel.ariaLabel')" data-testid="property-panel">
    <div
      v-if="railed"
      v-tooltip.left="t('properties.panel.railTooltip')"
      class="property-rail"
      data-testid="property-rail"
    >
      <i class="pi pi-sliders-h" />
    </div>

    <div v-else-if="node === null" class="property-empty">
      <i class="pi pi-sliders-h" />
      <p>{{ t('properties.panel.empty') }}</p>
    </div>

    <template v-else>
      <header class="property-header">
        <i :class="def?.icon ?? 'pi pi-question'" />
        <span>{{ def?.title ?? node.kind }}</span>
        <code class="property-header-name">{{ node.name }}</code>
      </header>
      <div class="property-sections">
        <PropSection :title="t('properties.panel.sectionBasics')" section-key="basics">
          <BasicSection :key="`basic-${node.id}`" :node="node" />
        </PropSection>
        <PropSection v-if="hasTypeConfig(def)" :title="t('properties.panel.sectionAppearance')" section-key="appearance">
          <TypeConfigSection :key="`config-${node.id}`" :node="node" />
        </PropSection>
        <PropSection
          v-if="node.kind === 'question' && def?.requiresChoices"
          :title="t('properties.panel.sectionChoices')"
          section-key="choices"
        >
          <ChoicesSection :key="`choices-${node.id}`" :node="node" />
        </PropSection>
        <PropSection :title="t('properties.panel.sectionLogic')" section-key="logic">
          <LogicSection :key="`logic-${node.id}`" :node="node" />
        </PropSection>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.property-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background: var(--odk-base-background-color);
  border-inline-start: var(--builder-panel-border);
}

.property-rail {
  flex: 1;
  display: flex;
  justify-content: center;
  padding-top: var(--odk-spacing-l);
  color: var(--odk-light-muted-text-color);
  font-size: var(--odk-icon-m);
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

.property-header-name {
  margin-inline-start: auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--odk-hint-font-size);
  font-weight: 400;
  color: var(--odk-muted-text-color);
}

.property-sections {
  flex: 1;
  overflow-y: auto;
  padding-bottom: var(--odk-spacing-l);
  display: flex;
  flex-direction: column;
}
</style>
