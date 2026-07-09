// Component tests run in happy-dom; give them IndexedDB too so stores work.
import 'fake-indexeddb/auto'
import { config } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'

// Pinia is NOT registered here: each test creates its own instance with
// setActivePinia and passes it via mount options so component and test share
// one store container.
config.global.plugins = [[PrimeVue, {}]]
config.global.directives = { tooltip: Tooltip }
