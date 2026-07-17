<script setup lang="ts">
/**
 * Shared chrome for the two Central slide-overs (the editor's per-form hub and
 * the library's import panel): the right-side `<aside>`, the header with the
 * guide trigger and close button, and the once-per-session inline vault gate
 * (`DrawerUnlock` while locked, the body slot once unlocked). Only the body
 * content and the anchoring differ between the two — the editor drawer overlays
 * the editor grid (`variant="editor"`, absolute), the library drawer overlays
 * the viewport (`variant="library"`, fixed).
 */
import Button from 'primevue/button'

import DrawerUnlock from '@/components/central/DrawerUnlock.vue'
import GuideTrigger from '@/components/help/GuideTrigger.vue'
import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

defineProps<{
  variant: 'editor' | 'library'
  testid: string
  closeTestid: string
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useAppI18n()
const central = useCentralStore()
</script>

<template>
  <aside
    class="central-drawer"
    :class="`central-drawer--${variant}`"
    :data-testid="testid"
    :aria-label="t('central.drawer.regionLabel')"
  >
    <header class="central-drawer-header">
      <h2 class="central-drawer-title">
        {{ t('central.drawer.heading') }}
        <GuideTrigger guide="central" />
      </h2>
      <Button
        icon="pi pi-times"
        severity="secondary"
        text
        rounded
        :aria-label="t('central.drawer.close')"
        :data-testid="closeTestid"
        @click="emit('close')"
      />
    </header>

    <div class="central-drawer-body">
      <DrawerUnlock v-if="!central.isUnlocked" />
      <slot v-else />
    </div>
  </aside>
</template>

<style scoped>
.central-drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  inset-inline-end: 0;
  width: min(420px, 100%);
  z-index: var(--odk-z-index-overlay);
  display: flex;
  flex-direction: column;
  background: var(--odk-base-background-color);
  border-inline-start: 1px solid var(--odk-border-color);
  box-shadow: var(--builder-drawer-shadow);
}

/* The library panel overlays the whole viewport (no positioned grid parent). */
.central-drawer--library {
  position: fixed;
}

.central-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-m) var(--odk-spacing-l);
  border-bottom: 1px solid var(--odk-border-color);
}

.central-drawer-title {
  margin: 0;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: var(--builder-spacing-xs);
}

.central-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--odk-spacing-l);
}
</style>
