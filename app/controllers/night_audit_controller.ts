import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import NightAuditService from '#services/night_audit_service'

export default class NightAuditController {
  /**
   * Calculate and store night audit data for a specific date
   * POST /api/night-audit
   */
  public async calculateNightAudit(ctx: HttpContext) {
    const { request, response,auth } = ctx;
    try {
      const validationSchema = vine.object({
        auditDate: vine.string(),
        hotelId: vine.number()
      })

      const { auditDate, hotelId } = await vine.validate({
        schema: validationSchema,
        data: request.all()
      })

      // Parse and validate the audit date
      const parsedAuditDate = DateTime.fromISO(auditDate)
      if (!parsedAuditDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid audit date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      // Calculate night audit
      const auditSummary = await NightAuditService.calculateNightAudit({
        auditDate: parsedAuditDate,
        hotelId: Number(hotelId),
        userId: Number(auth.user?.id)
      })

      return response.ok({
        success: true,
        message: 'Night audit calculated and stored successfully',
        data: auditSummary
      })
    } catch (error) {
      // Handle validation errors
      if (error.messages) {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Failed to calculate night audit',
        error: error.message,
        errors:error
      })
    }
  }

  /**
   * Get night audit details for a specific date
   * GET /api/night-audit/:hotelId/:auditDate
   */
  public async getNightAuditDetails({ params, response }: HttpContext) {
    try {
      const { hotelId, auditDate } = params

      // Validate parameters
      if (!hotelId || !auditDate) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID and audit date are required'
        })
      }

      // Parse and validate the audit date
      const parsedAuditDate = DateTime.fromISO(auditDate)
      if (!parsedAuditDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid audit date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      // Get night audit details
      const auditDetails = await NightAuditService.getNightAuditDetails(
        parsedAuditDate,
        Number(hotelId)
      )

      if (!auditDetails) {
        return response.notFound({
          success: false,
          message: 'Night audit data not found for the specified date and hotel'
        })
      }

      return response.ok({
        success: true,
        message: 'Night audit details retrieved successfully',
        data: auditDetails
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve night audit details',
        error: error.message
      })
    }
  }

  /**
   * Get night audit history for a date range
   * GET /api/night-audit/:hotelId/history
   */
  public async getNightAuditHistory({ params, request, response }: HttpContext) {
    try {
      const { hotelId } = params
      const { dateFrom, dateTo, page = 1, limit = 10 } = request.all()

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      if (!dateFrom || !dateTo) {
        return response.badRequest({
          success: false,
          message: 'Date range (dateFrom and dateTo) is required'
        })
      }

      // Parse and validate dates
      const parsedDateFrom = DateTime.fromISO(dateFrom)
      const parsedDateTo = DateTime.fromISO(dateTo)

      if (!parsedDateFrom.isValid || !parsedDateTo.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      if (parsedDateFrom > parsedDateTo) {
        return response.badRequest({
          success: false,
          message: 'dateFrom cannot be later than dateTo'
        })
      }

      // Get night audit history
      const auditHistory = await NightAuditService.getNightAuditHistory(
        Number(hotelId),
        parsedDateFrom,
        parsedDateTo
      )

      // Apply pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedData = auditHistory.slice(startIndex, endIndex)
      const totalRecords = auditHistory.length
      const totalPages = Math.ceil(totalRecords / limit)

      return response.ok({
        success: true,
        message: 'Night audit history retrieved successfully',
        data: paginatedData,
        meta: {
          total: totalRecords,
          per_page: limit,
          current_page: page,
          last_page: totalPages,
          from: startIndex + 1,
          to: Math.min(endIndex, totalRecords)
        }
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve night audit history',
        error: error.message
      })
    }
  }

  /**
   * Delete night audit record
   * DELETE /api/night-audit/:hotelId/:auditDate
   */
  public async deleteNightAudit({ params, response }: HttpContext) {
    try {
      const { hotelId, auditDate } = params

      // Validate parameters
      if (!hotelId || !auditDate) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID and audit date are required'
        })
      }

      // Parse and validate the audit date
      const parsedAuditDate = DateTime.fromISO(auditDate)
      if (!parsedAuditDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid audit date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      // Delete night audit record
      const deleted = await NightAuditService.deleteNightAudit(
        parsedAuditDate,
        Number(hotelId)
      )

      if (!deleted) {
        return response.notFound({
          success: false,
          message: 'Night audit record not found for the specified date and hotel'
        })
      }

      return response.ok({
        success: true,
        message: 'Night audit record deleted successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to delete night audit record',
        error: error.message
      })
    }
  }

  /**
   * Get night audit summary statistics
   * GET /api/night-audit/:hotelId/summary
   */
  public async getNightAuditSummary({ params, request, response }: HttpContext) {
    try {
      const { hotelId } = params
      const { dateFrom, dateTo } = request.all()

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      if (!dateFrom || !dateTo) {
        return response.badRequest({
          success: false,
          message: 'Date range (dateFrom and dateTo) is required'
        })
      }

      // Parse and validate dates
      const parsedDateFrom = DateTime.fromISO(dateFrom)
      const parsedDateTo = DateTime.fromISO(dateTo)

      if (!parsedDateFrom.isValid || !parsedDateTo.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      // Get audit history for the date range
      const auditHistory = await NightAuditService.getNightAuditHistory(
        Number(hotelId),
        parsedDateFrom,
        parsedDateTo
      )

      if (auditHistory.length === 0) {
        return response.ok({
          success: true,
          message: 'No night audit data found for the specified date range',
          data: {
            totalRecords: 0,
            averageOccupancyRate: 0,
            averageRevPAR: 0,
            averageADR: 0,
            totalRevenue: 0,
            totalPayments: 0
          }
        })
      }

      // Calculate summary statistics
      const totalRecords = auditHistory.length
      const averageOccupancyRate = auditHistory.reduce((sum, audit) => sum + audit.occupancyRate, 0) / totalRecords
      const averageRevPAR = auditHistory.reduce((sum, audit) => sum + audit.revPAR, 0) / totalRecords
      const averageADR = auditHistory.reduce((sum, audit) => sum + audit.adr, 0) / totalRecords
      const totalRevenue = auditHistory.reduce((sum, audit) => sum + audit.totalRevenue, 0)
      const totalPayments = auditHistory.reduce((sum, audit) => sum + audit.totalPayments, 0)

      return response.ok({
        success: true,
        message: 'Night audit summary retrieved successfully',
        data: {
          totalRecords,
          averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
          averageRevPAR: Math.round(averageRevPAR * 100) / 100,
          averageADR: Math.round(averageADR * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalPayments: Math.round(totalPayments * 100) / 100,
          dateRange: {
            from: parsedDateFrom.toISODate(),
            to: parsedDateTo.toISODate()
          }
        }
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve night audit summary',
        error: error.message
      })
    }
  }

  /**
   * Get night audit room status for a specific audit date and hotel
   * GET /api/night-audit/:hotelId/room-status
   */
  public async getNightAuditRoomStatus({ params, response }: HttpContext) {
    try {
      const { hotelId,auditDate } = params

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      if (!auditDate) {
        return response.badRequest({
          success: false,
          message: 'Audit date is required'
        })
      }

      // Parse and validate the audit date
      const parsedAuditDate = DateTime.fromISO(auditDate)
      if (!parsedAuditDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid audit date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      // Get night audit room status data
      const roomStatusData = await NightAuditService.getRoomStatusForAudit(
        Number(hotelId),
        parsedAuditDate
      )

      return response.ok({
        success: true,
        message: 'Night audit room status retrieved successfully',
        data: roomStatusData
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve night audit room status',
        error: error.message
      })
    }
  }

  /**
   * Get unsettled folios for night audit
   * GET /api/night-audit/:hotelId/unsettled-folios
   */
  public async getUnsettledFolios({ params, request, response }: HttpContext) {
    try {
      const { hotelId, auditDate } = params

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      if (!auditDate) {
        return response.badRequest({
          success: false,
          message: 'Audit date is required'
        })
      }

      // Parse and validate the audit date
      const parsedAuditDate = DateTime.fromISO(auditDate)
      if (!parsedAuditDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid audit date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      const unsettledFolios = await NightAuditService.getUnsettledFoliosForAudit(
        Number(hotelId),
        parsedAuditDate
      )

      return response.ok({
        success: true,
        message: 'Unsettled folios retrieved successfully',
        data: unsettledFolios
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve unsettled folios',
        error: error.message
      })
    }
  }

  /**
   * Get pending nightly charges for night audit
   * GET /night-audit/:hotelId/:auditDate/nightly-charges
   */
  async getPendingNightlyCharges({ params, response }: HttpContext) {
    try {
      const { hotelId, auditDate } = params

      // Validate required parameters
      if (!hotelId || !auditDate) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID and audit date are required',
        })
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(auditDate)) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
        })
      }

      const pendingCharges = await NightAuditService.getPendingNightlyCharges(
        parseInt(hotelId),
        auditDate
      )

      return response.ok({
        success: true,
        data: pendingCharges,
        message: 'Pending nightly charges retrieved successfully',
      })
    } catch (error) {
      console.error('Error getting pending nightly charges:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve pending nightly charges',
        error: error.message,
      })
    }
  }

  /**
   * Get pending reservations for night audit
   * GET /night-audit/:hotelId/:auditDate/pending-reservations
   */
  async getPendingReservations({ params, response }: HttpContext) {
    try {
      const { hotelId, auditDate } = params

      // Validate required parameters
      if (!hotelId || !auditDate) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID and audit date are required',
        })
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(auditDate)) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
        })
      }

      const pendingReservations = await NightAuditService.getPendingReservations(
        parseInt(hotelId),
        auditDate
      )

      return response.ok({
        success: true,
        data: pendingReservations,
        message: 'Pending reservations retrieved successfully',
      })
    } catch (error) {
      console.error('Error getting pending reservations:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve pending reservations',
        error: error.message,
      })
    }
  }

  /**
   * Post nightly charges for night audit
   * POST /night-audit/:hotelId/:auditDate/nightly-charges
   */
  async postNightlyCharges({ params, request, response }: HttpContext) {
    try {
      const validationSchema = vine.object({
        auditDate: vine.string(),
        charges: vine.array(vine.object({
          reservationId: vine.number(),
          folioId: vine.number(),
          amount: vine.number(),
          description: vine.string().optional()
        }))
      })

      const { auditDate, charges } = await vine.validate({
        schema: validationSchema,
        data: request.all()
      })

      const { hotelId } = params

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      // Parse and validate the audit date
      const parsedAuditDate = DateTime.fromISO(auditDate)
      if (!parsedAuditDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid audit date format. Please use ISO format (YYYY-MM-DD).',
          error: 'Invalid date format'
        })
      }

      const result = await NightAuditService.postNightlyCharges(
        Number(hotelId),
        parsedAuditDate,
        charges
      )

      return response.ok({
        success: true,
        message: 'Nightly charges posted successfully',
        data: result
      })
    } catch (error) {
      // Handle validation errors
      if (error.messages) {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Failed to post nightly charges',
        error: error.message
      })
    }
  }
}