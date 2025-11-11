import type { HttpContext } from '@adonisjs/core/http'
import VipStatus from '#models/vip_status'
import { createVipStatusValidator, updateVipStatusValidator } from '#validators/vip_status'
import VipStatusService from '#services/vip_status_service'

export default class VipStatusController {
  private vipStatusService: VipStatusService

  constructor() {
    this.vipStatusService = new VipStatusService()
  }

  /**
   * Display a list of VIP statuses for a specific hotel
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = params.hotelId

      if (!hotelId) {
        return response.badRequest({
          message: 'hotelId is required in route params'
        })
      }

      const query = VipStatus.query().where('hotel_id', hotelId)

      if (search) {
        query.where((builder) => {
          builder
            .where('name', 'ILIKE', `%${search}%`)
            .orWhere('color', 'ILIKE', `%${search}%`)
            .orWhere('icon', 'ILIKE', `%${search}%`)
        })
      }

      const vipStatuses = await query
        .preload('creator')
        .preload('modifier')
        .orderBy('name', 'asc')
        .paginate(page, limit)

      return response.ok({
        message: 'VIP statuses retrieved successfully',
        data: vipStatuses
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve VIP statuses',
        error: error.message
      })
    }
  }

  /**
   * Create a new VIP status
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createVipStatusValidator)

      // Validate color format
      if (!VipStatus.validateColor(payload.color)) {
        return response.badRequest({
          message: 'Invalid color format. Please use hex color format (#RRGGBB or #RGB)'
        })
      }

      const vipStatus = await VipStatus.create({
        ...payload,
        createdBy: auth.user?.id || null,
        lastModifiedBy: auth.user?.id || null
      })

      await vipStatus.load('hotel')

      return response.created({
        message: 'VIP status created successfully',
        data: vipStatus
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create VIP status',
        error: error.message
      })
    }
  }

  /**
   * Show a specific VIP status
   */
  async show({ params, request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotel_id')

      // HotelId is mandatory for all GET operations
      if (!hotelId) {
        return response.badRequest({
          message: 'hotel_id is required as a query parameter'
        })
      }

      const vipStatus = await VipStatus.query()
        .where('id', params.id)
        .where('hotel_id', hotelId)
        .preload('hotel')
        .preload('creator')
        .preload('modifier')
        .firstOrFail()

      return response.ok({
        message: 'VIP status retrieved successfully',
        data: vipStatus
      })
    } catch (error) {
      return response.notFound({
        message: 'VIP status not found',
        error: error.message
      })
    }
  }

  /**
   * Update a VIP status
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateVipStatusValidator)
      const hotelId = request.input('hotel_id')

      // HotelId is mandatory for all operations
      if (!hotelId) {
        return response.badRequest({
          message: 'hotel_id is required as a query parameter'
        })
      }

      const vipStatus = await VipStatus.query()
        .where('id', params.id)
        .where('hotel_id', hotelId)
        .firstOrFail()

      // Validate color format if provided
      if (payload.color && !VipStatus.validateColor(payload.color)) {
        return response.badRequest({
          message: 'Invalid color format. Please use hex color format (#RRGGBB or #RGB)'
        })
      }

      // Validate icon if provided
      // if (payload.icon && !VipStatus.validateIcon(payload.icon)) {
      //   return response.badRequest({
      //     message: 'Invalid icon format. Icon must be a non-empty string with maximum 100 characters'
      //   })
      // }

      vipStatus.merge({
        ...payload,
        lastModifiedBy: auth.user?.id || null
      })

      await vipStatus.save()
      await vipStatus.load('hotel')
      await vipStatus.load('creator')
      await vipStatus.load('modifier')

      return response.ok({
        message: 'VIP status updated successfully',
        data: vipStatus
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update VIP status',
        error: error.message
      })
    }
  }

  /**
   * Delete a VIP status
   */
  async destroy({ params, request, response }: HttpContext) {
    try {
      // const hotelId = request.input('hotel_id')
      const hotelId = params.hotelId
      // HotelId is mandatory for all operations
      if (!hotelId) {
        return response.badRequest({
          message: 'hotel_id is required as a query parameter'
        })
      }


      const vipStatus = await VipStatus.query()
        .where('id', params.id)
        .where('hotel_id', hotelId)
        .firstOrFail()

      await vipStatus.delete()

      return response.ok({
        message: 'VIP status deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete VIP status',
        error: error.message
      })
    }
  }
}
