import { mount, type VueWrapper } from '@vue/test-utils'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import WorkspaceArchiveDialog from '@/components/importexport/WorkspaceArchiveDialog.vue'
import { newDocument } from '@/core/model/factory'
import { buildWorkspaceArchive } from '@/core/workspace/archive'
import { db } from '@/persistence/db'
import { createForm } from '@/persistence/forms-repo'
import { useUiStore } from '@/stores/ui'

import { freshPinia } from './helpers'

// Capture toast payloads so we can assert the import warning loop fires.
const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

// The dialog restores UI preferences through the ui store, so it needs pinia.
const mountDialog = (): VueWrapper =>
  mount(WorkspaceArchiveDialog, {
    props: { visible: true },
    global: { stubs: { teleport: true }, plugins: [ToastService, freshPinia()] },
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

/** A v2 whole-workspace backup: one form plus a Central server + publish target
 * (opt-out — no vault/credentials). */
const backupWithCentral = async (): Promise<File> => {
  const doc = newDocument('Water Survey')
  const data = await buildWorkspaceArchive(
    [{
      recordId: 'r1',
      meta: { title: 'Water Survey', formId: 'water_survey', version: '1', createdAt: 1, updatedAt: 2 },
      doc,
      attachments: [],
    }],
    '0.0.0-test',
    new Date(0).toISOString(),
    {
      central: {
        servers: [{ id: 's1', name: 'Prod', baseUrl: 'https://central.example', email: 'u@example.org' }],
        targets: [{
          id: 't1',
          formRecordId: 'r1',
          serverId: 's1',
          projectId: 3,
          xmlFormId: 'water_survey',
          lastPublishedVersion: '1',
          lastPublishedAt: 1,
        }],
      },
    }
  )
  return new File([data as BlobPart], 'backup.formforge.zip')
}

/** A v2 backup carrying device UI preferences (theme/accent). */
const backupWithPreferences = async (): Promise<File> => {
  const doc = newDocument('Themed')
  const data = await buildWorkspaceArchive(
    [{
      recordId: 'rp',
      meta: { title: 'Themed', formId: 'themed', version: '1', createdAt: 1, updatedAt: 2 },
      doc,
      attachments: [],
    }],
    '0.0.0-test',
    new Date(0).toISOString(),
    { central: { servers: [], targets: [] }, preferences: { version: 1, theme: 'dark', accent: 'teal', locale: 'en' } }
  )
  return new File([data as BlobPart], 'themed.formforge.zip')
}

/** A v2 backup carrying two locally saved templates. */
const backupWithTemplates = async (): Promise<File> => {
  const doc = newDocument('Water Survey')
  const templateDoc = newDocument('Health Intake')
  const data = await buildWorkspaceArchive(
    [{
      recordId: 'r1',
      meta: { title: 'Water Survey', formId: 'water_survey', version: '1', createdAt: 1, updatedAt: 2 },
      doc,
      attachments: [],
    }],
    '0.0.0-test',
    new Date(0).toISOString(),
    {
      central: { servers: [], targets: [] },
      templates: [
        { id: 'tpl1', title: 'Intake starter', description: 'Reusable', questionCount: 0, preview: [], createdAt: 1, updatedAt: 2, doc: templateDoc },
        { id: 'tpl2', title: 'Roster starter', description: '', questionCount: 0, preview: [], createdAt: 1, updatedAt: 3, doc: newDocument('Roster') },
      ],
    }
  )
  return new File([data as BlobPart], 'templates.formforge.zip')
}

describe('WorkspaceArchiveDialog', () => {
  beforeEach(async () => {
    localStorage.clear()
    await Promise.all([
      db.forms.clear(),
      db.attachments.clear(),
      db.templates.clear(),
      db.centralServers.clear(),
      db.centralVault.clear(),
      db.publishTargets.clear(),
    ])
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

  it('reports a v2 backup Central section and restores servers + targets', async () => {
    const wrapper = mountDialog()
    await dropFile(wrapper, await backupWithCentral())
    await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-report"]').exists())

    const central = wrapper.find('[data-testid="workspace-archive-central"]')
    expect(central.exists()).toBe(true)
    expect(central.text()).toContain('1 Central server')
    expect(central.text()).toContain('1 publish target')

    await wrapper.find('[data-testid="workspace-archive-import"]').trigger('click')
    await vi.waitUntil(async () => (await db.forms.count()) === 1)
    expect(await db.centralServers.count()).toBe(1)
    const [form] = await db.forms.toArray()
    const targets = await db.publishTargets.where('formRecordId').equals(form.id).toArray()
    expect(targets).toHaveLength(1)
    expect(targets[0].xmlFormId).toBe('water_survey')
  })

  it('restores device UI preferences from a backup on import', async () => {
    const wrapper = mountDialog()
    // Same active pinia the dialog mounted with (freshPinia sets it active).
    const ui = useUiStore()
    expect(ui.theme).not.toBe('dark')

    await dropFile(wrapper, await backupWithPreferences())
    await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-report"]').exists())
    expect(wrapper.find('[data-testid="workspace-archive-preferences"]').exists()).toBe(true)

    await wrapper.find('[data-testid="workspace-archive-import"]').trigger('click')
    await vi.waitUntil(async () => (await db.forms.count()) === 1)

    expect(ui.theme).toBe('dark')
    expect(ui.accent).toBe('teal')
    // The info toast announcing the preference restore fired.
    const severities = toast.add.mock.calls.map(([p]) => (p as { severity: string }).severity)
    expect(severities).toContain('info')
  })

  it('reports saved templates and restores them on import', async () => {
    const wrapper = mountDialog()
    await dropFile(wrapper, await backupWithTemplates())
    await vi.waitUntil(() => wrapper.find('[data-testid="workspace-archive-report"]').exists())

    const templates = wrapper.find('[data-testid="workspace-archive-templates"]')
    expect(templates.exists()).toBe(true)
    expect(templates.text()).toContain('2 saved templates')

    await wrapper.find('[data-testid="workspace-archive-import"]').trigger('click')
    await vi.waitUntil(async () => (await db.templates.count()) === 2)

    const stored = await db.templates.toArray()
    expect(stored.map((t) => t.title).sort()).toEqual(['Intake starter', 'Roster starter'])
    // The info toast announcing the template restore fired.
    const severities = toast.add.mock.calls.map(([p]) => (p as { severity: string }).severity)
    expect(severities).toContain('info')
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
