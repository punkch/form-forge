<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getAllQuestionTypes,
  type QuestionTypeDefinition,
} from '@/core/registry/question-types'

const emit = defineEmits<{ add: [type: string] }>()

const search = ref('')

interface PaletteGroup {
  category: string
  label: string
  items: QuestionTypeDefinition[]
}

const groups = computed<PaletteGroup[]>(() => {
  const needle = search.value.trim().toLowerCase()
  const all = getAllQuestionTypes().filter((def) =>
    needle === '' ||
    def.title.toLowerCase().includes(needle) ||
    def.type.toLowerCase().includes(needle) ||
    def.description.toLowerCase().includes(needle)
  )
  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: all.filter((def) => def.category === category),
    }))
    .filter((group) => group.items.length > 0)
})

// vue-draggable-plus needs a mutable array per group; palette lists are
// pull-only clones so the arrays themselves never change.
const paletteLists = computed(() => groups.value.map((g) => ({ ...g, items: [...g.items] })))

const cloneAsType = (def: QuestionTypeDefinition): { paletteType: string } =>
  ({ paletteType: def.type })
</script>

<template>
  <aside class="palette" aria-label="Question types" data-testid="palette">
    <div class="palette-search">
      <InputText
        v-model="search"
        placeholder="Search question types"
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
          <button
            v-for="def in group.items"
            :key="def.type"
            v-tooltip.right="def.description"
            class="palette-item"
            :data-testid="`palette-item-${def.type}`"
            @click="emit('add', def.type)"
            @keyup.enter="emit('add', def.type)"
          >
            <i :class="[def.icon, `cat-${def.category}`]" />
            <span>{{ def.title }}</span>
          </button>
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
  border-right: var(--builder-panel-border);
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

.palette-item {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  width: 100%;
  padding: 6px var(--odk-spacing-m);
  border: none;
  border-radius: var(--odk-radius);
  background: none;
  font-family: inherit;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-text-color);
  text-align: left;
  cursor: grab;
}

.palette-item:hover {
  background: var(--odk-primary-lighter-background-color);
}

.palette-item i {
  color: var(--builder-cat-meta);
  font-size: var(--odk-icon-s);
}

/* Registry category keys match the --builder-cat-* var names one-to-one. */
.palette-item i.cat-input { color: var(--builder-cat-input); }
.palette-item i.cat-select { color: var(--builder-cat-select); }
.palette-item i.cat-datetime { color: var(--builder-cat-datetime); }
.palette-item i.cat-media { color: var(--builder-cat-media); }
.palette-item i.cat-location { color: var(--builder-cat-location); }
.palette-item i.cat-display { color: var(--builder-cat-display); }
.palette-item i.cat-structure { color: var(--builder-cat-structure); }
</style>
