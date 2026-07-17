/**
 * FormDocument → XLSForm workbook.
 *
 * Columns come out in a canonical order filtered to what the document
 * actually uses; translated columns expand to 'base::Lang' per document
 * language order right after their base, and a plain base column is only
 * emitted when DEFAULT_LANG values exist. Output is stable, so
 * write → read round-trips compare equal.
 */
import { stripImagePrefix } from '../model/defaults'
import {
  DEFAULT_LANG,
  isContainer,
  type ChoiceList,
  type FormDocument,
  type FormNode,
  type Lang,
  type LocalizedText,
  type MediaRefs,
} from '../model/types'
import { writeWorkbook, type SheetSpec } from './workbook-write'

const SURVEY_CANONICAL = [
  'type', 'name', 'label', 'hint', 'guidance_hint',
  'required', 'required_message', 'read_only', 'relevant',
  'constraint', 'constraint_message', 'calculation', 'choice_filter',
  'appearance', 'parameters', 'default', 'trigger', 'repeat_count',
  'image', 'audio', 'video', 'big-image', 'save_to',
]

const CHOICES_CANONICAL = [
  'list_name', 'name', 'label', 'image', 'audio', 'video', 'big-image', 'geometry',
]

const MEDIA_COLUMNS: Array<[keyof MediaRefs, string]> = [
  ['image', 'image'],
  ['audio', 'audio'],
  ['video', 'video'],
  ['bigImage', 'big-image'],
]

type Record_ = Record<string, string>

/** Accumulates rows as header→value records plus enough usage metadata to
 * derive the final column list deterministically. */
class SheetBuilder {
  readonly records: Record_[] = []
  /** Non-canonical bases (passthrough headers, custom columns) first-seen. */
  readonly extraBases: string[] = []
  /** base → langs seen (LocalizedText columns only). */
  readonly langsByBase = new Map<string, Set<Lang>>()
  /** Bases with a DEFAULT_LANG (plain-column) value. */
  readonly plainLocalized = new Set<string>()

  constructor (
    private readonly canonical: string[],
    private readonly langOrder: Lang[],
    /** Headers emitted even when no row uses them (survey needs type/name). */
    private readonly alwaysInclude: string[] = []
  ) {}

  private noteExtra (base: string): void {
    if (!this.canonical.includes(base) && !this.extraBases.includes(base)) this.extraBases.push(base)
  }

  put (record: Record_, base: string, value: string | undefined): void {
    if (value === undefined || value === '') return
    this.noteExtra(base)
    record[base] = value
  }

  putLocalized (record: Record_, base: string, text: LocalizedText | undefined): void {
    if (text === undefined) return
    this.noteExtra(base)
    for (const [lang, value] of Object.entries(text)) {
      if (value === undefined || value === '') continue
      if (lang === DEFAULT_LANG) {
        this.plainLocalized.add(base)
        record[base] = value
      } else {
        let langs = this.langsByBase.get(base)
        if (langs === undefined) this.langsByBase.set(base, langs = new Set())
        langs.add(lang)
        record[`${base}::${lang}`] = value
      }
    }
  }

  private headersFor (base: string): string[] {
    const langs = this.langsByBase.get(base)
    if (langs === undefined) {
      const used = this.alwaysInclude.includes(base) || this.records.some((r) => r[base] !== undefined)
      return used ? [base] : []
    }
    const ordered = [
      ...this.langOrder.filter((lang) => langs.has(lang)),
      ...[...langs].filter((lang) => !this.langOrder.includes(lang)),
    ]
    return [
      ...(this.plainLocalized.has(base) ? [base] : []),
      ...ordered.map((lang) => `${base}::${lang}`),
    ]
  }

  toRows (): string[][] {
    const headers = [...this.canonical, ...this.extraBases].flatMap((base) => this.headersFor(base))
    return [headers, ...this.records.map((record) => headers.map((h) => record[h] ?? ''))]
  }
}

const languageOrder = (doc: FormDocument): Lang[] => [...doc.languages]

// --- survey sheet -------------------------------------------------------------

const typeToken = (node: FormNode): string => {
  if (node.kind === 'group') return 'begin_group'
  if (node.kind === 'repeat') return 'begin_repeat'
  if (node.itemsetFile !== undefined && node.type.endsWith('_from_file')) {
    return `${node.type} ${node.itemsetFile}`
  }
  if (node.listRef !== undefined) return `${node.type} ${node.listRef}`
  return node.type
}

const joinParameters = (parameters: Record<string, string> | undefined): string | undefined => {
  if (parameters === undefined) return undefined
  const parts = Object.entries(parameters).map(([k, v]) => (v === '' ? k : `${k}=${v}`))
  return parts.length > 0 ? parts.join(' ') : undefined
}

const putMedia = (builder: SheetBuilder, record: Record_, media: MediaRefs | undefined): void => {
  if (media === undefined) return
  for (const [slot, base] of MEDIA_COLUMNS) builder.putLocalized(record, base, media[slot])
}

