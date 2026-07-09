/**
 * itext parsing/folding for the XForm parser: <translation> blocks become a
 * lookup keyed by text id and language, later folded into LocalizedText and
 * MediaRefs on nodes/choices. pyxform's '-' placeholder marks a missing
 * translation and is dropped on the way in (the serializer re-emits it).
 */
import type { Lang, LocalizedText, MediaRefs } from '../model/types'
import type { Issue } from '../validate/issues'

export interface ItextValue {
  text?: string
  guidance?: string
  media?: Partial<Record<keyof MediaRefs, string>>
}

export interface ItextStore {
  /** Languages in document order (verbatim @lang strings, may be 'default'). */
  langs: Lang[]
  /** The @lang carrying default="true()", if any. */
  defaultLang?: Lang
  /** text id → lang → folded value. */
  entries: Map<string, Map<Lang, ItextValue>>
}

const MEDIA_FORMS: Array<[string, keyof MediaRefs, string]> = [
  ['image', 'image', 'jr://images/'],
  ['audio', 'audio', 'jr://audio/'],
  ['video', 'video', 'jr://video/'],
  ['big-image', 'bigImage', 'jr://images/'],
]

const isElement = (node: Node): node is Element => node.nodeType === 1

export const elementChildren = (el: Element): Element[] => {
  const out: Element[] = []
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]
    if (isElement(child)) out.push(child)
  }
  return out
}

/**
 * Folds mixed label/hint/value content to a plain string; <output value=X>
 * children are rendered as their raw value expression via `foldOutput` (the
 * parser rewrites them to `${name}` once the symbol table exists).
 */
export const foldMixedText = (el: Element, foldOutput: (value: string) => string): string => {
  let out = ''
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]
    if (child.nodeType === 3 || child.nodeType === 4) {
      out += child.nodeValue ?? ''
    } else if (isElement(child) && child.localName === 'output') {
      out += foldOutput(child.getAttribute('value') ?? '')
    }
  }
  return out.trim()
}

/** `jr:itext('some-id')` → 'some-id' (or null when not an itext ref). */
export const itextIdFromRef = (ref: string | null): string | null => {
  if (ref === null) return null
  const match = /^\s*jr:itext\(\s*'([^']*)'\s*\)\s*$/.exec(ref)
  return match !== null ? match[1] : null
}

export const parseItext = (
  itextEl: Element,
  foldOutput: (value: string, textId: string) => string,
  issues: Issue[]
): ItextStore => {
  const store: ItextStore = { langs: [], entries: new Map() }

  for (const translation of elementChildren(itextEl)) {
    if (translation.localName !== 'translation') continue
    const lang = translation.getAttribute('lang') ?? 'default'
    if (!store.langs.includes(lang)) store.langs.push(lang)
    if (translation.getAttribute('default') !== null && store.defaultLang === undefined) {
      store.defaultLang = lang
    }

    for (const text of elementChildren(translation)) {
      if (text.localName !== 'text') continue
      const id = text.getAttribute('id')
      if (id === null) continue
      const value: ItextValue = {}
      for (const valueEl of elementChildren(text)) {
        if (valueEl.localName !== 'value') continue
        const form = valueEl.getAttribute('form')
        if (form === null) {
          const folded = foldMixedText(valueEl, (v) => foldOutput(v, id))
          if (folded !== '-') value.text = folded
        } else if (form === 'guidance') {
          value.guidance = foldMixedText(valueEl, (v) => foldOutput(v, id))
        } else {
          const mediaForm = MEDIA_FORMS.find(([name]) => name === form)
          if (mediaForm === undefined) {
            issues.push({
              severity: 'warning',
              code: 'import.unknown-itext-form',
              message: `Ignoring itext value form "${form}" in text "${id}".`,
              scope: { language: lang },
            })
            continue
          }
          const [, key, prefix] = mediaForm
          const raw = (valueEl.textContent ?? '').trim()
          value.media = value.media ?? {}
          value.media[key] = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw
        }
      }
      let byLang = store.entries.get(id)
      if (byLang === undefined) {
        byLang = new Map()
        store.entries.set(id, byLang)
      }
      byLang.set(lang, value)
    }
  }
  return store
}

export interface FoldedItext {
  text?: LocalizedText
  guidanceHint?: LocalizedText
  media?: MediaRefs
}

/** Collapse an itext entry across languages into model-shaped records. */
export const foldItextEntry = (store: ItextStore, id: string): FoldedItext | null => {
  const byLang = store.entries.get(id)
  if (byLang === undefined) return null
  const out: FoldedItext = { text: {} }
  for (const lang of store.langs) {
    const value = byLang.get(lang)
    if (value === undefined) continue
    if (value.text !== undefined && out.text !== undefined) out.text[lang] = value.text
    if (value.guidance !== undefined) {
      out.guidanceHint = out.guidanceHint ?? {}
      out.guidanceHint[lang] = value.guidance
    }
    for (const [, key] of MEDIA_FORMS) {
      const file = value.media?.[key]
      if (file === undefined) continue
      out.media = out.media ?? {}
      out.media[key] = out.media[key] ?? {}
      const slot = out.media[key]
      if (slot !== undefined) slot[lang] = file
    }
  }
  return out
}
