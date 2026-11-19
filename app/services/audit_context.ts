import { AsyncLocalStorage } from 'node:async_hooks'
import { isDeepStrictEqual } from 'node:util'

export interface AuditContext {
  operationId: string
  actorId?: number | null
  actorName?: string | null
  source: string
  method?: string
  path?: string
  ipAddress?: string
  userAgent?: string
  reason?: string | null
  hotelId?: number | null
  requestedAtUtc?: string
}

// A reader resolves the authenticated user at query time, after auth middleware.
const storage = new AsyncLocalStorage<() => AuditContext>()

export function withAuditContext<T>(
  context: AuditContext | (() => AuditContext),
  callback: () => T
): T {
  return storage.run(typeof context === 'function' ? context : () => context, callback)
}

export function getAuditContext(): AuditContext | undefined {
  return storage.getStore()?.()
}

const sensitiveKey =
  /password|secret|token|authorization|cookie|api.?key|private.?key|otp|recovery.?code|card.?number|cvv|passport|id.?photo|id.?number|hash|credential|(^|_)(key|salt)$/i

export function redactAuditValue(value: any): any {
  if (value === null || value === undefined) return value ?? null
  if (Buffer.isBuffer(value)) return '[BINARY]'
  if (Array.isArray(value)) return value.map(redactAuditValue)
  if (typeof value === 'object') {
    if (typeof value.toJSON === 'function') return redactAuditValue(value.toJSON())
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : redactAuditValue(item),
      ])
    )
  }
  return value
}

/** One statement-local comment: no connection/session state to leak via pools. */
export function annotateAuditQuery(sql: string, context = getAuditContext()): string {
  if (!context) return sql
  const encoded = Buffer.from(
    JSON.stringify({
      ...context,
      actorName: context.actorName?.slice(0, 255),
      path: context.path?.split('?')[0].slice(0, 2048),
      userAgent: context.userAgent?.slice(0, 1024),
      reason: context.reason?.slice(0, 2000),
    })
  ).toString('base64')
  return `/*enjoy_audit:${encoded}*/ ${sql}`
}

export function auditChanges(
  oldData: object,
  newData: object
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {}
  for (const key of new Set([...Object.keys(oldData), ...Object.keys(newData)])) {
    const previous = (oldData as any)[key]
    const following = (newData as any)[key]
    if (!isDeepStrictEqual(previous, following))
      changes[key] = { old: previous ?? null, new: following ?? null }
  }
  return changes
}
