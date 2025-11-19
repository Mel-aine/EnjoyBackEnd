import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import { createGuestCheckoutReportValidator } from '#validators/guest_checkout_report'
import { ReservationStatus } from '../enums.js'
import ReservationRoom from '../models/reservation_room.js'

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

      // Valider et parser les dates
      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)
      
      if (!startDateTime.isValid || !endDateTime.isValid) {
        throw new Error('Les dates fournies sont invalides')
      }

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for checked out reservations
      const reservations = await ReservationRoom.query()
        .preload('guest')
        .preload('reservation', (reservationQuery) => {
          reservationQuery.preload('checkedOutByUser')
            .preload('bookingSource')
        })
        .preload('roomRates', (roomRatesQuery) => {
          roomRatesQuery.preload('rateType')
        })
        .preload('room')
        .where('hotelId', hotelId)
        .where('actualCheckOut', '>=', startDateTime.toSQLDate())
        .where('actualCheckOut', '<=', endDateTime.toSQLDate())
        .where('status', ReservationStatus.CHECKED_OUT)
        .orderBy('actualCheckOut', 'asc')

      // Process checkout data

      const checkoutList = reservations.map(rs => ({
        resNo: rs.reservation.reservationNumber,
        guest: rs.guest ? `${rs.guest.displayName}` : rs.reservation.guest.displayName,
        room: rs.room?.roomNumber,
        rate: rs.roomRate,
        arrivalDate: rs.checkInDate.toFormat('yyyy-MM-dd'),
        departureDate: rs.checkOutDate.toFormat('yyyy-MM-dd'),
        pax: rs.adults + (rs.children || 0),
        businessSource: rs.reservation.bookingSource?.sourceName || 'Direct',
        resType: rs.roomRates.rateType.rateTypeName,
        checkoutUser: rs.reservation.checkedOutByUser ?
          `${rs.reservation.checkedOutByUser.fullName}` :
          'System'
      }))

      // Calculate totals
      const totalReservations = checkoutList.length
      const totalGuests = checkoutList.reduce((sum, item) => sum + Number(item.pax), 0)
      const totalRevenue = checkoutList.reduce((sum, item) => sum + Number(item.rate), 0)

      // Prepare response data
      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address,
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
      

      return response.badRequest({
        success: false,
        message: 'Failed to generate guest checkout report',
        error: error.message
      })
    }
  }
}