import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import Guest from '#models/guest'
import Room from '#models/room'
import User from '#models/user'
import { createGuestCheckoutReportValidator } from '#validators/guest_checkout_report'
import LoggerService from '#services/logger_service'

export default class GuestCheckoutReportsController {
  /**
   * Generate Guest Checkout Report
   * Input: fromDate, toDate, hotelId
   * Output: Hotel details, date range, list of checkout reservations with totals
   */
  async generate({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createGuestCheckoutReportValidator)
      const { fromDate, toDate, hotelId } = payload

      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for checked out reservations
      const reservations = await Reservation.query()
        .preload('guest')
        .preload('room')
        .preload('roomType')
        .preload('ratePlan')
        .preload('bookingSource')
        .preload('checkedOutBy') // User who performed checkout
        .where('hotelId', hotelId)
        .where('departureDate', '>=', startDateTime.toSQLDate())
        .where('departureDate', '<=', endDateTime.toSQLDate())
        .where('status', 'CheckedOut')
        .orderBy('departureDate', 'asc')

      // Process checkout data
      const checkoutList = reservations.map(reservation => ({
        resNo: reservation.reservationNumber,
        guest: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
        room: reservation.room?.roomNumber || 'N/A',
        rate: reservation.roomRate || 0,
        arrivalDate: DateTime.fromJSDate(reservation.arrivalDate).toFormat('yyyy-MM-dd'),
        departureDate: DateTime.fromJSDate(reservation.departureDate).toFormat('yyyy-MM-dd'),
        pax: reservation.adults + (reservation.children || 0),
        businessSource: reservation.bookingSource?.sourceName || 'Direct',
        resType: reservation.ratePlan?.planName || 'Standard',
        checkoutUser: reservation.checkedOutBy ? 
          `${reservation.checkedOutBy.firstName} ${reservation.checkedOutBy.lastName}` : 
          'System'
      }))

      // Calculate totals
      const totalReservations = checkoutList.length
      const totalGuests = checkoutList.reduce((sum, item) => sum + item.pax, 0)
      const totalRevenue = checkoutList.reduce((sum, item) => sum + item.rate, 0)

      // Prepare response data
      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address,
          contactPerson: hotel.contactPerson,
          phone: hotel.phone,
          email: hotel.email
        },
        dateRange: {
          fromDate: startDateTime.toFormat('yyyy-MM-dd'),
          toDate: endDateTime.toFormat('yyyy-MM-dd')
        },
        checkoutList,
        summary: {
          totalReservations,
          totalGuests,
          totalRevenue,
          averageRate: totalReservations > 0 ? totalRevenue / totalReservations : 0
        }
      }

      // Log the report generation
      await LoggerService.log({
        level: 'info',
        message: 'Guest checkout report generated',
        data: {
          hotelId,
          fromDate,
          toDate,
          totalReservations,
          totalGuests,
          generatedBy: auth.user?.id
        }
      })

      return response.ok({
        success: true,
        message: 'Guest checkout report generated successfully',
        data: responseData,
        filters: {
          fromDate,
          toDate,
          hotelId
        },
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to generate guest checkout report',
        data: {
          error: error.message,
          stack: error.stack,
          userId: auth.user?.id
        }
      })

      return response.badRequest({
        success: false,
        message: 'Failed to generate guest checkout report',
        error: error.message
      })
    }
  }
}