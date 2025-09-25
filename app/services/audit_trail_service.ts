import ActivityLog from '#models/activity_log'

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
    let query = ActivityLog.query()
      //.where('hotel_id', options.hotelId)

    // Apply entity ID filter if provided
    if (options.entityIds && options.entityIds.length > 0) {
      query = query.whereIn('entity_id', options.entityIds)
    }

    // Apply entity type filter if provided
    if (options.entityType) {
      query = query.where('entityType', options.entityType)
    }

    // Apply date range filters if provided
    if (options.startDate && options.endDate) {
      query = query.whereBetween('createdAt', [options.startDate, options.endDate])
    } else if (options.startDate) {
      query = query.where('createdAt', '>=', options.startDate)
    } else if (options.endDate) {
      query = query.where('createdAt', '<=', options.endDate)
    }

    // Apply user filter if provided
    if (options.userId) {
      query = query.where('userId', options.userId)
    }

    // Apply action filter if provided
    if (options.action) {
      query = query.where('action', options.action.toUpperCase())
    }

    // Apply relationships
    query = query.preload('user')
    query = query.preload('creator')
    query = query.preload('hotel')

    // Apply sorting
    const sortBy = options.sortBy || 'createdAt'
    const order = options.order || 'desc'
    query = query.orderBy(sortBy, order)

    // Apply pagination if requested
    if (options.page && options.perPage) {
      return await query.paginate(options.page, options.perPage)
    }

    // Otherwise return all results
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