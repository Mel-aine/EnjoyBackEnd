import type { HttpContext } from '@adonisjs/core/http'
import BookingSource from '#models/booking_source'
import BookingSourceService from '#services/booking_source_service'
import { createBookingSourceValidator, updateBookingSourceValidator } from '#validators/booking_source'

export default class BookingSourcesController {
  private service: BookingSourceService

  constructor() {
    this.service = new BookingSourceService()
  }

  /**
   * Display a list of booking sources
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId
      const sourceType = request.input('source_type')
      const sourceName = request.input('source_name')

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const filters = {
        hotelId: Number(hotelId),
        sourceType,
        sourceName,
      }

      const bookingSources = await this.service.getPaginated(page, limit, filters)

      return response.ok({
        success: true,
        data: bookingSources,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch booking sources',
        error: error.message,
      })
    }
  }

  /**
   * Get booking sources by hotel ID
   */
  async getByHotelId({ params, response }: HttpContext) {
    try {
      const { hotelId } = params
      
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required',
        })
      }

      const bookingSources = await this.service.getByHotelId(Number(hotelId))

      return response.ok({
        success: true,
        data: bookingSources,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch booking sources for hotel',
        error: error.message,
      })
    }
  }

  /**
   * Create a new booking source
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createBookingSourceValidator)
      const user = auth.user!

      // Check if source code already exists for this hotel
      const exists = await this.service.existsBySourceCode(payload.sourceCode, payload.hotelId)
      if (exists) {
        return response.badRequest({
          success: false,
          message: 'A booking source with this source code already exists for this hotel',
        })
      }

      const bookingSource = await this.service.create(payload, user.id)

      return response.created({
        success: true,
        data: bookingSource,
        message: 'Booking source created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create booking source',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific booking source
   */
  async show({ params, response }: HttpContext) {
    try {
      const bookingSource = await this.service.getById(params.id)

      if (!bookingSource) {
        return response.notFound({
          success: false,
          message: 'Booking source not found',
        })
      }

      return response.ok({
        success: true,
        data: bookingSource,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch booking source',
        error: error.message,
      })
    }
  }

  /**
   * Update a booking source
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateBookingSourceValidator)
      const user = auth.user!

      // Check if source code already exists for this hotel (excluding current record)
      if (payload.sourceCode && payload.hotelId) {
        const exists = await this.service.existsBySourceCode(
          payload.sourceCode,
          payload.hotelId,
          Number(params.id)
        )
        if (exists) {
          return response.badRequest({
            success: false,
            message: 'A booking source with this source code already exists for this hotel',
          })
        }
      }

      const bookingSource = await this.service.update(params.id, payload, user.id)

      if (!bookingSource) {
        return response.notFound({
          success: false,
          message: 'Booking source not found',
        })
      }

      return response.ok({
        success: true,
        data: bookingSource,
        message: 'Booking source updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update booking source',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a booking source
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const bookingSource = await this.service.delete(params.id, user.id)

      if (!bookingSource) {
        return response.notFound({
          success: false,
          message: 'Booking source not found',
        })
      }

      return response.ok({
        success: true,
        message: 'Booking source deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete booking source',
        error: error.message,
      })
    }
  }

  /**
   * Get all booking sources without pagination
   */
  async list({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotel_id')
      const sourceType = request.input('source_type')
      const sourceName = request.input('source_name')

      const filters = {
        hotelId,
        sourceType,
        sourceName,
      }

      const bookingSources = await this.service.getAll(filters)

      return response.ok({
        success: true,
        data: bookingSources,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch booking sources',
        error: error.message,
      })
    }
  }
}