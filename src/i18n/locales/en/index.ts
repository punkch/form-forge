// English UI catalog, one JSON file per app area so parallel string-extraction
// work never collides on a shared file. Each file carries its namespace as its
// single top-level key ({ "palette": { … } }) — that exact shape is what
// @intlify/eslint-plugin-vue-i18n reads from disk for no-missing-keys, so the
// runtime catalog and the lint catalog can never drift.
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
import types from './types.json'

export const en = {
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
  ...types,
}
