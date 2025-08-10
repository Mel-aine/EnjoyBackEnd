import type { HttpContext } from '@adonisjs/core/http'
import Hotel from '#models/hotel'
import User from '#models/user'
import CrudService from '#services/crud_service'
import LoggerService from '#services/logger_service'
import PermissionService from '#services/permission_service'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { createHotelValidator, updateHotelValidator } from '#validators/hotel'

export default class HotelsController {
  private userService: CrudService<typeof User>
  private hotelService: CrudService<typeof Hotel>

  constructor() {
    this.userService = new CrudService(User)
    this.hotelService = new CrudService(Hotel)
  }
  /**
   * Display a list of hotels
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const status = request.input('status')
      const country = request.input('country')
      const city = request.input('city')

      const query = Hotel.query()

      if (search) {
        query.where((builder) => {
          builder
            .where('hotel_name', 'ILIKE', `%${search}%`)
            .orWhere('hotel_code', 'ILIKE', `%${search}%`)
            .orWhere('city', 'ILIKE', `%${search}%`)
            .orWhere('email', 'ILIKE', `%${search}%`)
        })
      }

      if (status) {
        query.where('status', status)
      }

      if (country) {
        query.where('country', country)
      }

      if (city) {
        query.where('city', 'ILIKE', `%${city}%`)
      }

      const hotels = await query
        .orderBy('created_at', 'desc')
        .paginate(page, limit)

      return response.ok({
        message: 'Hotels retrieved successfully',
        data: hotels
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve hotels',
        error: error.message
      })
    }
  }

  /**
   * Create a new hotel
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createHotelValidator)
      
      // Create hotel data with proper typing
      const hotelData: any = {
        ...payload,
        createdBy: auth.user?.id || 0
      }

      const hotel = await Hotel.create(hotelData)

      return response.created({
        message: 'Hotel created successfully',
        data: hotel
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create hotel',
        error: error.message
      })
    }
  }

  /**
   * Show a specific hotel
   */
  async show({ params, response }: HttpContext) {
    try {
      const hotel = await Hotel.query()
        .where('id', params.id)
        .preload('roomTypes')
        .preload('rooms')
        .preload('ratePlans')
        .preload('discounts')
        .preload('inventories')
        .firstOrFail()

      return response.ok({
        message: 'Hotel retrieved successfully',
        data: hotel
      })
    } catch (error) {
      return response.notFound({
        message: 'Hotel not found',
        error: error.message
      })
    }
  }

