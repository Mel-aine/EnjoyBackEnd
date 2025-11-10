import type { HttpContext } from '@adonisjs/core/http'
import Discount from '#models/discount'
import { createDiscountValidator, updateDiscountValidator } from '#validators/discount'
import { DateTime } from 'luxon'

export default class DiscountsController {
  /**
   * Display a list of discounts
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = params.hotelId
      const type = request.input('type')
      const applyOn = request.input('apply_on')

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = Discount.query()

        .preload('hotel')
        .preload('creator')
        .preload('modifier')

      query.where('hotel_id', Number(hotelId))

      if (search) {
        query.where((builder) => {
          builder
            .where('short_code', 'ILIKE', `%${search}%`)
            .orWhere('name', 'ILIKE', `%${search}%`)
        })
      }

      if (type) {
        query.where('type', type)
      }

      if (applyOn) {
        query.where('apply_on', applyOn)
      }

      const discounts = await query
        .where('isDeleted','false')
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok({
        success: true,
        data: discounts,
        message: 'Discounts retrieved successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve discounts',
        error: error.message
      })
    }
  }

  /**
   * Create a new discount
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDiscountValidator)
      const user = auth.user!

      const discount = await Discount.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id
      })

      await discount.load('hotel')
      await discount.load('creator')
      await discount.load('modifier')

      return response.created({
        success: true,
        data: discount,
        message: 'Discount created successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create discount',
        error: error.message
      })
    }
  }

  /**
   * Show a specific discount
   */
  async show({ params, response }: HttpContext) {
    try {
      const discount = await Discount.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('creator')
        .preload('modifier')
        .firstOrFail()

      return response.ok({
        success: true,
        data: discount,
        message: 'Discount retrieved successfully'
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Discount not found',
        error: error.message
      })
    }
  }

  /**
   * Update a discount
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateDiscountValidator)
      const user = auth.user!

      const discount = await Discount.query()
        .where('id', params.id)

        .firstOrFail()

      discount.merge({
        ...payload,
        updatedByUserId: user.id
      })

      await discount.save()
      await discount.load('hotel')
      await discount.load('creator')
      await discount.load('modifier')

      return response.ok({
        success: true,
        data: discount,
        message: 'Discount updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update discount',
        error: error.message
      })
    }
  }

  /**
   * Soft delete a discount
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const discount = await Discount.query()
        .where('id', params.id)

        .firstOrFail()

      discount.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id
      })

      await discount.save()

      return response.ok({
        success: true,
        message: 'Discount deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete discount',
        error: error.message
      })
    }
  }

  /**
   * Get discounts by type
   */
  async getByType({ request, response }: HttpContext) {
    try {
      const { type, hotel_id } = request.qs()

      if (!type) {
        return response.badRequest({
          success: false,
          message: 'Type parameter is required'
        })
      }

      const query = Discount.query()
        .where('type', type)

        .preload('hotel')

      if (hotel_id) {
        query.where('hotel_id', hotel_id)
      }

      const discounts = await query.orderBy('name', 'asc')

      return response.ok({
        success: true,
        data: discounts,
        message: `Discounts of type '${type}' retrieved successfully`
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve discounts by type',
        error: error.message
      })
    }
  }

  /**
   * Get all discount types
   */
  async getTypes({ response }: HttpContext) {
    try {
      const types = ['percentage', 'flat']

      return response.ok({
        success: true,
        data: types,
        message: 'Discount types retrieved successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve discount types',
        error: error.message
      })
    }
  }

  /**
   * Get all apply on options
   */
  async getApplyOnOptions({ response }: HttpContext) {
    try {
      const options = ['room_charge', 'extra_charge']

      return response.ok({
        success: true,
        data: options,
        message: 'Apply on options retrieved successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve apply on options',
        error: error.message
      })
    }
  }

  /**
   * Get discounts by status
   */
  async getByStatus({ params, response }: HttpContext) {
    try {
      const { status } = params

      if (!['active', 'inactive'].includes(status)) {
        return response.badRequest({
          success: false,
          message: 'Invalid status. Must be either active or inactive'
        })
      }

      const discounts = await Discount.query()
        .where('status', status)

        .preload('hotel')
        .preload('creator')
        .preload('modifier')
        .orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        data: discounts,
        message: `${status.charAt(0).toUpperCase() + status.slice(1)} discounts retrieved successfully`
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve discounts by status',
        error: error.message
      })
    }
  }
}
