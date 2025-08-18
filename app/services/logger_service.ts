import ActivityLog from '#models/activity_log'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

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
  ctx: HttpContext
}

interface LogActivityData {
  userId?: number
  action: string
  resourceType: string
  resourceId: number | string
  details?: any
  ipAddress?: string
  userAgent?: string
}

export default class LoggerService {
  public static async log(data: LogData) {
    try {
      const actor = await User.find(data.actorId)

      await ActivityLog.create({
        userId: data.actorId,
        username: actor?.firstName || 'System',
        action: data.action,
        entityType: data.entityType,
        entityId: Number(data.entityId),
        description: data.description,
        changes: data.changes ?? null, 
        createdBy: data.actorId,
        ipAddress: data.ctx.request.ip(),
        userAgent: data.ctx.request.header('user-agent'),
      })
    } catch (error) {
      console.error('🔴 Failed to create activity log:', error)
    }
  }

  public static async logActivity(data: LogActivityData, trx?: any) {
    try {
      const actor = data.userId ? await User.find(data.userId) : null

      const logData = {
        userId: data.userId || null,
        username: actor?.firstName || 'System',
        action: data.action,
        entityType: data.resourceType,
        entityId: Number(data.resourceId),
        description: JSON.stringify(data.details) || null,
        changes: data.details ?? null,
        createdBy: data.userId || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      }

      if (trx) {
        await ActivityLog.create(logData, { client: trx })
      } else {
        await ActivityLog.create(logData)
      }
    } catch (error) {
      console.error('🔴 Failed to create activity log:', error)
    }
  }

  /**
   *  Compare les champs pour log les changements
   */
  public static extractChanges<T extends object>(oldData: T, newData: T): ChangeLog {
    const changes: ChangeLog = {}

    for (const key of Object.keys(newData)) {
      const oldValue = (oldData as any)[key]
      const newValue = (newData as any)[key]

      if (oldValue !== newValue) {
        changes[key] = { old: oldValue, new: newValue }
      }
    }

    return changes
  }
}
