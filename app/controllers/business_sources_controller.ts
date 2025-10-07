import type { HttpContext } from '@adonisjs/core/http'
import BusinessSource from '#models/business_source'
import { createBusinessSourceValidator, updateBusinessSourceValidator } from '#validators/business_source'
import { DateTime } from 'luxon'

export default class BusinessSourcesController {
  /**
   * Display a list of business sources
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId
      const shortCode = request.input('short_code')

      if (!hotelId) {
        return response.badRequest({ message: 'hotelId is required' })
      }

      const query = BusinessSource.query()
        .where('is_deleted', false)
        .preload('marketCode')
        .preload('createdByUser')
        .preload('updatedByUser')

      query.where('hotel_id', Number(hotelId))

      if (shortCode) {
        query.where('short_code', 'like', `%${shortCode}%`)
      }

      const businessSources = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: businessSources,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch business sources',
        error: error.message,
      })
    }
  }

  /**
   * Create a new business source
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createBusinessSourceValidator)
      const user = auth.user!

      const businessSource = await BusinessSource.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        isDeleted: false,
      })

      await businessSource.load('hotel')
      await businessSource.load('createdByUser')
      await businessSource.load('updatedByUser')

      return response.created({
        success: true,
        data: businessSource,
        message: 'Business source created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create business source',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific business source
   */
  async show({ params, response }: HttpContext) {
    try {
      const businessSource = await BusinessSource.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('marketCode')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: businessSource,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Business source not found',
      })
    }
  }

  /**
   * Update a business source
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateBusinessSourceValidator)
      const user = auth.user!

      const businessSource = await BusinessSource.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      businessSource.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await businessSource.save()
      await businessSource.load('hotel')
      await businessSource.load('createdByUser')
      await businessSource.load('updatedByUser')

      return response.ok({
        success: true,
        data: businessSource,
        message: 'Business source updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update business source',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a business source
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const businessSource = await BusinessSource.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      businessSource.merge({
        isDeleted: true,
        deletedAt:  DateTime.now(),
        updatedByUserId: user.id,
      })

      await businessSource.save()

      return response.ok({
        success: true,
        message: 'Business source deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete business source',
        error: error.message,
      })
    }
  }
}