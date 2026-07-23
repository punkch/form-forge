<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'
import NodeList from '@/components/canvas/NodeList.vue'
import CentralDrawer from '@/components/central/CentralDrawer.vue'
import CentralDrawerToggle from '@/components/central/CentralDrawerToggle.vue'
import EditorDialogs from '@/components/EditorDialogs.vue'
import GuideCallout from '@/components/help/GuideCallout.vue'
import GuideTrigger from '@/components/help/GuideTrigger.vue'
import ExportMenu from '@/components/importexport/ExportMenu.vue'
import QuestionPalette from '@/components/palette/QuestionPalette.vue'
import PreviewPanel from '@/components/preview/PreviewPanel.vue'
import PropertyPanel from '@/components/properties/PropertyPanel.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import BlockedEditorScreen from '@/components/shell/BlockedEditorScreen.vue'
import EditorTabs from '@/components/shell/EditorTabs.vue'
import ProblemsButton from '@/components/shell/ProblemsButton.vue'
import SplitHandle from '@/components/shell/SplitHandle.vue'
import ToolbarSeparator from '@/components/shell/ToolbarSeparator.vue'
import { useBreakpoint, useViewportWidth } from '@/composables/useBreakpoint'
import { useSelectionActions } from '@/composables/useSelectionActions'
import { flatten } from '@/core/model/ops'
import { useAppI18n } from '@/i18n'

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
const selection = useSelectionActions()

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
 * Click-to-add inserts relative to the selection — the same rule paste
 * uses, owned by useSelectionActions.insertionTarget: inside an expanded
 * group/repeat (as last child), after any other selected node, or at the
 * form end when nothing is selected.
 */
const addFromPalette = (type: string): void => {
  const target = selection.insertionTarget()
  const id = form.addNode(type, target.parentId, target.index)
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

/** Shared by the keydown and clipboard-event handlers below: text entry
 * (inputs, textareas, contenteditable) always owns its own native
 * copy/cut/paste/select-all/delete — our document-level handlers must stay
 * out of the way. */
const isInInputTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null
  return el !== null && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

/** The selection shortcuts (Delete, Ctrl+A, Escape) only act when the key
 * event comes from the canvas panel (cards or toolbar) or from a neutral
 * `body` focus (e.g. right after clicking empty canvas). Anywhere else the
 * key belongs to whatever has focus — a popover, a dialog, the properties
 * panel — and PrimeVue overlays close on the SAME Escape keydown before this
 * window-level handler runs, so an `activeDialog` guard alone races and
 * would clear the selection as a side effect of closing an overlay. */
const inSelectionScope = (target: EventTarget | null): boolean =>
  target instanceof Element && (target === document.body || target.closest('.canvas-panel') !== null)

/** True while any PrimeVue overlay (dialog, popover, popup menu, drawer,
 * select dropdown) is mounted. An Escape pressed with one open belongs to
 * that overlay — and because Vue unmounts asynchronously, the overlay is
 * reliably still in the DOM when this window-level handler runs, even though
 * PrimeVue's own document-level Escape handler has already closed it (and,
 * for store-gated dialogs, already nulled `activeDialog` — which is why the
 * `activeDialog` guard alone is not enough: focus can sit on `body` while a
 * dialog is open, e.g. after a nested dialog unmounts). */
const overlayOpen = (): boolean =>
  document.querySelector('.p-overlay-mask, .p-dialog, .p-popover, .p-drawer, .p-menu, .p-select-overlay, .p-multiselect-overlay') !== null

const onGlobalKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && editor.paletteDrawerOpen) {
    editor.paletteDrawerOpen = false
    return
  }
  const inInput = isInInputTarget(event.target)
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
  } else if ((event.key === 'Delete' || event.key === 'Backspace') && !inInput &&
    editor.activeDialog === null && editor.selectedNodeIds.size > 0 && inSelectionScope(event.target)) {
    event.preventDefault()
    selection.deleteSelection()
  } else if (mod && event.key.toLowerCase() === 'a' && !inInput && editor.activeDialog === null &&
    inSelectionScope(event.target)) {
    event.preventDefault()
    editor.selectMany(rootChildren.value.map((node) => node.id))
  } else if (event.key === 'Escape' && !inInput && editor.activeDialog === null && !editor.centralDrawerOpen &&
    inSelectionScope(event.target) && !overlayOpen()) {
    editor.select(null)
  }
}

