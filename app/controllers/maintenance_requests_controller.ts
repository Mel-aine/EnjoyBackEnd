import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import MaintenanceRequest from '#models/maintenance_request'
import { createMaintenanceRequestValidator, updateMaintenanceRequestValidator } from '#validators/maintenance_request'
import LoggerService from '#services/logger_service'

export default class MaintenanceRequestsController {
  /**
   * Display a list of maintenance requests
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = request.input('hotel_id')
      const roomId = request.input('room_id')
      const category = request.input('category')
      const priority = request.input('priority')
      const status = request.input('status')
      const assignedTo = request.input('assigned_to')
      const isOverdue = request.input('is_overdue')
      const isEmergency = request.input('is_emergency')

      const query = MaintenanceRequest.query()

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (roomId) {
        query.where('room_id', roomId)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('request_number', 'ILIKE', `%${search}%`)
            .orWhere('title', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
        })
      }

      if (category) {
        query.where('category', category)
      }

      if (priority) {
        query.where('priority', priority)
      }

      if (status) {
        query.where('status', status)
      }

      if (assignedTo) {
        query.where('assigned_to', assignedTo)
      }

      if (isOverdue === 'true') {
        query.whereRaw('scheduled_date < NOW() AND status NOT IN (?)', [['completed', 'cancelled']])
      }

      if (isEmergency === 'true') {
        query.where('priority', 'emergency')
      }

      const maintenanceRequests = await query
        .preload('hotel')
        .preload('room')
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok({
        message: 'Maintenance requests retrieved successfully',
        data: maintenanceRequests
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve maintenance requests',
        error: error.message
      })
    }
  }

  /**
   * Create a new maintenance request
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createMaintenanceRequestValidator)
      
      // Generate request number
      const lastRequest = await MaintenanceRequest.query()
        .where('hotel_id', payload.hotelId)
        .orderBy('created_at', 'desc')
        .first()
      
      const requestNumber = `MR-${payload.hotelId}-${String((lastRequest?.id || 0) + 1).padStart(6, '0')}`
      
      // Handle DateTime fields and null values
      const requestData = {
        ...payload,
        requestNumber,
        reportedBy: auth.user?.id || 0,
        createdBy: auth.user?.id || 0,
        // Convert date fields to DateTime if present (only fields available in create validator)
        scheduledDate: payload.scheduledDate ? DateTime.fromJSDate(new Date(payload.scheduledDate)) : undefined,
        dueDate: payload.dueDate ? DateTime.fromJSDate(new Date(payload.dueDate)) : undefined,
        outOfOrderFrom: payload.outOfOrderFrom ? DateTime.fromJSDate(new Date(payload.outOfOrderFrom)) : undefined,
        outOfOrderTo: payload.outOfOrderTo ? DateTime.fromJSDate(new Date(payload.outOfOrderTo)) : undefined,
        installationDate: payload.installationDate ? DateTime.fromJSDate(new Date(payload.installationDate)) : undefined,
        lastMaintenanceDate: payload.lastMaintenanceDate ? DateTime.fromJSDate(new Date(payload.lastMaintenanceDate)) : undefined,
        nextMaintenanceDate: payload.nextMaintenanceDate ? DateTime.fromJSDate(new Date(payload.nextMaintenanceDate)) : undefined
      }

      const maintenanceRequest = await MaintenanceRequest.create(requestData)

      await maintenanceRequest.load('hotel')
    await maintenanceRequest.load('room')

    await LoggerService.log({
      actorId: auth.user?.id!,
      action: 'CREATE_MAINTENANCE_REQUEST',
      entityType: 'MaintenanceRequest',
      entityId: maintenanceRequest.id,
      hotelId: maintenanceRequest.hotelId,
      description: `Maintenance request #${maintenanceRequest.requestNumber} created for ${maintenanceRequest.room?.roomNumber || 'Unknown Room'}`,
      changes: LoggerService.extractChanges({}, maintenanceRequest.serialize()),
      ctx: { request, response } as any
    })

    return response.created({ message: 'Maintenance request created successfully', data: maintenanceRequest })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create maintenance request',
        error: error.message
      })
    }
  }

  /**
   * Show a specific maintenance request
   */
  async show({ params, response }: HttpContext) {
    try {
      const maintenanceRequest = await MaintenanceRequest.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('room')
        .firstOrFail()

      return response.ok({
        message: 'Maintenance request retrieved successfully',
        data: maintenanceRequest
      })
    } catch (error) {
      return response.notFound({
        message: 'Maintenance request not found',
        error: error.message
      })
    }
  }

