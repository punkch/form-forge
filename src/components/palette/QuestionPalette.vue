<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { type QuestionTypeDefinition } from '@/core/registry/question-types'
import { groupTypesBySearch } from '@/help/search'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

const emit = defineEmits<{ add: [type: string] }>()

const { t } = useAppI18n()
const editor = useEditorStore()

const search = ref('')

const groups = computed(() => groupTypesBySearch(search.value))

// vue-draggable-plus needs a mutable array per group; palette lists are
// pull-only clones so the arrays themselves never change.
const paletteLists = computed(() => groups.value.map((g) => ({ ...g, items: [...g.items] })))

const cloneAsType = (def: QuestionTypeDefinition): { paletteType: string } =>
  ({ paletteType: def.type })
</script>

<template>
  <aside class="palette" :aria-label="t('palette.questionPalette.ariaLabel')" data-testid="palette">
    <div class="palette-search">
      <InputText
        v-model="search"
        :placeholder="t('palette.questionPalette.searchPlaceholder')"
        size="small"
        fluid
        data-testid="palette-search"
      />
    </div>
    <div class="palette-groups">
      <section v-for="group in paletteLists" :key="group.category" class="palette-group">
        <h3 class="palette-group-title">{{ group.label }}</h3>
        <VueDraggable
          :model-value="group.items"
          :group="{ name: 'questions', pull: 'clone', put: false }"
          :sort="false"
          :clone="cloneAsType"
          class="palette-items"
        >
          <div v-for="def in group.items" :key="def.type" class="palette-item-row">
            <button
              v-tooltip.right="def.description"
              class="palette-item"
              :data-testid="`palette-item-${def.type}`"
              @click="emit('add', def.type)"
              @keyup.enter="emit('add', def.type)"
            >
              <i :class="[def.icon, `cat-${def.category}`]" />
              <span>{{ def.title }}</span>
            </button>
            <button
              class="palette-item-info"
              :aria-label="t('help.ui.typeHelp', { title: def.title })"
              :data-testid="`palette-item-info-${def.type}`"
              @click.stop="editor.openTypeHelp(def.type)"
            >
              <i class="pi pi-question-circle" />
            </button>
          </div>
        </VueDraggable>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.palette {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--builder-panel-bg);
  border-inline-end: var(--builder-panel-border);
}

.palette-search {
  padding: var(--odk-spacing-m);
  border-bottom: var(--builder-panel-border);
}

.palette-groups {
  flex: 1;
  overflow-y: auto;
  padding: var(--odk-spacing-m);
}

.palette-group-title {
  margin: var(--odk-spacing-m) 0 var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--odk-muted-text-color);
}

.palette-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.palette-item-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  flex: 1;
  min-width: 0;
  padding: 6px var(--odk-spacing-m);
  border: none;
  border-radius: var(--odk-radius);
  background: none;
  font-family: inherit;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-text-color);
  text-align: start;
  cursor: grab;
}

.palette-item:hover {
  background: var(--odk-primary-lighter-background-color);
}

/* The per-type help affordance stays quiet until the row is engaged. */
.palette-item-info {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--odk-radius);
  background: none;
  color: var(--odk-light-muted-text-color);
  font-size: var(--odk-hint-font-size);
  cursor: pointer;
  opacity: 0;
}

.palette-item-row:hover .palette-item-info,
.palette-item-row:focus-within .palette-item-info {
  opacity: 1;
}

.palette-item-info:hover,
.palette-item-info:focus-visible {
  color: var(--odk-primary-text-color);
  background: var(--odk-primary-lighter-background-color);
}

@media (hover: none) {
  .palette-item-info {
    opacity: 1;
  }
}

/* Category color comes from the shared i.cat-* rules in styles/builder.css. */
.palette-item i {
  font-size: var(--odk-icon-s);
}
</style>