/** Document-level (not canvas-element): focus sits outside the tree after a
 * toolbar click, so binding to the canvas would miss the toolbar-driven
 * case. Each handler defers to useSelectionActions, which already no-ops
 * (and skips preventDefault) when there is nothing to copy/cut/paste — the
 * extra guards here only cover what the composable can't see: an open
 * dialog, focus in a text field, or an active native text selection the
 * browser's own copy/cut should win. */
const clipboardEventAllowed = (event: ClipboardEvent): boolean =>
  editor.activeDialog === null && !isInInputTarget(event.target) && window.getSelection()?.isCollapsed !== false

const onDocumentCopy = (event: ClipboardEvent): void => {
  if (clipboardEventAllowed(event)) selection.handleCopyEvent(event)
}
const onDocumentCut = (event: ClipboardEvent): void => {
  if (clipboardEventAllowed(event)) selection.handleCutEvent(event)
}
const onDocumentPaste = (event: ClipboardEvent): void => {
  if (clipboardEventAllowed(event)) selection.handlePasteEvent(event)
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('copy', onDocumentCopy)
  document.addEventListener('cut', onDocumentCut)
  document.addEventListener('paste', onDocumentPaste)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('copy', onDocumentCopy)
  document.removeEventListener('cut', onDocumentCut)
  document.removeEventListener('paste', onDocumentPaste)
})

/** Stale-selection pruning: undo/redo, drag gathers and card deletes all
 * mutate the doc without going through editor.select* themselves, so the
 * selection set is reconciled here on every doc revision instead. */
watch(() => form.revision, () => {
  if (editor.selectedNodeIds.size === 0) return
  editor.pruneSelection(new Set(flatten(form.doc?.children ?? []).map((node) => node.id)))
})

onBeforeRouteLeave(async () => {
  await form.flushSave()
  return true
})

/** The title span carries the form name; untitled docs fall back to the
 * generic "Form" label so it never renders nameless. The gear menu that used
 * to live behind this button moved to CanvasToolbar (Task 10). */
const formTitle = computed(() =>
  form.doc?.settings.formTitle || t('shell.editor.formMenu'))

/** Central's toolbar entry when no server is registered yet: takes the user
 * straight to Settings' Central-servers section rather than leaving no
 * affordance at all until a server exists. */
