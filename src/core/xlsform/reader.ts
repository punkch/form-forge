/**
 * XLSForm workbook → FormDocument.
 *
 * Content problems never throw: every problem becomes an Issue whose scope
 * carries { sheet, row (1-based, header = 1), column? } so import reports
 * can point at the exact cell. Unknown columns and sheets are preserved
 * verbatim (customColumns / unknown.extraSheets) for lossless round-trips.
 */
import { newId } from '../model/ids'
import {
  DEFAULT_LANG,
  type Choice,
  type ChoiceList,
  type ContainerNode,
  type EntityDeclaration,
  type FormDocument,
  type FormNode,
  type LocalizedText,
  type MediaRefs,
  type QuestionNode,
} from '../model/types'
import { getQuestionType } from '../registry/question-types'
import type { Issue, IssueSeverity } from '../validate/issues'
import { CHOICES_BASES, MEDIA_BASES, SURVEY_BASES } from './columns'
import {
  buildTable,
  cellValue,
  collectLanguages,
  localizedValue,
  plainValue,
  type SheetTable,
  type TableRow,
} from './row-model'
import { readWorkbook, type RawWorkbook } from './workbook-read'

export interface ReadXlsFormResult {
  document: FormDocument
  issues: Issue[]
}

const MODEL_SHEETS = new Set(['survey', 'choices', 'settings', 'entities'])

// --- shared helpers ----------------------------------------------------------

/** 'k=v k=v' and/or comma-separated parameter cells → ordered record. */
export const parseParameters = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const token of raw.split(/[\s,;]+/)) {
    if (token === '') continue
    const eq = token.indexOf('=')
    if (eq === -1) out[token] = ''
    else out[token.slice(0, eq).trim()] = token.slice(eq + 1).trim()
  }
  return out
}

/** XLSForm boolean-ish expression cells: yes/true → 'true()', no/false →
 * undefined (attribute omitted), anything else verbatim. */
const flagExpression = (raw: string): string | undefined => {
  const value = raw.trim()
  if (value === '') return undefined
  const lower = value.toLowerCase()
  if (lower === 'yes' || lower === 'true' || lower === 'true()') return 'true()'
  if (lower === 'no' || lower === 'false' || lower === 'false()') return undefined
  return value
}

const isYes = (raw: string): boolean => {
  const lower = raw.trim().toLowerCase()
  return lower === 'yes' || lower === 'true' || lower === 'true()'
}

// --- type-cell parsing --------------------------------------------------------

type ParsedType =
  | { kind: 'begin', container: 'group' | 'repeat' }
  | { kind: 'end', container: 'group' | 'repeat' }
  | { kind: 'question', type: string, listRef?: string, itemsetFile?: string, extraTokens?: string }
  | { kind: 'missing-arg', type: string }
  | { kind: 'unknown' }

// pyxform 4.5.0 accepts these alternate type tokens for registry types.
const TYPE_ALIASES: Record<string, string> = {
  location: 'geopoint',
  photo: 'image',
  trigger: 'acknowledge',
  imei: 'deviceid',
}

const SELECT_KEYWORDS: Array<{ words: string[], type: string, arg: 'list' | 'file' }> = [
  { words: ['select_one_from_file'], type: 'select_one_from_file', arg: 'file' },
  { words: ['select', 'one', 'from', 'file'], type: 'select_one_from_file', arg: 'file' },
  { words: ['select_multiple_from_file'], type: 'select_multiple_from_file', arg: 'file' },
  { words: ['select', 'multiple', 'from', 'file'], type: 'select_multiple_from_file', arg: 'file' },
  { words: ['select', 'all', 'that', 'apply'], type: 'select_multiple', arg: 'list' },
  { words: ['select_one'], type: 'select_one', arg: 'list' },
  { words: ['select', 'one'], type: 'select_one', arg: 'list' },
  { words: ['select_multiple'], type: 'select_multiple', arg: 'list' },
  { words: ['select', 'multiple'], type: 'select_multiple', arg: 'list' },
  { words: ['rank'], type: 'rank', arg: 'list' },
]

const parseTypeCell = (cell: string): ParsedType => {
  const words = cell.trim().split(/\s+/)
  const compact = words.join('_').toLowerCase().replace(/-/g, '_')
  if (compact === 'begin_group') return { kind: 'begin', container: 'group' }
  if (compact === 'end_group') return { kind: 'end', container: 'group' }
  if (compact === 'begin_repeat') return { kind: 'begin', container: 'repeat' }
  if (compact === 'end_repeat') return { kind: 'end', container: 'repeat' }

  const lower = words.map((w) => w.toLowerCase())
  for (const keyword of SELECT_KEYWORDS) {
    if (!keyword.words.every((w, i) => lower[i] === w)) continue
    if (keyword.words.length === words.length) return { kind: 'missing-arg', type: keyword.type }
    const arg = words[keyword.words.length]
    const extraTokens = words.slice(keyword.words.length + 1).join(' ')
    return {
      kind: 'question',
      type: keyword.type,
      ...(keyword.arg === 'file' ? { itemsetFile: arg } : { listRef: arg }),
      ...(extraTokens !== '' ? { extraTokens } : {}),
    }
  }

  if (words.length === 1) {
    const token = words[0]
    const canonical = getQuestionType(token)?.type ??
      getQuestionType(token.toLowerCase())?.type ??
      TYPE_ALIASES[token.toLowerCase()]
    if (canonical !== undefined) return { kind: 'question', type: canonical }
  }
  return { kind: 'unknown' }
}

