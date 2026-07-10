<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { computed, ref } from 'vue'

import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import { createNode } from '@/core/model/factory'
import { flatten, insertNode, uniqueName } from '@/core/model/ops'
import type { EntityDeclaration, FormSettings, QuestionNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'settings',
  set: (open: boolean) => { editor.activeDialog = open ? 'settings' : null },
})

const activeTab = ref('general')

const settings = computed(() => form.doc?.settings)
const entities = computed(() => form.doc?.entities)

const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]): void => {
  form.mutate(t('settings.dialog.undoEdit', { key: String(key) }), (d) => {
    if (value === '' || value === undefined) delete d.settings[key]
    else d.settings[key] = value
  }, { coalesce: true })
}

// --- entity declaration -----------------------------------------------------

const declareEntities = (): void => {
  form.mutate(t('settings.entities.undoDeclare'), (d) => {
    if (d.entities === undefined) d.entities = { datasetName: '' }
  })
}

const removeEntities = (): void => {
  form.mutate(t('settings.entities.undoRemove'), (d) => { delete d.entities })
}

const setEntity = (key: keyof EntityDeclaration, value: string): void => {
  form.mutate(t('settings.entities.undoEditEntity', { key }), (d) => {
    if (d.entities === undefined) return
    if (key === 'datasetName') d.entities.datasetName = value
    else if (value === '') delete d.entities[key]
    else d.entities[key] = value
  }, { coalesce: true })
}

const entityIssues = computed(() =>
  form.issues.filter((i) =>
    i.code.startsWith('entities.') && 'setting' in i.scope && i.scope.setting === 'entities'))

// --- save_to overview -------------------------------------------------------

const saveToRows = computed(() => {
  if (form.doc === null) return []
  return flatten(form.doc.children)
    .filter((n): n is QuestionNode => n.kind === 'question' && n.saveTo !== undefined && n.saveTo !== '')
    .map((n) => ({ id: n.id, name: n.name, property: n.saveTo ?? '' }))
})

const goToQuestion = (id: string): void => {
  editor.select(id)
  editor.revealNodeId = id
  visible.value = false
}

// --- follow-up form wizard --------------------------------------------------

const followUpCreatedName = ref<string | null>(null)

const datasetFile = computed(() => {
  const name = entities.value?.datasetName.trim() ?? ''
  return name === '' ? null : `${name}.csv`
})

/**
 * One undo step: add a select_one_from_file question consuming
 * <dataset>.csv, point entity_id at it and default update_if to true().
 */
