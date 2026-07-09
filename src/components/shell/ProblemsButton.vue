<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, useTemplateRef } from 'vue'

import type { Issue } from '@/core/validate'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const editor = useEditorStore()

const popover = useTemplateRef<InstanceType<typeof Popover>>('popover')

const warningCount = computed(() => form.issues.filter((i) => i.severity === 'warning').length)

const severityIcon = (issue: Issue): string => {
  switch (issue.severity) {
    case 'error': return 'pi pi-times-circle issue-error'
    case 'warning': return 'pi pi-exclamation-triangle issue-warning'
    default: return 'pi pi-info-circle issue-info'
  }
}

const goTo = (issue: Issue): void => {
  if ('nodeId' in issue.scope && issue.scope.nodeId !== undefined) {
    editor.select(issue.scope.nodeId)
    document.querySelector(`[data-node-id="${issue.scope.nodeId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  popover.value?.hide()
}

const toggle = (event: Event): void => { popover.value?.toggle(event) }
</script>

<template>
  <span>
    <Button
      v-tooltip.bottom="'Problems'"
      :icon="form.errorCount > 0 ? 'pi pi-times-circle' : warningCount > 0 ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'"
      :severity="form.errorCount > 0 ? 'danger' : 'secondary'"
      text
      :label="form.issues.length > 0 ? String(form.issues.length) : undefined"
      aria-label="Problems"
      data-testid="problems-button"
      @click="toggle"
    />
    <Popover ref="popover">
      <div class="problems" data-testid="problems-list">
        <p v-if="form.issues.length === 0" class="problems-empty">No problems found.</p>
        <button
          v-for="(issue, i) in form.issues"
          :key="i"
          class="problem-row"
          @click="goTo(issue)"
        >
          <i :class="severityIcon(issue)" />
          <span>{{ issue.message }}</span>
        </button>
      </div>
    </Popover>
  </span>
</template>

<style scoped>
.problems {
  max-width: 420px;
  max-height: 50vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.problems-empty {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.problem-row {
  display: flex;
  align-items: flex-start;
  gap: var(--odk-spacing-s);
  padding: 6px 8px;
  border: none;
  border-radius: var(--odk-radius);
  background: none;
  font-family: inherit;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-text-color);
  text-align: left;
  cursor: pointer;
}

.problem-row:hover {
  background: var(--odk-light-background-color);
}

.problem-row i {
  margin-top: 2px;
}

.issue-error {
  color: var(--odk-error-text-color);
}

.issue-warning {
  color: var(--odk-warning-text-color);
}

.issue-info {
  color: var(--odk-muted-text-color);
}
</style>
