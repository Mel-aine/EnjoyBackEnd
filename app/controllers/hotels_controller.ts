import type { HttpContext } from '@adonisjs/core/http'
import Hotel from '#models/hotel'
import User from '#models/user'
import Role from '#models/role'
import ServiceUserAssignment from '#models/service_user_assignment'
import Permission from '#models/permission'
import RolePermission from '#models/role_permission'
import CrudService from '#services/crud_service'
import LoggerService from '#services/logger_service'
import PermissionService from '#services/permission_service'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { createHotelValidator, updateHotelValidator } from '#validators/hotel'
import CurrenciesController from '#controllers/currencies_controller'
import ReservationType from '#models/reservation_type'
import BookingSource from '#models/booking_source'
import IdentityType from '#models/identity_type'
import PaymentMethod from '#models/payment_method'
import fs from 'fs/promises'
import path from 'path'

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
            .whereILike('hotelName', `%${search}%`)
            .orWhereILike('hotelCode', `%${search}%`)
            .orWhereILike('city', `%${search}%`)
            .orWhereILike('email', `%${search}%`)
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

      // Create default administrator user if admin details are provided
      if (payload.adminFirstName && payload.adminLastName && payload.adminEmail) {
        try {
          await this.createDefaultAdministrator(hotel.id, {
            firstName: payload.adminFirstName,
            lastName: payload.adminLastName,
            email: payload.adminEmail,
            phoneNumber: payload.adminPhoneNumber
          })
          logger.info('Default administrator created successfully', {
            hotelId: hotel.id,
            adminEmail: payload.adminEmail
          })
        } catch (adminError) {
          logger.error('Failed to create default administrator for hotel', {
            hotelId: hotel.id,
            error: adminError.message
          })
        }
      }

      // Create default XAF currency for the new hotel
      try {
        await CurrenciesController.createDefaultCurrency(hotel.id, auth.user?.id)
      } catch (currencyError) {
        // Log the error but don't fail the hotel creation
        logger.error('Failed to create default currency for hotel', {
          hotelId: hotel.id,
          error: currencyError.message
        })
      }

      // Create default reservation types for the new hotel
      try {
        await this.createDefaultReservationTypes(hotel.id, auth.user?.id)
      } catch (reservationTypeError) {
        // Log the error but don't fail the hotel creation
        logger.error('Failed to create default reservation types for hotel', {
          hotelId: hotel.id,
          error: reservationTypeError.message
        })
      }

      // Create default booking sources for the new hotel
      try {
        await this.createDefaultBookingSources(hotel.id, auth.user?.id)
      } catch (bookingSourceError) {
        // Log the error but don't fail the hotel creation
        logger.error('Failed to create default booking sources for hotel', {
          hotelId: hotel.id,
          error: bookingSourceError.message
        })
      }

      // Create default identity types for the new hotel
      try {
        await this.createDefaultIdentityTypes(hotel.id, auth.user?.id)
      } catch (identityTypeError) {
        // Log the error but don't fail the hotel creation
        logger.error('Failed to create default identity types for hotel', {
          hotelId: hotel.id,
          error: identityTypeError.message
        })
      }

      // Create default payment methods for the new hotel
      try {
        await this.createDefaultPaymentMethods(hotel.id, auth.user?.id)
      } catch (paymentMethodError) {
        // Log the error but don't fail the hotel creation
        logger.error('Failed to create default payment methods for hotel', {
          hotelId: hotel.id,
          error: paymentMethodError.message
        })
      }

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
   * Update hotel information with all details
   */
  async updateHotelInformation({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const payload = request.only([
        'hotelName',
        'email',
        'phoneNumber',
        'fax',
        'website',
        'country',
        'address',
        'address2',
        'city',
        'stateProvince',
        'postalCode',
        'propertyType',
        'grade',
        'logoUrl',
        'registrationNo1',
        'registrationNo2',
        'registrationNo3',
        'cancellationPolicy',
        'hotelPolicy'
      ])

      // Create update data with proper typing
      const updateData: any = {
        ...payload,
        lastModifiedBy: auth.user?.id || 0
      }

      hotel.merge(updateData)
      await hotel.save()

      return response.ok({
        message: 'Hotel information updated successfully',
        data: hotel
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel information',
        error: error.message
      })
    }
  }

  /**
   * Update hotel notices
   */
  async updateNotices({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { notices } = request.only(['notices'])

      // Validate that notices is an object
      if (notices && typeof notices !== 'object') {
        return response.badRequest({
          message: 'Notices must be a valid JSON object'
        })
      }
      logger.info(JSON.stringify(notices))
      // Update hotel notices
      hotel.notices = notices
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel notices updated successfully',
        data: {
          id: hotel.id,
          notices: hotel.notices
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel notices',
        error: error.message
      })
    }
  }

  /**
   * Update hotel formula settings
   */
  async updateFormulaSetting({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { formulaSetting } = request.only(['formulaSetting'])

      // Validate that formulaSetting is an object
      if (formulaSetting && typeof formulaSetting !== 'object') {
        return response.badRequest({
          message: 'Formula setting must be a valid JSON object'
        })
      }

      // Update hotel formula setting
      hotel.formulaSetting = formulaSetting
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel formula setting updated successfully',
        data: {
          id: hotel.id,
          formulaSetting: hotel.formulaSetting
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel formula setting',
        error: error.message
      })
    }
  }

  /**
   * Update hotel document numbering settings
   */
  async updateDocumentNumberingSetting({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { documentNumberingSetting } = request.only(['documentNumberingSetting'])

      // Validate that documentNumberingSetting is an object
      if (documentNumberingSetting && typeof documentNumberingSetting !== 'object') {
        return response.badRequest({
          message: 'Document numbering setting must be a valid JSON object'
        })
      }

      // Update hotel document numbering setting
      hotel.documentNumberingSetting = documentNumberingSetting
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel document numbering setting updated successfully',
        data: {
          id: hotel.id,
          documentNumberingSetting: hotel.documentNumberingSetting
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel document numbering setting',
        error: error.message
      })
    }
  }

  /**
   * Update hotel print and email settings
   */
  async updatePrintEmailSettings({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { printEmailSettings } = request.only(['printEmailSettings'])

      // Validate that printEmailSettings is an object
      if (printEmailSettings && typeof printEmailSettings !== 'object') {
        return response.badRequest({
          message: 'Print and email settings must be a valid JSON object'
        })
      }

      // Update hotel print and email settings
      hotel.printEmailSettings = printEmailSettings
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel print and email settings updated successfully',
        data: {
          id: hotel.id,
          printEmailSettings: hotel.printEmailSettings
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel print and email settings',
        error: error.message
      })
    }
  }

  /**
   * Update hotel check-in and reservation settings
   */
  async updateCheckinReservationSettings({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { checkinReservationSettings } = request.only(['checkinReservationSettings'])

      // Validate that checkinReservationSettings is an object
      if (checkinReservationSettings && typeof checkinReservationSettings !== 'object') {
        return response.badRequest({
          message: 'Check-in and reservation settings must be a valid JSON object'
        })
      }

      // Update hotel check-in and reservation settings
      hotel.checkinReservationSettings = checkinReservationSettings
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel check-in and reservation settings updated successfully',
        data: {
          id: hotel.id,
          checkinReservationSettings: hotel.checkinReservationSettings
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel check-in and reservation settings',
        error: error.message
      })
    }
  }

  /**
   * Update hotel display settings
   */
  async updateDisplaySettings({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { displaySettings } = request.only(['displaySettings'])

      // Validate that displaySettings is an object
      if (displaySettings && typeof displaySettings !== 'object') {
        return response.badRequest({
          message: 'Display settings must be a valid JSON object'
        })
      }

      // Update hotel display settings
      hotel.displaySettings = displaySettings
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel display settings updated successfully',
        data: {
          id: hotel.id,
          displaySettings: hotel.displaySettings
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel display settings',
        error: error.message
      })
    }
  }

  /**
   * Update hotel registration settings
   */
  async updateRegistrationSettings({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { registrationSettings } = request.only(['registrationSettings'])

      // Validate that registrationSettings is an object
      if (registrationSettings && typeof registrationSettings !== 'object') {
        return response.badRequest({
          message: 'Registration settings must be a valid JSON object'
        })
      }

      // Update hotel registration settings
      hotel.registrationSettings = registrationSettings
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel registration settings updated successfully',
        data: {
          id: hotel.id,
          registrationSettings: hotel.registrationSettings
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel registration settings',
        error: error.message
      })
    }
  }

  /**
   * Update hotel housekeeping status colors
   */
  async updateHousekeepingStatusColors({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const { housekeepingStatusColors } = request.only(['housekeepingStatusColors'])

      // Validate that housekeepingStatusColors is an object
      if (housekeepingStatusColors && typeof housekeepingStatusColors !== 'object') {
        return response.badRequest({
          message: 'Housekeeping status colors must be a valid JSON object'
        })
      }

      // Update hotel housekeeping status colors
      hotel.housekeepingStatusColors = housekeepingStatusColors
      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      return response.ok({
        message: 'Hotel housekeeping status colors updated successfully',
        data: {
          id: hotel.id,
          housekeepingStatusColors: hotel.housekeepingStatusColors
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel housekeeping status colors',
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
            typeName: room.roomType.roomTypeName,
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
          firstName: data.first_name,
          lastName: data.last_name,
          password: data.password,
          email: data.email,
          phoneNumber: data.phone_number,
          address: data.address || null,
          lastLogin: data.last_login || null,
          twoFactorEnabled: data.two_factor_enabled || null,
          roleId: data.role_id || 2,
          status: 'active',
          createdBy: data.created_by || null,
          lastModifiedBy: data.last_modified_by || null,
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
        first_name: user.firstName,
        last_name: user.lastName,
        email: user.email,
        phone_number: user.phoneNumber,
        lastReservation,
        countReservations,
      }
    })

    return result
  }

  /**
   * Update status colors for a hotel
   */
  async updateStatusColors(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const statusColors = request.input('statusColors')

      // Validate that status_colors is an object if provided
      if (statusColors !== null && statusColors !== undefined && typeof statusColors !== 'object') {
        return response.status(400).json({
          success: false,
          message: 'Status colors must be an object or null'
        })
      }
      hotel.statusColors = statusColors
      await hotel.save()

      // Log the activity
      if (auth.user) {
        await LoggerService.log(
          {
            actorId: auth.user.id,
            action: 'UPDATE',
            entityType: 'Hotel',
            entityId: hotel.id.toString(),
            description: `Hotel status colors updated: ${hotel.hotelName}`,
            ctx: ctx
          }
        )
      }

      return response.json({
        success: true,
        message: 'Hotel status colors updated successfully',
        data: hotel
      })
    } catch (error) {
      logger.error('Error updating hotel status colors:', error)
      return response.status(500).json({
        success: false,
        message: 'Internal server error',
        error:error
      })
    }
  }

  /**
   * Create default reservation types for a new hotel
   */
  private async createDefaultReservationTypes(hotelId: number, userId?: number) {
    const defaultReservationTypes = [
      {
        name: 'Confirmed Booking',
        reservationStatus: 'confirmed' as const,
        isHold: false,
        status: 'active' as const
      },
      {
        name: 'Unconfirmed Booking Inquiry',
        reservationStatus: 'pending' as const,
        isHold: false,
        status: 'active' as const
      },
      {
        name: 'Online Failed Booking',
        reservationStatus: 'confirmed' as const,
        isHold: false,
        status: 'active' as const
      },
      {
        name: 'Hold Confirmed Booking',
        reservationStatus: 'confirmed' as const,
        isHold: true,
        status: 'active' as const
      },
      {
        name: 'Hold Unconfirmed Booking',
        reservationStatus: 'pending' as const,
        isHold: true,
        status: 'active' as const
      }
    ]

    for (const reservationType of defaultReservationTypes) {
      await ReservationType.create({
        hotelId,
        name: reservationType.name,
        isHold: reservationType.isHold,
        status: reservationType.status,
        reservationStatus: reservationType.reservationStatus,
        createdByUserId: userId || null,
        updatedByUserId: userId || null,
        isDeleted: false
      })
    }
  }

  private async createDefaultBookingSources(hotelId: number, userId?: number) {
    const defaultBookingSources = [
      {
        sourceName: 'Directly',
        sourceCode: 'Directly',
        sourceType: 'direct',
        commissionRate: 0,
        description: 'Guests who come to the front desk without a prior reservation'
      },
      {
        sourceName: 'Walk-in',
        sourceCode: 'WALKIN',
        sourceType: 'walk_in',
        commissionRate: 0,
        description: 'Guests who come to the front desk without a prior reservation'
      },
      {
        sourceName: 'Website',
        sourceCode: 'WEBSITE',
        sourceType: 'website',
        commissionRate: 0,
        description: 'Direct bookings made through the hotel\'s own website booking engine'
      },
      {
        sourceName: 'Telephone/Call Center',
        sourceCode: 'PHONE',
        sourceType: 'phone',
        commissionRate: 0,
        description: 'Reservations made over the phone'
      }
    ]

    for (const bookingSource of defaultBookingSources) {
      await BookingSource.create({
        hotelId,
        sourceName: bookingSource.sourceName,
        sourceCode: bookingSource.sourceCode,
        sourceType: bookingSource.sourceType,
        description: bookingSource.description,
        commissionRate: bookingSource.commissionRate,
        isActive: true,
        priority: 1,
        createdBy: userId || null,
        lastModifiedBy: userId || null
      })
    }
  }

  /**
   * Create default identity types for a new hotel
   */
  private async createDefaultIdentityTypes(hotelId: number, userId?: number) {
    // Delete all existing identity types for this hotel first
    await IdentityType.query().where('hotelId', hotelId).delete()

    const defaultIdentityTypes = [
        {
          name: 'Passport',
          shortCode: 'PASS'
        },
        {
          name: 'National ID Card',
          shortCode: 'NAT_ID'
        }
      ]

    for (const identityType of defaultIdentityTypes) {
      await IdentityType.create({
        hotelId,
        name: identityType.name,
        shortCode: identityType.shortCode,
        createdBy: userId || null,
        updatedBy: userId || null
      })
    }
  }

  /**
   * Create default payment methods for a new hotel
   */
  private async createDefaultPaymentMethods(hotelId: number, userId?: number) {
    const defaultPaymentMethod = {
      hotelId,
      methodName: 'Cash',
      methodCode: 'CASH',
      methodType: 'cash' as const,
      description: 'Cash payment method',
      isActive: true,
      isDefault: true,
      acceptsPartialPayments: true,
      requiresAuthorization: false,
      requiresSignature: false,
      requiresId: false,
      minimumAmount: 0,
      maximumAmount: 999999999,
      dailyLimit: 999999999,
      monthlyLimit: 999999999,
      processingFee: 0,
      processingFeeType: 'fixed' as const,
      merchantFee: 0,
      merchantFeeType: 'fixed' as const,
      settlementTime: 0,
      settlementTimeUnit: 'minutes' as const,
      currenciesAccepted: {},
      exchangeRateMarkup: 0,
      paymentProcessor: '',
      processorConfig: {},
      merchantId: '',
      terminalId: '',
      shortCode: 'CASH',
      type: 'CASH' as const,
      cardProcessing: false,
      surchargeEnabled: false,
      surchargeType: null,
      surchargeValue: null,
      extraChargeId: null,
      receiptNoSetting: 'auto_general' as const,
      createdBy: userId || 0,
      lastModifiedBy: userId || 0,
      sortOrder: 1,
      displayName: 'Cash',
      icon: 'cash',
      color: '#28a745',
      isVisible: true,
      isAvailableOnline: false,
      isAvailableAtProperty: true,
      isAvailableMobile: false,
      departmentRestrictions: {},
      userRoleRestrictions: {},
      timeRestrictions: {},
      locationRestrictions: {},
      notes: 'Default cash payment method'
    }

    await PaymentMethod.create(defaultPaymentMethod)
  }

  /**
   * Create default administrator user for a new hotel
   */
  private async createDefaultAdministrator(hotelId: number, adminData: {
    firstName: string
    lastName: string
    email: string
    phoneNumber?: string
  }) {
    // Check if user already exists
    const existingUser = await this.userService.findByEmail(adminData.email)
    
    let user
    if (existingUser) {
      user = existingUser
    } else {
      // Create new administrator user
      user = await this.userService.create({
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        email: adminData.email,
        phoneNumber: adminData.phoneNumber || null,
        password: 'admin123', // Default password - should be changed on first login
        roleId: 2, // Admin role ID
        status: 'active',
        createdBy: null,
        lastModifiedBy: null,
      })
    }

    // Find or create admin role
    let adminRole = await Role.findBy('roleName', 'admin')
    if (!adminRole) {
      adminRole = await Role.create({
        roleName: 'admin',
        description: 'Administrator role with full permissions',
        createdBy: user.id,
        lastModifiedBy: user.id,
      })
    }

    // Create service user assignment
    const existingAssignment = await ServiceUserAssignment.query()
      .where('user_id', user.id)
      .andWhere('hotel_id', hotelId)
      .first()

    if (!existingAssignment) {
      await ServiceUserAssignment.create({
        user_id: user.id,
        hotel_id: hotelId,
        role_id: adminRole.id,
      })
    }

    // Load permissions from JSON files and assign to admin
    await this.loadPermissionsFromJsonFiles()

    return user
  }

  /**
   * Load permissions from JSON files in the data directory
   */
  private async loadPermissionsFromJsonFiles() {
    try {
      const dataDir = path.join(process.cwd(), 'data')
      const files = await fs.readdir(dataDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      for (const file of jsonFiles) {
        const filePath = path.join(dataDir, file)
        const fileContent = await fs.readFile(filePath, 'utf-8')
        const permissionData = JSON.parse(fileContent)

        // Process each category in the JSON file
        for (const [categoryName, permissions] of Object.entries(permissionData)) {
          if (Array.isArray(permissions)) {
            for (const permission of permissions) {
              // Check if permission already exists
              const existingPermission = await Permission.findBy('name', permission.id)
              
              if (!existingPermission) {
                await Permission.create({
                  name: permission.id,
                  label: permission.name,
                  description: `${categoryName} - ${permission.name}`,
                })
              }
            }
          }
        }
      }

      logger.info('Successfully loaded permissions from JSON files')
    } catch (error) {
      logger.error('Failed to load permissions from JSON files', {
        error: error.message
      })
    }
  }


}