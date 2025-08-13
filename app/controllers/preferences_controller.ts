import type { HttpContext } from '@adonisjs/core/http'
import Preference from '#models/preference'
import { createPreferenceValidator, updatePreferenceValidator } from '#validators/preference'
import { DateTime } from 'luxon'

export default class PreferencesController {
  /**
   * Display a list of preferences
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotel_id')
      const preferenceTypeId = request.input('preference_type_id')

      const query = Preference.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('preferenceType')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (preferenceTypeId) {
        query.where('preference_type_id', preferenceTypeId)
      }

      const preferences = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: preferences,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch preferences',
        error: error.message,
      })
    }
  }

  /**
   * Create a new preference
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createPreferenceValidator)
      const user = auth.user!

      const preference = await Preference.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        isDeleted: false,
      })

      await preference.load('hotel')
      await preference.load('preferenceType')
      await preference.load('createdByUser')
      await preference.load('updatedByUser')

      return response.created({
        success: true,
        data: preference,
        message: 'Preference created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create preference',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific preference
   */
  async show({ params, response }: HttpContext) {
    try {
      const preference = await Preference.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('preferenceType')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: preference,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Preference not found',
      })
    }
  }

  /**
   * Update a preference
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updatePreferenceValidator)
      const user = auth.user!

      const preference = await Preference.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      preference.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await preference.save()
      await preference.load('hotel')
      await preference.load('preferenceType')
      await preference.load('createdByUser')
      await preference.load('updatedByUser')

      return response.ok({
        success: true,
        data: preference,
        message: 'Preference updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update preference',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a preference
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const preference = await Preference.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      preference.merge({
        isDeleted: true,
        deletedAt:  DateTime.now(),
        updatedByUserId: user.id,
      })

      await preference.save()

      return response.ok({
        success: true,
        message: 'Preference deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete preference',
        error: error.message,
      })
    }
  }
}