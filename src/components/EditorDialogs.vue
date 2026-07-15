<script setup lang="ts">
// Editor-level dialogs, driven by editor.activeDialog. The editor view mounts
// this single component; menu entries only need to set the store value.
import AttachmentsDialog from '@/components/attachments/AttachmentsDialog.vue'
import ChoiceListManagerDialog from '@/components/choices/ChoiceListManagerDialog.vue'
import DatasetPreviewDialog from '@/components/datasets/DatasetPreviewDialog.vue'
import QuestionTypeHelpDrawer from '@/components/help/QuestionTypeHelpDrawer.vue'
import FormSettingsDialog from '@/components/settings/FormSettingsDialog.vue'
import TranslationsDialog from '@/components/translations/TranslationsDialog.vue'
</script>

<template>
  <ChoiceListManagerDialog />
  <TranslationsDialog />
  <FormSettingsDialog />
  <AttachmentsDialog />
  <DatasetPreviewDialog />
  <QuestionTypeHelpDrawer />
</template>
