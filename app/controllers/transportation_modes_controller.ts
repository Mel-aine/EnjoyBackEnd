import type { HttpContext } from '@adonisjs/core/http'
import TransportationMode from '#models/transportation_mode'
import { createTransportationModeValidator, updateTransportationModeValidator } from '#validators/transportation_mode'
import { DateTime } from 'luxon'

export default class TransportationModesController {
  /**
   * Get all transportation modes with optional filtering
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = TransportationMode.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('creator')
        .preload('modifier')
        .orderBy('created_at', 'desc')

      query.where('hotel_id', Number(hotelId))

      const transportationModes = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: transportationModes,
        message: 'Transportation modes retrieved successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve transportation modes',
        error: error.message
      })
    }
  }

  /**
   * Create a new transportation mode
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createTransportationModeValidator)
      const user = auth.user!

      const transportationMode = await TransportationMode.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id
      })

      await transportationMode.load('hotel')
      await transportationMode.load('creator')
      await transportationMode.load('modifier')

      return response.created({
        success: true,
        data: transportationMode,
        message: 'Transportation mode created successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create transportation mode',
        error: error.message
      })
    }
  }

  /**
   * Get a specific transportation mode
   */
  async show({ params, response }: HttpContext) {
    try {
      const transportationMode = await TransportationMode.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('creator')
        .preload('modifier')
        .firstOrFail()

      return response.ok({
        success: true,
        data: transportationMode,
        message: 'Transportation mode retrieved successfully'
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Transportation mode not found',
        error: error.message
      })
    }
  }

  /**
   * Update a transportation mode
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateTransportationModeValidator)
      const user = auth.user!

      const transportationMode = await TransportationMode.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      transportationMode.merge({
        ...payload,
        updatedByUserId: user.id
      })

      await transportationMode.save()
      await transportationMode.load('hotel')
      await transportationMode.load('creator')
      await transportationMode.load('modifier')

      return response.ok({
        success: true,
        data: transportationMode,
        message: 'Transportation mode updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update transportation mode',
        error: error.message
      })
    }
  }

  /**
   * Soft delete a transportation mode
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      
      const transportationMode = await TransportationMode.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      transportationMode.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id
      })

      await transportationMode.save()

      return response.ok({
        success: true,
        message: 'Transportation mode deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete transportation mode',
        error: error.message
      })
    }
  }
}