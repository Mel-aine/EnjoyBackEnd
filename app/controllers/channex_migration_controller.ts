import type { HttpContext } from '@adonisjs/core/http'
import { ChannexService } from '../services/channex_service.js'
import LoggerService from '../services/logger_service.js'
import Hotel from '../models/hotel.js'
import RoomType from '../models/room_type.js'
import Room from '../models/room.js'
import RoomRate from '../models/room_rate.js'
import Reservation from '../models/reservation.js'
import Guest from '../models/guest.js'
import ReservationRoom from '../models/reservation_room.js'
import logger from '@adonisjs/core/services/logger'
import axios from 'axios'
import { generateGuestCode } from '../utils/generate_guest_code.js'
import ReservationCreationService from '../services/reservation_creation_service.js'
import env from '#start/env'
import { DateTime } from 'luxon'

/**
 * Controller for migrating hotel data to Channex.io system
 */
export default class ChannexMigrationController {
  private channexService: ChannexService

  constructor() {
    // Initialize Channex service (will use environment variables)
    this.channexService = new ChannexService()
  }

  /**
   * Migrate complete hotel data to Channex system
   * POST /api/channex/migrate/:hotelId
   */
  async migrateHotel(ctx: HttpContext) {
    const { params, response, auth } = ctx;
    const { hotelId } = params
    const userId = auth.user?.id

    if (!hotelId) {
      return response.badRequest({ error: 'Hotel ID is required' })
    }

    if (!userId) {
      return response.unauthorized({ error: 'Authentication required' })
    }

    const migrationResults: any = {
      hotelId,
      status: 'started',
      steps: {
        property: { status: 'pending', data: null, error: null },
        hotelPolicy: { status: 'pending', data: null, error: null },
        roomTypes: { status: 'pending', data: [], error: null },
        ratePlans: { status: 'pending', data: [], error: null },
        //rates: { status: 'pending', data: [], error: null },
        //availability: { status: 'pending', data: [], error: null }
      },
      startTime: new Date(),
      endTime: null,
      totalErrors: 0
    }

    // Collect all log entries for bulk logging
    const logEntries: any[] = []

    try {
      console.log('Starting Channex migration', { hotelId })

      // Add migration start log
      logEntries.push({
        actorId: userId,
        action: 'CHANNEX_MIGRATION_START',
        entityType: 'Hotel',
        entityId: hotelId,
        description: `Started Channex migration for hotel ${hotelId}`,
        hotelId: parseInt(hotelId),
        ctx: ctx
      })

      // Step 1: Migrate Hotel Property
      migrationResults.steps.property.status = 'in_progress'
      const propertyResult: any = await this.migrateProperty(hotelId)
      migrationResults.steps.property = propertyResult

      if (propertyResult.error) {
        migrationResults.totalErrors++
        console.error('Property migration failed', { hotelId, error: propertyResult.error })

        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_PROPERTY_MIGRATION_FAILED',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Property migration failed for hotel ${hotelId}: ${propertyResult.error}`,
          meta: { error: propertyResult.error },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      } else {
        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_PROPERTY_MIGRATION_SUCCESS',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Property migration completed successfully for hotel ${hotelId}`,
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      }

      const channexPropertyId = propertyResult.data?.channexPropertyId
      if (!channexPropertyId) {
        throw new Error('Failed to create property in Channex - cannot continue migration')
      }

      // Step 2: Migrate Hotel Policy
      migrationResults.steps.hotelPolicy.status = 'in_progress'
      const hotelPolicyResult = await this.migrateHotelPolicy(hotelId)
      migrationResults.steps.hotelPolicy = hotelPolicyResult

      if (hotelPolicyResult.error) {
        migrationResults.totalErrors++
        console.error('Hotel policy migration failed', { hotelId, error: hotelPolicyResult.error })

        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_HOTELPOLICY_MIGRATION_FAILED',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Hotel policy migration failed for hotel ${hotelId}: ${hotelPolicyResult.error}`,
          meta: { error: hotelPolicyResult.error },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      } else {
        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_HOTELPOLICY_MIGRATION_SUCCESS',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Hotel policy migration completed successfully for hotel ${hotelId}`,
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      }

      // Step 3: Migrate Room Types
      migrationResults.steps.roomTypes.status = 'in_progress'
      const roomTypesResult = await this.migrateRoomTypes(hotelId, channexPropertyId)
      migrationResults.steps.roomTypes = roomTypesResult

      if (roomTypesResult.error) {
        migrationResults.totalErrors++
        console.error('Room types migration failed', { hotelId, error: roomTypesResult.error })

        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_ROOMTYPES_MIGRATION_FAILED',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Room types migration failed for hotel ${hotelId}: ${roomTypesResult.error}`,
          meta: { error: roomTypesResult.error },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
        throw new Error('Failed to create room types in Channex - cannot continue migration')
      } else {
        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_ROOMTYPES_MIGRATION_SUCCESS',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Room types migration completed successfully for hotel ${hotelId}. Migrated ${roomTypesResult.data?.length || 0} room types`,
          meta: { count: roomTypesResult.data?.length || 0 },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      }

      // Step 4: Migrate Rate Plans
      migrationResults.steps.ratePlans.status = 'in_progress'
      const ratePlansResult = await this.migrateRatePlans(hotelId, channexPropertyId, roomTypesResult.data)
      migrationResults.steps.ratePlans = ratePlansResult

      if (ratePlansResult.error) {
        migrationResults.totalErrors++
        console.error('Rate plans migration failed', { hotelId, error: ratePlansResult.error })

        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_RATEPLANS_MIGRATION_FAILED',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Rate plans migration failed for hotel ${hotelId}: ${ratePlansResult.error}`,
          meta: { error: ratePlansResult.error },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      } else {
        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_RATEPLANS_MIGRATION_SUCCESS',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Rate plans migration completed successfully for hotel ${hotelId}. Migrated ${ratePlansResult.data?.length || 0} rate plans`,
          meta: { count: ratePlansResult.data?.length || 0 },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      }

      migrationResults.status = migrationResults.totalErrors > 0 ? 'completed_with_errors' : 'completed'
      migrationResults.endTime = new Date()

      // Add migration completion log
      logEntries.push({
        actorId: userId,
        action: 'CHANNEX_MIGRATION_COMPLETE',
        entityType: 'Hotel',
        entityId: hotelId,
        description: `Completed Channex migration for hotel ${hotelId}. Status: ${migrationResults.status}, Errors: ${migrationResults.totalErrors}`,
        meta: {
          status: migrationResults.status,
          totalErrors: migrationResults.totalErrors,
          duration: migrationResults.endTime.getTime() - migrationResults.startTime.getTime()
        },
        hotelId: parseInt(hotelId),
        ctx: ctx
      })

      // Bulk log all migration activities
      await LoggerService.bulkLog(logEntries)

      console.log('Channex migration completed', {
        hotelId,
        status: migrationResults.status,
        totalErrors: migrationResults.totalErrors,
        duration: migrationResults.endTime.getTime() - migrationResults.startTime.getTime()
      })

      return response.status(200).json({
        success: true,
        message: 'Hotel migration completed',
        data: migrationResults
      })

    } catch (error: any) {
      migrationResults.status = 'failed'
      migrationResults.endTime = new Date()
      migrationResults.totalErrors++

      // Add migration failure log
      logEntries.push({
        actorId: userId,
        action: 'CHANNEX_MIGRATION_FAILED',
        entityType: 'Hotel',
        entityId: hotelId,
        description: `Channex migration failed for hotel ${hotelId}: ${error.message}`,
        meta: {
          error: error.message,
          stack: error.stack,
          totalErrors: migrationResults.totalErrors
        },
        hotelId: parseInt(hotelId),
        ctx: ctx
      })

      // Bulk log all migration activities (including failure)
      await LoggerService.bulkLog(logEntries)

      console.error('Channex migration failed', {
        hotelId,
        error: error.message,
        stack: error.stack
      })

      return response.status(500).json({
        success: false,
        message: 'Hotel migration failed',
        error: error.message,
        data: migrationResults
      })
    }
  }

