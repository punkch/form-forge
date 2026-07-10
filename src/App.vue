<script setup lang="ts">
import Button from 'primevue/button'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'

import { useAppI18n } from '@/i18n'
import { SW_UPDATE_TOAST_GROUP, useSwUpdate } from '@/pwa/registerSW'

const { t } = useAppI18n()

// Service-worker registration + hybrid update policy (no-op in dev/tests).
const { applyUpdate } = useSwUpdate()
</script>

<template>
  <RouterView />
  <Toast position="bottom-right" />
  <!-- Sticky "new version" prompt; posted by src/pwa/registerSW.ts. -->
  <Toast position="top-center" :group="SW_UPDATE_TOAST_GROUP">
    <template #message="{ message }">
      <div class="sw-update-toast" data-testid="sw-update-toast">
        <div class="sw-update-text">
          <span class="sw-update-summary">{{ message.summary }}</span>
          <span class="sw-update-detail">{{ message.detail }}</span>
        </div>
        <Button
          :label="t('shell.pwa.reload')"
          size="small"
          data-testid="sw-update-reload"
          @click="applyUpdate"
        />
      </div>
    </template>
  </Toast>
  <ConfirmDialog />
</template>

<style scoped>
.sw-update-toast {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-l);
}

.sw-update-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.sw-update-summary {
  font-weight: 500;
}

.sw-update-detail {
  font-size: var(--odk-hint-font-size);
}
</style>
