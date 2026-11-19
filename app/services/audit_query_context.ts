import { createRequire } from 'node:module'
import { annotateAuditQuery } from './audit_context.js'
import { reportAuditFailure } from './audit_diagnostics.js'

/**
 * Knex's PostgreSQL execution boundary is shared by ORM, bulk/raw queries and
 * cloned transaction clients. Keep this small adapter covered when upgrading Knex.
 */
export function installAuditQueryContext() {
  const require = createRequire(import.meta.url)
  const PostgresClient = require('knex/lib/dialects/postgres/index.js')
  const marker = Symbol.for('enjoy.audit.queryContext')
  if (PostgresClient.prototype[marker]) return
  const original = PostgresClient.prototype._query
  PostgresClient.prototype._query = function (connection: unknown, query: any) {
    try {
      return Promise.resolve(
        original.call(this, connection, { ...query, sql: annotateAuditQuery(query.sql) })
      ).catch((error: unknown) => {
        reportAuditFailure('DATABASE_QUERY_FAILED', error, { method: query.method ?? 'raw' })
        throw error
      })
    } catch (error) {
      reportAuditFailure('DATABASE_QUERY_FAILED', error, { method: query.method ?? 'raw' })
      throw error
    }
  }
  PostgresClient.prototype[marker] = true
}