  /**
   * Update a hotel
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const payload = await request.validateUsing(updateHotelValidator)

      // Create update data with proper typing
      const updateData: any = {
        ...payload,
        lastModifiedBy: auth.user?.id || 0
      }

      hotel.merge(updateData)

      await hotel.save()

      return response.ok({
        message: 'Hotel updated successfully',
        data: hotel
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel',
        error: error.message
      })
    }
  }

  /**
   * Delete a hotel
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      await hotel.delete()

      return response.ok({
        message: 'Hotel deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete hotel',
        error: error.message
      })
    }
  }

  /**
   * Get hotel statistics
   */
  async stats({ params, response }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      
      const roomTypes = await hotel.related('roomTypes').query().count('* as total')
      const rooms = await hotel.related('rooms').query().count('* as total')
      const activeRooms = await hotel.related('rooms').query().where('status', 'available').count('* as total')
      const ratePlans = await hotel.related('ratePlans').query().where('is_active', true).count('* as total')
      const discounts = await hotel.related('discounts').query().where('is_active', true).count('* as total')
      const inventoryItems = await hotel.related('inventories').query().where('is_active', true).count('* as total')
      const lowStockItems = await hotel.related('inventories').query()
        .whereRaw('current_stock <= reorder_point')
        .count('* as total')

      const stats = {
        totalRoomTypes: roomTypes[0].$extras.total,
        totalRooms: rooms[0].$extras.total,
        availableRooms: activeRooms[0].$extras.total,
        activeRatePlans: ratePlans[0].$extras.total,
        activeDiscounts: discounts[0].$extras.total,
        totalInventoryItems: inventoryItems[0].$extras.total,
        lowStockItems: lowStockItems[0].$extras.total,
        occupancyRate: hotel.totalRooms > 0 ? 
          ((hotel.totalRooms - activeRooms[0].$extras.total) / hotel.totalRooms * 100).toFixed(2) : 0
      }

      return response.ok({
        message: 'Hotel statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve hotel statistics',
        error: error.message
      })
    }
  }

  /**
   * Toggle hotel status
   */
  async toggleStatus({ params, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      
      hotel.status = hotel.status === 'active' ? 'inactive' : 'active'
      hotel.lastModifiedBy = auth.user?.id || 0
      
      await hotel.save()

      return response.ok({
        message: `Hotel ${hotel.status === 'active' ? 'activated' : 'deactivated'} successfully`,
        data: hotel
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to toggle hotel status',
        error: error.message
      })
    }
  }

  //recuperer les hotels avec leurs services product et option
  public async getHotelsWithProductsAndOptions({ request, params, response }: HttpContext) {
    try {
      const categoryId = params.categoryId || request.qs().categoryId
      const hotelId = request.qs().hotelId

      const query = Hotel.query()
        .preload('rooms', (roomQuery: any) => {
          roomQuery.preload('roomType', (typeQuery: any) => {
            typeQuery.select(['id', 'type_name'])
          })
        })

      if (categoryId) {
        const categoryIdNum = parseInt(categoryId, 10)
        if (isNaN(categoryIdNum)) {
          return response.badRequest({ message: 'Invalid categoryId' })
        }
        // Filter hotels by category if needed
      }

      if (hotelId) {
        query.where('id', hotelId)
      }

      const hotels = await query

      if (!hotels || hotels.length === 0) {
        return response.notFound({ message: 'Aucun hôtel trouvé' })
      }

      const formatted = hotels.map(hotel => ({
        ...hotel.serialize(),
        rooms: hotel.rooms.map(room => ({
          ...room.serialize(),
          roomType: room.roomType ? {
            id: room.roomType.id,
            typeName: room.roomType.typeName,
          } : null,
        }))
      }))

      return response.ok(formatted)

    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la récupération des hôtels',
        error: error.message,
      })
    }
  }

  public async createWithUserAndHotel(ctx: HttpContext) {
    const { request, response } = ctx
    const data = request.body()

    logger.info('Body' + JSON.stringify(data))
    const trx = await db.transaction()
    try {

      const existingUser = await this.userService.findByEmail(data.email);

      let user
      if (existingUser) {
        user = existingUser
      } else {
        user = await this.userService.create({
          first_name: data.first_name,
          last_name: data.last_name,
          password: data.password,
          email: data.email,
          phone_number: data.phone_number,
          address: data.address || null,
          last_login: data.last_login || null,
          two_factor_enabled: data.two_factor_enabled || null,
          role_id: data.role_id || 2,
          status: 'active',
          created_by: data.created_by || null,
          last_modified_by: data.last_modified_by || null,
        })
        
        await LoggerService.log({
          actorId: user.id,
          action: 'CREATE',
          entityType: 'User',
          entityId: user.id.toString(),
          description: `Nouvel utilisateur créé avec l'email ${user.email}`,
          ctx: ctx,
        })
      }

      let newHotel

      if (data.id && !isNaN(Number(data.id))) {
        const existingHotel = await Hotel.findBy('id', Number(data.id))

        if (existingHotel) {
          newHotel = existingHotel
          newHotel.merge({
            hotelName: data.hotel_name,
            hotelCode: data.hotel_code,
            description: data.description,
            email: data.email,
            website: data.website,
            address: data.address,
            city: data.city,
            country: data.country,
            postalCode: data.postal_code,
            phoneNumber: data.phone_number,
            totalRooms: data.total_rooms,
            totalFloors: data.total_floors,
            currencyCode: data.currency,
            timezone: data.timezone,
            taxRate: data.vat_rate,
            lastModifiedBy: user.id,
          })
          await newHotel.save()
        }
      }

      if (!newHotel) {
        // Création d'un nouveau hôtel
        newHotel = await this.hotelService.create({
          hotelName: data.hotel_name,
          hotelCode: data.hotel_code,
          description: data.description,
          email: data.email,
          website: data.website,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          postalCode: data.postal_code,
          phoneNumber: data.phone_number,
          faxNumber: data.fax_number,
          totalRooms: data.total_rooms,
          totalFloors: data.total_floors,
          checkInTime: data.check_in_time,
          checkOutTime: data.check_out_time,
          currency: data.currency,
          timezone: data.timezone,
          vatRate: data.vat_rate,
          serviceTaxRate: data.service_tax_rate,
          status: data.status || 'active',
          createdBy: user.id,
          lastModifiedBy: data.last_modified_by || null,
        })

        const permissionService = new PermissionService()
        await permissionService.assignAllPermissionsToAdminForService(newHotel.id, user.id)
      }

      await LoggerService.log({
        actorId: user.id,
        action: 'CREATE',
        entityType: 'Hotel',
        entityId: newHotel.id.toString(),
        description: `Hôtel #${newHotel.id} créé par l'utilisateur ${user.email}`,
        ctx: ctx,
      })

      return response.created({ hotel: newHotel, user })
    } catch (error) {
      trx.rollback()
      return response.status(500).send({
        message: 'Error while creating hotel and/or user',
        error: error.message,
      })
    }
  }

  /**
    * Find all hotels where the name contains the given text (case-insensitive).
    * Query param: ?q=searchText
    */
  public async searchByName({ request, response }: HttpContext) {
    const searchText = request.input('q') || request.qs().q

    if (!searchText || typeof searchText !== 'string') {
      return response.badRequest({ message: 'Search text (q) is required' })
    }

    try {
      const hotels = await Hotel
        .query()
        .whereILike('hotel_name', `%${searchText}%`)

      return response.ok(hotels)
    } catch (error) {
      return response.internalServerError({
        message: 'Erreur lors de la recherche des hôtels',
        error: error.message,
      })
    }
  }

  /*Customers*/
  public async customers({ params }: HttpContext) {
    const hotelId = params.hotelId

    const customers = await User.query().where('role_id', 4)
      .andWhere('created_by', hotelId)
      .preload('reservations', (reservationQuery) => {
        reservationQuery
          .whereHas('reservationRooms', (roomQuery) => {
            roomQuery.whereHas('room', (roomDetailQuery) => {
              roomDetailQuery.where('hotel_id', hotelId)
            })
          })
          .orderBy('createdAt', 'desc')
      })
      
    const result = customers.map(user => {
      const reservations = user.reservations
      const lastReservation = reservations[0] ?? null
      const countReservations = reservations.length

      return {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number,
        lastReservation,
        countReservations,
      }
    })

    return result
  }
}