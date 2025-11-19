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
import FolioTransaction from '../models/folio_transaction.js'
import TaxRate from '../models/tax_rate.js'
import logger from '@adonisjs/core/services/logger'
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
        taxes: { status: 'pending', data: [], error: null },
        roomTypes: { status: 'pending', data: [], error: null },
        ratePlans: { status: 'pending', data: [], error: null },
        taxSets: { status: 'pending', data: [], error: null },
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

      // Step 3: Migrate Taxes
      migrationResults.steps.taxes.status = 'in_progress'
      const taxesResult = await this.migrateTaxes(hotelId, channexPropertyId)
      migrationResults.steps.taxes = taxesResult

      if (taxesResult.error) {
        migrationResults.totalErrors++
        console.error('Taxes migration failed', { hotelId, error: taxesResult.error })

        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_TAXES_MIGRATION_FAILED',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Taxes migration failed for hotel ${hotelId}: ${taxesResult.error}`,
          meta: { error: taxesResult.error },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      } else {
        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_TAXES_MIGRATION_SUCCESS',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Taxes migration completed successfully for hotel ${hotelId}. Migrated ${taxesResult.data?.length || 0} taxes`,
          meta: { count: taxesResult.data?.length || 0 },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      }

      // Step 4: Migrate Room Types
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

      // Step 5: Migrate Tax Set (room charges)
      migrationResults.steps.taxSets = migrationResults.steps.taxSets || { status: 'pending', data: [], error: null }
      migrationResults.steps.taxSets.status = 'in_progress'
      const taxSetResult = await this.migrateTaxSet(hotelId, channexPropertyId)
      migrationResults.steps.taxSets = taxSetResult

      if (taxSetResult.error) {
        migrationResults.totalErrors++
        console.error('Tax set migration failed', { hotelId, error: taxSetResult.error })

        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_TAXSET_MIGRATION_FAILED',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Tax set migration failed for hotel ${hotelId}: ${taxSetResult.error}`,
          meta: { error: taxSetResult.error },
          hotelId: parseInt(hotelId),
          ctx: ctx
        })
      } else {
        logEntries.push({
          actorId: userId,
          action: 'CHANNEX_TAXSET_MIGRATION_SUCCESS',
          entityType: 'Hotel',
          entityId: hotelId,
          description: `Tax set migration completed successfully for hotel ${hotelId}`,
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
   * Migrate taxes to Channex
   */
  private async migrateTaxes(hotelId: string, channexPropertyId: string) {
    try {
      const hotel = await Hotel.findOrFail(hotelId)

      // Fetch tax rates for the hotel
      const taxRates = await TaxRate.query()
        .where('hotel_id', Number(hotelId))
        .andWhere('is_active', true)

      const migratedTaxes: any[] = []

      for (const tax of taxRates) {
        // Map local tax type to Channex type
        const chxType: 'tax' | 'fee' | 'city tax' =
          tax.type === 'service_fee' ? 'fee' : tax.type === 'city_tax' ? 'city tax' : 'tax'

        // Determine logic and rate
        let logic: 'percent' | 'per_booking' | 'per_room' | 'per_room_per_night' | 'per_person' | 'per_person_per_night' | 'per_night' = 'per_booking'
        let rate: string = '0.00'
        let currency: string | null = null

        if (tax.postingType === 'flat_percentage' && tax.percentage !== null) {
          logic = 'percent'
          rate = (+tax.percentage).toFixed(2)
        } else if (tax.postingType === 'flat_amount' && tax.amount !== null) {
          logic = 'per_room_per_night' // Default to per_booking for fixed amount
          rate = (+tax.amount).toFixed(2)
          currency = hotel.currencyCode
        } else {
          // Unsupported or missing payload (e.g., slab) — skip with note
          migratedTaxes.push({
            localId: tax.taxRateId,
            status: 'skipped',
            reason: `Unsupported posting type: ${tax.postingType}`
          })
          continue
        }

        // Applicable date ranges
        const ranges: { after: string, before: string }[] = []
        if (tax.effectiveDate && tax.endDate) {
          ranges.push({
            after: tax.effectiveDate.toISODate()!,
            before: tax.endDate.toISODate()!
          })
        }

        const payload: any = {
          title: tax.taxName || tax.shortName || 'Tax',
          logic,
          type: chxType,
          rate,
          is_inclusive: true, // default; adjust if system provides a flag later
          property_id: channexPropertyId,
        }

        // Include currency only for fixed-amount taxes
        if (logic !== 'percent' && currency) {
          payload.currency = currency
        }

        // Include optional fields only if present
        if (typeof (tax as any).skipNights === 'number') {
          payload.skip_nights = (tax as any).skipNights
        }
        if (typeof tax.exemptAfter === 'number') {
          payload.max_nights = tax.exemptAfter
        }
        if (ranges.length > 0) {
          payload.applicable_date_ranges = ranges
        }

        const resp: any = await this.channexService.createTax(payload)
        console.log(resp)
        // Save Channex tax id
        tax.channexTaxId = resp?.data?.id || resp?.data?.attributes?.id || resp?.id || null
        await tax.save()

        migratedTaxes.push({
          localId: tax.taxRateId,
          channexTaxId: tax.channexTaxId,
          title: payload.title,
          logic: payload.logic,
          type: payload.type,
          rate: payload.rate,
          currency: payload.currency,
          channexData: resp
        })
      }

      return {
        status: 'completed',
        data: migratedTaxes,
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
   * Migrate Tax Set for hotel room charges taxes
   * Uses hotel's roomChargesTaxRates and associated Channex rate plans.
   */
  private async migrateTaxSet(hotelId: string, channexPropertyId: string) {
    try {
      const hotel = await Hotel.findOrFail(hotelId)
      await hotel.load('roomChargesTaxRates')

      // Collect taxes from hotel's room charges tax rates that have been migrated to Channex
      const taxes = (hotel.roomChargesTaxRates || [])
        .filter((t) => Boolean(t.isActive) && Boolean(t.channexTaxId))
        .map((t) => ({ id: t.channexTaxId as string, level: 0 }))

      // Collect associated rate plan ids for this hotel's room rates
      const roomRates = await RoomRate.query()
        .preload('roomType')
        .whereHas('roomType', (q) => q.where('hotel_id', Number(hotelId)))

      const associatedRatePlanIds = roomRates
        .map((rr) => rr.channexRateId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      if (taxes.length === 0) {
        return {
          status: 'skipped',
          data: [],
          error: 'No eligible taxes with channexTaxId in roomChargesTaxRates',
        }
      }

      if (associatedRatePlanIds.length === 0) {
        return {
          status: 'skipped',
          data: [],
          error: 'No associated rate plans found for hotel',
        }
      }

      const payload = {
        title: `Room Charges Tax Set - ${hotel.hotelName || 'Hotel '}`,
        property_id: channexPropertyId,
        associated_rate_plan_ids: associatedRatePlanIds,
        taxes,
        currency: hotel.currencyCode || undefined,
      }

      const resp: any = await this.channexService.createTaxSet(payload)

      return {
        status: 'completed',
        data: [{
          title: payload.title,
          channexTaxSetId: resp?.data?.id || resp?.id || null,
          taxesCount: taxes.length,
          associatedRatePlanCount: associatedRatePlanIds.length,
          channexData: resp,
        }],
        error: null,
      }
    } catch (error: any) {
      return {
        status: 'failed',
        data: [],
        error: error.message,
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

      // Récupérer tous les bookings
      const bookingsResponse: any = await this.channexService.getBookingRevisionFeedByFilter({
        page: 1,
        limit: 100,  // Récupérer assez pour avoir les 3 dernières
        property_id: channexPropertyId!
      })

      const allBookings = Array.isArray(bookingsResponse) ? bookingsResponse : bookingsResponse.data || []
      syncResults.totalFetched = allBookings.length

      // Filtrer pour notre property
      const ourBookings = allBookings.filter((booking:any) => {
        const propertyId = booking.attributes?.property_id
        return propertyId === channexPropertyId
      })

      if (ourBookings.length === 0) {
        const allProperties = [...new Set(allBookings.map((b:any) => b.attributes?.property_id).filter(Boolean))]
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
      // === Preload existing reservations by unique_id and channex_booking_id to avoid per-item queries ===
      const uniqueIds: string[] = ourBookings
        .map((b: any) => b?.attributes?.unique_id)
        .filter((v: any) => !!v)

      const channexIds: string[] = ourBookings
        .map((b: any) => b?.id)
        .filter((v: any) => !!v)

      const existingReservations = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereIn('reservation_number', uniqueIds)
        .whereIn('channex_booking_id', channexIds)

      const existingByUniqueId = new Map<string, Reservation>()
      const existingByChannexId = new Map<string, Reservation>()
      for (const r of existingReservations) {
        if (r.reservationNumber) existingByUniqueId.set(r.reservationNumber, r)
        if (r.channexBookingId) existingByChannexId.set(r.channexBookingId, r)
      }

      // === Preload room types and room rates once (mapping per channex ids) ===
      const roomTypes = await RoomType.query()
        .where('hotel_id', hotelId)
        .select('id', 'channex_room_type_id')

      const roomTypeByChannexId = new Map<string, number>()
      for (const rt of roomTypes) {
        // @ts-ignore ensure we read raw column name if model property differs
        const channexRoomTypeId: string | null = (rt as any).channexRoomTypeId || (rt as any).channex_room_type_id || null
        if (channexRoomTypeId) roomTypeByChannexId.set(channexRoomTypeId, rt.id)
      }

      const roomRates = await RoomRate.query()
        .where('hotel_id', hotelId)
        .select('id', 'rate_type_id', 'channex_rate_id')

      const roomRateByChannexRateId = new Map<string, { roomRateId: number, rateTypeId: number }>()
      for (const rr of roomRates) {
        // @ts-ignore read model camelCase or raw column
        const channexRateId: string | null = (rr as any).channexRateId || (rr as any).channex_rate_id || null
        if (channexRateId) roomRateByChannexRateId.set(channexRateId, { roomRateId: rr.id, rateTypeId: rr.rateTypeId || (rr as any).rate_type_id })
      }

      // Attach preloaded maps to ctx so downstream creation can use them
      ;(ctx as any).preloaded = {
        roomTypeByChannexId,
        roomRateByChannexRateId,
      }

      for (const booking of ourBookings) {
        try {
          const bookingData = booking.attributes
          const bookingId = booking.id

          // Vérifier si la réservation existe déjà via les maps préchargées
          const existingReservation = existingByUniqueId.get(bookingData.unique_id) || existingByChannexId.get(bookingId)

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
              // OTA fields
              otaName: bookingData.ota_name ?? existingReservation.otaName ?? null,
              otaReservationCode: bookingData.ota_reservation_code ?? existingReservation.otaReservationCode ?? null,
              otaStatus: bookingData.status ?? existingReservation.otaStatus ?? null,
              otaGuarantee: bookingData.guarantee ?? existingReservation.otaGuarantee ?? null,
            })

            await existingReservation.save()

            // === MISE À JOUR COMPLÈTE: devise, invité, chambres et folios ===
            try {
              // Préparer la devise de base de l'hôtel et le taux de change à appliquer
              const CurrencyCacheService = (await import('../services/currency_cache_service.js')).default
              const defaultCurrencyPayload = await CurrencyCacheService.getHotelDefaultCurrency(existingReservation.hotelId)
              const baseCurrencyCode = (defaultCurrencyPayload?.currencyCode || '').toUpperCase()
              const rawBookingCurrency = (bookingData.currency || bookingData.currency_code || '').toUpperCase()
              const isCrossRate = !!rawBookingCurrency && rawBookingCurrency !== baseCurrencyCode

              let exchangeRate = 1
              if (isCrossRate) {
                const Currency = (await import('../models/currency.js')).default
                const sourceCurrency = await Currency.query()
                  .where('hotelId', existingReservation.hotelId)
                  .where('currencyCode', rawBookingCurrency)
                  .select('exchangeRate', 'currencyCode')
                  .first()
                exchangeRate = sourceCurrency?.exchangeRate || 1
              }
              console.log('Exhange rate:', exchangeRate)
              // Recharger la réservation avec les relations nécessaires
              const ReservationModel = (await import('../models/reservation.js')).default
              const reservation = await ReservationModel.query()
              
                .where('id', existingReservation.id)
                .preload('reservationRooms')
                .preload('folios')
                .firstOrFail()

              // Ne pas enregistrer la devise/taux au niveau réservation si les colonnes n'existent pas
              // Nous appliquerons le taux au niveau des chambres et des folios uniquement

              // Mettre à jour l'invité principal si des changements sont détectés
              const customerData = bookingData?.customer || bookingData?.guest || bookingData?.guestDetails || null
              const primaryGuestId = reservation.guestId
              if (primaryGuestId && customerData) {
                const Guest = (await import('../models/guest.js')).default
                const guest = await Guest.find(primaryGuestId)
                if (guest) {
                  const firstName = customerData.name || customerData.first_name || guest.firstName
                  const lastName = customerData.surname || customerData.last_name || guest.lastName
                  const email = customerData.mail || customerData.email || guest.email
                  const phone = customerData.phone || guest.phonePrimary
                  const address = customerData.address || guest.addressLine
                  const city = customerData.city || guest.city
                  const country = customerData.country || guest.country
                  const zipcode = customerData.zip || guest.zipcode

                  await guest
                    .merge({
                      firstName,
                      lastName,
                      email,
                      phonePrimary: phone,
                      addressLine: address,
                      city,
                      country,
                      postalCode:zipcode,
                    })
                    .save()
                }
              }

              // Normaliser les chambres issues des données Channex et appliquer le taux de change
              const roomsData = (bookingData.rooms || bookingData.unit_assignments || []) as any[]
              const incomingRooms: Array<{
                roomTypeId: number | null
                roomRateId: number | null
                adults: number
                children: number
                nights: number
                roomRate: number
                taxes: number
                originalRoomRate: number | null
                originalCurrencyCode: string | null
                originalExchangeRate: number | null
                checkInDate: string
                checkOutDate: string
              }> = []

              for (const room of roomsData) {
                const checkinStr = room.checkin_date || bookingData.arrival_date
                const checkoutStr = room.checkout_date || bookingData.departure_date
                const checkinDt = DateTime.fromISO(checkinStr)
                const checkoutDt = DateTime.fromISO(checkoutStr)
                const nights = checkinDt.isValid && checkoutDt.isValid
                  ? Math.max(0, Math.ceil(checkoutDt.diff(checkinDt, 'days').days))
                  : (reservation.numberOfNights || 0)

                const totalStayAmountSrc = parseFloat(room.amount ?? room.rate ?? '0')
                let firstDayAmountSrc: number | undefined
                if (Array.isArray(room.days) && room.days.length > 0) {
                  firstDayAmountSrc = parseFloat(room.days[0]?.amount ?? room.days[0]?.rate ?? '0')
                } else if (room.days && typeof room.days === 'object') {
                  const dayKeys = Object.keys(room.days as Record<string, any>)
                  if (dayKeys.length > 0) {
                    const earliestKey = dayKeys.sort()[0]
                    const rawVal = (room.days as Record<string, any>)[earliestKey]
                    const parsedVal = parseFloat(typeof rawVal === 'string' ? rawVal : String(rawVal))
                    if (!isNaN(parsedVal)) {
                      firstDayAmountSrc = parsedVal
                    }
                  }
                }
                const nightlyRateSrc = firstDayAmountSrc !== undefined
                  ? firstDayAmountSrc
                  : (nights && nights > 0 ? (totalStayAmountSrc / nights) : totalStayAmountSrc)

                // Mapper channex_room_type_id et channex_rate_id vers IDs locaux
                let mappedRoomTypeId: number | null = null
                if (room.room_type_id) {
                  const rt = await RoomType.query()
                    .where('channex_room_type_id', room.room_type_id)
                    .where('hotel_id', reservation.hotelId)
                    .select('id')
                    .first()
                  mappedRoomTypeId = rt?.id ?? null
                }

                let mappedRoomRateId: number | null = null
                const channexRateId: string | undefined = room.rate_plan_id || room.rate_plan
                if (channexRateId) {
                  const rr = await RoomRate.query()
                    .where('channex_rate_id', channexRateId)
                    .where('hotel_id', reservation.hotelId)
                    .select('id',"rate_type_id")
                    .first()
                  mappedRoomRateId = rr?.rateTypeId ?? null
                }

                incomingRooms.push({
                  roomTypeId: mappedRoomTypeId,
                  roomRateId: mappedRoomRateId,
                  adults: room.occupancy?.adults || 0,
                  children: room.occupancy?.children || 0,
                  nights: nights || 0,
                  roomRate: (isCrossRate ? exchangeRate : 1) * (parseFloat(`${nightlyRateSrc}`) || 0),
                  taxes: room.taxes !== undefined ? (isCrossRate ? exchangeRate : 1) * (parseFloat(`${room.taxes}`) || 0) : 0,
                  originalRoomRate: parseFloat(`${nightlyRateSrc}`) || null,
                  originalCurrencyCode: rawBookingCurrency || baseCurrencyCode,
                  originalExchangeRate: isCrossRate ? exchangeRate : 1,
                  checkInDate: checkinStr,
                  checkOutDate: checkoutStr,
                })
              }

              // Appliquer le diff chambres: mettre à jour, ajouter, supprimer
              const existingRooms = reservation.reservationRooms || []
              const minLen = Math.min(existingRooms.length, incomingRooms.length)

              // Mettre à jour les chambres existantes alignées sur les nouvelles données
              for (let i = 0; i < minLen; i++) {
                const rr = existingRooms[i]
                const inc = incomingRooms[i]
                const nights = inc.nights ?? rr.nights ?? 0
                const newRoomRate = inc.roomRate
                const totalRoomCharges = nights === 0 ? newRoomRate : newRoomRate * nights
                const taxPerNight = inc.taxes || 0
                const totalTaxesAmount = nights === 0 ? taxPerNight : taxPerNight * nights

                rr.merge({
                  roomTypeId: inc.roomTypeId ?? rr.roomTypeId,
                  roomRateId: inc.roomRateId ?? rr.roomRateId,
                  adults: inc.adults,
                  children: inc.children,
                  nights,
                  roomRate: newRoomRate,
                  totalRoomCharges,
                  taxAmount: taxPerNight,
                  totalTaxesAmount,
                  totalAmount: totalRoomCharges,
                  originalRoomRate: inc.originalRoomRate ?? rr.originalRoomRate ?? newRoomRate,
                  originalExchangeRate: inc.originalExchangeRate ?? rr.originalExchangeRate ?? 1,
                  originalCurrencyCode: inc.originalCurrencyCode ?? rr.originalCurrencyCode ?? baseCurrencyCode,
                })
                await rr.save()
              }

              // Ajouter les nouvelles chambres si le nombre a augmenté
              if (incomingRooms.length > existingRooms.length) {
                for (let i = existingRooms.length; i < incomingRooms.length; i++) {
                  const inc = incomingRooms[i]
                  const nights = inc.nights || reservation.numberOfNights || 0
                  const totalRoomCharges = nights === 0 ? inc.roomRate : inc.roomRate * nights
                  const totalTaxesAmount = nights === 0 ? inc.taxes : inc.taxes * nights

                  await ReservationRoom.create({
                    reservationId: reservation.id,
                    roomTypeId: inc.roomTypeId ?? existingRooms[0]?.roomTypeId ?? 1,
                    roomRateId: inc.roomRateId ?? null,
                    roomId: null,
                    guestId: reservation.guestId!,
                    isOwner: false,
                    checkInDate: DateTime.fromISO(inc.checkInDate || reservation.arrivedDate!.toISODate()),
                    checkOutDate: DateTime.fromISO(inc.checkOutDate || reservation.departDate.toISODate()),
                    checkInTime: reservation.checkInTime,
                    checkOutTime: reservation.checkOutTime,
                    totalAmount: totalRoomCharges,
                    nights,
                    adults: inc.adults,
                    children: inc.children,
                    roomRate: inc.roomRate,
                    originalRoomRate: inc.originalRoomRate,
                    originalCurrencyCode: inc.originalCurrencyCode,
                    originalExchangeRate: inc.originalExchangeRate,
                    paymentMethodId: reservation.paymentMethodId ?? null,
                    hotelId: reservation.hotelId,
                    totalRoomCharges,
                    taxAmount: inc.taxes,
                    totalTaxesAmount,
                    netAmount: totalRoomCharges + totalTaxesAmount,
                    status: nights === 0 ? 'day_use' : 'reserved',
                    rateTypeId: null,
                    mealPlanId: null,
                  })
                }
              }

              // Supprimer les chambres excédentaires si le nombre a diminué
              if (incomingRooms.length < existingRooms.length) {
                for (let i = incomingRooms.length; i < existingRooms.length; i++) {
                  const rr = existingRooms[i]
                  await ReservationRoom.query().where('id', rr.id).delete()
                }
              }

              // Mettre à jour les compteurs de la réservation (adultes, enfants, guestCount)
              const totalAdults = incomingRooms.reduce((sum, r) => sum + (r.adults || 0), 0)
              const totalChildren = incomingRooms.reduce((sum, r) => sum + (r.children || 0), 0)
              reservation.merge({ adults: totalAdults, children: totalChildren, guestCount: totalAdults + totalChildren })
              await reservation.save()

              // Réinitialiser les transactions des folios et recréer les room charges
              if (reservation.folios && reservation.folios.length > 0) {
                const FolioService = (await import('../services/folio_service.js')).default
                const ReservationFolioService = (await import('../services/reservation_folio_service.js')).default

                for (const folio of reservation.folios) {
                  await FolioTransaction.query().where('folioId', folio.id).delete()
                }

                await ReservationFolioService.postRoomCharges(reservation.id, userId)

                for (const folio of reservation.folios) {
                  await FolioService.updateFolioTotals(folio.id)
                }
              }
            } catch (updateErr) {
              console.warn('⚠️ Erreur durant la mise à jour complète de la réservation:', updateErr)
            }

            const acknowledged = await ReservationCreationService.sendAcknowledgeToChannex(
              existingReservation.channexBookingId!, // ← UTILISER LE REVISION_ID ICI
              existingReservation.id,
              userId,
              ctx
            )
            syncResults.totalUpdated++
          } else {
            // ============================================
            // CAS 2: CRÉATION D'UNE NOUVELLE RÉSERVATION
            // ============================================

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
          bookingsResponse
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