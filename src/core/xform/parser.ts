/**
 * ODK XForm XML → FormDocument: the inverse of serializer.ts.
 *
 * Everything the serializer emits round-trips losslessly (pinned by
 * tests/golden/roundtrip.spec.ts); legacy constructs (inline <item> choice
 * lists, select1/select bind types, non-'data' instance roots) are folded
 * into the model with warnings. All traversal is namespace-aware via
 * localName — prefixes are never matched. Unrecognized model content is
 * preserved verbatim in unknown.xformFragments.
 */
import { rewriteFromXPath } from '../expr/from-xpath'
import type { Resolution, SymbolTable } from '../expr/symbol-table'
import { INSTANCE_ROOT, buildNodeIndex, type NodeIndexEntry } from '../model/index-utils'
import { newId } from '../model/ids'
import { visit } from '../model/ops'
import {
  DEFAULT_LANG,
  type Choice,
  type ContainerNode,
  type FormDocument,
  type FormNode,
  type LocalizedText,
  type QuestionNode,
} from '../model/types'
import { getAllQuestionTypes, getQuestionType } from '../registry/question-types'
import type { Issue } from '../validate/issues'
import {
  elementChildren,
  foldItextEntry,
  foldMixedText,
  itextIdFromRef,
  parseItext,
  type ItextStore,
} from './parser-itext'
import { XmlParseError, parseXml, serializeNode } from './xml-reader'

export interface ParseXFormResult {
  document: FormDocument
  issues: Issue[]
}

const NS_XMLNS = 'http://www.w3.org/2000/xmlns/'
const PREFIX_BY_NS: Record<string, string> = {
  'http://openrosa.org/javarosa': 'jr',
  'http://openrosa.org/xforms': 'orx',
  'http://www.opendatakit.org/xforms': 'odk',
  'http://www.opendatakit.org/xforms/entities': 'entities',
}
const NS_XFORMS = 'http://www.w3.org/2002/xforms'

const CONTROL_LOCALS = new Set(['input', 'select1', 'select', 'upload', 'trigger', 'range', 'rank'])

const INPUT_TYPE_BY_BIND: Record<string, string> = {
  string: 'text',
  int: 'integer',
  decimal: 'decimal',
  date: 'date',
  time: 'time',
  dateTime: 'datetime',
  geopoint: 'geopoint',
  geotrace: 'geotrace',
  geoshape: 'geoshape',
  barcode: 'barcode',
}

/** Attributes in canonical qualified form ('jr:preload'); xmlns decls dropped. */
const attrsOf = (el: Element): Record<string, string> => {
  const out: Record<string, string> = {}
  const attrs = el.attributes
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    const ns = attr.namespaceURI
    if (ns === NS_XMLNS || attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) continue
    if (ns === null || ns === '' || ns === NS_XFORMS) {
      out[attr.localName] = attr.value
    } else {
      const prefix = PREFIX_BY_NS[ns]
      out[prefix !== undefined ? `${prefix}:${attr.localName}` : attr.name] = attr.value
    }
  }
  return out
}

const childByLocal = (el: Element, local: string): Element | undefined =>
  elementChildren(el).find((c) => c.localName === local)

const leafText = (el: Element): string => el.textContent ?? ''

const emptyDocument = (): FormDocument => ({
  schemaVersion: 1,
  settings: {},
  languages: [],
  children: [],
  choiceLists: {},
  attachments: [],
})

/** Like buildSymbolTable, but for the file's actual instance root name. */
const makeSymbols = (doc: FormDocument, rootName: string): SymbolTable => {
  const index = buildNodeIndex(doc, rootName)
  const byPath = new Map<string, NodeIndexEntry>()
  for (const entry of index.byId.values()) byPath.set(entry.path, entry)
  const resolve = (name: string): Resolution => {
    const entries = index.byName.get(name)
    if (entries === undefined || entries.length === 0) return { status: 'missing' }
    if (entries.length > 1) return { status: 'ambiguous', entries }
    return { status: 'ok', entry: entries[0] }
  }
  const nearestRepeatPath = (entry: NodeIndexEntry): string | null => {
    for (let i = entry.ancestors.length - 1; i >= 0; i--) {
      const ancestor = index.byId.get(entry.ancestors[i])
      if (ancestor !== undefined && ancestor.node.kind === 'repeat') return ancestor.path
    }
    return null
  }
  return { index, resolve, nearestRepeatPath, entryByPath: (path) => byPath.get(path) ?? null }
}

// --- instance skeleton -------------------------------------------------------

interface Skel {
  name: string
  path: string
  isRepeat: boolean
  children: Skel[]
  instanceAttrs?: Record<string, string>
  staticDefault?: string
}

const hasTemplateAttr = (el: Element): boolean => {
  const attrs = el.attributes
  for (let i = 0; i < attrs.length; i++) {
    if (attrs[i].localName === 'template' && attrs[i].namespaceURI === 'http://openrosa.org/javarosa') return true
  }
  return false
}

// --- body scan ----------------------------------------------------------------

interface ControlInfo {
  el: Element
  local: string
  path: string
}

