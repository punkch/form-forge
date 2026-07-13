<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'

import { useAppI18n } from '@/i18n'
import { useUiStore } from '@/stores/ui'
import type { ThemeScheme } from '@/theme'

// Header quick-toggle for the colour-scheme preference. Cycles through the
// three states in the order a viewer expects (start neutral, then the explicit
// overrides); the accent picker and full scheme select live in Settings.
const ui = useUiStore()
const { t } = useAppI18n()

const NEXT: Record<ThemeScheme, ThemeScheme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}

const ICONS: Record<ThemeScheme, string> = {
  system: 'pi pi-desktop',
  light: 'pi pi-sun',
  dark: 'pi pi-moon',
}

const icon = computed((): string => ICONS[ui.theme])

// aria-label + tooltip name the CURRENT scheme and say a click advances it.
// Scheme names come from the shared Appearance catalog (single source of truth).
const label = computed((): string =>
  t('shell.theme.toggle', { state: t(`appSettings.appearance.scheme.${ui.theme}`) }))

const cycle = (): void => {
  ui.theme = NEXT[ui.theme]
}
</script>

<template>
  <Button
    v-tooltip.bottom="label"
    :icon="icon"
    severity="secondary"
    text
    :aria-label="label"
    data-testid="theme-toggle"
    @click="cycle"
  />
</template>
