/**
 * Whole-workspace backup (format v2): the Central section round-trips through
 * gather → build → read → restore on BOTH backends.
 *
 * Three credential postures are exercised:
 *  - **opt-out (default):** server config + publish targets are carried, but no
 *    `encryptedPassword` and no `central/vault.json` — enforced in the *gather*
 *    step, so the pure builder never sees a secret.
 *  - **opt-in into a fresh workspace:** the vault + saved passwords restore
 *    byte-exact and the vault unlocks with the original passphrase (turnkey).
 *  - **opt-in into a workspace that already has a (different) vault:** the
 *    imported passwords are dropped and a warning is issued; the existing vault
 *    is left untouched.
 */
import JSZip from 'jszip'
import { beforeEach, describe, expect, it } from 'vitest'

import { vault } from '@/core/central/vault'
import { newDocument } from '@/core/model/factory'
import { buildWorkspaceArchive, readWorkspaceArchive } from '@/core/workspace/archive'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import * as serversRepo from '@/persistence/central-servers-repo'
import type { CentralVaultRecord } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'
import * as targetsRepo from '@/persistence/publish-targets-repo'
import * as templatesRepo from '@/persistence/templates-repo'
import { gatherWorkspaceBackup, importWorkspaceBackup, remapPreferencesFormIds } from '@/persistence/workspace-io'
import type { UiPreferences } from '@/stores/ui'
import { appVersion } from '@/version'

import { backendCases } from '../helpers/backends'

const EXPORTED_AT = '2026-07-15T12:00:00.000Z'
const bytesEq = (a: Uint8Array, b: Uint8Array): void => expect([...a]).toEqual([...b])

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const archiveText = async (bytes: Uint8Array): Promise<{ paths: string[], text: string }> => {
  const zip = await JSZip.loadAsync(bytes)
  const paths = Object.keys(zip.files)
  let text = ''
  for (const path of paths) text += await zip.files[path].async('string')
  return { paths, text }
}

/** Seed a form, a registered server (with a real encrypted password), the vault
 * meta, and a publish target that links the form to the server. */
const seedWorkspace = async (passphrase: string, password: string) => {
  const form = await formsRepo.createForm(newDocument('Water Survey'))
  await attachmentsRepo.addAttachment(form.id, 'sites.csv', new Blob(['a,b'], { type: 'text/csv' }))

  // Real vault crypto so the round-trip proves byte-exactness AND unlockability.
  const meta = await vault.create(passphrase)
  await serversRepo.setVaultMeta({ id: 'vault', salt: meta.salt, keyCheck: meta.keyCheck })
  const encryptedPassword = await vault.encrypt(password)

  const server = await serversRepo.saveCentralServer({
    name: 'Prod', baseUrl: 'https://central.example', email: 'user@example.org', encryptedPassword,
  })
  const target = await targetsRepo.upsertTarget({
    formRecordId: form.id,
    serverId: server.id,
    projectId: 7,
    xmlFormId: 'water_survey',
    lastPublishedVersion: '2026',
    lastPublishedAt: 1_700_000_000_000,
    lastPublishedContentHash: 'abc123',
  })
  return { form, server, target, encryptedPassword, vaultMeta: meta }
}

