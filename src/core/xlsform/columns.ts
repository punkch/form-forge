/**
 * XLSForm header parsing: `::Language (code)` suffixes, pyxform column
 * aliases, `media::` media prefixes and the instance::/bind::/body::
 * passthrough prefixes. Language suffixes are kept byte-identical to the
 * header text — they double as itext @lang values.
 */

export interface ParsedHeader {
  /** Canonical lowercased column name ('label', 'read_only', 'bind::calculate'). */
  base: string
  /** Original spelling of the base part, for verbatim custom-column keys. */
  rawBase: string
  /** Language suffix exactly as written, e.g. 'English (en)'. */
  lang?: string
  /** True when the legacy single-colon separator was used. */
  legacySeparator?: boolean
}

/** Passthrough prefixes whose columns map to raw XForm attributes. */
const PASSTHROUGH = /^(instance|bind|body)\s*(::?)\s*(.+)$/i

const MEDIA_PREFIX = /^media\s*::?\s*/i

/** True aliases only — space/underscore variants are folded generically. */
const ALIASES: Record<string, string> = {
  caption: 'label',
  readonly: 'read_only',
  relevance: 'relevant',
  command: 'type',
  title: 'form_title',
  'id string': 'form_id',
  dataset: 'list_name',
  'big image': 'big-image',
}

const normalizeBase = (raw: string, sheet?: string): string => {
  const lower = raw.trim().toLowerCase()
  if (sheet === 'choices' && lower === 'value') return 'name'
  const spaced = lower.replace(/[\s_]+/g, ' ')
  const alias = ALIASES[spaced]
  if (alias !== undefined) return alias
  return lower.replace(/\s+/g, '_')
}

export const parseHeader = (header: string, sheet?: string): ParsedHeader => {
  const trimmed = header.trim()

  const passthrough = PASSTHROUGH.exec(trimmed)
  if (passthrough !== null) {
    return {
      base: `${passthrough[1].toLowerCase()}::${passthrough[3].trim()}`,
      rawBase: trimmed,
      ...(passthrough[2] === ':' ? { legacySeparator: true } : {}),
    }
  }

  const rest = trimmed.replace(MEDIA_PREFIX, '')
  let parts = rest.split('::').map((part) => part.trim())
  let legacy = false
  if (parts.length === 1 && rest.includes(':')) {
    parts = rest.split(':').map((part) => part.trim())
    legacy = true
  }

  const [rawBase, ...langParts] = parts
  const lang = langParts.join('::')
  return {
    base: normalizeBase(rawBase, sheet),
    rawBase,
    ...(lang !== '' ? { lang } : {}),
    ...(legacy ? { legacySeparator: true } : {}),
  }
}

/** Survey columns the reader maps onto explicit model fields. */
export const SURVEY_BASES = new Set([
  'type', 'name', 'label', 'hint', 'guidance_hint',
  'required', 'required_message', 'read_only', 'relevant',
  'constraint', 'constraint_message', 'calculation', 'choice_filter',
  'appearance', 'parameters', 'default', 'trigger', 'repeat_count',
  'image', 'audio', 'video', 'big-image', 'save_to',
])

/** Choices columns that are not per-list extra (cascade/filter) columns. */
export const CHOICES_BASES = new Set([
  'list_name', 'name', 'label', 'image', 'audio', 'video', 'big-image', 'geometry',
])

/** Localized survey/choices column base → media slot; undefined = text. */
export const MEDIA_BASES: Record<string, 'image' | 'audio' | 'video' | 'bigImage'> = {
  image: 'image',
  audio: 'audio',
  video: 'video',
  'big-image': 'bigImage',
}
