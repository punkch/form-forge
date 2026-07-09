<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { h, onBeforeUnmount, onMounted, ref, watch, type App } from 'vue'

import { makeFetchFormAttachment } from '@/preview/fetchFormAttachment'
import { loadWebForms } from '@/preview/webFormsLoader'

const props = defineProps<{
  formXml: string
  formRecordId: string
  /** Changing this remounts the engine (web-forms has no reactive re-init). */
  instanceKey: number
}>()

const emit = defineEmits<{
  'engine-error': [message: string]
  submit: [payload: unknown, callback: (outcome?: unknown) => void]
}>()

const mountEl = ref<HTMLDivElement | null>(null)
const loading = ref(true)

let childApp: App | null = null
/** Last XML that mounted without throwing — reverted to on engine errors. */
let lastGoodXml: string | null = null
let generation = 0

const destroyChild = (): void => {
  childApp?.unmount()
  childApp = null
  if (mountEl.value !== null) mountEl.value.innerHTML = ''
}

const mountXml = async (xml: string, isRevert = false): Promise<void> => {
  const myGeneration = ++generation
  loading.value = true
  const { OdkWebForm, webFormsPlugin } = await loadWebForms()
  if (myGeneration !== generation || mountEl.value === null) return

  destroyChild()
  const container = document.createElement('div')
  mountEl.value.appendChild(container)

  const fetchFormAttachment = makeFetchFormAttachment(props.formRecordId)
  const { createApp } = await import('vue')
  if (myGeneration !== generation) return

  const app = createApp({
    render: () => h(OdkWebForm, {
      formXml: xml,
      fetchFormAttachment,
      missingResourceBehavior: 'BLANK',
      onSubmit: (payload: unknown, callback: (outcome?: unknown) => void) => {
        emit('submit', payload, callback)
      },
    }),
  })
  // The plugin installs web-forms' bundled PrimeVue into this child app only.
  app.use(webFormsPlugin)
  app.config.errorHandler = (error) => {
    const message = error instanceof Error ? error.message : String(error)
    emit('engine-error', message)
    if (!isRevert && lastGoodXml !== null && lastGoodXml !== xml) {
      void mountXml(lastGoodXml, true)
    }
  }
  try {
    app.mount(container)
    childApp = app
    if (!isRevert) lastGoodXml = xml
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emit('engine-error', message)
    if (!isRevert && lastGoodXml !== null && lastGoodXml !== xml) {
      void mountXml(lastGoodXml, true)
    }
  } finally {
    if (myGeneration === generation) loading.value = false
  }
}

onMounted(() => { void mountXml(props.formXml) })
watch(() => props.instanceKey, () => { void mountXml(props.formXml) })
onBeforeUnmount(() => { generation++; destroyChild() })
</script>

<template>
  <div class="preview-host" data-testid="preview-host">
    <div v-if="loading" class="preview-loading">
      <ProgressSpinner style="width: 36px; height: 36px" />
      <span>Loading form engine…</span>
    </div>
    <div ref="mountEl" class="preview-mount" />
  </div>
</template>

<style scoped>
.preview-host {
  position: relative;
  height: 100%;
  overflow-y: auto;
  background: var(--odk-light-background-color);
}

.preview-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  z-index: 1;
  background: var(--odk-light-background-color);
}

.preview-mount {
  min-height: 100%;
}
</style>
