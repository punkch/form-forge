<script setup lang="ts">
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()
const { t } = useAppI18n()

const TABS = [
  { pane: 'canvas', labelKey: 'shell.tabs.canvas', icon: 'pi pi-list' },
  { pane: 'properties', labelKey: 'shell.tabs.properties', icon: 'pi pi-sliders-h' },
  { pane: 'preview', labelKey: 'shell.tabs.preview', icon: 'pi pi-eye' },
] as const
</script>

<template>
  <nav class="editor-tabs" :aria-label="t('shell.tabs.panes')" data-testid="editor-tabs">
    <button
      v-for="tab in TABS"
      :key="tab.pane"
      class="editor-tab"
      :class="{ active: editor.activePane === tab.pane }"
      :aria-pressed="editor.activePane === tab.pane"
      :data-testid="`editor-tab-${tab.pane}`"
      @click="editor.activePane = tab.pane"
    >
      <i :class="tab.icon" />
      <span>{{ t(tab.labelKey) }}</span>
      <span
        v-if="tab.pane === 'properties' && editor.selectedNodeId !== null"
        class="editor-tab-dot"
        :aria-label="t('shell.tabs.questionSelected')"
      />
    </button>
  </nav>
</template>

<style scoped>
.editor-tabs {
  display: flex;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s) var(--odk-spacing-l);
  background: var(--odk-base-background-color);
  border-bottom: var(--builder-panel-border);
  flex-shrink: 0;
}

.editor-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s) var(--odk-spacing-l);
  border: 1px solid transparent;
  border-radius: var(--odk-radius);
  background: transparent;
  color: var(--odk-muted-text-color);
  font-family: inherit;
  font-size: var(--odk-hint-font-size);
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--builder-motion-duration-xs) var(--builder-motion-ease-standard),
    color var(--builder-motion-duration-xs) var(--builder-motion-ease-standard);
}

.editor-tab:hover {
  background: var(--odk-muted-background-color);
}

.editor-tab.active {
  background: var(--p-primary-50, #e9f8ff);
  border-color: var(--p-primary-200, #a5d4eb);
  color: var(--p-primary-700, #297193);
}

.editor-tab-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--p-primary-500, #3e9fcc);
}
</style>