const setUpFollowUp = (): void => {
  if (datasetFile.value === null) return
  form.mutate(t('settings.entities.undoFollowUp'), (d) => {
    if (d.entities === undefined) return
    const node = createNode(d, 'select_one_from_file') as QuestionNode
    node.name = uniqueName(d, d.entities.datasetName.trim())
    node.itemsetFile = `${d.entities.datasetName.trim()}.csv`
    insertNode(d, node, null, 0)
    d.entities.entityId = `\${${node.name}}`
    if (d.entities.updateIf === undefined || d.entities.updateIf.trim() === '') {
      d.entities.updateIf = 'true()'
    }
    followUpCreatedName.value = node.name
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('settings.dialog.header')"
    modal
    :style="{ width: '34rem' }"
    data-testid="settings-dialog"
  >
    <Tabs v-if="settings" v-model:value="activeTab">
      <TabList>
        <Tab value="general" data-testid="settings-tab-general">{{ t('settings.tabs.general') }}</Tab>
        <Tab value="entities" data-testid="settings-tab-entities">{{ t('settings.tabs.entities') }}</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="general">
          <div class="settings-fields">
            <label class="prop-field">
              <span>{{ t('settings.dialog.formTitle') }}</span>
              <InputText
                :model-value="settings.formTitle ?? ''"
                data-testid="setting-form-title"
                @update:model-value="set('formTitle', $event ?? '')"
              />
            </label>
            <div class="settings-row">
              <label class="prop-field grow">
                <span>{{ t('settings.dialog.formId') }}</span>
                <InputText
                  :model-value="settings.formId ?? ''"
                  class="mono"
                  data-testid="setting-form-id"
                  @update:model-value="set('formId', $event ?? '')"
                />
              </label>
              <label class="prop-field grow">
                <span>{{ t('settings.dialog.version') }}</span>
                <InputText
                  :model-value="settings.version ?? ''"
                  class="mono"
                  data-testid="setting-version"
                  @update:model-value="set('version', $event ?? '')"
                />
              </label>
            </div>
            <label class="prop-field">
              <span>{{ t('settings.dialog.instanceName') }}</span>
              <ExpressionInput
                :model-value="settings.instanceName ?? ''"
                field="instanceName"
                node-id=""
                :placeholder="t('settings.dialog.instanceNamePlaceholder')"
                @update:model-value="set('instanceName', $event)"
              />
            </label>
            <label class="prop-field">
              <span>{{ t('settings.dialog.style') }}</span>
              <InputText
                :model-value="settings.style ?? ''"
                :placeholder="t('settings.dialog.stylePlaceholder')"
                data-testid="setting-style"
                @update:model-value="set('style', $event ?? '')"
              />
            </label>
            <label class="prop-field">
              <span>{{ t('settings.dialog.submissionUrl') }}</span>
              <InputText
                :model-value="settings.submissionUrl ?? ''"
                :placeholder="t('settings.dialog.submissionUrlPlaceholder')"
                @update:model-value="set('submissionUrl', $event ?? '')"
              />
            </label>
            <label class="prop-field">
              <span>{{ t('settings.dialog.publicKey') }}</span>
              <InputText
                :model-value="settings.publicKey ?? ''"
                class="mono"
                @update:model-value="set('publicKey', $event ?? '')"
              />
            </label>
            <label class="settings-toggle">
              <Checkbox
                :model-value="settings.allowChoiceDuplicates === true"
                binary
                @update:model-value="set('allowChoiceDuplicates', $event === true ? true : undefined)"
              />
              <span>{{ t('settings.dialog.allowChoiceDuplicates') }}</span>
            </label>
          </div>
        </TabPanel>

        <TabPanel value="entities">
          <div v-if="entities === undefined" class="settings-fields entities-empty">
            <p class="entities-intro">{{ t('settings.entities.intro') }}</p>
            <p class="entities-muted">{{ t('settings.entities.noDeclaration') }}</p>
            <Button
              :label="t('settings.entities.declare')"
              icon="pi pi-plus"
              size="small"
              data-testid="entity-declare"
              @click="declareEntities"
            />
          </div>

          <div v-else class="settings-fields">
            <label class="prop-field">
              <span>{{ t('settings.entities.datasetName') }}</span>
              <InputText
                :model-value="entities.datasetName"
                class="mono"
                :placeholder="t('settings.entities.datasetNamePlaceholder')"
                data-testid="entity-dataset-name"
                @update:model-value="setEntity('datasetName', $event ?? '')"
              />
            </label>
            <label class="prop-field">
              <span>{{ t('settings.entities.label') }}</span>
              <ExpressionInput
                :model-value="entities.label ?? ''"
                field="entityLabel"
                node-id=""
                :placeholder="t('settings.entities.labelPlaceholder')"
                @update:model-value="setEntity('label', $event)"
              />
            </label>
            <div class="settings-row">
              <label class="prop-field grow">
                <span>{{ t('settings.entities.createIf') }}</span>
                <ExpressionInput
                  :model-value="entities.createIf ?? ''"
                  field="createIf"
                  node-id=""
                  :placeholder="t('settings.entities.createIfPlaceholder')"
                  @update:model-value="setEntity('createIf', $event)"
                />
              </label>
              <label class="prop-field grow">
                <span>{{ t('settings.entities.updateIf') }}</span>
                <ExpressionInput
                  :model-value="entities.updateIf ?? ''"
                  field="updateIf"
                  node-id=""
                  :placeholder="t('settings.entities.updateIfPlaceholder')"
                  @update:model-value="setEntity('updateIf', $event)"
                />
              </label>
            </div>
            <label class="prop-field">
              <span>{{ t('settings.entities.entityId') }}</span>
              <ExpressionInput
                :model-value="entities.entityId ?? ''"
                field="entityId"
                node-id=""
                :placeholder="t('settings.entities.entityIdPlaceholder')"
                @update:model-value="setEntity('entityId', $event)"
              />
            </label>

            <small
              v-for="(issue, i) in entityIssues"
              :key="i"
              class="prop-issue"
              data-testid="entity-issue"
            >{{ issue.message }}</small>

            <section class="entities-save-to">
              <h4>{{ t('settings.entities.saveToHeading') }}</h4>
              <p v-if="saveToRows.length === 0" class="entities-muted">
                {{ t('settings.entities.saveToEmpty') }}
              </p>
              <table v-else class="entities-table" data-testid="entity-save-to-table">
                <thead>
                  <tr>
                    <th>{{ t('settings.entities.saveToQuestion') }}</th>
                    <th>{{ t('settings.entities.saveToProperty') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in saveToRows" :key="row.id" data-testid="entity-save-to-row">
                    <td>
                      <button
                        type="button"
                        class="entities-link"
                        :aria-label="t('settings.entities.goToQuestion', { name: row.name })"
                        @click="goToQuestion(row.id)"
                      >
                        <code>{{ row.name }}</code>
                      </button>
                    </td>
                    <td><code>{{ row.property }}</code></td>
                  </tr>
                </tbody>
              </table>
            </section>

            <div class="entities-actions">
              <Button
                :label="t('settings.entities.followUp')"
                icon="pi pi-arrow-right-arrow-left"
                size="small"
                severity="secondary"
                :disabled="datasetFile === null"
                data-testid="entity-follow-up"
                @click="setUpFollowUp"
              />
              <Button
                :label="t('settings.entities.remove')"
                icon="pi pi-trash"
                size="small"
                severity="danger"
                text
                data-testid="entity-remove"
                @click="removeEntities"
              />
            </div>
            <small v-if="datasetFile !== null && followUpCreatedName === null" class="entities-muted">
              {{ t('settings.entities.followUpHint', { file: datasetFile }) }}
            </small>
            <small v-if="followUpCreatedName !== null" class="entities-done" data-testid="entity-follow-up-done">
              {{ t('settings.entities.followUpDone', { name: followUpCreatedName }) }}
            </small>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Dialog>
</template>

<style scoped>
@import '../properties/prop-section.css';

.settings-fields {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
}

.settings-row {
  display: flex;
  gap: var(--odk-spacing-l);
}

.grow {
  flex: 1;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.settings-toggle {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
}

.entities-empty {
  align-items: flex-start;
}

.entities-intro {
  margin: 0;
  line-height: 1.5;
}

.entities-muted {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.entities-done {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.entities-save-to h4 {
  margin: 0 0 var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
  font-weight: 600;
  color: var(--odk-muted-text-color);
}

.entities-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--odk-hint-font-size);
}

.entities-table th,
.entities-table td {
  text-align: start;
  padding: var(--odk-spacing-s);
  border-bottom: 1px solid var(--odk-border-color);
}

.entities-table th {
  color: var(--odk-muted-text-color);
  font-weight: 500;
}

.entities-link {
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--odk-primary-text-color);
}

.entities-link:hover,
.entities-link:focus-visible {
  text-decoration: underline;
}

.entities-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-l);
}
</style>
