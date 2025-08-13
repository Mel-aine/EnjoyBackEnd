import type { HttpContext } from '@adonisjs/core/http'
import ReservationType from '#models/reservation_type'
import { createReservationTypeValidator, updateReservationTypeValidator } from '#validators/reservation_type'
import { DateTime } from 'luxon'

export default class ReservationTypesController {
  /**
   * Display a list of reservation types
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotel_id')

      const query = ReservationType.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const reservationTypes = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: reservationTypes,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch reservation types',
        error: error.message,
      })
    }
  }

  /**
   * Create a new reservation type
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationTypeValidator)
      const user = auth.user!

      const reservationType = await ReservationType.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        isDeleted: false,
      })

      await reservationType.load('hotel')
      await reservationType.load('createdByUser')
      await reservationType.load('updatedByUser')

      return response.created({
        success: true,
        data: reservationType,
        message: 'Reservation type created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create reservation type',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific reservation type
   */
  async show({ params, response }: HttpContext) {
    try {
      const reservationType = await ReservationType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: reservationType,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Reservation type not found',
      })
    }
  }

  /**
   * Update a reservation type
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateReservationTypeValidator)
      const user = auth.user!

      const reservationType = await ReservationType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      reservationType.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await reservationType.save()
      await reservationType.load('hotel')
      await reservationType.load('createdByUser')
      await reservationType.load('updatedByUser')

      return response.ok({
        success: true,
        data: reservationType,
        message: 'Reservation type updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update reservation type',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a reservation type
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const reservationType = await ReservationType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      reservationType.merge({
        isDeleted: true,
        deletedAt:  DateTime.now(),
        updatedByUserId: user.id,
      })

      await reservationType.save()

      return response.ok({
        success: true,
        message: 'Reservation type deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete reservation type',
        error: error.message,
      })
    }
  }
}