  /**
   * Migrate hotel property to Channex
   */
  private async migrateProperty(hotelId: string) {
    try {
      // Fetch hotel data from local database
      const hotel = await Hotel.find(hotelId)
      if (!hotel) {
        throw new Error(`Hotel with ID ${hotelId} not found`)
      }

      // Step 1: Create group first
      const groupData = {
        "group": {
          title: `${hotel.hotelName} Group`
        }
      }
      const channexGroup: any = await this.channexService.createGroup(groupData)
      logger.info(JSON.stringify(channexGroup))

      // Step 2: Map hotel data to Channex property format with group_id
      const propertyData = {

        // Optional fields
        title: hotel.hotelName,
        currency: hotel.currencyCode || 'XAF',
        timezone: hotel.timezone || 'UTC',
        country: hotel.country || 'US',
        state: hotel.stateProvince,
        city: hotel.city,
        address: hotel.address,
        zip_code: hotel.postalCode,
        phone: hotel.phoneNumber!,
        email: hotel.email!,
        website: hotel.website,
        property_type: hotel.propertyType || 'hotel',
        group_id: channexGroup.data.id,
        content: {
          description: hotel.description,
          important_information: hotel.hotelPolicy
        },
        longitude: hotel.longitude, // decimal number as string
        latitude: hotel.latitude,// decimal number as string
        facilities: [],// List of facility IDs

        // Hotel policy and operational fields
        check_in_time: hotel.checkInTime,
        check_out_time: hotel.checkOutTime,
        internet_access_type: hotel.internetAccessType,
        internet_access_cost: hotel.internetAccessCost,
        internet_access_coverage: hotel.internetAccessCoverage,
        parking_type: hotel.parkingType,
        parking_reservation: hotel.parkingReservation,
        parking_is_private: hotel.parkingIsPrivate,
        pets_policy: hotel.petsPolicy,
        pets_non_refundable_fee: hotel.petsNonRefundableFee,
        pets_refundable_deposit: hotel.petsRefundableDeposit,
        smoking_policy: hotel.smokingPolicy,
        is_adults_only: hotel.isAdultsOnly,
        max_count_of_guests: hotel.maxCountOfGuests,

        // Settings object
        settings: {
          allow_availability_autoupdate_on_confirmation: true,
          allow_availability_autoupdate_on_modification: true,
          allow_availability_autoupdate_on_cancellation: true,
          min_stay_type: "both", // e.g., "both"
          min_price: hotel.minPrice,
          max_price: hotel.maxPrice,
          state_length: hotel.stateLength,
          cut_off_time: hotel.cutOffTime || "00:00:00", // e.g., "00:00:00"
          cut_off_days: hotel.cutOffDays,
          max_day_advance: hotel.maxDayAdvance,
        },
        logo_url: hotel.logoUrl
      }

      // Step 3: Create property in Channex
      const channexProperty: any = await this.channexService.createProperty(propertyData)
      logger.info(JSON.stringify(channexProperty))

      // Step 4: Store Channex IDs in hotel record
      hotel.channexGroupId = channexGroup.data.id
      hotel.channexPropertyId = channexProperty.data.id
      await hotel.save()

      logger.info('Property migrated successfully', {
        localHotelId: hotelId,
        channexGroupId: channexGroup.data.id,
        channexPropertyId: channexProperty.data.id,
        propertyName: hotel.hotelName
      })

      return {
        status: 'completed',
        data: {
          localHotelId: hotelId,
          channexGroupId: channexGroup.data.id,
          channexPropertyId: channexProperty.data.id,
          propertyName: hotel.hotelName
        },
        error: null
      }

    } catch (error: any) {
      return {
        status: 'failed',
        data: null,
        error: error.message
      }
    }
  }

