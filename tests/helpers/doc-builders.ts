/** Fluent helpers to build FormDocuments in tests. */
import { newDocument } from '../../src/core/model/factory'
import { newId } from '../../src/core/model/ids'
import {
  DEFAULT_LANG,
  type Choice,
  type FormDocument,
  type FormNode,
  type GroupNode,
  type QuestionNode,
  type RepeatNode,
} from '../../src/core/model/types'

type NodeOverrides = Partial<Omit<QuestionNode, 'kind' | 'id' | 'type' | 'name'>>

export const q = (type: string, name: string, label?: string, overrides: NodeOverrides = {}): QuestionNode => ({
  id: newId(),
  kind: 'question',
  type,
  name,
  ...(label !== undefined ? { label: { [DEFAULT_LANG]: label } } : {}),
  bind: {},
  body: {},
  ...overrides,
})

export const group = (name: string, label: string | undefined, children: FormNode[], overrides: Partial<GroupNode> = {}): GroupNode => ({
  id: newId(),
  kind: 'group',
  name,
  ...(label !== undefined ? { label: { [DEFAULT_LANG]: label } } : {}),
  bind: {},
  body: {},
  children,
  ...overrides,
})

export const repeat = (name: string, label: string | undefined, children: FormNode[], overrides: Partial<RepeatNode> = {}): RepeatNode => ({
  id: newId(),
  kind: 'repeat',
  name,
  ...(label !== undefined ? { label: { [DEFAULT_LANG]: label } } : {}),
  bind: {},
  body: {},
  children,
  ...overrides,
})

export const choice = (name: string, label?: string, extras?: Record<string, string>): Choice => ({
  name,
  ...(label !== undefined ? { label: { [DEFAULT_LANG]: label } } : {}),
  ...(extras !== undefined ? { extras } : {}),
})

export interface DocSpec {
  title: string
  formId: string
  version?: string
  children: FormNode[]
  choiceLists?: Record<string, Choice[]>
  languages?: string[]
  defaultLanguage?: string
  settings?: Partial<FormDocument['settings']>
  entities?: FormDocument['entities']
}

export const doc = (spec: DocSpec): FormDocument => {
  const d = newDocument(spec.title)
  d.settings.formId = spec.formId
  d.settings.version = spec.version ?? '20260709'
  if (spec.defaultLanguage !== undefined) d.settings.defaultLanguage = spec.defaultLanguage
  else delete d.settings.defaultLanguage
  Object.assign(d.settings, spec.settings ?? {})
  d.children = spec.children
  d.languages = spec.languages ?? []
  d.choiceLists = Object.fromEntries(
    Object.entries(spec.choiceLists ?? {}).map(([name, choices]) => [name, { name, choices }])
  )
  if (spec.entities !== undefined) d.entities = spec.entities
  return d
}
