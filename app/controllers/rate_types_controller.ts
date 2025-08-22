import type { HttpContext } from '@adonisjs/core/http'
import RateType from '#models/rate_type'
import RoomType from '#models/room_type'
import { createRateTypeValidator, updateRateTypeValidator } from '#validators/rate_type'
import Database from '@adonisjs/lucid/services/db'
import RoomRate from '../models/room_rate.js'

export default class RateTypesController {
  /**
   * Display a list of rate types
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = request.input('hotel_id')
      const search = request.input('search')
      const includeDeleted = request.input('include_deleted', false)

      const query = RateType.query()
        .preload('hotel')
        .preload('roomTypes')
        .preload('createdByUser')
        .preload('updatedByUser')

      // Filter by hotel if provided
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      // Search functionality
      if (search) {
        query.where((builder) => {
          builder
            .whereILike('short_code', `%${search}%`)
            .orWhereILike('rate_type_name', `%${search}%`)
        })
      }

      // Handle soft deletes
      if (!includeDeleted) {
        query.where('is_deleted', false)
      }

      query.orderBy('created_at', 'desc')

      const rateTypes = await query.paginate(page, limit)

      return response.ok({
        message: 'Rate types retrieved successfully',
        data: rateTypes
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve rate types',
        error: error.message
      })
    }
  }

  /**
   * Create a new rate type
   */
  async store({ request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const payload = await request.validateUsing(createRateTypeValidator)
      const userId = auth.user?.id

      // Check for duplicate short code within the same hotel
      const existingRateType = await RateType.query()
        .where('hotel_id', payload.hotelId)
        .where('short_code', payload.shortCode)
        .where('is_deleted', false)
        .first()

      if (existingRateType) {
        await trx.rollback()
        return response.conflict({
          message: 'Rate type with this short code already exists for this hotel'
        })
      }

      const rateType = await RateType.create({
        hotelId: payload.hotelId,
        shortCode: payload.shortCode,
        rateTypeName: payload.rateTypeName,
        isPackage: payload.isPackage || null,
        status: payload.status || 'active',
        createdByUserId: userId!,
        updatedByUserId: userId!
      }, { client: trx })

      // Attach room types if provided
      if (payload.roomTypes && payload.roomTypes.length > 0) {
        await rateType.related('roomTypes').attach(payload.roomTypes, trx)
      }

      await rateType.load('hotel')
      await rateType.load('createdByUser')
      await rateType.load('roomTypes')

      await trx.commit()

      return response.created({
        message: 'Rate type created successfully',
        data: rateType
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to create rate type',
        error: error.message
      })
    }
  }

  /**
   * Show a specific rate type
   */
  async show({ params, response }: HttpContext) {
    try {
      const rateType = await RateType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('roomTypes')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        message: 'Rate type retrieved successfully',
        data: rateType
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Rate type not found' })
      }
      return response.badRequest({
        message: 'Failed to retrieve rate type',
        error: error.message
      })
    }
  }
/***
 * get Rates by hotel id with room rates
 * @param {*} params 
 * @returns 
 */
