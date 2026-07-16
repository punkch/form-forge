import { getQuestionType } from '../registry/question-types'
import { newId } from './ids'
import { primaryLang } from './translations'
import { type Choice, type ChoiceList, type FormDocument, type FormNode, type QuestionNode } from './types'
import { uniqueName, visit } from './ops'
import { defaultVersion } from './version'

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^([0-9])/, '_$1')
  return slug || 'form'
}

export const newDocument = (title: string): FormDocument => ({
  schemaVersion: 1,
  settings: {
    formTitle: title,
    formId: slugify(title),
    version: defaultVersion(),
  },
  languages: [],
  children: [],
  choiceLists: {},
  attachments: [],
})

/**
 * A new FormDocument from a template: deep-clones the template (templates
 * come from bundled JSON or IndexedDB, so they are plain data — no reactive
 * proxies), mints a fresh id for every node at every depth and resets the
 * identity settings exactly like newDocument does. Attachment blobs never
 * travel with templates, so the refs are dropped too.
 */
export const instantiateTemplate = (template: FormDocument, title: string): FormDocument => {
  const doc = structuredClone(template)
  visit(doc.children, (node) => { node.id = newId(); return undefined })
  doc.settings = {
    ...doc.settings,
    formTitle: title,
    formId: slugify(title),
    version: defaultVersion(),
  }
  doc.attachments = []
  return doc
}

/** Seed choices are built per call: labels land under the doc's primary
 * language (Shape B) or the DEFAULT_LANG sentinel (Shape A). */
const defaultChoices = (doc: FormDocument): Choice[] => {
  const lang = primaryLang(doc)
  return [
    { name: 'option_1', label: { [lang]: 'Option 1' } },
    { name: 'option_2', label: { [lang]: 'Option 2' } },
    { name: 'option_3', label: { [lang]: 'Option 3' } },
  ]
}

export const newChoiceList = (doc: FormDocument, baseName = 'choices'): ChoiceList => {
  let name = baseName
  let i = 1
  while (doc.choiceLists[name] !== undefined) name = `${baseName}_${++i}`
  const list: ChoiceList = { name, choices: defaultChoices(doc) }
  doc.choiceLists[name] = list
  return list
}

/**
 * Create a node of the given registry type with sensible defaults.
 * For choice-based questions a caller-provided (or fresh) list is bound.
 */
export const createNode = (doc: FormDocument, type: string, opts: { listRef?: string } = {}): FormNode => {
  const def = getQuestionType(type)
  const lang = primaryLang(doc)
  const base = {
    id: newId(),
    name: uniqueName(doc, type.replace(/[^a-zA-Z0-9]+/g, '_')),
    bind: {},
    body: {},
  }

  if (def?.isContainer) {
    const kind = def.containerKind ?? 'group'
    return {
      ...base,
      kind,
      label: { [lang]: def.title },
      children: [],
    } as FormNode
  }

  const question: QuestionNode = {
    ...base,
    kind: 'question',
    type,
    label: def && def.category !== 'meta' && type !== 'calculate'
      ? { [lang]: `${def.title} question` }
      : undefined,
  }

  if (def?.requiresChoices) {
    question.listRef = opts.listRef ?? newChoiceList(doc).name
  }
  if (def?.parameters) {
    const withDefaults = def.parameters.filter((p) => p.required && p.defaultValue !== undefined)
    if (withDefaults.length > 0) {
      question.body.parameters = Object.fromEntries(
        withDefaults.map((p) => [p.name, String(p.defaultValue)])
      )
    }
  }
  // Metadata questions conventionally reuse the type token as the field name.
  if (def?.category === 'meta') {
    question.name = uniqueName(doc, type.replace(/-/g, '_'))
    question.label = undefined
  }
  return question
}
