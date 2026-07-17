<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import { computed, ref, useTemplateRef } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import AttachmentConflictDialog from '@/components/attachments/AttachmentConflictDialog.vue'
import CascadeEditor from '@/components/choices/CascadeEditor.vue'
import GuideTrigger from '@/components/help/GuideTrigger.vue'
import HelpPopover from '@/components/help/HelpPopover.vue'
import AttachmentPicker from '@/components/properties/AttachmentPicker.vue'
import LocalizedInput from '@/components/properties/LocalizedInput.vue'
import { addableMediaSlots, mediaRowsFor, useMediaAttachment, visibleMediaSlots } from '@/composables/useMediaAttachment'
import { setText } from '@/core/model/display'
import { newChoiceList } from '@/core/model/factory'
import { flatten } from '@/core/model/ops'
import { langsOf, type MediaSlot, type TranslationSiteRef } from '@/core/model/translations'
import type { Choice, ChoiceList, FormDocument, Lang, QuestionNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: QuestionNode }>()

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()
const { conflictFile, resolveConflict, attachedFilenames, kindLabel, pickMediaRef, uploadMediaRef } = useMediaAttachment()

const list = computed(() =>
  props.node.listRef !== undefined ? form.doc?.choiceLists[props.node.listRef] : undefined
)

const listOptions = computed(() =>
  Object.keys(form.doc?.choiceLists ?? {}).map((name) => ({ name }))
)

const usedByCount = computed(() => {
  if (form.doc === null || props.node.listRef === undefined) return 0
  return flatten(form.doc.children as FormDocument['children'])
    .filter((n) => n.kind === 'question' && n.listRef === props.node.listRef)
    .length
})

const bindList = (name: string | null): void => {
  form.updateNode(props.node.id, t('properties.choices.undoChangeList'), (n) => {
    if (n.kind === 'question') n.listRef = name ?? undefined
  })
}

const createList = (): void => {
  form.mutate(t('properties.choices.undoNewList'), (d) => {
    const created = newChoiceList(d)
    const live = flatten(d.children).find((n) => n.id === props.node.id)
    if (live !== undefined && live.kind === 'question') live.listRef = created.name
  })
}

const editChoices = (fn: (list: ChoiceList) => void): void => {
  form.mutate(t('properties.choices.undoEditChoices'), (d) => {
    const listName = props.node.listRef
    if (listName === undefined) return
    const target = d.choiceLists[listName]
    if (target !== undefined) fn(target)
  }, { coalesce: true })
}

const setChoiceName = (index: number, value: string): void => {
  editChoices((l) => { l.choices[index].name = value })
}

// Writes the language the input displayed (LocalizedInput emits it).
const setChoiceLabel = (index: number, value: string, lang: Lang): void => {
  editChoices((l) => { l.choices[index].label = setText(l.choices[index].label, value, lang) })
}

const addChoice = (): void => {
  editChoices((l) => {
    l.choices.push({ name: `option_${l.choices.length + 1}`, label: {} })
  })
}

const removeChoice = (index: number): void => {
  closeMediaPopover()
  editChoices((l) => { l.choices.splice(index, 1) })
}

// Drag reorder goes through the same mutate() path as any choice edit, so a
// single undo restores the previous order.
const reorderChoices = (value: Choice[]): void => {
  closeMediaPopover()
  editChoices((l) => { l.choices.splice(0, l.choices.length, ...value) })
}

// --- per-choice media (picture-select etc.) --------------------------------
// One popover shared across every choice row: only one can be open (and
// mid-upload) at a time, so a single conflict-dialog/activated-kinds seam is
// enough — no need for one instance per row.

const mediaPopover = useTemplateRef<InstanceType<typeof Popover>>('mediaPopover')
const activeChoiceIndex = ref<number | null>(null)
/** Kinds explicitly added (this session) for a choice that don't carry a
 * value yet, keyed by choice index — mirrors LabelMediaSection's
 * activatedSlots, per row instead of per node. */
const activatedByChoice = ref<Map<number, Set<MediaSlot>>>(new Map())

/** Per-row has-media / has-missing-filename flags for the choice list's
 * media buttons — memoized against the choice array + attachments instead of
 * rescanning every slot on every render of every row. */
const choiceMediaFlags = computed(() => {
  const langs = form.doc !== null ? langsOf(form.doc) : []
  return (list.value?.choices ?? []).map((choice) => {
    const setSlots = visibleMediaSlots(choice.media, new Set())
    return {
      has: setSlots.length > 0,
      missing: mediaRowsFor(choice.media, setSlots, langs, attachedFilenames.value).some((row) => row.missing),
    }
  })
})

const activeChoice = computed<Choice | null>(() => {
  if (activeChoiceIndex.value === null) return null
  return list.value?.choices[activeChoiceIndex.value] ?? null
})