  /**
   * Update a maintenance request
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const maintenanceRequest = await MaintenanceRequest.findOrFail(params.id)
      const payload = await request.validateUsing(updateMaintenanceRequestValidator)
      const oldRequest = maintenanceRequest.serialize()

      // Handle DateTime fields and null values
      const updateData = {
        ...payload,
        lastModifiedBy: auth.user?.id || 0,
        // Convert date fields to DateTime if present
        scheduledDate: payload.scheduledDate ? DateTime.fromJSDate(new Date(payload.scheduledDate)) : payload.scheduledDate,
        dueDate: payload.dueDate ? DateTime.fromJSDate(new Date(payload.dueDate)) : payload.dueDate,
        outOfOrderFrom: payload.outOfOrderFrom ? DateTime.fromJSDate(new Date(payload.outOfOrderFrom)) : payload.outOfOrderFrom,
        outOfOrderTo: payload.outOfOrderTo ? DateTime.fromJSDate(new Date(payload.outOfOrderTo)) : payload.outOfOrderTo,
        followUpDate: payload.followUpDate ? DateTime.fromJSDate(new Date(payload.followUpDate)) : payload.followUpDate,
        installationDate: payload.installationDate ? DateTime.fromJSDate(new Date(payload.installationDate)) : payload.installationDate,
        lastMaintenanceDate: payload.lastMaintenanceDate ? DateTime.fromJSDate(new Date(payload.lastMaintenanceDate)) : payload.lastMaintenanceDate,
        nextMaintenanceDate: payload.nextMaintenanceDate ? DateTime.fromJSDate(new Date(payload.nextMaintenanceDate)) : payload.nextMaintenanceDate
      }

      maintenanceRequest.merge(updateData)

      await maintenanceRequest.save()
      await maintenanceRequest.load('hotel')
      await maintenanceRequest.load('room')

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'UPDATE_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        entityId: maintenanceRequest.id,
        hotelId: maintenanceRequest.hotelId,
        description: `Maintenance request #${maintenanceRequest.requestNumber} updated`,
        changes: LoggerService.extractChanges(oldRequest, maintenanceRequest.serialize()),
        ctx: { request, response } as any
      })

      return response.ok({
        message: 'Maintenance request updated successfully',
        data: maintenanceRequest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update maintenance request',
        error: error.message
      })
    }
  }

  /**
   * Delete a maintenance request
   */
  async destroy({ params, response, auth, request }: HttpContext) {
    try {
      const maintenanceRequest = await MaintenanceRequest.findOrFail(params.id)
      
      // Only allow deletion if not started
      if (['in_progress', 'completed'].includes(maintenanceRequest.status)) {
        return response.badRequest({
          message: 'Cannot delete maintenance request that is in progress or completed'
        })
      }

      await maintenanceRequest.delete()

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'DELETE_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        entityId: maintenanceRequest.id,
        hotelId: maintenanceRequest.hotelId,
        description: `Maintenance request #${maintenanceRequest.requestNumber} deleted`,
        changes: {},
        ctx: { request, response } as any
      })

