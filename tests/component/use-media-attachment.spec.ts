import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import {
  sanitizeAttachmentFilename,
  useMediaAttachment,
  type MediaConflictAction,
  type MediaUploadResult,
  type UseMediaAttachment,
} from '@/composables/useMediaAttachment'
import { newDocument } from '@/core/model/factory'
import { langsOf, mediaSlotState, setSiteText, type TranslationSiteRef } from '@/core/model/translations'
import { DEFAULT_LANG, type FormNode } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async () => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

const EN = 'English (en)'
const FR = 'French (fr)'
const ES = 'Spanish (es)'

// Refs returned from setup() auto-unwrap on the public instance (wrapper.vm),
// so a mounted Host exposes UseMediaAttachment's Ref<File|null> as a plain
// File|null — this is that unwrapped shape, not UseMediaAttachment itself.
interface HostExposed {
  conflictFile: File | null
  resolveConflict: (payload: { action: MediaConflictAction }) => void
  pickMediaRef: UseMediaAttachment['pickMediaRef']
  uploadMediaRef: (site: TranslationSiteRef, file: File, undoLabel: string) => Promise<MediaUploadResult | null>
}

// A render-nothing host so useMediaAttachment (a Vue composable — it calls
// useAppI18n internally) can be exercised directly, the same way its real
// parents (LabelMediaSection, ChoicesSection, BasicSection) wire it up.
const Host = defineComponent({
  setup: () => useMediaAttachment(),
  render: () => null,
})