  /**
   * Migrate hotel policy to Channex
   */
  private async migrateHotelPolicy(hotelId: string) {
    try {
      // Fetch hotel data from local database
      const hotel = await Hotel.find(hotelId)
      if (!hotel) {
        throw new Error(`Hotel with ID ${hotelId} not found`)
      }

      // Map hotel data to Channex hotel policy format
      const hotelPolicyData = {
        "hotel_policy": {
          title: `${hotel.hotelName} Policy`,
          currency: hotel.currencyCode || 'XAF',
          is_adults_only: false,
          max_count_of_guests: 20, // Default value, could be made configurable
          checkin_time: hotel.checkInTime || '14:00',
          checkout_time: hotel.checkOutTime || '12:00',
          internet_access_type: 'wifi',
          internet_access_cost: null,
          internet_access_coverage: 'entire_property',
          parking_type: 'on_site',
          parking_reservation: 'needed',
          parking_is_private: true,
          pets_policy: 'allowed',
          pets_non_refundable_fee: '0.00',
          pets_refundable_deposit: '0.00',
          smoking_policy: 'no_smoking'
        }
      }

      // Create hotel policy in Channex
      const channexHotelPolicy: any = await this.channexService.createHotelPolicy(hotelPolicyData)

      console.log('Hotel policy migrated successfully', {
        localHotelId: hotelId,
        channexHotelPolicyId: channexHotelPolicy.data.id,
        hotelName: hotel.hotelName
      })

      return {
        status: 'completed',
        data: {
          localHotelId: hotelId,
          channexHotelPolicyId: channexHotelPolicy.data.id,
          hotelName: hotel.hotelName
        },
        error: null
      }

    } catch (error: any) {
      return {
        status: 'failed',
        data: null,
        error: error.message
      }
    }
  }

  /**
   * Migrate room types to Channex
   */
  private async migrateRoomTypes(hotelId: string, channexPropertyId: string) {
    try {
      // Fetch room types from local database
      const roomTypes = await RoomType.query().where('hotel_id', hotelId)
      const migratedRoomTypes = []

      for (const roomType of roomTypes) {
        // Count rooms of this type
        const roomCount = await Room.query()
          .where('room_type_id', roomType.id)
          .where('hotel_id', hotelId)
          .count('* as total')

        const roomTypeData = {
          "room_type": {
            property_id: channexPropertyId,
            title: roomType.roomTypeName,
            count_of_rooms: parseInt(roomCount[0].$extras.total) || 1,
            occ_adults: roomType.maxAdult,
            occ_children: roomType.maxChild,
            occ_infants: roomType.maxChild || 0,
            default_occupancy: roomType.baseAdult,
            room_kind: 'room',
            capacity: null,
            facilities: [],
            content: {
              description: `Room amenities: ${roomType.roomAmenities?.join(', ') || 'None'}`
            }
          }
        }
        logger.info("Room type data")
        logger.info(JSON.stringify(roomTypeData))
        const channexRoomType: any = await this.channexService.createRoomType(channexPropertyId, roomTypeData)

        // Save Channex room type ID to local record
        roomType.channexRoomTypeId = channexRoomType.data.id
        await roomType.save()

        migratedRoomTypes.push({
          localId: roomType.id,
          channexPropertyId: channexPropertyId,
          name: roomType.roomTypeName,
          channexData: channexRoomType,
          channexRoomTypeId: channexRoomType.data.id,
        })

        console.log('Room type migrated', {
          localRoomTypeId: roomType.id,
          channexRoomTypeId: channexRoomType.data.id,
          roomTypeName: roomType.roomTypeName
        })
      }

      return {
        status: 'completed',
        data: migratedRoomTypes,
        error: null
      }

    } catch (error: any) {
      return {
        status: 'failed',
        data: [],
        error: error.message
      }
    }
  }

