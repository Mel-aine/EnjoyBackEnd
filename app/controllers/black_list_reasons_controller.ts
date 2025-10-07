import type { HttpContext } from '@adonisjs/core/http'
import BlackListReason from '#models/black_list_reason'
import { createBlackListReasonValidator, updateBlackListReasonValidator } from '#validators/black_list_reason'
import { DateTime } from 'luxon'

export default class BlackListReasonsController {
  /**
   * Display a list of black list reasons
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId
      const category = request.input('category')

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = BlackListReason.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      query.where('hotel_id', Number(hotelId))

      if (category) {
        query.where('category', category)
      }

      const blackListReasons = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: blackListReasons,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch black list reasons',
        error: error.message,
      })
    }
  }

  /**
   * Create a new black list reason
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createBlackListReasonValidator)
      const user = auth.user!

      const blackListReason = await BlackListReason.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        isDeleted: false,
      })

      await blackListReason.load('hotel')
      await blackListReason.load('createdByUser')
      await blackListReason.load('updatedByUser')

      return response.created({
        success: true,
        data: blackListReason,
        message: 'Black list reason created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create black list reason',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific black list reason
   */
  async show({ params, response }: HttpContext) {
    try {
      const blackListReason = await BlackListReason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: blackListReason,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Black list reason not found',
      })
    }
  }

  /**
   * Update a black list reason
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateBlackListReasonValidator)
      const user = auth.user!

      const blackListReason = await BlackListReason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      blackListReason.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await blackListReason.save()
      await blackListReason.load('hotel')
      await blackListReason.load('createdByUser')
      await blackListReason.load('updatedByUser')

      return response.ok({
        success: true,
        data: blackListReason,
        message: 'Black list reason updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update black list reason',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a black list reason
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const blackListReason = await BlackListReason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      blackListReason.merge({
        isDeleted: true,
        deletedAt:  DateTime.now(),
        updatedByUserId: user.id,
      })

      await blackListReason.save()

      return response.ok({
        success: true,
        message: 'Black list reason deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete black list reason',
        error: error.message,
      })
    }
  }
}