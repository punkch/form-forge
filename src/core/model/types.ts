/**
 * Canonical internal form model.
 *
 * A FormDocument is a tree of FormNodes plus document-level choice lists,
 * settings, languages, entity declaration and attachment references. It is
 * designed to losslessly round-trip both XForm XML and XLSForm workbooks:
 * every layer has an escape hatch for content we don't model explicitly
 * (custom bind/body/instance attributes, unknown survey/choices columns,
 * unknown workbook sheets, unrecognized XForm model fragments).
 *
 * This module is pure data — no Vue, Pinia or Dexie imports allowed anywhere
 * under src/core/.
 */

/**
 * Language key: the full XLSForm display string, e.g. 'English (en)'.
 * This is byte-identical to both the XLSForm column suffix
 * (`label::English (en)`) and the XForm itext `translation/@lang` value,
 * so no mapping table is needed.
 *
 * Builder-authored docs keep one of two clean shapes. Shape A (zero declared
 * languages): all text lives under the DEFAULT_LANG sentinel and serializes
 * inline. Shape B (≥1 language): all text lives under named keys, the
 * sentinel carries nothing, and settings.defaultLanguage is always one of
 * doc.languages. Mixed shapes exist only transiently in imported/legacy docs
 * and are merged at load/import boundaries by normalizeDefaultContent.
 * Exception: an XForm may literally declare `<translation lang="default">` —
 * then 'default' IS a named language and the sentinel rules don't apply.
 */
export type Lang = string
export const DEFAULT_LANG = 'default'

/** e.g. { default: 'Hi', 'French (fr)': 'Salut' } */
export type LocalizedText = Partial<Record<Lang, string>>

/** Per-language media file references (filenames, not blobs). */
export interface MediaRefs {
  image?: LocalizedText
  audio?: LocalizedText
  video?: LocalizedText
  bigImage?: LocalizedText
}

export interface BindProps {
  /** Expression; plain XLSForm 'yes' is normalized to 'true()'. */
  required?: string
  requiredMessage?: LocalizedText
  /** Expression or 'true()'. */
  readonly?: string
  relevant?: string
  constraint?: string
  constraintMessage?: LocalizedText
  calculation?: string
  saveIncomplete?: boolean
  /** bind::* passthrough columns / unknown bind attributes (qualified names). */
  custom?: Record<string, string>
}

export interface BodyProps {
  /** Raw appearance string; may contain multiple space-separated tokens. */
  appearance?: string
  /** Parsed key=value pairs from the XLSForm parameters column. */
  parameters?: Record<string, string>
  /** body::* passthrough columns / unknown body attributes. */
  custom?: Record<string, string>
}

interface BaseNode {
  /** Stable internal UUID — never serialized to XML/XLSX. */
  id: string
  /** Element/field name (XML element name, XLSForm name column). */
  name: string
  label?: LocalizedText
  hint?: LocalizedText
  guidanceHint?: LocalizedText
  media?: MediaRefs
  bind: BindProps
  body: BodyProps
  /** instance::* passthrough columns → attributes on the instance element. */
  instanceAttrs?: Record<string, string>
  /** Static value or dynamic expression; engines decide literal vs setvalue. */
  defaultValue?: string
  /** '${field}' reference — re-evaluate the default when that value changes. */
  trigger?: string
  /** Entity property name this field's value is saved to. */
  saveTo?: string
  /** Unknown survey-sheet columns, preserved verbatim (possibly translated). */
  customColumns?: Record<string, string | LocalizedText>
}

export interface QuestionNode extends BaseNode {
  kind: 'question'
  /** Registry key: 'text', 'select_one', 'start', 'audit', ... */
  type: string
  /** Choice list reference for select_one/select_multiple/rank. */
  listRef?: string
  /** Attached file for select_*_from_file ('foo.csv') and csv-external. */
  itemsetFile?: string
  choiceFilter?: string
}

export interface GroupNode extends BaseNode {
  kind: 'group'
  children: FormNode[]
}

export interface RepeatNode extends BaseNode {
  kind: 'repeat'
  children: FormNode[]
  /** Expression for jr:count / XLSForm repeat_count. */
  repeatCount?: string
}

export type FormNode = QuestionNode | GroupNode | RepeatNode
export type ContainerNode = GroupNode | RepeatNode

export const isContainer = (node: FormNode): node is ContainerNode =>
  node.kind === 'group' || node.kind === 'repeat'

export interface Choice {
  name: string
  label?: LocalizedText
  media?: MediaRefs
  /** Point/trace/shape for the `map` appearance. */
  geometry?: string
  /** Arbitrary cascade/filter columns (e.g. state, county), values verbatim. */
  extras?: Record<string, string>
}

export interface ChoiceList {
  /** XLSForm list_name. */
  name: string
  choices: Choice[]
  /** Preserves extra-column order for XLSForm round-trips. */
  extraColumnOrder?: string[]
}

export interface FormSettings {
  formTitle?: string
  formId?: string
  version?: string
  /** Expression for the submission's instance name. */
  instanceName?: string
  defaultLanguage?: Lang
  style?: string
  publicKey?: string
  submissionUrl?: string
  allowChoiceDuplicates?: boolean
  /** Unknown settings-sheet columns, preserved verbatim. */
  custom?: Record<string, string>
}

export interface EntityDeclaration {
  /** entities sheet list_name — the entity list (dataset) name. */
  datasetName: string
  /** Label expression for created/updated entities. */
  label?: string
  createIf?: string
  updateIf?: string
  entityId?: string
}

export type AttachmentRole = 'media' | 'csv' | 'geojson' | 'xml' | 'other'

export interface AttachmentRef {
  /** Key into the persistence layer's attachments store. */
  id: string
  /** Filename as referenced by jr:// URIs or itemsetFile. */
  filename: string
  mediatype: string
  size: number
  role: AttachmentRole
}

export interface UnknownContent {
  /** Unrecognized XForm constructs, re-emitted verbatim on export. */
  xformFragments?: Array<{ location: 'model' | 'head' | 'body', xml: string }>
  /** Unrecognized workbook sheets, raw cell rows. */
  extraSheets?: Record<string, string[][]>
}

export interface FormDocument {
  /** For persisted-document migrations, independent of the DB schema. */
  schemaVersion: 1
  settings: FormSettings
  /** Ordered as first seen; excludes the DEFAULT_LANG sentinel. */
  languages: Lang[]
  children: FormNode[]
  choiceLists: Record<string, ChoiceList>
  entities?: EntityDeclaration
  /** Metadata only — blobs live in IndexedDB. */
  attachments: AttachmentRef[]
  unknown?: UnknownContent
}