  /**
   * Migrate rate plans to Channex
   */
  private async migrateRatePlans(hotelId: string, channexPropertyId: string, roomTypes: any[]) {
    try {
      // Fetch room rates from local database
      const roomRates = await RoomRate.query()
        .preload('roomType')
        .preload('rateType')
        .whereHas('roomType', (query) => {
          query.where('hotel_id', hotelId)
        })

      const migratedRatePlans = []
      const processedRoomTypes = new Set()

      for (const roomRate of roomRates) {
        // Skip if we already processed this room type
        if (processedRoomTypes.has(roomRate.id)) {
          continue
        }
        processedRoomTypes.add(roomRate.id)

        // Find corresponding Channex room type
        if (!roomRate.roomType.channexRoomTypeId) {
          console.warn('Room type mapping not found for room rate', {
            roomRateId: roomRate.id,
            roomTypeId: roomRate.roomTypeId
          })
          continue
        }

        const ratePlanData = {
          "rate_plan": {
            title: `${roomRate.roomType.roomTypeName} ${roomRate.rateType.rateTypeName}`,
            room_type_id: roomRate.roomType.channexRoomTypeId,
            property_id: channexPropertyId,
            currency: 'XAF',// TODO Change this to de default Cuureny 
            sell_mode: 'per_room',
            rate_mode: 'manual',
            options: [
              {
                occupancy: roomRate.roomType.maxAdult,
                is_primary: true,
                rate: roomRate.baseRate || 100
              }
            ],
            inherit_rate: false,
            inherit_closed_to_arrival: false,
            inherit_closed_to_departure: false,
            inherit_stop_sell: false,
            inherit_min_stay_arrival: false,
            inherit_min_stay_through: false,
            inherit_max_stay: false,
            inherit_max_sell: false,
            inherit_max_availability: false,
            inherit_availability_offset: false,
            auto_rate_settings: null
          }
        }

        const channexRatePlan: any = await this.channexService.createRatePlan(channexPropertyId, ratePlanData)

        // Save Channex rate plan ID to local room rate record
        roomRate.channexRateId = channexRatePlan.data.id
        await roomRate.save()

        migratedRatePlans.push({
          localId: roomRate.id,
          channexId: channexRatePlan.id,
          name: `${roomRate.roomType.roomTypeName}`,
          roomTypeId: roomRate.roomType.channexRoomTypeId,
          channexData: channexRatePlan,
        })

        console.log('Rate plan migrated', {
          localRoomRateId: roomRate.id,
          channexRatePlanId: channexRatePlan.data.id,
          roomTypeName: roomRate.roomType.roomTypeName
        })
      }

      return {
        status: 'completed',
        data: migratedRatePlans,
        error: null
      }

    } catch (error: any) {
      return {
        status: 'failed',
        data: [],
        error: error.message
      }
    }
  }

  /**
   * Get migration status for a hotel
   * GET /api/channex/migration-status/:hotelId
   */
  async getMigrationStatus({ params, response }: HttpContext) {
    const { hotelId } = params

    try {
      // In a real implementation, you'd store migration status in database
      // For now, return a simple response
      return response.status(200).json({
        success: true,
        message: 'Migration status retrieved',
        data: {
          hotelId,
          status: 'not_started',
          message: 'No migration found for this hotel'
        }
      })

    } catch (error: any) {
      console.error('Failed to get migration status', {
        hotelId,
        error: error.message
      })

      return response.status(500).json({
        success: false,
        message: 'Failed to get migration status',
        error: error.message
      })
    }
  }

