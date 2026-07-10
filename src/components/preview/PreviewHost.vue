<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type App } from 'vue'

import { useAppI18n } from '@/i18n'
import { makeFetchFormAttachment } from '@/preview/fetchFormAttachment'
import { loadWebForms } from '@/preview/webFormsLoader'

const { t } = useAppI18n()

const props = withDefaults(defineProps<{
  formXml: string
  formRecordId: string
  /** Changing this remounts the engine (web-forms has no reactive re-init). */
  instanceKey: number
  /** Rendered form width: '360px' | '768px' | '100%' (device presets). */
  contentWidth?: string
}>(), { contentWidth: '100%' })

const emit = defineEmits<{
  /** recovered = true when the host is reverting to the last good XML. */
  'engine-error': [message: string, recovered: boolean]
  submit: [payload: unknown, callback: (outcome?: unknown) => void]
}>()

const mountEl = ref<HTMLDivElement | null>(null)
const loading = ref(true)

const framed = computed(() => props.contentWidth !== '100%')

let childApp: App | null = null
/** Last XML that mounted without throwing — reverted to on engine errors. */
let lastGoodXml: string | null = null
let generation = 0

const destroyChild = (): void => {
  childApp?.unmount()
  childApp = null
  if (mountEl.value !== null) mountEl.value.innerHTML = ''
}

/** Tear down a failing app before anything is reported upward, so
 * web-forms' own error UI can never render or overlay outside the pane. */
const destroyFailedApp = (app: App, container: HTMLElement): void => {
  try {
    app.unmount()
  } catch {
    // The app may still be mid-mount; removing its container is enough.
  }
  container.remove()
  if (childApp === app) childApp = null
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
  let failed = false
  const reportError = (error: unknown): void => {
    destroyFailedApp(app, container)
    if (failed || myGeneration !== generation) return
    failed = true
    const message = error instanceof Error ? error.message : String(error)
    const recovered = !isRevert && lastGoodXml !== null && lastGoodXml !== xml
    emit('engine-error', message, recovered)
    if (recovered && lastGoodXml !== null) void mountXml(lastGoodXml, true)
  }
  app.config.errorHandler = reportError
  try {
    app.mount(container)
    if (!failed) {
      childApp = app
      if (!isRevert) lastGoodXml = xml
    }
  } catch (error) {
    reportError(error)
  } finally {
    if (myGeneration === generation) loading.value = false
  }
}

onMounted(() => { void mountXml(props.formXml) })
watch(() => props.instanceKey, () => { void mountXml(props.formXml) })
// A different form must never inherit (or revert to) the previous form's
// last-good XML — drop it and remount from whatever the new form provides.
watch(() => props.formRecordId, () => {
  lastGoodXml = null
  if (typeof props.formXml === 'string' && props.formXml !== '') {
    void mountXml(props.formXml)
  } else {
    generation++
    destroyChild()
    loading.value = false
  }
})
onBeforeUnmount(() => { generation++; destroyChild() })
</script>

<template>
  <div
    class="preview-host"
    :class="{ 'device-framed': framed }"
    :style="{ '--builder-preview-content-width': contentWidth }"
    data-testid="preview-host"
  >
    <div v-if="loading" class="preview-loading">
      <ProgressSpinner style="width: 36px; height: 36px" />
      <span>{{ t('preview.host.loadingEngine') }}</span>
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
  width: min(var(--builder-preview-content-width, 100%), 100%);
  margin-inline: auto;
}

.preview-host.device-framed {
  background: var(--odk-muted-background-color);
  padding: var(--odk-spacing-m);
}

.preview-host.device-framed .preview-mount {
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  /* Same brand tint as --builder-drawer-shadow, dropped instead of cast. */
  box-shadow: 0 2px 12px rgba(20, 66, 90, 0.18);
  background: var(--odk-light-background-color);
  overflow: hidden;
}
</style>
