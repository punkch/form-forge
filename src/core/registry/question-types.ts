/**
 * Question type registry, keyed by XLSForm type token.
 *
 * Ported from the prototype's field-type-registry.ts and extended with the
 * XForm mapping metadata (bind type, body element, mediatype, preloads,
 * actions) each engine needs. Descriptions and platform-support flags follow
 * the XLSForm documentation (docs.getodk.org).
 */
import type { QuestionNode } from '../model/types'

export interface QuestionTypeParameter {
  name: string
  description: string
  type: 'string' | 'number' | 'boolean'
  required?: boolean
  defaultValue?: string | number | boolean
  options?: string[]
}

export interface AppearanceOption {
  name: string
  description: string
  collectSupported: boolean
  enketoSupported: boolean
  /** Other appearances this can be combined with. */
  combinable?: string[]
}

export type QuestionCategory =
  | 'input'
  | 'select'
  | 'datetime'
  | 'media'
  | 'location'
  | 'display'
  | 'structure'
  | 'meta'

export interface XFormMapping {
  /** Value for bind/@type; undefined = no bind type (structure nodes). */
  bindType?: string
  /** Body control element; null = model-only (calculate, metadata, actions). */
  bodyElement?: 'input' | 'select1' | 'select' | 'upload' | 'trigger' | 'range' | 'odk:rank' | null
  /** upload/@mediatype. */
  mediatype?: string
  /** jr:preload / jr:preloadParams bind attributes. */
  preload?: { preload: string, preloadParams?: string }
  /** Model action element (start-geopoint, background-audio). */
  action?: 'odk:setgeopoint' | 'odk:recordaudio'
  /** Emit bind readonly="true()" (notes). */
  readonlyDefault?: boolean
  /** Instance node lives inside <meta> (audit). */
  inMeta?: boolean
}

export interface QuestionTypeDefinition {
  /** Canonical XLSForm type token (also the registry key). */
  type: string
  /** Short human title for the palette. */
  title: string
  description: string
  /**
   * Extra search synonyms folded into the palette + help search haystack, so
   * users find a type by the word they know (e.g. "photo" → Image) even when
   * it appears in neither the title, token nor description.
   */
  searchKeywords?: string[]
  category: QuestionCategory
  /** PrimeIcons class for palette/canvas. */
  icon: string
  collectSupported: boolean
  enketoSupported: boolean
  parameters?: QuestionTypeParameter[]
  appearances?: AppearanceOption[]
  isContainer?: boolean
  containerKind?: 'group' | 'repeat'
  requiresChoices?: boolean
  requiresFile?: boolean
  /**
   * "Read more" target in the ODK docs: either a fragment on
   * https://docs.getodk.org/form-question-types/ (bare anchor id) or, for
   * types documented elsewhere, an absolute URL. Resolved by `docsUrl()` in
   * src/help/content.ts.
   */
  docsAnchor?: string
  xform: XFormMapping
}

const exApp: AppearanceOption = {
  name: 'ex:',
  description: 'Launch the external Android app whose ID follows the ex: prefix',
  collectSupported: true,
  enketoSupported: false,
}

const thousandsSep: AppearanceOption = {
  name: 'thousands-sep',
  description: 'Show locale-dependent thousands separators on screen (not in submissions)',
  collectSupported: true,
  enketoSupported: true,
}

const newMedia: AppearanceOption = {
  name: 'new',
  description: 'Only allow capturing new media, not selecting existing files',
  collectSupported: true,
  enketoSupported: true,
}

