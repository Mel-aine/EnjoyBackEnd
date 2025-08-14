
import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Reservation, { ReservationStatus } from '#models/reservation'
import ServiceProduct from '#models/room'
import ReservationServiceProduct from '#models/reservation_room'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { generateConfirmationNumber } from '../utils/generate_confirmation_number.js'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import CancellationPolicy from '#models/cancellation_policy'
import Refund from '#models/refund'
import { ReservationProductStatus } from '../enums.js'
// import { messages } from '@vinejs/vine/defaults'
import logger from '@adonisjs/core/services/logger'
import AmenityBooking from '../models/amenity_booking.js'
import ReservationRoom from '#models/reservation_room'
import ReservationService from '#services/reservation_service'
import type { ReservationData } from '../types/reservationData.js'


export default class ReservationsController extends CrudController<typeof Reservation> {
  private userService: CrudService<typeof User>
  private reservationService: CrudService<typeof Reservation>

  constructor() {
    super(new CrudService(Reservation))
    this.userService = new CrudService(User)
    this.reservationService = new CrudService(Reservation)
  }


  async showByRoomId({ params, response }: HttpContext) {
    try {
      const { roomId } = params

      // Validation du paramètre
      if (!roomId) {
        return response.badRequest({ message: 'roomId is required' })
      }

      const roomIdNum = parseInt(roomId, 10)
      if (isNaN(roomIdNum)) {
        return response.badRequest({ message: 'Invalid roomId' })
      }

      // Récupération des réservations liées à un service product
      const items = await ReservationRoom.query()
        .where('id', roomId)
        .preload('reservation')
        .preload('room')
        .preload('creator')
        .preload('modifier')

      // Si aucune réservation trouvée
      if (items.length === 0) {
        return response.notFound({ message: 'No reservations found for this service product' })
      }

      return response.ok(items)
    } catch (error) {
      console.error(error)
      return response.internalServerError({
        message: 'Error fetching reservations for service product',
        error: error.message,
      })
    }
  }