  /**
   * Generate one-time access token for Channex iframe
   * POST /api/channex/iframe/token
   */
  async generateIframeToken(ctx: HttpContext) {
    const { request, response, auth } = ctx;
    const userId = auth.user?.id
    const username = auth.user?.firstName || auth.user?.email

    if (!userId) {
      return response.unauthorized({
        success: false,
        message: 'Authentication required'
      })
    }

    try {
      const { propertyId, groupId } = request.only(['propertyId', 'groupId'])

      if (!propertyId) {
        return response.badRequest({
          success: false,
          message: 'Property ID is required'
        })
      }

      // Generate one-time token using Channex service
      const tokenData: any = {
        property_id: propertyId,
        username: username
      }

      if (groupId) {
        tokenData.group_id = groupId
      }

      const result: any = await this.channexService.generateOneTimeToken(tokenData)

      // Log the token generation
      await LoggerService.log({
        actorId: userId,
        action: 'CHANNEX_IFRAME_TOKEN_GENERATED',
        entityType: 'channex',
        entityId: propertyId,
        description: `Generated one-time token for Channex iframe access`,
        meta: {
          propertyId,
          groupId,
          username
        },
        ctx: ctx
      })

      return response.ok({
        success: true,
        message: 'One-time token generated successfully',
        data: {
          token: result.data.token,
          expiresIn: '15 minutes'
        }
      })

    } catch (error: any) {
      console.error('Failed to generate iframe token:', error)

      // Log the failure
      await LoggerService.log({
        actorId: userId,
        action: 'CHANNEX_IFRAME_TOKEN_FAILED',
        entityType: 'channex',
        entityId: request.input('propertyId'),
        description: `Failed to generate one-time token for Channex iframe`,
        meta: {
          error: error.message,
          username
        },
        ctx: ctx
      })

      return response.status(500).json({
        success: false,
        message: 'Failed to generate one-time token',
        error: error.message
      })
    }
  }

