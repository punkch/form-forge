<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import Menu from 'primevue/menu'

import NodeList from '@/components/canvas/NodeList.vue'
import CentralDrawer from '@/components/central/CentralDrawer.vue'
import CentralDrawerToggle from '@/components/central/CentralDrawerToggle.vue'
import EditorDialogs from '@/components/EditorDialogs.vue'
import ExportMenu from '@/components/importexport/ExportMenu.vue'
import QuestionPalette from '@/components/palette/QuestionPalette.vue'
import PreviewPanel from '@/components/preview/PreviewPanel.vue'
import PropertyPanel from '@/components/properties/PropertyPanel.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import BlockedEditorScreen from '@/components/shell/BlockedEditorScreen.vue'
import EditorTabs from '@/components/shell/EditorTabs.vue'
import ProblemsButton from '@/components/shell/ProblemsButton.vue'
import SplitHandle from '@/components/shell/SplitHandle.vue'
import { useBreakpoint, useViewportWidth } from '@/composables/useBreakpoint'
import { locateNode } from '@/core/model/ops'
import { useAppI18n } from '@/i18n'
import { isContainer, type FormDocument } from '@/core/model/types'
import { useCentralStore } from '@/stores/central'
import { useEditorStore } from '@/stores/editor'
import { useEmbedStore } from '@/stores/embed'
import { useFormStore } from '@/stores/form'
import { PANEL_LIMITS, useUiStore } from '@/stores/ui'

const props = defineProps<{ formId: string }>()

const form = useFormStore()
const editor = useEditorStore()
const central = useCentralStore()
const embed = useEmbedStore()
const ui = useUiStore()
const router = useRouter()
const { t } = useAppI18n()
const notFound = ref(false)

const loadForm = async (id: string): Promise<void> => {
  editor.reset()
  const ok = await form.load(id)
  notFound.value = !ok
}

onMounted(() => {
  void loadForm(props.formId)
})
watch(() => props.formId, (id) => { void loadForm(id) })

const rootChildren = computed(() => form.doc?.children ?? [])

const { mode } = useBreakpoint()
const viewportWidth = useViewportWidth()

const HANDLE_PX = 6
const RAIL_PX = 44
const CANVAS_MIN_PX = 360
/** Laptop mode trades panel width for a usable canvas. */
const LAPTOP_PROPERTIES_MAX_PX = 340
const LAPTOP_PREVIEW_MIN_PX = 320

/** Laptop and tablet render the palette as a slide-over drawer, not a column. */
const overlayPalette = computed(() => mode.value === 'laptop' || mode.value === 'tablet')

/** The properties panel folds to a slim rail while nothing is selected. */
const railed = computed(() => mode.value !== 'tablet' && editor.selectedNodeId === null)

/**
 * Non-destructive palette auto-tuck (wide mode): when the docked panels
 * wouldn't leave the canvas its minimum width, the palette hides without
 * touching the persisted ui.paletteVisible preference — it returns as soon
 * as room frees up.
 */
const fitsWithPalette = computed(() => {
  // Measure against the other panels' MINIMUM widths — the shrink cascade in
  // effectivePanelWidths gives up their extra space before the palette hides.
  const properties = railed.value
    ? RAIL_PX + HANDLE_PX
    : PANEL_LIMITS.properties.min + 2 * HANDLE_PX
  const preview = editor.previewVisible ? PANEL_LIMITS.preview.min + HANDLE_PX : 0
  return viewportWidth.value - ui.paletteWidth - HANDLE_PX - properties - preview >= CANVAS_MIN_PX
})
const effectivePaletteVisible = computed(() =>
  mode.value === 'wide' && ui.paletteVisible && fitsWithPalette.value)

/**
 * Rendered panel widths, clamped so the canvas always keeps its minimum:
 * the preview gives way first (down to its min), then the properties panel.
 * The persisted ui widths are never rewritten — panels regain their size
 * as soon as the viewport allows it.
 */
const effectivePanelWidths = computed(() => {
  const laptop = mode.value === 'laptop'
  const previewMin = laptop ? LAPTOP_PREVIEW_MIN_PX : PANEL_LIMITS.preview.min
  let properties = railed.value
    ? RAIL_PX
    : Math.min(ui.propertiesWidth, laptop ? LAPTOP_PROPERTIES_MAX_PX : Number.MAX_SAFE_INTEGER)
  let preview = editor.previewVisible ? ui.previewWidth : 0
  const palette = effectivePaletteVisible.value ? ui.paletteWidth + HANDLE_PX : 0
  const handles = HANDLE_PX * ((railed.value ? 0 : 1) + (editor.previewVisible ? 1 : 0))
  const available = viewportWidth.value - palette - handles - CANVAS_MIN_PX
  let overflow = properties + preview - available
  if (overflow > 0 && editor.previewVisible) {
    const shrink = Math.max(0, Math.min(overflow, preview - previewMin))
    preview -= shrink
    overflow -= shrink
  }
  if (overflow > 0 && !railed.value) {
    const shrink = Math.max(0, Math.min(overflow, properties - PANEL_LIMITS.properties.min))
    properties -= shrink
  }
  return { properties, preview }
})

