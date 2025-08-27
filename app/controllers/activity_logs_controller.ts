import type { HttpContext } from '@adonisjs/core/http'
import ActivityLog from '#models/activity_log'
import Guest from '#models/guest'
import { DateTime } from 'luxon'


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

   /**
   * Récupère le journal d'audit pour un invité spécifique.
   */

  public async getActivityLogs({ request, response, params }: HttpContext) {
  const hotelId = params.hotelId
  const guestId = params.guestId

  // sécurité : le guest doit appartenir à l'hôtel
  await Guest.query()
    .where('hotel_id', hotelId)
    .andWhere('id', guestId)
    .firstOrFail()

  const page   = request.input('page', 1)
  const limit  = request.input('limit', 15)
  const action = request.input('action') as string | undefined
  const date   = request.input('date') as string | undefined
  const userId = request.input('userId') as number | undefined

  const query = ActivityLog.query()
    .where('hotel_id', hotelId)
    .where('entity_type', 'Guest')
    .where('entity_id', guestId)
    .preload('user', (q) => q.select(['id', 'firstName', 'lastName']))
    .orderBy('created_at', 'desc')

  if (action) {
    query.where('action', action.toUpperCase())
  }
  if (date) {
    const start = DateTime.fromISO(date).startOf('day').toSQL()
    const end   = DateTime.fromISO(date).endOf('day').toSQL()

    if (start && end) {
      query.whereBetween('created_at', [start, end])
    }
  }

  if (userId) {
    query.where('user_id', userId)
  }

  const logs = await query.paginate(page, limit)

  const formattedLogs = logs.toJSON().data.map((log) => ({
    id: log.id,
    action: log.action,
    description: log.description,
    changes: log.changes || {},
    meta: log.meta || {},
    timestamp: log.createdAt.toISO(),
    userId: log.user?.id,
    userName: [log.user?.firstName, log.user?.lastName].filter(Boolean).join(' ') || null,
    ipAddress: log.ipAddress || null,
    userAgent: log.userAgent || null,
    entityId: log.entityId,
    entityType: log.entityType,
  }))

  return response.ok({
    meta: logs.toJSON().meta,
    data: formattedLogs,
  })
}

}
