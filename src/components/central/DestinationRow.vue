<script setup lang="ts">
/**
 * One published-destination row inside the Central drawer's per-form hub.
 *
 * PRESENTATIONAL ONLY — no store access, no network, no publish logic. It
 * renders a single `PublishTargetRecord`'s identity + last-published metadata,
 * a freshness chip (does the current form still match what this destination
 * last received?), and the action affordances, emitting intent for the parent
 * to act on. The parent owns all state: it resolves `serverName`, decides
 * `hasPassword` / `busy` / `freshness`, runs the reconcile fetch that produces
 * `checkLabel`, and injects the live publish-flow block through `#flow`.
 */
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { computed } from 'vue'

import type { FreshnessState } from '@/core/central/reconcile'
import { useAppI18n } from '@/i18n'
import type { PublishTargetRecord } from '@/persistence/db'

const props = defineProps<{
  /** The remembered destination this row represents. */
  target: PublishTargetRecord
  /** Server display name resolved by the parent ('' when the server is unknown). */
  serverName: string
  /** false → show the needs-password affordance instead of publish actions. */
  hasPassword: boolean
  /** Local compare of the current form against what this destination last received. */
  freshness: FreshnessState
  /** A publish flow is running anywhere → disable this row's actions. */
  busy: boolean
  /** Reconcile summary text to show under the actions (null → nothing shown). */
  checkLabel: string | null
  /** A Check-server call is in flight for this row. */
  checking: boolean
}>()

const emit = defineEmits<{
  republish: []
  check: []
}>()

const { t } = useAppI18n()

const freshnessSeverity = computed((): 'success' | 'warn' | 'secondary' => {
  if (props.freshness === 'fresh') return 'success'
  if (props.freshness === 'changed') return 'warn'
  return 'secondary'
})

const freshnessLabel = computed((): string => {
  if (props.freshness === 'fresh') return t('central.drawer.freshUpToDate')
  if (props.freshness === 'changed') return t('central.drawer.freshChanged')
  return t('central.drawer.freshUnknown')
})

// "Publish update" once the local form has drifted from what we last sent here,
// otherwise a plain "Re-publish" of the unchanged form.
const publishLabel = computed((): string =>
  props.freshness === 'changed'
    ? t('central.drawer.publishUpdate')
    : t('central.drawer.republish'))

const checkButtonLabel = computed((): string =>
  props.checking ? t('central.drawer.checking') : t('central.drawer.checkServer'))

// serverName · Project {id} · {xmlFormId}. The "Project" connector reuses the
// existing catalog key (contract endorses reusing central.publish.*) so no copy
// is hardcoded; the ids themselves are data.
const destinationMeta = computed((): string =>
  `${props.serverName} · ${t('central.publish.projectLabel')} ${props.target.projectId} · ${props.target.xmlFormId}`)

const lastPublishedLabel = computed((): string =>
  t('central.drawer.lastPublished', {
    version: props.target.lastPublishedVersion,
    time: new Date(props.target.lastPublishedAt).toLocaleString(),
  }))
</script>

<template>
  <div class="destination-row" :data-testid="`central-destination-${target.id}`">
    <div class="destination-head">
      <div class="destination-identity">
        <span class="destination-meta">{{ destinationMeta }}</span>
        <span class="destination-published">{{ lastPublishedLabel }}</span>
      </div>
      <Tag
        :value="freshnessLabel"
        :severity="freshnessSeverity"
        :data-testid="`central-freshness-${target.id}`"
      />
    </div>

    <div v-if="hasPassword" class="destination-actions-wrap">
      <div class="destination-actions">
        <Button
          :label="publishLabel"
          size="small"
          :disabled="busy"
          :data-testid="`central-republish-${target.id}`"
          @click="emit('republish')"
        />
        <Button
          :label="checkButtonLabel"
          severity="secondary"
          text
          size="small"
          :loading="checking"
          :disabled="busy"
          :data-testid="`central-check-${target.id}`"
          @click="emit('check')"
        />
      </div>
      <small v-if="checkLabel !== null" class="destination-check-label">{{ checkLabel }}</small>
    </div>

    <div v-else class="destination-needs-password">
      <Tag :value="t('central.drawer.needsPassword')" severity="secondary" />
      <small class="destination-hint">{{ t('central.drawer.needsPasswordHint') }}</small>
    </div>

    <slot name="flow" />
  </div>
</template>

<style scoped>
.destination-row {
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-base-background-color);
  padding: var(--odk-spacing-l);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.destination-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--odk-spacing-m);
}

.destination-identity {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-xs);
  min-width: 0;
}

.destination-meta {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.destination-published {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.destination-actions-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.destination-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--odk-spacing-m);
}

.destination-check-label {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.destination-needs-password {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-xs);
}

.destination-hint {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}
</style>
