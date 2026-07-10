<script setup lang="ts">
// Small "?" affordance for a property-panel field: a popover explaining what
// the field does and the XLSForm column it maps to. Rendered inline after the
// field caption in the property-panel sections.
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import { fieldHelp, type HelpFieldKey } from '@/help/content'
import { useAppI18n } from '@/i18n'

const props = defineProps<{ field: HelpFieldKey }>()

const { t } = useAppI18n()

const popover = ref<InstanceType<typeof Popover> | null>(null)
const entry = computed(() => fieldHelp[props.field])

const toggle = (event: Event): void => { popover.value?.toggle(event) }
</script>

<template>
  <button
    type="button"
    class="help-popover-trigger"
    :aria-label="t('help.ui.fieldHelp')"
    :data-testid="`field-help-${field}`"
    @click="toggle"
  >
    <i class="pi pi-question-circle" />
  </button>
  <Popover ref="popover" :style="{ maxWidth: '20rem' }">
    <div class="help-popover-body" :data-testid="`field-help-body-${field}`">
      <p>{{ t(entry.whatItIs) }}</p>
      <p class="help-popover-column">
        <span>{{ t('help.ui.popover.xlsformColumn') }}</span>
        <code>{{ t(entry.xlsformColumn) }}</code>
      </p>
    </div>
  </Popover>
</template>

<style scoped>
.help-popover-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-inline-start: var(--odk-spacing-s);
  padding: 0;
  border: none;
  background: none;
  color: var(--odk-light-muted-text-color);
  font-size: var(--odk-hint-font-size);
  vertical-align: middle;
  cursor: pointer;
  border-radius: 50%;
}

.help-popover-trigger:hover,
.help-popover-trigger:focus-visible {
  color: var(--odk-primary-text-color);
}

.help-popover-body {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  font-size: var(--odk-hint-font-size);
}

.help-popover-body p {
  margin: 0;
  line-height: 1.5;
}

.help-popover-column {
  display: flex;
  align-items: baseline;
  gap: var(--odk-spacing-s);
  color: var(--odk-muted-text-color);
}

.help-popover-column code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: var(--odk-muted-background-color);
  border-radius: var(--odk-radius);
  padding: 1px 4px;
  color: var(--odk-text-color);
}
</style>
