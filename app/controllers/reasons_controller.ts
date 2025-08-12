import type { HttpContext } from '@adonisjs/core/http'
import Reason from '#models/reason'
import { createReasonValidator, updateReasonValidator } from '#validators/reason'
import { DateTime } from 'luxon'

export default class ReasonsController {
  /**
   * Display a list of reasons
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotel_id')
      const category = request.input('category')
      const search = request.input('search')

      const query = Reason.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (category) {
        query.where('category', category)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('reason_name', 'LIKE', `%${search}%`)
            .orWhere('category', 'LIKE', `%${search}%`)
        })
      }

      const reasons = await query.paginate(page, limit)
      return response.ok(reasons)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch reasons', error: error.message })
    }
  }

  /**
   * Create a new reason
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReasonValidator)
      const user = auth.user!

      const reason = await Reason.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      })

      await reason.load('hotel')
      await reason.load('createdByUser')
      await reason.load('updatedByUser')

      return response.created(reason)
    } catch (error) {
      return response.badRequest({ message: 'Failed to create reason', error: error.message })
    }
  }

  /**
   * Show a specific reason
   */
  async show({ params, response }: HttpContext) {
    try {
      const reason = await Reason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok(reason)
    } catch (error) {
      return response.notFound({ message: 'Reason not found' })
    }
  }

  /**
   * Update a reason
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const reason = await Reason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      const payload = await request.validateUsing(updateReasonValidator)
      const user = auth.user!

      reason.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await reason.save()
      await reason.load('hotel')
      await reason.load('createdByUser')
      await reason.load('updatedByUser')

      return response.ok(reason)
    } catch (error) {
      return response.badRequest({ message: 'Failed to update reason', error: error.message })
    }
  }

  /**
   * Soft delete a reason
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const reason = await Reason.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      const user = auth.user!

      reason.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id,
      })

      await reason.save()

      return response.ok({ message: 'Reason deleted successfully' })
    } catch (error) {
      return response.badRequest({ message: 'Failed to delete reason', error: error.message })
    }
  }

  /**
   * Get reasons by category
   */
  async getByCategory({ params, response }: HttpContext) {
    try {
      const reasons = await Reason.query()
        .where('category', params.category)
        .where('is_deleted', false)
        .preload('hotel')
        .orderBy('reason_name', 'asc')

      return response.ok(reasons)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch reasons by category', error: error.message })
    }
  }

  /**
   * Get all categories
   */
  async getCategories({ response }: HttpContext) {
    try {
      const categories = await Reason.query()
        .where('is_deleted', false)
        .distinct('category')
        .orderBy('category', 'asc')

      return response.ok(categories.map(reason => reason.category))
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch categories', error: error.message })
    }
  }

  /**
   * Get reasons by status
   */
  async getByStatus({ params, response }: HttpContext) {
    try {
      const reasons = await Reason.query()
        .where('status', params.status)
        .where('is_deleted', false)
        .preload('hotel')
        .orderBy('reason_name', 'asc')

      return response.ok(reasons)
    } catch (error) {
      return response.badRequest({ message: 'Failed to fetch reasons by status', error: error.message })
    }
  }
}