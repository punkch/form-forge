<script setup lang="ts">
// Non-scrolling header above the canvas scroll area (FormEditorView wraps it
// in a flex column, this stays flex-shrink:0). Left cluster: undo/redo
// (relocated here from AppHeader — single home for the whole editor's
// history controls) then the multi-select clipboard actions, which all go
// through useSelectionActions — the one seam shared with the document-level
// keyboard/paste-event handlers (Task 9). Right cluster: the gear, which now
// hosts the WHOLE former "Form" menu (kept as data-testid="form-menu" so
// every e2e menuitem flow survives the move) plus the new
// "Insert from template…" entry.
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { computed, ref } from 'vue'

import ToolbarSeparator from '@/components/shell/ToolbarSeparator.vue'
import UndoRedoButtons from '@/components/shell/UndoRedoButtons.vue'
import { useSelectionActions } from '@/composables/useSelectionActions'
import { useAppI18n } from '@/i18n'
import { shortcutMod } from '@/shortcuts'
import { useEditorStore } from '@/stores/editor'

const editor = useEditorStore()
const { t } = useAppI18n()

// Destructured (not accessed as `selection.canCut`): useSelectionActions
// returns a plain object, not a reactive()-wrapped one, so only bindings
// that are themselves top-level script-setup consts get the template's
// automatic ref-unwrapping — a nested `selection.canCut` would hand the
// template the raw ComputedRef instead of its boolean.
const {
  canCut,
  canCopy,
  canDelete,
  canPaste,
  copySelection,
  cutSelection,
  deleteSelection,
  pasteClipboard,
} = useSelectionActions()

const modKey = shortcutMod()

const formMenu = ref<InstanceType<typeof Menu> | null>(null)

/** Relocated from FormEditorView: same four items (same labels/icons, so the
 * 15 e2e `getByRole('menuitem')` flows survive the gear's move) plus a new
 * "Insert from template…" entry after a separator. */
const formMenuItems = computed(() => [
  { label: t('shell.editor.formSettings'), icon: 'pi pi-cog', command: () => { editor.activeDialog = 'settings' } },
  { label: t('shell.editor.translations'), icon: 'pi pi-language', command: () => { editor.activeDialog = 'translations' } },
  { label: t('shell.editor.choiceLists'), icon: 'pi pi-list', command: () => { editor.activeDialog = 'choice-lists' } },
  { label: t('shell.editor.attachments'), icon: 'pi pi-paperclip', command: () => { editor.activeDialog = 'attachments' } },
  { separator: true },
  { label: t('shell.editor.insertFromTemplate'), icon: 'pi pi-clone', command: () => { editor.activeDialog = 'insert-template' } },
])
</script>

<template>
  <div class="canvas-toolbar" data-testid="canvas-toolbar">
    <UndoRedoButtons />
    <ToolbarSeparator />
    <Button
      v-tooltip.bottom="t('canvas.toolbar.cut', { mod: modKey })"
      icon="pi pi-file-export"
      severity="secondary"
      text
      :disabled="!canCut"
      :aria-label="t('canvas.toolbar.cutLabel')"
      data-testid="toolbar-cut"
      @click="cutSelection"
    />
    <Button
      v-tooltip.bottom="t('canvas.toolbar.copy', { mod: modKey })"
      icon="pi pi-copy"
      severity="secondary"
      text
      :disabled="!canCopy"
      :aria-label="t('canvas.toolbar.copyLabel')"
      data-testid="toolbar-copy"
      @click="copySelection"
    />
    <Button
      v-tooltip.bottom="canPaste ? t('canvas.toolbar.paste', { mod: modKey }) : t('canvas.toolbar.pasteEmpty')"
      icon="pi pi-clipboard"
      severity="secondary"
      text
      :disabled="!canPaste"
      :aria-label="t('canvas.toolbar.pasteLabel')"
      data-testid="toolbar-paste"
      @click="pasteClipboard"
    />
    <Button
      v-tooltip.bottom="t('canvas.toolbar.delete', { mod: modKey })"
      icon="pi pi-trash"
      severity="secondary"
      text
      :disabled="!canDelete"
      :aria-label="t('canvas.toolbar.deleteLabel')"
      data-testid="toolbar-delete"
      @click="deleteSelection"
    />
    <!-- The chip is a multi-select-is-active signal: a single selection
         already reads as "selected" via the card's own highlight and the
         properties panel, so chip and clear (×) appear only for a batch. -->
    <span v-if="editor.selectedNodeIds.size > 1" class="selection-chip" data-testid="selection-count">
      {{ t('canvas.toolbar.selectionCount', { count: editor.selectedNodeIds.size }) }}
      <button
        v-tooltip.bottom="t('canvas.toolbar.clearSelectionTooltip')"
        type="button"
        class="selection-chip-clear"
        data-testid="selection-clear"
        :aria-label="t('canvas.toolbar.clearSelection')"
        @click="editor.select(null)"
      >
        <i class="pi pi-times" aria-hidden="true" />
      </button>
    </span>
    <Button
      v-tooltip.bottom="t('shell.editor.formMenuOpen')"
      icon="pi pi-cog"
      severity="secondary"
      text
      class="canvas-toolbar-gear"
      :aria-label="t('shell.editor.formMenuOpen')"
      data-testid="form-menu"
      @click="formMenu?.toggle($event)"
    />
    <Menu ref="formMenu" :model="formMenuItems" popup />
  </div>
</template>

<style scoped>
.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s) var(--odk-spacing-l);
  background: var(--builder-panel-bg);
  border-bottom: var(--builder-panel-border);
  flex-shrink: 0;
}

.canvas-toolbar-gear {
  margin-inline-start: auto;
}

.selection-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--builder-spacing-xs);
  padding: 2px var(--odk-spacing-s);
  border-radius: var(--odk-radius);
  background: var(--odk-muted-background-color);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  white-space: nowrap;
}

.selection-chip-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: 0.65rem;
  cursor: pointer;
  transition: background-color var(--builder-motion-duration-xs) var(--builder-motion-ease-standard);
}

.selection-chip-clear:hover {
  background: var(--odk-border-color);
}
</style>