const selectAppearances: AppearanceOption[] = [
  { name: 'minimal', description: 'Show a dropdown that expands to all choices when tapped', collectSupported: true, enketoSupported: true },
  { name: 'search', description: 'Allow searching the list of available choices', collectSupported: true, enketoSupported: true },
  { name: 'autocomplete', description: 'Filter choices as the user types', collectSupported: true, enketoSupported: true },
  { name: 'columns-pack', description: 'Pack as many choices as possible per line', collectSupported: true, enketoSupported: true },
  { name: 'columns', description: 'Show choices in 2–5 columns depending on screen size', collectSupported: true, enketoSupported: true },
  { name: 'columns-n', description: 'Show choices in exactly n columns', collectSupported: true, enketoSupported: true },
  { name: 'no-buttons', description: 'Hide radio buttons / checkboxes', collectSupported: true, enketoSupported: true },
  { name: 'image-map', description: 'Map choices onto the SVG named in the image column', collectSupported: true, enketoSupported: true },
  { name: 'label', description: 'Show only labels — the top row of a select grid', collectSupported: true, enketoSupported: true },
  { name: 'list-nolabel', description: 'Show only buttons — the inside of a select grid', collectSupported: true, enketoSupported: true },
  { name: 'list', description: 'Show horizontal buttons with their labels', collectSupported: true, enketoSupported: true },
]

