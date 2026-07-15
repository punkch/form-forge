<script setup lang="ts">
/**
 * Presentational status block for one publish attempt — progress, 409-conflict
 * recovery offers, transport error, and success-with-warnings. Rendered inline
 * by the Central drawer next to whichever destination is publishing (an existing
 * row's `#flow` slot, or the new-destination form). Driven entirely by
 * `usePublishFlow` state passed in as props; it owns no logic and emits the two
 * recovery intents back to the flow.
 *
 * Reuses the `publish-*` data-testids from the retired PublishDialog so the
 * component tests migrate with their assertions intact.
 */
import Button from 'primevue/button'
import Message from 'primevue/message'

import type { CentralPublishResult, PublishMode } from '@/core/central/publish'
import type { CentralError } from '@/core/central/types'
import { useAppI18n } from '@/i18n'

defineProps<{
  publishing: boolean
  progressText: string
  conflict: CentralError | null
  conflictMode: PublishMode | null
  result: CentralPublishResult | null
  errorText: string
  serverName: string
  currentFormId: string
  currentVersion: string
  projectId: number | null
}>()

const emit = defineEmits<{ updateInstead: [], bump: [] }>()

const { t } = useAppI18n()
</script>

<template>
  <div class="flow-status">
    <p v-if="publishing && progressText !== ''" class="publish-progress" data-testid="publish-progress">
      {{ progressText }}
    </p>

    <Message
      v-if="conflict !== null"
      severity="error"
      :closable="false"
      class="publish-notice"
      data-testid="publish-conflict"
    >
      <div class="publish-conflict">
        <template v-if="conflictMode === 'create'">
          <strong>{{ t('central.publish.conflictTitle') }}</strong>
          <span>{{ t('central.publish.conflict', { formId: currentFormId, server: serverName }) }}</span>
        </template>
        <template v-else>
          <strong>{{ t('central.publish.conflictVersionTitle') }}</strong>
          <span>{{ t('central.publish.conflictVersion', { version: currentVersion, server: serverName }) }}</span>
        </template>
        <div class="publish-conflict-actions">
          <Button
            v-if="conflictMode === 'create'"
            :label="t('central.publish.updateInstead')"
            icon="pi pi-replay"
            size="small"
            :loading="publishing"
            data-testid="publish-update-instead"
            @click="emit('updateInstead')"
          />
          <Button
            :label="t('central.publish.bumpVersion')"
            icon="pi pi-arrow-up"
            size="small"
            severity="secondary"
            :loading="publishing"
            data-testid="publish-bump-version"
            @click="emit('bump')"
          />
        </div>
      </div>
    </Message>

    <Message
      v-if="errorText !== ''"
      severity="error"
      :closable="false"
      class="publish-notice"
      data-testid="publish-error"
    >
      {{ errorText }}
    </Message>

    <div v-if="result !== null" class="publish-result" data-testid="publish-result">
      <Message severity="success" :closable="false" class="publish-notice">
        {{ t('central.publish.success', { project: projectId ?? '', server: serverName }) }}
      </Message>
      <div v-if="result.warnings.length > 0" class="publish-warnings" data-testid="publish-warnings">
        <strong>{{ t('central.publish.warningsTitle') }}</strong>
        <p>{{ t('central.publish.warningsIntro') }}</p>
        <ul>
          <li v-for="(warning, i) in result.warnings" :key="i">{{ warning }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-status {
  display: flex;
  flex-direction: column;
}

.publish-progress {
  margin: var(--odk-spacing-m) 0 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.publish-notice {
  margin-top: var(--odk-spacing-m);
}

.publish-conflict {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  align-items: flex-start;
}

.publish-conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--odk-spacing-s);
}

.publish-result {
  display: flex;
  flex-direction: column;
}

.publish-warnings {
  margin-top: var(--odk-spacing-m);
  font-size: var(--odk-hint-font-size);
}

.publish-warnings ul {
  margin: var(--builder-spacing-xs) 0 0;
  padding-inline-start: var(--odk-spacing-l);
}
</style>
