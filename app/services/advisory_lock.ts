import db from '@adonisjs/lucid/services/db'

/**
 * Postgres advisory locks for background jobs (hub and Channex syncs).
 *
 * Several enjoy instances (or a web server plus an ace command) can run the
 * same job at once. A transaction-level lock keyed on (namespace, id) lets only
 * one of them work on a given hotel; the lock is released when `fn` ends.
 *
 * The transaction only holds the lock: `fn` uses its own connections.
 */
export const LockNamespace = {
  channexBookingSync: 7301,
  hubBookingSync: 7302,
  hubCancelSync: 7303,
  hubAvailabilityPush: 7304,
  channexAvailabilityResync: 7305,
} as const

/** Runs `fn` if the lock is free; returns `{ locked: true }` otherwise. */
export async function withTryLock<T>(
  namespace: number,
  id: number,
  fn: () => Promise<T>
): Promise<{ locked: true } | { locked: false; value: T }> {
  return db.transaction(async (trx) => {
    const res: any = await trx.rawQuery('select pg_try_advisory_xact_lock(?, ?) as locked', [
      namespace,
      id,
    ])
    if (!res?.rows?.[0]?.locked) return { locked: true as const }
    return { locked: false as const, value: await fn() }
  })
}

/** Waits for the lock, then runs `fn`. */
export async function withLock<T>(namespace: number, id: number, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.rawQuery('select pg_advisory_xact_lock(?, ?)', [namespace, id])
    return fn()
  })
}
