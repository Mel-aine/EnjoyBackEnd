import type { HttpContext } from '@adonisjs/core/http'
import AuditTrailService from '#services/audit_trail_service'

export default class AuditTrailController {
  /**
   * Get audit trail data with filtering and pagination
   */
  public async getAuditTrail({ request, response }: HttpContext) {
    try {
      const {
        hotelId,
        entityIds,
        entityType,
        startDate,
        endDate,
        userId,
        action,
        page = 1,
        perPage = 20,
        sortBy = 'createdAt',
        order = 'desc'
      } = request.all()

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({ message: 'Hotel ID is required' })
      }

      // Parse entityIds if it's a string
      let parsedEntityIds = entityIds
      if (entityIds && typeof entityIds === 'string') {
        try {
          parsedEntityIds = JSON.parse(entityIds)
        } catch (e) {
          return response.badRequest({ message: 'Invalid entityIds format. Must be a valid JSON array.' })
        }
      }
      
      // Ensure all entityIds are numbers
      if (parsedEntityIds && Array.isArray(parsedEntityIds)) {
        parsedEntityIds = parsedEntityIds.map(id => Number(id))
        // Check if any ID is not a valid positive number
        if (parsedEntityIds.some(id => isNaN(id) || id <= 0)) {
          return response.badRequest({ message: 'All entity IDs must be positive numbers' })
        }
      }

      const options = {
        hotelId: Number(hotelId),
        entityIds: parsedEntityIds,
        entityType,
        startDate,
        endDate,
        userId: userId ? Number(userId) : undefined,
        action,
        page: Number(page),
        perPage: Number(perPage),
        sortBy,
        order
      }

      const auditTrail = await AuditTrailService.getAuditTrail(options)
      return response.ok(auditTrail)
    } catch (error) {
      console.error('Error fetching audit trail:', error)
      return response.badRequest({ 
        message: 'Failed to fetch audit trail', 
        error: error.message 
      })
    }
  }

  /**
   * Get audit trail for a specific entity
   */
  public async getEntityAuditTrail({ params, request, response }: HttpContext) {
    try {
      const { entityType, entityId } = params
      const { hotelId } = request.all()

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({ message: 'Hotel ID is required' })
      }

      if (!entityType || !entityId) {
        return response.badRequest({ message: 'Entity type and ID are required' })
      }
      
      // Validate entityId is a positive number
      const numericEntityId = Number(entityId)
      if (isNaN(numericEntityId) || numericEntityId <= 0) {
        return response.badRequest({ message: 'Entity ID must be a positive number' })
      }

      const options = {
        hotelId: Number(hotelId),
        entityType,
        entityIds: [numericEntityId],
        sortBy: 'createdAt',
        order: 'desc' as 'desc'
      }

      const auditTrail = await AuditTrailService.getAuditTrail(options)
      return response.ok(auditTrail)
    } catch (error) {
      console.error('Error fetching entity audit trail:', error)
      return response.badRequest({ 
        message: 'Failed to fetch entity audit trail', 
        error: error.message 
      })
    }
  }

  /**
   * Export audit trail data
   */
  public async exportAuditTrail({ request, response }: HttpContext) {
    try {
      const {
        hotelId,
        entityIds,
        entityType,
        startDate,
        endDate,
        userId,
        action
      } = request.all()

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({ message: 'Hotel ID is required' })
      }

      // Parse entityIds if it's a string
      let parsedEntityIds = entityIds
      if (entityIds && typeof entityIds === 'string') {
        try {
          parsedEntityIds = JSON.parse(entityIds)
        } catch (e) {
          return response.badRequest({ message: 'Invalid entityIds format. Must be a valid JSON array.' })
        }
      }

      const options = {
        hotelId: Number(hotelId),
        entityIds: parsedEntityIds,
        entityType,
        startDate,
        endDate,
        userId: userId ? Number(userId) : undefined,
        action,
        sortBy: 'createdAt',
        order: 'desc' as 'desc'
      }

      const auditTrail = await AuditTrailService.getAuditTrail(options)
      
      // Convert to CSV format
      const csvHeader = 'ID,Date,Time,User,Action,Entity Type,Entity ID,Description,IP Address,User Agent\n'
      const csvRows = auditTrail.map(log => {
        const date = new Date(log.createdAt)
        const dateStr = date.toLocaleDateString()
        const timeStr = date.toLocaleTimeString()
        
        return [
          log.id,
          dateStr,
          timeStr,
          log.username || (log.user ? log.user.name : 'System'),
          log.action,
          log.entityType,
          log.entityId,
          log.description.replace(/,/g, ';'),  // Replace commas to avoid CSV issues
          log.ipAddress || 'N/A',
          (log.userAgent || 'N/A').replace(/,/g, ';')  // Replace commas to avoid CSV issues
        ].join(',')
      }).join('\n')
      
      const csv = csvHeader + csvRows
      
      response.header('Content-Type', 'text/csv')
      response.header('Content-Disposition', `attachment; filename=audit-trail-${new Date().toISOString().split('T')[0]}.csv`)
      
      return response.send(csv)
    } catch (error) {
      console.error('Error exporting audit trail:', error)
      return response.badRequest({ 
        message: 'Failed to export audit trail', 
        error: error.message 
      })
    }
  }
}