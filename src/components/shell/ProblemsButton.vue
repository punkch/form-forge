<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, useTemplateRef } from 'vue'

import { displayText } from '@/core/model/display'
import { isSheetScope, scopeNodeId, type Issue, type IssueSeverity } from '@/core/validate'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const editor = useEditorStore()
const { t } = useAppI18n()

const popover = useTemplateRef<InstanceType<typeof Popover>>('popover')

/** Where a grouped issue points: a node chip (navigable) or a scope word. */
interface IssueLocation {
  label: string
  nodeId?: string
}

interface IssueGroup {
  severity: IssueSeverity
  message: string
  locations: IssueLocation[]
}

const locationOf = (issue: Issue): IssueLocation => {
  const scope = issue.scope
  if (isSheetScope(scope)) return { label: t('shell.problems.scopeSheet') }
  const nodeId = scopeNodeId(scope)
  if (nodeId !== undefined) {
    const node = form.getNode(nodeId)
    if (node !== null) {
      const label = displayText(node.label, editor.displayLanguage ?? undefined)
      return { label: label === '' ? node.name : label, nodeId }
    }
    return { label: t('shell.problems.scopeForm'), nodeId }
  }
  if (scope.listName !== undefined) return { label: scope.listName }
  if (scope.language !== undefined) return { label: t('shell.problems.scopeTranslations') }
  if (scope.setting !== undefined) return { label: t('shell.problems.scopeSettings') }
  return { label: t('shell.problems.scopeForm') }
}

/** Issues sharing code + message collapse into one row with a chip per site. */
const groups = computed<IssueGroup[]>(() => {
  const map = new Map<string, IssueGroup>()
  for (const issue of form.issues) {
    const key = `${issue.code}\n${issue.message}`
    const group = map.get(key)
    if (group === undefined) {
      map.set(key, { severity: issue.severity, message: issue.message, locations: [locationOf(issue)] })
    } else {
      group.locations.push(locationOf(issue))
    }
  }
  return [...map.values()]
})

const severityIcon = (severity: IssueSeverity): string => {
  switch (severity) {
    case 'error': return 'pi pi-times-circle issue-error'
    case 'warning': return 'pi pi-exclamation-triangle issue-warning'
    default: return 'pi pi-info-circle issue-info'
  }
}

const goTo = (location: IssueLocation): void => {
  if (location.nodeId !== undefined) {
    editor.select(location.nodeId)
    document.querySelector(`[data-node-id="${location.nodeId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  popover.value?.hide()
}

const toggle = (event: Event): void => { popover.value?.toggle(event) }
</script>

<template>
  <span>
    <Button
      v-tooltip.bottom="t('shell.problems.title')"
      :severity="form.errorCount > 0 ? 'danger' : form.issues.length === 0 ? 'success' : 'secondary'"
      text
      :aria-label="t('shell.problems.title')"
      data-testid="problems-button"
      @click="toggle"
    >
      <i :class="form.errorCount > 0 ? 'pi pi-times-circle' : form.warningCount > 0 ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'" />
      <span>{{ form.issues.length > 0 ? String(form.issues.length) : t('shell.problems.ready') }}</span>
      <i class="pi pi-chevron-down problems-chevron" aria-hidden="true" />
    </Button>
    <Popover ref="popover">
      <div class="problems" data-testid="problems-list">
        <p v-if="groups.length === 0" class="problems-empty">{{ t('shell.problems.empty') }}</p>
        <div
          v-for="(group, i) in groups"
          :key="i"
          class="problem-row"
          data-testid="problem-row"
        >
          <i :class="severityIcon(group.severity)" />
          <div class="problem-body">
            <span class="problem-message">{{ group.message }}</span>
            <span class="problem-locations">
              <button
                v-for="(location, j) in group.locations"
                :key="j"
                class="problem-location"
                data-testid="problem-location"
                @click="goTo(location)"
              >{{ location.label }}</button>
            </span>
          </div>
        </div>
      </div>
    </Popover>
  </span>
</template>

<style scoped>
.problems-chevron {
  margin-inline-start: 2px;
  font-size: 0.7rem;
  opacity: 0.65;
}

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
  border-radius: var(--odk-radius);
  font-size: var(--odk-hint-font-size);
  color: var(--odk-text-color);
  text-align: start;
}

.problem-row i {
  margin-top: 2px;
}

.problem-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.problem-locations {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.problem-location {
  max-width: 100%;
  overflow: hidden;
  padding: 1px 8px;
  border: 1px solid var(--odk-border-color);
  border-radius: 999px;
  background: var(--odk-light-background-color);
  font-family: inherit;
  font-size: 0.75rem;
  color: var(--odk-muted-text-color);
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.problem-location:hover {
  border-color: var(--odk-primary-border-color);
  color: var(--odk-primary-text-color);
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
