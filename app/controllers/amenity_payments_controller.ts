import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Reservation from '#models/reservation'
import AmenityBooking from '#models/amenity_booking'
import Payment from '#models/payment'
import LoggerService from '#services/logger_service'
import { payForAmenitiesValidator } from '#validators/amenity_payment_validator'

export default class AmenityPaymentsController {
  /**
   * Handles the payment for one or more amenity bookings for a specific reservation.
   */
  public async payForAmenities(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const trx = await db.transaction()

    try {
      const reservationId = params.reservationId
      const user = auth.user!

      const payload = await request.validateUsing(payForAmenitiesValidator)

      // 1. Fetch the reservation and the selected amenity bookings within the transaction
      const reservation = await Reservation.findOrFail(reservationId, { client: trx })
      const amenityBookings = await AmenityBooking.query({ client: trx })
        .whereIn('id', payload.amenity_booking_ids)
        .where('reservation_id', reservationId)
        .where('status', 'pending')

      // 2. Validate that all requested bookings were found and are pending
      if (amenityBookings.length !== payload.amenity_booking_ids.length) {
        await trx.rollback()
        return response.badRequest({
          message:
            'One or more amenity bookings are invalid, already paid, or do not belong to this reservation.',
        })
      }

      // 3. Calculate the total amount to be paid
      const totalAmountToPay = amenityBookings.reduce(
        (sum, booking) => sum + parseFloat(booking.totalAmount.toString()),
        0
      )

      if (totalAmountToPay <= 0) {
        await trx.rollback()
        return response.badRequest({ message: 'Payment amount must be positive.' })
      }

      // 4. Create the payment record
      const payment = await Payment.create(
        {
          user_id: reservation.user_id,
          reservation_id: reservation.id,
          amount_paid: totalAmountToPay,
          payment_method: payload.payment_method,
          status: 'paid', // Assuming direct payment confirmation
          transaction_id: payload.transaction_id,
          notes: payload.notes || `Payment for amenities: ${payload.amenity_booking_ids.join(', ')}`,
          service_id: reservation.service_id,
          created_by: user.id,
          last_modified_by: user.id,
        },
        { client: trx }
      )

      // 5. Update the status of each amenity booking
      for (const booking of amenityBookings) {
        booking.status = 'completed'
        booking.lastModifiedBy = user.id
        await booking.save()
      }

      // 6. Log the activity
      await LoggerService.log({
        actorId: user.id,
        action: 'PAYMENT',
        entityType: 'AmenityBooking',
        entityId: reservation.id.toString(), // Log against the reservation
        description: `Payment of ${totalAmountToPay} made for amenities on reservation #${reservation.reservation_number}.`,
        changes: {  },
        ctx,
      })

      await trx.commit()

      return response.ok({ message: 'Payment for amenities successful.', payment })
    } catch (error) {
      await trx.rollback()
      return response.internalServerError({ message: 'Failed to process payment.',error,errorMessage: error.message })
    }
  }
}

