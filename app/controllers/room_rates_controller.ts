import type { HttpContext } from '@adonisjs/core/http'
import RoomRate from '#models/room_rate'
import { createRoomRateValidator, updateRoomRateValidator } from '#validators/room_rate'
import Database from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import LoggerService from '#services/logger_service'

export default class RoomRatesController {
  /**
   * Display a list of room rates
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId
      const roomTypeId = request.input('room_type_id')
      const rateTypeId = request.input('rate_type_id')
      const seasonId = request.input('season_id')
      const sourceId = request.input('source_id')
      const status = request.input('status')
      const search = request.input('search')

      if (!hotelId) {
        return response.badRequest({ message: 'hotelId is required' })
      }

      const query = RoomRate.query()
        .preload('hotel')
        .preload('roomType')
        .preload('rateType')
        .preload('season')
        .preload('source')
        .preload('creator')
        .preload('modifier')
        .preload('mealPlan')

      // Filter by hotel (required)
      query.where('hotel_id', Number(hotelId))

      // Filter by room type if provided
      if (roomTypeId) {
        query.where('room_type_id', roomTypeId)
      }

      // Filter by rate type if provided
      if (rateTypeId) {
        query.where('rate_type_id', rateTypeId)
      }

      // Filter by season if provided
      if (seasonId) {
        query.where('season_id', seasonId)
      }

      // Filter by source if provided
      if (sourceId) {
        query.where('source_id', sourceId)
      }

      // Filter by status if provided
      if (status) {
        query.where('status', status)
      }

      // Search functionality
      if (search) {
        query.where((builder) => {
          builder
            .whereHas('roomType', (roomTypeQuery) => {
              roomTypeQuery.whereILike('room_type_name', `%${search}%`)
            })
            .orWhereHas('rateType', (rateTypeQuery) => {
              rateTypeQuery.whereILike('rate_type_name', `%${search}%`)
            })
            .orWhereHas('season', (seasonQuery) => {
              seasonQuery.whereILike('season_name', `%${search}%`)
            })
        })
      }

      query.orderBy('created_at', 'desc')

      const roomRates = await query.paginate(page, limit)

      return response.ok({
        message: 'Room rates retrieved successfully',
        data: roomRates
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve room rates',
        error: error.message
      })
    }
  }

  /**
   * Create a new room rate
   */
  async store({ request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const payload = await request.validateUsing(createRoomRateValidator)
      const userId = auth.user?.id

      const roomRate = await RoomRate.create({
        ...payload,
        createdBy: userId!,
        lastModifiedBy: userId!
      }, { client: trx })

      // Load the room type and rate type to establish the relationship
      await roomRate.load('roomType')
      await roomRate.load('rateType')

      // Add the rate type to the room type's rateTypes relationship if not already present
      const roomType = roomRate.roomType
      const rateTypeId = roomRate.rateTypeId

      // Check if the relationship already exists
      await roomType.load('rateTypes')
      const existingRateType = roomType.rateTypes.find(rt => rt.id === rateTypeId)

      if (!existingRateType) {
        // Attach the rate type to the room type
        await roomType.related('rateTypes').attach([rateTypeId], trx)
      }

      await roomRate.load('hotel')
     // await roomRate.load('season')
     // await roomRate.load('source')
      await roomRate.load('creator')

      await trx.commit()

      await LoggerService.log({
        actorId: userId!,
        action: 'CREATE',
        entityType: 'RoomRate',
        entityId: roomRate.id,
        hotelId: roomRate.hotelId,
        description: 'Room rate created',
        changes: LoggerService.extractChanges({}, roomRate.serialize()),
        ctx: { request, response } as any,
      })

      return response.created({
        message: 'Room rate created successfully',
        data: roomRate
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to create room rate',
        error: error.message
      })
    }
  }

