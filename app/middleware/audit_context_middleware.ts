import { randomUUID } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { getAuditContext, redactAuditValue, withAuditContext } from '#services/audit_context'
import { auditEnabled } from '#services/audit_enabled'
import { reportAuditFailure } from '#services/audit_diagnostics'

export default class AuditContextMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (!auditEnabled()) return next()
    const operationId = randomUUID()
    const requestedAtUtc = new Date().toISOString()
    let actorId: number | null = null
    let actorName: string | null = null
    ctx.response.header('X-Audit-Operation-Id', operationId)
    return withAuditContext(
      () => {
        // Logout may clear auth.user before the completion event is written.
        if (ctx.auth?.user) {
          actorId = ctx.auth.user.id
          actorName = ctx.auth.user.fullName
        }
        return {
          operationId,
          requestedAtUtc,
          actorId,
          actorName,
          hotelId:
            Number(
              ctx.params.hotelId ??
                ctx.request.input('hotelId') ??
                ctx.request.input('hotel_id') ??
                ctx.auth?.user?.hotelId
            ) || null,
          source: 'http',
          method: ctx.request.method(),
          path: ctx.route?.pattern ?? ctx.request.url(),
          ipAddress: ctx.request.ip(),
          userAgent: ctx.request.header('user-agent'),
          reason:
            String(ctx.request.input('reason') ?? ctx.request.input('voidReason') ?? '').slice(
              0,
              2000
            ) || null,
        }
      },
      async () => {
        const started = Date.now()
        const startContext = getAuditContext()!
        const rawPayload = JSON.stringify(redactAuditValue(ctx.request.body()))
        const payload =
          rawPayload.length <= 32768
            ? JSON.parse(rawPayload)
            : { omitted: true, reason: 'payload exceeds 32KB' }
        const query = redactAuditValue(ctx.request.qs())
        const params = redactAuditValue(ctx.params)
        try {
          await db.table('activity_logs').insert({
            action: 'HTTP_ACTION_STARTED',
            entity_type: 'HttpRequest',
            user_id: startContext.actorId,
            username: startContext.actorName ?? 'Anonymous/System',
            hotel_id: startContext.hotelId,
            description: `${startContext.method} ${startContext.path}`,
            meta: JSON.stringify({ ...startContext, payload, query, params }),
          })
        } catch (error) {
          reportAuditFailure('HTTP_AUDIT_START_FAILED', error)
          throw error
        }
        let failed = false
        let failureStatus = 500
        try {
          return await next()
        } catch (error) {
          failed = true
          if (Number.isInteger(error.status) && error.status >= 400 && error.status <= 599)
            failureStatus = error.status
          throw error
        } finally {
          // Never persist response bodies, auth headers, uploaded files or PDF bytes here.
          const context = getAuditContext()!
          const candidateHotel = Number(
            ctx.params.hotelId ?? ctx.request.input('hotelId') ?? ctx.request.input('hotel_id')
          )
          try {
            await db.table('activity_logs').insert({
              user_id: context.actorId,
              username: context.actorName ?? 'Anonymous/System',
              created_by: context.actorId,
              hotel_id:
                Number.isSafeInteger(candidateHotel) && candidateHotel > 0
                  ? candidateHotel
                  : context.hotelId,
              action:
                failed || ctx.response.getStatus() >= 400
                  ? 'HTTP_ACTION_FAILED'
                  : 'HTTP_ACTION_COMPLETED',
              entity_type: 'HttpRequest',
              description: `${context.method} ${context.path}`,
              ip_address: context.ipAddress,
              user_agent: context.userAgent,
              meta: JSON.stringify({
                ...context,
                status: failed ? failureStatus : ctx.response.getStatus(),
                durationMs: Date.now() - started,
                occurredAtUtc: new Date().toISOString(),
                params,
                query,
                payload,
              }),
            })
          } catch (auditError) {
            // Row audits already committed with their business data. Preserve the
            // original response/error and make this secondary failure observable.
            reportAuditFailure('HTTP_AUDIT_COMPLETION_FAILED', auditError, {
              status: failed ? failureStatus : ctx.response.getStatus(),
            })
          }
        }
      }
    )
  }
}