  /**
   * Generate Channex iframe URL with configuration
   * POST /api/channex/iframe/url
   */
  async generateIframeUrl({ request, response, auth }: HttpContext) {
    const userId = auth.user?.id

    if (!userId) {
      return response.unauthorized({
        success: false,
        message: 'Authentication required'
      })
    }

    try {
      const {
        hotelId,
        channels,
        availableChannels,
        channelsFilter,
        allowNotificationsEdit,
        language,
        allowOpenBookings,
        username,
        page
      } = request.only([
        'hotelId',
        'channels',
        'availableChannels',
        'channelsFilter',
        'allowNotificationsEdit',
        'language',
        'allowOpenBookings',
        'username',
        'page'
      ])

      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required'
        })
      }

      // Generate iframe URL using Channex service (it will fetch hotel data and generate token internally)
      const iframeUrl = await this.channexService.generateIframeUrl(hotelId, {
        channels,
        page,
        availableChannels,
        channelsFilter,
        allowNotificationsEdit,
        language,
        allowOpenBookings,
        username
      })

      return response.ok({
        success: true,
        message: 'Iframe URL generated successfully',
        data: {
          iframeUrl,
          hotelId,
          configuration: {
            channels,
            availableChannels,
            channelsFilter,
            allowNotificationsEdit,
            language,
            allowOpenBookings,
            username
          }
        }
      })

    } catch (error: any) {
      console.error('Failed to generate iframe URL:', error)

      // Log the failure
      /*  await LoggerService.log({
          actorId: userId,
          action: 'CHANNEX_IFRAME_URL_FAILED',
          entityType: 'Hotel',
          entityId: request.input('hotelId'),
          description: `Failed to generate Channex iframe URL for hotel ${request.input('hotelId')}: ${error.message}`,
          meta: {
            error: error.message,
            hotelId: request.input('hotelId')
          },
          hotelId: parseInt(request.input('hotelId') || '0')
        })
  */
      return response.status(500).json({
        success: false,
        message: 'Failed to generate iframe URL',
        error: error.message
      })
    }
  }

  /**
   * Get hotel's Channex property information for iframe setup
   * GET /api/channex/iframe/hotel/:hotelId
   */
  async getHotelChannexInfo({ params, response, auth }: HttpContext) {
    const { hotelId } = params
    const userId = auth.user?.id

    if (!userId) {
      return response.unauthorized({
        success: false,
        message: 'Authentication required'
      })
    }

    try {
      // Get hotel with Channex information
      const hotel = await Hotel.find(hotelId)

      if (!hotel) {
        return response.notFound({
          success: false,
          message: 'Hotel not found'
        })
      }

      // Check if hotel has been migrated to Channex
      if (!hotel.channexPropertyId) {
        return response.badRequest({
          success: false,
          message: 'Hotel has not been migrated to Channex yet. Please migrate the hotel first.',
          data: {
            hotelId: hotel.id,
            hotelName: hotel.hotelName,
            channexPropertyId: null,
            channexGroupId: null,
            migrationRequired: true
          }
        })
      }

      return response.ok({
        success: true,
        message: 'Hotel Channex information retrieved successfully',
        data: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          channexPropertyId: hotel.channexPropertyId,
          channexGroupId: hotel.channexGroupId,
          migrationRequired: false
        }
      })

    } catch (error: any) {
      console.error('Failed to get hotel Channex info:', error)

      return response.status(500).json({
        success: false,
        message: 'Failed to get hotel Channex information',
        error: error.message
      })
    }
  }

  /**
   * Fetch booking revisions from Channex and create reservation records
   */
  async getBookingRevisionsFeed({ response }: HttpContext) {
    try {
      const channexApiUrl = 'https://staging.channex.io/api/v1/booking_revisions/feed'
      const channexApiKey = env.get('CHANNEX_API_KEY')

      if (!channexApiKey) {
        return response.status(400).json({
          success: false,
          message: 'Channex API key not configured'
        })
      }

      // Fetch booking revisions from Channex
      const channexResponse = await this.channexService.getBookingRevisionsFeed()

      const bookingRevisions = channexResponse.data.data

      const processedReservations = []

      for (const revision of bookingRevisions) {
        const revisionData = revision.attributes

        // Find the hotel by property_id
        const hotel = await Hotel.query()
          .where('channex_property_id', revisionData.property_id)
          .first()

        if (!hotel) {
          logger.warn(`Hotel not found for property_id: ${revisionData.property_id}`)
          continue
        }

        // Create or find guest
        const customerData = revisionData.customer
        let guest = await Guest.query()
          .where('phonePrimary', customerData.mail)
          .where('hotel_id', hotel.id)
          .first()

        if (!guest) {
          guest = await Guest.create({
            hotelId: hotel.id,
            firstName: customerData.name,
            lastName: customerData.surname,
            email: customerData.mail,
            phonePrimary: customerData.phone,
            address: customerData.address,
            city: customerData.city,
            postalCode: customerData.zip,
            country: customerData.country,
            language: customerData.language,
            createdBy: 1 // System user
          })
        }

        // Create reservation
        const reservation = await Reservation.create({
          hotelId: hotel.id,
          guestId: guest.id,
          scheduledArrivalDate: DateTime.fromISO(revisionData.arrival_date),
          scheduledDepartureDate: DateTime.fromISO(revisionData.departure_date),
          reservationStatus: 'Pending', // Initially pending as requested
          adults: revisionData.occupancy.adults,
          children: revisionData.occupancy.children,
          bookingSourceId: 1, // Default booking source
          ratePlanId: 1, // Default rate plan
          totalEstimatedRevenue: parseFloat(revisionData.amount),
          totalAmount: parseFloat(revisionData.amount),
          currencyCode: revisionData.currency,
          specialRequests: revisionData.notes,
          reservationNumber: revisionData.unique_id,
          createdAt: DateTime.now(),
          userId: 1, // System user
          reservationType: 'Online',
          status: 'pending',
          createdBy: 1 // System user
        })
        // Create ReservationRoom records for each room in the booking
        if (revisionData.rooms && revisionData.rooms.length > 0) {
          for (const roomData of revisionData.rooms) {
            // Find local room type by channex_room_type_id
            const roomType = await RoomType.query()
              .where('channex_room_type_id', roomData.room_type_id)
              .where('hotel_id', hotel.id)
              .first()

            // Find local room rate by channex_rate_id
            const roomRate = await RoomRate.query()
              .where('channex_rate_id', roomData.rate_plan_id)
              .where('hotel_id', hotel.id)
              .first()

            await ReservationRoom.create({
              reservationId: reservation.id,
              roomRateId: roomRate?.id,
              // roomId: null, // Will be assigned later
              roomTypeId: roomType?.id || 1, // Use mapped room type or default
              guestId: guest.id,
              isOwner: true,
              checkInDate: DateTime.fromISO(revisionData.arrival_date),
              checkOutDate: DateTime.fromISO(revisionData.departure_date),
              nights: DateTime.fromISO(revisionData.departure_date).diff(DateTime.fromISO(revisionData.arrival_date), 'days').days,
              adults: roomData.occupancy?.adults || revisionData.occupancy.adults,
              children: roomData.occupancy?.children || revisionData.occupancy.children,
              infants: roomData.occupancy?.infants || 0,
              roomRate: parseFloat(roomData.rate || revisionData.amount),
              totalRoomCharges: parseFloat(roomData.rate || revisionData.amount),
              roomCharges: parseFloat(roomData.rate || revisionData.amount),
              netAmount: parseFloat(roomData.rate || revisionData.amount),
              status: 'reserved',
              createdBy: 1 // System user
            })
          }
        }

        processedReservations.push({
          reservationId: reservation.id,
          guestId: guest.id,
          channexBookingId: revisionData.booking_id,
          status: 'pending'
        })
      }

      return response.json({
        success: true,
        message: `Successfully processed ${processedReservations.length} booking revisions`,
        data: {
          processed_count: processedReservations.length,
          reservations: processedReservations
        }
      })

    } catch (error: any) {
      logger.error('Error fetching booking revisions:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to fetch booking revisions',
        error: error.message
      })
    }
  }

  /**
 * Liste toutes les réservations d'une propriété
 * GET /api/channex/bookings/:propertyId
 */
  async listBookings({ params, request, response, auth }: HttpContext) {
    const { propertyId } = params
    const userId = auth.user?.id

    if (!userId) {
      return response.unauthorized({ error: 'Authentication required' })
    }

    try {
      // Récupérer les paramètres de pagination et filtres depuis la requête
      const page = request.input('page', 1)
      const perPage = request.input('per_page', 20)
      const arrivalDateFrom = request.input('arrival_date_from')
      const arrivalDateTo = request.input('arrival_date_to')
      const status = request.input('status') // peut être un tableau: ['new', 'modified']Z

      // Construire les paramètres pour l'API Channex
      const params: any = {
        page,
        per_page: perPage
      }

      // Ajouter les filtres si fournis
      if (arrivalDateFrom || arrivalDateTo || status) {
        params.filter = {}

        if (arrivalDateFrom) params.filter.arrival_date_from = arrivalDateFrom
        if (arrivalDateTo) params.filter.arrival_date_to = arrivalDateTo
        if (status) params.filter.status = Array.isArray(status) ? status : [status]
      }

      // Appeler le service Channex
      const bookingsResult = await this.channexService.listBooking()

      // Logger l'action
      await LoggerService.log({
        actorId: userId,
        action: 'CHANNEX_BOOKINGS_LISTED',
        entityType: 'channex',
        entityId: propertyId,
        description: `Retrieved bookings list for property ${propertyId}`,
        meta: {
          page,
          perPage,
          totalResults: bookingsResult.data?.data?.length || 0
        },
        ctx: ctx
      })

      return response.ok({
        success: true,
        message: 'Bookings retrieved successfully',
        data: (bookingsResult as any)?.data
      })

    } catch (error: any) {
      console.error('Failed to list bookings:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve bookings',
        error: error.message
      })
    }
  }

  /**
   * Récupérer les détails d'une réservation spécifique
   * GET /api/channex/bookings/:bookingId/details
   */
  async getBookingDetails({ params, response, auth }: HttpContext) {
    const { bookingId } = params
    const userId = auth.user?.id

    if (!userId) {
      return response.unauthorized({ error: 'Authentication required' })
    }

    try {
      // Appeler le service Channex pour obtenir les détails
      const bookingDetails = await this.channexService.getBookings(bookingId)

      // Logger l'action
      await LoggerService.log({
        actorId: userId,
        action: 'CHANNEX_BOOKING_DETAILS_RETRIEVED',
        entityType: 'channex',
        entityId: bookingId,
        description: `Retrieved details for booking ${bookingId}`,
        ctx: ctx
      })

      return response.ok({
        success: true,
        message: 'Booking details retrieved successfully',
        data: bookingDetails.data
      })

    } catch (error: any) {
      console.error('Failed to get booking details:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to retrieve booking details',
        error: error.message
      })
    }
  }

  /**
   * Synchronise les réservations depuis Channex vers la base de données locale
   * POST /api/channex/sync/bookings/:hotelId
   */
  async syncBookingsFromChannex(ctx: HttpContext) {
    const { params, response, auth } = ctx
    const { hotelId } = params
    const userId = auth.user?.id

    if (!userId) {
      return response.unauthorized({ error: 'Authentication required' })
    }

    if (!hotelId) {
      return response.badRequest({ error: 'Hotel ID is required' })
    }

    const syncResults = {
      hotelId,
      status: 'started',
      totalFetched: 0,
      totalProcessed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      errors: [] as any[],
      startTime: new Date(),
      endTime: null as Date | null
    }

    try {
      // Récupérer l'hôtel
      const hotel = await Hotel.find(hotelId)
      if (!hotel) {
        throw new Error(`Hotel with ID ${hotelId} not found`)
      }

      const channexPropertyId = hotel.channexPropertyId;

      console.log(`🎯 Synchronisation des 3 DERNIÈRES bookings Channex pour property ${channexPropertyId}`)

      // Récupérer tous les bookings
      const bookingsResponse: any = await this.channexService.getBookingRevisionFeedByFilter({
        page: 1,
        limit: 100,  // Récupérer assez pour avoir les 3 dernières
        property_id: channexPropertyId!
      })

      const allBookings = Array.isArray(bookingsResponse) ? bookingsResponse : bookingsResponse.data || []
      syncResults.totalFetched = allBookings.length

      console.log(`📥 ${allBookings.length} bookings récupérés au total`)

      // Filtrer pour notre property
      const ourBookings = allBookings.filter(booking => {
        const propertyId = booking.attributes?.property_id
        return propertyId === channexPropertyId
      })

      console.log(`🎯 ${ourBookings.length} bookings pour notre property`)

      if (ourBookings.length === 0) {
        const allProperties = [...new Set(allBookings.map(b => b.attributes?.property_id).filter(Boolean))]
        return response.ok({
          success: false,
          message: 'Aucun booking trouvé pour cette property',
          debug: {
            totalBookingsFromChannex: allBookings.length,
            ourPropertyId: channexPropertyId,
            allPropertiesFound: allProperties
          }
        })
      }


      // 🎯 MODIFICATION: Traiter uniquement les 3 dernières réservations
      for (const booking of ourBookings) {
        try {
          const bookingData = booking.attributes
          const bookingId = booking.id

          // Vérifier si la réservation existe déjà
          let existingReservation = await Reservation.query()
            .where('reservation_number', bookingData.unique_id)
            .orWhere('channex_booking_id', bookingId)
            .first()

          if (existingReservation) {
            // ============================================
            // CAS 1: MISE À JOUR D'UNE RÉSERVATION EXISTANTE
            // ============================================
            console.log(`🔄 Réservation existante trouvée: ${existingReservation.id}`)

            const customerData = bookingData.customer || {}
            const totalAdults = bookingData.occupancy?.adults || 0
            const totalChildren = bookingData.occupancy?.children || 0
            const totalAmount = parseFloat(bookingData.amount || '0')

            const statusMapping: any = {
              'new': 'confirmed',
              'modified': 'confirmed',
              'cancelled': 'cancelled'
            }
            const reservationStatus = statusMapping[bookingData.status] || 'pending'

            existingReservation.merge({
              arrivedDate: bookingData.arrival_date,
              departDate: bookingData.departure_date,
              status: reservationStatus,
              adults: totalAdults,
              children: totalChildren,
              totalAmount: totalAmount,
              specialRequests: bookingData.notes,
              channexBookingId: bookingId,
              paymentType: bookingData.payment_type,
            })

            await existingReservation.save()
            const acknowledged = await ReservationCreationService.sendAcknowledgeToChannex(
              existingReservation.channexBookingId!, // ← UTILISER LE REVISION_ID ICI
              existingReservation.id,
              userId,
              ctx
            )
            syncResults.totalUpdated++
            logger.info('acknowledged');
            logger.info(acknowledged);

          } else {
            // ============================================
            // CAS 2: CRÉATION D'UNE NOUVELLE RÉSERVATION
            // ============================================
            console.log(`➕ Création d'une nouvelle réservation via ReservationCreationService`)

            const creationResult = await ReservationCreationService.createFromChannex(
              booking,
              parseInt(hotelId),
              userId,
              ctx
            )

            if (creationResult.success) {
              syncResults.totalCreated++
              if (creationResult.folios && creationResult.folios.length > 0) {
                console.log(`   - Folios: ${creationResult.folios.length} créé(s)`)
              }
            } else {
              syncResults.totalErrors++
              syncResults.errors.push({
                bookingId: bookingId,
                uniqueId: bookingData.unique_id,
                error: creationResult.message || creationResult.error,
                validationErrors: creationResult.validationErrors
              })
              console.error(`❌ Échec création réservation:`, creationResult.message || creationResult.error)

              if (creationResult.validationErrors) {
                console.error(`   Erreurs de validation:`, creationResult.validationErrors)
              }
            }
          }

          syncResults.totalProcessed++

        } catch (error: any) {
          syncResults.totalErrors++
          syncResults.errors.push({
            bookingId: booking?.id,
            uniqueId: booking?.attributes?.unique_id,
            error: error?.message,
            stack: error?.stack
          })
          console.error(`❌ Erreur processing booking ${booking?.id}:`, error)
        }
      }

      syncResults.status = syncResults.totalErrors > 0 ? 'completed_with_errors' : 'completed'
      syncResults.endTime = new Date()

      // Log global de la synchronisation
      await LoggerService.log({
        actorId: userId,
        action: 'CHANNEX_LAST_THREE_BOOKINGS_SYNCED',
        entityType: 'Hotel',
        entityId: hotelId,
        description: `Synchronisation des 3 DERNIÈRES réservations Channex terminée: ${syncResults.totalCreated} créées, ${syncResults.totalUpdated} mises à jour, ${syncResults.totalErrors} erreur(s)`,
        meta: {
          totalFetched: syncResults.totalFetched,
          totalProcessed: syncResults.totalProcessed,
          totalCreated: syncResults.totalCreated,
          totalUpdated: syncResults.totalUpdated,
          totalErrors: syncResults.totalErrors,
          errors: syncResults.errors,
          duration: syncResults.endTime.getTime() - syncResults.startTime.getTime(),
        },
        hotelId: parseInt(hotelId),
        ctx: ctx
      })

      return response.ok({
        success: true,
        message: `Synchronisation des 3 DERNIÈRES réservations terminée: ${syncResults.totalCreated} créées, ${syncResults.totalUpdated} mises à jour`,
        data: {
          ...syncResults,
        }
      })

    } catch (error: any) {
      console.error('❌ Sync error:', error)

      await LoggerService.log({
        actorId: userId,
        action: 'CHANNEX_LAST_THREE_BOOKINGS_SYNC_FAILED',
        entityType: 'Hotel',
        entityId: hotelId,
        description: `Échec de la synchronisation des 3 DERNIÈRES réservations Channex: ${error.message}`,
        meta: {
          error: error.message,
          stack: error.stack
        },
        hotelId: parseInt(hotelId),
        ctx: ctx
      })

      return response.status(500).json({
        success: false,
        message: 'Last three bookings synchronization failed',
        error: error.message,
        data: syncResults
      })
    }
  }
}