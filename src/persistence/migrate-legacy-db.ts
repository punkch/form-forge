import type { DexieOptions } from 'dexie'

import { BuilderDb, CURRENT_DB_NAME, LEGACY_DB_NAME } from './db'

/**
 * One-time rename migration: the workspace database was renamed from
 * `odk-form-builder` (pre-rebrand) to `form-forge`. IndexedDB has no rename and
 * is origin-scoped, so a returning user's forms, attachments, templates and
 * Central data live in the old database under the old name. On first load after
 * the rename we copy every store from the legacy database into the new one, then
 * delete the legacy database.
 *
 * Idempotent and safe to call on every non-embed startup:
 *  - no-op when the legacy database does not exist (fresh install, or already
 *    migrated and deleted);
 *  - no-op when the new `form-forge` database already holds data (never clobbers
 *    it — if that happens the legacy DB is left untouched for manual recovery).
 *
 * MUST run before any store opens the `db` singleton: if `form-forge` is opened
 * and written first, the guard below treats the migration as done and the legacy
 * data is stranded. `main.ts` awaits this before `app.mount`.
 *
 * `options` lets specs inject an isolated `IDBFactory`; production passes none
 * and uses the global `indexedDB`. Returns whether data was copied.
 */
export async function migrateLegacyDb (options?: DexieOptions): Promise<boolean> {
  // DexieOptions.indexedDB is loosely typed ({ open } structural), so narrow it.
  const factory: IDBFactory | undefined =
    (options?.indexedDB as IDBFactory | undefined) ??
    (typeof indexedDB !== 'undefined' ? indexedDB : undefined)
  if (factory === undefined) return false

  // Cheap probe first: most loads have no legacy DB, so avoid opening anything.
  if (!(await databaseExists(factory, LEGACY_DB_NAME))) return false

  const legacy = new BuilderDb(options, LEGACY_DB_NAME)
  const current = new BuilderDb(options, CURRENT_DB_NAME)
  try {
    // Never overwrite a new database that is already in use.
    if (await hasAnyRows(current)) return false

    // Read every legacy store fully BEFORE opening the write transaction: awaiting
    // a query on `legacy` inside a `current` transaction would let that
    // transaction auto-commit early (Dexie transactions are per-database).
    const stores: Array<{ name: string, rows: unknown[] }> = []
    for (const table of legacy.tables) {
      const rows = await table.toArray()
      if (rows.length > 0) stores.push({ name: table.name, rows })
    }
    if (stores.length === 0) return false

    await current.transaction('rw', current.tables, async () => {
      for (const { name, rows } of stores) {
        await current.table(name).bulkPut(rows)
      }
    })
  } finally {
    legacy.close()
    current.close()
  }

  await deleteDatabase(factory, LEGACY_DB_NAME)
  return true
}

/** True when any table in `db` holds at least one row. */
async function hasAnyRows (db: BuilderDb): Promise<boolean> {
  for (const table of db.tables) {
    if ((await table.count()) > 0) return true
  }
  return false
}

/**
 * Whether a database of this name exists, without creating it. Opening with no
 * version creates the DB (firing `upgradeneeded`) when absent; we detect that,
 * delete the just-created empty DB, and report non-existence.
 */
function databaseExists (factory: IDBFactory, name: string): Promise<boolean> {
  return new Promise((resolve) => {
    let existed = true
    const request = factory.open(name)
    request.onupgradeneeded = (): void => { existed = false }
    request.onsuccess = (): void => {
      request.result.close()
      if (existed) {
        resolve(true)
      } else {
        // We accidentally created it — clean up and report it never existed.
        deleteDatabase(factory, name).then(() => resolve(false), () => resolve(false))
      }
    }
    request.onerror = (): void => resolve(false)
    request.onblocked = (): void => resolve(existed)
  })
}

/** Delete a database, resolving on success, error or block alike. */
function deleteDatabase (factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = factory.deleteDatabase(name)
    request.onsuccess = request.onerror = request.onblocked = (): void => resolve()
  })
}
