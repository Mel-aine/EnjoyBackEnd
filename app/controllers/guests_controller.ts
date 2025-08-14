import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Guest from '#models/guest'
import { createGuestValidator, updateGuestValidator } from '#validators/guest'

export default class GuestsController {
  /**
   * Display a list of guests
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const status = request.input('status')
      const vipStatus = request.input('vip_status')
      const nationality = request.input('nationality')
      const blacklisted = request.input('blacklisted')

      const query = Guest.query()

      if (search) {
        query.where((builder) => {
          builder
            .where('first_name', 'ILIKE', `%${search}%`)
            .orWhere('last_name', 'ILIKE', `%${search}%`)
            .orWhere('email', 'ILIKE', `%${search}%`)
            .orWhere('phone_number', 'ILIKE', `%${search}%`)
            .orWhere('guest_code', 'ILIKE', `%${search}%`)
            .orWhere('loyalty_number', 'ILIKE', `%${search}%`)
        })
      }

      if (status) {
        query.where('status', status)
      }

      if (vipStatus !== undefined) {
        query.where('vip_status', vipStatus)
      }

      if (nationality) {
        query.where('nationality', nationality)
      }

      if (blacklisted !== undefined) {
        query.where('blacklisted', blacklisted)
      }

      const guests = await query
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok({
        message: 'Guests retrieved successfully',
        data: guests
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve guests',
        error: error.message
      })
    }
  }

  /**
   * Create a new guest
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createGuestValidator)

      // Create guest data with proper date conversions
      const guestData: any = {
        ...payload,
        createdBy: auth.user?.id || 0
      }

      // Convert Date fields to DateTime
      if (payload.dateOfBirth) {
        guestData.dateOfBirth = DateTime.fromJSDate(payload.dateOfBirth)
      }
      if (payload.passportExpiryDate) {
        guestData.passportExpiryDate = DateTime.fromJSDate(payload.passportExpiryDate)
      }
      if (payload.idExpiryDate) {
        guestData.idExpiryDate = DateTime.fromJSDate(payload.idExpiryDate)
      }
      if (payload.blacklistedAt) {
        guestData.blacklistedAt = DateTime.fromJSDate(payload.blacklistedAt)
      }
      if (payload.lastLoginAt) {
        guestData.lastLoginAt = DateTime.fromJSDate(payload.lastLoginAt)
      }
      if (payload.lastActivityAt) {
        guestData.lastActivityAt = DateTime.fromJSDate(payload.lastActivityAt)
      }
      if (payload.lastStayDate) {
        guestData.lastStayDate = DateTime.fromJSDate(payload.lastStayDate)
      }
      if (payload.nextStayDate) {
        guestData.nextStayDate = DateTime.fromJSDate(payload.nextStayDate)
      }

      const guest = await Guest.create(guestData)

      return response.created({
        message: 'Guest created successfully',
        data: guest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create guest',
        error: error.message
      })
    }
  }

  /**
   * Show a specific guest
   */
  async show({ params, response }: HttpContext) {
    try {
      const guest = await Guest.query()
        .where('id', params.id)
        .preload('reservations')
        .preload('folios')
        .firstOrFail()

      return response.ok({
        message: 'Guest retrieved successfully',
        data: guest
      })
    } catch (error) {
      return response.notFound({
        message: 'Guest not found',
        error: error.message
      })
    }
  }

