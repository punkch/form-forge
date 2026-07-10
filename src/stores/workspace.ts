import { liveQuery, type Subscription } from 'dexie'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { instantiateTemplate, newDocument } from '@/core/model/factory'
import type { FormDocument } from '@/core/model/types'
import * as formsRepo from '@/persistence/forms-repo'
import type { FormRecord } from '@/persistence/db'

/** Workspace = the library of forms stored in this browser. */
export const useWorkspaceStore = defineStore('workspace', () => {
  const forms = ref<FormRecord[]>([])
  const loading = ref(true)
  let subscription: Subscription | null = null

  const startWatching = (): void => {
    if (subscription !== null) return
    subscription = liveQuery(formsRepo.listForms).subscribe({
      next: (records) => {
        forms.value = records
        loading.value = false
      },
      error: (error) => {
        console.error('Failed to read forms from IndexedDB', error)
        loading.value = false
      },
    })
  }

  const stopWatching = (): void => {
    subscription?.unsubscribe()
    subscription = null
  }

  const createForm = async (title: string): Promise<FormRecord> =>
    formsRepo.createForm(newDocument(title))

  /** New form from a template document (bundled or local). */
  const createFormFromTemplate = async (doc: FormDocument, title: string): Promise<FormRecord> =>
    formsRepo.createForm(instantiateTemplate(doc, title))

  const deleteForm = (id: string): Promise<void> => formsRepo.deleteForm(id)

  const duplicateForm = (id: string): Promise<FormRecord | undefined> =>
    formsRepo.duplicateForm(id)

  const renameForm = (id: string, title: string): Promise<void> =>
    formsRepo.renameForm(id, title)

  return {
    forms,
    loading,
    startWatching,
    stopWatching,
    createForm,
    createFormFromTemplate,
    deleteForm,
    duplicateForm,
    renameForm,
  }
})