/**
 * Grid tracks, built to keep the properties track count constant across the
 * rail toggle so grid-template-columns can animate the fold.
 */
const gridColumns = computed(() => {
  const cols: string[] = []
  if (effectivePaletteVisible.value) cols.push('var(--builder-palette-width)', 'var(--builder-split-handle-size)')
  cols.push('minmax(var(--builder-canvas-min-width), 1fr)')
  cols.push(railed.value ? '0px' : 'var(--builder-split-handle-size)')
  cols.push(railed.value ? 'var(--builder-properties-rail-width)' : 'var(--builder-properties-width)')
  if (editor.previewVisible) cols.push('var(--builder-split-handle-size)', 'var(--builder-preview-width)')
  return cols.join(' ')
})

const editorBodyStyle = computed(() => ({
  'grid-template-columns': gridColumns.value,
  '--builder-palette-width': `${ui.paletteWidth}px`,
  '--builder-properties-width': `${effectivePanelWidths.value.properties}px`,
  '--builder-preview-width': `${effectivePanelWidths.value.preview}px`,
}))

/**
 * Click-to-add inserts relative to the selection: inside an expanded
 * group/repeat (as last child), after any other selected node, or at the
 * form end when nothing is selected.
 */
const addFromPalette = (type: string): void => {
  let parentId: string | null = null
  let index: number | undefined
  const selected = form.getNode(editor.selectedNodeId)
  if (selected !== null && form.doc !== null) {
    if (isContainer(selected) && !editor.collapsedIds.has(selected.id)) {
      parentId = selected.id
    } else {
      const loc = locateNode(form.doc as FormDocument, selected.id)
      if (loc !== null) {
        parentId = loc.parent?.id ?? null
        index = loc.index + 1
      }
    }
  }
  const id = form.addNode(type, parentId, index)
  if (id !== null) {
    editor.select(id)
    editor.revealNodeId = id
  }
  if (overlayPalette.value) editor.paletteDrawerOpen = false
}

const togglePalette = (): void => {
  if (overlayPalette.value) editor.paletteDrawerOpen = !editor.paletteDrawerOpen
  else ui.paletteVisible = !ui.paletteVisible
}

const paletteShown = computed(() =>
  overlayPalette.value ? editor.paletteDrawerOpen : ui.paletteVisible)

const beforeUnload = (event: BeforeUnloadEvent): void => {
  if (form.saveState !== 'saved') {
    void form.flushSave()
    event.preventDefault()
  }
}

const onGlobalKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && editor.paletteDrawerOpen) {
    editor.paletteDrawerOpen = false
    return
  }
  const target = event.target as HTMLElement | null
  const inInput = target !== null && (
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  )
  const mod = event.ctrlKey || event.metaKey
  if (mod && !event.shiftKey && event.key.toLowerCase() === 'z' && !inInput) {
    event.preventDefault()
    form.undo()
  } else if (mod && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z')) && !inInput) {
    event.preventDefault()
    form.redo()
  } else if (mod && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void form.flushSave()
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('keydown', onGlobalKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('keydown', onGlobalKeydown)
})

onBeforeRouteLeave(async () => {
  await form.flushSave()
  return true
})

const moreMenu = ref<InstanceType<typeof Menu> | null>(null)
const moreItems = computed(() => [
  { label: t('shell.editor.formSettings'), icon: 'pi pi-cog', command: () => { editor.activeDialog = 'settings' } },
  { label: t('shell.editor.translations'), icon: 'pi pi-language', command: () => { editor.activeDialog = 'translations' } },
  { label: t('shell.editor.choiceLists'), icon: 'pi pi-list', command: () => { editor.activeDialog = 'choice-lists' } },
  { label: t('shell.editor.attachments'), icon: 'pi pi-paperclip', command: () => { editor.activeDialog = 'attachments' } },
])
</script>

