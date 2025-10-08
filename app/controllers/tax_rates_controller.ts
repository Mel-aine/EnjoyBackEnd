import type { HttpContext } from '@adonisjs/core/http'
import TaxRate from '#models/tax_rate'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'

// Validators
const createTaxRateValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    shortName: vine.string().trim().minLength(1).maxLength(50).optional(),
    taxName: vine.string().trim().minLength(1).maxLength(255),
    appliesFrom: vine.date().optional(),
    exemptAfter: vine.number().min(0).optional(),
    postingType: vine.enum(['flat_amount', 'flat_percentage', 'slab']).optional(),
    amount: vine.number().min(0).optional(),
    percentage: vine.number().min(0).max(100).optional(),
    slabInfo: vine.string().optional(),
    applyTax: vine.enum(['before_discount', 'after_discount']),
    applyTaxOnRackRate: vine.boolean().optional(),
    status: vine.enum(['active', 'inactive']).optional(),
    taxApplyAfter: vine.array(vine.number()).optional(),
    isActive: vine.boolean().optional(),
    appliesToRoomRate: vine.boolean().optional(),
    appliesToFnb: vine.boolean().optional(),
    appliesToOtherServices: vine.boolean().optional(),
    effectiveDate: vine.date().optional(),
    endDate: vine.date().optional(),
  })
)

const updateTaxRateValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    shortName: vine.string().trim().minLength(1).maxLength(50).optional(),
    taxName: vine.string().trim().minLength(1).maxLength(255).optional(),
    appliesFrom: vine.date().optional(),
    exemptAfter: vine.number().min(0).optional(),
    postingType: vine.enum(['flat_amount', 'flat_percentage', 'slab']).optional(),
    amount: vine.number().min(0).optional(),
    percentage: vine.number().min(0).max(100).optional(),
    slabInfo: vine.string().optional(),
    applyTax: vine.enum(['before_discount', 'after_discount']).optional(),
    applyTaxOnRackRate: vine.boolean().optional(),
    status: vine.enum(['active', 'inactive']).optional(),
    taxApplyAfter: vine.array(vine.number()).optional(),
    isActive: vine.boolean().optional(),
    appliesToRoomRate: vine.boolean().optional(),
    appliesToFnb: vine.boolean().optional(),
    appliesToOtherServices: vine.boolean().optional(),
    effectiveDate: vine.date().optional(),
    endDate: vine.date().optional(),
  })
)

export default class TaxRatesController {
  /**
   * Display a list of tax rates
   */
  public async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId
      const isActive = request.input('is_active')
      const search = request.input('search')

