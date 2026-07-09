<script setup lang="ts">
import Button from 'primevue/button'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { displayText } from '@/core/model/display'
import { isContainer, type FormNode } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

// NodeList imports TreeNodeCard; break the cycle lazily in this direction.
const NodeList = defineAsyncComponent(() => import('@/components/canvas/NodeList.vue'))

const props = defineProps<{ node: FormNode }>()

const form = useFormStore()
const editor = useEditorStore()

const def = computed(() => getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind))
/** Registry category keys match the --builder-cat-* var names one-to-one. */
const category = computed(() => def.value?.category ?? 'meta')
const selected = computed(() => editor.selectedNodeId === props.node.id)
const container = computed(() => isContainer(props.node))
const collapsed = computed(() => editor.collapsedIds.has(props.node.id))
const label = computed(() => displayText(props.node.label, editor.displayLanguage ?? undefined))

const nodeIssues = computed(() => form.issuesByNode.get(props.node.id) ?? [])
const hasError = computed(() => nodeIssues.value.some((i) => i.severity === 'error'))

interface Badge { key: string, icon: string, title: string, text?: string }

const badges = computed<Badge[]>(() => {
  const out: Badge[] = []
  const node = props.node
  if (node.bind.required !== undefined) out.push({ key: 'required', icon: 'pi pi-asterisk', title: 'Required' })
  if (node.bind.readonly !== undefined) out.push({ key: 'readonly', icon: 'pi pi-lock', title: 'Read only' })
  if (node.bind.relevant !== undefined) out.push({ key: 'relevant', icon: 'pi pi-directions', title: `Relevant: ${node.bind.relevant}` })
  if (node.bind.constraint !== undefined) out.push({ key: 'constraint', icon: 'pi pi-verified', title: `Constraint: ${node.bind.constraint}` })
  if (node.bind.calculation !== undefined) out.push({ key: 'calculation', icon: 'pi pi-calculator', title: `Calculation: ${node.bind.calculation}` })
  if (node.body.appearance !== undefined) out.push({ key: 'appearance', icon: 'pi pi-palette', title: `Appearance: ${node.body.appearance}`, text: node.body.appearance })
  if (node.kind === 'question' && node.listRef !== undefined) {
    const count = form.doc?.choiceLists[node.listRef]?.choices.length
    out.push({ key: 'list', icon: 'pi pi-list', title: `Choice list: ${node.listRef}`, text: count !== undefined ? `${node.listRef} (${count})` : node.listRef })
  }
  if (node.kind === 'repeat' && node.repeatCount !== undefined) {
    out.push({ key: 'repeat-count', icon: 'pi pi-sync', title: `Repeat count: ${node.repeatCount}`, text: node.repeatCount })
  }
  return out
})

/** Scroll a freshly added card into view and flash it briefly. Cards watch
 * the shared reveal signal because the card for a new node mounts only after
 * the add commits (hence also the onMounted check). */
const justAdded = ref(false)
let justAddedTimer: ReturnType<typeof setTimeout> | null = null

const revealIfTargeted = (): void => {
  if (editor.revealNodeId !== props.node.id) return
  editor.revealNodeId = null
  void nextTick(() => {
    const el = document.querySelector<HTMLElement>(`[data-node-id="${props.node.id}"]`)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    justAdded.value = true
    if (justAddedTimer !== null) clearTimeout(justAddedTimer)
    justAddedTimer = setTimeout(() => { justAdded.value = false }, 900)
  })
}

onMounted(revealIfTargeted)
watch(() => editor.revealNodeId, revealIfTargeted)
onBeforeUnmount(() => {
  if (justAddedTimer !== null) clearTimeout(justAddedTimer)
})

/** Moves can remount the card (cross-list) — restore focus so keyboard
 * sequences like indent-then-move keep working. */
const refocus = (): void => {
  void nextTick(() => {
    const el = document.querySelector<HTMLElement>(`[data-node-id="${props.node.id}"]`)
    el?.focus()
  })
}

