<script setup lang="ts">
/**
 * The toolbar "Central" toggle, shared by the editor and library toolbars. Opens
 * / closes the Central slide-over, mirroring the Preview pane toggle's idiom
 * (icon + label, active severity + `aria-pressed`). Callers gate it themselves
 * (`central.hasServers && !embed.active`) and bind their own open-state via
 * `v-model:open`.
 */
import Button from 'primevue/button'

import { useAppI18n } from '@/i18n'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ testid: string }>()

const { t } = useAppI18n()
</script>

<template>
  <Button
    v-tooltip.bottom="open ? t('central.drawer.tooltipHide') : t('central.drawer.tooltipShow')"
    icon="pi pi-cloud"
    :label="t('central.drawer.toggle')"
    :severity="open ? 'primary' : 'secondary'"
    :aria-pressed="open"
    :aria-label="t('central.drawer.heading')"
    :data-testid="testid"
    @click="open = !open"
  />
</template>
