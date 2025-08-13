import type { HttpContext } from '@adonisjs/core/http'
import PreferenceType from '#models/preference_type'
import { createPreferenceTypeValidator, updatePreferenceTypeValidator } from '#validators/preference_type'
import { DateTime } from 'luxon'

export default class PreferenceTypesController {
  /**
   * Display a list of preference types
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotel_id')

      const query = PreferenceType.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const preferenceTypes = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: preferenceTypes,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch preference types',
        error: error.message,
      })
    }
  }

  /**
   * Create a new preference type
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createPreferenceTypeValidator)
      const user = auth.user!

      const preferenceType = await PreferenceType.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        isDeleted: false,
      })

      await preferenceType.load('hotel')
      await preferenceType.load('createdByUser')
      await preferenceType.load('updatedByUser')

      return response.created({
        success: true,
        data: preferenceType,
        message: 'Preference type created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create preference type',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific preference type
   */
  async show({ params, response }: HttpContext) {
    try {
      const preferenceType = await PreferenceType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: preferenceType,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Preference type not found',
      })
    }
  }

  /**
   * Update a preference type
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updatePreferenceTypeValidator)
      const user = auth.user!

      const preferenceType = await PreferenceType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      preferenceType.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await preferenceType.save()
      await preferenceType.load('hotel')
      await preferenceType.load('createdByUser')
      await preferenceType.load('updatedByUser')

      return response.ok({
        success: true,
        data: preferenceType,
        message: 'Preference type updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update preference type',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a preference type
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const preferenceType = await PreferenceType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      preferenceType.merge({
        isDeleted: true,
        deletedAt:  DateTime.now(),
        updatedByUserId: user.id,
      })

      await preferenceType.save()

      return response.ok({
        success: true,
        message: 'Preference type deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete preference type',
        error: error.message,
      })
    }
  }
}