  /**
   * Show a specific room rate
   */
  async show({ params, response }: HttpContext) {
    try {
      const id = parseInt(params.id)

      if (isNaN(id)) {
        return response.badRequest({ message: 'Invalid ID' })
      }

      const roomRate = await RoomRate.query()
        .where('id', id)
        .preload('hotel')
        .preload('roomType')
        .preload('rateType')
        .preload('season')
        .preload('source')
        .preload('creator')
        .preload('modifier')
        .firstOrFail()

      return response.ok({
        message: 'Room rate retrieved successfully',
        data: roomRate
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Room rate not found' })
      }
      return response.badRequest({
        message: 'Failed to retrieve room rate',
        error: error.message
      })
    }
  }

  /**
   * Update a room rate
   */
  async update({ params, request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const id = parseInt(params.id)

      if (isNaN(id)) {
        await trx.rollback()
        return response.badRequest({ message: 'Invalid ID' })
      }

      const payload = await request.validateUsing(updateRoomRateValidator)

      const userId = auth.user?.id

      const roomRate = await RoomRate.query()
        .where('id', id)
        .forUpdate()
        .firstOrFail()

      const oldData = roomRate.serialize()

      roomRate.merge({
        ...payload,
        lastModifiedBy: userId!,
      })

      await roomRate.save()

      const newData = roomRate.serialize()

      await roomRate.load('hotel')
      await roomRate.load('roomType')
      await roomRate.load('rateType')
      await roomRate.load('season')
      await roomRate.load('source')
      await roomRate.load('modifier')

      await trx.commit()

      await LoggerService.log({
        actorId: userId!,
        action: 'UPDATE',
        entityType: 'RoomRate',
        entityId: roomRate.id,
        hotelId: roomRate.hotelId,
        description: 'Room rate updated',
        changes: LoggerService.extractChanges(oldData, newData),
        ctx: { request, response } as any,
      })

      return response.ok({
        message: 'Room rate updated successfully',
        data: roomRate
      })
    } catch (error) {
      await trx.rollback()
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Room rate not found' })
      }
      return response.badRequest({
        message: 'Failed to update room rate',
        error: error.message
      })
    }
  }

  /**
   * Delete a room rate
   */
  async destroy({ params, request, response, auth }: HttpContext) {
    try {
      const id = parseInt(params.id)

      if (isNaN(id)) {
        return response.badRequest({ message: 'Invalid ID' })
      }

      const roomRate = await RoomRate.findOrFail(id)
      const oldData = roomRate.serialize()

      await roomRate.delete()

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'DELETE',
        entityType: 'RoomRate',
        entityId: roomRate.id,
        hotelId: roomRate.hotelId,
        description: 'Room rate deleted',
        changes: LoggerService.extractChanges(oldData, {}),
        ctx: { request, response } as any,
      })

      return response.ok({
        message: 'Room rate deleted successfully',
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Room rate not found' })
      }
      return response.badRequest({
        message: 'Failed to delete room rate',
        error: error.message
      })
    }
  }

  /**
   * Get room rates by date range
   */
  async getByDateRange({ request, response }: HttpContext) {
    try {
      const { startDate, endDate, roomTypeId, rateTypeId, seasonId, sourceId } = request.only([
        'startDate', 'endDate', 'roomTypeId', 'rateTypeId', 'seasonId', 'sourceId'
      ])

      const query = RoomRate.query()
        .preload('roomType')
        .preload('rateType')
        .preload('season')
        .preload('source')

      if (startDate && endDate) {
        query.where((builder) => {
          builder
            .whereBetween('effective_from', [startDate, endDate])
            .orWhereBetween('effective_to', [startDate, endDate])
            .orWhere((subBuilder) => {
              subBuilder
                .where('effective_from', '<=', startDate)
                .where('effective_to', '>=', endDate)
            })
        })
      }

      if (roomTypeId) {
        query.where('room_type_id', roomTypeId)
      }

      if (rateTypeId) {
        query.where('rate_type_id', rateTypeId)
      }

      if (seasonId) {
        query.where('season_id', seasonId)
      }

      if (sourceId) {
        query.where('source_id', sourceId)
      }

      query.where('status', 'active')
      query.orderBy('effective_from', 'asc')

      const roomRates = await query

      return response.ok({
        message: 'Room rates retrieved successfully',
        data: roomRates
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve room rates',
        error: error.message
      })
    }
  }

  /**
   * Get room rate statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotel_id')

      const query = RoomRate.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const [total, active, inactive] = await Promise.all([
        query.clone().count('* as total'),
        query.clone().where('status', 'active').count('* as total'),
        query.clone().where('status', 'inactive').count('* as total')
      ])

      const averageBaseRate = await query.clone().avg('base_rate as avg_rate')
      const minBaseRate = await query.clone().min('base_rate as min_rate')
      const maxBaseRate = await query.clone().max('base_rate as max_rate')

      return response.ok({
        message: 'Room rate statistics retrieved successfully',
        data: {
          total: Number(total[0].$extras.total),
          active: Number(active[0].$extras.active),
          inactive: Number(inactive[0].$extras.inactive),
          averageBaseRate: Number(averageBaseRate[0].$extras.avg_rate || 0),
          minBaseRate: Number(minBaseRate[0].$extras.min_rate || 0),
          maxBaseRate: Number(maxBaseRate[0].$extras.max_rate || 0)
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve room rate statistics',
        error: error.message
      })
    }
  }

  /**
   * Récupère le baseRate le plus récent pour un roomType et rateType donnés
   * @param hotelId - ID de l'hôtel
   * @param roomTypeId - ID du type de chambre
   * @param rateTypeId - ID du type de tarif
   * @param date - Date pour laquelle récupérer le tarif (optionnel, par défaut aujourd'hui)
   * @returns Le baseRate ou null si non trouvé
   */
  // async getBaseRateByRoomAndRateType({ request, response }: HttpContext) {
  //   try {
  //     const hotelId = request.input('hotel_id')
  //     const roomTypeId = request.input('room_type_id')
  //     const rateTypeId = request.input('rate_type_id')
  //     const dateInput = request.input('date')

  //     // Conversion de la date en DateTime Luxon
  //     const date = dateInput ? DateTime.fromISO(dateInput) : DateTime.now()
  //     const dateStr = date.toSQLDate()

  //     if (!dateStr) {
  //       return response.badRequest({
  //         message: 'La date fournie est invalide'
  //       })
  //     }

  //     const roomRate = await RoomRate.query()
  //       .where('hotel_id', hotelId)
  //       .where('room_type_id', roomTypeId)
  //       .where('rate_type_id', rateTypeId)
  //       .where((query) => {
  //         query
  //           .whereNull('effective_from')
  //           .orWhere('effective_from', '<=', dateStr)
  //       })
  //       .where((query) => {
  //         query
  //           .whereNull('effective_to')
  //           .orWhere('effective_to', '>=', dateStr)
  //       })
  //       .orderBy('created_at', 'desc')
  //       .first()

  //     return response.ok({
  //       id:roomRate?.id,
  //       message: 'Base rate récupéré avec succès',
  //       baseRate: roomRate?.baseRate || null
  //     })
  //   } catch (error) {
  //     return response.badRequest({
  //       message: 'Impossible de récupérer le base rate',
  //       error: error.message
  //     })
  //   }
  // }
