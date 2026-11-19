import ActivityLog from '#models/activity_log'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { auditChanges, getAuditContext, redactAuditValue } from '#services/audit_context'

interface ChangeLog {
  [key: string]: { old: any; new: any }
}

interface LogData {
  actorId: number
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'CHECK_IN' | 'CHECK_OUT' | string
  entityType: string
  entityId: number | string
  description?: string
  changes?: ChangeLog
  ctx?: HttpContext | { request?: any; response?: any }
  meta?:Record<string,any>
  hotelId?:number
  ipAddress?: string
  userAgent?: string
  reservationId?: number | null
}

interface LogActivityData {
  userId?: number
  action: string
  resourceType?: string
  resourceId?: number | string
  details?: any
  description?: string
  ipAddress?: string
  userAgent?: string
  hotelId?: number
  // Tolerate alias fields used by some callers
  actorId?: number
  entityType?: string
  entityId?: number | string
  changes?: any
  reservationId?: number | null
  ctx?: HttpContext
  meta?: Record<string, any>
}

export default class LoggerService {
  private static _extractIpAndUa(data: {
    ctx?: any
    ipAddress?: string | null
    userAgent?: string | null
  }): { ipAddress: string | null; userAgent: string | null } {
    let ipAddress: string | null = data.ipAddress ?? getAuditContext()?.ipAddress ?? null
    let userAgent: string | null = data.userAgent ?? getAuditContext()?.userAgent ?? null

    if (!ipAddress || !userAgent) {
      const req = data.ctx?.request
      if (req) {
        try {
          if (!ipAddress && typeof req.ip === 'function') {
            ipAddress = req.ip() ?? null
          } else if (!ipAddress && typeof req.ip === 'string') {
            ipAddress = req.ip
          }
        } catch { /* ignore */ }
        try {
          if (!userAgent && typeof req.header === 'function') {
            userAgent = req.header('user-agent') ?? null
          } else if (!userAgent && typeof req.headers === 'object' && req.headers) {
            const ua = req.headers['user-agent']
            userAgent = Array.isArray(ua) ? ua[0] ?? null : (ua ?? null)
          }
        } catch { /* ignore */ }
      }
    }

    return { ipAddress, userAgent }
  }

  public static async log(data: LogData, trx?: TransactionClientContract) {
    try {
      const actor = await User.find(data.actorId)

      const numericEntityId =
        data.entityId === undefined || data.entityId === null ? null : Number(data.entityId)
      const entityId = Number.isNaN(numericEntityId as any) ? null : numericEntityId

      const { ipAddress, userAgent } = this._extractIpAndUa(data)

      await ActivityLog.create({
        userId: data.actorId,
        username: actor?.fullName || '',
        action: data.action,
        entityType: data.entityType,
        entityId,
        reservationId: data.reservationId ?? null,
        description: data.description,
        changes: redactAuditValue(data.changes),
        meta: redactAuditValue({ ...getAuditContext(), ...data.meta }),
        hotelId: data.hotelId ?? getAuditContext()?.hotelId ?? null,
        createdBy: data.actorId,
        ipAddress,
        userAgent,
      }, trx ? { client: trx } : undefined)
    } catch (error) {
      console.error('🔴 Failed to create activity log:', error)
      if (trx) throw error
    }
  }

  public static async bulkLog(dataArray: LogData[]) {
    try {
      if (!dataArray || dataArray.length === 0) {
        return
      }

      // Get unique actor IDs to minimize database queries
      const actorIds = [...new Set(dataArray.map(data => data.actorId))]
      const actors = await User.query().whereIn('id', actorIds)
      const actorMap = new Map(actors.map(actor => [actor.id, actor]))

      // Prepare bulk insert data
      const bulkData = dataArray.map(data => {
        const actor = actorMap.get(data.actorId)
        const { ipAddress, userAgent } = this._extractIpAndUa(data)
        return {
          userId: data.actorId,
          username: actor?.fullName || '',
          action: data.action,
          entityType: data.entityType,
          entityId: Number(data.entityId),
          reservationId: data.reservationId ?? null,
          description: data.description,
          changes: redactAuditValue(data.changes),
          meta: redactAuditValue({ ...getAuditContext(), ...data.meta }),
          hotelId: data.hotelId ?? getAuditContext()?.hotelId ?? null,
          createdBy: data.actorId,
          ipAddress,
          userAgent,
        }
      })

      // Bulk insert all logs
      await ActivityLog.createMany(bulkData)
    } catch (error) {
      console.error('🔴 Failed to create bulk activity logs:', error)
    }
  }

  public static async logActivity(data: LogActivityData, trx?: any) {
    try {
      // Accept both proper keys and common alias keys
      const userId = data.userId ?? data.actorId ?? null
      const actor = userId ? await User.find(userId) : null

      const resourceType = data.resourceType ?? data.entityType ?? 'System'
      const rawResourceId = data.resourceId ?? data.entityId
      const numericEntityId =
        rawResourceId === undefined || rawResourceId === null
          ? null
          : Number(rawResourceId)

      const entityId = Number.isNaN(numericEntityId as any) ? null : numericEntityId

      const ipAddress = data.ipAddress ?? data.ctx?.request?.ip() ?? null
      const userAgent = data.userAgent ?? data.ctx?.request?.header('user-agent') ?? null

      const fullName = actor?.firstName && actor?.lastName ? `${actor.firstName} ${actor.lastName}` : actor?.username ?? 'System'

      const logData = {
        userId,
        username: fullName,
        action: data.action,
        entityType: resourceType,
        entityId,
        reservationId: data.reservationId ?? null,
        description: data.description || null,
        changes: redactAuditValue(data.details ?? data.changes),
        meta: redactAuditValue({ ...getAuditContext(), ...data.meta }),
        hotelId: data.hotelId ?? getAuditContext()?.hotelId ?? null,
        createdBy: userId,
        ipAddress,
        userAgent,
      }

      if (trx) {
        await ActivityLog.create(logData, { client: trx })
      } else {
        await ActivityLog.create(logData)
      }
    } catch (error) {
      console.error('🔴 Failed to create activity log:', error)
      if (trx) throw error
    }
  }

  /**
   *  Compare les champs pour log les changements
   */
  public static extractChanges<T extends object>(oldData: T, newData: T): ChangeLog {
    return auditChanges(oldData, newData)
  }
}