const goToCentralSettings = async (): Promise<void> => {
  // SettingsView owns the scroll to its Central section — with the route
  // transition the section doesn't exist yet when this push resolves.
  await router.push({ name: 'settings', query: { section: 'central' } })
}
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
      <template #title-actions>
        <span class="form-title" data-testid="editor-form-title">{{ formTitle }}</span>
      </template>
      <template #actions>
        <Button
          v-tooltip.bottom="paletteShown ? t('shell.editor.hidePalette') : t('shell.editor.showPalette')"
          icon="pi pi-th-large"
          :severity="paletteShown ? 'secondary' : 'primary'"
          text
          :aria-label="t('shell.editor.togglePalette')"
          data-testid="palette-toggle"
          @click="togglePalette"
        />
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
        <ToolbarSeparator />
        <ProblemsButton />
        <ToolbarSeparator />
        <ExportMenu />
        <CentralDrawerToggle
          v-if="central.hasServers && !embed.active"
          v-model:open="editor.centralDrawerOpen"
          testid="central-button"
        />
        <Button
          v-else-if="!embed.active"
          v-tooltip.bottom="t('central.drawer.tooltipAddServer')"
          icon="pi pi-cloud"
          :label="t('central.drawer.toggle')"
          severity="secondary"
          :aria-label="t('central.drawer.tooltipAddServer')"
          data-testid="central-zero-state"
          @click="goToCentralSettings"
        />
      </template>
    </AppHeader>

    <EditorTabs v-if="mode === 'tablet'" />

    <div class="editor-body" :class="`mode-${mode}`" :style="mode === 'tablet' ? undefined : editorBodyStyle">
      <template v-if="overlayPalette">
        <Transition name="scrim-fade">
          <div
            v-if="editor.paletteDrawerOpen"
            class="palette-scrim"
            data-testid="palette-scrim"
            @click="editor.paletteDrawerOpen = false"
          />
        </Transition>
        <Transition name="drawer-start">
          <div v-if="editor.paletteDrawerOpen" class="palette-drawer">
            <QuestionPalette @add="addFromPalette" />
          </div>
        </Transition>
      </template>

      <template v-if="effectivePaletteVisible">
        <QuestionPalette @add="addFromPalette" />
        <SplitHandle panel="palette" side="start" />
      </template>

      <section
        v-show="mode !== 'tablet' || editor.activePane === 'canvas'"
        class="canvas-panel"
      >
        <CanvasToolbar />
        <main
          class="editor-canvas"
          role="tree"
          aria-multiselectable="true"
          :aria-label="t('shell.editor.formStructure')"
          @click="editor.select(null)"
        >
          <div class="canvas-inner" @click.stop>
            <GuideCallout v-if="form.doc" id="multiSelect">
              <GuideTrigger guide="canvas" />
            </GuideCallout>
            <!-- Keyed by record so a form switch remounts the canvas — the
                 TransitionGroup must never cross-animate two docs (the old
                 doc's cards would leave-animate as ghosts beside the new). -->
            <NodeList v-if="form.doc" :key="form.recordId ?? ''" :list="rootChildren" :parent-id="null" root />
          </div>
        </main>
      </section>

      <template v-if="mode !== 'tablet'">
        <SplitHandle panel="properties" side="end" :disabled="railed" />
        <PropertyPanel :railed="railed" />
        <template v-if="editor.previewVisible">
          <SplitHandle panel="preview" side="end" />
          <PreviewPanel />
        </template>
      </template>
      <Transition v-else name="pane-fade" mode="out-in">
        <PropertyPanel v-if="editor.activePane === 'properties'" />
        <PreviewPanel v-else-if="editor.activePane === 'preview'" />
      </Transition>

      <Transition name="drawer-end">
        <CentralDrawer v-if="!embed.active && editor.centralDrawerOpen" />
      </Transition>
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

/* The plain title span is the only shrinkable element on the header's left
   (AppHeader's flex item needs min-width:0 to allow it, else it never
   truncates below its content size). */
.form-title {
  min-width: 3.75rem;
  max-width: 100%;
  font-size: var(--odk-question-font-size);
  font-weight: 500;
  color: var(--odk-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Narrow headers: the Central toggle drops to icon-only (its tooltip and
   aria-label still name it) so the action row never overflows into the
   undo/save area at tablet widths. */
@media (max-width: 1024px) {
  :deep([data-testid='central-button'] .p-button-label),
  :deep([data-testid='central-zero-state'] .p-button-label) {
    display: none;
  }
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

.editor-body.mode-tablet > .canvas-panel,
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

/* Animate the properties rail fold; drags suspend it (see body.is-panel-resizing). */
.editor-body {
  transition: grid-template-columns var(--builder-motion-duration-l) var(--builder-motion-ease-standard);
}

:global(body.is-panel-resizing) .editor-body {
  transition: none;
}

/* CanvasToolbar sits above the scroll area, non-scrolling; the grid track
   (minmax(--builder-canvas-min-width, 1fr)) lands on this element, and
   .editor-canvas fills what's left of the column. */
.canvas-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.editor-canvas {
  flex: 1;
  overflow-y: auto;
  background: var(--builder-canvas-bg);
  padding: var(--odk-spacing-xl);
}

.canvas-inner {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
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