// --- reader context -----------------------------------------------------------

interface Ctx {
  issues: Issue[]
  doc: FormDocument
}

const report = (
  ctx: Ctx, severity: IssueSeverity, code: string, message: string,
  sheet: string, row: number, column?: string
): void => {
  ctx.issues.push({ severity, code, message, scope: { sheet, row, ...(column !== undefined ? { column } : {}) } })
}

// --- survey sheet -------------------------------------------------------------

const readMedia = (table: SheetTable, row: TableRow): MediaRefs | undefined => {
  let media: MediaRefs | undefined
  for (const [base, slot] of Object.entries(MEDIA_BASES)) {
    const value = localizedValue(table, row, base)
    if (value === undefined) continue
    media ??= {}
    media[slot] = value
  }
  return media
}

/** Columns → node fields shared by questions, groups and repeats. */
const applyRowProps = (table: SheetTable, row: TableRow, node: FormNode): void => {
  const setText = (value: LocalizedText | undefined, assign: (v: LocalizedText) => void): void => {
    if (value !== undefined) assign(value)
  }
  setText(localizedValue(table, row, 'label'), (v) => { node.label = v })
  setText(localizedValue(table, row, 'hint'), (v) => { node.hint = v })
  setText(localizedValue(table, row, 'guidance_hint'), (v) => { node.guidanceHint = v })
  setText(localizedValue(table, row, 'constraint_message'), (v) => { node.bind.constraintMessage = v })
  setText(localizedValue(table, row, 'required_message'), (v) => { node.bind.requiredMessage = v })
  const media = readMedia(table, row)
  if (media !== undefined) node.media = media

  const required = flagExpression(plainValue(table, row, 'required'))
  if (required !== undefined) node.bind.required = required
  const readOnly = flagExpression(plainValue(table, row, 'read_only'))
  if (readOnly !== undefined) node.bind.readonly = readOnly

  const verbatim: Array<[string, (v: string) => void]> = [
    ['relevant', (v) => { node.bind.relevant = v }],
    ['constraint', (v) => { node.bind.constraint = v }],
    ['calculation', (v) => { node.bind.calculation = v }],
    ['appearance', (v) => { node.body.appearance = v }],
    ['default', (v) => { node.defaultValue = v }],
    ['trigger', (v) => { node.trigger = v }],
    ['save_to', (v) => { node.saveTo = v }],
  ]
  for (const [base, assign] of verbatim) {
    const value = plainValue(table, row, base)
    if (value !== '') assign(value)
  }

  const parameters = plainValue(table, row, 'parameters')
  if (parameters !== '') node.body.parameters = parseParameters(parameters)

  for (const column of table.columns) {
    const value = cellValue(row, column)
    if (value === '') continue
    if (column.base.startsWith('instance::')) {
      (node.instanceAttrs ??= {})[column.base.slice('instance::'.length)] = value
    } else if (column.base.startsWith('bind::')) {
      (node.bind.custom ??= {})[column.base.slice('bind::'.length)] = value
    } else if (column.base.startsWith('body::')) {
      (node.body.custom ??= {})[column.base.slice('body::'.length)] = value
    } else if (!SURVEY_BASES.has(column.base)) {
      const custom = (node.customColumns ??= {})
      if (column.lang === undefined) {
        const existing = custom[column.rawBase]
        if (typeof existing === 'object') existing[DEFAULT_LANG] = value
        else custom[column.rawBase] = value
      } else {
        const existing = custom[column.rawBase]
        const text: LocalizedText = typeof existing === 'object'
          ? existing
          : existing !== undefined ? { [DEFAULT_LANG]: existing } : {}
        text[column.lang] = value
        custom[column.rawBase] = text
      }
    }
  }
}

