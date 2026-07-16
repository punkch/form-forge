// Spanish UI catalog, one JSON file per app area, mirroring `en/index.ts`'s
// structure exactly so the namespace shape (and no-missing-keys' per-file
// reads) never drifts between locales.
import type { MessageSchema } from '@/i18n'

import appSettings from './appSettings.json'
import canvas from './canvas.json'
import central from './central.json'
import common from './common.json'
import dialogs from './dialogs.json'
import guides from './guides.json'
import help from './help.json'
import importExport from './importExport.json'
import library from './library.json'
import palette from './palette.json'
import preview from './preview.json'
import properties from './properties.json'
import settings from './settings.json'
import shell from './shell.json'
import stores from './stores.json'

export const es = {
  ...common,
  ...shell,
  ...library,
  ...palette,
  ...canvas,
  ...properties,
  ...preview,
  ...dialogs,
  ...help,
  ...guides,
  ...importExport,
  ...settings,
  ...appSettings,
  ...stores,
  ...central,
} satisfies MessageSchema
