/**
 * Regression pin for the product's core promise on the **share path**: no server
 * record or credential material — plaintext OR encrypted — ever enters a
 * single-form / shareable export. This is "safe by construction"
 * (`gatherArchiveForms` reads only forms + attachments, and the share path calls
 * `buildWorkspaceArchive` with NO `central` argument — src/persistence/workspace-io.ts),
 * and this test keeps it that way on BOTH backends: it seeds a Central server
 * (with encrypted-password bytes), the vault meta, and a publish target alongside
 * a form, then asserts none of that material reaches the gathered forms or the
 * built (central-less) archive.
 *
 * The whole-workspace *backup* path, which DOES carry Central config (and, when
 * opted in, credentials), is exercised separately in
 * tests/unit/workspace-full-backup.spec.ts.
 */
import JSZip from 'jszip'
import { beforeEach, describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'
import { buildWorkspaceArchive } from '@/core/workspace/archive'
import * as serversRepo from '@/persistence/central-servers-repo'
import * as formsRepo from '@/persistence/forms-repo'
import * as targetsRepo from '@/persistence/publish-targets-repo'
import { gatherArchiveForms } from '@/persistence/workspace-io'
import { appVersion } from '@/version'

import { backendCases } from '../helpers/backends'

// Distinctive strings/bytes that would be unmistakable if they leaked.
const SERVER_NAME = 'SECRET_SERVER_NAME_SENTINEL'
const SERVER_URL = 'https://secret-central.example.invalid/path'
const SERVER_EMAIL = 'leaked-user@example.invalid'
const CIPHERTEXT_SENTINEL = 'CIPHERTEXT_SENTINEL_BYTES'
const SENTINELS = [SERVER_NAME, SERVER_URL, SERVER_EMAIL, CIPHERTEXT_SENTINEL]

describe.each(backendCases)('central material never enters a single-form / share export ($name backend)', ({ setup }) => {
  beforeEach(setup)

  it('gathered forms and the built (central-less) archive contain no server, vault or target material', async () => {
    // A real form to export.
    const form = await formsRepo.createForm(newDocument('Household Survey'))

    // A registered server with encrypted-password bytes…
    const server = await serversRepo.saveCentralServer({
      name: SERVER_NAME,
      baseUrl: SERVER_URL,
      email: SERVER_EMAIL,
      encryptedPassword: {
        iv: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
        ciphertext: new TextEncoder().encode(CIPHERTEXT_SENTINEL),
      },
    })
    // …the vault meta…
    await serversRepo.setVaultMeta({
      id: 'vault',
      salt: new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9]),
      keyCheck: { iv: new Uint8Array(12), ciphertext: new TextEncoder().encode(CIPHERTEXT_SENTINEL) },
    })
    // …and a publish target for the form.
    await targetsRepo.upsertTarget({
      formRecordId: form.id,
      serverId: server.id,
      projectId: 1,
      xmlFormId: 'household_survey',
      lastPublishedVersion: '1',
      lastPublishedAt: 1,
    })

    // (a) The gathered forms carry only form/attachment data — no server fields.
    // gatherArchiveForms([id]) is exactly what the single-form share path calls.
    const gathered = await gatherArchiveForms([form.id])
    expect(gathered).toHaveLength(1)
    expect(gathered[0].meta.title).toBe('Household Survey')
    const gatheredJson = JSON.stringify(gathered)
    for (const sentinel of SENTINELS) expect(gatheredJson).not.toContain(sentinel)

    // (b) The zip holds only manifest.json + forms/** — no server/vault/target path.
    const archive = await buildWorkspaceArchive(gathered, appVersion(), new Date().toISOString())
    const zip = await JSZip.loadAsync(archive)
    const paths = Object.keys(zip.files)
    expect(paths).toContain('manifest.json')
    for (const path of paths) {
      expect(path === 'manifest.json' || path.startsWith('forms/')).toBe(true)
    }

    // (c) The serialized archive text contains none of the seeded material.
    let allText = ''
    for (const path of paths) allText += await zip.files[path].async('string')
    for (const sentinel of SENTINELS) expect(allText).not.toContain(sentinel)
  })
})
