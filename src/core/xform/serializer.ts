/**
 * FormDocument → ODK XForm XML.
 *
 * Output conventions follow pyxform 4.5.0 (see tests/golden/) so that the
 * generated forms are exactly what the ODK ecosystem — including
 * @getodk/web-forms — expects. Intentional divergences are documented in
 * tests/golden/README.md.
 */
import { buildSymbolTable, type SymbolTable } from '../expr/symbol-table'
import { findRefs } from '../expr/tokenizer'
import { rewriteToXPath, type RewriteMode } from '../expr/to-xpath'
import { INSTANCE_ROOT, buildNodeIndex } from '../model/index-utils'
import { visit } from '../model/ops'
import {
  DEFAULT_LANG,
  type ChoiceList,
  type FormDocument,
  type FormNode,
  type Lang,
  type LocalizedText,
  type MediaRefs,
  type QuestionNode,
} from '../model/types'
import { effectiveItemsetFile, getQuestionType, type QuestionTypeDefinition } from '../registry/question-types'
import { hasText } from '../util/guards'
import type { Issue } from '../validate/issues'
import { el, serializeXml, type XmlChild, type XmlNode } from './xml-writer'

export interface SerializeResult {
  xml: string
  issues: Issue[]
}

const NAMESPACES: Record<string, string> = {
  xmlns: 'http://www.w3.org/2002/xforms',
  'xmlns:h': 'http://www.w3.org/1999/xhtml',
  'xmlns:ev': 'http://www.w3.org/2001/xml-events',
  'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
  'xmlns:jr': 'http://openrosa.org/javarosa',
  'xmlns:orx': 'http://openrosa.org/xforms',
  'xmlns:odk': 'http://www.opendatakit.org/xforms',
}

const ENTITIES_NS = 'http://www.opendatakit.org/xforms/entities'
const ENTITIES_VERSION = '2024.1.0'

/** pyxform: a default is dynamic when it references nodes or calls functions. */
export const isDynamicDefault = (value: string): boolean =>
  value.includes('${') || value.includes('(')

const mediaForms: Array<[keyof MediaRefs, string, string]> = [
  ['image', 'image', 'jr://images/'],
  ['audio', 'audio', 'jr://audio/'],
  ['video', 'video', 'jr://video/'],
  ['bigImage', 'big-image', 'jr://images/'],
]

const hasAnyMedia = (media: MediaRefs | undefined): boolean =>
  media !== undefined && mediaForms.some(([key]) => {
    const text = media[key]
    return text !== undefined && Object.values(text).some((v) => hasText(v))
  })

interface Ctx {
  doc: FormDocument
  symbols: SymbolTable
  issues: Issue[]
  useItext: boolean
  /** Languages in itext order (default language first). */
  langs: Lang[]
  /** node id → absolute path */
  pathOf: (node: FormNode) => string
  /** Questions that some other node uses as a value-changed trigger source. */
  setvaluesByTrigger: Map<string, QuestionNode[]>
  /** Choice lists needing an internal secondary instance, in first-use order. */
  usedLists: ChoiceList[]
  /** External files (from *_from_file / csv-external), in first-use order. */
  externalInstances: Array<{ id: string, file: string }>
}

const rewrite = (ctx: Ctx, expr: string, contextPath: string | undefined, mode: RewriteMode, nodeId?: string): string => {
  const { result, issues } = rewriteToXPath(expr, {
    symbols: ctx.symbols,
    contextPath,
    mode,
    nodeId,
  })
  ctx.issues.push(...issues)
  return result
}

/** Text for a language with pyxform's '-' placeholder for missing entries. */
const textIn = (text: LocalizedText | undefined, lang: Lang): string | undefined => {
  if (text === undefined) return undefined
  return text[lang] ?? text[DEFAULT_LANG]
}

