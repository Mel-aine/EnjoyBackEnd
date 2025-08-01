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

export default class LoggerService {
  public static async log(data: LogData) {
    try {
      const actor = await User.find(data.actorId)

      await ActivityLog.create({
        userId: data.actorId,
        username: actor?.first_name || 'System',
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
