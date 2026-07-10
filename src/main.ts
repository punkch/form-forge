import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import 'primeicons/primeicons.css'
import '@/styles/odk-tokens.css'
import '@/styles/builder.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'

import App from '@/App.vue'
import { i18n } from '@/i18n'
import { setLocale } from '@/i18n/setLocale'
import { router } from '@/router'
import { useUiStore } from '@/stores/ui'
import { odkPreset } from '@/styles/odk-preset'

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

// Apply the persisted UI language (and <html lang dir>) before first paint.
setLocale(useUiStore(pinia).locale)

app.mount('#app')
