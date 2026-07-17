<script setup lang="ts">
// Per-node "Label media" block: one row per MEDIA_KIND that already carries
// a value in at least one language, plus an "Add label media" menu for the
// kinds that don't yet. Lives under the label area of the properties panel
// (mounted from BasicSection) for every node kind — media is a BaseNode
// field, so groups and repeats get it too, not just questions.
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import { computed, ref, useTemplateRef } from 'vue'

import AttachmentConflictDialog from '@/components/attachments/AttachmentConflictDialog.vue'
import HelpPopover from '@/components/help/HelpPopover.vue'
import AttachmentPicker from '@/components/properties/AttachmentPicker.vue'
import { addableMediaSlots, mediaRowsFor, useMediaAttachment, visibleMediaSlots } from '@/composables/useMediaAttachment'
import { langsOf, type MediaSlot, type TranslationSiteRef } from '@/core/model/translations'
import type { FormNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const { t } = useAppI18n()
const form = useFormStore()
const { conflictFile, resolveConflict, attachedFilenames, kindLabel, pickMediaRef, uploadMediaRef } = useMediaAttachment()

const addPopover = useTemplateRef<InstanceType<typeof Popover>>('addPopover')

/** Kinds explicitly added this session that don't carry a value yet — kept
 * visible so the just-added row has somewhere to pick/upload into, even
 * though `visibleMediaSlots` alone wouldn't show it. Resets when the node
 * changes. */
const activatedSlots = ref<Set<MediaSlot>>(new Set())

const visibleSlots = computed<MediaSlot[]>(() => visibleMediaSlots(props.node.media, activatedSlots.value))

const addableSlots = computed<MediaSlot[]>(() => addableMediaSlots(visibleSlots.value))

const rows = computed(() =>
  mediaRowsFor(props.node.media, visibleSlots.value, form.doc !== null ? langsOf(form.doc) : [], attachedFilenames.value)
)

type NodeMediaRef = Extract<TranslationSiteRef, { kind: 'node-media' }>

const refFor = (slot: MediaSlot): NodeMediaRef => ({ kind: 'node-media', nodeId: props.node.id, slot })

const pick = (slot: MediaSlot, filename: string | null): void => {
  pickMediaRef(refFor(slot), filename, t('properties.media.undoPickMedia', { kind: kindLabel(slot) }))
}

const upload = async (slot: MediaSlot, file: File): Promise<void> => {
  await uploadMediaRef(refFor(slot), file, t('properties.media.undoUploadMedia', { kind: kindLabel(slot) }))
}

const toggleAddMenu = (event: Event): void => { addPopover.value?.toggle(event) }

const addKind = (slot: MediaSlot): void => {
  activatedSlots.value = new Set(activatedSlots.value).add(slot)
  addPopover.value?.hide()
}
</script>

<template>
  <div class="label-media-section" data-testid="prop-media-section">
    <span class="label-media-title">{{ t('properties.media.sectionTitle') }}<HelpPopover field="labelMedia" /></span>

    <div v-for="row in rows" :key="row.slot" class="label-media-row">
      <span class="label-media-kind">{{ kindLabel(row.slot) }}</span>
      <AttachmentPicker
        :filename="row.filename"
        :kind="row.slot"
        :missing="row.missing"
        :varies="row.varies"
        :testid-prefix="`prop-media-${row.slot}`"
        @pick="pick(row.slot, $event)"
        @upload="upload(row.slot, $event)"
      />
    </div>

    <div class="label-media-add">
      <Button
        :label="t('properties.media.addMedia')"
        icon="pi pi-plus"
        severity="secondary"
        text
        size="small"
        data-testid="prop-media-add"
        @click="toggleAddMenu"
      />
      <Popover ref="addPopover">
        <div class="label-media-add-menu" data-testid="prop-media-add-menu">
          <p v-if="addableSlots.length === 0" class="label-media-add-empty">
            {{ t('properties.media.addMediaEmpty') }}
          </p>
          <button
            v-for="slot in addableSlots"
            :key="slot"
            type="button"
            class="label-media-add-item"
            :data-testid="`prop-media-add-${slot}`"
            @click="addKind(slot)"
          >
            {{ kindLabel(slot) }}
          </button>
        </div>
      </Popover>
    </div>

    <AttachmentConflictDialog :file="conflictFile" :remaining="0" @resolve="resolveConflict" />
  </div>
</template>

<style scoped>
@import './prop-section.css';

.label-media-section {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.label-media-title {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.label-media-row {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
}

.label-media-kind {
  font-weight: 500;
  font-size: var(--odk-hint-font-size);
}

.label-media-add {
  display: flex;
}

.label-media-add-menu {
  display: flex;
  flex-direction: column;
  min-width: 10rem;
}

.label-media-add-item {
  border: none;
  background: none;
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  text-align: start;
  font: inherit;
  color: var(--odk-text-color);
  cursor: pointer;
  border-radius: var(--odk-radius);
}

.label-media-add-item:hover {
  background: var(--odk-muted-background-color);
}

.label-media-add-empty {
  margin: 0;
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}
</style>