/** Converts ${refs} in display text into mixed content with <output/>. */
const outputify = (ctx: Ctx, text: string, contextPath: string | undefined): XmlChild[] => {
  const refs = findRefs(text)
  if (refs.length === 0) return [text]
  const out: XmlChild[] = []
  let cursor = 0
  for (const ref of refs) {
    if (ref.start > cursor) out.push(text.slice(cursor, ref.start))
    const value = rewrite(ctx, `\${${ref.name}}`, contextPath, 'output')
    out.push(el('output', { value }))
    cursor = ref.end
  }
  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

// --- itext -----------------------------------------------------------------

interface ItextEntry {
  id: string
  /** lang → children of <text> (values incl. media) */
  values: (lang: Lang) => XmlNode[]
}

const mediaValues = (media: MediaRefs | undefined, lang: Lang): XmlNode[] => {
  if (media === undefined) return []
  const out: XmlNode[] = []
  for (const [key, form, prefix] of mediaForms) {
    const file = textIn(media[key], lang)
    if (hasText(file)) out.push(el('value', { form }, `${prefix}${file}`))
  }
  return out
}

const buildItext = (ctx: Ctx): XmlNode | null => {
  if (!ctx.useItext) return null
  const entries: ItextEntry[] = []

  for (const list of ctx.usedLists) {
    list.choices.forEach((choice, i) => {
      entries.push({
        id: `${list.name}-${i}`,
        values: (lang) => [
          el('value', undefined, textIn(choice.label, lang) ?? '-'),
          ...mediaValues(choice.media, lang),
        ],
      })
    })
  }

  visit(ctx.doc.children, (node) => {
    const path = ctx.pathOf(node)
    const def = node.kind === 'question' ? getQuestionType(node.type) : undefined
    if (node.kind === 'question' && (def?.xform.bodyElement === null || def === undefined)) return undefined
    if (node.bind.constraintMessage !== undefined) {
      const msg = node.bind.constraintMessage
      entries.push({ id: `${path}:jr:constraintMsg`, values: (lang) => [el('value', undefined, textIn(msg, lang) ?? '-')] })
    }
    if (node.bind.requiredMessage !== undefined) {
      const msg = node.bind.requiredMessage
      entries.push({ id: `${path}:jr:requiredMsg`, values: (lang) => [el('value', undefined, textIn(msg, lang) ?? '-')] })
    }
    if (node.label !== undefined || hasAnyMedia(node.media)) {
      entries.push({
        id: `${path}:label`,
        values: (lang) => {
          const text = textIn(node.label, lang)
          const label = el('value', undefined, ...(text !== undefined ? outputify(ctx, text, path) : ['-']))
          return [label, ...mediaValues(node.media, lang)]
        },
      })
    }
    if (node.hint !== undefined || node.guidanceHint !== undefined) {
      entries.push({
        id: `${path}:hint`,
        values: (lang) => {
          const out: XmlNode[] = []
          const hint = textIn(node.hint, lang)
          out.push(el('value', undefined, ...(hint !== undefined ? outputify(ctx, hint, path) : ['-'])))
          const guidance = textIn(node.guidanceHint, lang)
          if (hasText(guidance)) out.push(el('value', { form: 'guidance' }, guidance))
          return out
        },
      })
    }
    return undefined
  })

  const translations = ctx.langs.map((lang, i) =>
    el(
      'translation',
      { lang, ...(i === 0 ? { default: 'true()' } : {}) },
      ...entries.map((entry) => el('text', { id: entry.id }, ...entry.values(lang)))
    )
  )
  return el('itext', undefined, ...translations)
}

// --- primary instance ------------------------------------------------------

const instanceNode = (ctx: Ctx, node: FormNode): XmlNode[] => {
  if (node.kind === 'question') {
    const def = getQuestionType(node.type)
    if (node.type === 'csv-external') return []
    if (def?.xform.inMeta) return [] // audit lives in <meta>
    const staticDefault = hasText(node.defaultValue) && !isDynamicDefault(node.defaultValue)
      ? [node.defaultValue]
      : []
    return [el(node.name, node.instanceAttrs, ...staticDefault)]
  }
  const children = node.children.flatMap((child) => instanceNode(ctx, child))
  if (node.kind === 'repeat') {
    // pyxform emits a jr:template copy plus one default instance.
    return [
      el(node.name, { ...node.instanceAttrs, 'jr:template': '' }, ...children.map(cloneXml)),
      el(node.name, node.instanceAttrs, ...children),
    ]
  }
  return [el(node.name, node.instanceAttrs, ...children)]
}

const cloneXml = (node: XmlChild): XmlChild =>
  typeof node === 'string' || 'raw' in (node as object)
    ? node
    : { ...(node as XmlNode), children: ((node as XmlNode).children ?? []).map(cloneXml) }

const buildMeta = (ctx: Ctx): XmlNode => {
  const children: XmlNode[] = []
  const entities = ctx.doc.entities
  if (entities !== undefined) {
    // pyxform 4.5.0: create/update are static "1" markers — conditional
    // expressions live in bind calculates on @create/@update (see the
    // entity binds in buildModelBindsAndActions).
    const attrs: Record<string, string> = { dataset: entities.datasetName }
    const creates = hasText(entities.createIf) || !hasText(entities.entityId)
    if (creates) attrs.create = '1'
    if (hasText(entities.entityId)) {
      attrs.update = '1'
      attrs.baseVersion = ''
      attrs.trunkVersion = ''
      attrs.branchId = ''
    }
    attrs.id = ''
    children.push(el('entity', attrs, ...(hasText(entities.label) ? [el('label')] : [])))
  }
  // audit (and any other in-meta questions)
  visit(ctx.doc.children, (node) => {
    if (node.kind === 'question' && getQuestionType(node.type)?.xform.inMeta) {
      children.push(el(node.name))
    }
    return undefined
  })
  children.push(el('instanceID'))
  if (hasText(ctx.doc.settings.instanceName)) children.push(el('instanceName'))
  return el('meta', undefined, ...children)
}

// --- binds ------------------------------------------------------------------

/** type → parameter → bind attribute (background-audio's quality lives on
 * the odk:recordaudio action instead, so it is deliberately absent). */
const BIND_PARAM_ATTRS: Record<string, Record<string, string>> = {
  image: { 'max-pixels': 'orx:max-pixels' },
  audio: { quality: 'odk:quality' },
}

const bindForNode = (ctx: Ctx, node: FormNode, def: QuestionTypeDefinition | undefined): XmlNode | null => {
  const path = ctx.pathOf(node)
  const attrs: Record<string, string> = { nodeset: path }

  if (node.kind === 'question' && def !== undefined) {
    let bindType = def.xform.bindType
    if (node.type === 'range') {
      const params = node.body.parameters ?? {}
      const decimal = [params.start, params.end, params.step].some((v) => v !== undefined && v.includes('.'))
      bindType = decimal ? 'decimal' : 'int'
    }
    if (bindType !== undefined) attrs.type = bindType
    if (def.xform.readonlyDefault) attrs.readonly = 'true()'
    if (def.xform.preload !== undefined) {
      attrs['jr:preload'] = def.xform.preload.preload
      if (def.xform.preload.preloadParams !== undefined) {
        attrs['jr:preloadParams'] = def.xform.preload.preloadParams
      }
    }
  }

  const bind = node.bind
  if (hasText(bind.readonly)) attrs.readonly = rewrite(ctx, bind.readonly, path, 'bind', node.id)
  if (hasText(bind.required)) {
    attrs.required = bind.required.trim() === 'yes' ? 'true()' : rewrite(ctx, bind.required, path, 'bind', node.id)
  }
  if (hasText(bind.relevant)) attrs.relevant = rewrite(ctx, bind.relevant, path, 'bind', node.id)
  if (hasText(bind.constraint)) attrs.constraint = rewrite(ctx, bind.constraint, path, 'bind', node.id)
  // calculation moves into a value-changed setvalue when a trigger is set
  if (hasText(bind.calculation) && !hasText(node.trigger)) {
    attrs.calculate = rewrite(ctx, bind.calculation, path, 'bind', node.id)
  }
  if (bind.constraintMessage !== undefined) {
    attrs['jr:constraintMsg'] = ctx.useItext
      ? `jr:itext('${path}:jr:constraintMsg')`
      : textIn(bind.constraintMessage, DEFAULT_LANG) ?? ''
  }
  if (bind.requiredMessage !== undefined) {
    attrs['jr:requiredMsg'] = ctx.useItext
      ? `jr:itext('${path}:jr:requiredMsg')`
      : textIn(bind.requiredMessage, DEFAULT_LANG) ?? ''
  }
  if (bind.saveIncomplete === true) attrs['odk:saveIncomplete'] = 'true()'
  if (node.kind === 'question' && hasText(node.saveTo)) attrs['entities:saveto'] = node.saveTo

  // Registry-mapped parameter attributes (image max-pixels, audio quality).
  if (node.kind === 'question' && node.body.parameters !== undefined) {
    const paramAttrs = BIND_PARAM_ATTRS[node.type]
    if (paramAttrs !== undefined) {
      for (const [key, value] of Object.entries(node.body.parameters)) {
        const attrName = paramAttrs[key]
        if (attrName !== undefined) attrs[attrName] = value
      }
    }
  }

  for (const [key, value] of Object.entries(bind.custom ?? {})) attrs[key] = value

  // Containers only get binds when they actually carry bind properties.
  const propCount = Object.keys(attrs).length
  if (node.kind !== 'question' && propCount <= 1) return null
  return el('bind', attrs)
}

const buildModelBindsAndActions = (ctx: Ctx): XmlNode[] => {
  const out: XmlNode[] = []
  visit(ctx.doc.children, (node) => {
    if (node.kind === 'question') {
      const def = getQuestionType(node.type)
      if (node.type === 'csv-external' || def?.xform.inMeta) return undefined
      const bind = bindForNode(ctx, node, def)
      if (bind !== null) out.push(bind)
      const path = ctx.pathOf(node)
      // model-level actions
      if (def?.xform.action === 'odk:setgeopoint') {
        out.push(el('odk:setgeopoint', { ref: path, event: 'odk-instance-first-load' }))
      } else if (def?.xform.action === 'odk:recordaudio') {
        const quality = node.body.parameters?.quality
        out.push(el('odk:recordaudio', {
          ref: path,
          event: 'odk-instance-load',
          ...(quality !== undefined ? { 'odk:quality': quality } : {}),
        }))
      }
      // dynamic defaults without a trigger load once at instance start
      if (hasText(node.defaultValue) && isDynamicDefault(node.defaultValue) && !hasText(node.trigger)) {
        out.push(el('setvalue', {
          ref: path,
          event: 'odk-instance-first-load',
          value: rewrite(ctx, node.defaultValue, path, 'bind', node.id),
        }))
      }
    } else {
      const bind = bindForNode(ctx, node, undefined)
      if (bind !== null) out.push(bind)
    }
    return undefined
  })

  // meta binds
  const root = `/${INSTANCE_ROOT}`
  const entities = ctx.doc.entities
  if (entities !== undefined) {
    // Bind order mirrors pyxform 4.5.0: @create, @update, @baseVersion,
    // @trunkVersion, @branchId, @id (+ create setvalue), label.
    if (hasText(entities.createIf)) {
      out.push(el('bind', {
        nodeset: `${root}/meta/entity/@create`,
        calculate: rewrite(ctx, entities.createIf, undefined, 'bind'),
        readonly: 'true()',
        type: 'string',
      }))
    }
    if (hasText(entities.entityId)) {
      const idExpr = rewrite(ctx, entities.entityId, undefined, 'bind')
      if (hasText(entities.updateIf)) {
        out.push(el('bind', {
          nodeset: `${root}/meta/entity/@update`,
          calculate: rewrite(ctx, entities.updateIf, undefined, 'bind'),
          readonly: 'true()',
          type: 'string',
        }))
      }
      // Offline-entities version pointers resolve against the entity list.
      const versionAttrs: Array<[string, string]> = [
        ['baseVersion', '__version'],
        ['trunkVersion', '__trunkVersion'],
        ['branchId', '__branchId'],
      ]
      for (const [attr, column] of versionAttrs) {
        out.push(el('bind', {
          nodeset: `${root}/meta/entity/@${attr}`,
          calculate: `instance('${entities.datasetName}')/root/item[name=${idExpr}]/${column}`,
          readonly: 'true()',
          type: 'string',
        }))
      }
      out.push(el('bind', { nodeset: `${root}/meta/entity/@id`, readonly: 'true()', type: 'string', calculate: idExpr }))
    } else {
      out.push(el('bind', { nodeset: `${root}/meta/entity/@id`, readonly: 'true()', type: 'string' }))
      out.push(el('setvalue', { ref: `${root}/meta/entity/@id`, event: 'odk-instance-first-load', value: 'uuid()' }))
    }
    if (hasText(entities.label)) {
      out.push(el('bind', {
        nodeset: `${root}/meta/entity/label`,
        calculate: rewrite(ctx, entities.label, undefined, 'bind'),
        readonly: 'true()',
        type: 'string',
      }))
    }
  }
  visit(ctx.doc.children, (node) => {
    if (node.kind === 'question' && getQuestionType(node.type)?.xform.inMeta) {
      const attrs: Record<string, string> = { nodeset: `${root}/meta/${node.name}`, type: 'binary' }
      for (const [key, value] of Object.entries(node.body.parameters ?? {})) {
        attrs[`odk:${key}`] = value
      }
      out.push(el('bind', attrs))
    }
    return undefined
  })
  out.push(el('bind', { nodeset: `${root}/meta/instanceID`, type: 'string', readonly: 'true()', 'jr:preload': 'uid' }))
  if (hasText(ctx.doc.settings.instanceName)) {
    out.push(el('bind', {
      nodeset: `${root}/meta/instanceName`,
      type: 'string',
      calculate: rewrite(ctx, ctx.doc.settings.instanceName, undefined, 'bind'),
    }))
  }
  return out
}

// --- body -------------------------------------------------------------------

const labelAndHint = (ctx: Ctx, node: FormNode): XmlNode[] => {
  const path = ctx.pathOf(node)
  const out: XmlNode[] = []
  if (node.label !== undefined || hasAnyMedia(node.media)) {
    if (ctx.useItext) {
      out.push(el('label', { ref: `jr:itext('${path}:label')` }))
    } else {
      const text = textIn(node.label, DEFAULT_LANG)
      if (text !== undefined) out.push(el('label', undefined, ...outputify(ctx, text, path)))
    }
  }
  if (node.hint !== undefined || node.guidanceHint !== undefined) {
    if (ctx.useItext) {
      out.push(el('hint', { ref: `jr:itext('${path}:hint')` }))
    } else {
      const text = textIn(node.hint, DEFAULT_LANG)
      if (text !== undefined) out.push(el('hint', undefined, ...outputify(ctx, text, path)))
    }
  }
  return out
}

const itemsetFor = (ctx: Ctx, node: QuestionNode): XmlNode => {
  const path = ctx.pathOf(node)
  const params = node.body.parameters ?? {}
  let instanceId: string
  let itextList = false
  if (node.itemsetFile !== undefined) {
    instanceId = node.itemsetFile.replace(/\.[^.]+$/, '')
  } else {
    instanceId = node.listRef ?? ''
    itextList = ctx.useItext
  }
  let nodeset = `instance('${instanceId}')/root/item`
  if (hasText(node.choiceFilter)) {
    nodeset += `[${rewrite(ctx, node.choiceFilter, path, 'itemset-predicate', node.id)}]`
  }
  if (params.randomize === 'true') {
    nodeset = params.seed !== undefined
      ? `randomize(${nodeset}, ${params.seed})`
      : `randomize(${nodeset})`
  }
  const valueRef = params.value ?? 'name'
  const labelRef = itextList ? 'jr:itext(itextId)' : (params.label ?? 'label')
  return el(
    'itemset',
    { nodeset },
    el('value', { ref: valueRef }),
    el('label', { ref: labelRef })
  )
}

const bodyForNode = (ctx: Ctx, node: FormNode): XmlNode[] => {
  const path = ctx.pathOf(node)

  if (node.kind === 'question') {
    const def = getQuestionType(node.type)
    if (def === undefined || def.xform.bodyElement === null || def.xform.bodyElement === undefined) return []
    const attrs: Record<string, string | undefined> = {
      ref: path,
      appearance: node.body.appearance,
      ...node.body.custom,
    }
    if (def.xform.bodyElement === 'upload') attrs.mediatype = def.xform.mediatype
    if (def.xform.bodyElement === 'range') {
      // web-forms requires start/end/step on every range; fall back to the
      // registry defaults so a range with unset bounds still loads instead of
      // throwing "Expected attribute start is not defined". validateStructure
      // warns the author separately when the required bounds are missing.
      const params = node.body.parameters ?? {}
      const bound = (name: string): string | undefined => {
        if (params[name] !== undefined) return params[name]
        const fallback = def.parameters?.find((p) => p.name === name)?.defaultValue
        return fallback === undefined ? undefined : String(fallback)
      }
      attrs.start = bound('start')
      attrs.end = bound('end')
      attrs.step = bound('step')
    }
    const children: XmlNode[] = [...labelAndHint(ctx, node)]
    if (def.xform.bodyElement === 'select1' || def.xform.bodyElement === 'select' || def.xform.bodyElement === 'odk:rank') {
      children.push(itemsetFor(ctx, node))
    }
    // value-changed setvalues whose trigger is this question
    for (const target of ctx.setvaluesByTrigger.get(node.id) ?? []) {
      const targetPath = ctx.pathOf(target)
      const valueExpr = target.bind.calculation ?? target.defaultValue ?? ''
      children.push(el('setvalue', {
        ref: targetPath,
        event: 'xforms-value-changed',
        ...(hasText(valueExpr) ? { value: rewrite(ctx, valueExpr, targetPath, 'bind', target.id) } : {}),
      }))
    }
    return [el(def.xform.bodyElement, attrs, ...children)]
  }

  const attrs: Record<string, string | undefined> = {
    appearance: node.body.appearance,
    ref: path,
    ...node.body.custom,
  }
  const childBodies = node.children.flatMap((child) => bodyForNode(ctx, child))

  if (node.kind === 'repeat') {
    const repeat = el(
      'repeat',
      {
        nodeset: path,
        ...(hasText(node.repeatCount)
          ? { 'jr:count': rewrite(ctx, node.repeatCount, path, 'bind', node.id) }
          : {}),
      },
      ...childBodies
    )
    const label = labelAndHint(ctx, node)
    if (label.length === 0) return [repeat]
    return [el('group', { ref: path }, ...label, repeat)]
  }

  return [el('group', attrs, ...labelAndHint(ctx, node), ...childBodies)]
}

// --- top level ---------------------------------------------------------------

export const serializeXForm = (doc: FormDocument): SerializeResult => {
  const issues: Issue[] = []
  const symbols = buildSymbolTable(doc)
  const index = buildNodeIndex(doc)
  const pathOf = (node: FormNode): string => index.byId.get(node.id)?.path ?? `/${INSTANCE_ROOT}/${node.name}`

  // Media/guidance force itext even without declared languages.
  let mediaOrGuidance = false
  visit(doc.children, (node) => {
    if (hasAnyMedia(node.media) || node.guidanceHint !== undefined) { mediaOrGuidance = true; return false }
    return undefined
  })
  const listsWithMedia = Object.values(doc.choiceLists)
    .some((list) => list.choices.some((c) => hasAnyMedia(c.media)))
  const useItext = doc.languages.length > 0 || mediaOrGuidance || listsWithMedia

  const langs: Lang[] = doc.languages.length > 0 ? [...doc.languages] : [DEFAULT_LANG]
  if (doc.settings.defaultLanguage !== undefined && langs.includes(doc.settings.defaultLanguage)) {
    langs.splice(langs.indexOf(doc.settings.defaultLanguage), 1)
    langs.unshift(doc.settings.defaultLanguage)
  }

  // Collect used choice lists / external instances / trigger targets.
  const usedListNames: string[] = []
  const externalInstances: Array<{ id: string, file: string }> = []
  const setvaluesByTrigger = new Map<string, QuestionNode[]>()
  visit(doc.children, (node) => {
    if (node.kind !== 'question') return undefined
    const itemsetFile = effectiveItemsetFile(node)
    if (itemsetFile !== undefined) {
      const id = itemsetFile.replace(/\.[^.]+$/, '')
      if (!externalInstances.some((e) => e.id === id)) {
        externalInstances.push({ id, file: itemsetFile })
      }
    } else if (node.listRef !== undefined && doc.choiceLists[node.listRef] !== undefined) {
      if (!usedListNames.includes(node.listRef)) usedListNames.push(node.listRef)
    }
    if (hasText(node.trigger)) {
      const refs = findRefs(node.trigger)
      const sourceName = refs[0]?.name
      const resolution = sourceName !== undefined ? symbols.resolve(sourceName) : { status: 'missing' as const }
      if (resolution.status === 'ok' && resolution.entry.node.kind === 'question') {
        const list = setvaluesByTrigger.get(resolution.entry.node.id) ?? []
        list.push(node)
        setvaluesByTrigger.set(resolution.entry.node.id, list)
      } else {
        issues.push({
          severity: 'error',
          code: 'expr.unknown-ref',
          message: `trigger references \${${sourceName ?? '?'}}, which does not resolve to a question.`,
          scope: { nodeId: node.id },
        })
      }
    }
    return undefined
  })

  const ctx: Ctx = {
    doc,
    symbols,
    issues,
    useItext,
    langs,
    pathOf,
    setvaluesByTrigger,
    usedLists: usedListNames.map((name) => doc.choiceLists[name]),
    externalInstances,
  }

  // model children
  const modelChildren: XmlChild[] = []
  if (hasText(doc.settings.submissionUrl) || hasText(doc.settings.publicKey)) {
    modelChildren.push(el('submission', {
      ...(hasText(doc.settings.submissionUrl) ? { action: doc.settings.submissionUrl } : {}),
      method: 'post',
      ...(hasText(doc.settings.publicKey) ? { base64RsaPublicKey: doc.settings.publicKey } : {}),
    }))
  }
  const itext = buildItext(ctx)
  if (itext !== null) modelChildren.push(itext)

  const primary = el(
    'instance',
    undefined,
    el(
      INSTANCE_ROOT,
      {
        id: doc.settings.formId ?? 'form',
        ...(hasText(doc.settings.version) ? { version: doc.settings.version } : {}),
      },
      ...doc.children.flatMap((node) => instanceNode(ctx, node)),
      buildMeta(ctx)
    )
  )
  modelChildren.push(primary)

  for (const external of ctx.externalInstances) {
    const ext = external.file.split('.').pop()?.toLowerCase()
    const scheme = ext === 'csv' ? 'jr://file-csv/' : 'jr://file/'
    modelChildren.push(el('instance', { id: external.id, src: `${scheme}${external.file}` }))
  }
  for (const list of ctx.usedLists) {
    modelChildren.push(el('instance', { id: list.name }, el('root', undefined,
      ...list.choices.map((choice, i) => el('item', undefined,
        ...(useItext ? [el('itextId', undefined, `${list.name}-${i}`)] : []),
        el('name', undefined, choice.name),
        ...(useItext ? [] : [el('label', undefined, textIn(choice.label, DEFAULT_LANG) ?? '')]),
        ...Object.entries(choice.extras ?? {}).map(([key, value]) => el(key, undefined, value))
      ))
    )))
  }

  modelChildren.push(...buildModelBindsAndActions(ctx))

  for (const fragment of doc.unknown?.xformFragments ?? []) {
    if (fragment.location === 'model') modelChildren.push({ raw: fragment.xml })
  }

  const model = el(
    'model',
    {
      'odk:xforms-version': '1.0.0',
      ...(doc.entities !== undefined ? { 'entities:entities-version': ENTITIES_VERSION } : {}),
    },
    ...modelChildren
  )

  const bodyChildren: XmlChild[] = doc.children.flatMap((node) => bodyForNode(ctx, node))
  for (const fragment of doc.unknown?.xformFragments ?? []) {
    if (fragment.location === 'body') bodyChildren.push({ raw: fragment.xml })
  }

  const html = el(
    'h:html',
    {
      ...NAMESPACES,
      ...(doc.entities !== undefined ? { 'xmlns:entities': ENTITIES_NS } : {}),
    },
    el('h:head', undefined, el('h:title', undefined, doc.settings.formTitle ?? 'Form'), model),
    el('h:body', hasText(doc.settings.style) ? { class: doc.settings.style } : undefined, ...bodyChildren)
  )

  return { xml: serializeXml(html), issues }
}
