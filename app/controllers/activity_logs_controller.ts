import type { HttpContext } from '@adonisjs/core/http'
import ActivityLog from '#models/activity_log'

export default class ActivityLogsController {
  /**
   * Display a list of all activity logs.
   */
  public async index({ response }: HttpContext) {
    try {
      const logs = await ActivityLog.query().preload('user').orderBy('createdAt', 'desc')
      return response.ok(logs)
    } catch (error) {
      console.error('Error fetching activity logs:', error)
      return response.internalServerError({ message: 'Failed to fetch activity logs' })
    }
  }

  /**
   * Create a new activity log.
   */
  public async store({ request, response }: HttpContext) {
    const payload :any = request.only([
      'userId',
      'username',
      'action',
      'entityType',
      'entityId',
      'description',
      'changes',
      'createdBy',
    ])

    // Automatically add request-specific details
    payload.ipAddress = request.ip()
    payload.userAgent = request.header('user-agent')

    try {
      const log = await ActivityLog.create(payload)
      return response.created(log)
    } catch (error) {
      console.error('Error creating activity log:', error)
      return response.badRequest({ message: 'Failed to create activity log', error: error.message })
    }
  }

  /**
   * Show a single activity log by its ID.
   */
  public async show({ params, response }: HttpContext) {
    try {
      const log = await ActivityLog.query()
        .where('id', params.id)
        .preload('user')
        .preload('creator')
        .firstOrFail()
      return response.ok(log)
    } catch (error) {
      return response.notFound({ message: 'Activity log not found' })
    }
  }

  /**
   * Update an existing activity log.
   */
  public async update({ params, request, response }: HttpContext) {
    const payload = request.only(['description', 'changes'])

    try {
      const log = await ActivityLog.findOrFail(params.id)
      log.merge(payload)
      await log.save()
      return response.ok(log)
    } catch (error) {
      console.error('Error updating activity log:', error)
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Activity log not found' })
      }
      return response.badRequest({ message: 'Failed to update activity log', error: error.message })
    }
  }

  /**
   * Get logs by entity type and ID from query parameters.
   * Example: /api/activity-logs/by-entity?entityType=Reservation&entityId=123
   */
  public async showByEntity({ request, response }: HttpContext) {
    const { entityType, entityId } = request.qs()

    if (!entityType || !entityId) {
      return response.badRequest({ message: 'entityType and entityId are required query parameters.' })
    }

    const logs = await ActivityLog.query()
      .where('entityType', entityType)
      .where('entityId', entityId)
      .preload('user')
      .orderBy('createdAt', 'desc')

    return response.ok(logs)
  }

  /**show by user */

public async showByUser({ params, response }: HttpContext) {
  const { createdBy } = params

  if (!createdBy) {
    return response.badRequest({ message: 'createdBy is a required route parameter.' })
  }

  const logs = await ActivityLog.query()
    .where('created_by', createdBy)
    .preload('user')
    .orderBy('createdAt', 'desc')

  return response.ok(logs)
}



}
