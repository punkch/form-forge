import { mount, type VueWrapper } from '@vue/test-utils'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WorkspaceArchiveDialog from '@/components/importexport/WorkspaceArchiveDialog.vue'
import { newDocument } from '@/core/model/factory'
import { buildWorkspaceArchive } from '@/core/workspace/archive'
import { db } from '@/persistence/db'
import { createForm } from '@/persistence/forms-repo'

// Capture toast payloads so we can assert the import warning loop fires.
const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

const mountDialog = (): VueWrapper =>
  mount(WorkspaceArchiveDialog, {
    props: { visible: true },
    global: { stubs: { teleport: true }, plugins: [ToastService] },
  })

const dropFile = async (wrapper: VueWrapper, file: File): Promise<void> => {
  // PrimeVue Dialog renders its content a tick after mount.
  await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-drop"]').exists())
  await wrapper.find('[data-testid="workspace-archive-drop"]').trigger('drop', {
    dataTransfer: { files: [file] },
  })
}

const archiveFile = async (): Promise<File> => {
  const doc = newDocument('Water Survey')
  doc.attachments.push({ id: 'a1', filename: 'sites.csv', mediatype: 'text/csv', size: 8, role: 'csv' })
  const data = await buildWorkspaceArchive([{
    recordId: 'r1',
    meta: { title: 'Water Survey', formId: 'water_survey', version: '1', createdAt: 1, updatedAt: 2 },
    doc,
    attachments: [{
      filename: 'sites.csv',
      mediatype: 'text/csv',
      blob: new Blob(['a,b\n1,2\n'], { type: 'text/csv' }),
    }],
  }], '0.0.0-test', new Date(0).toISOString())
  return new File([data as BlobPart], 'workspace.formforge.zip')
}

const emptyArchiveFile = async (): Promise<File> => {
  const data = await buildWorkspaceArchive([], '0.0.0-test', new Date(0).toISOString())
  return new File([data as BlobPart], 'empty.formforge.zip')
}

describe('WorkspaceArchiveDialog', () => {
  beforeEach(async () => {
    await db.forms.clear()
    await db.attachments.clear()
    toast.add.mockClear()
  })

  it('parses an archive, reports its forms and imports them', async () => {
    const wrapper = mountDialog()
    await dropFile(wrapper, await archiveFile())
    await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-report"]').exists())

    const report = wrapper.find('[data-testid="workspace-archive-report"]')
    expect(report.text()).toContain('1 form found')
    expect(report.text()).toContain('No problems found')
    expect(report.text()).toContain('Water Survey')
    expect(report.text()).toContain('water_survey')
    expect(report.text()).toContain('1 attachment')
    expect(wrapper.find('[data-testid="workspace-archive-issues"]').exists()).toBe(false)

    await wrapper.find('[data-testid="workspace-archive-import"]').trigger('click')
    await vi.waitUntil(async () => (await db.forms.count()) === 1)
    const record = (await db.forms.toArray())[0]
    expect(record.formId).toBe('water_survey')
    expect(record.title).toBe('Water Survey')
    expect(await db.attachments.where('formRecordId').equals(record.id).count()).toBe(1)
  })

  it('rejects a non-archive file and keeps import disabled', async () => {
    const wrapper = mountDialog()
    await dropFile(wrapper, new File([new Uint8Array([1, 2, 3]) as BlobPart], 'garbage.zip'))
    await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-report"]').exists())

    expect(wrapper.find('[data-testid="workspace-archive-report"]').text())
      .toContain('could not be read as a ZIP archive')
    expect(wrapper.find('[data-testid="workspace-archive-issues"]').exists()).toBe(true)
    const importButton = wrapper.find('[data-testid="workspace-archive-import"]')
    expect((importButton.element as HTMLButtonElement).disabled).toBe(true)
    expect(await db.forms.count()).toBe(0)
  })

  it('reports a valid archive with no forms and keeps import disabled', async () => {
    const wrapper = mountDialog()
    await dropFile(wrapper, await emptyArchiveFile())
    await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-report"]').exists())

    const report = wrapper.find('[data-testid="workspace-archive-report"]')
    expect(report.text()).toContain('no forms found')
    expect(report.text()).toContain('No problems found')
    // No forms list, nothing to import.
    expect(wrapper.find('[data-testid="workspace-archive-forms"]').exists()).toBe(false)
    const importButton = wrapper.find('[data-testid="workspace-archive-import"]')
    expect((importButton.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('imports over a colliding form_id and surfaces a warning toast', async () => {
    // Seed a form that already owns the archive form's id, so import warns.
    await createForm(newDocument('Water Survey'))

    const wrapper = mountDialog()
    await dropFile(wrapper, await archiveFile())
    await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-report"]').exists())

    // The archive parses cleanly, so import stays enabled.
    const importButton = wrapper.find('[data-testid="workspace-archive-import"]')
    expect((importButton.element as HTMLButtonElement).disabled).toBe(false)
    expect(wrapper.find('[data-testid="workspace-archive-forms"]').exists()).toBe(true)

    await importButton.trigger('click')
    await vi.waitUntil(async () => (await db.forms.count()) === 2)

    // The import runs the toast loop: a success summary plus one warn per issue.
    const severities = toast.add.mock.calls.map(([payload]) => (payload as { severity: string }).severity)
    expect(severities).toContain('success')
    expect(severities).toContain('warn')
    const warn = toast.add.mock.calls
      .map(([payload]) => payload as { severity: string, detail: string })
      .find((p) => p.severity === 'warn')
    expect(warn?.detail).toContain('water_survey')
  })
})
