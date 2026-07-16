<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import { useViewportWidth } from '@/composables/useBreakpoint'
import { useAppI18n } from '@/i18n'
import { PANEL_LIMITS, useUiStore, type PanelName } from '@/stores/ui'

const props = defineProps<{
  /** The ui-store panel width this handle drives. */
  panel: PanelName
  /** 'start' = the panel sits before (left of) the handle, 'end' = after it. */
  side: 'start' | 'end'
  /** Keeps the element in the grid (constant track count) but inert, e.g. while the panel is railed. */
  disabled?: boolean
}>()

const ui = useUiStore()
const viewportWidth = useViewportWidth()
const { t } = useAppI18n()

const width = computed(() =>
  props.panel === 'palette' ? ui.paletteWidth : props.panel === 'properties' ? ui.propertiesWidth : ui.previewWidth
)
const min = computed(() => PANEL_LIMITS[props.panel].min)
const max = computed(() => {
  const limit = PANEL_LIMITS[props.panel].max
  return typeof limit === 'function' ? limit(viewportWidth.value) : limit
})

/** Pointer deltas grow a 'start' panel when moving right, an 'end' panel when moving left. */
const sign = computed(() => (props.side === 'start' ? 1 : -1))

const dragging = ref(false)
let startX = 0
let startWidth = 0

const onPointerDown = (event: PointerEvent): void => {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  dragging.value = true
  startX = event.clientX
  startWidth = width.value
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  document.body.classList.add('is-panel-resizing')
}

const onPointerMove = (event: PointerEvent): void => {
  if (!dragging.value) return
  ui.setPanelWidth(props.panel, startWidth + sign.value * (event.clientX - startX))
}

const stopDrag = (): void => {
  if (!dragging.value) return
  dragging.value = false
  document.body.classList.remove('is-panel-resizing')
}

onBeforeUnmount(() => { document.body.classList.remove('is-panel-resizing') })

const onKeydown = (event: KeyboardEvent): void => {
  const step = event.shiftKey ? 64 : 16
  switch (event.key) {
    case 'ArrowLeft':
      ui.setPanelWidth(props.panel, width.value - sign.value * step)
      break
    case 'ArrowRight':
      ui.setPanelWidth(props.panel, width.value + sign.value * step)
      break
    case 'Home':
      ui.setPanelWidth(props.panel, min.value)
      break
    case 'End':
      ui.setPanelWidth(props.panel, max.value)
      break
    case 'Enter':
      ui.resetPanelWidth(props.panel)
      break
    default:
      return
  }
  event.preventDefault()
}
</script>

<template>
  <div
    class="split-handle"
    :class="{ dragging, disabled }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="t('shell.splitHandle.resizePanel', { panel })"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="width"
    :aria-hidden="disabled || undefined"
    :tabindex="disabled ? -1 : 0"
    :data-testid="`split-${panel}`"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="stopDrag"
    @pointercancel="stopDrag"
    @dblclick="ui.resetPanelWidth(panel)"
    @keydown="onKeydown"
  />
</template>

<style scoped>
.split-handle {
  position: relative;
  cursor: col-resize;
  background: transparent;
  touch-action: none;
}

.split-handle.disabled {
  pointer-events: none;
  visibility: hidden;
}

/* Widen the hit area beyond the visible 6px column. */
.split-handle::before {
  content: '';
  position: absolute;
  inset: 0 -2px;
  z-index: 1;
}

/* The visible affordance: a 2px line that appears on hover/focus/drag. */
.split-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: transparent;
  transition: background-color 120ms ease;
}

.split-handle:hover::after,
.split-handle:focus-visible::after,
.split-handle.dragging::after {
  background: var(--p-primary-500, #3e9fcc);
}

/* Forced-colors (Windows Contrast Themes) forces backgrounds to a flat
 * system colour, so a background-only affordance like this one can vanish.
 * Give it a transparent border ahead of time so a forced border has
 * somewhere to land, using the `Highlight` system colour (adapts to the
 * user's chosen contrast palette) instead of our own accent. */
@media (forced-colors: active) {
  .split-handle::after {
    border-inline-start: 2px solid transparent;
  }

  .split-handle:hover::after,
  .split-handle:focus-visible::after,
  .split-handle.dragging::after {
    border-inline-start-color: Highlight;
  }
}
</style>
