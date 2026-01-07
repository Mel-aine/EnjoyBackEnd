// app/Services/ChannexBlockService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import RoomBlock from '#models/room_block'
import { DateTime } from 'luxon'
import ReservationRoomService from '#services/reservation_room_service'

export default class ChannexBlockService {
  private channexService: ChannexService
  private rrService: ReservationRoomService

  constructor() {
    this.channexService = new ChannexService()
    this.rrService = new ReservationRoomService()
  }

  /**
   * Calculate availability efficiently for a range of dates
   * Uses batch querying and segmentation (similar to ReservationHook)
   */
  private async calculateBlockAvailability(
    serviceId: number,
    roomTypeId: number,
    roomTypeChannexId: string,
    hotelChannexId: string,
    dates: DateTime[],
    _action: 'block' | 'unblock' | 'sync' // Action is ignored as we sync actual DB state
  ): Promise<any> {
    if (dates.length === 0) return { values: [] }

    // 1. Determine range boundaries
    const startDates = dates.map(d => d.toJSDate().getTime())
    const minDate = DateTime.fromMillis(Math.min(...startDates))
    const maxDate = DateTime.fromMillis(Math.max(...startDates))

    logger.info(`🧮 Calculating block availability for range ${minDate.toISODate()} to ${maxDate.toISODate()}`)

    // 2. Fetch Base Availability from Reservations (Batch)
    // This gives us: Total Rooms - Reserved Rooms
    const dailyAvailability = await this.rrService.getDailyAvailableRoomCountsByRoomType(
      serviceId,
      [roomTypeId],
      minDate.toJSDate(),
      maxDate.toJSDate()
    )

    // 3. Fetch Active Blocks for the range (Batch)
    const blocks = await RoomBlock.query()
      .where('hotel_id', serviceId)
      .where('room_type_id', roomTypeId)
      .whereNot('status', 'completed')
      .where((query) => {
        query.whereBetween('block_from_date', [minDate.toJSDate(), maxDate.toJSDate()])
        query.orWhereBetween('block_to_date', [minDate.toJSDate(), maxDate.toJSDate()])
        query.orWhere((sub) => {
          sub.where('block_from_date', '<=', minDate.toJSDate())
          sub.andWhere('block_to_date', '>=', maxDate.toJSDate())
        })
      })

    // 4. Calculate final availability per day and Segment
    const values: any[] = []
    
    // Helper to get availability for a specific date
    const getAvailabilityForDate = (date: DateTime) => {
      const dateKey = date.toISODate()!
      
      // Base availability from reservations
      let avail = dailyAvailability[dateKey]?.[roomTypeId] ?? 0
      
      // Subtract blocks
      // We iterate blocks in memory (much faster than DB queries per day)
      // Since we filtered blocks by range, this list is relevant
      const dateJs = date.toJSDate()
      let blockedCount = 0
      for (const block of blocks) {
        const from = block.blockFromDate.toJSDate()
        const to = block.blockToDate.toJSDate()
        // Check intersection: block includes this date
        // Note: blockFromDate is inclusive, blockToDate is inclusive (based on current usage in DB)
        // Wait, in calculateRoomAvailability it was:
        // .where('block_from_date', '<=', targetDate)
        // .where('block_to_date', '>=', targetDate)
        if (dateJs >= from && dateJs <= to) {
          blockedCount++
        }
      }

      return Math.max(0, avail - blockedCount)
    }

    // Segmentation Logic
    const startDay = minDate.startOf('day')
    const endDay = maxDate.startOf('day')
    
    let segStart = startDay
    let current = getAvailabilityForDate(startDay)
    let cursor = startDay.plus({ days: 1 })

    while (cursor <= endDay) {
      // Only process if this date is in our requested list (dates)
      // Actually, dates[] might be non-contiguous? 
      // getImpactedDates returns a contiguous range.
      // But let's be safe. If we are processing a contiguous range from min to max,
      // we assume we want to sync the whole range.
      
      const val = getAvailabilityForDate(cursor)
      
      if (val !== current) {
        // Push previous segment
        values.push({
          room_type_id: roomTypeChannexId,
          property_id: hotelChannexId,
          date_from: segStart.toISODate()!,
          date_to: cursor.minus({ days: 1 }).toISODate()!,
          availability: current,
          stop_sell: current === 0
        })
        
        // Start new segment
        segStart = cursor
        current = val
      }
      
      cursor = cursor.plus({ days: 1 })
    }

    // Push final segment
    values.push({
      room_type_id: roomTypeChannexId,
      property_id: hotelChannexId,
      date_from: segStart.toISODate()!,
      date_to: endDay.toISODate()!,
      availability: current,
      stop_sell: current === 0
    })

    logger.debug(`📊 Generated ${values.length} availability segments for Channex`)

    return { values }
  }