const onCardKeydown = (event: KeyboardEvent): void => {
  if (event.altKey && event.key === 'ArrowUp') {
    event.preventDefault(); event.stopPropagation(); form.moveBy(props.node.id, -1); refocus()
  } else if (event.altKey && event.key === 'ArrowDown') {
    event.preventDefault(); event.stopPropagation(); form.moveBy(props.node.id, 1); refocus()
  } else if (event.altKey && event.key === 'ArrowRight') {
    event.preventDefault(); event.stopPropagation(); form.indent(props.node.id); refocus()
  } else if (event.altKey && event.key === 'ArrowLeft') {
    event.preventDefault(); event.stopPropagation(); form.outdent(props.node.id); refocus()
  } else if (event.key === 'Delete') {
    event.preventDefault(); event.stopPropagation(); form.removeNodeById(props.node.id)
  } else if (!event.altKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    // Roving focus through the visible cards in document order.
    event.preventDefault(); event.stopPropagation()
    const cards = [...document.querySelectorAll<HTMLElement>('.node-card[data-node-id]')]
    const index = cards.findIndex((el) => el.dataset.nodeId === props.node.id)
    cards[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus()
  }
}

const select = (): void => { editor.select(props.node.id) }
</script>

<template>
  <div
    class="node-card"
    :class="{ selected, 'is-group': node.kind === 'group', 'is-repeat': node.kind === 'repeat', 'has-error': hasError, 'just-added': justAdded }"
    tabindex="0"
    role="treeitem"
    :aria-selected="selected"
    :aria-label="`${def?.title ?? node.kind}: ${label || node.name}`"
    :data-testid="`node-card-${node.name}`"
    :data-node-id="node.id"
    @click.stop="select"
    @focus="select"
    @keydown="onCardKeydown"
  >
    <div class="node-card-row">
      <Button
        v-if="container"
        :icon="collapsed ? 'pi pi-chevron-right' : 'pi pi-chevron-down'"
        severity="secondary"
        text
        rounded
        size="small"
        class="collapse-toggle"
        :aria-label="collapsed ? 'Expand' : 'Collapse'"
        @click.stop="editor.toggleExpanded(node.id)"
      />
      <span class="type-chip" :class="`cat-${category}`" :title="def?.title ?? node.kind">
        <i :class="def?.icon ?? 'pi pi-question'" />
      </span>
      <div class="node-main">
        <span class="node-label">{{ label || '—' }}</span>
        <span class="node-meta">
          <span class="node-type">{{ def?.title ?? (node.kind === 'question' ? node.type : node.kind) }}</span>
          <code class="node-name">{{ node.name }}</code>
        </span>
      </div>
      <span class="node-badges">
        <i v-if="hasError" class="pi pi-exclamation-circle badge-error" title="Has errors" />
        <span
          v-for="badge in badges"
          :key="badge.key"
          v-tooltip.top="badge.title"
          class="node-badge"
        >
          <i :class="badge.icon" />
          <span v-if="badge.text" class="badge-text">{{ badge.text }}</span>
        </span>
      </span>
      <span class="node-actions">
        <Button
          icon="pi pi-copy"
          severity="secondary"
          text
          rounded
          size="small"
          aria-label="Duplicate"
          @click.stop="form.duplicateNodeById(node.id)"
        />
        <Button
          icon="pi pi-trash"
          severity="secondary"
          text
          rounded
          size="small"
          aria-label="Delete"
          data-testid="delete-node"
          @click.stop="form.removeNodeById(node.id)"
        />
      </span>
    </div>

    <div v-if="container && !collapsed" class="node-children">
      <NodeList v-if="isContainer(node)" :list="node.children" :parent-id="node.id" />
    </div>
  </div>
</template>

<style scoped>
.node-card {
  background: var(--odk-base-background-color);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  padding: var(--odk-spacing-m) var(--odk-spacing-l);
  cursor: pointer;
}

.node-card:hover {
  border-color: var(--p-primary-300);
}

.node-card.selected {
  border-color: var(--odk-primary-border-color);
  box-shadow: 0 0 0 1px var(--odk-primary-border-color);
}

.node-card.has-error {
  border-color: var(--odk-error-text-color);
}

.node-card.is-group {
  border-left: 4px solid var(--p-primary-500);
}

.node-card.is-repeat {
  border-left: 4px solid var(--p-orange-500, #f97316);
}

.node-card.just-added {
  animation: just-added-flash 900ms ease-out;
}

@keyframes just-added-flash {
  from {
    background: var(--p-primary-50, #e9f8ff);
    box-shadow: 0 0 0 2px var(--p-primary-200, #a5d4eb);
  }

  to {
    background: var(--odk-base-background-color);
    box-shadow: none;
  }
}

.node-card-row {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  min-height: 32px;
}

.collapse-toggle {
  margin-left: calc(-1 * var(--odk-spacing-s));
}

.type-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--odk-radius);
  background: var(--builder-cat-meta-tint);
  color: var(--builder-cat-meta);
  flex-shrink: 0;
}

.type-chip i {
  font-size: var(--odk-icon-m);
}

.type-chip.cat-input { background: var(--builder-cat-input-tint); color: var(--builder-cat-input); }
.type-chip.cat-select { background: var(--builder-cat-select-tint); color: var(--builder-cat-select); }
.type-chip.cat-datetime { background: var(--builder-cat-datetime-tint); color: var(--builder-cat-datetime); }
.type-chip.cat-media { background: var(--builder-cat-media-tint); color: var(--builder-cat-media); }
.type-chip.cat-location { background: var(--builder-cat-location-tint); color: var(--builder-cat-location); }
.type-chip.cat-display { background: var(--builder-cat-display-tint); color: var(--builder-cat-display); }
.type-chip.cat-structure { background: var(--builder-cat-structure-tint); color: var(--builder-cat-structure); }

.node-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.node-label {
  font-size: var(--odk-question-font-size);
  color: var(--odk-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-meta {
  display: flex;
  gap: var(--odk-spacing-m);
  align-items: baseline;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.node-name {
  font-size: 0.75rem;
  background: var(--odk-light-background-color);
  padding: 0 4px;
  border-radius: 3px;
}

.node-badges {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  color: var(--odk-muted-text-color);
}

.node-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  background: var(--odk-light-background-color);
  border-radius: 10px;
  padding: 2px 8px;
}

.node-badge i {
  font-size: 0.7rem;
}

.badge-error {
  color: var(--odk-error-text-color);
}

.node-actions {
  display: none;
  flex-shrink: 0;
}

.node-card:hover .node-actions,
.node-card:focus-within .node-actions {
  display: inline-flex;
}

.node-children {
  margin-top: var(--odk-spacing-m);
  padding-left: var(--odk-spacing-xl);
}
</style>