const nodeRecord = (builder: SheetBuilder, node: FormNode): Record_ => {
  const record: Record_ = { type: typeToken(node) }
  builder.put(record, 'name', node.name)
  builder.putLocalized(record, 'label', node.label)
  builder.putLocalized(record, 'hint', node.hint)
  builder.putLocalized(record, 'guidance_hint', node.guidanceHint)
  builder.put(record, 'required', node.bind.required)
  builder.putLocalized(record, 'required_message', node.bind.requiredMessage)
  builder.put(record, 'read_only', node.bind.readonly)
  builder.put(record, 'relevant', node.bind.relevant)
  builder.put(record, 'constraint', node.bind.constraint)
  builder.putLocalized(record, 'constraint_message', node.bind.constraintMessage)
  builder.put(record, 'calculation', node.bind.calculation)
  if (node.kind === 'question') builder.put(record, 'choice_filter', node.choiceFilter)
  builder.put(record, 'appearance', node.body.appearance)
  builder.put(record, 'parameters', joinParameters(node.body.parameters))
  builder.put(
    record,
    'default',
    node.kind === 'question' && node.type === 'image' && node.defaultValue !== undefined
      ? stripImagePrefix(node.defaultValue)
      : node.defaultValue
  )
  builder.put(record, 'trigger', node.trigger)
  if (node.kind === 'repeat') builder.put(record, 'repeat_count', node.repeatCount)
  putMedia(builder, record, node.media)
  builder.put(record, 'save_to', node.saveTo)

  for (const [attr, value] of Object.entries(node.instanceAttrs ?? {})) {
    builder.put(record, `instance::${attr}`, value)
  }
  for (const [attr, value] of Object.entries(node.bind.custom ?? {})) {
    builder.put(record, `bind::${attr}`, value)
  }
  for (const [attr, value] of Object.entries(node.body.custom ?? {})) {
    builder.put(record, `body::${attr}`, value)
  }
  for (const [key, value] of Object.entries(node.customColumns ?? {})) {
    if (typeof value === 'string') builder.put(record, key, value)
    else builder.putLocalized(record, key, value)
  }
  return record
}

const surveySheet = (doc: FormDocument): SheetSpec => {
  const builder = new SheetBuilder(SURVEY_CANONICAL, languageOrder(doc), ['type', 'name'])
  const walk = (nodes: FormNode[]): void => {
    for (const node of nodes) {
      builder.records.push(nodeRecord(builder, node))
      if (isContainer(node)) {
        walk(node.children)
        builder.records.push({ type: node.kind === 'group' ? 'end_group' : 'end_repeat' })
      }
    }
  }
  walk(doc.children)
  return { name: 'survey', rows: builder.toRows() }
}

// --- choices sheet --------------------------------------------------------------

const choicesSheet = (doc: FormDocument): SheetSpec | null => {
  const lists = Object.values(doc.choiceLists)
  if (lists.length === 0) return null
  const builder = new SheetBuilder(CHOICES_CANONICAL, languageOrder(doc))

  const listRecords = (list: ChoiceList): void => {
    for (const choice of list.choices) {
      const record: Record_ = {}
      builder.put(record, 'list_name', list.name)
      builder.put(record, 'name', choice.name)
      builder.putLocalized(record, 'label', choice.label)
      putMedia(builder, record, choice.media)
      builder.put(record, 'geometry', choice.geometry)
      const extras = choice.extras ?? {}
      const order = [
        ...(list.extraColumnOrder ?? []),
        ...Object.keys(extras).filter((key) => !(list.extraColumnOrder ?? []).includes(key)),
      ]
      for (const key of order) builder.put(record, key, extras[key])
      builder.records.push(record)
    }
  }
  lists.forEach(listRecords)
  return { name: 'choices', rows: builder.toRows() }
}

// --- settings / entities sheets ----------------------------------------------------

const settingsSheet = (doc: FormDocument): SheetSpec | null => {
  const s = doc.settings
  const record: Record_ = {}
  const builder = new SheetBuilder([
    'form_title', 'form_id', 'version', 'instance_name', 'default_language',
    'style', 'public_key', 'submission_url', 'allow_choice_duplicates',
  ], [])
  builder.put(record, 'form_title', s.formTitle)
  builder.put(record, 'form_id', s.formId)
  builder.put(record, 'version', s.version)
  builder.put(record, 'instance_name', s.instanceName)
  builder.put(record, 'default_language', s.defaultLanguage)
  builder.put(record, 'style', s.style)
  builder.put(record, 'public_key', s.publicKey)
  builder.put(record, 'submission_url', s.submissionUrl)
  if (s.allowChoiceDuplicates !== undefined) {
    builder.put(record, 'allow_choice_duplicates', s.allowChoiceDuplicates ? 'yes' : 'no')
  }
  for (const [key, value] of Object.entries(s.custom ?? {})) builder.put(record, key, value)
  if (Object.keys(record).length === 0) return null
  builder.records.push(record)
  return { name: 'settings', rows: builder.toRows() }
}

const entitiesSheet = (doc: FormDocument): SheetSpec | null => {
  const entities = doc.entities
  if (entities === undefined) return null
  const builder = new SheetBuilder(['list_name', 'label', 'create_if', 'update_if', 'entity_id'], [])
  const record: Record_ = {}
  builder.put(record, 'list_name', entities.datasetName)
  builder.put(record, 'label', entities.label)
  builder.put(record, 'create_if', entities.createIf)
  builder.put(record, 'update_if', entities.updateIf)
  builder.put(record, 'entity_id', entities.entityId)
  builder.records.push(record)
  return { name: 'entities', rows: builder.toRows() }
}

// --- top level ---------------------------------------------------------------------

export const writeXlsForm = async (doc: FormDocument): Promise<Uint8Array> => {
  const sheets: SheetSpec[] = [surveySheet(doc)]
  for (const sheet of [choicesSheet(doc), settingsSheet(doc), entitiesSheet(doc)]) {
    if (sheet !== null) sheets.push(sheet)
  }
  for (const [name, rows] of Object.entries(doc.unknown?.extraSheets ?? {})) {
    sheets.push({ name, rows })
  }
  return writeWorkbook(sheets)
}
