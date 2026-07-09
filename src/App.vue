<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
</script>

<template>
  <RouterView />
  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>