<template>
  <div v-if="notFound" class="editor-not-found">
    <h2>{{ t('shell.notFound.title') }}</h2>
    <p>{{ t('shell.notFound.hint') }}</p>
    <Button :label="t('shell.nav.backToForms')" icon="pi pi-arrow-left" @click="router.push({ name: 'library' })" />
  </div>

  <BlockedEditorScreen v-else-if="mode === 'blocked'" :form-id="props.formId" />

  <div v-else class="editor" data-testid="editor">
    <AppHeader>
      <template #actions>
        <Button
          v-tooltip.bottom="paletteShown ? t('shell.editor.hidePalette') : t('shell.editor.showPalette')"
          icon="pi pi-objects-column"
          :severity="paletteShown ? 'secondary' : 'primary'"
          text
          :aria-label="t('shell.editor.togglePalette')"
          data-testid="palette-toggle"
          @click="togglePalette"
        />
        <ProblemsButton />
        <Button
          v-if="mode !== 'tablet'"
          v-tooltip.bottom="editor.previewVisible ? t('shell.editor.hidePreview') : t('shell.editor.showPreview')"
          icon="pi pi-eye"
          :label="t('shell.editor.preview')"
          :severity="editor.previewVisible ? 'primary' : 'secondary'"
          :aria-label="t('shell.editor.togglePreview')"
          data-testid="preview-button"
          @click="editor.previewVisible = !editor.previewVisible"
        />
        <ExportMenu />
        <CentralDrawerToggle
          v-if="central.hasServers && !embed.active"
          v-model:open="editor.centralDrawerOpen"
          testid="central-button"
        />
        <Button
          icon="pi pi-ellipsis-v"
          severity="secondary"
          text
          :aria-label="t('shell.editor.moreTools')"
          data-testid="editor-more"
          @click="moreMenu?.toggle($event)"
        />
        <Menu ref="moreMenu" :model="moreItems" popup />
      </template>
    </AppHeader>

    <EditorTabs v-if="mode === 'tablet'" />

    <div class="editor-body" :class="`mode-${mode}`" :style="mode === 'tablet' ? undefined : editorBodyStyle">
      <template v-if="overlayPalette">
        <div
          v-if="editor.paletteDrawerOpen"
          class="palette-scrim"
          data-testid="palette-scrim"
          @click="editor.paletteDrawerOpen = false"
        />
        <div v-if="editor.paletteDrawerOpen" class="palette-drawer">
          <QuestionPalette @add="addFromPalette" />
        </div>
      </template>

      <template v-if="effectivePaletteVisible">
        <QuestionPalette @add="addFromPalette" />
        <SplitHandle panel="palette" side="start" />
      </template>

      <main
        v-show="mode !== 'tablet' || editor.activePane === 'canvas'"
        class="editor-canvas"
        role="tree"
        :aria-label="t('shell.editor.formStructure')"
        @click="editor.select(null)"
      >
        <div class="canvas-inner" @click.stop>
          <NodeList v-if="form.doc" :list="rootChildren" :parent-id="null" root />
        </div>
      </main>

      <template v-if="mode !== 'tablet'">
        <SplitHandle panel="properties" side="end" :disabled="railed" />
        <PropertyPanel :railed="railed" />
        <template v-if="editor.previewVisible">
          <SplitHandle panel="preview" side="end" />
          <PreviewPanel />
        </template>
      </template>
      <template v-else>
        <PropertyPanel v-if="editor.activePane === 'properties'" />
        <PreviewPanel v-if="editor.activePane === 'preview'" />
      </template>

      <CentralDrawer v-if="!embed.active && editor.centralDrawerOpen" />
    </div>

    <EditorDialogs />
  </div>
</template>

<style scoped>
.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-body {
  flex: 1;
  display: grid;
  min-height: 0;
  position: relative;
}

/* Tablet: one pane at a time, switched by the tabs bar. */
.editor-body.mode-tablet {
  display: flex;
}

.editor-body.mode-tablet > .editor-canvas,
.editor-body.mode-tablet > :deep(.property-panel),
.editor-body.mode-tablet > :deep(.preview-panel) {
  flex: 1;
  min-width: 0;
}

.editor-body.mode-tablet > :deep(.property-panel) {
  border-inline-start: none;
}

/* Palette slide-over for laptop/tablet modes. */
.palette-scrim {
  position: absolute;
  inset: 0;
  z-index: var(--odk-z-index-overlay);
  background: var(--builder-scrim-bg);
}

.palette-drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  inset-inline-start: 0;
  width: 280px;
  z-index: var(--odk-z-index-overlay);
  display: flex;
  box-shadow: var(--builder-drawer-shadow);
}

.palette-drawer > :deep(.palette) {
  flex: 1;
  min-width: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .palette-drawer {
    animation: palette-drawer-in 200ms ease;
  }

  .palette-scrim {
    animation: palette-scrim-in 200ms ease;
  }
}

@keyframes palette-drawer-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes palette-scrim-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Animate the properties rail fold; drags suspend it (see body.is-panel-resizing). */
@media (prefers-reduced-motion: no-preference) {
  .editor-body {
    transition: grid-template-columns 200ms ease;
  }
}

:global(body.is-panel-resizing) .editor-body {
  transition: none;
}

.editor-canvas {
  overflow-y: auto;
  background: var(--builder-canvas-bg);
  padding: var(--odk-spacing-xl);
}

.canvas-inner {
  max-width: 760px;
  margin: 0 auto;
}

.editor-not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
}

</style>