  public async checkIn(ctx: HttpContext) {
    const { params, response, request, auth } = ctx;
    const { reservationRooms } = request.body();
    try {
      console.log('Check-in started for reservation ID:', params.id);

      const reservation = await this.reservationService.findById(params.id);
      console.log('Reservation fetched:', reservation);

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' });
      }

      // Récupérer la liaison avec les produits
      const reservationProducts = await ReservationServiceProduct.query()
        .where('reservation_id', reservation.id).andWhereIn('id', reservationRooms);

      if (!reservationProducts.length) {
        return response.notFound({ message: 'No service product linked to this reservation' });
      }
      const now = DateTime.now();

      reservation.check_in_date = now;

      for (const link of reservationProducts) {

        const serviceProduct = await ServiceProduct.find(link.service_product_id);
        link.status = ReservationProductStatus.CHECKED_IN;
        link.check_in_date = now;
        await link.save();
        if (serviceProduct) {
          serviceProduct.status = 'occupied';
          await serviceProduct.save();
          console.log(`Service product ${serviceProduct.id} status updated to occupied`);
        }
      }
      reservation.status = ReservationStatus.CHECKED_IN;
      await reservation.save();

      // Mettre à jour le statut de la réservation
      console.log('Reservation status updated to checked-in');

      await LoggerService.log({
        actorId: auth.user!.id, // Assuming the user who checks in is the last modifier
        action: 'CHECK_IN',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was checked in.`,
        ctx: ctx,
      })

      return response.ok({
        message: 'Check-in successful',
        reservation,
        reservationProducts,
        serviceProducts: reservationProducts.map((rp) => rp.service_product_id),
      });

    } catch (error) {
      console.error('Error during check-in:', error);
      return response.status(500).send({
        message: 'Error during check-in',
        error: error.message,
      });
    }
  }



  public async checkOut(ctx: HttpContext) {
    const { params, response, request, auth } = ctx
    const { reservationRooms } = request.body();
    try {
      console.log('Check-out started for reservation ID:', params.id);

      const reservation = await this.reservationService.findById(params.id);
      console.log('Reservation fetched:', reservation);

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' });
      }

      const resServices = await ReservationServiceProduct.query()
        .where('reservation_id', params.id).andWhereIn('id', reservationRooms)
        .preload('serviceProduct');

      if (resServices.length === 0) {
        return response.notFound({ message: 'No service products linked to this reservation' });
      }

      const updatedServiceProducts: number[] = [];

      for (const rsp of resServices) {
        rsp.check_out_date = DateTime.now();
        rsp.status = ReservationProductStatus.CHECKED_OUT;
        await rsp.save();
        const serviceProduct = rsp.serviceProduct;
        if (serviceProduct) {
          serviceProduct.status = 'dirty';
          await serviceProduct.save();
          updatedServiceProducts.push(serviceProduct.id);
          console.log(`Service product ${serviceProduct.id} status updated to cleaning`);
        }
      }

      const res = await ReservationServiceProduct.query().where('reservation_id', params.id).andWhere('status', '<>', 'checked-out')
      const allCheckedOut = res.length === 0;
      if (allCheckedOut) {
        reservation.check_out_date = DateTime.now();
        reservation.status = ReservationStatus.CHECKED_OUT
        await reservation.save();
        console.log('Reservation status updated to checked-out');
      }

      // Log the check-out activity
      await LoggerService.log({
        actorId: auth.user!.id, // Assuming the user who checks out is the last modifier
        action: 'CHECK_OUT',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was checked out.`,
        ctx: ctx,
      })

      return response.ok({
        message: 'Check-out successful',
        reservation,
        reservationProducts: resServices.map(rsp => rsp.id),
        serviceProducts: updatedServiceProducts,
      });
    } catch (error) {
      console.error('Error during check-out:', error);
      return response.status(500).send({
        message: 'Error during check-out',
        error: error.message,
      });
    }
  }

  /**
 * Get a single reservation with all its related information,
 * including the user, service product, and payment.
 *
 * GET /reservations/:id
 */
  public async getReservationDetails({ params, response }: HttpContext) {
    try {
      const reservationId = parseInt(params.reservationId, 10)

      if (isNaN(reservationId)) {
        return response.badRequest({ message: 'Invalid reservation ID. Must be a valid number.' })
      }

      const reservation = await Reservation.query()
        .where('id', reservationId)
        .whereNotNull('hotel_id')
        .preload('guest')
        .preload('folios')
        .preload('bookingSource')
        .preload('reservationRooms', (query) => {
          query.preload('room')
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      return response.ok(reservation)
    } catch (error) {
      console.error('Error fetching reservation details:', error)
      return response.internalServerError({ message: 'An error occurred while fetching the reservation.' })
    }
  }



  /**
 * Verify if user can extend stay in the hotel
 * @param {HttpContext} ctx - Le contexte HTTP
 * @body {{ new_depart_date: string }} - New Depart Date au format ISO (YYYY-MM-DD).
 */
  public async checkExtendStay(ctx: HttpContext) {
    const { params, request, response } = ctx
    const reservationId = params.id
    const res = {
      scenario: -1,
      messages: ""
    }
    const validator = vine.compile(
      vine.object({
        new_depart_date: vine.date(),
      })
    )
    const trx = await db.transaction()
    try {

      const payload = await request.validateUsing(validator, {
        data: request.body(),
      })

      const newDepartDate = DateTime.fromJSDate(payload.new_depart_date)

      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms')
        .first()

      if (!reservation) {
        await trx.rollback()
        res.messages = 'Reservation not found.'
        return response.status(200).json(res)
      }

      const oldDepartDate = reservation.depart_date

      if (!oldDepartDate || newDepartDate <= oldDepartDate) {
        await trx.rollback();
        res.messages = 'The new departure date must be later than the current departure date.'
        return response
          .status(200)
          .json(res)
      }

      // --- Vérification des conflits ---
      const conflicts = []
      for (const rsp of reservation.reservationRooms) {
        const product = await ServiceProduct.find(rsp.service_product_id)
        const conflictingReservation = await ReservationServiceProduct.query({ client: trx })
          .where('service_product_id', rsp.service_product_id)
          .where('reservation_id', '!=', reservationId)
          .andWhere((query) => {
            query

              .where('start_date', '<', newDepartDate.toISODate()!)
              .andWhere('start_date', '>=', DateTime.now().toISODate()!)
            // .andWhere('end_date', '>', oldDepartDate.toISODate()!)
          })
          .first()
        logger.info(conflictingReservation)
        if (conflictingReservation) {
          conflicts.push({
            productName: product?.product_name || `ID ${rsp.service_product_id}`,
            productId: rsp.service_product_id,
          })
        }
      }

      if (conflicts.length > 0) {
        await trx.rollback()
        res.scenario = 0
        return response.status(200).json(res)
      } else {
        res.scenario = 2
        return response.status(200).json(res)
      }
    } catch (error) {
      await trx.rollback();
      res.messages = "An error has occurred." + error.message
      console.error('Erreur lors de la prolongation du séjour :', error)
      return response.status(200)
        .json(res)
    }
  }
  /**
   * Prolonge la date de départ d'une réservation existante.
   * @param {HttpContext} ctx - Le contexte HTTP
   * @body {{ new_depart_date: string }} - La nouvelle date de départ au format ISO (YYYY-MM-DD).
   */
  public async extendStay(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const reservationId = params.id

    // const validator = vine.compile(
    //   vine.object({
    //     new_depart_date: vine.date(),
    //   })
    // )
    const trx = await db.transaction()
    try {

      // const payload = await request.validateUsing(validator, {
      //   data: request.body(),
      // })
      const body = request.body();
      //const newDepartDate = DateTime.fromJSDate(payload.new_depart_date)
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationServiceProducts')
        .first()

      if (!reservation || !reservation.arrived_date) {
        await trx.rollback()
        return response.notFound({ message: 'Réservation non trouvée.' })
      }

      if (!body.new_depart_date) {
        await trx.rollback()
        return response.notFound({ message: 'Réservation non trouvée.' })
      }
      reservation.depart_date = body.new_depart_date;
      // --- Aucune conflit : Procéder à la prolongation ---
      const oldReservationData = { ...reservation.serialize() }
      const newDepartDate = reservation.depart_date;

      // const newDepartDateLuxon = DateTime.fromISO(newDepartDate);
      // const arrivedDateLuxon = DateTime.fromJSDate(new Date(reservation.arrived_date));
      const newDepartDateLuxon = DateTime.fromISO(String(newDepartDate));
      const arrivedDateLuxon = DateTime.fromISO(String(reservation.arrived_date));

      const oldNumberOfNights = reservation.number_of_nights || 0
      const newNumberOfNights = newDepartDateLuxon!.diff(arrivedDateLuxon, 'days').days
      const additionalNights = newNumberOfNights - oldNumberOfNights
      let additionalAmount = 0
      // Mettre à jour les produits de la réservation
      for (const rsp of reservation.reservationRooms) {
        const rspInTrx = await ReservationServiceProduct.findOrFail(rsp.id, { client: trx })

        const additionalProductCost = parseFloat(`${rspInTrx.rate_per_night!}`) * additionalNights
        additionalAmount += additionalProductCost

        rspInTrx.end_date = newDepartDate!
        rspInTrx.total_amount = parseFloat(`${rspInTrx.total_amount!}`) + additionalProductCost
        rspInTrx.last_modified_by = auth.user!.id
        await rspInTrx.save()
      }

      // Mettre à jour la réservation principale
      reservation.depart_date = newDepartDate
      reservation.number_of_nights = newNumberOfNights
      reservation.total_amount = parseFloat(`${reservation.total_amount!}`) + additionalAmount
      reservation.final_amount = parseFloat(`${reservation.final_amount!}`) + additionalAmount
      reservation.remaining_amount = parseFloat(`${reservation.remaining_amount!}`) + additionalAmount
      reservation.last_modified_by = auth.user!.id
      await reservation.save()

      await trx.commit()

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'UPDATE',
        entityType: 'Reservation',
        entityId: reservationId,
        description: `Stay for reservation #${reservationId} extended until ${newDepartDate}.`,
        changes: LoggerService.extractChanges(oldReservationData, reservation.serialize()),
        ctx,
      })

      return response.ok({ message: 'The stay was successfully extended.', reservation })
    } catch (error) {
      await trx.rollback()
      console.error('Erreur lors de la prolongation du séjour :', error)
      return response.internalServerError({ message: "An error has occurred.", error: error.message })
    }
  }

  public async getCancellationSummary({ params, response }: HttpContext) {
    try {
      const reservationId = params.id
      const reservation = await Reservation.query().where('id', reservationId).preload('service').preload('reservationRooms').first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      const policy = await CancellationPolicy.query()
        .where('service_id', reservation.service_id)
        .orderBy('created_at', 'desc')
        .first()

      // Case where no policy is defined
      if (!policy) {
        return response.ok({
          isFreeCancellationPossible: true,
          cancellationFee: 0.00,
          deadline: null,
          summaryMessage: "Free cancellation possible at any time, as no policy is defined.",
        })
      }

      // Case where cancellation is always free
      if (policy.cancellation_fee_type === 'none') {
        return response.ok({
          isFreeCancellationPossible: true,
          cancellationFee: 0.00,
          deadline: null,
          summaryMessage: 'Free cancellation possible at any time.',
        })
      }

      if (!reservation.arrived_date) {
        return response.badRequest({ message: "The reservation does not have an arrival date." })
      }

      // Calculate free cancellation deadline
      // const arrivalDate = DateTime.fromJSDate(new Date(reservation.arrived_date))
      const arrivalDate = reservation.arrived_date
      if (!arrivalDate.isValid) {
        return response.badRequest({ message: 'Invalid arrival date format.' })
      }
      const freeCancellationDeadline = arrivalDate.minus({ [policy.free_cancellation_period_unit]: policy.free_cancellation_periodValue })

      const now = DateTime.now()
      const isFreeCancellationPossible = now <= freeCancellationDeadline

      let cancellationFee = 0.00
      let feeDescription = 'Gratuit'

      if (!isFreeCancellationPossible) {
        switch (policy.cancellation_fee_type) {
          case 'fixed':
            cancellationFee = parseFloat(`${policy.cancellation_fee_value || 0}`)
            feeDescription = `$${cancellationFee} (fixed fee)`
            break
          case 'percentage':
            cancellationFee =
              (reservation.final_amount || 0) * ((policy.cancellation_fee_value || 0) / 100)
            feeDescription = `${policy.cancellation_fee_value}% of the total amount`
            break
          case 'first_night':
            cancellationFee = reservation.reservationServiceProducts.reduce(
              (total, p) => total + (parseFloat(`${p.rate_per_night}`) || 0),
              0
            )
            feeDescription = `The amount of the first night ($${cancellationFee})`
            break
        }
      }

      const summaryMessage = isFreeCancellationPossible
        ? `Free cancellation possible until ${freeCancellationDeadline.toFormat('dd/MM/yyyy HH:mm')}.`
        : `A cancellation fee applies: ${feeDescription}. The deadline for free cancellation was ${freeCancellationDeadline.toFormat('dd/MM/yyyy HH:mm')}.`

      return response.ok({
        isFreeCancellationPossible,
        cancellationFee: isFreeCancellationPossible ? 0 : cancellationFee,
        deadline: freeCancellationDeadline.toISO(),
        summaryMessage,
        policyName: policy.policy_name,
      })
    } catch (error) {
      console.error('Error getting cancellation summary:', error)
      return response.internalServerError({
        message: 'Failed to get cancellation summary',
        error: error.message,
      })
    }
  }



  /**
   * Cancel a reservation, apply cancellation policy, and create a refund if necessary.
   * @param {HttpContext} ctx
   */
  public async cancelReservation(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const reservationId = params.id
    const { reason = 'Cancelled by user' } = request.body()

    const trx = await db.transaction()

    try {
      // 1. Find the reservation and its related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('service')
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found.' })
      }

      // 2. Check if cancellation is allowed
      if (
        [ReservationStatus.CANCELLED, ReservationStatus.CHECKED_OUT, ReservationStatus.CHECKED_IN].includes(
          reservation.status as ReservationStatus
        )
      ) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot cancel a reservation with status '${reservation.status}'.`,
        })
      }

      // 3. Find the applicable cancellation policy
      const policy = await CancellationPolicy.query({ client: trx })
        .where('service_id', reservation.service_id)
        .orderBy('created_at', 'desc')
        .first()

      // Handle case where no policy is defined (default to full refund)
      if (!policy) {
        reservation.status = ReservationStatus.CANCELLED
        reservation.cancellation_reason = reason
        reservation.last_modified_by = auth.user!.id

        const totalPaid = reservation.paid_amount || 0
        if (totalPaid > 0) {
          await Refund.create(
            {
              service_id: reservation.service_id,
              reservation_id: reservation.id,
              refund_amount: totalPaid,
              reason: 'Full refund: No cancellation policy found.',
              status: 'processed',
              refund_date: DateTime.now(),
              refund_method: 'automatic',
              processed_by_user_id: auth.user!.id,
            },
            { client: trx }
          )

          reservation.payment_status = 'refunded'
        }
        await reservation.save()
        // const resServices = await ReservationServiceProduct.query()
        //   .where('reservation_id', params.id)
        //   .preload('serviceProduct');
        await LoggerService.log({
          actorId: auth.user!.id,
          action: 'CANCEL',
          entityType: 'Reservation',
          entityId: reservation.id,
          description: `Reservation #${reservation.id} cancelled. No policy found, full refund processed.`,
          ctx: ctx,
        })

        await trx.commit()
        return response.ok({
          message:
            'Reservation cancelled successfully. No policy was found, a full refund has been issued.',
        })
      }

      // 4. Calculate cancellation fee based on policy
      let cancellationFee = 0
      const now = DateTime.now()

      if (!reservation.arrived_date) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation is missing an arrival date.' })
      }

      // const hoursUntilCheckIn = DateTime.fromJSDate(new Date(reservation.arrived_date)).diff(now, 'hours').hours
      const hoursUntilCheckIn = reservation.arrived_date.diff(now, 'hours').hours
      const freeCancellationHours =
        policy.free_cancellation_period_unit === 'days'
          ? policy.free_cancellation_periodValue * 24
          : policy.free_cancellation_periodValue

      if (hoursUntilCheckIn < freeCancellationHours) {
        switch (policy.cancellation_fee_type) {
          case 'fixed':
            cancellationFee = policy.cancellation_fee_value || 0
            break
          case 'percentage':
            cancellationFee = (reservation.final_amount || 0) * ((policy.cancellation_fee_value || 0) / 100)
            break
          case 'first_night':
            const reservationProducts = await ReservationServiceProduct.query({ client: trx }).where(
              'reservation_id',
              reservation.id
            )
            cancellationFee = reservationProducts.reduce(
              (total, p) => total + (p.rate_per_night || 0),
              0
            )
            break
        }
      }

      // 5. Calculate refund and update reservation
      const totalPaid = reservation.paid_amount || 0
      const refundAmount = Math.max(0, totalPaid - cancellationFee)

      reservation.status = ReservationStatus.CANCELLED
      reservation.cancellation_reason = reason
      reservation.last_modified_by = auth.user!.id

      if (refundAmount > 0) {
        await Refund.create(
          {
            service_id: reservation.service_id,
            reservation_id: reservation.id,
            refund_amount: refundAmount,
            reason: `Cancellation fee applied: ${cancellationFee}.`,
            status: 'processed',
            refund_date: DateTime.now(),
            refund_method: 'automatic',
            processed_by_user_id: auth.user!.id,
          },
          { client: trx }
        )
        reservation.payment_status = 'refunded'
      } else if (totalPaid > 0) {
        reservation.payment_status = 'paid' // Kept as paid since the fee covers the payment
      }
      await reservation.save()
      const resServices = await ReservationServiceProduct.query()
        .where('reservation_id',reservationId)
      for (const resService of resServices) {
        resService.status = ReservationProductStatus.CANCELLED;
        resService.last_modified_by = auth.user!.id;
        await resService.save()
        const serviceProduct = await ServiceProduct.find(resService.service_product_id);
        if (serviceProduct) {
          serviceProduct.status = 'available';
          serviceProduct.last_modified_by = auth.user!.id;
          await serviceProduct.save();
        }
        await LoggerService.log({
          actorId: auth.user!.id,
          action: 'CANCEL',
          entityType: 'ReservationServiceProduct',
          entityId: resService.id,
          description: `Reservation #${resService.id} cancelled.`,
          ctx: ctx,
        })
      }

      // 6. Log and commit
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CANCEL',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} cancelled. Fee: ${cancellationFee}. Refund: ${refundAmount}.`,
        ctx: ctx,
      })

      await trx.commit()

      return response.ok({
        message: `Reservation cancelled. Fee: ${cancellationFee}. Refund issued: ${refundAmount}.`,
        cancellationFee: cancellationFee,
        refundAmount: refundAmount,
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error cancelling reservation:', error)
      return response.internalServerError({
        message: 'Failed to cancel reservation.',
        error: error.message,
      })
    }
  }

  public async searchReservations({ request, response }: HttpContext) {
    try {
      const {
        searchText = '',
        status = '',
        roomType = '',
        checkInDate = '',
        checkOutDate = '',
      } = request.qs()
      const params = request.params()

      const query = Reservation.query()

      // 1. Filter by searchText (guest name, email, reservation number, etc.)
      if (searchText) {
        query.where((builder) => {
          builder
            .where('reservation_number', 'like', `%${searchText}%`)
            .orWhere('group_name', 'like', `%${searchText}%`)
            .orWhere('company_name', 'like', `%${searchText}%`)
            .orWhereHas('user', (userQuery) => {
              userQuery
                .where('first_name', 'like', `%${searchText}%`)
                .orWhere('last_name', 'like', `%${searchText}%`)
                .orWhere('email', 'like', `%${searchText}%`)
                .orWhere('phone_number', 'like', `%${searchText}%`)
            })
        })
      }

      // 2. Filter by status
      if (status) {
        query.where('status', status)
      }

      // 3. Filter by date range (check for overlapping reservations)
      if (checkInDate && checkOutDate) {
        const startDate = DateTime.fromISO(checkInDate).toISODate()
        const endDate = DateTime.fromISO(checkOutDate).toISODate()

        if (startDate && endDate) {
          // A reservation overlaps if its start is before the search's end
          // AND its end is after the search's start.
          query.where('arrived_date', '<=', endDate).andWhere('depart_date', '>=', startDate)
        }
      }

      // 4. Filter by roomType (product name)
      if (roomType) {
        query.whereHas('reservationRooms', (rspQuery) => {
          rspQuery.whereHas('room', (spQuery) => {
            spQuery.where('room_name', 'like', `%${roomType}%`)
          })
        })
      }

      // Preload related data for the response
      query.andWhere('hotel_id', params.id)
        .whereNotNull('hotel_id')
        .preload('user')
        .preload('guest')
        .preload('roomType')
        .preload('bookingSource')
        .preload('ratePlan')
        .preload('discount')


        //.preload('hotel')
        .preload('reservationRooms', (rspQuery) => {
          rspQuery.preload('room')
        })
        .orderBy('created_at', 'desc')
        .limit(50)

      const reservations = await query

      return response.ok(reservations)
    } catch (error) {
      logger.error('Error searching reservations: %o', error)
      return response.internalServerError({
        message: 'An error occurred while searching for reservations.',
        error: error.message,
      })
    }
  }

  public async getHotelInvoiceData(ctx: HttpContext) {
    const { params, response, logger } = ctx
    try {
      const reservationId = Number.parseInt(params.id, 10)

      if (isNaN(reservationId)) {
        return response.badRequest({ message: 'Invalid Reservation ID.' })
      }

      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('user')
        .preload('service')
        .preload('payments')
        .preload('reservationServiceProducts', (rspQuery) => {
          rspQuery.preload('serviceProduct', (spQuery) => {
            spQuery.preload('productType')
          })
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      const { user, service, payments, reservationServiceProducts } = reservation
      const amenityBookings = await AmenityBooking.query()
        .where('reservation_id', reservationId)
        .preload('items', (query) => {
          query.preload('amenityProduct')
        })

      // 1. Hotel Data
      let hotelAddressParts = { address: '', city: '', state: '', zip: '' }
      try {
        if (service.address_service) {
          const parsedAddress = JSON.parse(service.address_service)
          hotelAddressParts.address = parsedAddress.text || ''
          hotelAddressParts.city = parsedAddress.city || ''
          hotelAddressParts.state = parsedAddress.state || ''
          hotelAddressParts.zip = parsedAddress.zip || ''
        }
      } catch (e) {
        if (typeof service.address_service === 'string') {
          hotelAddressParts.address = service.address_service
        }
      }
      const hotel = {
        name: service.name,
        address: hotelAddressParts.address,
        city: hotelAddressParts.city,
        state: hotelAddressParts.state,
        zip: hotelAddressParts.zip,
        phone: service.phone_number_service,
        email: service.email_service,
        website: service.website,
      }

      // 2. Guest Data
      const guest = {
        firstName: user.first_name,
        lastName: user.last_name,
        address: user.address,
        city: user.city,
        state: user.country,
        zip: '',
        phone: user.phone_number,
        email: user.email,
        passportId: user.national_id_number,
      }

      // 3. Dates & Nights
      const checkinDate = (reservation.check_in_date ?? reservation.arrived_date)?.toISODate() ?? null
      const checkinTime =
        (reservation.check_in_date ?? reservation.arrived_date)?.toISOTime({
          suppressSeconds: true,
          includeOffset: false,
        }) ?? null
      const checkoutDate =
        (reservation.check_out_date ?? reservation.depart_date)?.toISODate() ?? null
      const checkoutTime =
        (reservation.check_out_date ?? reservation.depart_date)?.toISOTime({
          suppressSeconds: true,
          includeOffset: false,
        }) ?? null

      const arrival = reservation.arrived_date
      const departure = reservation.depart_date
      let nights = 0
      if (arrival && departure && departure > arrival) {
        // Use Math.ceil to ensure that even a fraction of a day counts as a full night.
        nights = Math.ceil(departure.diff(arrival, 'days').days)
      } else {
        nights = reservation.number_of_nights ?? 0
      }

      // 4. Tax Rates from Service
      const vatHospitalityRate = service.vat_hospitality ?? 0
      const touristTaxPerNight = service.tourist_tax ?? 0
      const generalVatRate = service.general_vat ?? 0

      // 5. Rooms and Room Tax Calculation
      let totalVatHospitality = 0
      let totalTouristTax = 0
      let subtotalRoomsBeforeTax = 0

      const rooms = reservationServiceProducts.map((rsp) => {
        const ratePerNight = parseFloat(String(rsp.rate_per_night ?? 0))
        const totalRoomPrice = ratePerNight * nights

        const touristTaxForRoom = touristTaxPerNight * nights
        totalTouristTax += touristTaxForRoom

        const priceBeforeTouristTax = totalRoomPrice - touristTaxForRoom
        const basePriceForRoom = priceBeforeTouristTax / (1 + vatHospitalityRate / 100)
        const vatHospitalityForRoom = priceBeforeTouristTax - basePriceForRoom
        totalVatHospitality += vatHospitalityForRoom

        subtotalRoomsBeforeTax += basePriceForRoom

        return {
          type: rsp.serviceProduct.productType?.name ?? 'N/A',
          number: rsp.serviceProduct.product_name,
          rate: ratePerNight,
          nights: nights,
          total: totalRoomPrice,
        }
      })

      // 6. Services (Amenities) and Service Tax Calculation
      let totalGeneralVat = 0
      let subtotalServicesBeforeTax = 0

      const servicesForInvoice = amenityBookings.map((booking) => {
        const bookingTotal = parseFloat(String(booking.totalAmount ?? 0))
        const basePriceForBooking = bookingTotal / (1 + generalVatRate / 100)
        const generalVatForBooking = bookingTotal - basePriceForBooking
        totalGeneralVat += generalVatForBooking
        subtotalServicesBeforeTax += basePriceForBooking

        return {
          totalAmount: bookingTotal,
          amenityOrderNumber: booking.amenityOrderNumber,
          items: booking.items.map((item) => ({
            amenityName: item.amenityProduct.name,
            quantity: item.quantity,
            price: item.pricePerUnit,
            total:
              parseFloat(String(item.quantity ?? 0)) * parseFloat(String(item.pricePerUnit ?? 0)),
          })),
        }
      })

      // 7. Consolidate Taxes
      const taxes = []
      if (totalVatHospitality > 0) {
        taxes.push({
          description: `TVA sur Hébergement (${vatHospitalityRate}%)`,
          rate: vatHospitalityRate,
          amount: parseFloat(totalVatHospitality.toFixed(2)),
        })
      }
      if (totalTouristTax > 0) {
        taxes.push({
          description: `Taxe de séjour (${touristTaxPerNight} par nuit)`,
          rate: touristTaxPerNight,
          amount: parseFloat(totalTouristTax.toFixed(2)),
        })
      }
      if (totalGeneralVat > 0) {
        taxes.push({
          description: `TVA sur Services (${generalVatRate}%)`,
          rate: generalVatRate,
          amount: parseFloat(totalGeneralVat.toFixed(2)),
        })
      }

      // 8. Payments
      const paymentDetails = payments.map((p) => {
        let cardType = null,
          cardNumber = null
        if (p.payment_details) {
          try {
            const details = JSON.parse(p.payment_details)
            cardType = details.cardType || null
            cardNumber = details.cardNumber ? `**** **** **** ${details.cardNumber.slice(-4)}` : null
          } catch (e) {
            /* ignore if not json */
          }
        }
        return {
          method: p.payment_method,
          cardType,
          cardNumber,
          transactionId: p.transaction_id,
          amount: p.amount_paid,
          description: p.notes,
          date: p.payment_date,
        }
      })

      // 9. Notes
      const notes = reservation.special_requests || reservation.comment || ''

      // 10. Final Invoice Data
      const subtotal = subtotalRoomsBeforeTax

      const invoiceData = {
        hotel,
        guest,
        checkinDate,
        checkinTime,
        checkoutDate,
        checkoutTime,
        nights,
        rooms,
        services: servicesForInvoice,
        taxes,
        payments: paymentDetails,
        notes,
        invoiceNumber: reservation.reservation_number,
        issueDate: DateTime.now().toISODate(),
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalTax: parseFloat((totalVatHospitality + totalTouristTax + totalGeneralVat).toFixed(2)),
        total: parseFloat(String(reservation.final_amount ?? 0)),
        amountPaid: parseFloat(String(reservation.paid_amount ?? 0)),
        balanceDue: parseFloat(String(reservation.remaining_amount ?? 0)),
      }

      return response.ok(invoiceData)
    } catch (error) {
      logger.error('Error fetching invoice data: %o', error)
      return response.internalServerError({
        message: 'Failed to fetch invoice data',
        error: error.message,
      })
    }
  }

/**
 * Create reservation
 */


public async saveReservation(ctx: HttpContext) {
  const { request, auth, response } = ctx

  try {
    const data = request.body() as ReservationData

    // Input validation
    if (!data) {
      return response.badRequest({
        success: false,
        message: 'No data received'
      })
    }

    // Validate required fields
    if (!data.hotel_id || !data.arrived_date || !data.depart_date || !data.rooms || data.rooms.length === 0) {
      return response.badRequest({
        success: false,
        message: 'Missing required fields: hotel_id, arrived_date, depart_date, or rooms'
      })
    }

    // Validate date format and logic
    const arrivedDate = DateTime.fromISO(data.arrived_date)
    const departDate = DateTime.fromISO(data.depart_date)
    
    if (!arrivedDate.isValid || !departDate.isValid) {
      return response.badRequest({
        success: false,
        message: 'Invalid date format. Use ISO format (YYYY-MM-DD)'
      })
    }
    
    if (departDate <= arrivedDate) {
      return response.badRequest({
        success: false,
        message: 'Departure date must be after arrival date'
      })
    }

    const trx = await db.transaction()

    try {
      // Calculate number of nights
      const numberOfNights = Math.ceil(departDate.diff(arrivedDate, 'days').days)
      
      // Validate business logic via service
      const validationErrors = ReservationService.validateReservationData(data)
      if (validationErrors.length > 0) {
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: validationErrors.join(', ')
        })
      }

      // Create or find guest
      const guest = await ReservationService.createOrFindGuest(data, trx)

      // Generate reservation numbers
      const confirmationNumber = generateConfirmationNumber()
      const reservationNumber = generateReservationNumber()

      // Calculate guest totals
      const totalAdults = data.rooms.reduce((sum: number, room: any) => sum + (parseInt(room.adult_count) || 0), 0)
      const totalChildren = data.rooms.reduce((sum: number, room: any) => sum + (parseInt(room.child_count) || 0), 0)
      
      // Validate room availability
      for (const room of data.rooms) {
        if (room.room_id) {
          const existingReservation = await ReservationRoom.query({ client: trx })
            .where('roomId', room.room_id)
            .where('status', 'reserved')
            .where((query) => {
              query.whereBetween('checkInDate', [arrivedDate.toISODate(), departDate.toISODate()])
                .orWhereBetween('checkOutDate', [arrivedDate.toISODate(), departDate.toISODate()])
            })
            .first()
            
          if (existingReservation) {
            await trx.rollback()
            return response.badRequest({
              success: false,
              message: `Room ${room.room_id} is not available for the selected dates`
            })
          }
        }
      }

      // Create reservation
      const reservation = await Reservation.create({
        hotel_id: data.hotel_id,
        user_id: guest.id,
        arrived_date: arrivedDate,
        depart_date: departDate,
        check_in_date: data.arrived_time ? DateTime.fromISO(`${data.arrived_date}T${data.arrived_time}`) : arrivedDate,
        check_out_date: data.depart_time ? DateTime.fromISO(`${data.depart_date}T${data.depart_time}`) : departDate,
        status: data.status || ReservationStatus.PENDING,
        guest_count: totalAdults + totalChildren,
        total_amount: parseFloat(data.total_amount) || 0,
        tax_amount: parseFloat(data.tax_amount) || 0,
        final_amount: parseFloat(data.final_amount) || parseFloat(data.total_amount) || 0,
        confirmation_number: confirmationNumber,
        reservation_number: reservationNumber,
        number_of_nights: numberOfNights,
        paid_amount: parseFloat(data.paid_amount) || 0,
        remaining_amount: parseFloat(data.remaining_amount) || (parseFloat(data.final_amount) - parseFloat(data.paid_amount || '0')),
        reservation_type: data.reservation_type || 'online',
        booking_source: data.booking_source || 'direct',
        source_of_business: data.business_source,
        payment_status: (() => {
          const finalAmount = parseFloat(data.final_amount) || 0
          const paidAmount = parseFloat(data.paid_amount) || 0
          if (paidAmount >= finalAmount) return 'paid'
          if (paidAmount > 0) return 'partially_paid'
          return 'unpaid'
        })(),
        created_by: auth.user?.id || data.created_by
      }, { client: trx })

      // 6. Réservations de chambres
      for (const room of data.rooms) {
        await ReservationRoom.create({
          reservationId: reservation.id,
          roomTypeId: room.room_type_id,
          roomId: room.room_id!,
          // guestId: guest.id,
          checkInDate: DateTime.fromISO(data.arrived_date),
          checkOutDate: DateTime.fromISO(data.depart_date),
          nights: data.number_of_nights,
          adults: room.adult_count,
          children: room.child_count,
          roomRate: room.room_rate,
          totalRoomCharges: room.room_rate * data.number_of_nights,
          // taxAmount: room.room_rate * data.number_of_nights * 0.15,
          // netAmount: room.room_rate * data.number_of_nights * 1.15,
          status: 'reserved',
          createdBy: data.created_by,
        }, { client: trx })
      }

      // 7. Logging
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'CREATE',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was created for customer ${guest.firstName}.`,
        ctx,
      })

      await trx.commit()
      return response.created({
        success: true,
        reservationId: reservation.id,
        confirmationNumber,
        message: 'Reservation created successfully'
      })

    } catch (error) {
      await trx.rollback()
      console.error('Transaction error:', error)
      throw error
    }

  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la réservation:', error)
    return response.internalServerError({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue lors de la sauvegarde'
    })
  }
}






}
