<script setup lang="ts">
import { computed, ref } from 'vue'
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'

import TreeNodeCard from '@/components/canvas/TreeNodeCard.vue'
import { createNode } from '@/core/model/factory'
import { gatherNodesAfter } from '@/core/model/multi-ops'
import { topMostNodes } from '@/core/model/ops'
import type { FormDocument, FormNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
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
const { t } = useAppI18n()

/**
 * The tree/group ARIA contract in one place: the ROOT list is the canvas
 * `role="tree"` (multiselectable, labelled), every nested container list is a
 * `role="group"` inside its parent treeitem. Never an unconditional tree —
 * NodeList is recursive and nested trees are invalid.
 */
const treeAria = computed(() =>
  props.root
    ? { role: 'tree', 'aria-multiselectable': 'true', 'aria-label': t('shell.editor.formStructure') }
    : { role: 'group' }
)

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

/** Set in onDragStart, consumed in onDragEnd of the SAME list instance
 * (SortableJS fires both lifecycle events on the sortable the drag
 * originated from, even for a cross-list drop into a nested group's own
 * NodeList) — a plain component-scoped ref is enough. */
const draggedNodeId = ref<string | null>(null)

const onDragStart = (evt: DraggableEvent): void => {
  draggedNodeId.value = evt.item.dataset.nodeId ?? null
  form.beginTransaction(t('canvas.nodeList.moveQuestion'))
}

const onDragEnd = (): void => {
  const draggedId = draggedNodeId.value
  draggedNodeId.value = null
  // The dragged card itself already landed via vdp's model-value splice
  // (onListUpdate, above) by the time @end fires. When it was part of a
  // larger selection, gather the rest of that selection right after it —
  // directly on the live doc, INSIDE the begin/endTransaction bracket, never
  // via mutate() (that would fork a second undo entry).
  if (
    form.doc !== null && draggedId !== null &&
    editor.selectedNodeIds.size > 1 && editor.selectedNodeIds.has(draggedId) &&
    topMostNodes(form.doc as FormDocument, editor.selectedNodeIds).some((n) => n.id === draggedId)
  ) {
    gatherNodesAfter(form.doc as FormDocument, editor.selectedNodeIds, draggedId)
  }
  form.endTransaction()
}
</script>

<template>
  <VueDraggable
    :model-value="props.list"
    group="questions"
    :animation="150"
    ghost-class="node-ghost"
    target=".node-list"
    class="node-list-host"
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
      <h3>{{ t('canvas.nodeList.emptyTitle') }}</h3>
      <p>{{ t('canvas.nodeList.emptyHint') }}</p>
    </div>
    <TransitionGroup
      tag="div"
      name="node-item"
      class="node-list"
      v-bind="treeAria"
    >
      <TreeNodeCard v-for="node in props.list" :key="node.id" :node="node" />
    </TransitionGroup>
  </VueDraggable>
</template>

<style scoped>
.node-list-host {
  display: flex;
  flex-direction: column;
}

.node-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  min-height: 24px;
  flex: 1;
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

.node-item-enter-active {
  transition:
    opacity var(--builder-motion-duration-m) var(--builder-motion-ease-enter),
    transform var(--builder-motion-duration-m) var(--builder-motion-ease-enter);
}

.node-item-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.node-item-leave-active {
  position: absolute;
  width: 100%;
  pointer-events: none;
  transition: opacity var(--builder-motion-duration-s) var(--builder-motion-ease-exit);
}

.node-item-leave-to {
  opacity: 0;
}

.node-item-move {
  transition: transform var(--builder-motion-duration-m) var(--builder-motion-ease-standard);
}
</style>
