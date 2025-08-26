import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Guest from '#models/guest'
import { createGuestValidator, updateGuestValidator } from '#validators/guest'
import { generateGuestCode } from '../utils/generate_guest_code.js'

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

      const guests = await query.orderBy('created_at', 'desc').paginate(page, limit)

      return response.ok({
        message: 'Guests retrieved successfully',
        data: guests,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve guests',
        error: error.message,
      })
    }
  }

  /**
   * Create a new guest
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      console.log('Start guest creation process')

      // Validate payload
      const payload = await request.validateUsing(createGuestValidator)
      console.log('Payload validated:', payload)

      // Prepare guest data
      const guestData: any = {
        ...payload,
        createdBy: auth.user?.id || 0,
        guestCode: generateGuestCode(),
      }
      console.log('Initial guest data:', guestData)

      // Convert Date fields to DateTime
      if (payload.dateOfBirth) {
        guestData.dateOfBirth = DateTime.fromJSDate(payload.dateOfBirth)
        console.log('Converted dateOfBirth:', guestData.dateOfBirth.toISO())
      }
      if (payload.passportExpiry) {
        guestData.passportExpiry = DateTime.fromJSDate(payload.passportExpiry)
        console.log('Converted passportExpiry:', guestData.passportExpiry.toISO())
      }
      if (payload.visaExpiry) {
        guestData.visaExpiry = DateTime.fromJSDate(payload.visaExpiry)
        console.log('Converted visaExpiry:', guestData.visaExpiry.toISO())
      }
      if (payload.idExpiryDate) {
        guestData.idExpiryDate = DateTime.fromJSDate(payload.idExpiryDate)
        console.log('Converted idExpiryDate:', guestData.idExpiryDate.toISO())
      }
      if (payload.blacklistedAt) {
        guestData.blacklistedAt = DateTime.fromJSDate(payload.blacklistedAt)
        console.log('Converted blacklistedAt:', guestData.blacklistedAt.toISO())
      }
      if (payload.lastLoginAt) {
        guestData.lastLoginAt = DateTime.fromJSDate(payload.lastLoginAt)
        console.log('Converted lastLoginAt:', guestData.lastLoginAt.toISO())
      }
      if (payload.lastActivityAt) {
        guestData.lastActivityAt = DateTime.fromJSDate(payload.lastActivityAt)
        console.log('Converted lastActivityAt:', guestData.lastActivityAt.toISO())
      }
      if (payload.lastStayDate) {
        guestData.lastStayDate = DateTime.fromJSDate(payload.lastStayDate)
        console.log('Converted lastStayDate:', guestData.lastStayDate.toISO())
      }
      if (payload.nextStayDate) {
        guestData.nextStayDate = DateTime.fromJSDate(payload.nextStayDate)
        console.log('Converted nextStayDate:', guestData.nextStayDate.toISO())
      }

      // Create guest
      const guest = await Guest.create(guestData)
      console.log('Guest created successfully:', guest)

      return response.created({
        message: 'Guest created successfully',
        data: guest,
      })
    } catch (error) {
      console.error('Error creating guest:', error)
      return response.badRequest({
        message: 'Failed to create guest',
        error: error.message,
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
        data: guest,
      })
    } catch (error) {
      return response.notFound({
        message: 'Guest not found',
        error: error.message,
      })
    }
  }

  /**
   * Show by hotel_i a specific guest
   */
  async showbyHotelId({ params, response }: HttpContext) {
    try {
      const guest = await Guest.query()
        .where('hotel_id', params.id)
        .preload('reservations')
        .preload('folios')

      return response.ok({
        message: 'Guest retrieved successfully',
        data: guest,
      })
    } catch (error) {
      return response.notFound({
        message: 'Guest not found',
        error: error.message,
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

      // Infer the type of the validated payload
      type PayloadType = typeof payload

      const updateData: any = { ...payload, lastModifiedBy: auth.user?.id || 0 }

      const dateFields: (keyof PayloadType)[] = [
        'dateOfBirth',
        'passportExpiry',
        'visaExpiry',
        'idExpiryDate',
        'blacklistedAt',
        'lastLoginAt',
        'lastActivityAt',
        'lastStayDate',
        'nextStayDate',
      ]

       for (const field of dateFields) {
      const value = payload[field]
      if (value) {
        updateData[field] = DateTime.fromJSDate(value as Date)
      }
    }

      guest.merge(updateData)
      await guest.save()

      return response.ok({
        message: 'Guest updated successfully',
        data: guest,
      })
    } catch (error) {
      console.error('UPDATE FAILED:', error)
      return response.badRequest({
        message: 'Failed to update guest',
        error: error.message || error,
      })
    }
  }

  /**
   * Delete a guest only if they have no active or upcoming reservations.
   */
  async destroy({ params, response }: HttpContext) {
    try {
      // 1. On trouve le client. Si non trouvé, `findOrFail` lève une erreur 404.
      const guest = await Guest.findOrFail(params.id)

      // 2. La vérification clé : On cherche s'il existe AU MOINS UNE réservation "en cours".
      // Une réservation "en cours" peut être définie par son statut.
      // C'est la méthode la plus fiable.
      const activeStatuses = ['confirmed', 'checked_in', 'pending']

      const activeReservation = await guest
        .related('reservations')
        .query()
        .whereIn('status', activeStatuses)
        .first() // On s'arrête dès qu'on en trouve une, c'est plus performant.
      if (activeReservation) {
        return response.conflict({
          message: 'Cannot delete this guest as they have active or upcoming reservations.',
          blockingReservationId: activeReservation.id
        })
      }

      //  Si aucune réservation active n'a été trouvée, on peut supprimer le client en toute sécurité.
      await guest.delete()

      return response.ok({
        message: 'Guest deleted successfully',
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Guest not found' })
      }

      return response.badRequest({
        message: 'Failed to delete guest',
        error: error.message,
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
        .preload('reservations', (reservationQuery) => {

          reservationQuery.preload('reservationRooms', (roomQuery) => {
            roomQuery.preload('room')
            roomQuery.preload('roomType')
            // On ne prend que les statuts pertinents pour ne pas surcharger
            roomQuery.whereIn('status', ['reserved', 'checked_in'])
          })
        })
        .preload('folios', (query) => {
          query.orderBy('created_at', 'desc').limit(5)
        })
        .firstOrFail()

      // --- Logique pour trouver le statut actuel et à venir ---

      // Aplatir toutes les `reservationRooms` de toutes les `reservations` en une seule liste
      const allStays = guest.reservations.flatMap(res => res.reservationRooms)

      // Trouver le séjour actif (statut 'checked_in')
      const activeStay = allStays.find(stay => stay.status === 'checked_in') || null

      // Trouver le prochain séjour à venir (statut 'reserved' et pas encore commencé)
      const upcomingStay = allStays
        .filter(stay => stay.status === 'reserved' && stay.checkInDate > DateTime.now())
        .sort((a, b) => a.checkInDate.toMillis() - b.checkInDate.toMillis())[0] || null

      // Construire l'objet de retour final
      const profileData = {
        ...guest.serialize(),
        activeStay: activeStay ? activeStay.serialize() : null,
        upcomingStay: upcomingStay ? upcomingStay.serialize() : null,

      };

      // Les statistiques peuvent être calculées comme avant si besoin
      const totalReservations = await guest.related('reservations').query().count('* as total')
      const totalSpent = await guest.related('folios').query().sum('total_charges as total')

      const profile = {
        guest: profileData,
        statistics: {
          totalReservations: totalReservations[0].$extras.total,
          totalSpent: totalSpent[0].$extras.total || 0,
          lastStayDate: guest.lastStayDate,
          loyaltyStatus: guest.vipStatus ? 'VIP' : 'Regular',
        },
      }

      return response.ok({
        message: 'Guest profile retrieved successfully',
        data: profile,
      })
    } catch (error) {
      console.error(error)
      return response.notFound({
        message: 'Guest not found',
        error: error.message,
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
          message: 'Search query is required',
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
        data: guests,
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Search failed',
        error: error.message,
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
        data: guest,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to toggle blacklist status',
        error: error.message,
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
        data: guest,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update VIP status',
        error: error.message,
      })
    }
  }
}
