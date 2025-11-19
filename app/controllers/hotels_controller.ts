import type { HttpContext } from '@adonisjs/core/http'
import Hotel from '#models/hotel'
import User from '#models/user'
import Role from '#models/role'
import ServiceUserAssignment from '#models/service_user_assignment'
import CrudService from '#services/crud_service'
import LoggerService from '#services/logger_service'
import PermissionService from '#services/permission_service'
import db from '@adonisjs/lucid/services/db'
import Database from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import { createHotelValidator, updateHotelValidator } from '#validators/hotel'
import { updateHotelTaxRatesValidator } from '#validators/hotel_tax_rates'
import CurrenciesController from '#controllers/currencies_controller'
import ReservationType from '#models/reservation_type'
import BookingSource from '#models/booking_source'
import IdentityType from '#models/identity_type'
import PaymentMethod from '#models/payment_method'
import TemplateCategory from '#models/template_category'
import EmailTemplate from '#models/email_template'
import EmailAccount from '#models/email_account'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import Discount from '../models/discount.js'
import { DEFAULT_TEMPLATE_CATEGORIES, DEFAULT_EMAIL_TEMPLATES } from '../data/default_email_templates.js'

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
    const trx = await Database.beginGlobalTransaction()

    try {
      logger.info(request.body())

      const payload = await request.validateUsing(createHotelValidator)

      logger.info(payload)
      const hotel = await Hotel.create({
        hotelName: payload.name,
        description: payload.description,
        address: payload.address,
        city: payload.city,
        stateProvince: payload.state,
        country: payload.country,
        postalCode: payload.postalCode,
        email: payload.email,
        website: payload.website,
        totalRooms: payload.totalRooms || 0,
        totalFloors: payload.totalFloors || 0,
        phoneNumber: payload.phone,
        fax: payload.fax,
        grade: payload.starRating,
        longitude: payload.coordinates?.longitude?.toString(),
        latitude: payload.coordinates?.latitude?.toString(),
        socialMedia: payload.socialMedia,
        contactInfo: {
          contactPerson: payload.contactPerson,
          emergencyContact: payload.emergencyContact
        },
        checkInTime: payload.checkInTime,
        checkOutTime: payload.checkOutTime,
        currencyCode: payload.currency || 'USD',
        timezone: payload.timezone || 'UTC',
        taxRate: payload.taxRate || 0,
        //licenseNumber: payload.licenseNumber,
        status: payload.isActive !== false ? 'active' : 'inactive',
        cancellationPolicy: payload.cancellationPolicy,
        hotelPolicy: payload.policies,
        propertyType: 'hotel',
      }, { client: trx })

      let adminUser = null

      // Create default administrator and get the user ID
      try {
        adminUser = await this.createDefaultAdministrator(hotel.id, {
          firstName: payload.adminFirstName,
          lastName: payload.adminLastName,
          email: payload.adminEmail,
          phoneNumber: payload.adminPhoneNumber
        }, trx)
        logger.info('Default administrator created successfully', {
          hotelId: hotel.id,
          adminEmail: payload.adminEmail,
          adminUserId: adminUser.id
        })
      } catch (adminError) {
        trx.rollback()
        logger.error('Failed to create default administrator for hotel', {
          hotelId: hotel.id,
          error: adminError.message
        })
        throw adminError // This will trigger rollback
      }

      // Use admin user ID for other default elements, fallback to auth.user?.id
      const createdByUserId = adminUser?.id || auth.user?.id

      // Create default XAF currency for the new hotel
      try {
        await CurrenciesController.createDefaultCurrency(hotel.id, createdByUserId)
      } catch (currencyError) {
        logger.error('Failed to create default currency for hotel', {
          hotelId: hotel.id,
          error: currencyError.message
        })
        throw currencyError // This will trigger rollback
      }

      // Create default reservation types for the new hotel
      try {
        await this.createDefaultReservationTypes(hotel.id, createdByUserId, trx)
      } catch (reservationTypeError) {
        logger.error('Failed to create default reservation types for hotel', {
          hotelId: hotel.id,
          error: reservationTypeError.message
        })
        throw reservationTypeError // This will trigger rollback
      }

      // Create default booking sources for the new hotel
      try {
        await this.createDefaultBookingSources(hotel.id, createdByUserId, trx)
      } catch (bookingSourceError) {
        logger.error('Failed to create default booking sources for hotel', {
          hotelId: hotel.id,
          error: bookingSourceError.message
        })
        throw bookingSourceError // This will trigger rollback
      }

      // Create default identity types for the new hotel
      try {
        await this.createDefaultIdentityTypes(hotel.id, createdByUserId, trx)
      } catch (identityTypeError) {
        logger.error('Failed to create default identity types for hotel', {
          hotelId: hotel.id,
          error: identityTypeError.message
        })
        throw identityTypeError // This will trigger rollback
      }

      // Create default payment methods for the new hotel
      try {
        await this.createDefaultPaymentMethods(hotel.id, createdByUserId, trx)
      } catch (paymentMethodError) {
        logger.error('Failed to create default payment methods for hotel', {
          hotelId: hotel.id,
          error: paymentMethodError.message
        })
        throw paymentMethodError // This will trigger rollback
      }

      // Create default template categories for the new hotel
      try {
        await this.createDefaultTemplateCategories(hotel.id, createdByUserId, trx)
      } catch (templateCategoryError) {
        logger.error('Failed to create default template categories for hotel', {
          hotelId: hotel.id,
          error: templateCategoryError.message
        })
        throw templateCategoryError // This will trigger rollback
      }

      // Create default email templates for the new hotel
      try {
        await this.createDefaultEmailTemplates(hotel.id, createdByUserId, trx)
      } catch (templateError) {
        logger.error('Failed to create default email templates for hotel', {
          hotelId: hotel.id,
          error: templateError.message
        })
        throw templateError // This will trigger rollback
      }

      // Commit the transaction if everything succeeds
      await trx.commit()

      return response.created({
        message: 'Hotel created successfully',
        data: hotel
      })
    } catch (error) {
      // Rollback the transaction on any error
      await trx.rollback()

      // Handle validation failures with detailed field-level errors
      if (error && (error.code === 'E_VALIDATION_ERROR' || error.code === 'E_VALIDATION_FAILURE')) {
        const details = Array.isArray((error as any).errors)
          ? (error as any).errors.map((e: any) => ({ field: e.field, rule: e.rule, message: e.message }))
          : []

        logger.warn('Hotel validation failed', { errors: (error as any).messages, details })

        return response.badRequest({
          message: 'Validation failed',
          errors: (error as any).messages,
          details
        })
      }

      logger.error('Hotel creation failed, transaction rolled back', {
        error: (error as any).message,
        stack: (error as any).stack
      })

      return response.badRequest({
        message: 'Failed to create hotel',
        error: (error as any).message
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
        .preload('rooms', (roomQuery) => {
          roomQuery.orderBy('sort_key', 'asc')
        })
        .preload('ratePlans')
        .preload('discounts')
        .preload('roomChargesTaxRates')
        .preload('cancellationRevenueTaxRates')
        .preload('noShowRevenueTaxRates')
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
      // Handle validation failures with detailed field-level errors
      if (error && (error.code === 'E_VALIDATION_ERROR' || error.code === 'E_VALIDATION_FAILURE')) {
        const details = Array.isArray((error as any).errors)
          ? (error as any).errors.map((e: any) => ({ field: e.field, rule: e.rule, message: e.message }))
          : []

        return response.badRequest({
          message: 'Validation failed',
          errors: (error as any).messages,
          details
        })
      }

      return response.badRequest({
        message: 'Failed to update hotel',
        error: (error as any).message
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
   * Update hotel tax-rate relations for room charges, cancellation revenue, and no-show revenue
   */
  async updateTaxRates({ params, request, response, auth }: HttpContext) {
    try {
      const hotel = await Hotel.findOrFail(params.id)
      const payload = await request.validateUsing(updateHotelTaxRatesValidator)

      // Room charges tax rates
      if (payload.roomChargesTaxRateIds !== undefined) {
        if (payload.roomChargesTaxRateIds.length > 0) {
          await hotel.related('roomChargesTaxRates').sync(payload.roomChargesTaxRateIds)
        } else {
          await hotel.related('roomChargesTaxRates').detach()
        }
      }

      // Cancellation revenue tax rates
      if (payload.cancellationRevenueTaxRateIds !== undefined) {
        if (payload.cancellationRevenueTaxRateIds.length > 0) {
          await hotel.related('cancellationRevenueTaxRates').sync(payload.cancellationRevenueTaxRateIds)
        } else {
          await hotel.related('cancellationRevenueTaxRates').detach()
        }
      }

      // No-show revenue tax rates
      if (payload.noShowRevenueTaxRateIds !== undefined) {
        if (payload.noShowRevenueTaxRateIds.length > 0) {
          await hotel.related('noShowRevenueTaxRates').sync(payload.noShowRevenueTaxRateIds)
        } else {
          await hotel.related('noShowRevenueTaxRates').detach()
        }
      }

      hotel.lastModifiedBy = auth.user?.id || 0
      await hotel.save()

      await hotel.load('roomChargesTaxRates')
      await hotel.load('cancellationRevenueTaxRates')
      await hotel.load('noShowRevenueTaxRates')

      return response.ok({
        message: 'Hotel tax rates updated successfully',
        data: hotel,
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update hotel tax rates',
        error: (error as any).message,
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
          roomQuery.orderBy('sort_key', 'asc')
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

        // Seed default template categories for this hotel as well
        await this.createDefaultTemplateCategories(newHotel.id, user.id)

        // Seed default email templates for this hotel as well
        await this.createDefaultEmailTemplates(newHotel.id, user.id)
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
        error: error
      })
    }
  }

  /**
   * Create default reservation types for a new hotel
   */
  private async createDefaultReservationTypes(hotelId: number, userId?: number, trx?: any) {
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
      const createData = {
        hotelId,
        name: reservationType.name,
        isHold: reservationType.isHold,
        status: reservationType.status,
        reservationStatus: reservationType.reservationStatus,
        createdByUserId: userId || null,
        updatedByUserId: userId || null,
        isDeleted: false
      }

      if (trx) {
        await ReservationType.create(createData, { client: trx })
      } else {
        await ReservationType.create(createData)
      }
    }
  }

  private async createDefaultBookingSources(hotelId: number, userId?: number, trx?: any) {
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
      const createData = {
        hotelId,
        sourceName: bookingSource.sourceName,
        sourceCode: hotelId + '_' + bookingSource.sourceCode,
        sourceType: bookingSource.sourceType,
        description: bookingSource.description,
        commissionRate: bookingSource.commissionRate,
        isActive: true,
        priority: 1,
        createdBy: userId,
        lastModifiedBy: userId
      }

      if (trx) {
        await BookingSource.create(createData, { client: trx })
      } else {
        await BookingSource.create(createData)
      }
    }
  }

  /**
   * Create default identity types for a new hotel
   */
  private async createDefaultIdentityTypes(hotelId: number, userId?: number, trx?: any) {
    // Delete all existing identity types for this hotel first
    if (trx) {
      await IdentityType.query({ client: trx }).where('hotelId', hotelId).delete()
    } else {
      await IdentityType.query().where('hotelId', hotelId).delete()
    }

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
      const createData = {
        hotelId,
        name: identityType.name,
        shortCode: identityType.shortCode,
        createdBy: userId || null,
        updatedBy: userId || null
      }

      if (trx) {
        await IdentityType.create(createData, { client: trx })
      } else {
        await IdentityType.create(createData)
      }
    }
  }

  /**
   * Create default payment methods for a new hotel
   */
  private async createDefaultPaymentMethods(hotelId: number, userId?: number, trx?: any) {
    const paymentMethods = [
      {
        methodName: 'Master card',
        methodCode: 'MASTERCARD',
        methodType: 'cash',
        shortCode: 'MC',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'Orange Money',
        methodCode: 'ORANGE_MONEY',
        methodType: 'cash',
        shortCode: 'OM',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'Especes',
        methodCode: 'CASH',
        methodType: 'cash',
        shortCode: 'CASH',
        type: 'CASH',
        cardProcessing: false,
        isDefault: true
      },
      {
        methodName: 'VISA card',
        methodCode: 'VISA',
        methodType: 'cash',
        shortCode: 'VISA',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'VIREMENT BANCAIRE',
        methodCode: 'BANK_TRANSFER',
        methodType: 'cash',
        shortCode: 'WIRE',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'MTN Mobile Money',
        methodCode: 'MTN_MOMO',
        methodType: 'cash',
        shortCode: 'MTN',
        type: 'CASH',
        cardProcessing: false
      },
      {
        methodName: 'Chèque',
        methodCode: 'CHECK',
        methodType: 'cash',
        shortCode: 'CHK',
        type: 'CASH',
        cardProcessing: false
      }
    ]

    for (let i = 0; i < paymentMethods.length; i++) {
      const method = paymentMethods[i]
      const defaultPaymentMethod = {
        hotelId: hotelId,
        methodName: method.methodName,
        methodCode: hotelId + '_' + method.methodCode,
        methodType: method.methodType,
        description: `${method.methodName} payment method`,
        isActive: true,
        isDefault: method.isDefault || false,
        shortCode: method.shortCode,
        type: method.type,
        cardProcessing: method.cardProcessing,
        surchargeEnabled: false,
        receiptNoSetting: 'auto_general'
      }
      if (trx) {
        await PaymentMethod.create(defaultPaymentMethod, { client: trx })
      } else {
        await PaymentMethod.create(defaultPaymentMethod)
      }
    }


  }

  /**
   * Create default template categories for a newly created hotel
   */
  private async createDefaultTemplateCategories(hotelId: number, userId?: number, trx?: any) {
    const categories = DEFAULT_TEMPLATE_CATEGORIES

    for (const category of categories) {
      const exists = await TemplateCategory
        .query(trx ? { client: trx } : undefined)
        .where('hotel_id', hotelId)
        .where('category', category)
        .where('is_deleted', false)
        .first()

      if (!exists) {
        await TemplateCategory.create({
          hotelId,
          category,
          createdByUserId: userId ?? null,
          updatedByUserId: userId ?? null,
          isDeleted: false,
          isDeleable: false,
        }, trx ? { client: trx } : undefined)
      }
    }
  }

  /**
   * Create default email templates bound to categories for a newly created hotel
   */
  private async createDefaultEmailTemplates(hotelId: number, userId?: number, trx?: any) {
    const clientOpt = trx ? { client: trx } : undefined

    // Try to attach to hotel's default email account if present
    const defaultAccount = await EmailAccount
      .query(clientOpt)
      .where('hotel_id', hotelId)
      .where('is_default', true)
      .first()

    const defaultTemplates = DEFAULT_EMAIL_TEMPLATES

    for (const tpl of defaultTemplates) {
      const category = await TemplateCategory
        .query(clientOpt)
        .where('hotel_id', hotelId)
        .where('category', tpl.category)
        .where('is_deleted', false)
        .first()

      if (!category) continue

      const exists = await EmailTemplate
        .query(clientOpt)
        .where('hotel_id', hotelId)
        .where('template_name', tpl.name)
        .first()

      if (exists) continue

      await EmailTemplate.create({
        name: tpl.name,
        templateCategoryId: category.id,
        autoSend: tpl.autoSend ,
        attachment: null,
        emailAccountId: defaultAccount?.id ?? null,
        scheduleDate: null,
        subject: tpl.subject,
        messageBody: tpl.bodyHtml,
        hotelId,
        isDeleted: false,
        isDeleable: false,
        createdBy: userId ?? null,
        lastModifiedBy: userId ?? null,
      }, clientOpt)
    }
  }

  /**
   * Create default administrator user for a new hotel
   */
  private async createDefaultAdministrator(hotelId: number, adminData: {
    firstName?: string
    lastName: string
    email: string
    phoneNumber?: string
  }, trx?: any) {
    // Check if user already exists
    const existingUser = await this.userService.findByEmail(adminData.email)

    let user
    if (existingUser) {
      user = existingUser
    } else {
      // Read and parse the contents of the JSON files
      const currentDir = dirname(fileURLToPath(import.meta.url))
      const privilegesFilePath = path.join(currentDir, '../../data/1-priviledger.json')
      const reportsFilePath = path.join(currentDir, '../../data/1-reservation-reports.json')

      const privilegesData = JSON.parse(await fs.readFile(privilegesFilePath, 'utf-8'))
      const reportsData = JSON.parse(await fs.readFile(reportsFilePath, 'utf-8'))

      // Extract IDs from the JSON files
      const permisPrivileges: any = [];
      privilegesData.forEach((ct: any) => {
        permisPrivileges.push(...ct.items.map((e: any) => e.id))
      })
      const permisReports: any = [];
      reportsData.forEach((ct: any) => {
        permisReports.push(...ct.items.map((e: any) => e.id))
      })

      // Query all discounts and extract their IDs
      const discounts = await Discount.query().where('hotel_id', hotelId)
      const permisDiscounts = discounts.map((discount) => discount.id)

      // Create new administrator user with transaction support
      const userCreateOptions: any = {
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        email: adminData.email,
        phoneNumber: adminData.phoneNumber || null,
        password: 'admin123', // Default password - should be changed on first login
        status: 'active',
        createdBy: null,
        lastModifiedBy: null,
        permisPrivileges: JSON.stringify(permisPrivileges),
        permisReports: JSON.stringify(permisReports),
        permisDiscounts: JSON.stringify(permisDiscounts),
      }


      user = await this.userService.create(userCreateOptions)
    }

    // Find or create admin role
    let adminRole = await Role.findBy('roleName', 'admin')
    if (!adminRole) {
      const roleCreateData = {
        roleName: 'admin',
        description: 'Administrator role with full permissions',
        createdBy: user.id,
        lastModifiedBy: user.id,
        hotelId: hotelId,
      }

      if (trx) {
        adminRole = await Role.create(roleCreateData, { client: trx })
      } else {
        adminRole = await Role.create(roleCreateData)
      }
    }

    // Create service user assignment
    const existingAssignment = await ServiceUserAssignment.query()
      .where('user_id', user.id)
      .andWhere('hotel_id', hotelId)
      .first()

    if (!existingAssignment) {
      const assignmentData = {
        user_id: user.id,
        hotel_id: hotelId,
        role_id: adminRole.id,
      }

      if (trx) {
        await ServiceUserAssignment.create(assignmentData, { client: trx })
      } else {
        await ServiceUserAssignment.create(assignmentData)
      }
    }
    user.roleId = adminRole.id
    await user.save();
    return user
  }

  async checkHotelExists({ params, response }: HttpContext) {
  try {
    const hotelId = params.hotelId

    // Validate hotel ID
    if (!hotelId || isNaN(Number(hotelId))) {
      return response.badRequest({
        message: 'Invalid hotel ID',
        exists: false
      })
    }

    // Find hotel and check if it's active
    const hotel = await Hotel.query()
      .where('id', hotelId)
      .where('status', 'active')
      .select(['id', 'hotel_name', 'status', 'hotel_code'])
      .first()

    if (!hotel) {
      return response.notFound({
        message: 'Hotel not found or inactive',
        exists: false
      })
    }

    return response.ok({
      message: 'Hotel exists and is active',
      exists: true,
      data: {
        id: hotel.id,
        name: hotel.hotelName,
        code: hotel.hotelCode,
        status: hotel.status
      }
    })
  } catch (error) {
    logger.error('Error checking hotel existence:', error)
    return response.internalServerError({
      message: 'Failed to check hotel existence',
      exists: false,
      error: error.message
    })
  }
}

}
