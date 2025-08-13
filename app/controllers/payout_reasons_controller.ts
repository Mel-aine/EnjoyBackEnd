import type { HttpContext } from '@adonisjs/core/http'
import PayoutReason from '#models/payout_reason'
import { createPayoutReasonValidator, updatePayoutReasonValidator } from '#validators/payout_reason'
import { DateTime } from 'luxon'

export default class PayoutReasonsController {
  /**
   * Display a list of payout reasons
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotelId')

      const query = PayoutReason.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const payoutReasons = await query.paginate(page, limit)
      return response.ok(payoutReasons)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch payout reasons', error: error.message })
    }
  }

  /**
   * Create a new payout reason
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createPayoutReasonValidator)
      const user = auth.user!

      const payoutReason = await PayoutReason.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      })

      await payoutReason.load('hotel')
      await payoutReason.load('createdByUser')
      await payoutReason.load('updatedByUser')

      return response.created(payoutReason)
    } catch (error) {
      return response.badRequest({ message: 'Failed to create payout reason', error: error.message })
    }
  }

  /**
   * Show a specific payout reason
   */
  async show({ params, response }: HttpContext) {
    try {
      const payoutReason = await PayoutReason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok(payoutReason)
    } catch (error) {
      return response.notFound({ message: 'Payout reason not found' })
    }
  }

  /**
   * Update a payout reason
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updatePayoutReasonValidator)
      const user = auth.user!

      const payoutReason = await PayoutReason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      payoutReason.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await payoutReason.save()
      await payoutReason.load('hotel')
      await payoutReason.load('createdByUser')
      await payoutReason.load('updatedByUser')

      return response.ok(payoutReason)
    } catch (error) {
      return response.badRequest({ message: 'Failed to update payout reason', error: error.message })
    }
  }

  /**
   * Soft delete a payout reason
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const payoutReason = await PayoutReason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      payoutReason.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id,
      })

      await payoutReason.save()
      return response.ok({ message: 'Payout reason deleted successfully' })
    } catch (error) {
      return response.notFound({ message: 'Payout reason not found' })
    }
  }

  /**
   * Get payout reasons by status
   */
  async getByStatus({ params, request, response }: HttpContext) {
    try {
      const { status } = params
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotelId')

      const query = PayoutReason.query()
        .where('status', status)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const payoutReasons = await query.paginate(page, limit)
      return response.ok(payoutReasons)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch payout reasons by status', error: error.message })
    }
  }
}