import ActivityLog from '#models/activity_log'
import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Interface for the data required to create a log entry.
 */
interface LogData {
  actorId: number // The ID of the user performing the action (the "who")
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'CHECK_IN' | 'CHECK_OUT' | string // The action (the "what")
  entityType: string // The type of entity affected, e.g., "Reservation"
  entityId: number | string // The ID of the entity
  description?: string // A human-readable summary of the action
  changes?: Record<string, any> // Optional: For tracking detailed changes (before/after)
  ctx: HttpContext // Pass the controller's context to get IP, etc.
}

export default class LoggerService {
  /**
   * Creates a new activity log entry.
   * @param data The data for the log entry.
   */
  public static async log(data: LogData) {
    try {
      const actor = await User.find(data.actorId)

      await ActivityLog.create({
        userId: data.actorId,
        username: actor?.first_name || 'System', // Use actor's name or a default
        action: data.action,
        entityType: data.entityType,
        entityId: Number(data.entityId),
        description: data.description,
        changes: data.changes,
        createdBy: data.actorId,
        ipAddress: data.ctx.request.ip(),
        userAgent: data.ctx.request.header('user-agent'),
      })
    } catch (error) {
      console.error('🔴 Failed to create activity log:', error)
      // We log the error but don't throw, as a logging failure
      // should not typically crash the primary operation (e.g., creating a reservation).
    }
  }
}