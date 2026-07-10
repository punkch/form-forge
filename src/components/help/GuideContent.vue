<script setup lang="ts">
// Body of one workflow guide: summary, numbered steps, and an optional deep
// link into the ODK docs (same .help-read-more pattern as the type help).
// Rendered by QuestionTypeHelpDrawer's guide detail mode, which shows the
// guide's title in the drawer header.
import { computed } from 'vue'

import { guideHelp, type GuideKey } from '@/help/content'
import { guideDocsUrl } from '@/help/guides'
import { useAppI18n } from '@/i18n'

const props = defineProps<{ guide: GuideKey }>()

const { t } = useAppI18n()

const help = computed(() => guideHelp[props.guide])
const readMoreUrl = computed(() => guideDocsUrl(props.guide))
</script>

<template>
  <div class="guide-content" :data-testid="`help-guide-${guide}`">
    <p class="guide-summary">{{ t(help.summary) }}</p>

    <ol class="guide-steps" data-testid="guide-steps">
      <li v-for="step in help.steps" :key="step">{{ t(step) }}</li>
    </ol>

    <a
      v-if="readMoreUrl"
      :href="readMoreUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="help-read-more"
      data-testid="guide-read-more"
    >
      <i class="pi pi-external-link" />
      {{ t('guides.ui.readMore') }}
    </a>
  </div>
</template>

<style scoped>
.guide-content {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
  font-size: var(--odk-hint-font-size);
}

.guide-summary {
  margin: 0;
  line-height: 1.5;
  color: var(--odk-text-color);
}

.guide-steps {
  margin: 0;
  padding-inline-start: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.guide-steps li {
  line-height: 1.5;
  color: var(--odk-text-color);
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