const readSurvey = (ctx: Ctx, table: SheetTable): void => {
  const sheet = table.name
  const stack: Array<{ node: ContainerNode, row: number }> = []
  const target = (): FormNode[] => stack.length === 0 ? ctx.doc.children : stack[stack.length - 1].node.children

  for (const row of table.rows) {
    const typeCell = plainValue(table, row, 'type')
    if (typeCell === '') {
      report(ctx, 'warning', 'row.no-type', 'Row has content but no type; it was skipped.', sheet, row.rowNumber, 'type')
      continue
    }
    const parsed = parseTypeCell(typeCell)

    if (parsed.kind === 'unknown') {
      report(ctx, 'error', 'type.unknown', `Unknown question type "${typeCell}"; the row was skipped.`, sheet, row.rowNumber, 'type')
      continue
    }
    if (parsed.kind === 'missing-arg') {
      report(ctx, 'error', 'type.missing-list', `"${typeCell}" is missing its choice list or file name; the row was skipped.`, sheet, row.rowNumber, 'type')
      continue
    }

    if (parsed.kind === 'end') {
      const top = stack.pop()
      if (top === undefined) {
        report(ctx, 'error', 'structure.unmatched-end', `end_${parsed.container} without a matching begin_${parsed.container}.`, sheet, row.rowNumber, 'type')
      } else if (top.node.kind !== parsed.container) {
        report(ctx, 'error', 'structure.mismatched-end', `end_${parsed.container} closes begin_${top.node.kind} from row ${top.row}.`, sheet, row.rowNumber, 'type')
      }
      continue
    }

    if (parsed.kind === 'begin') {
      let name = plainValue(table, row, 'name')
      if (name === '') {
        name = `${parsed.container}_row${row.rowNumber}`
        report(ctx, 'error', 'name.missing', `begin_${parsed.container} has no name; "${name}" was generated.`, sheet, row.rowNumber, 'name')
      }
      const node: ContainerNode = { id: newId(), kind: parsed.container, name, bind: {}, body: {}, children: [] }
      applyRowProps(table, row, node)
      if (node.kind === 'repeat') {
        const count = plainValue(table, row, 'repeat_count')
        if (count !== '') node.repeatCount = count
      }
      target().push(node)
      stack.push({ node, row: row.rowNumber })
      continue
    }

    const name = plainValue(table, row, 'name')
    if (name === '') {
      report(ctx, 'error', 'name.missing', `Question of type "${typeCell}" has no name; the row was skipped.`, sheet, row.rowNumber, 'name')
      continue
    }
    if (parsed.extraTokens !== undefined) {
      const code = parsed.extraTokens === 'or_other' ? 'type.or-other-unsupported' : 'type.extra-tokens'
      report(ctx, 'warning', code, `Trailing "${parsed.extraTokens}" in type "${typeCell}" was ignored.`, sheet, row.rowNumber, 'type')
    }
    const node: QuestionNode = { id: newId(), kind: 'question', type: parsed.type, name, bind: {}, body: {} }
    if (parsed.listRef !== undefined) node.listRef = parsed.listRef
    if (parsed.itemsetFile !== undefined) node.itemsetFile = parsed.itemsetFile
    applyRowProps(table, row, node)
    const choiceFilter = plainValue(table, row, 'choice_filter')
    if (choiceFilter !== '') node.choiceFilter = choiceFilter
    target().push(node)
  }

  for (const open of stack) {
    report(ctx, 'error', 'structure.unclosed', `begin_${open.node.kind} "${open.node.name}" (row ${open.row}) is never closed.`, sheet, open.row, 'type')
  }
}

// --- choices sheet ------------------------------------------------------------

const readChoices = (ctx: Ctx, table: SheetTable): void => {
  const sheet = table.name
  const extraColumns = table.columns.filter((c) => !CHOICES_BASES.has(c.base))
  const lists = ctx.doc.choiceLists

  for (const row of table.rows) {
    const listName = plainValue(table, row, 'list_name')
    if (listName === '') {
      report(ctx, 'warning', 'choices.missing-list-name', 'Choices row has no list_name; it was skipped.', sheet, row.rowNumber, 'list_name')
      continue
    }
    const name = plainValue(table, row, 'name')
    if (name === '') {
      report(ctx, 'error', 'choices.missing-name', `Choice in list "${listName}" has no name; the row was skipped.`, sheet, row.rowNumber, 'name')
      continue
    }
    const choice: Choice = { name }
    const label = localizedValue(table, row, 'label')
    if (label !== undefined) choice.label = label
    const media = readMedia(table, row)
    if (media !== undefined) choice.media = media
    const geometry = plainValue(table, row, 'geometry')
    if (geometry !== '') choice.geometry = geometry
    for (const column of extraColumns) {
      const value = cellValue(row, column)
      if (value === '') continue
      (choice.extras ??= {})[column.header] = value
    }
    const list: ChoiceList = (lists[listName] ??= { name: listName, choices: [] })
    list.choices.push(choice)
  }

  // Per-list extra-column order, restricted to columns the list actually uses.
  for (const list of Object.values(lists)) {
    const order = extraColumns
      .map((c) => c.header)
      .filter((header, i, all) => all.indexOf(header) === i)
      .filter((header) => list.choices.some((c) => c.extras?.[header] !== undefined))
    if (order.length > 0) list.extraColumnOrder = order
  }
}