async getBaseRateByRoomAndRateType({ request, response }: HttpContext) {
  try {
    const hotelId = request.input('hotel_id')
    const roomTypeId = request.input('room_type_id')
    const rateTypeId = request.input('rate_type_id')
    const dateInput = request.input('date')


    // Conversion de la date en DateTime Luxon
    const date = dateInput ? DateTime.fromISO(dateInput) : DateTime.now()
    const dateStr = date.toSQLDate()

    if (!dateStr) {
      return response.badRequest({
        message: 'La date fournie est invalide'
      })
    }

    const roomRate = await RoomRate.query()
      .where('hotel_id', hotelId)
      .where('room_type_id', roomTypeId)
      .where('rate_type_id', rateTypeId)
      .preload('mealPlan', (mealPlanQuery) => {
        mealPlanQuery.preload('extraCharges')
      })
     /* .where((query) => {
        query
          .whereNull('effective_from')
          .orWhere('effective_from', '<=', dateStr)
      })
      .where((query) => {
        query
          .whereNull('effective_to')
          .orWhere('effective_to', '>=', dateStr)
      })*/
      .orderBy('created_at', 'desc')
      .first()

    if (!roomRate) {
      return response.notFound({
        message: 'Aucun tarif trouvé pour les critères spécifiés'
      })
    }

    // Retourner toutes les informations de tarification nécessaires
    return response.ok({
      id: roomRate.id,
      message: 'Tarifs récupérés avec succès',
      baseRate: roomRate.baseRate || 0,
      extraAdultRate: roomRate.extraAdultRate || 0,
      extraChildRate: roomRate.extraChildRate || 0,
      extraPersonRate: roomRate.extraPersonRate || 0,
      singleOccupancyRate: roomRate.singleOccupancyRate || 0,
      doubleOccupancyRate: roomRate.doubleOccupancyRate || 0,
      tripleOccupancyRate: roomRate.tripleOccupancyRate || 0,
      weekendRate: roomRate.weekendRate || 0,
      holidayRate: roomRate.holidayRate || 0,
      peakSeasonRate: roomRate.peakSeasonRate || 0,
      offSeasonRate: roomRate.offSeasonRate || 0,
      minimumNights: roomRate.minimumNights || 1,
      maximumNights: roomRate.maximumNights || null,
      isAvailable: roomRate.isAvailable,
      availableRooms: roomRate.availableRooms || 0,
      restrictions: roomRate.restrictions || {},
      bookingRules: roomRate.bookingRules || {},
      rateDate: dateStr,
      effectiveFrom: roomRate.effectiveFrom,
      effectiveTo: roomRate.effectiveTo,
      mealPlan: roomRate.mealPlan || null,
      mealPlanId:roomRate.mealPlanId || null,
      mealPlanRateInclude : roomRate.mealPlanRateInclude,
      taxInclude : roomRate.taxInclude

    })
  } catch (error) {
    console.error('Erreur lors de la récupération du tarif:', error)
    return response.badRequest({
      message: 'Impossible de récupérer les tarifs',
      error: error.message
    })
  }
}
}