      return response.ok({
        message: 'Maintenance request deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete maintenance request',
        error: error.message
      })
    }
  }

  /**
   * Assign maintenance request
   */
  async assign({ params, request, response, auth }: HttpContext) {
    try {
      const maintenanceRequest = await MaintenanceRequest.findOrFail(params.id)
      const oldRequest = maintenanceRequest.serialize()
      const { assignedTo, scheduledDate, notes } = request.only(['assignedTo', 'scheduledDate', 'notes'])
      
      if (!assignedTo) {
        return response.badRequest({
          message: 'Assigned to is required'
        })
      }

      maintenanceRequest.assignedTo = assignedTo
      if (scheduledDate) {
        maintenanceRequest.scheduledDate = DateTime.fromJSDate(new Date(scheduledDate))
      }
      maintenanceRequest.status = 'assigned'
      maintenanceRequest.resolutionNotes = notes
      maintenanceRequest.lastModifiedBy = auth.user?.id || 0
      
      await maintenanceRequest.save()

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'ASSIGN_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        entityId: maintenanceRequest.id,
        hotelId: maintenanceRequest.hotelId,
        description: `Maintenance request #${maintenanceRequest.requestNumber} assigned to user #${assignedTo}`,
        changes: LoggerService.extractChanges(oldRequest, maintenanceRequest.serialize()),
        ctx: { request, response } as any
      })

      return response.ok({
        message: 'Maintenance request assigned successfully',
        data: maintenanceRequest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to assign maintenance request',
        error: error.message
      })
    }
  }

  /**
   * Start work on maintenance request
   */
  async startWork({ params, request, response, auth }: HttpContext) {
    try {
      const maintenanceRequest = await MaintenanceRequest.findOrFail(params.id)
      const oldRequest = maintenanceRequest.serialize()
      const { notes } = request.only(['notes'])
      
      if (maintenanceRequest.status !== 'assigned') {
        return response.badRequest({
          message: 'Can only start work on assigned requests'
        })
      }

      maintenanceRequest.status = 'in_progress'
      maintenanceRequest.workPerformed = notes
      maintenanceRequest.lastModifiedBy = auth.user?.id || 0
      
      await maintenanceRequest.save()

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'START_WORK_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        entityId: maintenanceRequest.id,
        hotelId: maintenanceRequest.hotelId,
        description: `Work started on maintenance request #${maintenanceRequest.requestNumber}`,
        changes: LoggerService.extractChanges(oldRequest, maintenanceRequest.serialize()),
        ctx: { request, response } as any
      })

      return response.ok({
        message: 'Work started on maintenance request',
        data: maintenanceRequest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to start work',
        error: error.message
      })
    }
  }

  /**
   * Complete maintenance request
   */
  async complete({ params, request, response, auth }: HttpContext) {
    try {
      const maintenanceRequest = await MaintenanceRequest.findOrFail(params.id)
      const oldRequest = maintenanceRequest.serialize()
      const { workPerformed, actualCost, resolutionNotes, qualityRating } = request.only([
        'workPerformed', 'actualCost', 'resolutionNotes', 'qualityRating'
      ])
      
      if (maintenanceRequest.status !== 'in_progress') {
        return response.badRequest({
          message: 'Can only complete requests that are in progress'
        })
      }

      maintenanceRequest.status = 'completed'
      maintenanceRequest.completedAt = DateTime.now()
      maintenanceRequest.workPerformed = workPerformed
      maintenanceRequest.actualCost = actualCost
      maintenanceRequest.resolutionNotes = resolutionNotes
      maintenanceRequest.qualityRating = qualityRating
      maintenanceRequest.lastModifiedBy = auth.user?.id || 0
      
      await maintenanceRequest.save()

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'COMPLETE_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        entityId: maintenanceRequest.id,
        hotelId: maintenanceRequest.hotelId,
        description: `Maintenance request #${maintenanceRequest.requestNumber} completed`,
        changes: LoggerService.extractChanges(oldRequest, maintenanceRequest.serialize()),
        ctx: { request, response } as any
      })

      return response.ok({
        message: 'Maintenance request completed successfully',
        data: maintenanceRequest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to complete maintenance request',
        error: error.message
      })
    }
  }

  /**
   * Cancel maintenance request
   */
  async cancel({ params, request, response, auth }: HttpContext) {
    try {
      const maintenanceRequest = await MaintenanceRequest.findOrFail(params.id)
      const oldRequest = maintenanceRequest.serialize()
      const { reason } = request.only(['reason'])
      
      if (maintenanceRequest.status === 'completed') {
        return response.badRequest({
          message: 'Cannot cancel completed requests'
        })
      }

      maintenanceRequest.status = 'cancelled'
      maintenanceRequest.resolutionNotes = reason
      maintenanceRequest.lastModifiedBy = auth.user?.id || 0
      
      await maintenanceRequest.save()

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'CANCEL_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        entityId: maintenanceRequest.id,
        hotelId: maintenanceRequest.hotelId,
        description: `Maintenance request #${maintenanceRequest.requestNumber} cancelled. Reason: ${reason}`,
        changes: LoggerService.extractChanges(oldRequest, maintenanceRequest.serialize()),
        ctx: { request, response } as any
      })

      return response.ok({
        message: 'Maintenance request cancelled successfully',
        data: maintenanceRequest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to cancel maintenance request',
        error: error.message
      })
    }
  }

  /**
   * Get maintenance request statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { hotelId, period } = request.only(['hotelId', 'period'])
      
      const query = MaintenanceRequest.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      // Apply period filter if provided
      if (period) {
        const now = new Date()
        let startDate: Date
        
        switch (period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            break
          default:
            startDate = new Date(0)
        }
        
        query.where('created_at', '>=', startDate)
      }

      const totalRequests = await query.clone().count('* as total')
      const pendingRequests = await query.clone().where('status', 'pending').count('* as total')
      const assignedRequests = await query.clone().where('status', 'assigned').count('* as total')
      const inProgressRequests = await query.clone().where('status', 'in_progress').count('* as total')
      const completedRequests = await query.clone().where('status', 'completed').count('* as total')
      const cancelledRequests = await query.clone().where('status', 'cancelled').count('* as total')
      const emergencyRequests = await query.clone().where('priority', 'emergency').count('* as total')
      const highPriorityRequests = await query.clone().where('priority', 'high').count('* as total')
      const overdueRequests = await query.clone()
        .whereRaw('scheduled_date < NOW() AND status NOT IN (?)', [['completed', 'cancelled']])
        .count('* as total')

      const stats = {
        totalRequests: totalRequests[0].$extras.total,
        pendingRequests: pendingRequests[0].$extras.total,
        assignedRequests: assignedRequests[0].$extras.total,
        inProgressRequests: inProgressRequests[0].$extras.total,
        completedRequests: completedRequests[0].$extras.total,
        cancelledRequests: cancelledRequests[0].$extras.total,
        emergencyRequests: emergencyRequests[0].$extras.total,
        highPriorityRequests: highPriorityRequests[0].$extras.total,
        overdueRequests: overdueRequests[0].$extras.total,
        completionRate: totalRequests[0].$extras.total > 0 ? 
          (completedRequests[0].$extras.total / totalRequests[0].$extras.total * 100).toFixed(2) : 0
      }

      return response.ok({
        message: 'Maintenance request statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }

  /**
   * Get overdue maintenance requests
   */
  async overdue({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])
      
      const query = MaintenanceRequest.query()
        .whereRaw('scheduled_date < NOW() AND status NOT IN (?)', [['completed', 'cancelled']])
      
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const overdueRequests = await query
        .preload('hotel')
        .preload('room')
        .orderBy('scheduled_date', 'asc')

      return response.ok({
        message: 'Overdue maintenance requests retrieved successfully',
        data: overdueRequests
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve overdue requests',
        error: error.message
      })
    }
  }
}