describe('useMediaAttachment', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    repo.addAttachment.mockReset()
    repo.addAttachment.mockImplementation(
      async (formRecordId: string, filename: string, blob: Blob) => ({
        id: `rec-${filename}`,
        formRecordId,
        filename,
        mediatype: blob.type || 'application/octet-stream',
        size: blob.size,
        blob,
      })
    )
  })

  /** Fresh document + one text node, optionally with declared languages
   * (first becomes settings.defaultLanguage, matching addLanguage's rule). */
  const setupDoc = (languages: string[] = []): FormNode => {
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
    if (languages.length > 0) {
      form.doc.languages.push(...languages)
      form.doc.settings.defaultLanguage = languages[0]
    }
    const id = form.addNode('text', null) as string
    return form.getNode(id) as FormNode
  }

  const imageRef = (nodeId: string): TranslationSiteRef => ({ kind: 'node-media', nodeId, slot: 'image' })

  const mountHost = (): { wrapper: VueWrapper, vm: HostExposed } => {
    const wrapper = mountWith(pinia, Host)
    return { wrapper, vm: wrapper.vm as unknown as HostExposed }
  }

  describe('upload conflict resolution', () => {
    const seedExistingPic = (): FormNode => {
      const node = setupDoc()
      const form = useFormStore()
      form.doc!.attachments.push({ id: 'a1', filename: 'pic.png', mediatype: 'image/png', size: 10, role: 'media' })
      return node
    }

    it('replace stores under the same filename and updates the slot', async () => {
      const node = seedExistingPic()
      const form = useFormStore()
      const { vm } = mountHost()

      const resultPromise = vm.uploadMediaRef(imageRef(node.id), new File(['x'], 'pic.png', { type: 'image/png' }), 'upload')
      expect(vm.conflictFile?.name).toBe('pic.png')
      vm.resolveConflict({ action: 'replace' })
      const result = await resultPromise

      expect(result).toEqual({ storedAs: 'pic.png', renamedFrom: undefined })
      expect(form.doc!.attachments.filter((a) => a.filename === 'pic.png')).toHaveLength(1)
      expect((form.getNode(node.id) as FormNode).media?.image).toEqual({ [DEFAULT_LANG]: 'pic.png' })
    })

    it('keep-both stores under a firstFreeAttachmentName-suffixed filename and puts THAT name in the slot', async () => {
      const node = seedExistingPic()
      const form = useFormStore()
      const { vm } = mountHost()

      const resultPromise = vm.uploadMediaRef(imageRef(node.id), new File(['x'], 'pic.png', { type: 'image/png' }), 'upload')
      vm.resolveConflict({ action: 'keep-both' })
      const result = await resultPromise

      expect(result).toEqual({ storedAs: 'pic-2.png', renamedFrom: 'pic.png' })
      expect(form.doc!.attachments.map((a) => a.filename).sort()).toEqual(['pic-2.png', 'pic.png'])
      expect((form.getNode(node.id) as FormNode).media?.image).toEqual({ [DEFAULT_LANG]: 'pic-2.png' })
    })

    it('skip resolves null and leaves the document untouched', async () => {
      const node = seedExistingPic()
      const form = useFormStore()
      const { vm } = mountHost()

      const resultPromise = vm.uploadMediaRef(imageRef(node.id), new File(['x'], 'pic.png', { type: 'image/png' }), 'upload')
      vm.resolveConflict({ action: 'skip' })
      const result = await resultPromise

      expect(result).toBeNull()
      expect(form.doc!.attachments).toHaveLength(1)
      expect((form.getNode(node.id) as FormNode).media).toBeUndefined()
    })
  })

  describe('sanitizeAttachmentFilename', () => {
    it('replaces parens (which would otherwise read as a dynamic default expression) with hyphens', () => {
      expect(sanitizeAttachmentFilename('photo (1).png')).toBe('photo -1-.png')
    })

    it('leaves an already-clean filename unchanged', () => {
      expect(sanitizeAttachmentFilename('clean-name.png')).toBe('clean-name.png')
    })
  })

  describe('multi-language write rules', () => {
    it('a diverged (varying) slot fans an upload out to every language', async () => {
      const node = setupDoc([EN, ES, FR])
      const form = useFormStore()
      setSiteText(form.doc!, imageRef(node.id), EN, 'a.png')
      setSiteText(form.doc!, imageRef(node.id), ES, 'a.png')
      setSiteText(form.doc!, imageRef(node.id), FR, 'b.png')
      expect(mediaSlotState((form.getNode(node.id) as FormNode).media?.image, langsOf(form.doc!)).varies).toBe(true)
      const { vm } = mountHost()

      await vm.uploadMediaRef(imageRef(node.id), new File(['x'], 'c.png', { type: 'image/png' }), 'upload')

      expect((form.getNode(node.id) as FormNode).media?.image).toEqual({ [EN]: 'c.png', [ES]: 'c.png', [FR]: 'c.png' })
    })

    it('a non-varying (shared-value) slot REPLACEs only the languages holding the old value', async () => {
      const node = setupDoc([EN, FR])
      const form = useFormStore()
      setSiteText(form.doc!, imageRef(node.id), EN, 'a.png')
      setSiteText(form.doc!, imageRef(node.id), FR, 'a.png')
      expect(mediaSlotState((form.getNode(node.id) as FormNode).media?.image, langsOf(form.doc!)).varies).toBe(false)
      const { vm } = mountHost()

      await vm.uploadMediaRef(imageRef(node.id), new File(['x'], 'c.png', { type: 'image/png' }), 'upload')

      expect((form.getNode(node.id) as FormNode).media?.image).toEqual({ [EN]: 'c.png', [FR]: 'c.png' })
    })

    it('clearing a diverged slot is a full reset — every language cleared, no {} debris', () => {
      const node = setupDoc([EN, FR])
      const form = useFormStore()
      setSiteText(form.doc!, imageRef(node.id), EN, 'c.png')
      setSiteText(form.doc!, imageRef(node.id), FR, 'b.png') // manually re-diverged from EN
      expect(mediaSlotState((form.getNode(node.id) as FormNode).media?.image, langsOf(form.doc!)).varies).toBe(true)
      const { vm } = mountHost()

      vm.pickMediaRef(imageRef(node.id), null, 'clear')

      const cleared = form.getNode(node.id) as FormNode
      expect(cleared.media?.image).toBeUndefined()
      expect(cleared.media).toBeUndefined()
    })

    it('clearing a non-varying slot leaves a language that was already empty untouched', () => {
      const node = setupDoc([EN, FR])
      const form = useFormStore()
      setSiteText(form.doc!, imageRef(node.id), EN, 'a.png') // FR is left entirely unset
      expect(mediaSlotState((form.getNode(node.id) as FormNode).media?.image, langsOf(form.doc!))).toEqual({ filename: 'a.png', varies: false })
      const { vm } = mountHost()

      vm.pickMediaRef(imageRef(node.id), null, 'clear')

      const cleared = form.getNode(node.id) as FormNode
      expect(cleared.media?.image?.[EN]).toBeUndefined()
      expect(cleared.media?.image?.[FR]).toBeUndefined()
      expect(cleared.media).toBeUndefined()
    })
  })
})