export const questionTypeRegistry: Record<string, QuestionTypeDefinition> = {
  text: {
    type: 'text',
    title: 'Text',
    description: 'Prompt for a free-text response',
    searchKeywords: ['string', 'free text'],
    docsAnchor: 'text-widgets',
    category: 'input',
    icon: 'pi pi-align-left',
    collectSupported: true,
    enketoSupported: true,
    appearances: [
      { name: 'numbers', description: 'Numeric keypad, value saved as text', collectSupported: true, enketoSupported: true },
      { name: 'multiline', description: 'Multi-line text area', collectSupported: false, enketoSupported: true },
      { name: 'url', description: 'Button that opens the value as a website', collectSupported: true, enketoSupported: true },
      thousandsSep,
      { name: 'printer', description: 'Send the value to the printer app', collectSupported: true, enketoSupported: false },
      { name: 'masked', description: 'Show asterisks instead of the typed value', collectSupported: true, enketoSupported: false },
      exApp,
    ],
    xform: { bindType: 'string', bodyElement: 'input' },
  },

  integer: {
    type: 'integer',
    title: 'Integer',
    description: 'Prompt for an integer response',
    searchKeywords: ['number', 'whole'],
    docsAnchor: 'integer-widget',
    category: 'input',
    icon: 'pi pi-hashtag',
    collectSupported: true,
    enketoSupported: true,
    appearances: [
      thousandsSep,
      { name: 'counter', description: 'Increment/decrement buttons', collectSupported: true, enketoSupported: false },
      exApp,
    ],
    xform: { bindType: 'int', bodyElement: 'input' },
  },

  decimal: {
    type: 'decimal',
    title: 'Decimal',
    description: 'Prompt for a decimal response',
    searchKeywords: ['number', 'float'],
    docsAnchor: 'decimal-widget',
    category: 'input',
    icon: 'pi pi-percentage',
    collectSupported: true,
    enketoSupported: true,
    appearances: [
      thousandsSep,
      { name: 'bearing', description: 'Capture the device-reported compass direction', collectSupported: true, enketoSupported: false },
      exApp,
    ],
    xform: { bindType: 'decimal', bodyElement: 'input' },
  },

  range: {
    type: 'range',
    title: 'Range',
    description: 'Select a value in a numeric range defined in parameters',
    searchKeywords: ['slider'],
    docsAnchor: 'range-widgets',
    category: 'input',
    icon: 'pi pi-sliders-h',
    collectSupported: true,
    enketoSupported: true,
    parameters: [
      { name: 'start', description: 'Minimum value', type: 'number', required: true, defaultValue: 1 },
      { name: 'end', description: 'Maximum value', type: 'number', required: true, defaultValue: 10 },
      { name: 'step', description: 'Step size', type: 'number', defaultValue: 1 },
    ],
    appearances: [
      { name: 'vertical', description: 'Vertical slider', collectSupported: true, enketoSupported: true, combinable: ['no-ticks'] },
      { name: 'no-ticks', description: 'Hide slider tick marks', collectSupported: true, enketoSupported: true, combinable: ['vertical'] },
      { name: 'picker', description: 'Pick from a list of values', collectSupported: true, enketoSupported: true },
      { name: 'rating', description: 'Star rating', collectSupported: true, enketoSupported: true },
    ],
    // Serializer picks int vs decimal from start/end/step values.
    xform: { bindType: 'int', bodyElement: 'range' },
  },

  note: {
    type: 'note',
    title: 'Note',
    description: 'Show the user some text without asking for input',
    searchKeywords: ['label', 'instruction', 'read-only'],
    docsAnchor: 'note-widget',
    category: 'display',
    icon: 'pi pi-info-circle',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'string', bodyElement: 'input', readonlyDefault: true },
  },

  calculate: {
    type: 'calculate',
    title: 'Calculation',
    description: 'Record the result of the expression in the calculation column',
    searchKeywords: ['formula', 'computed'],
    docsAnchor: 'calculate',
    category: 'display',
    icon: 'pi pi-calculator',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'string', bodyElement: null },
  },

  acknowledge: {
    type: 'acknowledge',
    title: 'Acknowledge',
    description: 'Prompt the user to acknowledge a statement',
    docsAnchor: 'trigger-acknowledge-widget',
    category: 'input',
    icon: 'pi pi-check-square',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'string', bodyElement: 'trigger' },
  },

  select_one: {
    type: 'select_one',
    title: 'Select one',
    description: 'Select a single choice from a list',
    searchKeywords: ['radio', 'single choice', 'dropdown'],
    docsAnchor: 'single-select-widget',
    category: 'select',
    icon: 'pi pi-circle',
    collectSupported: true,
    enketoSupported: true,
    requiresChoices: true,
    parameters: [
      { name: 'randomize', description: 'Randomize choice order', type: 'boolean', defaultValue: false },
      { name: 'seed', description: 'Seed for consistent randomization', type: 'string' },
    ],
    appearances: [
      ...selectAppearances,
      { name: 'quick', description: 'Advance to the next question after selection', collectSupported: true, enketoSupported: false },
      { name: 'likert', description: 'Horizontal Likert scale', collectSupported: true, enketoSupported: true },
      { name: 'map', description: 'Show choices on a map using their geometry column', collectSupported: true, enketoSupported: false },
    ],
    xform: { bindType: 'string', bodyElement: 'select1' },
  },

  select_multiple: {
    type: 'select_multiple',
    title: 'Select multiple',
    description: 'Select any number of choices from a list',
    searchKeywords: ['checkbox', 'multi'],
    docsAnchor: 'multi-select-widget',
    category: 'select',
    icon: 'pi pi-check-square',
    collectSupported: true,
    enketoSupported: true,
    requiresChoices: true,
    parameters: [
      { name: 'randomize', description: 'Randomize choice order', type: 'boolean', defaultValue: false },
      { name: 'seed', description: 'Seed for consistent randomization', type: 'string' },
    ],
    appearances: selectAppearances,
    xform: { bindType: 'string', bodyElement: 'select' },
  },

  select_one_from_file: {
    type: 'select_one_from_file',
    title: 'Select one from file',
    description: 'Select a single choice from an attached CSV/XML/GeoJSON file',
    docsAnchor: 'select-from-external-dataset',
    category: 'select',
    icon: 'pi pi-file-o',
    collectSupported: true,
    enketoSupported: true,
    requiresFile: true,
    parameters: [
      { name: 'randomize', description: 'Randomize choice order', type: 'boolean', defaultValue: false },
      { name: 'seed', description: 'Seed for consistent randomization', type: 'string' },
      { name: 'value', description: 'Column to use for choice values', type: 'string', defaultValue: 'name' },
      { name: 'label', description: 'Column to use for choice labels', type: 'string', defaultValue: 'label' },
    ],
    appearances: [
      { name: 'quick', description: 'Advance to the next question after selection', collectSupported: true, enketoSupported: false },
      { name: 'likert', description: 'Horizontal Likert scale', collectSupported: true, enketoSupported: true },
      { name: 'map', description: 'Show choices on a map using their geometry column', collectSupported: true, enketoSupported: false },
    ],
    xform: { bindType: 'string', bodyElement: 'select1' },
  },

  select_multiple_from_file: {
    type: 'select_multiple_from_file',
    title: 'Select multiple from file',
    description: 'Select any number of choices from an attached CSV/XML/GeoJSON file',
    docsAnchor: 'select-from-external-dataset',
    category: 'select',
    icon: 'pi pi-file',
    collectSupported: true,
    enketoSupported: true,
    requiresFile: true,
    parameters: [
      { name: 'randomize', description: 'Randomize choice order', type: 'boolean', defaultValue: false },
      { name: 'seed', description: 'Seed for consistent randomization', type: 'string' },
      { name: 'value', description: 'Column to use for choice values', type: 'string', defaultValue: 'name' },
      { name: 'label', description: 'Column to use for choice labels', type: 'string', defaultValue: 'label' },
    ],
    xform: { bindType: 'string', bodyElement: 'select' },
  },

  rank: {
    type: 'rank',
    title: 'Rank',
    description: 'Rank the choices of a list in order',
    searchKeywords: ['order', 'sort'],
    docsAnchor: 'rank-widget',
    category: 'select',
    icon: 'pi pi-sort-alt',
    collectSupported: true,
    enketoSupported: true,
    requiresChoices: true,
    xform: { bindType: 'odk:rank', bodyElement: 'odk:rank' },
  },

  group: {
    type: 'group',
    title: 'Group',
    description: 'A group of questions (begin_group / end_group)',
    docsAnchor: 'grouping-multiple-widgets-on-the-same-screen',
    category: 'structure',
    icon: 'pi pi-folder',
    collectSupported: true,
    enketoSupported: true,
    isContainer: true,
    containerKind: 'group',
    appearances: [
      { name: 'field-list', description: 'Show all children on one screen', collectSupported: true, enketoSupported: true },
      { name: 'table-list', description: 'Shortcut for a grid of list/list-nolabel selects', collectSupported: true, enketoSupported: true },
    ],
    xform: {},
  },

  repeat: {
    type: 'repeat',
    title: 'Repeat',
    description: 'A repeating group of questions (begin_repeat / end_repeat)',
    docsAnchor: 'https://docs.getodk.org/form-repeats/',
    category: 'structure',
    icon: 'pi pi-refresh',
    collectSupported: true,
    enketoSupported: true,
    isContainer: true,
    containerKind: 'repeat',
    appearances: [
      { name: 'field-list', description: 'Show all children on one screen', collectSupported: true, enketoSupported: true },
    ],
    xform: {},
  },

  date: {
    type: 'date',
    title: 'Date',
    description: 'Prompt for a date',
    searchKeywords: ['calendar'],
    docsAnchor: 'default-date-widget',
    category: 'datetime',
    icon: 'pi pi-calendar',
    collectSupported: true,
    enketoSupported: true,
    appearances: [
      { name: 'no-calendar', description: 'Spinners instead of a calendar', collectSupported: true, enketoSupported: false },
      { name: 'month-year', description: 'Month and year only', collectSupported: true, enketoSupported: true },
      { name: 'year', description: 'Year only', collectSupported: true, enketoSupported: true },
      { name: 'ethiopian', description: 'Ethiopian calendar', collectSupported: true, enketoSupported: false },
      { name: 'coptic', description: 'Coptic calendar', collectSupported: true, enketoSupported: false },
      { name: 'islamic', description: 'Islamic calendar', collectSupported: true, enketoSupported: false },
      { name: 'bikram-sambat', description: 'Bikram Sambat (Nepali) calendar', collectSupported: true, enketoSupported: false },
      { name: 'myanmar', description: 'Myanmar calendar', collectSupported: true, enketoSupported: false },
      { name: 'persian', description: 'Persian calendar', collectSupported: true, enketoSupported: false },
    ],
    xform: { bindType: 'date', bodyElement: 'input' },
  },

  time: {
    type: 'time',
    title: 'Time',
    description: 'Prompt for a time',
    docsAnchor: 'time-widget',
    category: 'datetime',
    icon: 'pi pi-clock',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'time', bodyElement: 'input' },
  },

  datetime: {
    type: 'datetime',
    title: 'Date & time',
    description: 'Prompt for a date and a time',
    searchKeywords: ['timestamp'],
    docsAnchor: 'datetime-widget',
    category: 'datetime',
    icon: 'pi pi-calendar-clock',
    collectSupported: true,
    enketoSupported: true,
    appearances: [
      { name: 'no-calendar', description: 'Spinners instead of a calendar', collectSupported: true, enketoSupported: false },
    ],
    xform: { bindType: 'dateTime', bodyElement: 'input' },
  },

  geopoint: {
    type: 'geopoint',
    title: 'Geopoint',
    description: 'Record a single location',
    searchKeywords: ['gps', 'location', 'coordinates'],
    docsAnchor: 'geopoint-widget',
    category: 'location',
    icon: 'pi pi-map-marker',
    collectSupported: true,
    enketoSupported: true,
    parameters: [
      { name: 'capture-accuracy', description: 'Auto-capture when accuracy (m) is reached', type: 'number' },
      { name: 'warning-accuracy', description: 'Warn above this accuracy threshold (m)', type: 'number' },
      { name: 'allow-mock-accuracy', description: 'Accept mock locations', type: 'boolean', defaultValue: false },
    ],
    appearances: [
      { name: 'placement-map', description: 'Map the user can place and adjust a point on', collectSupported: true, enketoSupported: true },
      { name: 'maps', description: 'Map that captures device location (no manual adjustment)', collectSupported: true, enketoSupported: true },
      { name: 'hide-input', description: 'Larger map, hidden coordinate fields', collectSupported: false, enketoSupported: true },
    ],
    xform: { bindType: 'geopoint', bodyElement: 'input' },
  },

  geotrace: {
    type: 'geotrace',
    title: 'Geotrace',
    description: 'Record a line of locations',
    searchKeywords: ['line', 'path', 'gps'],
    docsAnchor: 'geotrace',
    category: 'location',
    icon: 'pi pi-arrows-h',
    collectSupported: true,
    enketoSupported: true,
    appearances: [
      { name: 'hide-input', description: 'Larger map, hidden coordinate fields', collectSupported: false, enketoSupported: true },
    ],
    xform: { bindType: 'geotrace', bodyElement: 'input' },
  },

  geoshape: {
    type: 'geoshape',
    title: 'Geoshape',
    description: 'Record a closed polygon of locations',
    searchKeywords: ['polygon', 'area', 'gps'],
    docsAnchor: 'geoshape',
    category: 'location',
    icon: 'pi pi-stop',
    collectSupported: true,
    enketoSupported: true,
    appearances: [
      { name: 'hide-input', description: 'Larger map, hidden coordinate fields', collectSupported: false, enketoSupported: true },
    ],
    xform: { bindType: 'geoshape', bodyElement: 'input' },
  },

  'start-geopoint': {
    type: 'start-geopoint',
    title: 'Start geopoint',
    description: 'Automatically record the location when the form is opened',
    docsAnchor: 'geolocation-at-survey-start',
    category: 'location',
    icon: 'pi pi-map-marker',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'geopoint', bodyElement: null, action: 'odk:setgeopoint' },
  },

  image: {
    type: 'image',
    title: 'Image',
    description: 'Capture or select an image',
    searchKeywords: ['photo', 'picture', 'camera', 'signature', 'sign'],
    docsAnchor: 'image-widgets',
    category: 'media',
    icon: 'pi pi-camera',
    collectSupported: true,
    enketoSupported: true,
    parameters: [
      { name: 'max-pixels', description: 'Downscale the long edge to this many pixels', type: 'number' },
    ],
    appearances: [
      newMedia,
      { name: 'new-front', description: 'Capture with the front (selfie) camera', collectSupported: true, enketoSupported: true },
      { name: 'draw', description: 'Draw an image', collectSupported: true, enketoSupported: true },
      { name: 'annotate', description: 'Annotate (draw on) an image', collectSupported: true, enketoSupported: true },
      { name: 'signature', description: 'Capture a signature', collectSupported: true, enketoSupported: true },
      exApp,
    ],
    xform: { bindType: 'binary', bodyElement: 'upload', mediatype: 'image/*' },
  },

  audio: {
    type: 'audio',
    title: 'Audio',
    description: 'Record or select audio',
    searchKeywords: ['sound', 'recording', 'voice'],
    docsAnchor: 'audio-widgets',
    category: 'media',
    icon: 'pi pi-microphone',
    collectSupported: true,
    enketoSupported: true,
    parameters: [
      { name: 'quality', description: 'Recording quality', type: 'string', options: ['normal', 'low', 'voice-only', 'external'], defaultValue: 'normal' },
    ],
    appearances: [newMedia, exApp],
    xform: { bindType: 'binary', bodyElement: 'upload', mediatype: 'audio/*' },
  },

  'background-audio': {
    type: 'background-audio',
    title: 'Background audio',
    description: 'Record audio in the background while the form is filled',
    docsAnchor: 'background-audio-recording',
    category: 'media',
    icon: 'pi pi-volume-up',
    collectSupported: true,
    enketoSupported: false,
    parameters: [
      { name: 'quality', description: 'Recording quality', type: 'string', options: ['normal', 'low', 'voice-only'], defaultValue: 'normal' },
    ],
    xform: { bindType: 'binary', bodyElement: null, action: 'odk:recordaudio' },
  },

  video: {
    type: 'video',
    title: 'Video',
    description: 'Record or select a video',
    searchKeywords: ['movie'],
    docsAnchor: 'video-widgets',
    category: 'media',
    icon: 'pi pi-video',
    collectSupported: true,
    enketoSupported: true,
    appearances: [newMedia, exApp],
    xform: { bindType: 'binary', bodyElement: 'upload', mediatype: 'video/*' },
  },

  file: {
    type: 'file',
    title: 'File',
    description: 'Attach a file',
    searchKeywords: ['attachment', 'upload', 'document'],
    docsAnchor: 'file-upload-widget',
    category: 'media',
    icon: 'pi pi-paperclip',
    collectSupported: true,
    enketoSupported: true,
    appearances: [exApp],
    xform: { bindType: 'binary', bodyElement: 'upload', mediatype: 'application/*' },
  },

  barcode: {
    type: 'barcode',
    title: 'Barcode',
    description: 'Scan a barcode or QR code',
    searchKeywords: ['qr', 'scan'],
    docsAnchor: 'barcode-widget',
    category: 'media',
    icon: 'pi pi-qrcode',
    collectSupported: true,
    enketoSupported: false,
    appearances: [
      { name: 'hidden-answer', description: 'Hide the scanned value on screen', collectSupported: true, enketoSupported: false },
    ],
    xform: { bindType: 'barcode', bodyElement: 'input' },
  },

  'csv-external': {
    type: 'csv-external',
    title: 'External CSV',
    description: 'Attach a CSV dataset for instance() lookups (name without extension)',
    docsAnchor: 'https://docs.getodk.org/form-datasets/',
    category: 'meta',
    icon: 'pi pi-database',
    collectSupported: true,
    enketoSupported: true,
    requiresFile: true,
    xform: { bodyElement: null },
  },

  start: {
    type: 'start',
    title: 'Start time',
    description: 'Record when the form entry started',
    docsAnchor: 'metadata',
    category: 'meta',
    icon: 'pi pi-play',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'dateTime', bodyElement: null, preload: { preload: 'timestamp', preloadParams: 'start' } },
  },

  end: {
    type: 'end',
    title: 'End time',
    description: 'Record when the form entry was finalized',
    docsAnchor: 'metadata',
    category: 'meta',
    icon: 'pi pi-stop-circle',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'dateTime', bodyElement: null, preload: { preload: 'timestamp', preloadParams: 'end' } },
  },

  today: {
    type: 'today',
    title: 'Today',
    description: 'Record the day the form entry started',
    docsAnchor: 'metadata',
    category: 'meta',
    icon: 'pi pi-calendar',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'date', bodyElement: null, preload: { preload: 'date', preloadParams: 'today' } },
  },

  deviceid: {
    type: 'deviceid',
    title: 'Device ID',
    description: "Record the device's unique install ID",
    docsAnchor: 'metadata',
    category: 'meta',
    icon: 'pi pi-mobile',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'string', bodyElement: null, preload: { preload: 'property', preloadParams: 'deviceid' } },
  },

  username: {
    type: 'username',
    title: 'Username',
    description: 'Record the username from app settings',
    docsAnchor: 'metadata',
    category: 'meta',
    icon: 'pi pi-user',
    collectSupported: true,
    enketoSupported: true,
    xform: { bindType: 'string', bodyElement: null, preload: { preload: 'property', preloadParams: 'username' } },
  },

  phonenumber: {
    type: 'phonenumber',
    title: 'Phone number',
    description: 'Record the phone number from app settings',
    docsAnchor: 'metadata',
    category: 'meta',
    icon: 'pi pi-phone',
    collectSupported: true,
    enketoSupported: false,
    xform: { bindType: 'string', bodyElement: null, preload: { preload: 'property', preloadParams: 'phonenumber' } },
  },

  email: {
    type: 'email',
    title: 'Email',
    description: 'Record the email address from app settings',
    docsAnchor: 'metadata',
    category: 'meta',
    icon: 'pi pi-envelope',
    collectSupported: true,
    enketoSupported: false,
    xform: { bindType: 'string', bodyElement: null, preload: { preload: 'property', preloadParams: 'email' } },
  },

  audit: {
    type: 'audit',
    title: 'Audit',
    description: "Log the user's actions as an attached CSV",
    docsAnchor: 'https://docs.getodk.org/form-audit-log/',
    category: 'meta',
    icon: 'pi pi-history',
    collectSupported: true,
    enketoSupported: false,
    parameters: [
      { name: 'location-priority', description: 'Location tracking priority', type: 'string', options: ['no-power', 'low-power', 'balanced', 'high-accuracy'] },
      { name: 'location-min-interval', description: 'Minimum seconds between location updates', type: 'number' },
      { name: 'location-max-age', description: 'Maximum seconds a location stays valid', type: 'number' },
      { name: 'track-changes', description: 'Track answer changes', type: 'boolean', defaultValue: false },
      { name: 'track-changes-reasons', description: 'Require reasons for changes', type: 'boolean', defaultValue: false },
      { name: 'identify-user', description: 'Record user identity in the log', type: 'boolean', defaultValue: false },
    ],
    xform: { bindType: 'binary', bodyElement: null, inMeta: true },
  },
}

export const getQuestionType = (type: string): QuestionTypeDefinition | undefined =>
  questionTypeRegistry[type]

/**
 * Filename the itemset / external-instance machinery references for a
 * question: the explicit `itemsetFile`, or — for `csv-external` — the
 * `${name}.csv` default. `undefined` when the question references no file.
 * Single source of truth for the serializer, ref validation and the
 * properties panel, which must all agree on what the XForm will reference.
 */
export const effectiveItemsetFile = (node: QuestionNode): string | undefined =>
  node.itemsetFile ?? (node.type === 'csv-external' ? `${node.name}.csv` : undefined)

export const getAllQuestionTypes = (): QuestionTypeDefinition[] =>
  Object.values(questionTypeRegistry)

export const getQuestionTypesByCategory = (category: QuestionCategory): QuestionTypeDefinition[] =>
  getAllQuestionTypes().filter((t) => t.category === category)

export const CATEGORY_ORDER: QuestionCategory[] = [
  'input', 'select', 'datetime', 'media', 'location', 'display', 'structure', 'meta',
]

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  input: 'Input',
  select: 'Choice',
  datetime: 'Date & time',
  media: 'Media',
  location: 'Location',
  display: 'Display',
  structure: 'Structure',
  meta: 'Metadata',
}
