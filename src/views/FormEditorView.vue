<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import Menu from 'primevue/menu'

import NodeList from '@/components/canvas/NodeList.vue'
import EditorDialogs from '@/components/EditorDialogs.vue'
import ExportMenu from '@/components/importexport/ExportMenu.vue'
import QuestionPalette from '@/components/palette/QuestionPalette.vue'
import PreviewPanel from '@/components/preview/PreviewPanel.vue'
import PropertyPanel from '@/components/properties/PropertyPanel.vue'
import AppHeader from '@/components/shell/AppHeader.vue'
import ProblemsButton from '@/components/shell/ProblemsButton.vue'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ formId: string }>()

const form = useFormStore()
const editor = useEditorStore()
const router = useRouter()
const notFound = ref(false)

const loadForm = async (id: string): Promise<void> => {
  editor.reset()
  const ok = await form.load(id)
  notFound.value = !ok
}

onMounted(() => {
  // Tablet-sized screens start with the palette tucked away.
  if (window.innerWidth < 1280) editor.paletteVisible = false
  void loadForm(props.formId)
})
watch(() => props.formId, (id) => { void loadForm(id) })

const rootChildren = computed(() => form.doc?.children ?? [])

const addFromPalette = (type: string): void => {
  // Insert after the current selection when it sits at root level;
  // otherwise append to the end of the form.
  const id = form.addNode(type, null)
  if (id !== null) editor.select(id)
}

const beforeUnload = (event: BeforeUnloadEvent): void => {
  if (form.saveState !== 'saved') {
    void form.flushSave()
    event.preventDefault()
  }
}

const onGlobalKeydown = (event: KeyboardEvent): void => {
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
const moreItems = [
  { label: 'Form settings', icon: 'pi pi-cog', command: () => { editor.activeDialog = 'settings' } },
  { label: 'Translations', icon: 'pi pi-language', command: () => { editor.activeDialog = 'translations' } },
  { label: 'Choice lists', icon: 'pi pi-list', command: () => { editor.activeDialog = 'choice-lists' } },
  { label: 'Attachments', icon: 'pi pi-paperclip', command: () => { editor.activeDialog = 'attachments' } },
]
</script>

<template>
  <div v-if="notFound" class="editor-not-found">
    <h2>Form not found</h2>
    <p>This form does not exist in this browser's storage.</p>
    <Button label="Back to forms" icon="pi pi-arrow-left" @click="router.push({ name: 'library' })" />
  </div>

  <div v-else class="editor" data-testid="editor">
    <AppHeader>
      <template #actions>
        <Button
          v-tooltip.bottom="editor.paletteVisible ? 'Hide question types' : 'Show question types'"
          icon="pi pi-bars"
          :severity="editor.paletteVisible ? 'secondary' : 'primary'"
          text
          aria-label="Toggle question palette"
          data-testid="palette-toggle"
          @click="editor.paletteVisible = !editor.paletteVisible"
        />
        <ProblemsButton />
        <Button
          v-tooltip.bottom="editor.previewVisible ? 'Hide the live preview' : 'Show the live preview'"
          icon="pi pi-eye"
          label="Preview"
          :severity="editor.previewVisible ? 'primary' : 'secondary'"
          data-testid="preview-button"
          @click="editor.previewVisible = !editor.previewVisible"
        />
        <ExportMenu />
        <Button
          icon="pi pi-ellipsis-v"
          severity="secondary"
          text
          aria-label="More form tools"
          data-testid="editor-more"
          @click="moreMenu?.toggle($event)"
        />
        <Menu ref="moreMenu" :model="moreItems" popup />
      </template>
    </AppHeader>

    <div class="editor-body" :class="{ 'with-preview': editor.previewVisible, 'no-palette': !editor.paletteVisible }">
      <QuestionPalette v-if="editor.paletteVisible" @add="addFromPalette" />

      <main class="editor-canvas" role="tree" aria-label="Form structure" @click="editor.select(null)">
        <div class="canvas-inner" @click.stop>
          <div v-if="rootChildren.length === 0" class="canvas-hint" data-testid="canvas-empty">
            <i class="pi pi-arrow-left" />
            <p>Click or drag a question type from the palette to start building.</p>
          </div>
          <NodeList v-if="form.doc" :list="rootChildren" :parent-id="null" root />
        </div>
      </main>

      <PropertyPanel />

      <PreviewPanel v-if="editor.previewVisible" />
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
  grid-template-columns: 250px 1fr 360px;
  min-height: 0;
}

.editor-body.with-preview {
  grid-template-columns: 250px 1fr 320px 420px;
}

.editor-body.no-palette {
  grid-template-columns: 1fr 360px;
}

.editor-body.no-palette.with-preview {
  grid-template-columns: 1fr 320px 420px;
}

/* Tablet: the preview becomes an overlay drawer on the right so canvas +
 * properties keep usable widths. */
@media (max-width: 1279px) {
  .editor-body.with-preview {
    grid-template-columns: 220px 1fr 300px;
  }

  .editor-body.no-palette.with-preview {
    grid-template-columns: 1fr 300px;
  }

  .editor-body.with-preview > :deep(.preview-panel) {
    position: fixed;
    top: var(--builder-header-height);
    right: 0;
    bottom: 0;
    width: min(420px, 90vw);
    z-index: var(--odk-z-index-overlay);
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);
  }
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

.canvas-hint {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  padding: var(--odk-spacing-l);
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

@media (max-width: 1100px) {
  .editor-body {
    grid-template-columns: 210px 1fr 300px;
  }

  .editor-body.no-palette {
    grid-template-columns: 1fr 300px;
  }
}
</style>