async getRatesByHotelId({ params, response }: HttpContext) {
  try {
    const rateTypes = await RateType.query()
      .where('hotel_id', params.hotelId)
      .where('is_deleted', false)
      .preload('roomTypes', (roomTypesQuery) => {
        roomTypesQuery.preload('roomRates')
      })
      let res:any =[]
    // Filter room rates to match the rate type after preloading
    for (const rateType of rateTypes) {

      let rate = {
        rateTypeName:rateType.rateTypeName,
        rateTypeId:rateType.id,
        roomTypes: [] as any[]

      }
      for (const roomType of rateType.roomTypes) {
        const rates= roomType.roomRates.filter(rate => rate.rateTypeId === rateType.id)
        let roomT = {
          roomTypeName: roomType.roomTypeName,
          roomTypeId:roomType.id,
          roomRate: (rates && rates.length>0)?rates[0].baseRate:null
        }
        rate.roomTypes.push(roomT)
      }
      res.push(rate)
    }
    return response.ok({
      message: 'Rate types retrieved successfully',
      data: res
    })
  } catch (error) {
    return response.badRequest({
      message: 'Failed to retrieve rate types',
      error: error.message
    })
  }
}




  /**
   * Update a rate type
   */
  async update({ params, request, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const payload = await request.validateUsing(updateRateTypeValidator)
      const userId = auth.user?.id

      const rateType = await RateType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .forUpdate()
        .firstOrFail()

      // Check for duplicate short code if updating short code
      if (payload.shortCode && payload.shortCode !== rateType.shortCode) {
        const existingRateType = await RateType.query()
          .where('hotel_id', payload.hotelId || rateType.hotelId)
          .where('short_code', payload.shortCode)
          .where('is_deleted', false)
          .whereNot('id', params.id)
          .first()

        if (existingRateType) {
          await trx.rollback()
          return response.conflict({
            message: 'Rate type with this short code already exists for this hotel'
          })
        }
      }

      // Update fields
      if (payload.hotelId !== undefined) rateType.hotelId = payload.hotelId
      if (payload.shortCode !== undefined) rateType.shortCode = payload.shortCode
      if (payload.rateTypeName !== undefined) rateType.rateTypeName = payload.rateTypeName
      if (payload.isPackage !== undefined) rateType.isPackage = payload.isPackage
      if (payload.status !== undefined) rateType.status = payload.status

      rateType.updatedByUserId = userId!

      await rateType.save()

      // Update room types if provided
      if (payload.roomTypes !== undefined) {
        await rateType.related('roomTypes').sync(payload.roomTypes || [], trx)
      }

      await rateType.load('hotel')
      await rateType.load('updatedByUser')
      await rateType.load('roomTypes')

      await trx.commit()

      return response.ok({
        message: 'Rate type updated successfully',
        data: rateType
      })
    } catch (error) {
      await trx.rollback()
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Rate type not found' })
      }
      return response.badRequest({
        message: 'Failed to update rate type',
        error: error.message
      })
    }
  }

  /**
   * Soft delete a rate type
   */
  async destroy({ params, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const userId = auth.user?.id

      const rateType = await RateType.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .forUpdate()
        .firstOrFail()

      rateType.isDeleted = true
      rateType.updatedByUserId = userId!

      await rateType.save()
      await trx.commit()

      return response.ok({
        message: 'Rate type deleted successfully'
      })
    } catch (error) {
      await trx.rollback()
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Rate type not found' })
      }
      return response.badRequest({
        message: 'Failed to delete rate type',
        error: error.message
      })
    }
  }

  /**
   * Restore a soft deleted rate type
   */
  async restore({ params, response, auth }: HttpContext) {
    const trx = await Database.transaction()
    try {
      const userId = auth.user?.id

      const rateType = await RateType.query()
        .where('id', params.id)
        .where('is_deleted', true)
        .forUpdate()
        .firstOrFail()

      rateType.isDeleted = false
      rateType.deletedAt = null
      rateType.updatedByUserId = userId!

      await rateType.save()
      await rateType.load('hotel')
      await rateType.load('roomTypes')

      await trx.commit()

      return response.ok({
        message: 'Rate type restored successfully',
        data: rateType
      })
    } catch (error) {
      await trx.rollback()
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Deleted rate type not found' })
      }
      return response.badRequest({
        message: 'Failed to restore rate type',
        error: error.message
      })
    }
  }

  /**
   * Get rate types statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotel_id')

      const query = RateType.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const [total, active, deleted] = await Promise.all([
        query.clone().count('* as total'),
        query.clone().where('is_deleted', false).count('* as total'),
        query.clone().where('is_deleted', true).count('* as total')
      ])

      return response.ok({
        message: 'Rate types statistics retrieved successfully',
        data: {
          total: Number(total[0].$extras.total),
          active: Number(active[0].$extras.total),
          deleted: Number(deleted[0].$extras.total)
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve rate types statistics',
        error: error.message
      })
    }
  }

   /**
     * Get roomtype for a hotel // Récupérer tous les types de chambres pour un hôtel donné
   */
  async showByHotel({ params, response }: HttpContext) {
      try {
        const hotelId = Number(params.id)
        console.log('Fetching room types for hotelId:', hotelId)

        if (isNaN(hotelId)) {
          return response.badRequest({ message: 'Invalid hotelId parameter' })
        }

        const rateTypes = await RateType.query()
          .where('hotel_id', hotelId)
          .andWhere('is_deleted', false)

        return response.ok({
          message: 'Rate types retrieved successfully',
          data: rateTypes
        })
      } catch (error) {
        console.error(error)
        return response.internalServerError({
          message: 'Error retrieving rate types',
          error: error.message
        })
      }
  }

  /**
   * get rate_type by roomtype
   */

public async getByRoomType({ params, response }: HttpContext) {
  try {
    const roomTypeId = Number(params.id)

    // Vérifier que l'ID est valide
    if (isNaN(roomTypeId)) {
      return response.status(400).json({ message: 'Invalid room type ID' })
    }

    // Récupération des RoomRate avec leurs RateType
    const roomRates = await RoomRate.query()
      .where('room_type_id', roomTypeId)
      .preload('rateType')

    const ratesType = roomRates.map((item) => item.rateType)

    // Récupération du RoomType avec ses RateTypes (non supprimés)
    const roomType = await RoomType.query()
      .where('id', roomTypeId)
      .preload('rateTypes', (query) => {
        query.where('is_deleted', false)
      })
      .first()

    if (!roomType) {
      return response.status(404).json({ message: 'Room type not found' })
    }

    // Fusionner et supprimer les doublons par ID
    const mergedRateTypes = [
      ...new Map(
        [...roomType.rateTypes, ...ratesType].map((rt) => [rt.id, rt])
      ).values()
    ]

    return response.json({
      roomType: {
        id: roomType.id,
        rateTypes: mergedRateTypes
      }
    })
  } catch (error) {
    console.error(error)
    return response.status(500).json({ message: 'Error fetching rate types' })
  }
}





}