interface RepeatInfo {
  repeatEl: Element
  wrapperEl?: Element
}

interface ValueChanged {
  sourcePath: string
  targetRef: string
  value: string | null
}

interface BodyScan {
  controls: Map<string, ControlInfo>
  groups: Map<string, Element>
  repeats: Map<string, RepeatInfo>
  valueChanged: ValueChanged[]
  fragments: Element[]
}

// --- parser -------------------------------------------------------------------

export const parseXForm = (xml: string): ParseXFormResult => {
  const issues: Issue[] = []
  const doc = emptyDocument()
  const fail = (code: string, message: string): ParseXFormResult => {
    issues.push({ severity: 'error', code, message, scope: {} })
    return { document: doc, issues }
  }

  let dom: Document
  try {
    dom = parseXml(xml)
  } catch (err) {
    return fail('import.parse-error', err instanceof XmlParseError ? err.message : String(err))
  }

  const html = dom.documentElement
  if (html.localName !== 'html') {
    return fail('import.not-an-xform', `Expected an XForm <h:html> document, found <${html.nodeName}>.`)
  }
  const head = childByLocal(html, 'head')
  const bodyEl = childByLocal(html, 'body')
  const model = head !== undefined ? childByLocal(head, 'model') : undefined
  if (head === undefined || model === undefined) {
    return fail('import.missing-model', 'The document has no <h:head>/<model>.')
  }

  const titleEl = childByLocal(head, 'title')
  if (titleEl !== undefined) doc.settings.formTitle = leafText(titleEl).trim()

  // -- classify model children in document order
  let itextEl: Element | undefined
  let primaryEl: Element | undefined
  const secondaryInstances: Array<{ id: string, src: string | null, el: Element }> = []
  const bindEls: Element[] = []
  const firstLoadSetvalues: Array<{ ref: string, value: string, el: Element }> = []
  const actionsByRef = new Map<string, { kind: 'setgeopoint' | 'recordaudio', quality?: string }>()
  const modelFragments: Element[] = []

  for (const child of elementChildren(model)) {
    switch (child.localName) {
      case 'itext':
        itextEl = child
        break
      case 'instance': {
        const src = child.getAttributeNS('http://openrosa.org/javarosa', 'src') ?? child.getAttribute('src')
        if (primaryEl === undefined && src === null) {
          primaryEl = child
        } else {
          secondaryInstances.push({ id: child.getAttribute('id') ?? '', src, el: child })
        }
        break
      }
      case 'bind':
        bindEls.push(child)
        break
      case 'submission':
        if (child.getAttribute('action') !== null) doc.settings.submissionUrl = child.getAttribute('action') ?? undefined
        if (child.getAttribute('base64RsaPublicKey') !== null) {
          doc.settings.publicKey = child.getAttribute('base64RsaPublicKey') ?? undefined
        }
        break
      case 'setvalue': {
        const event = child.getAttribute('event') ?? ''
        const ref = child.getAttribute('ref')
        if (event.split(/\s+/).includes('odk-instance-first-load') && ref !== null) {
          firstLoadSetvalues.push({ ref: ref.trim(), value: child.getAttribute('value') ?? '', el: child })
        } else {
          modelFragments.push(child)
        }
        break
      }
      case 'setgeopoint': {
        const ref = child.getAttribute('ref')
        if (ref !== null) actionsByRef.set(ref.trim(), { kind: 'setgeopoint' })
        break
      }
      case 'recordaudio': {
        const ref = child.getAttribute('ref')
        if (ref !== null) {
          const quality = attrsOf(child)['odk:quality']
          actionsByRef.set(ref.trim(), { kind: 'recordaudio', quality })
        }
        break
      }
      default:
        modelFragments.push(child)
    }
  }

  if (primaryEl === undefined) {
    return fail('import.missing-instance', 'The model has no primary <instance>.')
  }
  const rootEl = elementChildren(primaryEl)[0]
  if (rootEl === undefined) {
    return fail('import.missing-instance', 'The primary <instance> is empty.')
  }

  const rootName = rootEl.localName
  const rootPath = `/${rootName}`
  const metaPrefix = `${rootPath}/meta`
  if (rootName !== INSTANCE_ROOT) {
    issues.push({
      severity: 'warning',
      code: 'import.root-renamed',
      message: `Instance root <${rootName}> will be exported as <${INSTANCE_ROOT}>.`,
      scope: {},
    })
  }
  doc.settings.formId = rootEl.getAttribute('id') ?? undefined
  doc.settings.version = rootEl.getAttribute('version') ?? undefined
  if (bodyEl !== undefined) {
    const cls = bodyEl.getAttribute('class')
    if (cls !== null && cls !== '') doc.settings.style = cls
  }

  const resolveRef = (raw: string, containerPath: string): string => {
    const ref = raw.trim()
    if (ref.startsWith('/')) return ref
    return `${containerPath}/${ref.replace(/^\.\//, '')}`
  }

  // -- body scan (repeat paths are needed before the instance walk)
  const scan: BodyScan = {
    controls: new Map(),
    groups: new Map(),
    repeats: new Map(),
    valueChanged: [],
    fragments: [],
  }

  const scanControlChildren = (control: Element, path: string): void => {
    for (const child of elementChildren(control)) {
      if (child.localName === 'setvalue' && (child.getAttribute('event') ?? '') === 'xforms-value-changed') {
        const targetRef = child.getAttribute('ref')
        if (targetRef !== null) {
          scan.valueChanged.push({
            sourcePath: path,
            targetRef: resolveRef(targetRef, rootPath),
            value: child.getAttribute('value'),
          })
        }
      } else if (!['label', 'hint', 'item', 'itemset', 'setvalue'].includes(child.localName)) {
        issues.push({
          severity: 'warning',
          code: 'import.dropped-content',
          message: `Dropping unsupported <${child.nodeName}> inside the control for ${path}.`,
          scope: {},
        })
      }
    }
  }

  const scanBody = (parent: Element, containerPath: string, topLevel: boolean): void => {
    for (const child of elementChildren(parent)) {
      const local = child.localName
      if (local === 'label' || local === 'hint') continue
      if (local === 'group') {
        const refAttr = child.getAttribute('ref') ?? child.getAttribute('nodeset')
        const ref = refAttr !== null ? resolveRef(refAttr, containerPath) : containerPath
        const kids = elementChildren(child)
        const repeatKid = kids.find((k) =>
          k.localName === 'repeat' &&
          resolveRef(k.getAttribute('nodeset') ?? k.getAttribute('ref') ?? '', containerPath) === ref)
        const wrapsOnlyRepeat = repeatKid !== undefined &&
          kids.every((k) => k === repeatKid || k.localName === 'label' || k.localName === 'hint')
        if (repeatKid !== undefined && wrapsOnlyRepeat) {
          scan.repeats.set(ref, { repeatEl: repeatKid, wrapperEl: child })
          scanBody(repeatKid, ref, false)
        } else {
          scan.groups.set(ref, child)
          scanBody(child, ref, false)
        }
      } else if (local === 'repeat') {
        const nodeset = child.getAttribute('nodeset') ?? child.getAttribute('ref')
        const ref = nodeset !== null ? resolveRef(nodeset, containerPath) : containerPath
        if (!scan.repeats.has(ref)) scan.repeats.set(ref, { repeatEl: child })
        scanBody(child, ref, false)
      } else if (CONTROL_LOCALS.has(local)) {
        const refAttr = child.getAttribute('ref') ?? child.getAttribute('nodeset')
        if (refAttr === null) {
          issues.push({
            severity: 'warning',
            code: 'import.orphan-control',
            message: `Skipping <${child.nodeName}> without a ref.`,
            scope: {},
          })
          continue
        }
        const path = resolveRef(refAttr, containerPath)
        scan.controls.set(path, { el: child, local, path })
        scanControlChildren(child, path)
      } else if (topLevel) {
        scan.fragments.push(child)
      } else {
        issues.push({
          severity: 'warning',
          code: 'import.dropped-content',
          message: `Dropping unsupported <${child.nodeName}> in ${containerPath}.`,
          scope: {},
        })
      }
    }
  }
  if (bodyEl !== undefined) scanBody(bodyEl, rootPath, true)

  // -- instance walk with repeat-run collapsing
  const walkInstance = (parent: Element, parentPath: string): Skel[] => {
    const out: Skel[] = []
    const kids = elementChildren(parent)
    let i = 0
    while (i < kids.length) {
      const name = kids[i].localName
      let j = i + 1
      while (j < kids.length && kids[j].localName === name) j++
      const run = kids.slice(i, j)
      i = j
      const path = `${parentPath}/${name}`
      const isRepeat = scan.repeats.has(path) || run.some(hasTemplateAttr)
      if (isRepeat) {
        const contentEl = run.find((el) => !hasTemplateAttr(el)) ?? run[0]
        out.push(makeSkel(contentEl, path, true))
      } else {
        if (run.length > 1) {
          issues.push({
            severity: 'warning',
            code: 'import.duplicate-name',
            message: `Multiple <${name}> siblings under ${parentPath} without a repeat; keeping all.`,
            scope: {},
          })
        }
        for (const el of run) out.push(makeSkel(el, path, false))
      }
    }
    return out
  }

  const makeSkel = (el: Element, path: string, isRepeat: boolean): Skel => {
    const children = walkInstance(el, path)
    const attrs = attrsOf(el)
    delete attrs['jr:template']
    const skel: Skel = { name: el.localName, path, isRepeat, children }
    if (Object.keys(attrs).length > 0) skel.instanceAttrs = attrs
    if (children.length === 0) {
      const text = leafText(el)
      if (text.trim() !== '') skel.staticDefault = text
    }
    return skel
  }

  const metaEl = childByLocal(rootEl, 'meta')
  const skeletons = walkInstance(rootEl, rootPath).filter((s) => s.name !== 'meta')

  // -- build the node tree (names/kinds only; semantics folded in below)
  const nodeByPath = new Map<string, FormNode>()
  const buildNode = (skel: Skel): FormNode => {
    const isContainerNode = skel.isRepeat || skel.children.length > 0 ||
      scan.groups.has(skel.path) || scan.repeats.has(skel.path)
    let node: FormNode
    if (isContainerNode) {
      node = {
        id: newId(),
        kind: skel.isRepeat || scan.repeats.has(skel.path) ? 'repeat' : 'group',
        name: skel.name,
        bind: {},
        body: {},
        children: skel.children.map(buildNode),
      }
    } else {
      node = { id: newId(), kind: 'question', type: 'text', name: skel.name, bind: {}, body: {} }
      if (skel.staticDefault !== undefined) node.defaultValue = skel.staticDefault
    }
    if (skel.instanceAttrs !== undefined) node.instanceAttrs = skel.instanceAttrs
    nodeByPath.set(skel.path, node)
    return node
  }
  doc.children = skeletons.map(buildNode)

  // -- meta: entity declaration, instanceName, in-meta questions (audit)
  let entityEl: Element | undefined
  let instanceNamePresent = false
  const metaQuestionEls: Element[] = []
  if (metaEl !== undefined) {
    for (const child of elementChildren(metaEl)) {
      if (child.localName === 'instanceID') continue
      if (child.localName === 'instanceName') { instanceNamePresent = true; continue }
      if (child.localName === 'entity') { entityEl = child; continue }
      metaQuestionEls.push(child)
    }
  }
  for (const el of metaQuestionEls) {
    const def = getQuestionType(el.localName)
    if (def?.xform.inMeta !== true) {
      issues.push({
        severity: 'warning',
        code: 'import.dropped-content',
        message: `Dropping unrecognized <meta> child <${el.nodeName}>.`,
        scope: {},
      })
      continue
    }
    const node: QuestionNode = { id: newId(), kind: 'question', type: def.type, name: el.localName, bind: {}, body: {} }
    doc.children.push(node)
    nodeByPath.set(`${metaPrefix}/${el.localName}`, node)
  }

  // -- symbol table over the actual root; expressions become ${} where safe
  const symbols = makeSymbols(doc, rootName)
  const reverseExpr = (expr: string, contextPath?: string): string =>
    rewriteFromXPath(expr.trim(), { symbols, contextPath })

  const foldOutput = (value: string, contextPath: string | undefined): string => {
    const rewritten = reverseExpr(value, contextPath)
    if (/^\$\{[^}]+\}$/.test(rewritten)) return rewritten
    issues.push({
      severity: 'warning',
      code: 'import.dropped-output',
      message: `Could not fold <output value="${value.trim()}"> into a \${field} reference; keeping the expression as text.`,
      scope: {},
    })
    return rewritten
  }

  // -- itext
  const itext: ItextStore = itextEl !== undefined
    ? parseItext(itextEl, (value, textId) => {
      const colon = textId.indexOf(':')
      const context = colon > 0 && textId.startsWith('/') ? textId.slice(0, colon) : undefined
      return foldOutput(value, context)
    }, issues)
    : { langs: [], entries: new Map() }
  doc.languages = [...itext.langs]
  if (itext.defaultLang !== undefined) doc.settings.defaultLanguage = itext.defaultLang

  const localizedFrom = (raw: string, nodeId?: string): LocalizedText => {
    const id = itextIdFromRef(raw)
    if (id === null) return { [DEFAULT_LANG]: raw }
    const folded = foldItextEntry(itext, id)
    if (folded === null) {
      issues.push({
        severity: 'warning',
        code: 'import.missing-itext',
        message: `itext id '${id}' has no translations.`,
        scope: { nodeId },
      })
      return {}
    }
    return folded.text ?? {}
  }

  // -- choice lists
  const materializedLists = new Set<string>()
  const consumedInstances = new Set<Element>()

  const choiceFromItem = (item: Element, extraOrder: string[]): Choice => {
    const choice: Choice = { name: '' }
    for (const child of elementChildren(item)) {
      const local = child.localName
      if (local === 'name' || local === 'value') {
        choice.name = leafText(child)
      } else if (local === 'label') {
        const ref = child.getAttribute('ref')
        const id = itextIdFromRef(ref)
        if (id !== null) {
          const folded = foldItextEntry(itext, id)
          if (folded !== null) {
            choice.label = folded.text
            if (folded.media !== undefined) choice.media = folded.media
          }
        } else {
          choice.label = { [DEFAULT_LANG]: foldMixedText(child, (v) => foldOutput(v, undefined)) }
        }
      } else if (local === 'itextId') {
        const folded = foldItextEntry(itext, leafText(child))
        if (folded !== null) {
          choice.label = folded.text
          if (folded.media !== undefined) choice.media = folded.media
        }
      } else {
        choice.extras = choice.extras ?? {}
        choice.extras[local] = leafText(child)
        if (!extraOrder.includes(local)) extraOrder.push(local)
      }
    }
    return choice
  }

  const materializeInstanceList = (id: string): boolean => {
    if (materializedLists.has(id)) return true
    const secondary = secondaryInstances.find((s) => s.id === id && s.src === null)
    if (secondary === undefined) return false
    const listRoot = elementChildren(secondary.el)[0]
    const items = listRoot !== undefined
      ? elementChildren(listRoot).filter((el) => el.localName === 'item')
      : []
    const extraOrder: string[] = []
    const choices = items.map((item) => choiceFromItem(item, extraOrder))
    doc.choiceLists[id] = {
      name: id,
      choices,
      ...(extraOrder.length > 0 ? { extraColumnOrder: extraOrder } : {}),
    }
    materializedLists.add(id)
    consumedInstances.add(secondary.el)
    return true
  }

  const uniqueListName = (base: string): string => {
    let name = base
    let i = 1
    while (doc.choiceLists[name] !== undefined) name = `${base}_${++i}`
    return name
  }

  const synthesizeInlineList = (question: QuestionNode, items: Element[]): void => {
    const name = uniqueListName(question.name)
    const extraOrder: string[] = []
    doc.choiceLists[name] = { name, choices: items.map((item) => choiceFromItem(item, extraOrder)) }
    question.listRef = name
  }

  /** Split `randomize(inner, seed)` at the top-level comma. */
  const unwrapRandomize = (nodeset: string): { inner: string, seed?: string } | null => {
    const trimmed = nodeset.trim()
    if (!trimmed.startsWith('randomize(') || !trimmed.endsWith(')')) return null
    const inner = trimmed.slice('randomize('.length, -1)
    let depth = 0
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i]
      if (ch === '(' || ch === '[') depth++
      else if (ch === ')' || ch === ']') depth--
      else if (ch === ',' && depth === 0) {
        return { inner: inner.slice(0, i).trim(), seed: inner.slice(i + 1).trim() }
      }
    }
    return { inner: inner.trim() }
  }

  const applyItemset = (question: QuestionNode, itemsetEl: Element, path: string): void => {
    const params: Record<string, string> = {}
    let nodeset = itemsetEl.getAttribute('nodeset') ?? ''
    const randomized = unwrapRandomize(nodeset)
    if (randomized !== null) {
      params.randomize = 'true'
      if (randomized.seed !== undefined) params.seed = randomized.seed
      nodeset = randomized.inner
    }
    const match = /^instance\('([^']+)'\)\/root\/item(?:\[(.*)\])?$/.exec(nodeset.trim())
    if (match === null) {
      issues.push({
        severity: 'warning',
        code: 'import.unsupported-itemset',
        message: `Cannot interpret itemset nodeset "${nodeset}" for ${path}; importing an empty choice list.`,
        scope: { nodeId: question.id },
      })
      synthesizeInlineList(question, [])
      return
    }
    const [, instanceId, predicate] = match
    if (predicate !== undefined && predicate !== '') {
      question.choiceFilter = reverseExpr(predicate, path)
    }
    const valueRef = childByLocal(itemsetEl, 'value')?.getAttribute('ref') ?? 'name'
    const labelRef = childByLocal(itemsetEl, 'label')?.getAttribute('ref') ?? 'label'
    if (valueRef !== 'name') params.value = valueRef
    if (labelRef !== 'label' && itextIdFromRef(labelRef) === null && labelRef !== 'jr:itext(itextId)') {
      params.label = labelRef
    }

    const external = secondaryInstances.find((s) => s.id === instanceId && s.src !== null)
    if (external !== undefined) {
      question.itemsetFile = external.src?.split('/').pop() ?? `${instanceId}.csv`
      if (question.type === 'select_one') question.type = 'select_one_from_file'
      else if (question.type === 'select_multiple') question.type = 'select_multiple_from_file'
      consumedInstances.add(external.el)
    } else if (materializeInstanceList(instanceId)) {
      question.listRef = instanceId
    } else {
      issues.push({
        severity: 'warning',
        code: 'import.unknown-list',
        message: `itemset for ${path} references instance('${instanceId}') which does not exist; importing an empty choice list.`,
        scope: { nodeId: question.id },
      })
      doc.choiceLists[instanceId] = doc.choiceLists[instanceId] ?? { name: instanceId, choices: [] }
      question.listRef = instanceId
    }
    if (Object.keys(params).length > 0) {
      question.body.parameters = { ...question.body.parameters, ...params }
    }
  }

  // -- label/hint/media folding for a control or group element
  const applyLabelHint = (node: FormNode, el: Element, path: string): void => {
    const labelEl = childByLocal(el, 'label')
    if (labelEl !== undefined) {
      const id = itextIdFromRef(labelEl.getAttribute('ref'))
      if (id !== null) {
        const folded = foldItextEntry(itext, id)
        if (folded !== null) {
          node.label = folded.text ?? {}
          if (folded.media !== undefined) node.media = folded.media
        } else {
          issues.push({
            severity: 'warning',
            code: 'import.missing-itext',
            message: `Label itext id '${id}' has no translations.`,
            scope: { nodeId: node.id },
          })
          node.label = {}
        }
      } else {
        node.label = { [DEFAULT_LANG]: foldMixedText(labelEl, (v) => foldOutput(v, path)) }
      }
    }
    const hintEl = childByLocal(el, 'hint')
    if (hintEl !== undefined) {
      const id = itextIdFromRef(hintEl.getAttribute('ref'))
      if (id !== null) {
        const folded = foldItextEntry(itext, id)
        if (folded !== null) {
          node.hint = folded.text ?? {}
          if (folded.guidanceHint !== undefined) node.guidanceHint = folded.guidanceHint
        } else {
          node.hint = {}
        }
      } else {
        node.hint = { [DEFAULT_LANG]: foldMixedText(hintEl, (v) => foldOutput(v, path)) }
      }
    }
  }

  // -- binds indexed by nodeset
  const bindAttrsByPath = new Map<string, Record<string, string>>()
  let entityIdValue: string | undefined
  let entityLabelExpr: string | undefined
  let instanceNameExpr: string | undefined

  for (const bindEl of bindEls) {
    const attrs = attrsOf(bindEl)
    const rawNodeset = attrs.nodeset
    if (rawNodeset === undefined) continue
    const path = resolveRef(rawNodeset, rootPath)
    if (path === `${metaPrefix}/instanceID` || path === `${metaPrefix}/entity/@id`) continue
    if (path === `${metaPrefix}/instanceName`) {
      instanceNameExpr = attrs.calculate
      continue
    }
    if (path === `${metaPrefix}/entity/label`) {
      entityLabelExpr = attrs.calculate
      continue
    }
    if (nodeByPath.has(path)) {
      bindAttrsByPath.set(path, attrs)
    } else {
      issues.push({
        severity: 'warning',
        code: 'import.orphan-bind',
        message: `Bind for unknown nodeset ${path} preserved verbatim.`,
        scope: {},
      })
      modelFragments.push(bindEl)
    }
  }

  // -- shared bind-property folding
  const applyBindCommon = (node: FormNode, attrs: Record<string, string>, path: string): void => {
    const take = (key: string): string | undefined => {
      const value = attrs[key]
      delete attrs[key]
      return value
    }
    delete attrs.nodeset
    const readonly = take('readonly')
    if (readonly !== undefined && !(node.kind === 'question' && node.type === 'note' && readonly.trim() === 'true()')) {
      node.bind.readonly = reverseExpr(readonly, path)
    }
    const required = take('required')
    if (required !== undefined) node.bind.required = reverseExpr(required, path)
    const relevant = take('relevant')
    if (relevant !== undefined) node.bind.relevant = reverseExpr(relevant, path)
    const constraint = take('constraint')
    if (constraint !== undefined) node.bind.constraint = reverseExpr(constraint, path)
    const calculate = take('calculate')
    if (calculate !== undefined) node.bind.calculation = reverseExpr(calculate, path)
    const constraintMsg = take('jr:constraintMsg')
    if (constraintMsg !== undefined) node.bind.constraintMessage = localizedFrom(constraintMsg, node.id)
    const requiredMsg = take('jr:requiredMsg')
    if (requiredMsg !== undefined) node.bind.requiredMessage = localizedFrom(requiredMsg, node.id)
    if (take('odk:saveIncomplete') === 'true()') node.bind.saveIncomplete = true
    const saveTo = take('entities:saveto')
    if (saveTo !== undefined && node.kind === 'question') node.saveTo = saveTo
    if (Object.keys(attrs).length > 0) {
      node.bind.custom = { ...node.bind.custom, ...attrs }
    }
  }

  // -- question typing
  const uploadTypeFor = (mediatype: string): string | null =>
    getAllQuestionTypes().find((def) =>
      def.xform.bodyElement === 'upload' && !def.xform.inMeta && def.xform.mediatype === mediatype)?.type ?? null

  const preloadTypeFor = (preload: string, preloadParams: string | undefined): string | null =>
    getAllQuestionTypes().find((def) =>
      def.xform.bodyElement === null &&
      def.xform.preload !== undefined &&
      def.xform.preload.preload === preload &&
      def.xform.preload.preloadParams === preloadParams)?.type ?? null

  const finalizeQuestion = (question: QuestionNode, path: string, attrs: Record<string, string>): void => {
    const control = scan.controls.get(path)
    const action = actionsByRef.get(path)
    const bindType = attrs.type

    if (control !== undefined) {
      delete attrs.type
      switch (control.local) {
        case 'select1':
          question.type = 'select_one'
          break
        case 'select':
          question.type = 'select_multiple'
          break
        case 'rank':
          question.type = 'rank'
          break
        case 'trigger':
          question.type = 'acknowledge'
          break
        case 'range':
          question.type = 'range'
          break
        case 'upload': {
          const mediatype = control.el.getAttribute('mediatype') ?? ''
          const matched = uploadTypeFor(mediatype)
          if (matched !== null) {
            question.type = matched
          } else {
            question.type = 'file'
            issues.push({
              severity: 'warning',
              code: 'import.unknown-mediatype',
              message: `Unsupported upload mediatype "${mediatype}" on ${path}; importing as a file question.`,
              scope: { nodeId: question.id },
            })
          }
          break
        }
        default: { // input
          const effective = bindType ?? 'string'
          const mapped = INPUT_TYPE_BY_BIND[effective]
          if (mapped === undefined) {
            question.type = 'text'
            if (bindType !== undefined) attrs.type = bindType // keep unknown types lossless
            issues.push({
              severity: 'warning',
              code: 'import.unknown-bind-type',
              message: `Unknown bind type "${effective}" on ${path}; importing as text.`,
              scope: { nodeId: question.id },
            })
          } else if (mapped === 'text' && attrs.readonly?.trim() === 'true()' && attrs.calculate === undefined) {
            question.type = 'note'
            delete attrs.readonly
          } else {
            question.type = mapped
          }
        }
      }

      // body attributes → appearance / parameters / custom
      const bodyAttrs = attrsOf(control.el)
      delete bodyAttrs.ref
      delete bodyAttrs.nodeset
      if (control.local === 'upload') delete bodyAttrs.mediatype
      if (bodyAttrs.appearance !== undefined) {
        question.body.appearance = bodyAttrs.appearance
        delete bodyAttrs.appearance
      }
      if (control.local === 'range') {
        const params: Record<string, string> = {}
        for (const key of ['start', 'end', 'step']) {
          if (bodyAttrs[key] !== undefined) {
            params[key] = bodyAttrs[key]
            delete bodyAttrs[key]
          }
        }
        if (Object.keys(params).length > 0) question.body.parameters = { ...question.body.parameters, ...params }
      }
      if (Object.keys(bodyAttrs).length > 0) question.body.custom = { ...question.body.custom, ...bodyAttrs }

      applyLabelHint(question, control.el, path)

      if (control.local === 'select1' || control.local === 'select' || control.local === 'rank') {
        const itemsetEl = childByLocal(control.el, 'itemset')
        const items = elementChildren(control.el).filter((el) => el.localName === 'item')
        if (itemsetEl !== undefined) {
          applyItemset(question, itemsetEl, path)
        } else {
          if (items.length === 0) {
            issues.push({
              severity: 'warning',
              code: 'import.unknown-list',
              message: `Select ${path} has no items or itemset; importing an empty choice list.`,
              scope: { nodeId: question.id },
            })
          }
          synthesizeInlineList(question, items)
        }
      }
    } else if (action !== undefined) {
      delete attrs.type
      if (action.kind === 'setgeopoint') {
        question.type = 'start-geopoint'
      } else {
        question.type = 'background-audio'
        if (action.quality !== undefined) {
          question.body.parameters = { ...question.body.parameters, quality: action.quality }
        }
      }
    } else if (attrs['jr:preload'] !== undefined) {
      const matched = preloadTypeFor(attrs['jr:preload'], attrs['jr:preloadParams'])
      if (matched !== null) {
        question.type = matched
        delete attrs.type
        delete attrs['jr:preload']
        delete attrs['jr:preloadParams']
      } else {
        question.type = attrs.calculate !== undefined ? 'calculate' : 'text'
        delete attrs.type
        issues.push({
          severity: 'warning',
          code: 'import.hidden-field',
          message: `${path} has an unrecognized preload and no body control; importing as ${question.type}.`,
          scope: { nodeId: question.id },
        })
      }
    } else if (attrs.calculate !== undefined) {
      question.type = 'calculate'
      delete attrs.type
    } else {
      question.type = bindType !== undefined && INPUT_TYPE_BY_BIND[bindType] !== undefined
        ? INPUT_TYPE_BY_BIND[bindType]
        : 'text'
      delete attrs.type
      issues.push({
        severity: 'warning',
        code: 'import.hidden-field',
        message: `${path} has no body control; importing as a ${question.type} question (it will gain an input on export).`,
        scope: { nodeId: question.id },
      })
    }

    // registry-mapped parameter attributes living on the bind
    if (question.type === 'image' && attrs['orx:max-pixels'] !== undefined) {
      question.body.parameters = { ...question.body.parameters, 'max-pixels': attrs['orx:max-pixels'] }
      delete attrs['orx:max-pixels']
    }
    if (question.type === 'audio' && attrs['odk:quality'] !== undefined) {
      question.body.parameters = { ...question.body.parameters, quality: attrs['odk:quality'] }
      delete attrs['odk:quality']
    }

    applyBindCommon(question, attrs, path)
  }

  const finalizeContainer = (node: ContainerNode, path: string, attrs: Record<string, string>): void => {
    const repeat = scan.repeats.get(path)
    const groupEl = scan.groups.get(path)
    const labelSource = repeat?.wrapperEl ?? groupEl ?? repeat?.repeatEl
    if (labelSource !== undefined) applyLabelHint(node, labelSource, path)

    const attrSource = groupEl ?? repeat?.repeatEl
    if (attrSource !== undefined) {
      const bodyAttrs = attrsOf(attrSource)
      delete bodyAttrs.ref
      delete bodyAttrs.nodeset
      if (node.kind === 'repeat') {
        const count = bodyAttrs['jr:count']
        if (count !== undefined) {
          node.repeatCount = reverseExpr(count, path)
          delete bodyAttrs['jr:count']
        }
      }
      if (bodyAttrs.appearance !== undefined) {
        node.body.appearance = bodyAttrs.appearance
        delete bodyAttrs.appearance
      }
      if (Object.keys(bodyAttrs).length > 0) node.body.custom = { ...node.body.custom, ...bodyAttrs }
    }
    // repeats wrapped in a labelled group keep jr:count on the repeat element
    if (node.kind === 'repeat' && repeat?.wrapperEl !== undefined && attrSource === undefined) {
      const count = attrsOf(repeat.repeatEl)['jr:count']
      if (count !== undefined) node.repeatCount = reverseExpr(count, path)
    }
    applyBindCommon(node, attrs, path)
  }

  // -- fold binds/body/meta semantics into every node
  const index = buildNodeIndex(doc, rootName)
  visit(doc.children, (node) => {
    const inMeta = node.kind === 'question' && getQuestionType(node.type)?.xform.inMeta === true
    const path = inMeta
      ? `${metaPrefix}/${node.name}`
      : index.byId.get(node.id)?.path ?? `${rootPath}/${node.name}`
    const attrs = { ...(bindAttrsByPath.get(path) ?? {}) }
    if (node.kind === 'question') {
      if (inMeta) {
        // audit-style meta question: odk:* bind attrs are its parameters
        delete attrs.type
        const params: Record<string, string> = {}
        for (const [key, value] of Object.entries(attrs)) {
          if (key.startsWith('odk:')) {
            params[key.slice('odk:'.length)] = value
            delete attrs[key]
          }
        }
        if (Object.keys(params).length > 0) node.body.parameters = params
        applyBindCommon(node, attrs, path)
      } else {
        finalizeQuestion(node, path, attrs)
      }
    } else {
      finalizeContainer(node, path, attrs)
    }
    return undefined
  })

  // -- model-level first-load defaults
  for (const setvalue of firstLoadSetvalues) {
    const path = resolveRef(setvalue.ref, rootPath)
    if (path === `${metaPrefix}/entity/@id`) {
      entityIdValue = setvalue.value.trim() === 'uuid()' ? undefined : setvalue.value
      continue
    }
    const node = nodeByPath.get(path)
    if (node === undefined) {
      modelFragments.push(setvalue.el)
      continue
    }
    node.defaultValue = reverseExpr(setvalue.value, path)
  }

  // -- in-body value-changed setvalues → trigger + calculation
  for (const change of scan.valueChanged) {
    const source = nodeByPath.get(change.sourcePath)
    const target = nodeByPath.get(change.targetRef)
    if (source === undefined || target === undefined) {
      issues.push({
        severity: 'warning',
        code: 'import.orphan-setvalue',
        message: `Ignoring value-changed setvalue from ${change.sourcePath} to ${change.targetRef}.`,
        scope: {},
      })
      continue
    }
    target.trigger = `\${${source.name}}`
    if (change.value !== null && change.value !== '') {
      target.bind.calculation = reverseExpr(change.value, change.targetRef)
    }
  }

  // -- entities
  if (entityEl !== undefined) {
    const attrs = attrsOf(entityEl)
    const dataset = attrs.dataset ?? ''
    const isBlanketTrue = (value: string | undefined): boolean =>
      value === undefined || value.trim() === '1' || value.trim() === 'true()'
    doc.entities = { datasetName: dataset }
    if (entityLabelExpr !== undefined) doc.entities.label = reverseExpr(entityLabelExpr)
    if (attrs.create !== undefined && !isBlanketTrue(attrs.create)) {
      doc.entities.createIf = reverseExpr(attrs.create)
    }
    if (attrs.update !== undefined) {
      if (!isBlanketTrue(attrs.update)) doc.entities.updateIf = reverseExpr(attrs.update)
      if (entityIdValue !== undefined) {
        doc.entities.entityId = reverseExpr(entityIdValue)
      } else {
        issues.push({
          severity: 'warning',
          code: 'import.entity',
          message: 'The entity block updates entities but has no entity id expression; the update condition may not round-trip.',
          scope: {},
        })
      }
    } else if (entityIdValue !== undefined) {
      doc.entities.entityId = reverseExpr(entityIdValue)
    }
  }

  if (instanceNamePresent && instanceNameExpr !== undefined) {
    doc.settings.instanceName = reverseExpr(instanceNameExpr)
  }

  // -- preserve unrecognized model/body content verbatim
  const fragments: Array<{ location: 'model' | 'head' | 'body', xml: string }> = []
  for (const secondary of secondaryInstances) {
    if (!consumedInstances.has(secondary.el)) fragments.push({ location: 'model', xml: serializeNode(secondary.el) })
  }
  for (const el of modelFragments) fragments.push({ location: 'model', xml: serializeNode(el) })
  for (const el of scan.fragments) fragments.push({ location: 'body', xml: serializeNode(el) })
  if (fragments.length > 0) doc.unknown = { xformFragments: fragments }

  return { document: doc, issues }
}
