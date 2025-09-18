import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import WorkOrder from '#models/work_order'
import LoggerService from '#services/logger_service'
import { 
  createWorkOrderValidator, 
  updateWorkOrderValidator, 
  updateWorkOrderStatusValidator,
  assignWorkOrderValidator,
  workOrderFilterValidator
} from '#validators/work_order'

export default class WorkOrdersController {
  /**
   * Display a list of work orders with filtering
   */
  async index({ request, response }: HttpContext) {
    try {
      const filters = await request.validateUsing(workOrderFilterValidator)
      const page = filters.page || 1
      const limit = filters.limit || 20
      const sortBy = filters.sortBy || 'createdAt'
      const sortOrder = filters.sortOrder || 'desc'

      const query = WorkOrder.query()

      // Apply filters
      if (filters.hotelId) {
        query.where('hotelId', filters.hotelId)
      }

      if (filters.roomId) {
        query.where('roomId', filters.roomId)
      }

      if (filters.category) {
        query.where('category', filters.category)
      }

      if (filters.priority) {
        query.where('priority', filters.priority)
      }

      if (filters.status) {
        query.where('status', filters.status)
      }

      if (filters.assignedToUserId) {
        query.where('assignedToUserId', filters.assignedToUserId)
      }

      if (filters.fromDate) {
        query.where('createdAt', '>=', filters.fromDate.toJSDate())
      }

      if (filters.toDate) {
        query.where('createdAt', '<=', filters.toDate.toJSDate())
      }

      const workOrders = await query
        .preload('room')
        .preload('assignedToUser')
        .preload('hotel')
        .orderBy(sortBy, sortOrder)
        .paginate(page, limit)

      await LoggerService.log('info', 'Work orders retrieved', {
        filters,
        count: workOrders.length,
        page,
        limit
      })

      return response.ok({
        success: true,
        message: 'Work orders retrieved successfully',
        data: workOrders
      })
    } catch (error) {
      await LoggerService.log('error', 'Failed to retrieve work orders', {
        error: error.message,
        stack: error.stack
      })

      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve work orders',
        error: error.message
      })
    }
  }

  /**
   * Create a new work order
   */
  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    try {
      console.log('➡️ Début création WorkOrder')
  
      const payload = await request.validateUsing(createWorkOrderValidator)
      console.log('✅ Payload validé:', payload)
  
      const user = auth.user!
      console.log('👤 Utilisateur authentifié:', {
        id: user?.id,
        email: user?.email,
        name: `${user?.firstName} ${user?.lastName}`
      })
  
      // Generate order number
      const orderNumber = WorkOrder.generateOrderNumber()
      console.log('🆔 Numéro de WorkOrder généré:', orderNumber)
  
      const workOrder = await WorkOrder.create({
        ...payload,
        orderNumber,
        status: payload.status || 'assigned',
        priority: payload.priority || 'medium',
        roomStatus: payload.roomStatus || 'dirty'
      })
      console.log('📄 WorkOrder créé (avant save):', workOrder.toJSON())
  
      // Add initial note
      workOrder.addNote(user.id, `Work order created by ${user.firstName} ${user.lastName}`)
      if (payload.assignedToUserId !== user.id) {
        console.log(`✍️ Ajout d'une note: assigné à user ${payload.assignedToUserId}`)
        workOrder.addNote(user.id, `Work order assigned to user ${payload.assignedToUserId}`)
      }
      await workOrder.save()
      console.log('💾 WorkOrder sauvegardé avec notes')
  
      // Load relationships
      await workOrder.load('room')
      await workOrder.load('assignedToUser')
      await workOrder.load('hotel')
      console.log('🔗 Relations chargées: room, assignedToUser, hotel')
  
      await LoggerService.log({
        actorId: auth.user?.id || 0,
        action: 'CREATED',
        entityType: 'Work Order',
        entityId: workOrder.id,
        description: 'Work order created',
        hotelId: workOrder.hotelId,
        ctx
      })
      console.log('📝 LoggerService.log appelé avec succès')
  
      return response.created({
        success: true,
        message: 'Work order created successfully',
        data: workOrder
      })
    } catch (error) {
      console.error('❌ Erreur lors de la création WorkOrder:', error)
  
      await LoggerService.log('error', 'Failed to create work order', {
        error: error.message,
        stack: error.stack,
        payload: request.body()
      })
  
      return response.internalServerError({
        success: false,
        message: 'Failed to create work order',
        error: error.message
      })
    }
  }
  

  /**
   * Show a specific work order
   */
  async show({ params, response }: HttpContext) {
    try {
      const workOrder = await WorkOrder.query()
        .where('id', params.id)
        .preload('room')
        .preload('assignedToUser')
        .preload('hotel')
        .firstOrFail()

      return response.ok({
        success: true,
        message: 'Work order retrieved successfully',
        data: workOrder
      })
    } catch (error) {
      await LoggerService.log('error', 'Failed to retrieve work order', {
        workOrderId: params.id,
        error: error.message
      })

      return response.notFound({
        success: false,
        message: 'Work order not found'
      })
    }
  }

  /**
   * Update a work order
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateWorkOrderValidator)
      const user = auth.user!

      const workOrder = await WorkOrder.findOrFail(params.id)
      
      // Track changes for logging
      const changes: string[] = []
      
      if (payload.status && payload.status !== workOrder.status) {
        changes.push(`Status changed from ${workOrder.status} to ${payload.status}`)
      }
      
      if (payload.assignedToUserId && payload.assignedToUserId !== workOrder.assignedToUserId) {
        changes.push(`Assigned user changed from ${workOrder.assignedToUserId} to ${payload.assignedToUserId}`)
      }
      
      if (payload.priority && payload.priority !== workOrder.priority) {
        changes.push(`Priority changed from ${workOrder.priority} to ${payload.priority}`)
      }

      // Update the work order
      workOrder.merge(payload)
      
      // Add notes for changes
      if (changes.length > 0) {
        const changeNote = `Updated by ${user.firstName} ${user.lastName}: ${changes.join(', ')}`
        workOrder.addNote(user.id, changeNote)
      }
      
      if (payload.notes) {
        workOrder.addNote(user.id, payload.notes)
      }

      await workOrder.save()

      // Load relationships
      await workOrder.load('room')
      await workOrder.load('assignedToUser')
      await workOrder.load('hotel')

      await LoggerService.log('info', 'Work order updated', {
        workOrderId: workOrder.id,
        updatedBy: user.id,
        changes
      })

      return response.ok({
        success: true,
        message: 'Work order updated successfully',
        data: workOrder
      })
    } catch (error) {
      await LoggerService.log('error', 'Failed to update work order', {
        workOrderId: params.id,
        error: error.message,
        stack: error.stack
      })

      return response.internalServerError({
        success: false,
        message: 'Failed to update work order',
        error: error.message
      })
    }
  }

  /**
   * Update work order status with logging
   */
  async updateStatus({ params, request, response, auth }: HttpContext) {
    console.log('➡️ Début mise à jour du statut WorkOrder, ID:', params.id)
  
    try {
      const payload = await request.validateUsing(updateWorkOrderStatusValidator)
      console.log('✅ Payload validé:', payload)
  
      const user = auth.user!
      console.log('👤 Utilisateur authentifié:', {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
      })
  
      const workOrder = await WorkOrder.findOrFail(params.id)
      console.log('📄 WorkOrder trouvé:', {
        id: workOrder.id,
        currentStatus: workOrder.status,
        assignedTo: workOrder.assignedToUserId,
      })
  
      const oldStatus = workOrder.status
      workOrder.updateStatus(payload.status, user.id)
      console.log(`🔄 Statut mis à jour: ${oldStatus} ➡️ ${payload.status}`)
  
      if (payload.notes) {
        workOrder.addNote(user.id, payload.notes)
        console.log('📝 Note ajoutée par', user.id, ':', payload.notes)
      }
  
      await workOrder.save()
      console.log('💾 WorkOrder sauvegardé avec nouveau statut')
  
      // Relations
      await workOrder.load('room')
      await workOrder.load('assignedToUser')
      await workOrder.load('hotel')
      console.log('🔗 Relations chargées: room, assignedToUser, hotel')
  
      await LoggerService.log('info', 'Work order status updated', {
        workOrderId: workOrder.id,
        oldStatus,
        newStatus: payload.status,
        updatedBy: user.id,
      })
      console.log('📝 Log enregistré pour la mise à jour du statut')
  
      return response.ok({
        success: true,
        message: 'Work order status updated successfully',
        data: workOrder,
      })
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du statut WorkOrder:', error)
  
      await LoggerService.log('error', 'Failed to update work order status', {
        workOrderId: params.id,
        error: error.message,
        stack: error.stack,
      })
  
      return response.internalServerError({
        success: false,
        message: 'Failed to update work order status',
        error: error.message,
      })
    }
  }
  
  /**
   * Assign work order to a user
   */
  async assign({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(assignWorkOrderValidator)
      const user = auth.user!

      const workOrder = await WorkOrder.findOrFail(params.id)
      
      workOrder.assignTo(payload.assignedToUserId, user.id)
      
      if (payload.notes) {
        workOrder.addNote(user.id, payload.notes)
      }

      await workOrder.save()

      // Load relationships
      await workOrder.load('room')
      await workOrder.load('assignedToUser')
      await workOrder.load('hotel')

      await LoggerService.log('info', 'Work order assigned', {
        workOrderId: workOrder.id,
        assignedTo: payload.assignedToUserId,
        assignedBy: user.id
      })

      return response.ok({
        success: true,
        message: 'Work order assigned successfully',
        data: workOrder
      })
    } catch (error) {
      await LoggerService.log('error', 'Failed to assign work order', {
        workOrderId: params.id,
        error: error.message,
        stack: error.stack
      })

      return response.internalServerError({
        success: false,
        message: 'Failed to assign work order',
        error: error.message
      })
    }
  }

  /**
   * Delete a work order
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const workOrder = await WorkOrder.findOrFail(params.id)
      
      await workOrder.delete()

      await LoggerService.log('info', 'Work order deleted', {
        workOrderId: params.id,
        deletedBy: user.id
      })

      return response.ok({
        success: true,
        message: 'Work order deleted successfully'
      })
    } catch (error) {
      await LoggerService.log('error', 'Failed to delete work order', {
        workOrderId: params.id,
        error: error.message,
        stack: error.stack
      })

      return response.internalServerError({
        success: false,
        message: 'Failed to delete work order',
        error: error.message
      })
    }
  }
}