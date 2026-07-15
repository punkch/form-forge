import { downloadBlob } from '@/composables/useDownload'
import { buildWorkspaceArchive } from '@/core/workspace/archive'
import type { FormRecord } from '@/persistence/db'
import { gatherArchiveForms, gatherWorkspaceBackup } from '@/persistence/workspace-io'
import { useUiStore } from '@/stores/ui'
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
  /**
   * Whole-workspace backup: `formforge-workspace-<yyyy-mm-dd>.formforge.zip`
   * (local date). A **format v2** archive carrying forms + attachments, the
   * Central section (server config + publish targets), and device UI
   * preferences (theme/accent/language/…). Saved credentials (the vault + each
   * server's encrypted password) are included only when `includeCredentials` is
   * true — default off.
   */
  exportWorkspace: (options?: { includeCredentials?: boolean }) => Promise<void>
  /** Single-form archive: `<formId||'form'>.formforge.zip` — **format v1**,
   * credential-free by construction (never carries Central data or preferences). */
  exportFormArchive: (record: FormRecord) => Promise<void>
}

const exportFormArchive = async (record: FormRecord): Promise<void> => {
  const forms = await gatherArchiveForms([record.id])
  // No `backup` argument → format v1, no Central section / preferences (share path).
  const data = await buildWorkspaceArchive(forms, appVersion(), new Date().toISOString())
  downloadBlob(data, `${record.formId || 'form'}.formforge.zip`, 'application/zip')
}

/**
 * Workspace archive exports (.formforge.zip): lossless download of a whole
 * workspace backup or a single shareable form, incl. attachments
 * (src/core/workspace/archive.ts). Shared by the library (card-menu export,
 * footer backup link) and the app settings page, so filenames stay identical
 * wherever the export starts.
 */
export const useWorkspaceExport = (): UseWorkspaceExport => {
  const ui = useUiStore()

  const exportWorkspace = async ({ includeCredentials = false } = {}): Promise<void> => {
    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials })
    const preferences = ui.exportPreferences()
    const data = await buildWorkspaceArchive(
      forms, appVersion(), new Date().toISOString(), { central, preferences }
    )
    downloadBlob(data, `formforge-workspace-${localDateStamp(new Date())}.formforge.zip`, 'application/zip')
  }

  return { exportWorkspace, exportFormArchive }
}
