import { downloadBlob } from '@/composables/useDownload'
import { buildWorkspaceArchive } from '@/core/workspace/archive'
import type { FormRecord } from '@/persistence/db'
import { gatherArchiveForms } from '@/persistence/workspace-io'
import { appVersion } from '@/version'

/** yyyy-mm-dd from local date parts, so a filename dated in the user's evening
 * doesn't jump to the next day the way toISOString()'s UTC would. */
export const localDateStamp = (date: Date): string => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export interface UseWorkspaceExport {
  /** Whole-library backup: `formforge-workspace-<yyyy-mm-dd>.formforge.zip` (local date). */
  exportWorkspace: () => Promise<void>
  /** Single-form archive: `<formId||'form'>.formforge.zip`. */
  exportFormArchive: (record: FormRecord) => Promise<void>
}

const exportArchive = async (recordIds: string[] | undefined, filename: string): Promise<void> => {
  const forms = await gatherArchiveForms(recordIds)
  const data = await buildWorkspaceArchive(forms, appVersion(), new Date().toISOString())
  downloadBlob(data, filename, 'application/zip')
}

const exportWorkspace = (): Promise<void> =>
  exportArchive(undefined, `formforge-workspace-${localDateStamp(new Date())}.formforge.zip`)

const exportFormArchive = (record: FormRecord): Promise<void> =>
  exportArchive([record.id], `${record.formId || 'form'}.formforge.zip`)

/**
 * Workspace archive exports (.formforge.zip): lossless download of whole
 * libraries or single forms, incl. attachments (src/core/workspace/archive.ts).
 * Shared by the library (card-menu export, footer backup link) and the app
 * settings page, so filenames stay identical wherever the export starts.
 */
export const useWorkspaceExport = (): UseWorkspaceExport => ({
  exportWorkspace,
  exportFormArchive,
})