  /**
   * Update a guest
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const guest = await Guest.findOrFail(params.id)
      const payload = await request.validateUsing(updateGuestValidator)

      // Create update data with proper date conversions
      const updateData: any = {
        ...payload,
        lastModifiedBy: auth.user?.id || 0
      }

      // Convert Date fields to DateTime
      if (payload.dateOfBirth) {
        updateData.dateOfBirth = DateTime.fromJSDate(payload.dateOfBirth)
      }
      if (payload.passportExpiryDate) {
        updateData.passportExpiryDate = DateTime.fromJSDate(payload.passportExpiryDate)
      }
      if (payload.idExpiryDate) {
        updateData.idExpiryDate = DateTime.fromJSDate(payload.idExpiryDate)
      }
      if (payload.blacklistedAt) {
        updateData.blacklistedAt = DateTime.fromJSDate(payload.blacklistedAt)
      }
      if (payload.lastLoginAt) {
        updateData.lastLoginAt = DateTime.fromJSDate(payload.lastLoginAt)
      }
      if (payload.lastActivityAt) {
        updateData.lastActivityAt = DateTime.fromJSDate(payload.lastActivityAt)
      }
      if (payload.lastStayDate) {
        updateData.lastStayDate = DateTime.fromJSDate(payload.lastStayDate)
      }
      if (payload.nextStayDate) {
        updateData.nextStayDate = DateTime.fromJSDate(payload.nextStayDate)
      }

      guest.merge(updateData)

      await guest.save()

      return response.ok({
        message: 'Guest updated successfully',
        data: guest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update guest',
        error: error.message
      })
    }
  }

  /**
   * Delete a guest
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const guest = await Guest.findOrFail(params.id)
      await guest.delete()

      return response.ok({
        message: 'Guest deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete guest',
        error: error.message
      })
    }
  }

  /**
   * Get guest profile with stay history
   */
  async profile({ params, response }: HttpContext) {
    try {
      const guest = await Guest.query()
        .where('id', params.id)
        .preload('reservations', (query) => {
          query.orderBy('created_at', 'desc').limit(10)
        })
        .preload('folios', (query) => {
          query.orderBy('created_at', 'desc').limit(5)
        })
        .firstOrFail()

      const totalReservations = await guest.related('reservations').query().count('* as total')
      const totalSpent = await guest.related('folios').query().sum('total_charges as total')
      const averageRating = await guest.related('reservations').query().avg('satisfaction_rating as avg')

      const profile = {
        guest,
        statistics: {
          totalReservations: totalReservations[0].$extras.total,
          totalSpent: totalSpent[0].$extras.total || 0,
          averageRating: averageRating[0].$extras.avg || 0,
          lastStayDate: guest.lastStayDate,
          loyaltyStatus: guest.vipStatus ? 'VIP' : 'Regular'
        }
      }

      return response.ok({
        message: 'Guest profile retrieved successfully',
        data: profile
      })
    } catch (error) {
      return response.notFound({
        message: 'Guest not found',
        error: error.message
      })
    }
  }

  /**
   * Search guests by various criteria
   */
  async search({ request, response }: HttpContext) {
    try {
      const { query: searchQuery, type } = request.only(['query', 'type'])

      if (!searchQuery) {
        return response.badRequest({
          message: 'Search query is required'
        })
      }

      const query = Guest.query()

      switch (type) {
        case 'email':
          query.where('email', 'ILIKE', `%${searchQuery}%`)
          break
        case 'phone':
          query.where('phone_number', 'ILIKE', `%${searchQuery}%`)
          break
        case 'loyalty':
          query.where('loyalty_number', 'ILIKE', `%${searchQuery}%`)
          break
        case 'guest_code':
          query.where('guest_code', 'ILIKE', `%${searchQuery}%`)
          break
        default:
          query.where((builder) => {
            builder
              .where('first_name', 'ILIKE', `%${searchQuery}%`)
              .orWhere('last_name', 'ILIKE', `%${searchQuery}%`)
              .orWhere('email', 'ILIKE', `%${searchQuery}%`)
              .orWhere('phone_number', 'ILIKE', `%${searchQuery}%`)
          })
      }

      const guests = await query.limit(20)

      return response.ok({
        message: 'Search results retrieved successfully',
        data: guests
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Search failed',
        error: error.message
      })
    }
  }

  /**
   * Toggle guest blacklist status
   */
  async toggleBlacklist({ params, request, response, auth }: HttpContext) {
    try {
      const guest = await Guest.findOrFail(params.id)
      const { reason } = request.only(['reason'])

      guest.blacklisted = !guest.blacklisted
      guest.lastModifiedBy = auth.user?.id || 0

      if (guest.blacklisted && reason) {
        guest.notes = `${guest.notes || ''}\n[${new Date().toISOString()}] Blacklisted: ${reason}`
      }

      await guest.save()

      return response.ok({
        message: `Guest ${guest.blacklisted ? 'blacklisted' : 'removed from blacklist'} successfully`,
        data: guest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to toggle blacklist status',
        error: error.message
      })
    }
  }

  /**
   * Update guest VIP status
   */
  async updateVipStatus({ params, request, response, auth }: HttpContext) {
    try {
      const guest = await Guest.findOrFail(params.id)
      const { vipStatus } = request.only(['vipStatus'])

      guest.vipStatus = vipStatus
      guest.lastModifiedBy = auth.user?.id || 0

      await guest.save()

      return response.ok({
        message: 'Guest VIP status updated successfully',
        data: guest
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update VIP status',
        error: error.message
      })
    }
  }





}
