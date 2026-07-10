<script setup lang="ts">
// Inline, dismissable first-use callout for the silent-data-change traps
// (Translations display-language retargeting, logic builder forced raw mode).
// Visibility is driven by the persisted ui-store pref, so one dismissal hides
// the callout everywhere and survives reload. The default slot lets a call
// site carry extras such as a "learn more" GuideTrigger.
import Button from 'primevue/button'
import { computed } from 'vue'

import { type CalloutId } from '@/help/content'
import { useAppI18n, type MessageKey } from '@/i18n'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ id: CalloutId }>()

const { t } = useAppI18n()
const ui = useUiStore()

// Callout copy lives at guides.callouts.<id>.{title,body}.
const titleKey = computed<MessageKey>(() => `guides.callouts.${props.id}.title`)
const bodyKey = computed<MessageKey>(() => `guides.callouts.${props.id}.body`)
</script>

<template>
  <div
    v-if="!ui.isCalloutDismissed(id)"
    role="note"
    class="guide-callout"
    :data-testid="`guide-callout-${id}`"
  >
    <i class="pi pi-info-circle guide-callout-icon" />
    <div class="guide-callout-text">
      <p class="guide-callout-title">{{ t(titleKey) }}</p>
      <p class="guide-callout-body">{{ t(bodyKey) }}</p>
      <slot />
    </div>
    <Button
      icon="pi pi-times"
      severity="secondary"
      text
      rounded
      size="small"
      :aria-label="t('guides.ui.dismissCallout')"
      :data-testid="`guide-callout-dismiss-${id}`"
      @click="ui.dismissCallout(id)"
    />
  </div>
</template>

<style scoped>
.guide-callout {
  display: flex;
  align-items: flex-start;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-light-background-color);
  font-size: var(--odk-hint-font-size);
}

.guide-callout-icon {
  margin-top: 2px;
  color: var(--odk-primary-text-color);
}

.guide-callout-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  min-width: 0;
}

.guide-callout-title {
  margin: 0;
  font-weight: 500;
  color: var(--odk-text-color);
}

.guide-callout-body {
  margin: 0;
  line-height: 1.5;
  color: var(--odk-muted-text-color);
}
</style>
