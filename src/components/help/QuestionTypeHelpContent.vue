<script setup lang="ts">
// Body of the per-type help view: behavior text, XLSForm notes, appearance
// and parameter tables straight from the registry, and the docs link.
// Shared by QuestionTypeHelpDrawer and HelpReference so both stay identical.
import { computed } from 'vue'

import type { QuestionTypeDefinition } from '@/core/registry/question-types'
import { docsUrl, getTypeHelp } from '@/help/content'
import { useAppI18n } from '@/i18n'

const props = defineProps<{ def: QuestionTypeDefinition }>()

const { t } = useAppI18n()

const help = computed(() => getTypeHelp(props.def.type))
const readMoreUrl = computed(() => docsUrl(props.def))
</script>

<template>
  <div class="help-content" data-testid="help-content">
    <template v-if="help">
      <section>
        <h3>{{ t('help.ui.drawer.whatItDoes') }}</h3>
        <p>{{ t(help.whatItDoes) }}</p>
      </section>
      <section>
        <h3>{{ t('help.ui.drawer.xlsform') }}</h3>
        <p>{{ t(help.xlsformNotes) }}</p>
      </section>
    </template>

    <section v-if="(def.appearances?.length ?? 0) > 0">
      <h3>{{ t('help.ui.drawer.appearances') }}</h3>
      <div class="help-table-scroll">
        <table class="help-table" data-testid="help-appearances">
          <thead>
            <tr>
              <th>{{ t('help.ui.drawer.colName') }}</th>
              <th>{{ t('help.ui.drawer.colDescription') }}</th>
              <th>{{ t('help.ui.drawer.colSupport') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="appearance in def.appearances" :key="appearance.name">
              <td>
                <code>{{ appearance.name }}</code>
                <small v-if="appearance.combinable?.length" class="help-combinable">
                  {{ t('help.ui.drawer.combinesWith', { names: appearance.combinable.join(', ') }) }}
                </small>
              </td>
              <td>{{ appearance.description }}</td>
              <td class="help-badges">
                <span v-if="appearance.collectSupported" class="help-badge">{{ t('help.ui.drawer.badgeCollect') }}</span>
                <span v-if="appearance.enketoSupported" class="help-badge">{{ t('help.ui.drawer.badgeEnketo') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="(def.parameters?.length ?? 0) > 0">
      <h3>{{ t('help.ui.drawer.parameters') }}</h3>
      <div class="help-table-scroll">
        <table class="help-table" data-testid="help-parameters">
          <thead>
            <tr>
              <th>{{ t('help.ui.drawer.colName') }}</th>
              <th>{{ t('help.ui.drawer.colDescription') }}</th>
              <th>{{ t('help.ui.drawer.colDefault') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="param in def.parameters" :key="param.name">
              <td>
                <code>{{ param.name }}</code>
                <small v-if="param.required" class="help-combinable">{{ t('help.ui.drawer.requiredParam') }}</small>
              </td>
              <td>
                {{ param.description }}
                <template v-if="param.options">
                  {{ t('help.ui.drawer.optionsList', { options: param.options.join(', ') }) }}
                </template>
              </td>
              <td><code v-if="param.defaultValue !== undefined">{{ param.defaultValue }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <a
      v-if="readMoreUrl"
      :href="readMoreUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="help-read-more"
      data-testid="help-read-more"
    >
      <i class="pi pi-external-link" />
      {{ t('help.ui.drawer.readMore') }}
    </a>
  </div>
</template>

<style scoped>
.help-content {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
  font-size: var(--odk-hint-font-size);
}

.help-content section {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.help-content h3 {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--odk-muted-text-color);
}

.help-content p {
  margin: 0;
  line-height: 1.5;
  color: var(--odk-text-color);
}

.help-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: var(--odk-muted-background-color);
  border-radius: var(--odk-radius);
  padding: 1px 4px;
  white-space: nowrap;
}

.help-table-scroll {
  overflow-x: auto;
}

.help-table {
  width: 100%;
  border-collapse: collapse;
}

.help-table th {
  text-align: start;
  font-weight: 500;
  color: var(--odk-muted-text-color);
  padding: var(--odk-spacing-s) var(--odk-spacing-m) var(--odk-spacing-s) 0;
  border-bottom: 1px solid var(--odk-border-color);
}

.help-table td {
  vertical-align: top;
  padding: var(--odk-spacing-s) var(--odk-spacing-m) var(--odk-spacing-s) 0;
  border-bottom: 1px solid var(--odk-border-color);
  line-height: 1.4;
}

.help-table tr:last-child td {
  border-bottom: none;
}

.help-combinable {
  display: block;
  margin-top: 2px;
  color: var(--odk-light-muted-text-color);
  white-space: nowrap;
}

.help-badges {
  white-space: nowrap;
}

.help-badge {
  display: inline-block;
  padding: 0 6px;
  margin-inline-end: var(--odk-spacing-s);
  border: 1px solid var(--odk-border-color);
  border-radius: 999px;
  font-size: 0.75rem;
  color: var(--odk-muted-text-color);
  background: var(--odk-light-background-color);
}

.help-read-more {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  align-self: flex-start;
  color: var(--odk-primary-text-color);
  text-decoration: none;
}

.help-read-more:hover {
  text-decoration: underline;
}
</style>
