<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { usePreviewStore } from '@/stores/preview'
import { PREVIEW_PRESET_WIDTHS, useUiStore, type PreviewPreset } from '@/stores/ui'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()
const preview = usePreviewStore()
const ui = useUiStore()
const router = useRouter()

const PRESETS = [
  { preset: 'phone', icon: 'pi pi-mobile', tooltip: t('preview.toolbar.phonePreset') },
  { preset: 'tablet', icon: 'pi pi-tablet', tooltip: t('preview.toolbar.tabletPreset') },
  { preset: 'fill', icon: 'pi pi-arrows-h', tooltip: t('preview.toolbar.fillPreset') },
] as const

const selectPreset = (preset: PreviewPreset): void => {
  ui.previewPreset = preset
  if (preset === 'fill') return
  // Widen the pane so the device frame fits; the store clamps to 60vw.
  const contentPx = PREVIEW_PRESET_WIDTHS[preset]
  ui.setPanelWidth('preview', Math.max(ui.previewWidth, contentPx + 40))
}

const openFullPreview = (): void => {
  if (form.recordId !== null) {
    void router.push({ name: 'preview', params: { formId: form.recordId } })
  }
}
</script>

<template>
  <header class="preview-toolbar" data-testid="preview-toolbar">
    <span class="preview-title">{{ t('preview.toolbar.title') }}</span>
    <span class="preview-actions">
      <Button
        v-tooltip.bottom="t('preview.toolbar.refresh')"
        icon="pi pi-refresh"
        severity="secondary"
        text
        size="small"
        :aria-label="t('preview.toolbar.refresh')"
        data-testid="preview-refresh"
        @click="preview.refreshNow()"
      />
      <span class="preset-group" role="group" :aria-label="t('preview.toolbar.widthPresetGroup')">
        <button
          v-for="p in PRESETS"
          :key="p.preset"
          v-tooltip.bottom="p.tooltip"
          type="button"
          class="preset-button"
          :class="{ active: ui.previewPreset === p.preset }"
          :aria-pressed="ui.previewPreset === p.preset"
          :aria-label="p.tooltip"
          :data-testid="`preview-preset-${p.preset}`"
          @click="selectPreset(p.preset)"
        >
          <i :class="p.icon" />
        </button>
      </span>
      <Button
        v-tooltip.bottom="t('preview.toolbar.openFullPage')"
        icon="pi pi-window-maximize"
        severity="secondary"
        text
        size="small"
        :aria-label="t('preview.toolbar.openFullPage')"
        @click="openFullPreview"
      />
      <Button
        icon="pi pi-times"
        severity="secondary"
        text
        size="small"
        :aria-label="t('preview.toolbar.close')"
        data-testid="preview-close"
        @click="editor.previewVisible = false"
      />
    </span>
  </header>
</template>

<style scoped>
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border-bottom: var(--builder-panel-border);
  background: var(--odk-base-background-color);
}

.preview-title {
  font-weight: 500;
}

.preview-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.preset-group {
  display: inline-flex;
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  overflow: hidden;
}

.preset-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  cursor: pointer;
}

.preset-button + .preset-button {
  border-inline-start: 1px solid var(--odk-border-color);
}

.preset-button:hover {
  background: var(--odk-muted-background-color);
}

.preset-button.active {
  background: var(--p-primary-50, #e9f8ff);
  color: var(--p-primary-700, #297193);
}
</style>
