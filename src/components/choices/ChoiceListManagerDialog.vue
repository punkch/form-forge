<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'

import { deleteChoiceList, listUsage, renameChoiceList } from '@/core/model/choice-lists'
import { newChoiceList } from '@/core/model/factory'
import type { FormDocument } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'choice-lists',
  set: (open: boolean) => {
    if (!open && editor.activeDialog === 'choice-lists') editor.activeDialog = null
  },
})

const usage = computed(() =>
  form.doc === null ? new Map<string, never[]>() : listUsage(form.doc as FormDocument)
)

interface Row {
  name: string
  choiceCount: number
  usedBy: string[]
}

const rows = computed<Row[]>(() =>
  Object.values(form.doc?.choiceLists ?? {}).map((list) => ({
    name: list.name,
    choiceCount: list.choices.length,
    usedBy: (usage.value.get(list.name) ?? []).map((q) => q.name),
  }))
)

// --- Rename ---------------------------------------------------------------

const renaming = ref<string | null>(null)
const renameValue = ref('')

const renameError = computed<string | null>(() => {
  if (renaming.value === null) return null
  const next = renameValue.value.trim()
  if (next === '' || next === renaming.value) return null
  if (form.doc?.choiceLists[next] !== undefined) return t('properties.listManager.duplicateName', { name: next })
  if (!/^[A-Za-z_][\w.-]*$/.test(next)) return t('properties.listManager.invalidName')
  return null
})

const startRename = (name: string): void => {
  renaming.value = name
  renameValue.value = name
  confirmingDelete.value = null
}

const commitRename = (): void => {
  const oldName = renaming.value
  const next = renameValue.value.trim()
  if (oldName === null || renameError.value !== null) return
  if (next !== '' && next !== oldName) {
    // One mutate: the list key, list.name and every question's listRef move together.
    form.mutate(t('properties.listManager.undoRenameList'), (d) => { renameChoiceList(d, oldName, next) })
  }
  renaming.value = null
}

const cancelRename = (): void => { renaming.value = null }

// --- Delete (two-step when the list is in use) ------------------------------

const confirmingDelete = ref<string | null>(null)

const requestDelete = (row: Row): void => {
  renaming.value = null
  if (row.usedBy.length > 0 && confirmingDelete.value !== row.name) {
    confirmingDelete.value = row.name
    return
  }
  confirmingDelete.value = null
  form.mutate(t('properties.listManager.undoDeleteList'), (d) => { deleteChoiceList(d, row.name) })
}

const createList = (): void => {
  form.mutate(t('properties.listManager.undoNewList'), (d) => { newChoiceList(d) })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('properties.listManager.header')"
    modal
    :style="{ width: '38rem' }"
    data-testid="choice-list-manager"
  >
    <p v-if="rows.length === 0" class="empty-note">
      {{ t('properties.listManager.empty') }}
    </p>

    <ul v-else class="list-rows">
      <li
        v-for="row in rows"
        :key="row.name"
        class="list-row"
        :data-testid="`list-row-${row.name}`"
      >
        <div class="list-row-main">
          <template v-if="renaming === row.name">
            <InputText
              v-model="renameValue"
              class="rename-input"
              :invalid="renameError !== null"
              data-testid="rename-input"
              autofocus
              @keydown.enter.prevent="commitRename"
              @keydown.escape="cancelRename"
            />
            <Button
              icon="pi pi-check"
              size="small"
              text
              rounded
              :aria-label="t('properties.listManager.confirmRename')"
              :disabled="renameError !== null"
              data-testid="rename-confirm"
              @click="commitRename"
            />
            <Button
              icon="pi pi-times"
              size="small"
              text
              rounded
              severity="secondary"
              :aria-label="t('properties.listManager.cancelRename')"
              @click="cancelRename"
            />
          </template>
          <template v-else>
            <code class="list-name">{{ row.name }}</code>
            <span class="list-meta">
              {{ t('properties.listManager.choiceCount', row.choiceCount) }}
              ·
              <span
                v-tooltip.top="row.usedBy.join(', ') || undefined"
                :data-testid="`list-usage-${row.name}`"
              >{{ t('properties.listManager.usedByCount', row.usedBy.length) }}</span>
            </span>
            <span class="list-actions">
              <Button
                icon="pi pi-pencil"
                size="small"
                text
                rounded
                severity="secondary"
                :aria-label="t('properties.listManager.renameList')"
                :data-testid="`rename-list-${row.name}`"
                @click="startRename(row.name)"
              />
              <Button
                icon="pi pi-trash"
                size="small"
                text
                rounded
                severity="secondary"
                :aria-label="t('properties.listManager.deleteList')"
                :data-testid="`delete-list-${row.name}`"
                @click="requestDelete(row)"
              />
            </span>
          </template>
        </div>
        <small v-if="renameError !== null && renaming === row.name" class="row-error">
          {{ renameError }}
        </small>
        <div v-if="confirmingDelete === row.name" class="delete-confirm" data-testid="delete-confirm">
          <small>
            {{ t('properties.listManager.deleteWarning', { count: row.usedBy.length, names: row.usedBy.join(', ') }, row.usedBy.length) }}
          </small>
          <Button
            :label="t('properties.listManager.deleteAnyway')"
            severity="danger"
            size="small"
            data-testid="delete-confirm-button"
            @click="requestDelete(row)"
          />
          <Button
            :label="t('properties.listManager.keep')"
            severity="secondary"
            size="small"
            text
            @click="confirmingDelete = null"
          />
        </div>
      </li>
    </ul>

    <template #footer>
      <Button
        :label="t('properties.listManager.newList')"
        icon="pi pi-plus"
        severity="secondary"
        data-testid="new-choice-list"
        @click="createList"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.empty-note {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.list-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.list-row {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-m) 0;
  border-bottom: 1px solid var(--odk-border-color);
}

.list-row:last-child {
  border-bottom: none;
}

.list-row-main {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  min-height: 32px;
}

.list-name {
  font-size: 0.85rem;
  background: var(--odk-light-background-color);
  padding: 2px 6px;
  border-radius: 3px;
}

.list-meta {
  flex: 1;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.list-actions {
  display: inline-flex;
}

.rename-input {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
}

.row-error {
  color: var(--odk-error-text-color);
  font-size: 0.75rem;
}

.delete-confirm {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  background: var(--odk-light-background-color);
  border-radius: var(--odk-radius);
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
}

.delete-confirm small {
  flex: 1;
  color: var(--odk-warning-text-color);
}
</style>