      const query = TaxRate.query()
        .preload('taxApplyAfter')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'hotelId is required in route params',
        })
      }

      query.where('hotelId', hotelId)

      if (isActive !== undefined) {
        query.where('isActive', isActive)
      }

      if (search) {
        query.where('taxName', 'LIKE', `%${search}%`)
      }

      const taxRates = await query.paginate(page, limit)

      return response.ok({
        success: true,
        message: 'Tax rates retrieved successfully',
        data: taxRates,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Error retrieving tax rates',
      })
    }
  }

  /**
   * Show form for creating a new tax rate
   */
  public async create({}: HttpContext) {}

  /**
   * Handle form submission for the create action
   */
  public async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createTaxRateValidator)
      const user = auth.user!

      const taxRate = await TaxRate.create({
        hotelId: payload.hotelId,
        shortName: payload.shortName,
        taxName: payload.taxName,
        appliesFrom: payload.appliesFrom ? DateTime.fromJSDate(payload.appliesFrom) : null,
        exemptAfter: payload.exemptAfter,
        postingType: payload.postingType,
        amount: payload.amount,
        percentage: payload.percentage,
        slabInfo: payload.slabInfo,
        applyTax: payload.applyTax,
        applyTaxOnRackRate: payload.applyTaxOnRackRate ?? false,
        status: payload.status ?? 'active',
        isActive: payload.isActive ?? true,
        appliesToRoomRate: payload.appliesToRoomRate ?? true,
        appliesToFnb: payload.appliesToFnb ?? false,
        appliesToOtherServices: payload.appliesToOtherServices ?? false,
        effectiveDate: payload.effectiveDate ? DateTime.fromJSDate(payload.effectiveDate) : DateTime.now(),
        endDate: payload.endDate ? DateTime.fromJSDate(payload.endDate) : null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      })

      // Attach tax dependencies if provided
      if (payload.taxApplyAfter && payload.taxApplyAfter.length > 0) {
        await taxRate.related('taxApplyAfter').attach(payload.taxApplyAfter)
      }

      await taxRate.load('hotel')
      await taxRate.load('taxApplyAfter')
      await taxRate.load('createdByUser')
      await taxRate.load('updatedByUser')

      return response.created({
        success: true,
        message: 'Tax rate created successfully',
        data: taxRate,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Error creating tax rate',
      })
    }
  }

  /**
   * Show the tax rate for reading
   */
  public async show({ params, response }: HttpContext) {
    try {
      const taxRate = await TaxRate.query()
        .where('taxRateId', params.id)
        .preload('hotel')
        .preload('taxApplyAfter')
        .firstOrFail()

      return response.ok({
        success: true,
        message: 'Tax rate retrieved successfully',
        data: taxRate,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Tax rate not found',
      })
    }
  }

  /**
   * Show form for editing the tax rate
   */
  public async edit({ params }: HttpContext) {}

  /**
   * Handle form submission for the edit action
   */
  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateTaxRateValidator)
      const user = auth.user!

      const taxRate = await TaxRate.query()
        .where('taxRateId', params.id)
        .firstOrFail()

      const updateData: any = {}

      if (payload.hotelId !== undefined) updateData.hotelId = payload.hotelId
      if (payload.shortName !== undefined) updateData.shortName = payload.shortName
      if (payload.taxName !== undefined) updateData.taxName = payload.taxName
      if (payload.appliesFrom !== undefined) updateData.appliesFrom = payload.appliesFrom ? DateTime.fromJSDate(payload.appliesFrom) : null
      if (payload.exemptAfter !== undefined) updateData.exemptAfter = payload.exemptAfter
      if (payload.postingType !== undefined) updateData.postingType = payload.postingType
      if (payload.amount !== undefined) updateData.amount = payload.amount
      if (payload.percentage !== undefined) updateData.percentage = payload.percentage
      if (payload.slabInfo !== undefined) updateData.slabInfo = payload.slabInfo
      if (payload.applyTax !== undefined) updateData.applyTax = payload.applyTax
      if (payload.applyTaxOnRackRate !== undefined) updateData.applyTaxOnRackRate = payload.applyTaxOnRackRate
      if (payload.status !== undefined) updateData.status = payload.status
      if (payload.isActive !== undefined) updateData.isActive = payload.isActive
      if (payload.appliesToRoomRate !== undefined) updateData.appliesToRoomRate = payload.appliesToRoomRate
      if (payload.appliesToFnb !== undefined) updateData.appliesToFnb = payload.appliesToFnb
      if (payload.appliesToOtherServices !== undefined) updateData.appliesToOtherServices = payload.appliesToOtherServices
      if (payload.effectiveDate !== undefined) updateData.effectiveDate = payload.effectiveDate ? DateTime.fromJSDate(payload.effectiveDate) : null
      if (payload.endDate !== undefined) updateData.endDate = payload.endDate ? DateTime.fromJSDate(payload.endDate) : null
      updateData.updatedByUserId = user.id

      taxRate.merge(updateData)
      await taxRate.save()
      
      // Update tax dependencies if provided
      if (payload.taxApplyAfter !== undefined) {
        await taxRate.related('taxApplyAfter').sync(payload.taxApplyAfter || [])
      }
      
      await taxRate.load('hotel')
      await taxRate.load('taxApplyAfter')
      await taxRate.load('updatedByUser')

      return response.ok({
        success: true,
        message: 'Tax rate updated successfully',
        data: taxRate,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Error updating tax rate',
      })
    }
  }

  /**
   * Delete the tax rate
   */
  public async destroy({ params, response }: HttpContext) {
    try {
      const taxRate = await TaxRate.query()
        .where('taxRateId', params.id)
        .firstOrFail()

      await taxRate.delete()

      return response.ok({
        success: true,
        message: 'Tax rate deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Error deleting tax rate',
      })
    }
  }
}