import BookingSource from '#models/booking_source'
import LoggerService from '#services/logger_service'
import { DateTime } from 'luxon'

export default class BookingSourceService {
  /**
   * Get all booking sources with optional filtering
   */
  async getAll(filters: any = {}) {
    const query = BookingSource.query()
      .where('isActive', true)
      .preload('hotel')
      .preload('creator')
      .preload('modifier')

    if (filters.hotelId) {
      query.where('hotelId', filters.hotelId)
    }

    if (filters.sourceType) {
      query.where('sourceType', filters.sourceType)
    }

    if (filters.sourceName) {
      query.where('sourceName', 'like', `%${filters.sourceName}%`)
    }

    return await query.exec()
  }

  /**
   * Get booking sources by hotel ID
   */
  async getByHotelId(hotelId: number) {
    return await BookingSource.query()
      .where('hotelId', hotelId)
      .where('isActive', true)
      .preload('hotel')
      .preload('creator')
      .preload('modifier')
      .orderBy('priority', 'asc')
      .orderBy('sourceName', 'asc')
  }

  /**
   * Get a booking source by ID
   */
  async getById(id: number) {
    return await BookingSource.query()
      .where('id', id)
      .where('isActive', true)
      .preload('hotel')
      .preload('creator')
      .preload('modifier')
      .first()
  }

  /**
   * Create a new booking source
   */
  async create(data: any, userId?: number) {
    const bookingSource = await BookingSource.create({
      ...data,
      createdBy: userId || null,
      lastModifiedBy: userId || null,
      isActive: true,
    })

    // Load relationships
    await bookingSource.load('hotel')
    if (bookingSource.createdBy) {
      await bookingSource.load('creator')
    }
    if (bookingSource.lastModifiedBy) {
      await bookingSource.load('modifier')
    }

    // Log the creation
    if (userId) {
      await LoggerService.logActivity({
        userId,
        action: 'CREATE',
        resourceType: 'BookingSource',
        resourceId: bookingSource.id,
        hotelId: bookingSource.hotelId,
        details: {
          sourceName: bookingSource.sourceName,
          sourceCode: bookingSource.sourceCode,
          sourceType: bookingSource.sourceType,
        }
      })
    }

    return bookingSource
  }

  /**
   * Update a booking source
   */
  async update(id: number, data: any, userId?: number) {
    const bookingSource = await BookingSource.find(id)
    if (!bookingSource || !bookingSource.isActive) {
      return null
    }

    const oldData = bookingSource.serialize()

    bookingSource.merge({
      ...data,
      lastModifiedBy: userId || null,
    })

    await bookingSource.save()

    // Load relationships
    await bookingSource.load('hotel')
    if (bookingSource.createdBy) {
      await bookingSource.load('creator')
    }
    if (bookingSource.lastModifiedBy) {
      await bookingSource.load('modifier')
    }

    // Log the update
    if (userId) {
      await LoggerService.logActivity({
        userId,
        action: 'UPDATE',
        resourceType: 'BookingSource',
        resourceId: bookingSource.id,
        hotelId: bookingSource.hotelId,
        details: {
          oldData,
          newData: bookingSource.serialize(),
        }
      })
    }

    return bookingSource
  }

  /**
   * Soft delete a booking source
   */
  async delete(id: number, userId?: number) {
    const bookingSource = await BookingSource.find(id)
    if (!bookingSource || !bookingSource.isActive) {
      return null
    }

    bookingSource.merge({
      isActive: false,
      lastModifiedBy: userId || null,
    })

    await bookingSource.save()

    // Log the deletion
    if (userId) {
      await LoggerService.logActivity({
        userId,
        action: 'DELETE',
        resourceType: 'BookingSource',
        resourceId: bookingSource.id,
        hotelId: bookingSource.hotelId,
        details: {
          sourceName: bookingSource.sourceName,
          sourceCode: bookingSource.sourceCode,
        }
      })
    }

    return bookingSource
  }

  /**
   * Get booking sources with pagination
   */
  async getPaginated(page: number = 1, limit: number = 10, filters: any = {}) {
    const query = BookingSource.query()
      .where('isActive', true)
      .preload('hotel')
      .preload('creator')
      .preload('modifier')

    if (filters.hotelId) {
      query.where('hotelId', filters.hotelId)
    }

    if (filters.sourceType) {
      query.where('sourceType', filters.sourceType)
    }

    if (filters.sourceName) {
      query.where('sourceName', 'like', `%${filters.sourceName}%`)
    }

    return await query.paginate(page, limit)
  }

  /**
   * Check if booking source exists by source code and hotel
   */
  async existsBySourceCode(sourceCode: string, hotelId: number, excludeId?: number) {
    const query = BookingSource.query()
      .where('sourceCode', sourceCode)
      .where('hotelId', hotelId)
      .where('isActive', true)

    if (excludeId) {
      query.whereNot('id', excludeId)
    }

    const existing = await query.first()
    return !!existing
  }
}