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
  <!--
    Not a <button>: the trigger sits inside each field's wrapping <label>, and
    a button (labelable element) placed before the field's input becomes the
    label's implicit control — every click on the caption or the input's
    chrome (e.g. a Select chevron) would synthesize a click here and toggle
    the popover. @click.prevent stops the reverse forwarding: activating the
    trigger must not click the label's real control (e.g. a ToggleSwitch).
  -->
  <span
    role="button"
    tabindex="0"
    class="help-popover-trigger help-trigger-icon"
    :aria-label="t('help.ui.fieldHelp')"
    :data-testid="`field-help-${field}`"
    @click.prevent="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <i class="pi pi-question-circle" />
  </span>
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
/* Positioning + text-selection guard only; the muted-icon look comes from the
   shared .help-trigger-icon utility in styles/builder.css. */
.help-popover-trigger {
  margin-inline-start: var(--odk-spacing-s);
  user-select: none;
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
