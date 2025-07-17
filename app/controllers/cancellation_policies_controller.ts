import type { HttpContext } from '@adonisjs/core/http'
import CancellationPolicy from '#models/cancellation_policy'
import vine from '@vinejs/vine'

export default class CancellationPoliciesController {
  /**
   * Display a list of all cancellation policies.
   */
  public async index({ response }: HttpContext) {
    try {
      const policies = await CancellationPolicy.query()
        .preload('hotel')
        .preload('lastModifiedByUser')
        .orderBy('createdAt', 'desc')
      return response.ok(policies)
    } catch (error) {
      console.error('Error fetching cancellation policies:', error)
      return response.internalServerError({ message: 'Failed to fetch cancellation policies' })
    }
  }

  /**
   * Create a new cancellation policy.
   * The user performing the action is taken from the auth context.
   */
  public async store({ request, response, auth }: HttpContext) {
    const schema = vine.object({
      hotelId: vine.number(),
      policyName: vine.string().maxLength(255),
      freeCancellationPeriodValue: vine.number(),
      freeCancellationPeriodUnit: vine.enum(['hours', 'days']),
      cancellationFeeType: vine.enum(['none', 'fixed', 'percentage', 'first_night']),
      cancellationFeeValue: vine.number().nullable(),
      nonRefundableRateEnabled: vine.boolean(),
      specialConditionsNotes: vine.string().nullable(),
    })

    try {
      const payload = await request.validate({ schema })
      const policy = await CancellationPolicy.create({
        ...payload,
        lastModifiedByUserId: auth.user!.id,
      })
      return response.created(policy)
    } catch (error) {
      console.error('Error creating cancellation policy:', error)
      return response.badRequest({
        message: 'Failed to create cancellation policy',
        error: error.message,
      })
    }
  }

  /**
   * Show a single cancellation policy by its ID.
   */
  public async show({ params, response }: HttpContext) {
    try {
      const policy = await CancellationPolicy.query()
        .where('policy_id', params.id)
        .preload('hotel')
        .preload('lastModifiedByUser')
        .firstOrFail()
      return response.ok(policy)
    } catch (error) {
      return response.notFound({ message: 'Cancellation policy not found' })
    }
  }

  /**
   * Update an existing cancellation policy.
   */
  public async update({ params, request, response, auth }: HttpContext) {
    const schema = vine.object({
      hotelId: vine.number().optional(),
      policyName: vine.string().maxLength(255).optional(),
      freeCancellationPeriodValue: vine.number().optional(),
      freeCancellationPeriodUnit: vine.enum(['hours', 'days']).optional(),
      cancellationFeeType: vine.enum(['none', 'fixed', 'percentage', 'first_night']).optional(),
      cancellationFeeValue: vine.number().nullable().optional(),
      nonRefundableRateEnabled: vine.boolean().optional(),
      specialConditionsNotes: vine.string().nullable().optional(),
    })

    try {
      const payload = await request.validate({ schema })
      const policy = await CancellationPolicy.findOrFail(params.id)

      policy.merge({
        ...payload,
        lastModifiedByUserId: auth.user!.id,
      })

      await policy.save()

      await policy.load('hotel')
      await policy.load('lastModifiedByUser')

      return response.ok(policy)
    } catch (error) {
      console.error('Error updating cancellation policy:', error)
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Cancellation policy not found' })
      }
      return response.badRequest({
        message: 'Failed to update cancellation policy',
        error: error.message,
      })
    }
  }

  /**
   * Delete a cancellation policy.
   */
  public async destroy({ params, response }: HttpContext) {
    try {
      const policy = await CancellationPolicy.findOrFail(params.id)
      await policy.delete()
      return response.ok({ message: 'Cancellation policy deleted successfully' })
    } catch (error) {
      console.error('Error deleting cancellation policy:', error)
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Cancellation policy not found' })
      }
      return response.internalServerError({ message: 'Failed to delete cancellation policy' })
    }
  }

  /**
   * Get all policies for a specific hotel.
   * Example: /api/cancellation-policies/hotel/1
   */
  public async showByHotel({ params, response }: HttpContext) {
    const hotelId = params.hotelId

    if (!hotelId) {
      return response.badRequest({ message: 'hotelId is a required parameter.' })
    }

    const policies = await CancellationPolicy.query()
      .where('hotel_id', hotelId)
      .preload('lastModifiedByUser')
      .orderBy('createdAt', 'desc')

    return response.ok(policies)
  }
}