  /**
   * ============================================================================
   * MÉTHODES PRINCIPALES DE SYNCHRONISATION
   * ============================================================================
   */

  /**
   * Synchroniser la disponibilité après un blocage de chambre
   */
  async syncAvailabilityAfterRoomBlock(roomBlock: RoomBlock, hotelChannexId: string) {
    try {
      logger.info(`🚫 START syncAvailabilityAfterRoomBlock for room block ${roomBlock.id}`)

      await roomBlock.load('roomType')

      if (!roomBlock.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync block - room type not synced`)
        return
      }

      const impactedDates = this.getImpactedDates(roomBlock.blockFromDate, roomBlock.blockToDate)
      
      const availabilityData = await this.calculateBlockAvailability(
        roomBlock.hotelId,
        roomBlock.roomTypeId,
        roomBlock.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        'block'
      )

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Availability UPDATED after room block ${roomBlock.id}`)

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityAfterRoomBlock:`, error)
      throw error
    }
  }
  /**
   * Synchroniser la disponibilité pour une plage de dates spécifique (mode sync pur)
   */
  async syncAvailabilityForRange(
    roomBlock: RoomBlock, 
    startDate: DateTime, 
    endDate: DateTime, 
    hotelChannexId: string
  ) {
    try {
      logger.info(`🔄 START syncAvailabilityForRange for room block ${roomBlock.id} (${startDate.toISODate()} - ${endDate.toISODate()})`)

      await roomBlock.load('roomType')

      if (!roomBlock.roomType?.channexRoomTypeId) {
        logger.warn(`❌ Cannot sync range - room type not synced`)
        return
      }

      const impactedDates = this.getImpactedDates(startDate, endDate)
      
      const availabilityData = await this.calculateBlockAvailability(
        roomBlock.hotelId,
        roomBlock.roomTypeId,
        roomBlock.roomType.channexRoomTypeId,
        hotelChannexId,
        impactedDates,
        'sync'
      )

      const updateResult = await this.updateAvailabilityOnChannex(hotelChannexId, availabilityData)

      logger.info(`✅ Availability SYNCED for range ${startDate.toISODate()} - ${endDate.toISODate()}`)

      return updateResult

    } catch (error) {
      logger.error(`❌ FAILED syncAvailabilityForRange:`, error)
      throw error
    }
  }



  /**
   * ============================================================================
   * MÉTHODES UTILITAIRES
   * ============================================================================
   */

  /**
   * Obtenir les dates impactées par un blocage
   */
  private getImpactedDates(startDate: DateTime, endDate: DateTime): DateTime[] {
    const dates: DateTime[] = []
    let currentDate = startDate.startOf('day')

    while (currentDate <= endDate) {
      dates.push(currentDate)
      currentDate = currentDate.plus({ days: 1 })
    }

    return dates
  }

  /**
   * Mettre à jour la disponibilité sur Channex
   */
  private async updateAvailabilityOnChannex(propertyId: string, availabilityData: any) {
    try {
      logger.info(`🚀 Updating availability on Channex for ${availabilityData.values.length} dates`)

      const response = await this.channexService.updateAvailability(propertyId, availabilityData)

      if (response && response.success !== false) {
        logger.info(`✅ Channex availability updated successfully`)
      } else {
        logger.warn(`⚠️ Channex update partial success`)
      }

      return response

    } catch (error) {
      logger.error(`❌ Channex update failed:`, error)
      throw error
    }
  }


}