const activeVisibleSlots = computed<MediaSlot[]>(() => {
  const choice = activeChoice.value
  if (choice === null || activeChoiceIndex.value === null) return []
  const activated = activatedByChoice.value.get(activeChoiceIndex.value) ?? new Set<MediaSlot>()
  return visibleMediaSlots(choice.media, activated)
})

const activeAddableSlots = computed<MediaSlot[]>(() => addableMediaSlots(activeVisibleSlots.value))

const activeRows = computed(() => {
  const choice = activeChoice.value
  if (choice === null) return []
  return mediaRowsFor(choice.media, activeVisibleSlots.value, form.doc !== null ? langsOf(form.doc) : [], attachedFilenames.value)
})

type ChoiceMediaRef = Extract<TranslationSiteRef, { kind: 'choice-media' }>

const activeRef = (slot: MediaSlot): ChoiceMediaRef | null => {
  if (list.value === undefined || activeChoiceIndex.value === null) return null
  return { kind: 'choice-media', listName: list.value.name, choiceIndex: activeChoiceIndex.value, slot }
}

const openMediaPopover = (event: Event, index: number): void => {
  activeChoiceIndex.value = index
  mediaPopover.value?.toggle(event)
}

/** The popover targets a choice by POSITION (activeChoiceIndex): a remove or
 * reorder while it is open would silently retarget it to whichever choice
 * shifts into that index, so structural edits close it first, and @hide
 * clears the index so a stale one can never be reused. */
const closeMediaPopover = (): void => {
  mediaPopover.value?.hide()
  activeChoiceIndex.value = null
  // Also index-keyed, so the same shift would hand one choice's "just
  // activated, still empty" slots to whichever choice lands on its index.
  activatedByChoice.value = new Map()
}

const addActiveKind = (slot: MediaSlot): void => {
  if (activeChoiceIndex.value === null) return
  const next = new Map(activatedByChoice.value)
  next.set(activeChoiceIndex.value, new Set(next.get(activeChoiceIndex.value)).add(slot))
  activatedByChoice.value = next
}

const pickActive = (slot: MediaSlot, filename: string | null): void => {
  const site = activeRef(slot)
  if (site === null) return
  pickMediaRef(site, filename, t('properties.media.undoPickMedia', { kind: kindLabel(slot) }))
}

const uploadActive = async (slot: MediaSlot, file: File): Promise<void> => {
  const site = activeRef(slot)
  if (site === null) return
  await uploadMediaRef(site, file, t('properties.media.undoUploadMedia', { kind: kindLabel(slot) }))
}
</script>

