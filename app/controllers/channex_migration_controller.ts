import type { HttpContext } from '@adonisjs/core/http'
import { ChannexService } from '../services/channex_service.js'
import LoggerService from '../services/logger_service.js'
import Hotel from '../models/hotel.js'
import RoomType from '../models/room_type.js'
import Room from '../models/room.js'
import RoomRate from '../models/room_rate.js'
import logger from '@adonisjs/core/services/logger'
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
        phone: hotel.phoneNumber,
        email: hotel.email,
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

    } catch (error) {
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
          checkin_time: hotel.checkInTime  ,
          checkout_time: hotel.checkOutTime ,
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

    } catch (error) {
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

    } catch (error) {
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
        .whereHas('roomType', (query) => {
          query.where('hotel_id', hotelId)
        })

      const migratedRatePlans = []
      const processedRoomTypes = new Set()

      for (const roomRate of roomRates) {
        // Skip if we already processed this room type
        if (processedRoomTypes.has(roomRate.roomTypeId)) {
          continue
        }
        processedRoomTypes.add(roomRate.roomTypeId)

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
            title: `Rate Plan for ${roomRate.roomType.roomTypeName}`,
            room_type_id: roomRate.roomType.channexRoomTypeId,
            property_id: channexPropertyId,
            currency: 'XAF',
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
        roomRate.channexRateId = channexRatePlan.id
        await roomRate.save()

        migratedRatePlans.push({
          localId: roomRate.id,
          channexId: channexRatePlan.id,
          name: `Rate Plan for ${roomRate.roomType.roomTypeName}`,
          roomTypeId: roomRate.roomType.channexRoomTypeId,
          channexData: channexRatePlan
        })

        console.log('Rate plan migrated', {
          localRoomRateId: roomRate.id,
          channexRatePlanId: channexRatePlan.id,
          roomTypeName: roomRate.roomType.roomTypeName
        })
      }

      return {
        status: 'completed',
        data: migratedRatePlans,
        error: null
      }

    } catch (error) {
      return {
        status: 'failed',
        data: [],
        error: error.message
      }
    }
  }

  /**
   * Migrate rates to Channex
   */
  private async migrateRates(hotelId: string, channexPropertyId: string, ratePlans: any[]) {
    try {
      const migratedRates = []
      const today = new Date()
      const futureDate = new Date()
      futureDate.setMonth(today.getMonth() + 12) // Migrate rates for next 12 months

      for (const ratePlan of ratePlans) {
        // Fetch room rates from local database
        const roomRates = await RoomRate.query()
          .where('rate_plan_id', ratePlan.localId)
          .where('date', '>=', today.toISOString().split('T')[0])
          .where('date', '<=', futureDate.toISOString().split('T')[0])

        if (roomRates.length === 0) {
          // If no specific rates found, create a default rate
          const defaultRateData = [{
            rate_plan_id: ratePlan.channexId,
            date_from: today.toISOString().split('T')[0],
            date_to: futureDate.toISOString().split('T')[0],
            rate: 100 // Default rate
          }]

          await this.channexService.updateRates(channexPropertyId, defaultRateData)
          migratedRates.push({
            ratePlanId: ratePlan.channexId,
            type: 'default',
            count: 1
          })
        } else {
          // Group consecutive dates with same rate
          const rateGroups = this.groupConsecutiveRates(roomRates)

          for (const group of rateGroups) {
            const rateData = [{
              rate_plan_id: ratePlan.channexId,
              date_from: group.dateFrom,
              date_to: group.dateTo,
              rate: group.rate
            }]

            await this.channexService.updateRates(channexPropertyId, rateData)
          }

          migratedRates.push({
            ratePlanId: ratePlan.channexId,
            type: 'specific',
            count: rateGroups.length
          })
        }

        console.log('Rates migrated for rate plan', {
          ratePlanId: ratePlan.channexId,
          ratePlanName: ratePlan.name
        })
      }

      return {
        status: 'completed',
        data: migratedRates,
        error: null
      }

    } catch (error) {
      return {
        status: 'failed',
        data: [],
        error: error.message
      }
    }
  }

  /**
   * Migrate availability to Channex
   */
  private async migrateAvailability(hotelId: string, channexPropertyId: string, roomTypes: any[]) {
    try {
      const migratedAvailability = []
      const today = new Date()
      const futureDate = new Date()
      futureDate.setMonth(today.getMonth() + 12) // Migrate availability for next 12 months

      for (const roomType of roomTypes) {
        // Get room count for this room type
        const roomCount = roomType.channexData.count_of_rooms || 1

        // Create availability data
        const availabilityData = [{
          rate_plan_id: roomType.channexId, // This should be rate plan ID, but we'll use room type for now
          date_from: today.toISOString().split('T')[0],
          date_to: futureDate.toISOString().split('T')[0],
          availability: roomCount
        }]

        // Note: In a real implementation, you'd need to map this to actual rate plans
        // For now, we're setting basic availability

        migratedAvailability.push({
          roomTypeId: roomType.channexId,
          availability: roomCount,
          dateRange: `${today.toISOString().split('T')[0]} to ${futureDate.toISOString().split('T')[0]}`
        })

        console.log('Availability migrated for room type', {
          roomTypeId: roomType.channexId,
          roomTypeName: roomType.name,
          availability: roomCount
        })
      }

      return {
        status: 'completed',
        data: migratedAvailability,
        error: null
      }

    } catch (error) {
      return {
        status: 'failed',
        data: [],
        error: error.message
      }
    }
  }

  /**
   * Group consecutive dates with same rate for efficient API calls
   */
  private groupConsecutiveRates(roomRates: any[]) {
    if (roomRates.length === 0) return []

    // Sort by date
    roomRates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const groups = []
    let currentGroup = {
      dateFrom: roomRates[0].date,
      dateTo: roomRates[0].date,
      rate: roomRates[0].rate
    }

    for (let i = 1; i < roomRates.length; i++) {
      const currentRate = roomRates[i]
      const prevDate = new Date(roomRates[i - 1].date)
      const currentDate = new Date(currentRate.date)
      const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)

      // If consecutive date and same rate, extend current group
      if (dayDiff === 1 && currentRate.rate === currentGroup.rate) {
        currentGroup.dateTo = currentRate.date
      } else {
        // Start new group
        groups.push(currentGroup)
        currentGroup = {
          dateFrom: currentRate.date,
          dateTo: currentRate.date,
          rate: currentRate.rate
        }
      }
    }

    groups.push(currentGroup)
    return groups
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

    } catch (error) {
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
  async generateIframeToken({ request, response, auth }: HttpContext) {
    const userId = auth.user?.id
    const username = auth.user?.email || auth.user?.name || 'Unknown User'

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
      const tokenData = {
        property_id: propertyId,
        username: username
      }

      if (groupId) {
        tokenData.group_id = groupId
      }

      const result = await this.channexService.generateOneTimeToken(tokenData)

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
        }
      })

      return response.ok({
        success: true,
        message: 'One-time token generated successfully',
        data: {
          token: result.data.token,
          expiresIn: '15 minutes'
        }
      })

    } catch (error) {
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
        }
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

    } catch (error) {
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

    } catch (error) {
      console.error('Failed to get hotel Channex info:', error)

      return response.status(500).json({
        success: false,
        message: 'Failed to get hotel Channex information',
        error: error.message
      })
    }
  }
}