import ActivityLog from '#models/activity_log'
import { auditDateBoundary } from '#services/audit_clock'

interface AuditTrailQueryOptions {
  hotelId: number
  entityIds?: number[]
  entityType?: string
  startDate?: string
  endDate?: string
  userId?: number
  action?: string
  page?: number
  perPage?: number
  sortBy?: string
  order?: 'asc' | 'desc'
  includeRelated?: boolean
  operationId?: string
  timeZone?: string
  event?: string
}

export default class AuditTrailService {
  /**
   * Get activity logs by hotel ID and optional entity IDs
   * @param options Query options including hotelId (required) and optional entityIds
   * @returns Activity log records matching the criteria
   */
  public static async getAuditTrail(options: AuditTrailQueryOptions) {
    // Validate required hotelId parameter
    this.validateOptions(options)

    // Build the query
    let query = ActivityLog.query().where('hotel_id', options.hotelId)

    // Si on recherche par Reservation et qu'on veut inclure les entités liées
    if (options.entityIds && options.entityIds.length > 0 && options.includeRelated !== false &&
      (!options.entityType || options.entityType === 'Reservation')) {
      const reservationIds = options.entityIds

      query = query.where((builder) => {
        //  Nouveau : tout log ayant directement reservation_id renseigné
        builder.orWhereIn('reservation_id', reservationIds)

        //  Ancien : logs de la réservation elle-même (fallback, sans reservation_id)
        builder.orWhere((subBuilder) => {
          subBuilder
            .whereNull('reservation_id')
            .where('entity_type', 'Reservation')
            .whereIn('entity_id', options.entityIds!)
        })

        //  Ancien : logs des folios liés (fallback)
        builder.orWhere((subBuilder) => {
          subBuilder
            .whereNull('reservation_id')
            .whereIn('entity_type', ['folio', 'Folio'])
            .whereIn('entity_id', (subQuery) => {
              subQuery
                .from('folios')
                .select('id')
                .whereIn('reservation_id', reservationIds)
            })
        })

        //  Ancien : logs des transactions CityLedgerChildTransaction (fallback)
        builder.orWhere((subBuilder) => {
          subBuilder
            .whereNull('reservation_id')
            .where('entity_type', 'CityLedgerChildTransaction')
            .whereIn('entity_id', (subQuery) => {
              subQuery
                .from('folio_transactions')
                .select('id')
                .whereIn('reservation_id', reservationIds)
            })
        })

        //  Ancien : logs des paiements folio_transaction (fallback, CORRIGÉ)
        builder.orWhere((subBuilder) => {
          subBuilder
            .whereNull('reservation_id')
            .whereIn('entity_type', ['folio_transaction', 'FolioTransaction'])
            .whereIn('entity_id', (subQuery) => {
              subQuery
                .from('folio_transactions')
                .select('id')
                .whereIn('reservation_id', reservationIds)
            })
        })

        builder.orWhere((subBuilder) => {
          subBuilder.whereNull('reservation_id').where('entity_type', 'ReservationRoom')
            .whereIn('entity_id', (subQuery) => {
              subQuery.from('reservation_rooms').select('id').whereIn('reservation_id', reservationIds)
            })
        })

        //  Ancien : logs Receipt (fallback)
        builder.orWhere((subBuilder) => {
          subBuilder
            .whereNull('reservation_id')
            .where('entity_type', 'Receipt')
            .whereIn('entity_id', (subQuery) => {
              subQuery
                .from('receipts')
                .join('folio_transactions', 'folio_transactions.id', 'receipts.folio_transaction_id')
                .select('receipts.id')
                .whereIn('folio_transactions.reservation_id', reservationIds)
            })
        })

        //  Ancien : logs des guests liés (fallback)
        // builder.orWhere((subBuilder) => {
        //   subBuilder
        //     .whereNull('reservation_id')
        //     .where('entity_type', 'Guest')
        //     .whereIn('entity_id', (subQuery) => {
        //       subQuery
        //         .from('reservation_guests')
        //         .select('guest_id')
        //         .where('reservation_id', ReservationId)
        //     })
        // })
      })
    }

    else if (options.entityIds && options.entityIds.length > 0) {
      query = query.whereIn('entity_id', options.entityIds)

      if (options.entityType) {
        query = query.where('entity_type', options.entityType)
      }
    }

    if (options.entityType && !options.entityIds?.length) {
      query = query.where('entity_type', options.entityType)
    }
    if (options.operationId) {
      query = query.whereRaw("meta->>'operationId' = ?", [options.operationId])
    }
    if (options.event) query = query.whereRaw("meta->'events' @> ?::jsonb", [JSON.stringify([options.event.toUpperCase()])])

    // Apply date range filters if provided
    if (options.startDate) query = query.where('created_at', '>=', auditDateBoundary(options.startDate, false, options.timeZone).utc)
    if (options.endDate) {
      const boundary = auditDateBoundary(options.endDate, true, options.timeZone)
      query = query.where('created_at', boundary.exclusive ? '<' : '<=', boundary.utc)
    }

    // Apply user filter if provided
    if (options.userId) {
      query = query.where('user_id', options.userId)
    }

    // Apply action filter if provided
    if (options.action) {
      query = query.where('action', options.action.toUpperCase())
    }

    // Apply relationships
    query = query.preload('user')
    query = query.preload('creator')

    // Apply sorting
    const requestedSort = options.sortBy || 'created_at'
    const sortBy = ({ createdAt: 'created_at', updatedAt: 'updated_at' } as Record<string, string>)[requestedSort] || requestedSort
    if (!['id', 'created_at', 'updated_at', 'action', 'entity_type', 'user_id'].includes(sortBy)) {
      throw new Error('Invalid audit sort field')
    }
    const order = options.order || 'desc'
    query = query.orderBy(sortBy, order)

    // Apply pagination if requested
    if (options.page && options.perPage) {
      return await query.paginate(options.page, options.perPage)
    }

    return await query
  }

  /**
   * Validate the options for the audit trail query
   * @param options The options to validate
   * @throws Error if validation fails
   */
  private static validateOptions(options: AuditTrailQueryOptions): void {
    // Validate hotelId
    if (!options.hotelId) {
      throw new Error('Hotel ID is required')
    }

    if (typeof options.hotelId !== 'number' || options.hotelId <= 0) {
      throw new Error('Hotel ID must be a positive number')
    }

    // Validate entityIds if provided
    if (options.entityIds) {
      if (!Array.isArray(options.entityIds)) {
        throw new Error('Entity IDs must be an array')
      }

      // Check that all entityIds are valid numbers
      for (const entityId of options.entityIds) {
        if (typeof entityId !== 'number' || entityId <= 0) {
          throw new Error('All entity IDs must be positive numbers')
        }
      }
    }

    // Validate date format if provided
    if (options.startDate && !this.isValidDateString(options.startDate)) {
      throw new Error('Start date must be a valid date string')
    }

    if (options.endDate && !this.isValidDateString(options.endDate)) {
      throw new Error('End date must be a valid date string')
    }

    // Validate pagination parameters if provided
    if (options.page && (typeof options.page !== 'number' || options.page <= 0)) {
      throw new Error('Page must be a positive number')
    }

    if (options.perPage && (typeof options.perPage !== 'number' || options.perPage <= 0)) {
      throw new Error('Per page must be a positive number')
    }
  }

  /**
   * Check if a string is a valid date string
   * @param dateString The date string to validate
   * @returns True if the string is a valid date, false otherwise
   */
  private static isValidDateString(dateString: string): boolean {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }
}
