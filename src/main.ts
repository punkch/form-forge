import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import 'primeicons/primeicons.css'
import '@/styles/odk-tokens.css'
import '@/styles/builder.css'
// Theming overrides. Vite-owned stylesheets keyed on :root[data-ff-theme|accent]
// (specificity 0,2,0) so they beat both PrimeVue runtimes' plain :root (0,1,0)
// injections and survive the preview child rewriting the shared PrimeVue styles.
import '@/styles/generated/theme-dark.css'
import '@/styles/generated/theme-accents.css'
import '@/styles/builder-dark.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'

import App from '@/App.vue'
import { embedDetection } from '@/embed/detect'
import { i18n } from '@/i18n'
import { setLocale } from '@/i18n/setLocale'
import { setPersistenceBackend } from '@/persistence/backend'
import { router } from '@/router'
import { useEmbedStore } from '@/stores/embed'
import { useUiStore } from '@/stores/ui'
import { odkPreset } from '@/styles/odk-preset'
import { initThemeController } from '@/theme'

// Embed detection runs before anything mounts: the memory backend must be in
// place before any store touches persistence (the host owns durability unless
// init asks for 'local'), and 'ready' must be posted as soon as the bridge
// listens. The bridge, protocol and memory backend are dynamically imported
// only in the embed branch, so a normal session never parses them.
const embed = embedDetection()

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(i18n)
// Same preset/options as the PrimeVue bundled inside @getodk/web-forms, so
// the duplicate :root token injection is idempotent. Deliberately NO cssLayer:
// web-forms' runtime CSS is unlayered and would win over layered host tokens.
app.use(PrimeVue, {
  theme: {
    preset: odkPreset,
    options: { darkModeSelector: false },
  },
})
app.use(ConfirmationService)
app.use(ToastService)
app.directive('tooltip', Tooltip)

if (embed.active) {
  const [{ startEmbedBridge }, { createMemoryBackend }] = await Promise.all([
    import('@/embed/bridge'),
    import('@/persistence/memory-backend'),
  ])
  setPersistenceBackend(createMemoryBackend())
  const embedStore = useEmbedStore(pinia)
  embedStore.active = true
  embedStore.hostOrigin = embed.origin
  startEmbedBridge({ router, pinia })
} else {
  // One-time rename of the workspace IndexedDB (odk-form-builder → form-forge).
  // Must run before any store opens the renamed database. Embed sessions never
  // touch Dexie (memory backend above), so this is the local path only.
  const { migrateLegacyDb } = await import('@/persistence/migrate-legacy-db')
  await migrateLegacyDb()
}

// Apply the persisted UI language (and <html lang dir>) before first paint.
setLocale(useUiStore(pinia).locale)
// Apply the persisted theme/accent and start tracking OS scheme + preference
// changes. The inline no-FOUC script already stamped the attributes; this keeps
// them in sync reactively (and lets an embed host override them).
initThemeController(useUiStore(pinia))

app.mount('#app')
