<script setup lang="ts">
// Small "?" affordance for a property-panel field: a popover explaining what
// the field does and the XLSForm column it maps to. Rendered inline after the
// field caption in the property-panel sections. In "param" mode it instead
// explains one specific type-specific parameter, sourced straight from the
// registry (QuestionTypeParameter) so it can never drift from the help
// drawer's PARAMETERS table, which reads the same fields.
import Popover from 'primevue/popover'
import { computed, ref } from 'vue'

import type { QuestionTypeParameter } from '@/core/registry/question-types'
import { fieldHelp, type HelpFieldKey } from '@/help/content'
import { useAppI18n } from '@/i18n'

const props = defineProps<{ field?: HelpFieldKey, param?: QuestionTypeParameter }>()

const { t } = useAppI18n()

const popover = ref<InstanceType<typeof Popover> | null>(null)
const entry = computed(() => (props.field !== undefined ? fieldHelp[props.field] : undefined))

const testId = computed(() =>
  props.param !== undefined ? `field-help-param-${props.param.name}` : `field-help-${props.field}`
)
const bodyTestId = computed(() =>
  props.param !== undefined ? `field-help-body-param-${props.param.name}` : `field-help-body-${props.field}`
)

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
    :data-testid="testId"
    @click.prevent="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <i class="pi pi-question-circle" />
  </span>
  <Popover ref="popover" :style="{ maxWidth: '20rem' }">
    <div v-if="param" class="help-popover-body" :data-testid="bodyTestId">
      <p>{{ param.description }}</p>
      <p v-if="param.options" class="help-popover-column">
        <span>{{ t('help.ui.popover.optionsLabel') }}</span>
        <code>{{ param.options.join(', ') }}</code>
      </p>
      <p v-if="param.defaultValue !== undefined" class="help-popover-column">
        <span>{{ t('help.ui.popover.defaultLabel') }}</span>
        <code>{{ String(param.defaultValue) }}</code>
      </p>
      <p v-if="param.required" class="help-popover-required">{{ t('help.ui.popover.requiredLabel') }}</p>
      <p class="help-popover-column">{{ t('help.ui.popover.parameterMapping', { name: param.name }) }}</p>
      <p class="help-popover-hint">{{ t('help.ui.popover.syntaxHint') }}</p>
    </div>
    <div v-else class="help-popover-body" :data-testid="bodyTestId">
      <p>{{ t(entry!.whatItIs) }}</p>
      <p class="help-popover-column">
        <span>{{ t('help.ui.popover.xlsformColumn') }}</span>
        <code>{{ t(entry!.xlsformColumn) }}</code>
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

.help-popover-required {
  font-weight: 500;
}

.help-popover-hint {
  color: var(--odk-muted-text-color);
  font-size: 0.85em;
}
</style>
