/**
 * Bundled, offline-first help content for question types and property-panel
 * fields. The actual English text lives in the i18n catalog
 * (src/i18n/locales/en/help.json); this module is the typed index into it,
 * so vue-tsc catches a missing or misspelled catalog key at compile time.
 *
 * Content is adapted from the ODK Documentation (docs.getodk.org).
 */
import type { QuestionTypeDefinition } from '@/core/registry/question-types'
import type { MessageKey } from '@/i18n'

export interface TypeHelp {
  /** 2–3 sentences: widget behavior, what respondents see. */
  whatItDoes: MessageKey
  /** Type token + XLSForm column specifics. */
  xlsformNotes: MessageKey
}

export interface FieldHelp {
  /** What the property-panel field does. */
  whatItIs: MessageKey
  /** The XLSForm column it maps to. */
  xlsformColumn: MessageKey
}

/** Extended help per registry question type (keyed by the XLSForm type token). */
export const typeHelp = {
  text: { whatItDoes: 'help.types.text.whatItDoes', xlsformNotes: 'help.types.text.xlsformNotes' },
  integer: { whatItDoes: 'help.types.integer.whatItDoes', xlsformNotes: 'help.types.integer.xlsformNotes' },
  decimal: { whatItDoes: 'help.types.decimal.whatItDoes', xlsformNotes: 'help.types.decimal.xlsformNotes' },
  range: { whatItDoes: 'help.types.range.whatItDoes', xlsformNotes: 'help.types.range.xlsformNotes' },
  note: { whatItDoes: 'help.types.note.whatItDoes', xlsformNotes: 'help.types.note.xlsformNotes' },
  calculate: { whatItDoes: 'help.types.calculate.whatItDoes', xlsformNotes: 'help.types.calculate.xlsformNotes' },
  acknowledge: { whatItDoes: 'help.types.acknowledge.whatItDoes', xlsformNotes: 'help.types.acknowledge.xlsformNotes' },
  select_one: { whatItDoes: 'help.types.select_one.whatItDoes', xlsformNotes: 'help.types.select_one.xlsformNotes' },
  select_multiple: { whatItDoes: 'help.types.select_multiple.whatItDoes', xlsformNotes: 'help.types.select_multiple.xlsformNotes' },
  select_one_from_file: { whatItDoes: 'help.types.select_one_from_file.whatItDoes', xlsformNotes: 'help.types.select_one_from_file.xlsformNotes' },
  select_multiple_from_file: { whatItDoes: 'help.types.select_multiple_from_file.whatItDoes', xlsformNotes: 'help.types.select_multiple_from_file.xlsformNotes' },
  rank: { whatItDoes: 'help.types.rank.whatItDoes', xlsformNotes: 'help.types.rank.xlsformNotes' },
  group: { whatItDoes: 'help.types.group.whatItDoes', xlsformNotes: 'help.types.group.xlsformNotes' },
  repeat: { whatItDoes: 'help.types.repeat.whatItDoes', xlsformNotes: 'help.types.repeat.xlsformNotes' },
  date: { whatItDoes: 'help.types.date.whatItDoes', xlsformNotes: 'help.types.date.xlsformNotes' },
  time: { whatItDoes: 'help.types.time.whatItDoes', xlsformNotes: 'help.types.time.xlsformNotes' },
  datetime: { whatItDoes: 'help.types.datetime.whatItDoes', xlsformNotes: 'help.types.datetime.xlsformNotes' },
  geopoint: { whatItDoes: 'help.types.geopoint.whatItDoes', xlsformNotes: 'help.types.geopoint.xlsformNotes' },
  geotrace: { whatItDoes: 'help.types.geotrace.whatItDoes', xlsformNotes: 'help.types.geotrace.xlsformNotes' },
  geoshape: { whatItDoes: 'help.types.geoshape.whatItDoes', xlsformNotes: 'help.types.geoshape.xlsformNotes' },
  'start-geopoint': { whatItDoes: 'help.types.start-geopoint.whatItDoes', xlsformNotes: 'help.types.start-geopoint.xlsformNotes' },
  image: { whatItDoes: 'help.types.image.whatItDoes', xlsformNotes: 'help.types.image.xlsformNotes' },
  audio: { whatItDoes: 'help.types.audio.whatItDoes', xlsformNotes: 'help.types.audio.xlsformNotes' },
  'background-audio': { whatItDoes: 'help.types.background-audio.whatItDoes', xlsformNotes: 'help.types.background-audio.xlsformNotes' },
  video: { whatItDoes: 'help.types.video.whatItDoes', xlsformNotes: 'help.types.video.xlsformNotes' },
  file: { whatItDoes: 'help.types.file.whatItDoes', xlsformNotes: 'help.types.file.xlsformNotes' },
  barcode: { whatItDoes: 'help.types.barcode.whatItDoes', xlsformNotes: 'help.types.barcode.xlsformNotes' },
  'csv-external': { whatItDoes: 'help.types.csv-external.whatItDoes', xlsformNotes: 'help.types.csv-external.xlsformNotes' },
  start: { whatItDoes: 'help.types.start.whatItDoes', xlsformNotes: 'help.types.start.xlsformNotes' },
  end: { whatItDoes: 'help.types.end.whatItDoes', xlsformNotes: 'help.types.end.xlsformNotes' },
  today: { whatItDoes: 'help.types.today.whatItDoes', xlsformNotes: 'help.types.today.xlsformNotes' },
  deviceid: { whatItDoes: 'help.types.deviceid.whatItDoes', xlsformNotes: 'help.types.deviceid.xlsformNotes' },
  username: { whatItDoes: 'help.types.username.whatItDoes', xlsformNotes: 'help.types.username.xlsformNotes' },
  phonenumber: { whatItDoes: 'help.types.phonenumber.whatItDoes', xlsformNotes: 'help.types.phonenumber.xlsformNotes' },
  email: { whatItDoes: 'help.types.email.whatItDoes', xlsformNotes: 'help.types.email.xlsformNotes' },
  audit: { whatItDoes: 'help.types.audit.whatItDoes', xlsformNotes: 'help.types.audit.xlsformNotes' },
  simserial: { whatItDoes: 'help.types.simserial.whatItDoes', xlsformNotes: 'help.types.simserial.xlsformNotes' },
  subscriberid: { whatItDoes: 'help.types.subscriberid.whatItDoes', xlsformNotes: 'help.types.subscriberid.xlsformNotes' },
} satisfies Record<string, TypeHelp>

