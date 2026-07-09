<script setup lang="ts">
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
</script>

<template>
  <div class="builder-unsupported-viewport">
    <i class="pi pi-exclamation-triangle" />
    <span>Form authoring needs a tablet-sized screen or larger.</span>
  </div>
  <RouterView />
  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>