// --- settings / entities sheets ------------------------------------------------

const readSettings = (ctx: Ctx, table: SheetTable): void => {
  const sheet = table.name
  const row = table.rows[0]
  if (row === undefined) return
  for (const extra of table.rows.slice(1)) {
    report(ctx, 'warning', 'settings.extra-rows', 'Only the first settings row is used.', sheet, extra.rowNumber)
  }
  const settings = ctx.doc.settings
  for (const column of table.columns) {
    const value = cellValue(row, column)
    if (value === '') continue
    switch (column.base) {
      case 'form_title': settings.formTitle = value; break
      case 'form_id': settings.formId = value; break
      case 'version': settings.version = value; break
      case 'instance_name': settings.instanceName = value; break
      case 'default_language': settings.defaultLanguage = value; break
      case 'style': settings.style = value; break
      case 'public_key': settings.publicKey = value; break
      case 'submission_url': settings.submissionUrl = value; break
      case 'allow_choice_duplicates': settings.allowChoiceDuplicates = isYes(value); break
      default: (settings.custom ??= {})[column.header] = value
    }
  }
}

const readEntities = (ctx: Ctx, table: SheetTable): void => {
  const sheet = table.name
  const row = table.rows[0]
  if (row === undefined) return
  const datasetName = plainValue(table, row, 'list_name')
  if (datasetName === '') {
    report(ctx, 'error', 'entities.missing-dataset', 'Entities sheet has no list_name; the declaration was skipped.', sheet, row.rowNumber, 'list_name')
    return
  }
  const entity: EntityDeclaration = { datasetName }
  const optional: Array<[string, (v: string) => void]> = [
    ['label', (v) => { entity.label = v }],
    ['create_if', (v) => { entity.createIf = v }],
    ['update_if', (v) => { entity.updateIf = v }],
    ['entity_id', (v) => { entity.entityId = v }],
  ]
  for (const [base, assign] of optional) {
    const value = plainValue(table, row, base)
    if (value !== '') assign(value)
  }
  ctx.doc.entities = entity
  const known = new Set(['list_name', 'label', 'create_if', 'update_if', 'entity_id'])
  for (const column of table.columns) {
    if (!known.has(column.base) && cellValue(row, column) !== '') {
      report(ctx, 'warning', 'entities.unknown-column', `Unknown entities column "${column.header}" was ignored.`, sheet, row.rowNumber, column.header)
    }
  }
}

// --- top level ------------------------------------------------------------------

const warnLegacySeparators = (ctx: Ctx, table: SheetTable): void => {
  for (const column of table.columns) {
    if (column.legacySeparator === true) {
      report(ctx, 'warning', 'column.legacy-separator', `Column "${column.header}" uses a single ':'; use '::' instead.`, table.name, table.headerRow, column.header)
    }
  }
}

export const readXlsForm = async (data: ArrayBuffer): Promise<ReadXlsFormResult> => {
  const document: FormDocument = {
    schemaVersion: 1,
    settings: {},
    languages: [],
    children: [],
    choiceLists: {},
    attachments: [],
  }
  const ctx: Ctx = { issues: [], doc: document }

  let workbook: RawWorkbook
  try {
    workbook = readWorkbook(data)
  } catch (error) {
    report(ctx, 'error', 'workbook.unreadable', `The file could not be read as a workbook: ${String(error)}`, 'workbook', 1)
    return { document, issues: ctx.issues }
  }

  const tableFor = (key: string): SheetTable | null => {
    const raw = workbook.sheets.get(key)
    if (raw === undefined) return null
    return buildTable(raw.name, raw.rows, key)
  }

  const survey = tableFor('survey')
  const choices = tableFor('choices')
  const settings = tableFor('settings')
  const entities = tableFor('entities')

  if (survey === null) {
    report(ctx, 'error', 'sheet.missing-survey', 'The workbook has no survey sheet.', 'survey', 1)
    return { document, issues: ctx.issues }
  }

  document.languages = collectLanguages([survey, choices])
  for (const table of [survey, choices, settings, entities]) {
    if (table !== null) warnLegacySeparators(ctx, table)
  }

  if (settings !== null) readSettings(ctx, settings)
  if (choices !== null) readChoices(ctx, choices)
  readSurvey(ctx, survey)
  if (entities !== null) readEntities(ctx, entities)

  for (const [key, raw] of workbook.sheets) {
    if (MODEL_SHEETS.has(key)) continue
    const unknown = (document.unknown ??= {})
    ;(unknown.extraSheets ??= {})[raw.name] = raw.rows
  }

  return { document, issues: ctx.issues }
}
