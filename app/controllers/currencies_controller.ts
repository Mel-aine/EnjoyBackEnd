import type { HttpContext } from '@adonisjs/core/http'
import Currency from '#models/currency'
import vine from '@vinejs/vine'

export default class CurrenciesController {
  public async index({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.qs()
      
      let query = Currency.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdBy')
        .preload('updatedBy')
      
      if (hotelId) {
        query = query.where('hotel_id', hotelId)
      }
      
      const currencies = await query.orderBy('created_at', 'desc')
      
      return response.ok({
        success: true,
        data: currencies,
        message: 'Currencies retrieved successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to retrieve currencies',
        error: error.message
      })
    }
  }

  public async store({ request, response, auth }: HttpContext) {
    try {
      const validationSchema = vine.object({
        country: vine.string().maxLength(100),
        name: vine.string().maxLength(100),
        sign: vine.string().maxLength(10),
        prefixSuffix: vine.enum(['prefix', 'suffix']),
        currencyCode: vine.string().maxLength(10),
        digitsAfterDecimal: vine.number().range([0, 10]),
        exchangeRate: vine.number().range([0.000001, 999999]),
        isEditable: vine.boolean().optional(),
        hotelId: vine.number()
      })

      const payload = await vine.validate({ schema: validationSchema, data: request.all() })
      
      const currency = await Currency.create({
        ...payload,
        createdByUserId: auth.user?.id,
        updatedByUserId: auth.user?.id
      })

      await currency.preload('hotel')
      await currency.preload('createdBy')
      await currency.preload('updatedBy')

      return response.created({
        success: true,
        data: currency,
        message: 'Currency created successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create currency',
        error: error.message
      })
    }
  }

  public async show({ params, response }: HttpContext) {
    try {
      const currency = await Currency.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdBy')
        .preload('updatedBy')
        .firstOrFail()

      return response.ok({
        success: true,
        data: currency,
        message: 'Currency retrieved successfully'
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Currency not found'
      })
    }
  }

  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const currency = await Currency.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      // Check if currency is editable
      if (!currency.isEditable) {
        return response.forbidden({
          success: false,
          message: 'This currency is not editable'
        })
      }

      const validationSchema = vine.object({
        country: vine.string().maxLength(100).optional(),
        name: vine.string().maxLength(100).optional(),
        sign: vine.string().maxLength(10).optional(),
        prefixSuffix: vine.enum(['prefix', 'suffix']).optional(),
        currencyCode: vine.string().maxLength(10).optional(),
        digitsAfterDecimal: vine.number().range([0, 10]).optional(),
        exchangeRate: vine.number().range([0.000001, 999999]).optional(),
        isEditable: vine.boolean().optional()
      })

      const payload = await vine.validate({ schema: validationSchema, data: request.all() })
      
      currency.merge({
        ...payload,
        updatedByUserId: auth.user?.id
      })
      
      await currency.save()
      await currency.preload('hotel')
      await currency.preload('createdBy')
      await currency.preload('updatedBy')

      return response.ok({
        success: true,
        data: currency,
        message: 'Currency updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update currency',
        error: error.message
      })
    }
  }

  public async destroy({ params, response, auth }: HttpContext) {
    try {
      const currency = await Currency.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      // Check if currency is editable
      if (!currency.isEditable) {
        return response.forbidden({
          success: false,
          message: 'This currency cannot be deleted'
        })
      }

      currency.merge({
        isDeleted: true,
        updatedByUserId: auth.user?.id
      })
      
      await currency.save()

      return response.ok({
        success: true,
        message: 'Currency deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete currency',
        error: error.message
      })
    }
  }

  // Method to create default XAF currency for new hotels
  public static async createDefaultCurrency(hotelId: number, userId?: number) {
    try {
      const defaultCurrency = await Currency.create({
        country: 'Cameroon',
        name: 'Central African CFA Franc',
        sign: 'FCFA',
        prefixSuffix: 'suffix',
        currencyCode: 'XAF',
        digitsAfterDecimal: 0,
        exchangeRate: 1.0,
        isEditable: false,
        hotelId: hotelId,
        createdByUserId: userId,
        updatedByUserId: userId
      })
      
      return defaultCurrency
    } catch (error) {
      console.error('Failed to create default currency:', error)
      throw error
    }
  }
}