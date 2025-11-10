import type { HttpContext } from '@adonisjs/core/http'
import IdentityType from '#models/identity_type'
import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

export default class IdentityTypesController {
  public async index({ params, request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      let query = IdentityType.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdBy')
        .preload('updatedBy')

      query = query.where('hotel_id', Number(hotelId))

      const identityTypes = await query.orderBy('created_at', 'desc').paginate(page, limit)

      return response.ok({
        success: true,
        data: identityTypes,
        message: 'Identity types retrieved successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to retrieve identity types',
        error: error.message
      })
    }
  }

  public async store({ request, response, auth }: HttpContext) {
    try {
      const validationSchema = vine.object({
        hotelId: vine.number(),
        name: vine.string().maxLength(100),
        shortCode: vine.string().maxLength(10)
      })

      const payload = await vine.validate({ schema: validationSchema, data: request.all() })
      console.log('payload',payload)

      const identityType = await IdentityType.create({
        ...payload,
        createdByUserId: auth.user?.id,
        updatedByUserId: auth.user?.id
      })

      await identityType.preload('hotel')
      await identityType.preload('createdBy')
      await identityType.preload('updatedBy')

      return response.created({
        success: true,
        data: identityType,
        message: 'Identity type created successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create identity type',
        error: error.message
      })
    }
  }

  public async show({ params, response }: HttpContext) {
    try {
      const identityType = await IdentityType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdBy')
        .preload('updatedBy')
        .firstOrFail()

      return response.ok({
        success: true,
        data: identityType,
        message: 'Identity type retrieved successfully'
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Identity type not found'
      })
    }
  }

  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const identityType = await IdentityType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      const validationSchema = vine.object({
        name: vine.string().maxLength(100).optional(),
        shortCode: vine.string().maxLength(10).optional()
      })

      const payload = await vine.validate({ schema: validationSchema, data: request.all() })

      identityType.merge({
        ...payload,
        updatedByUserId: auth.user?.id
      })

      await identityType.save()
      await identityType.preload('hotel')
      await identityType.preload('createdBy')
      await identityType.preload('updatedBy')

      return response.ok({
        success: true,
        data: identityType,
        message: 'Identity type updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update identity type',
        error: error.message
      })
    }
  }

  public async destroy({ params, response, auth }: HttpContext) {
    try {
      const identityType = await IdentityType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      identityType.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: auth.user?.id
      })

      await identityType.save()

      return response.ok({
        success: true,
        message: 'Identity type deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete identity type',
        error: error.message
      })
    }
  }
}
