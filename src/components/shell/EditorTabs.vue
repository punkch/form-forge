<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()

const TABS = [
  { pane: 'canvas', label: 'Canvas', icon: 'pi pi-list' },
  { pane: 'properties', label: 'Properties', icon: 'pi pi-sliders-h' },
  { pane: 'preview', label: 'Preview', icon: 'pi pi-eye' },
] as const
</script>

<template>
  <nav class="editor-tabs" aria-label="Editor panes" data-testid="editor-tabs">
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
      <span>{{ tab.label }}</span>
      <span
        v-if="tab.pane === 'properties' && editor.selectedNodeId !== null"
        class="editor-tab-dot"
        aria-label="A question is selected"
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