<template>
  <section class="prop-section">
    <!--
      Guide entry point for the external-datasets workflow (CSV/GeoJSON-driven
      choices). Kept outside the field <label> below: a real <button> placed
      inside it would become the label's implicit control (see HelpPopover).
    -->
    <div class="choices-guide">
      <GuideTrigger guide="datasets" label="guides.ui.learnMore" />
    </div>

    <label class="prop-field">
      <span>{{ t('properties.choices.listLabel') }} <template v-if="usedByCount > 1">{{ t('properties.choices.usedBySuffix', { count: usedByCount }) }}</template><HelpPopover field="choiceList" /></span>
      <div class="list-binding">
        <Select
          :model-value="node.listRef ?? null"
          :options="listOptions"
          option-label="name"
          option-value="name"
          :placeholder="t('properties.choices.selectListPlaceholder')"
          class="list-select"
          data-testid="prop-choice-list"
          @update:model-value="bindList"
        />
        <Button
          v-tooltip.left="t('properties.choices.newList')"
          icon="pi pi-plus"
          severity="secondary"
          :aria-label="t('properties.choices.newList')"
          @click="createList"
        />
        <Button
          v-tooltip.left="t('properties.choices.manageLists')"
          icon="pi pi-cog"
          severity="secondary"
          :aria-label="t('properties.choices.manageLists')"
          data-testid="open-choice-lists"
          @click="editor.activeDialog = 'choice-lists'"
        />
      </div>
    </label>

    <div v-if="list" class="choices-editor" data-testid="choices-editor">
      <VueDraggable
        :model-value="list.choices"
        group="choices"
        :sort="true"
        :animation="150"
        handle=".choice-drag"
        ghost-class="choice-ghost"
        class="choice-rows"
        @update:model-value="reorderChoices"
      >
        <div v-for="(choice, i) in list.choices" :key="i" class="choice-row">
          <i class="pi pi-bars choice-drag" aria-hidden="true" />
          <InputText
            :model-value="choice.name"
            :placeholder="t('properties.choices.valuePlaceholder')"
            class="choice-name"
            :data-testid="`choice-name-${i}`"
            @update:model-value="setChoiceName(i, $event ?? '')"
          />
          <LocalizedInput
            :value="choice.label"
            :placeholder="t('properties.choices.labelPlaceholder')"
            class="choice-label"
            :data-testid="`choice-label-${i}`"
            @edit="(value, lang) => setChoiceLabel(i, value, lang)"
          />
          <Button
            severity="secondary"
            text
            rounded
            size="small"
            class="choice-media-button"
            :class="{ 'choice-media-button-set': choiceMediaFlags[i]?.has }"
            :aria-label="t('properties.media.choiceButtonAria')"
            :data-testid="`choice-media-${i}`"
            @click="openMediaPopover($event, i)"
          >
            <i class="pi pi-image" />
            <i
              v-if="choiceMediaFlags[i]?.missing"
              class="pi pi-circle-fill choice-media-warning-dot"
              :data-testid="`choice-media-missing-${i}`"
            />
          </Button>
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            :aria-label="t('properties.choices.removeChoice')"
            @click="removeChoice(i)"
          />
        </div>
      </VueDraggable>
      <Button
        :label="t('properties.choices.addChoice')"
        icon="pi pi-plus"
        severity="secondary"
        text
        size="small"
        data-testid="add-choice"
        @click="addChoice"
      />
      <small v-if="usedByCount > 1" class="shared-warning">
        {{ t('properties.choices.sharedWarning', usedByCount - 1) }}
      </small>

      <CascadeEditor :node="node" />
    </div>

    <Popover ref="mediaPopover" @hide="activeChoiceIndex = null">
      <div class="choice-media-popover" data-testid="choice-media-popover">
        <div v-for="row in activeRows" :key="row.slot" class="choice-media-row">
          <span class="choice-media-kind">{{ kindLabel(row.slot) }}</span>
          <AttachmentPicker
            :filename="row.filename"
            :kind="row.slot"
            :missing="row.missing"
            :varies="row.varies"
            :testid-prefix="`choice-media-${activeChoiceIndex}-${row.slot}`"
            @pick="pickActive(row.slot, $event)"
            @upload="uploadActive(row.slot, $event)"
          />
        </div>
        <div v-if="activeAddableSlots.length > 0" class="choice-media-add-row">
          <span class="choice-media-add-label">{{ t('properties.media.choiceAddMedia') }}</span>
          <button
            v-for="slot in activeAddableSlots"
            :key="slot"
            type="button"
            class="choice-media-add-chip"
            :data-testid="`choice-media-add-${activeChoiceIndex}-${slot}`"
            @click="addActiveKind(slot)"
          >
            {{ kindLabel(slot) }}
          </button>
        </div>
      </div>
    </Popover>

    <AttachmentConflictDialog :file="conflictFile" :remaining="0" @resolve="resolveConflict" />
  </section>
</template>

<style scoped>
@import './prop-section.css';

.choices-guide {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: var(--odk-spacing-s);
}

.list-binding {
  display: flex;
  gap: var(--odk-spacing-s);
}

.list-select {
  flex: 1;
}

.choices-editor {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.choice-rows {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.choice-row {
  display: grid;
  grid-template-columns: auto minmax(96px, 2fr) 3fr auto auto;
  gap: var(--odk-spacing-s);
  align-items: center;
  animation: choice-row-in var(--builder-motion-duration-s) var(--builder-motion-ease-enter);
}

@keyframes choice-row-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}

.choice-media-button {
  position: relative;
}

.choice-media-button-set {
  color: var(--odk-primary-text-color);
}

.choice-media-warning-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 0.5rem;
  color: var(--odk-warning-text-color);
}

.choice-media-popover {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  min-width: 16rem;
}

.choice-media-row {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.choice-media-kind {
  font-weight: 500;
  font-size: var(--odk-hint-font-size);
}

.choice-media-add-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.choice-media-add-label {
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.choice-media-add-chip {
  border: 1px solid var(--odk-border-color);
  border-radius: 999px;
  background: none;
  padding: 2px var(--odk-spacing-m);
  font: inherit;
  font-size: 0.75rem;
  color: var(--odk-text-color);
  cursor: pointer;
}

.choice-media-add-chip:hover {
  border-color: var(--odk-primary-border-color);
  color: var(--odk-primary-text-color);
}

.choice-drag {
  cursor: grab;
  color: var(--odk-light-muted-text-color);
  font-size: 0.75rem;
  touch-action: none;
}

.choice-name {
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
}

.choice-label {
  min-width: 0;
}

.choice-rows :deep(.choice-ghost) {
  opacity: 0.5;
}

.shared-warning {
  color: var(--odk-warning-text-color);
  font-size: 0.75rem;
}
</style>