describe.each(backendCases)('workspace full backup ($name backend)', ({ setup }) => {
  beforeEach(setup)

  it('opt-out: carries server config + targets but no secrets, and restores config-only', async () => {
    const seeded = await seedWorkspace('correct horse battery staple', 'hunter2')

    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: false })
    // Stripped in the gather step already.
    expect(central.vault).toBeUndefined()
    expect(central.servers).toHaveLength(1)
    expect(central.servers[0].encryptedPassword).toBeUndefined()
    expect(central.targets).toHaveLength(1)

    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central })
    const { paths, text } = await archiveText(bytes)
    expect(paths).toContain('central/servers.json')
    expect(paths).toContain('central/targets.json')
    expect(paths).not.toContain('central/vault.json')
    // The real ciphertext/keyCheck bytes must appear nowhere in the archive.
    for (const b64 of [
      Buffer.from(seeded.encryptedPassword.ciphertext).toString('base64'),
      Buffer.from(seeded.vaultMeta.keyCheck.ciphertext).toString('base64'),
    ]) expect(text).not.toContain(b64)

    // Wipe the workspace and restore.
    await setup()
    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    expect(parsed.central?.vault).toBeUndefined()
    const result = await importWorkspaceBackup(parsed)
    expect(result.imported).toBe(1)
    expect(result.serversImported).toBe(1)
    expect(result.targetsImported).toBe(1)
    expect(result.credentialsRestored).toBe(false)

    const [restoredServer] = await serversRepo.listCentralServers()
    expect(restoredServer.name).toBe('Prod')
    expect(restoredServer.baseUrl).toBe('https://central.example')
    expect(restoredServer.email).toBe('user@example.org')
    expect(restoredServer.encryptedPassword).toBeUndefined()
    expect(await serversRepo.getVaultMeta()).toBeUndefined()

    const [restoredForm] = await formsRepo.listForms()
    const restoredTargets = await targetsRepo.listTargetsForForm(restoredForm.id)
    expect(restoredTargets).toHaveLength(1)
    expect(restoredTargets[0].serverId).toBe(restoredServer.id)
    expect(restoredTargets[0].xmlFormId).toBe('water_survey')
    expect(restoredTargets[0].lastPublishedContentHash).toBe('abc123')
  })

  it('opt-in into a fresh workspace: restores vault + passwords byte-exact and unlockable', async () => {
    const passphrase = 'correct horse battery staple'
    const password = 'hunter2'
    const seeded = await seedWorkspace(passphrase, password)

    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: true })
    expect(central.vault).toBeDefined()
    expect(central.servers[0].encryptedPassword).toBeDefined()

    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central })
    const { paths } = await archiveText(bytes)
    expect(paths).toContain('central/vault.json')

    await setup()
    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    const result = await importWorkspaceBackup(parsed)
    expect(result.credentialsRestored).toBe(true)
    expect(result.serversImported).toBe(1)
    expect(result.targetsImported).toBe(1)
    expect(result.issues).toEqual([])

    // Vault meta and the server password survive byte-exact through base64.
    const restoredVault = await serversRepo.getVaultMeta()
    expect(restoredVault).toBeDefined()
    bytesEq(restoredVault!.salt, seeded.vaultMeta.salt)
    bytesEq(restoredVault!.keyCheck.iv, seeded.vaultMeta.keyCheck.iv)
    bytesEq(restoredVault!.keyCheck.ciphertext, seeded.vaultMeta.keyCheck.ciphertext)

    const [restoredServer] = await serversRepo.listCentralServers()
    expect(restoredServer.id).not.toBe(seeded.server.id) // id remapped
    expect(restoredServer.encryptedPassword).toBeDefined()
    bytesEq(restoredServer.encryptedPassword!.ciphertext, seeded.encryptedPassword.ciphertext)

    // The original passphrase unlocks the restored vault and decrypts the password.
    vault.lock()
    const unlocked = await vault.unlock(passphrase, {
      salt: restoredVault!.salt, keyCheck: restoredVault!.keyCheck,
    })
    expect(unlocked).toBe(true)
    expect(await vault.decrypt(restoredServer.encryptedPassword!)).toBe(password)

    // The target relinks the freshly imported form + server.
    const [restoredForm] = await formsRepo.listForms()
    const restoredTargets = await targetsRepo.listTargetsForForm(restoredForm.id)
    expect(restoredTargets).toHaveLength(1)
    expect(restoredTargets[0].serverId).toBe(restoredServer.id)
  })

  it('opt-in into a workspace that already has a vault: drops passwords + warns', async () => {
    const seeded = await seedWorkspace('backup passphrase', 'backup-pw')
    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: true })
    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central })

    // New device already has a *different* vault.
    await setup()
    const otherVault: CentralVaultRecord = {
      id: 'vault',
      salt: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
      keyCheck: { iv: new Uint8Array(12), ciphertext: new Uint8Array([42, 42, 42]) },
    }
    await serversRepo.setVaultMeta(otherVault)

    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    const result = await importWorkspaceBackup(parsed)
    expect(result.credentialsRestored).toBe(false)
    expect(result.serversImported).toBe(1)
    expect(result.issues).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'workspace.credentials-not-restored' }),
    ])

    // Existing vault untouched; the imported server carries no password.
    const keptVault = await serversRepo.getVaultMeta()
    bytesEq(keptVault!.salt, otherVault.salt)
    const [restoredServer] = await serversRepo.listCentralServers()
    expect(restoredServer.encryptedPassword).toBeUndefined()
    expect(restoredServer.baseUrl).toBe(seeded.server.baseUrl)
  })

  it('dedupes servers by (baseUrl, email): a matching server is reused, not duplicated', async () => {
    await seedWorkspace('pass', 'pw')
    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: false })
    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central })

    // Fresh workspace that already registered the same server (same URL + email).
    await setup()
    const existing = await serversRepo.saveCentralServer({
      name: 'My Prod', baseUrl: 'https://central.example', email: 'user@example.org',
    })

    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    const result = await importWorkspaceBackup(parsed)
    expect(result.serversImported).toBe(0) // reused, not inserted
    expect(await serversRepo.listCentralServers()).toHaveLength(1)

    // The restored target points at the pre-existing server row.
    const [restoredForm] = await formsRepo.listForms()
    const restoredTargets = await targetsRepo.listTargetsForForm(restoredForm.id)
    expect(restoredTargets).toHaveLength(1)
    expect(restoredTargets[0].serverId).toBe(existing.id)
  })

  it('a corrupt server password skips only that blob, keeping the rest of the section', async () => {
    await seedWorkspace('pass', 'pw')
    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: true })
    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central })

    // Corrupt the one server's encryptedPassword.ciphertext to non-base64.
    const zip = await JSZip.loadAsync(bytes)
    const servers = JSON.parse(await zip.file('central/servers.json')!.async('string'))
    servers[0].encryptedPassword.ciphertext = '!!! not base64 !!!'
    zip.file('central/servers.json', JSON.stringify(servers))
    const tampered = await zip.generateAsync({ type: 'uint8array' })

    const parsed = await readWorkspaceArchive(toArrayBuffer(tampered))
    // The section survived: server config, targets and the vault are all intact;
    // only the unreadable password was dropped.
    expect(parsed.central).toBeDefined()
    expect(parsed.central!.servers).toHaveLength(1)
    expect(parsed.central!.servers[0].encryptedPassword).toBeUndefined()
    expect(parsed.central!.targets).toHaveLength(1)
    expect(parsed.central!.vault).toBeDefined()
  })

  it('turnkey restore adopts the imported password for a pre-registered password-less server', async () => {
    const passphrase = 'backup passphrase'
    const password = 'backup-pw'
    const seeded = await seedWorkspace(passphrase, password)
    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: true })
    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central })

    // Fresh workspace (no vault) that already registered the same server, but
    // without a saved password.
    await setup()
    const existing = await serversRepo.saveCentralServer({
      name: 'Local name', baseUrl: 'https://central.example', email: 'user@example.org',
    })

    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    const result = await importWorkspaceBackup(parsed)
    expect(result.credentialsRestored).toBe(true)
    expect(result.serversImported).toBe(0) // reused the existing row

    // The pre-existing row adopted the imported password (config left untouched).
    const reused = await serversRepo.getCentralServer(existing.id)
    expect(reused!.name).toBe('Local name')
    expect(reused!.encryptedPassword).toBeDefined()
    bytesEq(reused!.encryptedPassword!.ciphertext, seeded.encryptedPassword.ciphertext)

    // It unlocks + decrypts under the restored vault's passphrase.
    const restoredVault = await serversRepo.getVaultMeta()
    vault.lock()
    expect(await vault.unlock(passphrase, { salt: restoredVault!.salt, keyCheck: restoredVault!.keyCheck })).toBe(true)
    expect(await vault.decrypt(reused!.encryptedPassword!)).toBe(password)
  })

  it('carries locally saved templates and restores them as new records', async () => {
    await formsRepo.createForm(newDocument('Water Survey'))
    // Two saved templates in the gallery.
    const doc = newDocument('Health Intake')
    await templatesRepo.addTemplate(doc, 'Health intake starter', 'A reusable intake form')
    await templatesRepo.addTemplate(newDocument('Roster'), 'Roster starter', '')

    const { forms, central, templates } = await gatherWorkspaceBackup({ includeCredentials: false })
    expect(templates).toHaveLength(2)
    // Template docs never carry attachment refs.
    expect(templates.every((t) => t.doc.attachments.length === 0)).toBe(true)

    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central, templates })
    const { paths } = await archiveText(bytes)
    expect(paths).toContain('templates.json')

    // Wipe and restore.
    await setup()
    expect(await templatesRepo.listTemplates()).toEqual([])
    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    expect(parsed.templates).toHaveLength(2)
    const result = await importWorkspaceBackup(parsed)
    expect(result.templatesImported).toBe(2)

    const restored = await templatesRepo.listTemplates()
    expect(restored).toHaveLength(2)
    const starter = restored.find((t) => t.title === 'Health intake starter')
    expect(starter).toBeDefined()
    expect(starter!.description).toBe('A reusable intake form')
    expect(starter!.doc.settings.formTitle).toBe('Health Intake')
  })

  it('omits templates.json when the gallery is empty', async () => {
    await formsRepo.createForm(newDocument('Solo'))
    const { forms, central, templates } = await gatherWorkspaceBackup({ includeCredentials: false })
    expect(templates).toEqual([])
    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central, templates })
    const { paths } = await archiveText(bytes)
    expect(paths).not.toContain('templates.json')

    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    expect(parsed.templates).toBeUndefined()
    const result = await importWorkspaceBackup(parsed)
    expect(result.templatesImported).toBe(0)
  })

  it('carries a hidden-bundled-templates list through preferences.json and restores it on read', async () => {
    await formsRepo.createForm(newDocument('Solo'))
    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: false })

    // A full UiPreferences snapshot, as ui.exportPreferences() would produce —
    // proves the hidden-starter list rides along with the rest of the device
    // preferences the composable already gathers from the store.
    const preferences: UiPreferences = {
      paletteWidth: 250,
      propertiesWidth: 360,
      previewWidth: 420,
      previewPreset: 'fill',
      paletteVisible: true,
      propSectionsCollapsed: {},
      locale: 'en',
      theme: 'system',
      accent: 'purple',
      contrast: 'system',
      storageHintDismissed: false,
      dismissedCallouts: [],
      hiddenBundledTemplates: ['welcome-survey', 'household-roster'],
      lastExportFormat: {},
    }

    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central, preferences })
    const { paths } = await archiveText(bytes)
    expect(paths).toContain('preferences.json')

    // Wipe and read back as a fresh device would.
    await setup()
    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    expect(parsed.preferences?.hiddenBundledTemplates).toEqual(['welcome-survey', 'household-roster'])
  })

  it('rekeys the per-form export-format memory through the import formIdMap', async () => {
    const record = await formsRepo.createForm(newDocument('Solo'))
    const { forms, central } = await gatherWorkspaceBackup({ includeCredentials: false })
    const preferences = {
      hiddenBundledTemplates: [],
      // Keyed by the SOURCE workspace's record id + one entry for a form that
      // was never exported (must be dropped, not carried as a stale key).
      lastExportFormat: { [record.id]: 'zip-xlsform', 'gone-form': 'xform' },
    }
    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT, { central, preferences })

    // Wipe and restore: the imported form gets a freshly minted id.
    await setup()
    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    const result = await importWorkspaceBackup(parsed)
    const [restored] = await formsRepo.listForms()
    expect(restored.id).not.toBe(record.id)
    expect(result.formIdMap.get(record.id)).toBe(restored.id)

    const remapped = remapPreferencesFormIds(parsed.preferences!, result.formIdMap)
    expect(remapped.lastExportFormat).toEqual({ [restored.id]: 'zip-xlsform' })
    // Untouched preferences pass through; a map-less preferences object is returned as-is.
    expect(remapped.hiddenBundledTemplates).toEqual([])
    const noMap = { theme: 'dark' }
    expect(remapPreferencesFormIds(noMap, result.formIdMap)).toBe(noMap)
  })

  it('a v1 archive (no central section) restores forms with no Central data', async () => {
    await formsRepo.createForm(newDocument('Solo'))
    const { forms } = await gatherWorkspaceBackup({ includeCredentials: false })
    // Build a share-style v1 archive (no central argument).
    const bytes = await buildWorkspaceArchive(forms, appVersion(), EXPORTED_AT)

    await setup()
    const parsed = await readWorkspaceArchive(toArrayBuffer(bytes))
    expect(parsed.central).toBeUndefined()
    const result = await importWorkspaceBackup(parsed)
    expect(result.imported).toBe(1)
    expect(result.serversImported).toBe(0)
    expect(result.targetsImported).toBe(0)
    expect(await serversRepo.listCentralServers()).toEqual([])
  })
})
