import { getAuditContext } from './audit_context.js'

/** Independent of the database: survives a failed SQL statement/transaction. */
export function reportAuditFailure(
  event: string,
  error: unknown,
  details: Record<string, unknown> = {}
) {
  const value = error as { code?: unknown; name?: unknown }
  const context = getAuditContext()
  console.error(
    JSON.stringify({
      event,
      occurredAtUtc: new Date().toISOString(),
      operationId: context?.operationId ?? null,
      actorId: context?.actorId ?? null,
      hotelId: context?.hotelId ?? null,
      source: context?.source ?? 'system',
      path: context?.path ?? null,
      httpMethod: context?.method ?? null,
      errorCode: typeof value?.code === 'string' ? value.code : null,
      errorType: typeof value?.name === 'string' ? value.name : 'Error',
      ...details,
    })
  )
}
