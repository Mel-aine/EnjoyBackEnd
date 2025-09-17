import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import Guest from '#models/guest'
import Room from '#models/room'
import { createPickupDropoffReportValidator } from '#validators/pickup_dropoff_report'
import LoggerService from '#services/logger_service'

export default class PickupDropoffReportsController {
  /**
   * Generate Pickup/Dropoff Guest Report
   * Input: startDate, endDate, type (Pickup, Dropoff, Both)
   * Output: List with hotel details and guest information
   */
  async generate({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createPickupDropoffReportValidator)
      const { startDate, endDate, type, hotelId } = payload

      const startDateTime = DateTime.fromISO(startDate)
      const endDateTime = DateTime.fromISO(endDate)

      // Build query based on type
      let query = Reservation.query()
        .preload('guest')
        .preload('hotel')
        .preload('room')
        .preload('roomType')
        .where('arrivalDate', '>=', startDateTime.toSQLDate())
        .where('departureDate', '<=', endDateTime.toSQLDate())

      if (hotelId) {
        query = query.where('hotelId', hotelId)
      }

      // Filter by pickup/dropoff requirements
      if (type === 'Pickup') {
        query = query.whereNotNull('pickupRequired').where('pickupRequired', true)
      } else if (type === 'Dropoff') {
        query = query.whereNotNull('dropoffRequired').where('dropoffRequired', true)
      } else if (type === 'Both') {
        query = query.where((subQuery) => {
          subQuery
            .where('pickupRequired', true)
            .orWhere('dropoffRequired', true)
        })
      }

      const reservations = await query.orderBy('arrivalDate', 'asc')

      // Process data for pickup
      const pickupData = reservations
        .filter(res => res.pickupRequired && (type === 'Pickup' || type === 'Both'))
        .map(reservation => ({
          hotelName: reservation.hotel.hotelName,
          startDate: startDateTime.toFormat('yyyy-MM-dd'),
          endDate: endDateTime.toFormat('yyyy-MM-dd'),
          pickDropDateTime: reservation.pickupDateTime ? 
            DateTime.fromJSDate(reservation.pickupDateTime).toFormat('yyyy-MM-dd HH:mm:ss') : 
            reservation.arrivalDate,
          guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
          roomNo: reservation.room?.roomNumber || 'N/A',
          mode: reservation.pickupMode || 'Standard',
          vehicle: reservation.pickupVehicle || 'N/A',
          description: reservation.pickupNotes || 'Pickup service'
        }))

      // Process data for dropoff
      const dropoffData = reservations
        .filter(res => res.dropoffRequired && (type === 'Dropoff' || type === 'Both'))
        .map(reservation => ({
          hotelName: reservation.hotel.hotelName,
          startDate: startDateTime.toFormat('yyyy-MM-dd'),
          endDate: endDateTime.toFormat('yyyy-MM-dd'),
          pickDropDateTime: reservation.dropoffDateTime ? 
            DateTime.fromJSDate(reservation.dropoffDateTime).toFormat('yyyy-MM-dd HH:mm:ss') : 
            reservation.departureDate,
          guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
          roomNo: reservation.room?.roomNumber || 'N/A',
          mode: reservation.dropoffMode || 'Standard',
          vehicle: reservation.dropoffVehicle || 'N/A',
          description: reservation.dropoffNotes || 'Dropoff service'
        }))

      // Prepare response based on type
      const responseData: any = {}

      if (type === 'Pickup' || type === 'Both') {
        responseData.pickup = {
          list: pickupData,
          totalGuests: pickupData.length
        }
      }

      if (type === 'Dropoff' || type === 'Both') {
        responseData.dropoff = {
          list: dropoffData,
          totalGuests: dropoffData.length
        }
      }

      // Log the report generation
      await LoggerService.log({
        level: 'info',
        message: 'Pickup/Dropoff guest report generated',
        data: {
          type,
          startDate,
          endDate,
          hotelId,
          pickupCount: pickupData.length,
          dropoffCount: dropoffData.length,
          generatedBy: auth.user?.id
        }
      })

      return response.ok({
        success: true,
        message: 'Pickup/Dropoff guest report generated successfully',
        data: responseData,
        filters: {
          startDate,
          endDate,
          type,
          hotelId
        },
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to generate pickup/dropoff guest report',
        data: {
          error: error.message,
          stack: error.stack,
          userId: auth.user?.id
        }
      })

      return response.badRequest({
        success: false,
        message: 'Failed to generate pickup/dropoff guest report',
        error: error.message
      })
    }
  }
}