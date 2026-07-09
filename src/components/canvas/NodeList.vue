<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

import TreeNodeCard from '@/components/canvas/TreeNodeCard.vue'
import { createNode } from '@/core/model/factory'
import type { FormDocument, FormNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const props = defineProps<{
  /** The actual reactive children array from the document. */
  list: FormNode[]
  parentId: string | null
  root?: boolean
}>()

const form = useFormStore()
const editor = useEditorStore()

type Incoming = FormNode | { paletteType: string }

/**
 * vue-draggable-plus emits a fresh array; we write it back into the reactive
 * document array in place. Palette clones ({ paletteType }) are materialized
 * into real nodes here.
 */
const onListUpdate = (value: Incoming[]): void => {
  if (form.doc === null) return
  let addedId: string | null = null
  const materialized = value.map((item) => {
    if ('paletteType' in item) {
      const node = createNode(form.doc as FormDocument, item.paletteType)
      addedId = node.id
      return node
    }
    return item
  })
  // The prop is the store-owned reactive children array; writing through it
  // (not replacing it) is the contract with vue-draggable-plus + undo
  // transactions.
  // eslint-disable-next-line vue/no-mutating-props
  props.list.splice(0, props.list.length, ...materialized)
  if (addedId !== null) {
    editor.select(addedId)
    editor.revealNodeId = addedId
  }
}

const onDragStart = (): void => { form.beginTransaction('Move question') }
const onDragEnd = (): void => { form.endTransaction() }
</script>

<template>
  <VueDraggable
    :model-value="props.list"
    group="questions"
    :animation="150"
    ghost-class="node-ghost"
    class="node-list"
    :class="{ 'node-list-root': props.root, 'node-list-empty': props.list.length === 0 }"
    :data-testid="props.root ? 'canvas-list' : `container-list-${props.parentId}`"
    @update:model-value="onListUpdate"
    @start="onDragStart"
    @end="onDragEnd"
  >
    <!-- pointer-events:none keeps the surrounding VueDraggable the drop target. -->
    <div
      v-if="props.root && props.list.length === 0"
      class="canvas-empty-state"
      data-testid="canvas-empty"
    >
      <i class="pi pi-inbox" aria-hidden="true" />
      <h3>Your form starts here</h3>
      <p>Drag a question type from the palette, or click one to add it.</p>
    </div>
    <TreeNodeCard v-for="node in props.list" :key="node.id" :node="node" />
  </VueDraggable>
</template>

<style scoped>
.node-list {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  min-height: 24px;
}

.node-list-empty {
  border: 1px dashed var(--odk-border-color);
  border-radius: var(--odk-radius);
  min-height: 48px;
}

/* Root empty drop zone doubles as the canvas empty state. */
.node-list-root.node-list-empty {
  border: 2px dashed var(--p-primary-300, #82c3e0);
  background: var(--odk-base-background-color);
  min-height: 260px;
  justify-content: center;
  padding: var(--odk-spacing-xl);
}

.canvas-empty-state {
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--odk-spacing-s);
  text-align: center;
  color: var(--odk-muted-text-color);
}

.canvas-empty-state i {
  font-size: 2rem;
  color: var(--p-primary-400, #60b1d6);
  margin-bottom: var(--odk-spacing-s);
}

.canvas-empty-state h3 {
  margin: 0;
  font-size: var(--odk-question-font-size);
  color: var(--odk-text-color);
}

.canvas-empty-state p {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  max-width: 32ch;
}

.node-list :deep(.node-ghost) {
  opacity: 0.5;
}
</style>
