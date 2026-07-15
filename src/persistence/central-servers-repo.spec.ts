import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'

import { backendCases } from '../../tests/helpers/backends'
import * as serversRepo from './central-servers-repo'
import { BuilderDb, CURRENT_DB_NAME, type CentralVaultRecord, type EncryptedBlob } from './db'
import * as targetsRepo from './publish-targets-repo'

const pw = (marker: string): EncryptedBlob => ({
  iv: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  ciphertext: new TextEncoder().encode(marker),
})

const vaultMeta = (marker: string): CentralVaultRecord => ({
  id: 'vault',
  salt: new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]),
  keyCheck: pw(marker),
})

// Contract suite: identical behavior on the Dexie default and the memory
// backend (tests/helpers/backends.ts).
describe.each(backendCases)('central servers repo ($name backend)', ({ setup }) => {
  beforeEach(setup)

  it('creates (minting an id), gets and round-trips a server', async () => {
    const record = await serversRepo.saveCentralServer({
      name: 'Field Central',
      baseUrl: 'https://central.example.org',
      email: 'surveyor@example.org',
      encryptedPassword: pw('secret'),
    })
    expect(record.id).toBeTruthy()

    const fetched = await serversRepo.getCentralServer(record.id)
    expect(fetched?.name).toBe('Field Central')
    expect(fetched?.email).toBe('surveyor@example.org')
    // The opaque encrypted bytes survive storage verbatim.
    expect(new TextDecoder().decode(fetched!.encryptedPassword!.ciphertext)).toBe('secret')
    expect(await serversRepo.getCentralServer('missing')).toBeUndefined()
  })

  it('lists servers in ascending id order and updates in place by id', async () => {
    await serversRepo.saveCentralServer({ id: 'srv-b', name: 'B', baseUrl: 'https://b.example' })
    await serversRepo.saveCentralServer({ id: 'srv-a', name: 'A', baseUrl: 'https://a.example' })
    expect((await serversRepo.listCentralServers()).map((s) => s.id)).toEqual(['srv-a', 'srv-b'])

    // Re-saving with the same id replaces the record (no duplicate row).
    await serversRepo.saveCentralServer({ id: 'srv-a', name: 'A renamed', baseUrl: 'https://a2.example' })
    const list = await serversRepo.listCentralServers()
    expect(list).toHaveLength(2)
    expect((await serversRepo.getCentralServer('srv-a'))?.name).toBe('A renamed')
  })

  it('stored server records never alias caller-held objects', async () => {
    const record = await serversRepo.saveCentralServer({ name: 'Aliasing', baseUrl: 'https://x.example' })
    record.name = 'Mutated after save'
    expect((await serversRepo.getCentralServer(record.id))?.name).toBe('Aliasing')
  })

  it('deleteCentralServer removes the server and cascades its publish targets, sparing others', async () => {
    await serversRepo.saveCentralServer({ id: 'srv-a', name: 'A', baseUrl: 'https://a.example' })
    await serversRepo.saveCentralServer({ id: 'srv-b', name: 'B', baseUrl: 'https://b.example' })
    await targetsRepo.upsertTarget({
      formRecordId: 'form-1',
      serverId: 'srv-a',
      projectId: 1,
      xmlFormId: 'x',
      lastPublishedVersion: '1',
      lastPublishedAt: 1,
    })
    await targetsRepo.upsertTarget({
      formRecordId: 'form-1',
      serverId: 'srv-b',
      projectId: 1,
      xmlFormId: 'x',
      lastPublishedVersion: '1',
      lastPublishedAt: 1,
    })

    await serversRepo.deleteCentralServer('srv-a')

    expect(await serversRepo.getCentralServer('srv-a')).toBeUndefined()
    expect(await serversRepo.getCentralServer('srv-b')).toBeDefined()
    const remaining = await targetsRepo.listTargetsForForm('form-1')
    expect(remaining.map((t) => t.serverId)).toEqual(['srv-b'])
  })

  it('vault meta round-trips', async () => {
    expect(await serversRepo.getVaultMeta()).toBeUndefined()
    await serversRepo.setVaultMeta(vaultMeta('check'))
    const meta = await serversRepo.getVaultMeta()
    expect(meta?.id).toBe('vault')
    expect(new TextDecoder().decode(meta!.keyCheck.ciphertext)).toBe('check')
  })

  it('resetVaultWipingPasswords installs new meta and wipes passwords, keeping server rows', async () => {
    await serversRepo.saveCentralServer({ id: 'srv-a', name: 'A', baseUrl: 'https://a.example', email: 'a@x.org', encryptedPassword: pw('secretA') })
    await serversRepo.saveCentralServer({ id: 'srv-b', name: 'B', baseUrl: 'https://b.example', encryptedPassword: pw('secretB') })
    await serversRepo.setVaultMeta(vaultMeta('old'))

    await serversRepo.resetVaultWipingPasswords(vaultMeta('new'))

    const servers = await serversRepo.listCentralServers()
    // Server rows survive…
    expect(servers.map((s) => s.id)).toEqual(['srv-a', 'srv-b'])
    // …with other fields intact…
    expect(servers.find((s) => s.id === 'srv-a')?.email).toBe('a@x.org')
    // …but every stored password is wiped.
    expect(servers.every((s) => s.encryptedPassword === undefined)).toBe(true)
    // The new vault meta replaced the old one.
    expect(new TextDecoder().decode((await serversRepo.getVaultMeta())!.keyCheck.ciphertext)).toBe('new')
  })
})

describe('central db migration (v2 → v3)', () => {
  it('upgrades a v2 database in place, keeping forms and enabling the central tables', async () => {
    // Simulate a browser that only ever saw schema v2 (forms/attachments/
    // snapshots/templates, no central tables), on an isolated IDBFactory so the
    // shared app db is untouched.
    const indexedDB = new IDBFactory()
    const v2 = new Dexie(CURRENT_DB_NAME, { indexedDB, IDBKeyRange })
    v2.version(1).stores({
      forms: 'id, updatedAt, title',
      attachments: 'id, formRecordId',
      snapshots: 'id, formRecordId, createdAt',
    })
    v2.version(2).stores({ templates: 'id, updatedAt, title' })
    await v2.table('forms').add({
      id: 'f1',
      title: 'Pre-upgrade form',
      formId: 'pre_upgrade',
      version: '1',
      questionCount: 0,
      createdAt: 1,
      updatedAt: 2,
      doc: newDocument('Pre-upgrade form'),
    })
    v2.close()

    const upgraded = new BuilderDb({ indexedDB, IDBKeyRange })
    try {
      expect(upgraded.verno).toBe(3)
      expect(await upgraded.forms.count()).toBe(1)
      expect((await upgraded.forms.get('f1'))?.title).toBe('Pre-upgrade form')

      // The three new tables are usable right away.
      await upgraded.centralServers.add({ id: 's1', name: 'S', baseUrl: 'https://x.example' })
      await upgraded.centralVault.put({
        id: 'vault',
        salt: new Uint8Array([1]),
        keyCheck: { iv: new Uint8Array([2]), ciphertext: new Uint8Array([3]) },
      })
      await upgraded.publishTargets.add({
        id: 't1',
        formRecordId: 'f1',
        serverId: 's1',
        projectId: 1,
        xmlFormId: 'x',
        lastPublishedVersion: '1',
        lastPublishedAt: 1,
      })
      expect(await upgraded.centralServers.count()).toBe(1)
      expect(await upgraded.centralVault.count()).toBe(1)
      expect(await upgraded.publishTargets.count()).toBe(1)
    } finally {
      upgraded.close()
    }
  })
})
