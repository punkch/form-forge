import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw, watch } from 'vue'

import { datasetColumnsOf, datasetFormatOf } from '@/core/datasets/parse'
import { createNode } from '@/core/model/factory'
import {
  cloneSubtree,
  findNode,
  flatten,
  insertNode,
  locateNode,
  moveNode,
  removeNode,
} from '@/core/model/ops'
import { isContainer, type FormDocument, type FormNode } from '@/core/model/types'
import { scopeNodeId, validateDocument, type Issue } from '@/core/validate'
import { translate } from '@/i18n'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import * as formsRepo from '@/persistence/forms-repo'
import { requestPersistentStorage } from '@/pwa/persistentStorage'

export type SaveState = 'saved' | 'saving' | 'dirty' | 'error'

const AUTOSAVE_DEBOUNCE_MS = 1500
const VALIDATE_DEBOUNCE_MS = 300
const DATASET_REFRESH_DEBOUNCE_MS = 250
const UNDO_COALESCE_MS = 500
const UNDO_LIMIT = 100

interface UndoEntry {
  label: string
  doc: FormDocument
  at: number
}

/** The currently open form: document, mutations, undo/redo, autosave, issues. */
export const useFormStore = defineStore('form', () => {
  const recordId = ref<string | null>(null)
  const doc = ref<FormDocument | null>(null)
  const saveState = ref<SaveState>('saved')
  const issues = shallowRef<Issue[]>([])
  /**
   * Bumped on every content mutation (mutate/undo/redo) — a cheap, reliable
   * "the document changed" signal for watchers that can't rely on `doc`'s ref
   * identity (mutate edits it in place) or `saveState` (which stays 'dirty'
   * across a burst of edits and also flips on autosave lifecycle, not content).
   */
  const revision = ref(0)

  const undoStack = shallowRef<UndoEntry[]>([])
  const redoStack = shallowRef<UndoEntry[]>([])

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let validateTimer: ReturnType<typeof setTimeout> | null = null

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const undoLabel = computed(() => undoStack.value.at(-1)?.label ?? null)
  const errorCount = computed(() => issues.value.filter((i) => i.severity === 'error').length)
  const warningCount = computed(() => issues.value.filter((i) => i.severity === 'warning').length)

  const issuesByNode = computed(() => {
    const map = new Map<string, Issue[]>()
    for (const issue of issues.value) {
      const nodeId = scopeNodeId(issue.scope)
      if (nodeId !== undefined) {
        const list = map.get(nodeId)
        if (list === undefined) map.set(nodeId, [issue])
        else list.push(issue)
      }
    }
    return map
  })

  /**
   * Deep-clones the document while unwrapping every Vue reactive Proxy along
   * the way: `toRaw` alone only unwraps the outermost Proxy, so a nested
   * Proxy surviving inside e.g. `doc.attachments` (a mutate that
   * reads-then-writes an array through the reactive `doc` argument, rather
   * than assigning a fully plain value) used to make structuredClone throw
   * DataCloneError — poisoning every following autosave/mutate/undo/redo for
   * the rest of the session. Building fresh containers at every level makes
   * this both the snapshot's clone AND the defense-in-depth backstop for the
   * whole class of bug (see useAttachmentUpload's attachFile for the
   * mutate-shape rule that avoids introducing it in the first place) — no
   * structuredClone on top is needed, and skipping it halves the traversal
   * on this hot path (every mutate/undo/redo/autosave). FormDocument is
   * plain JSON-shaped data (no Blob/Map/etc, per the core model's own
   * invariant), so a generic object/array walk is safe.
   */
  const deepToRaw = <T>(value: T): T => {
    const raw = toRaw(value as object) as unknown
    if (Array.isArray(raw)) return raw.map((v) => deepToRaw(v)) as unknown as T
    if (raw !== null && typeof raw === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(raw)) out[k] = deepToRaw(v)
      return out as T
    }
    return raw as T
  }

  const snapshotDoc = (): FormDocument => deepToRaw(doc.value) as unknown as FormDocument

  // --- Dataset columns (csv/geojson attachments) --------------------------

  /** Parsed header columns per attachment id; null = stored but unparseable. */
  const datasetColumns = shallowRef<ReadonlyMap<string, readonly string[] | null>>(new Map())

  const datasetRefs = computed(() =>
    ((doc.value as FormDocument | null)?.attachments ?? [])
      .filter((a) => a.role === 'csv' || a.role === 'geojson')
      .map((a) => ({ id: a.id, filename: a.filename }))
  )

  /**
   * Columns keyed by the filename questions reference (what the validator and
   * the property panel consume). A filename is absent until its blob has been
   * parsed; null once parsing failed.
   */
  const datasetColumnsByFilename = computed<ReadonlyMap<string, readonly string[] | null>>(() => {
    const map = new Map<string, readonly string[] | null>()
    for (const ref of datasetRefs.value) {
      const columns = datasetColumns.value.get(ref.id)
      if (columns !== undefined) map.set(ref.filename, columns)
    }
    return map
  })

  const runValidation = (): void => {
    if (doc.value === null) return
    issues.value = validateDocument(doc.value as FormDocument, {
      datasetColumns: datasetColumnsByFilename.value,
    })
  }

  const scheduleValidation = (): void => {
    if (validateTimer !== null) clearTimeout(validateTimer)
    validateTimer = setTimeout(runValidation, VALIDATE_DEBOUNCE_MS)
  }

  /**
   * Async refresher for `datasetColumns`: loads blobs of csv/geojson
   * attachment refs, sniffs their header columns and re-runs validation with
   * the result. Cached per attachment id (a re-upload mints a new id, so
   * stale entries fall out naturally); debounced via the watcher below so it
   * stays out of the mutate hot path.
   */
  let datasetTimer: ReturnType<typeof setTimeout> | null = null
  let datasetGeneration = 0

  const refreshDatasetColumns = async (): Promise<void> => {
    const generation = ++datasetGeneration
    const next = new Map<string, readonly string[] | null>()
    for (const ref of datasetRefs.value) {
      const cached = datasetColumns.value.get(ref.id)
      if (cached !== undefined) {
        next.set(ref.id, cached)
        continue
      }
      try {
        const record = await attachmentsRepo.getAttachment(ref.id)
        let text: string | undefined
        if (record !== undefined) {
          // CSV columns live in the header row, so sniff a bounded prefix
          // instead of reading a possibly huge blob; GeoJSON needs the whole
          // file to parse valid JSON.
          const blob = datasetFormatOf(ref.filename) === 'csv'
            ? record.blob.slice(0, 65536)
            : record.blob
          text = await blob.text()
        }
        next.set(ref.id, text === undefined ? null : datasetColumnsOf(ref.filename, text))
      } catch {
        next.set(ref.id, null)
      }
    }
    if (generation !== datasetGeneration) return // superseded by a newer run
    datasetColumns.value = next
    runValidation()
  }

  watch(
    () => datasetRefs.value.map((ref) => `${ref.id}:${ref.filename}`).join('\n'),
    () => {
      if (datasetTimer !== null) clearTimeout(datasetTimer)
      datasetTimer = setTimeout(() => { void refreshDatasetColumns() }, DATASET_REFRESH_DEBOUNCE_MS)
    }
  )

  const flushSave = async (): Promise<void> => {
    if (recordId.value === null || doc.value === null) return
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
    saveState.value = 'saving'
    try {
      await formsRepo.saveForm(recordId.value, snapshotDoc())
      saveState.value = 'saved'
      void requestPersistentStorage() // one-shot durable-storage request (src/pwa/persistentStorage.ts)
    } catch (error) {
      console.error('Autosave failed', error)
      saveState.value = 'error'
    }
  }

  const scheduleSave = (): void => {
    saveState.value = 'dirty'
    if (autosaveTimer !== null) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => { void flushSave() }, AUTOSAVE_DEBOUNCE_MS)
  }

  const load = async (id: string): Promise<boolean> => {
    const record = await formsRepo.getForm(id)
    if (record === undefined) return false
    recordId.value = id
    doc.value = structuredClone(record.doc)
    undoStack.value = []
    redoStack.value = []
    saveState.value = 'saved'
    // Validate before the awaited snapshot write: the preview store's
    // watchers flush during that await and must see this form's issues,
    // not the previous form's.
    runValidation()
    await formsRepo.addSnapshot(id, record.doc, 'open')
    return true
  }

  const close = async (): Promise<void> => {
    await flushSave()
    // Closing discards undo history, so superseded/removed attachments can no
    // longer be restored — reclaim any blob the current doc no longer refs.
    if (recordId.value !== null && doc.value !== null) {
      const referenced = new Set((doc.value as FormDocument).attachments.map((a) => a.id))
      try {
        await attachmentsRepo.pruneOrphans(recordId.value, referenced)
      } catch (error) {
        console.error('Failed to prune orphaned attachments', error)
      }
    }
    recordId.value = null
    doc.value = null
    undoStack.value = []
    redoStack.value = []
    issues.value = []
  }

  /**
   * Every attachment id still reachable from the current document OR any
   * undo/redo history entry — wider than close()'s protected set, which only
   * needs the current document since undo history is discarded right after.
   * A record referenced only by a redo entry stays protected until that
   * entry itself is discarded (by a fresh mutate clearing redoStack, or by
   * falling off the undo limit).
   */
  const protectedAttachmentIds = (): Set<string> => {
    const ids = new Set<string>()
    const collect = (d: FormDocument | null): void => { d?.attachments.forEach((a) => ids.add(a.id)) }
    collect(doc.value as FormDocument | null)
    for (const entry of undoStack.value) collect(entry.doc)
    for (const entry of redoStack.value) collect(entry.doc)
    return ids
  }

  /**
   * Sweeps attachment blobs unreferenced by the current document or any
   * undo/redo history entry. Called when the Attachments dialog opens (in
   * addition to close()'s narrower sweep, which runs once undo history is
   * discarded) so replaced/removed files don't accumulate indefinitely
   * across a long editing session, without evicting anything still
   * reachable via undo/redo.
   */
  const sweepOrphanAttachments = async (): Promise<void> => {
    if (recordId.value === null) return
    try {
      await attachmentsRepo.pruneOrphans(recordId.value, protectedAttachmentIds())
    } catch (error) {
      console.error('Failed to prune orphaned attachments', error)
    }
  }

  /**
   * Single mutation gateway: snapshots for undo, applies the mutation,
   * schedules autosave + validation. Coalescing (rapid same-label edits
   * collapse into one undo entry) is opt-in — right for typing bursts,
   * wrong for structural moves.
   */
  const mutate = (label: string, fn: (doc: FormDocument) => void, opts: { coalesce?: boolean } = {}): void => {
    if (doc.value === null) return
    const now = Date.now()
    const last = undoStack.value.at(-1)
    const coalesce = opts.coalesce === true &&
      last !== undefined && last.label === label && now - last.at < UNDO_COALESCE_MS
    if (!coalesce) {
      undoStack.value = [
        ...undoStack.value.slice(-(UNDO_LIMIT - 1)),
        { label, doc: snapshotDoc(), at: now },
      ]
    } else if (last !== undefined) {
      last.at = now
    }
    redoStack.value = []
    fn(doc.value as FormDocument)
    revision.value++
    scheduleSave()
    scheduleValidation()
  }

  const undo = (): void => {
    const entry = undoStack.value.at(-1)
    if (entry === undefined || doc.value === null) return
    undoStack.value = undoStack.value.slice(0, -1)
    redoStack.value = [...redoStack.value, { label: entry.label, doc: snapshotDoc(), at: Date.now() }]
    doc.value = entry.doc
    revision.value++
    scheduleSave()
    scheduleValidation()
  }

  const redo = (): void => {
    const entry = redoStack.value.at(-1)
    if (entry === undefined || doc.value === null) return
    redoStack.value = redoStack.value.slice(0, -1)
    undoStack.value = [...undoStack.value, { label: entry.label, doc: snapshotDoc(), at: Date.now() }]
    doc.value = entry.doc
    revision.value++
    scheduleSave()
    scheduleValidation()
  }

  /**
   * Drag-and-drop support: vue-draggable-plus mutates the reactive children
   * arrays in place, so a drag can't go through mutate(). beginTransaction()
   * snapshots for undo before the drag; endTransaction() marks
   * dirty/validates after it.
   */
  const beginTransaction = (label: string): void => {
    if (doc.value === null) return
    undoStack.value = [
      ...undoStack.value.slice(-(UNDO_LIMIT - 1)),
      { label, doc: snapshotDoc(), at: Date.now() },
    ]
    redoStack.value = []
  }

  const endTransaction = (): void => {
    // Cancelled drags leave the doc untouched — drop the useless undo entry.
    const last = undoStack.value.at(-1)
    if (last !== undefined && doc.value !== null &&
      JSON.stringify(last.doc) === JSON.stringify(toRaw(doc.value))) {
      undoStack.value = undoStack.value.slice(0, -1)
      return
    }
    scheduleSave()
    scheduleValidation()
  }

  // --- Domain actions (all undoable) -------------------------------------

  const addNode = (type: string, parentId: string | null, index?: number): string | null => {
    let newNodeId: string | null = null
    mutate(translate('stores.form.undoAddQuestion'), (d) => {
      const node = createNode(d, type)
      if (insertNode(d, node, parentId, index)) newNodeId = node.id
    })
    return newNodeId
  }

  const removeNodeById = (id: string): void => {
    mutate(translate('stores.form.undoDeleteQuestion'), (d) => { removeNode(d, id) })
  }

  const duplicateNodeById = (id: string): string | null => {
    let newNodeId: string | null = null
    mutate(translate('stores.form.undoDuplicateQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null) return
      const clone = cloneSubtree(d, loc.node)
      insertNode(d, clone, loc.parent?.id ?? null, loc.index + 1)
      newNodeId = clone.id
    })
    return newNodeId
  }

  const moveNodeTo = (id: string, parentId: string | null, index: number): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => { moveNode(d, id, parentId, index) })
  }

  /** Move within the current sibling list by delta (-1 up, +1 down). */
  const moveBy = (id: string, delta: number): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null) return
      const siblings = loc.parent === null ? d.children : loc.parent.children
      const target = loc.index + delta
      if (target < 0 || target >= siblings.length) return
      // moveNode compensates for forward moves; pass the visual index.
      moveNode(d, id, loc.parent?.id ?? null, delta > 0 ? target + 1 : target)
    })
  }

  /** Move into the previous sibling when it is a group/repeat (append). */
  const indent = (id: string): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null || loc.index === 0) return
      const siblings = loc.parent === null ? d.children : loc.parent.children
      const previous = siblings[loc.index - 1]
      if (!isContainer(previous)) return
      moveNode(d, id, previous.id, previous.children.length)
    })
  }

  /** Move out of the parent container, placed right after it. */
  const outdent = (id: string): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null || loc.parent === null) return
      const parentLoc = locateNode(d, loc.parent.id)
      if (parentLoc === null) return
      moveNode(d, id, parentLoc.parent?.id ?? null, parentLoc.index + 1)
    })
  }

  /** Generic field edit; `label` drives undo coalescing per property. */
  const updateNode = (id: string, label: string, fn: (node: FormNode, doc: FormDocument) => void): void => {
    mutate(label, (d) => {
      const node = findNode(d, id)
      if (node !== null) fn(node, d)
    }, { coalesce: true })
  }

  const getNode = (id: string | null): FormNode | null =>
    id === null || doc.value === null ? null : findNode(doc.value as FormDocument, id)

  /** All field names, for ${} autocomplete. */
  const fieldNames = computed<string[]>(() => {
    if (doc.value === null) return []
    return flatten((doc.value as FormDocument).children).map((n) => n.name)
  })

  return {
    recordId,
    doc,
    saveState,
    revision,
    issues,
    issuesByNode,
    datasetColumnsByFilename,
    errorCount,
    warningCount,
    canUndo,
    canRedo,
    undoLabel,
    fieldNames,
    load,
    close,
    sweepOrphanAttachments,
    mutate,
    undo,
    redo,
    flushSave,
    beginTransaction,
    endTransaction,
    addNode,
    removeNodeById,
    duplicateNodeById,
    moveNodeTo,
    moveBy,
    indent,
    outdent,
    updateNode,
    getNode,
  }
})