export const getTypeHelp = (type: string): TypeHelp | undefined =>
  (typeHelp as Record<string, TypeHelp>)[type]

/** Help per property-panel field, keyed by the panel's field identifier. */
export const fieldHelp = {
  label: { whatItIs: 'help.fields.label.whatItIs', xlsformColumn: 'help.fields.label.xlsformColumn' },
  hint: { whatItIs: 'help.fields.hint.whatItIs', xlsformColumn: 'help.fields.hint.xlsformColumn' },
  guidanceHint: { whatItIs: 'help.fields.guidanceHint.whatItIs', xlsformColumn: 'help.fields.guidanceHint.xlsformColumn' },
  name: { whatItIs: 'help.fields.name.whatItIs', xlsformColumn: 'help.fields.name.xlsformColumn' },
  appearance: { whatItIs: 'help.fields.appearance.whatItIs', xlsformColumn: 'help.fields.appearance.xlsformColumn' },
  parameters: { whatItIs: 'help.fields.parameters.whatItIs', xlsformColumn: 'help.fields.parameters.xlsformColumn' },
  defaultValue: { whatItIs: 'help.fields.defaultValue.whatItIs', xlsformColumn: 'help.fields.defaultValue.xlsformColumn' },
  required: { whatItIs: 'help.fields.required.whatItIs', xlsformColumn: 'help.fields.required.xlsformColumn' },
  readOnly: { whatItIs: 'help.fields.readOnly.whatItIs', xlsformColumn: 'help.fields.readOnly.xlsformColumn' },
  relevant: { whatItIs: 'help.fields.relevant.whatItIs', xlsformColumn: 'help.fields.relevant.xlsformColumn' },
  constraint: { whatItIs: 'help.fields.constraint.whatItIs', xlsformColumn: 'help.fields.constraint.xlsformColumn' },
  constraintMessage: { whatItIs: 'help.fields.constraintMessage.whatItIs', xlsformColumn: 'help.fields.constraintMessage.xlsformColumn' },
  requiredMessage: { whatItIs: 'help.fields.requiredMessage.whatItIs', xlsformColumn: 'help.fields.requiredMessage.xlsformColumn' },
  calculation: { whatItIs: 'help.fields.calculation.whatItIs', xlsformColumn: 'help.fields.calculation.xlsformColumn' },
  choiceFilter: { whatItIs: 'help.fields.choiceFilter.whatItIs', xlsformColumn: 'help.fields.choiceFilter.xlsformColumn' },
  choiceList: { whatItIs: 'help.fields.choiceList.whatItIs', xlsformColumn: 'help.fields.choiceList.xlsformColumn' },
  itemsetFile: { whatItIs: 'help.fields.itemsetFile.whatItIs', xlsformColumn: 'help.fields.itemsetFile.xlsformColumn' },
  repeatCount: { whatItIs: 'help.fields.repeatCount.whatItIs', xlsformColumn: 'help.fields.repeatCount.xlsformColumn' },
  // Staged for the Wave 4 entities UI — no HelpPopover renders field="saveTo" yet.
  saveTo: { whatItIs: 'help.fields.saveTo.whatItIs', xlsformColumn: 'help.fields.saveTo.xlsformColumn' },
} satisfies Record<string, FieldHelp>

export type HelpFieldKey = keyof typeof fieldHelp

export const ODK_QUESTION_TYPES_DOCS_URL = 'https://docs.getodk.org/form-question-types/'

/**
 * "Read more" target for a type: a bare `docsAnchor` is a fragment on the
 * question-types docs page; types documented elsewhere carry an absolute URL.
 */
export const docsUrl = (def: QuestionTypeDefinition): string | undefined =>
  def.docsAnchor === undefined
    ? undefined
    : def.docsAnchor.startsWith('https://')
      ? def.docsAnchor
      : `${ODK_QUESTION_TYPES_DOCS_URL}#${def.docsAnchor}`
