<script setup lang="ts">
// Right-side help drawer for a single question type, driven by
// editor.activeDialog === 'help-type' + editor.helpTypeId (see openTypeHelp).
import Drawer from 'primevue/drawer'
import { computed } from 'vue'

import QuestionTypeHelpContent from '@/components/help/QuestionTypeHelpContent.vue'
import { getQuestionType } from '@/core/registry/question-types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

const { t } = useAppI18n()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'help-type',
  set: (open: boolean) => { editor.activeDialog = open ? 'help-type' : null },
})

const def = computed(() =>
  editor.helpTypeId === null ? undefined : getQuestionType(editor.helpTypeId))
</script>

<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    :style="{ width: '26rem', maxWidth: '92vw' }"
    data-testid="help-drawer"
  >
    <template #header>
      <div v-if="def" class="help-drawer-header">
        <i :class="[def.icon, `cat-${def.category}`]" />
        <span class="help-drawer-title">{{ def.title }}</span>
        <code class="help-drawer-token">{{ def.type }}</code>
      </div>
      <span v-else>{{ t('help.ui.openHelp') }}</span>
    </template>
    <QuestionTypeHelpContent v-if="def" :def="def" />
  </Drawer>
</template>

<style scoped>
.help-drawer-header {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  min-width: 0;
}

.help-drawer-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.help-drawer-token {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
  background: var(--odk-muted-background-color);
  border-radius: var(--odk-radius);
  padding: 1px 6px;
}

/* Category color comes from the shared i.cat-* rules in styles/builder.css. */
.help-drawer-header i {
  font-size: var(--odk-icon-s);
}
</style>
