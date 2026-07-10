<script setup lang="ts">
// Compact "?" button that opens the unified help drawer directly at one
// workflow guide (editor.openGuideHelp). Unlike HelpPopover — which avoids
// being a <button> because it sits inside a field's wrapping <label> — the
// guide triggers live in dialog/section headers and toolbars, never inside a
// labelable control, so a real <button> is correct here.
import type { GuideKey } from '@/help/content'
import { useAppI18n, type MessageKey } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

// With `label`, the button shows visible text next to the "?" and is named by
// that text; icon-only, it falls back to the generic "Open guide" aria-label.
const props = defineProps<{ guide: GuideKey, label?: MessageKey }>()

const { t } = useAppI18n()
const editor = useEditorStore()

const open = (): void => { editor.openGuideHelp(props.guide) }
</script>

<template>
  <button
    type="button"
    class="guide-trigger help-trigger-icon"
    :class="{ 'guide-trigger-labeled': label !== undefined }"
    :aria-label="label === undefined ? t('guides.ui.openGuide') : undefined"
    :data-testid="`guide-trigger-${guide}`"
    @click="open"
  >
    <span v-if="label !== undefined" class="guide-trigger-label">{{ t(label) }}</span>
    <i class="pi pi-question-circle" />
  </button>
</template>

<style scoped>
/* Button reset only; the muted-icon look comes from the shared
   .help-trigger-icon utility in styles/builder.css. */
.guide-trigger {
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
}

.guide-trigger-labeled {
  gap: var(--odk-spacing-s);
  border-radius: var(--odk-radius);
}

/* The visible label stays muted; only the icon brightens on hover/focus. */
.guide-trigger-label {
  color: var(--odk-muted-text-color);
}
</style>
