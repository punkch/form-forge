// Component tests run in happy-dom; give them IndexedDB too so stores work.
import 'fake-indexeddb/auto'
import { config } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'

import { i18n } from '@/i18n'

// Pinia is NOT registered here: each test creates its own instance with
// setActivePinia and passes it via mount options so component and test share
// one store container.
// i18n IS registered app-wide (same `en`-locale instance as the app) so every
// mounted component gets $t/useI18n and keeps rendering English strings.
config.global.plugins = [[PrimeVue, {}], [i18n]]
config.global.directives = { tooltip: Tooltip }
