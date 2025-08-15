
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
import Guest from '#models/guest'
import ReservationFolioService from '#services/reservation_folio_service'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import PaymentMethod from '#models/payment_method'


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
        .preload('guests', (query) => {
          query.pivotColumns([
            'is_primary', 'guest_type', 'room_assignment', 
            'special_requests', 'dietary_restrictions', 'accessibility',
            'emergency_contact', 'emergency_phone', 'notes'
          ])
        })
        .preload('folios', (query) => {
          query.preload('transactions')
        })
        
        .preload('bookingSource')
        .preload('reservationRooms', (query) => {
          query.preload('room')
          .preload('roomRates')
          
          .preload('roomType')
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      // Calculate balance summary from folio transactions
      const balanceSummary = this.calculateBalanceSummary(reservation.folios)
      
      // Determine available actions based on reservation status
      const availableActions = this.getAvailableActions(reservation)

      const result = {
        ...reservation.toJSON(),
        balanceSummary,
        availableActions
      }

      return response.ok(result)
    } catch (error) {
      console.error('Error fetching reservation details:', error)
      return response.internalServerError({ message: 'An error occurred while fetching the reservation.' })
    }
  }

  /**
   * Calculate balance summary from folio transactions
   */
  private calculateBalanceSummary(folios: any[]) {
    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0

    folios.forEach(folio => {
      if (folio.transactions) {
        folio.transactions.forEach((transaction: any) => {
          const amount = parseFloat(transaction.amount) || 0
          
          switch (transaction.transactionType) {
            case 'charge':
              totalCharges += amount
              break
            case 'payment':
              totalPayments += amount
              break
            case 'adjustment':
              totalAdjustments += amount
              break
            case 'tax':
              totalTaxes += amount
              break
            case 'discount':
              totalDiscounts += Math.abs(amount) // Discounts are typically negative
              break
            case 'refund':
              totalPayments -= amount // Refunds reduce payments
              break
          }
          
          // Add service charges and taxes from transaction details
          if (transaction.serviceChargeAmount) {
            totalServiceCharges += parseFloat(transaction.serviceChargeAmount) || 0
          }
          if (transaction.taxAmount) {
            totalTaxes += parseFloat(transaction.taxAmount) || 0
          }
        })
      }
    })

    const outstandingBalance = totalCharges + totalTaxes + totalServiceCharges - totalPayments - totalDiscounts + totalAdjustments

    return {
      totalCharges: parseFloat(totalCharges.toFixed(2)),
      totalPayments: parseFloat(totalPayments.toFixed(2)),
      totalAdjustments: parseFloat(totalAdjustments.toFixed(2)),
      totalTaxes: parseFloat(totalTaxes.toFixed(2)),
      totalServiceCharges: parseFloat(totalServiceCharges.toFixed(2)),
      totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
      outstandingBalance: parseFloat(outstandingBalance.toFixed(2)),
      balanceStatus: outstandingBalance > 0 ? 'outstanding' : outstandingBalance < 0 ? 'credit' : 'settled'
    }
  }

  /**
   * Get available actions based on reservation status
   */
  private getAvailableActions(reservation: any) {
    const actions = []
    const status = reservation.status?.toLowerCase() || reservation.reservation_status?.toLowerCase() 
    const currentDate = new Date()
    const arrivalDate = new Date(reservation.scheduled_arrival_date || reservation.check_in_date)
    const departureDate = new Date(reservation.scheduled_departure_date || reservation.check_out_date)
    
    // Check-in: Available for confirmed reservations on or after arrival date
    if (['confirmed', 'guaranteed', 'pending'].includes(status) && currentDate >= arrivalDate) {
      actions.push({
        action: 'check_in',
        label: 'Check-in',
        description: 'Register guest arrival and assign room',
        available: true,
        route: `/reservations/${reservation.id}/check-in`
      })
    }

    // Add Payment: Available for all active reservations
    if (!['cancelled', 'no-show', 'voided'].includes(status)) {
      actions.push({
        action: 'add_payment',
        label: 'Add Payment',
        description: 'Record a payment to reduce outstanding balance',
        available: true,
        route: `/reservations/${reservation.id}/add-payment`
      })
    }

    // Amend Stay: Available before or during stay
    if (['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in'].includes(status)) {
      actions.push({
        action: 'amend_stay',
        label: 'Amend Stay',
        description: 'Modify reservation details, dates, or room type',
        available: true,
        route: `/reservations/${reservation.id}/amend-stay`
      })
    }

    // Room Move: Available during stay (checked-in status)
    if (['checked-in', 'checked_in'].includes(status)) {
      actions.push({
        action: 'room_move',
        label: 'Room Move',
        description: 'Move guest to a different room',
        available: true,
        route: `/reservations/${reservation.id}/room-move`
      })
    }

    // Exchange Room: Similar to room move
    if (['checked-in', 'checked_in'].includes(status)) {
      actions.push({
        action: 'exchange_room',
        label: 'Exchange Room',
        description: 'Exchange guest room assignment',
        available: true,
        route: `/reservations/${reservation.id}/exchange-room`
      })
    }

    // Stop Room Move: Available if there's a pending room move
    if (['checked-in', 'checked_in'].includes(status)) {
      actions.push({
        action: 'stop_room_move',
        label: 'Stop Room Move',
        description: 'Cancel pending room change',
        available: false, // Would need to check if there's a pending move
        route: `/reservations/${reservation.id}/stop-room-move`
      })
    }

    // Inclusion List: Available during reservation or stay
    if (['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in'].includes(status)) {
      actions.push({
        action: 'inclusion_list',
        label: 'Inclusion List',
        description: 'Add or modify included amenities and services',
        available: true,
        route: `/reservations/${reservation.id}/inclusion-list`
      })
    }

    // Cancel Reservation: Available before check-in
    if (['confirmed', 'guaranteed', 'pending'].includes(status) && currentDate < arrivalDate) {
      actions.push({
        action: 'cancel_reservation',
        label: 'Cancel Reservation',
        description: 'Cancel the reservation with applicable fees',
        available: true,
        route: `/reservations/${reservation.id}/cancel`
      })
    }

    // No Show: Available after scheduled arrival time for non-arrived guests
    if (['confirmed', 'guaranteed', 'pending'].includes(status) && currentDate > arrivalDate) {
      actions.push({
        action: 'no_show',
        label: 'No Show',
        description: 'Mark reservation as no-show and apply fees',
        available: true,
        route: `/reservations/${reservation.id}/no-show`
      })
    }

    // Void Reservation: Available for recent reservations with errors
    if (['confirmed', 'guaranteed', 'pending'].includes(status)) {
      actions.push({
        action: 'void_reservation',
        label: 'Void Reservation',
        description: 'Completely remove reservation from system',
        available: true,
        route: `/reservations/${reservation.id}/void`
      })
    }

    // Unassign Room: Available for confirmed reservations with assigned rooms
    if (['confirmed', 'guaranteed', 'pending'].includes(status)) {
      actions.push({
        action: 'unassign_room',
        label: 'Unassign Room',
        description: 'Remove specific room assignment',
        available: true,
        route: `/reservations/${reservation.id}/unassign-room`
      })
    }

    return actions
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
            .orWhere('source_of_business', 'like', `%${searchText}%`)
            .orWhereHas('guest', (userQuery) => {
              userQuery
               .where('first_name', 'like', `%${searchText}%`)
                .orWhere('last_name', 'like', `%${searchText}%`)
                .orWhere('email', 'like', `%${searchText}%`)
                .orWhere('phone_primary', 'like', `%${searchText}%`)

            })
            .orWhereHas('reservationRooms', (roomQuery) => {
               roomQuery.whereHas('room', (roomSubQuery) => {
                 roomSubQuery.where('room_number', 'like', `%${searchText}%`)
               })
               .orWhereHas('roomType', (roomTypeQuery) => {
                 roomTypeQuery.where('room_type_name', 'like', `%${searchText}%`)
               })
             })
            .orWhereHas('ratePlan', (ratePlanQuery) => {
              ratePlanQuery.where('plan_name', 'like', `%${searchText}%`)
            })
            .orWhereHas('bookingSource', (bookingSourceQuery) => {
              bookingSourceQuery.where('source_name', 'like', `%${searchText}%`)
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
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions')
        })
        //.preload('hotel')
        .preload('reservationRooms', (rspQuery) => {
          rspQuery.preload('room')
        })
        .orderBy('created_at', 'desc')
        .limit(50)

      const reservations = await query
      
      // Calculate balanceSummary and availableActions for each reservation
      const enrichedReservations = reservations.map(reservation => {
        const balanceSummary = this.calculateBalanceSummary(reservation.folios)
        const availableActions = this.getAvailableActions(reservation)
        
        return {
          ...reservation.toJSON(),
          balanceSummary,
          availableActions
        }
      })

      // Calculate statistics
      const today = DateTime.now().toISODate()
      const hotelId = params.id

      // Total reservations count (with same filters)
      const totalQuery = Reservation.query().where('hotel_id', hotelId).whereNotNull('hotel_id')
      if (searchText) {
        totalQuery.where((builder) => {
          builder
            .where('reservation_number', 'like', `%${searchText}%`)
            .orWhere('group_name', 'like', `%${searchText}%`)
            .orWhere('company_name', 'like', `%${searchText}%`)
            .orWhere('source_of_business', 'like', `%${searchText}%`)
            .orWhereHas('guest', (userQuery) => {
              userQuery
               .where('first_name', 'like', `%${searchText}%`)
                .orWhere('last_name', 'like', `%${searchText}%`)
                .orWhere('email', 'like', `%${searchText}%`)
                .orWhere('phone_primary', 'like', `%${searchText}%`)
            })
            .orWhereHas('reservationRooms', (roomQuery) => {
               roomQuery.whereHas('room', (roomSubQuery) => {
                 roomSubQuery.where('room_number', 'like', `%${searchText}%`)
               })
               .orWhereHas('roomType', (roomTypeQuery) => {
                 roomTypeQuery.where('room_type_name', 'like', `%${searchText}%`)
               })
             })
            .orWhereHas('ratePlan', (ratePlanQuery) => {
              ratePlanQuery.where('plan_name', 'like', `%${searchText}%`)
            })
            .orWhereHas('bookingSource', (bookingSourceQuery) => {
              bookingSourceQuery.where('source_name', 'like', `%${searchText}%`)
            })
        })
      }
      if (status) {
        totalQuery.where('status', status)
      }
      if (checkInDate && checkOutDate) {
        const startDate = DateTime.fromISO(checkInDate).toISODate()
        const endDate = DateTime.fromISO(checkOutDate).toISODate()
        if (startDate && endDate) {
          totalQuery.where('arrived_date', '<=', endDate).andWhere('depart_date', '>=', startDate)
        }
      }
      if (roomType) {
        totalQuery.whereHas('reservationRooms', (rspQuery) => {
          rspQuery.whereHas('room', (spQuery) => {
            spQuery.where('room_name', 'like', `%${roomType}%`)
          })
        })
      }
      const totalReservations = await totalQuery.count('* as total')

      // Arrivals today
      const arrivalsQuery = Reservation.query()
        .where('hotel_id', hotelId)
        .whereNotNull('hotel_id')
        .where('arrived_date', today)
        .whereIn('status', ['confirmed', 'checked_in'])
      const arrivals = await arrivalsQuery.count('* as total')

      // Departures today
      const departuresQuery = Reservation.query()
        .where('hotel_id', hotelId)
        .whereNotNull('hotel_id')
        .where('depart_date', today)
        .whereIn('status', ['checked_in', 'checked_out'])
      const departures = await departuresQuery.count('* as total')

      // In-house (currently checked in)
      const inHouseQuery = Reservation.query()
        .where('hotel_id', hotelId)
        .whereNotNull('hotel_id')
        .where('status', 'checked_in')
        .where('arrived_date', '<=', today)
        .where('depart_date', '>', today)
      const inHouse = await inHouseQuery.count('* as total')

      const statistics = {
        totalReservations: totalReservations[0].$extras.total,
        arrivals: arrivals[0].$extras.total,
        departures: departures[0].$extras.total,
        inHouse: inHouse[0].$extras.total
      }

      return response.ok({
        reservations: enrichedReservations,
        statistics
      })
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

      // Create or find primary guest
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
      logger.info('Creating reservation with data: %o', guest)
      const reservation = await Reservation.create({
        hotel_id: data.hotel_id,
        user_id: auth.user?.id || data.created_by,
        // guest_id: guest.id, // Removed - using reservation_guests pivot table instead
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
        payment_status: 'pending',
        created_by: auth.user?.id || data.created_by
      }, { client: trx })

      // Vérifier que la réservation a bien été créée avec un ID
      logger.info('Réservation créée avec ID:', reservation.id)
      if (!reservation.id) {
        throw new Error('La réservation n\'a pas pu être créée correctement - ID manquant')
      }

      // 6. Process multiple guests for the reservation
      const { primaryGuest, allGuests } = await ReservationService.processReservationGuests(
        reservation.id,
        data,
        trx
      )

      // 6.1. Mettre à jour la réservation avec l'ID du primary guest
      await reservation.merge({ guest_id: primaryGuest.id }).save({ client: trx })
      logger.info('Réservation mise à jour avec primary guest ID:', primaryGuest.id)

      // 7. Réservations de chambres
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
          roomRateId : room.room_rate_id,
          totalRoomCharges: room.room_rate * data.number_of_nights,
          // taxAmount: room.room_rate * data.number_of_nights * 0.15,
          // netAmount: room.room_rate * data.number_of_nights * 1.15,
          status: 'reserved',
          createdBy: data.created_by,
        }, { client: trx })
      }

      // 8. Logging
      const guestCount = allGuests.length
      const guestDescription = guestCount > 1
        ? `${primaryGuest.firstName} ${primaryGuest.lastName} and ${guestCount - 1} other guest(s)`
        : `${primaryGuest.firstName} ${primaryGuest.lastName}`

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'CREATE',
        entityType: 'Reservation',
        entityId: reservation.id,
        description: `Reservation #${reservation.id} was created for ${guestDescription} (${guestCount} total guests).`,
        ctx,
      })

      // 9. Create folios if reservation is confirmed
      let folios: any[] = []
      if (reservation.status === 'confirmed') {
        try {
          folios = await ReservationFolioService.createFoliosOnConfirmation(
            reservation.id,
            auth.user?.id!
          )
          
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'CREATE_FOLIOS',
            entityType: 'Reservation',
            entityId: reservation.id,
            description: `Created ${folios.length} folio(s) with room charges for confirmed reservation #${reservation.id}.`,
            ctx,
          })
        } catch (folioError) {
          logger.info('errre',folioError)
          console.error('Error creating folios for new confirmed reservation:', folioError)
          // Don't fail the reservation creation if folio creation fails
        }
      }

      await trx.commit()
      const responseData: any = {
        success: true,
        reservationId: reservation.id,
        confirmationNumber,
        primaryGuest: {
          id: primaryGuest.id,
          name: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
          email: primaryGuest.email
        },
        totalGuests: allGuests.length,
        guests: allGuests.map(g => ({
          id: g.id,
          name: `${g.firstName} ${g.lastName}`,
          email: g.email
        })),
        message: `Reservation created successfully with ${allGuests.length} guest(s)`
      }

      // Add folio information if folios were created
      if (folios.length > 0) {
        responseData.folios = folios.map(folio => ({
          id: folio.id,
          folioNumber: folio.folioNumber,
          guestId: folio.guestId,
          folioType: folio.folioType
        }))
        responseData.message += ` and ${folios.length} folio(s) with room charges`
      }

      return response.created(responseData)

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


/**
   * Get Guest by hotel_id
   */
async getGuestsByHotel({ params }: HttpContext) {
  const hotelId = params.id
  const guests = await Guest
    .query()
    .whereHas('reservations', (reservationQuery) => {
      reservationQuery.where('hotel_id', hotelId)
    })
  return guests
}


  /**
   * Override the update method to handle reservation confirmation and folio creation
   */
  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const reservationId = params.id
      const data = request.all()
      const oldStatus = await Reservation.query()
        .where('id', reservationId)
        .select('status')
        .first()

      if (!oldStatus) {
        return response.notFound({ message: 'Reservation not found' })
      }

      // Call the parent update method
      const updateResponse = await super.update({ params, request, response, auth })
      
      // Check if status was changed to 'confirmed'
      if (data.status === 'confirmed' && oldStatus.status !== 'confirmed') {
        try {
          // Create folios for all guests with room charges
          const folios = await ReservationFolioService.createFoliosOnConfirmation(
            reservationId,
            auth.user!.id
          )

          // Log the folio creation
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CONFIRM_RESERVATION',
            entityType: 'Reservation',
            entityId: reservationId,
            description: `Reservation #${reservationId} confirmed. Created ${folios.length} folio(s) with room charges.`,
            ctx: { params, request, response, auth },
          })

          // Return success response with folio information
          return response.ok({
            message: 'Reservation confirmed successfully',
            reservation: updateResponse,
            folios: folios.map(folio => ({
              id: folio.id,
              folioNumber: folio.folioNumber,
              guestId: folio.guestId,
              folioType: folio.folioType
            }))
          })
        } catch (folioError) {
          console.error('Error creating folios on confirmation:', folioError)
          // Return the update response even if folio creation fails
          return response.ok({
            message: 'Reservation confirmed but folio creation failed',
            reservation: updateResponse,
            error: folioError.message
          })
        }
      }

      return updateResponse
    } catch (error) {
      console.error('Error updating reservation:', error)
      return response.internalServerError({
        message: 'Error updating reservation',
        error: error.message
      })
    }
  }

  // Reservation Action Methods
  public async addPayment({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    try {
      const reservationId = params.reservationId
      const { amount, paymentMethodId, reference, description, currencyCode = 'USD' } = request.all()

      // Validate required fields
      if (!amount || amount <= 0) {
        await trx.rollback()
        return response.badRequest({ message: 'Valid payment amount is required' })
      }

      if (!paymentMethodId) {
        await trx.rollback()
        return response.badRequest({ message: 'Payment method is required' })
      }

      // Find the reservation
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('folios')
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Validate payment method exists
      const paymentMethod = await PaymentMethod.query({ client: trx })
        .where('id', paymentMethodId)
        .where('hotel_id', reservation.hotelId)
        .where('is_active', true)
        .first()

      if (!paymentMethod) {
        await trx.rollback()
        return response.badRequest({ message: 'Invalid or inactive payment method' })
      }

      // Get or create folio for the reservation
      let folio = reservation.folios.find(f => f.status === 'open')
      if (!folio) {
        // Create a new folio if none exists
        folio = await Folio.create({
          hotelId: reservation.hotelId,
          guestId: reservation.guestId,
          reservationId: reservation.id,
          folioNumber: `F-${reservation.reservationNumber}-${Date.now()}`,
          folioName: `Folio for ${reservation.reservationNumber}`,
          folioType: 'guest',
          status: 'open',
          settlementStatus: 'pending',
          workflowStatus: 'active',
          openedDate: DateTime.now(),
          openedBy: auth.user?.id || 1,
          totalCharges: 0,
          totalPayments: 0,
          totalAdjustments: 0,
          totalTaxes: 0,
          totalServiceCharges: 0,
          totalDiscounts: 0,
          balance: 0,
          creditLimit: 0,
          currencyCode: currencyCode,
          exchangeRate: 1,
          baseCurrencyAmount: 0,
          createdBy: auth.user?.id || 1,
          lastModifiedBy: auth.user?.id || 1
        }, { client: trx })
      }

      // Generate transaction number
      const transactionNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

      // Create payment transaction
      const transaction = await FolioTransaction.create({
        hotelId: reservation.hotelId,
        folioId: folio.id,
        transactionNumber: transactionNumber,
        transactionCode: paymentMethod.methodCode,
        transactionType: 'payment',
        category: 'payment',
        subcategory: paymentMethod.methodType,
        description: description || `Payment via ${paymentMethod.methodName}`,
        amount: -Math.abs(amount), // Negative for payments
        totalAmount: -Math.abs(amount),
        quantity: 1,
        unitPrice: -Math.abs(amount),
        taxAmount: 0,
        taxRate: 0,
        serviceChargeAmount: 0,
        serviceChargeRate: 0,
        discountAmount: 0,
        discountRate: 0,
        netAmount: -Math.abs(amount),
        grossAmount: -Math.abs(amount),
        transactionDate: DateTime.now(),
        transactionTime: DateTime.now().toFormat('HH:mm:ss'),
        postingDate: DateTime.now(),
        serviceDate: DateTime.now(),
        reference: reference || '',
        paymentMethodId: paymentMethodId,
        paymentReference: reference || '',
        guestId: reservation.guestId,
        reservationId: reservation.id,
        currencyCode: currencyCode,
        exchangeRate: 1,
        baseCurrencyAmount: -Math.abs(amount),
        originalAmount: -Math.abs(amount),
        originalCurrency: currencyCode
      }, { client: trx })

      // Update folio totals
      await folio.merge({
        totalPayments: (folio.totalPayments || 0) + Math.abs(amount),
        balance: (folio.balance || 0) - Math.abs(amount),
        lastModifiedBy: auth.user?.id || 1
      }).save({ client: trx })

      // Update reservation payment status if needed
      const updatedFolio = await Folio.query({ client: trx })
        .where('id', folio.id)
        .preload('transactions')
        .first()

      if (updatedFolio) {
        const balance = this.calculateBalanceSummary([updatedFolio])
        let newPaymentStatus = reservation.paymentStatus

        if (balance.outstandingBalance <= 0) {
          newPaymentStatus = 'paid'
        } else if (balance.totalPayments > 0) {
          newPaymentStatus = 'partially_paid'
        }

        if (newPaymentStatus !== reservation.paymentStatus) {
          await reservation.merge({ paymentStatus: newPaymentStatus }).save({ client: trx })
        }
      }

      await trx.commit()

      return response.ok({
        message: 'Payment added successfully',
        reservationId: reservationId,
        transaction: {
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          amount: Math.abs(amount),
          paymentMethod: paymentMethod.methodName,
          reference: reference,
          transactionDate: transaction.transactionDate
        }
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error adding payment:', error)
      return response.badRequest({ 
        message: 'Failed to add payment', 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  public async amendStay({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    try {
      const reservationId = params.reservationId
      const { 
        newArrivalDate, 
        newDepartureDate, 
        newRoomTypeId, 
        newNumAdults, 
        newNumChildren, 
        newSpecialNotes, 
        reason 
      } = request.all()

      // Find the reservation
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .preload('folios', (query) => {
          query.preload('transactions')
        })
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Check if reservation can be amended
      const allowedStatuses = ['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in']
      if (!allowedStatuses.includes(reservation.reservationStatus.toLowerCase())) {
        await trx.rollback()
        return response.badRequest({ 
          message: `Cannot amend reservation with status: ${reservation.reservationStatus}` 
        })
      }

      // Store original values for audit trail
      const originalData = {
        arrivalDate: reservation.scheduledArrivalDate,
        departureDate: reservation.scheduledDepartureDate,
        roomTypeId: reservation.primaryRoomTypeId,
        numAdults: reservation.numAdultsTotal,
        numChildren: reservation.numChildrenTotal,
        specialNotes: reservation.specialNotes
      }

      // Validate new dates if provided
      if (newArrivalDate || newDepartureDate) {
        const arrivalDate = newArrivalDate ? DateTime.fromISO(newArrivalDate) : reservation.scheduledArrivalDate
        const departureDate = newDepartureDate ? DateTime.fromISO(newDepartureDate) : reservation.scheduledDepartureDate

        if (arrivalDate >= departureDate) {
          await trx.rollback()
          return response.badRequest({ message: 'Arrival date must be before departure date' })
        }

        // Check if dates are in the past (except for checked-in reservations)
        if (!['checked-in', 'checked_in'].includes(reservation.reservationStatus.toLowerCase())) {
          if (arrivalDate < DateTime.now().startOf('day')) {
            await trx.rollback()
            return response.badRequest({ message: 'Cannot set arrival date in the past' })
          }
        }
      }

      // Validate new room type if provided
      if (newRoomTypeId) {
        const roomType = await db.from('room_types')
          .where('id', newRoomTypeId)
          .where('hotel_id', reservation.hotelId)
          .first()

        if (!roomType) {
          await trx.rollback()
          return response.badRequest({ message: 'Invalid room type selected' })
        }
      }

      // Update reservation with new details
      const updateData: any = {
        lastModifiedBy: auth.user?.id || 1
      }

      if (newArrivalDate) {
        updateData.scheduledArrivalDate = DateTime.fromISO(newArrivalDate)
      }
      if (newDepartureDate) {
        updateData.scheduledDepartureDate = DateTime.fromISO(newDepartureDate)
      }
      if (newRoomTypeId) {
        updateData.primaryRoomTypeId = newRoomTypeId
      }
      if (newNumAdults !== undefined) {
        updateData.numAdultsTotal = newNumAdults
      }
      if (newNumChildren !== undefined) {
        updateData.numChildrenTotal = newNumChildren
      }
      if (newSpecialNotes !== undefined) {
        updateData.specialNotes = newSpecialNotes
      }

      await reservation.merge(updateData).save({ client: trx })

      // Update reservation rooms if room type changed
      if (newRoomTypeId && reservation.reservationRooms.length > 0) {
        for (const reservationRoom of reservation.reservationRooms) {
          await reservationRoom.merge({
            roomTypeId: newRoomTypeId,
            lastModifiedBy: auth.user?.id || 1
          }).save({ client: trx })
        }
      }

      // Create audit log entry
      const auditData = {
        reservationId: reservation.id,
        action: 'amend_stay',
        performedBy: auth.user?.id || 1,
        originalData: originalData,
        newData: updateData,
        reason: reason || 'Stay amendment requested',
        timestamp: DateTime.now()
      }

      // Log the amendment (you might want to create an audit table for this)
      console.log('Reservation Amendment:', auditData)

      // If there are financial implications, create adjustment transactions
      if (newArrivalDate || newDepartureDate) {
        // Calculate rate difference if dates changed
        // This would require rate calculation logic based on your business rules
        // For now, we'll just log that rate recalculation may be needed
        console.log('Rate recalculation may be required due to date changes')
      }

      await trx.commit()

      // Reload reservation with updated data
      const updatedReservation = await Reservation.query()
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .first()

      return response.ok({
        message: 'Stay amended successfully',
        reservationId: reservationId,
        changes: {
          originalData,
          newData: updateData
        },
        reservation: updatedReservation
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error amending stay:', error)
      return response.badRequest({ 
        message: 'Failed to amend stay', 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  public async roomMove({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    try {
      const reservationId = params.reservationId
      const { newRoomId, reason, effectiveDate } = request.all()

      if (!newRoomId) {
        await trx.rollback()
        return response.badRequest({ message: 'New room ID is required' })
      }

      // Find the reservation with current room assignments
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Check if reservation can be moved
      const allowedStatuses = ['confirmed', 'guaranteed', 'checked-in', 'checked_in']
      if (!allowedStatuses.includes(reservation.reservationStatus.toLowerCase())) {
        await trx.rollback()
        return response.badRequest({ 
          message: `Cannot move room for reservation with status: ${reservation.reservationStatus}` 
        })
      }

      // Find the current active room assignment
      const currentReservationRoom = reservation.reservationRooms.find(rr => 
        rr.status === 'reserved' || rr.status === 'checked_in'
      )

      if (!currentReservationRoom) {
        await trx.rollback()
        return response.badRequest({ message: 'No active room assignment found for this reservation' })
      }

      // Check if trying to move to the same room
      if (currentReservationRoom.roomId === newRoomId) {
        await trx.rollback()
        return response.badRequest({ message: 'Cannot move to the same room' })
      }

      // Validate the new room exists and is available
      const newRoom = await ServiceProduct.query({ client: trx })
        .where('id', newRoomId)
        .where('hotel_id', reservation.hotelId)
        .preload('roomType')
        .first()

      if (!newRoom) {
        await trx.rollback()
        return response.badRequest({ message: 'New room not found or not available in this hotel' })
      }

      // Check if new room is available for the reservation dates
      const moveDate = effectiveDate ? DateTime.fromISO(effectiveDate) : DateTime.now()
      const checkOutDate = reservation.scheduledDepartureDate

      const conflictingReservation = await ReservationRoom.query({ client: trx })
        .where('room_id', newRoomId)
        .where('status', 'reserved')
        .where((query) => {
          query.where((subQuery) => {
            subQuery.where('check_in_date', '<=', moveDate.toISODate())
              .where('check_out_date', '>', moveDate.toISODate())
          })
          .orWhere((subQuery) => {
            subQuery.where('check_in_date', '<', checkOutDate.toISODate())
              .where('check_out_date', '>=', checkOutDate.toISODate())
          })
          .orWhere((subQuery) => {
            subQuery.where('check_in_date', '>=', moveDate.toISODate())
              .where('check_out_date', '<=', checkOutDate.toISODate())
          })
        })
        .first()

      if (conflictingReservation) {
        await trx.rollback()
        return response.badRequest({ 
          message: 'New room is not available for the requested dates' 
        })
      }

      // Check room status
      if (newRoom.status !== 'active' || newRoom.housekeepingStatus === 'dirty' || newRoom.housekeepingStatus === 'maintenance') {
        await trx.rollback()
        return response.badRequest({ 
          message: `New room is not ready. Status: ${newRoom.status}, Housekeeping: ${newRoom.housekeepingStatus}` 
        })
      }

      // Store original room information for audit
      const originalRoomInfo = {
        roomId: currentReservationRoom.roomId,
        roomNumber: currentReservationRoom.room.roomNumber,
        roomType: currentReservationRoom.room.roomType?.roomTypeName
      }

      // Update current reservation room status to indicate move
      await currentReservationRoom.merge({
        status: 'moved_out',
        checkOutDate: moveDate,
        lastModifiedBy: auth.user?.id || 1,
        notes: `Moved to room ${newRoom.roomNumber}. Reason: ${reason || 'Room move requested'}`
      }).save({ client: trx })

      // Create new reservation room record for the new room
      const newReservationRoom = await ReservationRoom.create({
        reservationId: reservation.id,
        roomId: newRoomId,
        roomTypeId: newRoom.roomTypeId,
        checkInDate: moveDate,
        checkOutDate: reservation.scheduledDepartureDate,
        status: reservation.reservationStatus.toLowerCase() === 'checked-in' || reservation.reservationStatus.toLowerCase() === 'checked_in' ? 'checked_in' : 'reserved',
        rateAmount: currentReservationRoom.rateAmount, // Keep same rate
        totalAmount: currentReservationRoom.totalAmount,
        createdBy: auth.user?.id || 1,
        lastModifiedBy: auth.user?.id || 1,
        notes: `Moved from room ${currentReservationRoom.room.roomNumber}. Reason: ${reason || 'Room move requested'}`
      }, { client: trx })

      // Update reservation's primary room type if different
      if (newRoom.roomTypeId !== reservation.primaryRoomTypeId) {
        await reservation.merge({
          primaryRoomTypeId: newRoom.roomTypeId,
          lastModifiedBy: auth.user?.id || 1
        }).save({ client: trx })
      }

      // Create audit log
      const auditData = {
        reservationId: reservation.id,
        action: 'room_move',
        performedBy: auth.user?.id || 1,
        originalRoom: originalRoomInfo,
        newRoom: {
          roomId: newRoomId,
          roomNumber: newRoom.roomNumber,
          roomType: newRoom.roomType?.roomTypeName
        },
        reason: reason || 'Room move requested',
        effectiveDate: moveDate.toISODate(),
        timestamp: DateTime.now()
      }

      console.log('Room Move Audit:', auditData)

      // If there are any charges related to room move, create folio transactions
      // This would depend on hotel policy - some hotels charge for room moves
      // For now, we'll just log that charges may apply
      console.log('Room move completed - check if any charges apply per hotel policy')

      await trx.commit()

      // Reload reservation with updated room assignments
      const updatedReservation = await Reservation.query()
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .first()

      return response.ok({
        message: 'Room move completed successfully',
        reservationId: reservationId,
        moveDetails: {
          fromRoom: originalRoomInfo,
          toRoom: {
            roomId: newRoomId,
            roomNumber: newRoom.roomNumber,
            roomType: newRoom.roomType?.roomTypeName
          },
          effectiveDate: moveDate.toISODate(),
          reason: reason || 'Room move requested'
        },
        reservation: updatedReservation
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error processing room move:', error)
      return response.badRequest({ 
        message: 'Failed to process room move', 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  public async exchangeRoom({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    try {
      const reservationId = params.reservationId
      const { 
        targetReservationId, 
        newRoomId, 
        exchangeType, // 'reservation_swap' or 'room_upgrade_downgrade'
        reason,
        effectiveDate 
      } = request.all()

      if (!exchangeType || !['reservation_swap', 'room_upgrade_downgrade'].includes(exchangeType)) {
        await trx.rollback()
        return response.badRequest({ 
          message: 'Exchange type must be either "reservation_swap" or "room_upgrade_downgrade"' 
        })
      }

      // Find the primary reservation
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Check if reservation can be exchanged
      const allowedStatuses = ['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in']
      if (!allowedStatuses.includes(reservation.reservationStatus.toLowerCase())) {
        await trx.rollback()
        return response.badRequest({ 
          message: `Cannot exchange room for reservation with status: ${reservation.reservationStatus}` 
        })
      }

      // Find current active room assignment
      const currentReservationRoom = reservation.reservationRooms.find(rr => 
        rr.status === 'reserved' || rr.status === 'checked_in'
      )

      if (!currentReservationRoom) {
        await trx.rollback()
        return response.badRequest({ message: 'No active room assignment found for this reservation' })
      }

      const exchangeDate = effectiveDate ? DateTime.fromISO(effectiveDate) : DateTime.now()
      let exchangeResult: any = {}

      if (exchangeType === 'reservation_swap') {
        // Handle room swap between two reservations
        if (!targetReservationId) {
          await trx.rollback()
          return response.badRequest({ message: 'Target reservation ID is required for reservation swap' })
        }

        // Find target reservation
        const targetReservation = await Reservation.query({ client: trx })
          .where('id', targetReservationId)
          .where('hotel_id', reservation.hotelId) // Must be same hotel
          .preload('reservationRooms', (query) => {
            query.preload('room', (roomQuery) => {
              roomQuery.preload('roomType')
            })
          })
          .first()

        if (!targetReservation) {
          await trx.rollback()
          return response.badRequest({ message: 'Target reservation not found or not in same hotel' })
        }

        // Check target reservation status
        if (!allowedStatuses.includes(targetReservation.reservationStatus.toLowerCase())) {
          await trx.rollback()
          return response.badRequest({ 
            message: `Cannot exchange with target reservation status: ${targetReservation.reservationStatus}` 
          })
        }

        // Find target reservation's active room
        const targetReservationRoom = targetReservation.reservationRooms.find(rr => 
          rr.status === 'reserved' || rr.status === 'checked_in'
        )

        if (!targetReservationRoom) {
          await trx.rollback()
          return response.badRequest({ message: 'No active room assignment found for target reservation' })
        }

        // Validate date compatibility
        const reservation1Dates = {
          checkIn: reservation.scheduledArrivalDate,
          checkOut: reservation.scheduledDepartureDate
        }
        const reservation2Dates = {
          checkIn: targetReservation.scheduledArrivalDate,
          checkOut: targetReservation.scheduledDepartureDate
        }

        // Check for date overlap - rooms can only be swapped if dates don't conflict
        const datesOverlap = (
          reservation1Dates.checkIn < reservation2Dates.checkOut &&
          reservation1Dates.checkOut > reservation2Dates.checkIn
        )

        if (datesOverlap) {
          await trx.rollback()
          return response.badRequest({ 
            message: 'Cannot swap rooms with overlapping reservation dates' 
          })
        }

        // Store original room information
        const originalRoom1 = {
          reservationId: reservation.id,
          roomId: currentReservationRoom.roomId,
          roomNumber: currentReservationRoom.room.roomNumber,
          roomType: currentReservationRoom.room.roomType?.roomTypeName
        }
        const originalRoom2 = {
          reservationId: targetReservation.id,
          roomId: targetReservationRoom.roomId,
          roomNumber: targetReservationRoom.room.roomNumber,
          roomType: targetReservationRoom.room.roomType?.roomTypeName
        }

        // Perform the swap
        await currentReservationRoom.merge({
          roomId: targetReservationRoom.roomId,
          roomTypeId: targetReservationRoom.room.roomTypeId,
          lastModifiedBy: auth.user?.id || 1,
          notes: `Room swapped with reservation ${targetReservationId}. Reason: ${reason || 'Room exchange requested'}`
        }).save({ client: trx })

        await targetReservationRoom.merge({
          roomId: currentReservationRoom.roomId,
          roomTypeId: currentReservationRoom.room.roomTypeId,
          lastModifiedBy: auth.user?.id || 1,
          notes: `Room swapped with reservation ${reservationId}. Reason: ${reason || 'Room exchange requested'}`
        }).save({ client: trx })

        // Update primary room types if needed
        if (targetReservationRoom.room.roomTypeId !== reservation.primaryRoomTypeId) {
          await reservation.merge({
            primaryRoomTypeId: targetReservationRoom.room.roomTypeId,
            lastModifiedBy: auth.user?.id || 1
          }).save({ client: trx })
        }

        if (currentReservationRoom.room.roomTypeId !== targetReservation.primaryRoomTypeId) {
          await targetReservation.merge({
            primaryRoomTypeId: currentReservationRoom.room.roomTypeId,
            lastModifiedBy: auth.user?.id || 1
          }).save({ client: trx })
        }

        exchangeResult = {
          type: 'reservation_swap',
          reservation1: {
            id: reservation.id,
            originalRoom: originalRoom1,
            newRoom: originalRoom2
          },
          reservation2: {
            id: targetReservation.id,
            originalRoom: originalRoom2,
            newRoom: originalRoom1
          }
        }

      } else if (exchangeType === 'room_upgrade_downgrade') {
        // Handle room upgrade/downgrade to a different room
        if (!newRoomId) {
          await trx.rollback()
          return response.badRequest({ message: 'New room ID is required for room upgrade/downgrade' })
        }

        // Check if trying to exchange to the same room
        if (currentReservationRoom.roomId === newRoomId) {
          await trx.rollback()
          return response.badRequest({ message: 'Cannot exchange to the same room' })
        }

        // Validate new room
        const newRoom = await ServiceProduct.query({ client: trx })
          .where('id', newRoomId)
          .where('hotel_id', reservation.hotelId)
          .preload('roomType')
          .first()

        if (!newRoom) {
          await trx.rollback()
          return response.badRequest({ message: 'New room not found or not available in this hotel' })
        }

        // Check room availability
        const conflictingReservation = await ReservationRoom.query({ client: trx })
          .where('room_id', newRoomId)
          .where('status', 'reserved')
          .where('id', '!=', currentReservationRoom.id) // Exclude current reservation
          .where((query) => {
            query.where((subQuery) => {
              subQuery.where('check_in_date', '<=', reservation.scheduledArrivalDate.toISODate())
                .where('check_out_date', '>', reservation.scheduledArrivalDate.toISODate())
            })
            .orWhere((subQuery) => {
              subQuery.where('check_in_date', '<', reservation.scheduledDepartureDate.toISODate())
                .where('check_out_date', '>=', reservation.scheduledDepartureDate.toISODate())
            })
            .orWhere((subQuery) => {
              subQuery.where('check_in_date', '>=', reservation.scheduledArrivalDate.toISODate())
                .where('check_out_date', '<=', reservation.scheduledDepartureDate.toISODate())
            })
          })
          .first()

        if (conflictingReservation) {
          await trx.rollback()
          return response.badRequest({ 
            message: 'New room is not available for the reservation dates' 
          })
        }

        // Check room status
        if (newRoom.status !== 'active' || newRoom.housekeepingStatus === 'dirty' || newRoom.housekeepingStatus === 'maintenance') {
          await trx.rollback()
          return response.badRequest({ 
            message: `New room is not ready. Status: ${newRoom.status}, Housekeeping: ${newRoom.housekeepingStatus}` 
          })
        }

        // Store original room info
        const originalRoomInfo = {
          roomId: currentReservationRoom.roomId,
          roomNumber: currentReservationRoom.room.roomNumber,
          roomType: currentReservationRoom.room.roomType?.roomTypeName
        }

        // Update reservation room with new room
        await currentReservationRoom.merge({
          roomId: newRoomId,
          roomTypeId: newRoom.roomTypeId,
          lastModifiedBy: auth.user?.id || 1,
          notes: `Room exchanged from ${currentReservationRoom.room.roomNumber} to ${newRoom.roomNumber}. Reason: ${reason || 'Room exchange requested'}`
        }).save({ client: trx })

        // Update reservation's primary room type if different
        if (newRoom.roomTypeId !== reservation.primaryRoomTypeId) {
          await reservation.merge({
            primaryRoomTypeId: newRoom.roomTypeId,
            lastModifiedBy: auth.user?.id || 1
          }).save({ client: trx })
        }

        exchangeResult = {
          type: 'room_upgrade_downgrade',
          reservation: {
            id: reservation.id,
            originalRoom: originalRoomInfo,
            newRoom: {
              roomId: newRoomId,
              roomNumber: newRoom.roomNumber,
              roomType: newRoom.roomType?.roomTypeName
            }
          }
        }
      }

      // Create audit log
      const auditData = {
        action: 'room_exchange',
        performedBy: auth.user?.id || 1,
        exchangeType: exchangeType,
        exchangeResult: exchangeResult,
        reason: reason || 'Room exchange requested',
        effectiveDate: exchangeDate.toISODate(),
        timestamp: DateTime.now()
      }

      console.log('Room Exchange Audit:', auditData)

      await trx.commit()

      // Reload reservation(s) with updated data
      const updatedReservation = await Reservation.query()
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .first()

      return response.ok({
        message: 'Room exchange completed successfully',
        exchangeType: exchangeType,
        exchangeDetails: exchangeResult,
        reservation: updatedReservation
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error processing room exchange:', error)
      return response.badRequest({ 
        message: 'Failed to process room exchange', 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  public async stopRoomMove({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    
    try {
      const { reservationId } = params
      const { reason, notes } = request.only(['reason', 'notes'])
      
      // Validate reservation ID
      if (!reservationId) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation ID is required' })
      }
      
      // Get the reservation with room assignments
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.orderBy('createdAt', 'desc')
        })
        .first()
      
      if (!reservation) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation not found' })
      }
      
      // Check if reservation has room assignments
      if (!reservation.reservationRooms || reservation.reservationRooms.length === 0) {
        await trx.rollback()
        return response.badRequest({ message: 'No room assignments found for this reservation' })
      }
      
      // Find the most recent room move (status should be 'active' and there should be a 'moved_out' room)
      const activeRoom = reservation.reservationRooms.find(room => room.status === 'active')
      const movedOutRoom = reservation.reservationRooms.find(room => room.status === 'moved_out')
      
      if (!activeRoom || !movedOutRoom) {
        await trx.rollback()
        return response.badRequest({ 
          message: 'No active room move found to stop. Room move may have already been completed or cancelled.' 
        })
      }
      
      // Check if the move is recent enough to be stopped (within reasonable timeframe)
      const moveTime = DateTime.fromJSDate(activeRoom.createdAt)
      const now = DateTime.now()
      const hoursSinceMove = now.diff(moveTime, 'hours').hours
      
      // Allow stopping room move within 24 hours (configurable business rule)
      if (hoursSinceMove > 24) {
        await trx.rollback()
        return response.badRequest({ 
          message: 'Room move cannot be stopped after 24 hours. Please contact management.' 
        })
      }
      
      // Store original room information for audit
      const originalRoomId = movedOutRoom.roomId
      const newRoomId = activeRoom.roomId
      
      // Revert the room move:
      // 1. Set the moved_out room back to active
      await movedOutRoom.useTransaction(trx).merge({
        status: 'active',
        lastModifiedBy: auth.user?.id,
        updatedAt: now.toJSDate()
      }).save()
      
      // 2. Remove/cancel the new room assignment
      await activeRoom.useTransaction(trx).merge({
        status: 'cancelled',
        lastModifiedBy: auth.user?.id,
        updatedAt: now.toJSDate()
      }).save()
      
      // 3. Update reservation's primary room back to original if it was changed
      if (reservation.roomTypeId !== movedOutRoom.roomTypeId) {
        await reservation.useTransaction(trx).merge({
          roomTypeId: movedOutRoom.roomTypeId,
          lastModifiedBy: auth.user?.id
        }).save()
      }
      
      // Create audit log
      await LoggerService.logActivity({
        userId: auth.user?.id,
        action: 'stop_room_move',
        resourceType: 'reservation',
        resourceId: reservationId,
        details: {
          originalRoomId: newRoomId,
          revertedToRoomId: originalRoomId,
          reason: reason || 'Room move stopped by user',
          notes,
          stopTime: now.toISO(),
          reservationNumber: reservation.reservationNumber,
          hoursSinceMove
        },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent')
      }, trx)
      
      await trx.commit()
      
      return response.ok({ 
        message: 'Room move stopped successfully', 
        reservationId: params.reservationId,
        data: {
          reservationNumber: reservation.reservationNumber,
          revertedToRoomId: originalRoomId,
          cancelledRoomId: newRoomId,
          reason: reason || 'Room move stopped by user',
          stopTime: now.toISO()
        }
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({ message: 'Failed to stop room move', error: error.message })
    }
  }

  public async getInclusionList({ params, response }: HttpContext) {
    try {
      const { reservationId } = params
      
      // Validate reservation ID
      if (!reservationId) {
        return response.badRequest({ message: 'Reservation ID is required' })
      }
      
      // Get the reservation with room details
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.where('status', 'active')
        })
        .first()
      
      if (!reservation) {
        return response.badRequest({ message: 'Reservation not found' })
      }
      
      // Compile inclusion list from all active reservation rooms
      const inclusions = {
        // Meal inclusions
        meals: {
          breakfast: reservation.reservationRooms.some(room => room.breakfastIncluded),
          lunch: reservation.reservationRooms.some(room => room.lunchIncluded),
          dinner: reservation.reservationRooms.some(room => room.dinnerIncluded),
          drinks: reservation.reservationRooms.some(room => room.drinksIncluded),
          mealPlan: reservation.reservationRooms[0]?.mealPlan || 'room_only'
        },
        
        // Connectivity & Technology
        connectivity: {
          wifi: reservation.reservationRooms.some(room => room.wifiIncluded),
          digitalKey: reservation.reservationRooms.some(room => room.digitalKey),
          mobileCheckIn: reservation.reservationRooms.some(room => room.mobileCheckIn)
        },
        
        // Transportation
        transportation: {
          parking: reservation.reservationRooms.some(room => room.parkingIncluded),
          airportTransfer: reservation.reservationRooms.some(room => room.airportTransferIncluded)
        },
        
        // Facility Access
        facilities: {
          spaAccess: reservation.reservationRooms.some(room => room.spaAccessIncluded),
          gymAccess: reservation.reservationRooms.some(room => room.gymAccessIncluded),
          poolAccess: reservation.reservationRooms.some(room => room.poolAccessIncluded),
          businessCenter: reservation.reservationRooms.some(room => room.businessCenterIncluded)
        },
        
        // Services
        services: {
          conciergeService: reservation.reservationRooms.some(room => room.conciergeServiceIncluded),
          roomService: reservation.reservationRooms.some(room => room.roomServiceIncluded),
          laundryService: reservation.reservationRooms.some(room => room.laundryServiceIncluded),
          turndownService: reservation.reservationRooms.some(room => room.turndownServiceIncluded),
          dailyHousekeeping: reservation.reservationRooms.some(room => room.dailyHousekeepingIncluded),
          newspaperDelivery: reservation.reservationRooms.some(room => room.newspaperDelivery),
          wakeUpCall: reservation.reservationRooms.some(room => room.wakeUpCall)
        },
        
        // Special Amenities
        amenities: {
          welcomeGift: reservation.reservationRooms.some(room => room.welcomeGift),
          roomDecoration: reservation.reservationRooms.some(room => room.roomDecoration),
          champagne: reservation.reservationRooms.some(room => room.champagne),
          flowers: reservation.reservationRooms.some(room => room.flowers),
          chocolates: reservation.reservationRooms.some(room => room.chocolates),
          fruitBasket: reservation.reservationRooms.some(room => room.fruitBasket)
        },
        
        // Check-in/Check-out Services
        checkInOut: {
          earlyCheckIn: reservation.reservationRooms.some(room => room.earlyCheckIn),
          lateCheckOut: reservation.reservationRooms.some(room => room.lateCheckOut),
          expressCheckOut: reservation.reservationRooms.some(room => room.expressCheckOut)
        },
        
        // Room Features
        roomFeatures: {
          extraBed: reservation.reservationRooms.some(room => room.extraBed),
          crib: reservation.reservationRooms.some(room => room.crib),
          rollawayBed: reservation.reservationRooms.some(room => room.rollawayBed),
          connectingRooms: reservation.reservationRooms.some(room => room.connectingRooms)
        },
        
        // Package Information
        packageInfo: {
          packageRate: reservation.reservationRooms.some(room => room.packageRate),
          packageInclusions: reservation.reservationRooms
            .filter(room => room.packageInclusions)
            .map(room => room.packageInclusions)
            .filter(Boolean)
        }
      }
      
      // Count total inclusions
      const totalInclusions = Object.values(inclusions).reduce((total, category) => {
        if (typeof category === 'object' && category !== null) {
          return total + Object.values(category).filter(value => 
            Array.isArray(value) ? value.length > 0 : Boolean(value)
          ).length
        }
        return total
      }, 0)
      
      return response.ok({ 
        message: 'Inclusion list retrieved successfully', 
        reservationId: params.reservationId,
        data: {
          reservationNumber: reservation.reservationNumber,
          totalInclusions,
          inclusions,
          summary: {
            hasMealInclusions: Object.values(inclusions.meals).some(Boolean),
            hasFacilityAccess: Object.values(inclusions.facilities).some(Boolean),
            hasSpecialServices: Object.values(inclusions.services).some(Boolean),
            hasAmenities: Object.values(inclusions.amenities).some(Boolean),
            isPackageRate: inclusions.packageInfo.packageRate
          }
        }
      })
    } catch (error) {
      return response.badRequest({ message: 'Failed to get inclusion list', error: error.message })
    }
  }

  public async markNoShow({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    
    try {
      const { reservationId } = params
      const { reason, notes } = request.only(['reason', 'notes'])
      
      // Validate reservation ID
      if (!reservationId) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation ID is required' })
      }
      
      // Get the reservation with related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms')
        .first()
      
      if (!reservation) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation not found' })
      }
      
      // Check if reservation can be marked as no-show
      const allowedStatuses = ['confirmed', 'checked_in', 'pending']
      if (!allowedStatuses.includes(reservation.status)) {
        await trx.rollback()
        return response.badRequest({ 
          message: `Cannot mark reservation as no-show. Current status: ${reservation.status}` 
        })
      }
      
      // Check if arrival date has passed (no-show typically applies after expected arrival)
      const now = DateTime.now()
      const arrivalDate = DateTime.fromJSDate(reservation.arrivalDate)
      
      if (now < arrivalDate) {
        await trx.rollback()
        return response.badRequest({ 
          message: 'Cannot mark as no-show before arrival date' 
        })
      }
      
      // Store original status for audit
      const originalStatus = reservation.status
      
      // Update reservation status to no-show
      await reservation.useTransaction(trx).merge({
        status: 'no_show' as ReservationStatus,
        noShowDate: now.toJSDate(),
        noShowReason: reason || 'Guest did not arrive',
        noShowNotes: notes,
        lastModifiedBy: auth.user?.id
      }).save()
      
      // Update all associated reservation rooms to no-show status
      await ReservationRoom.query({ client: trx })
        .where('reservationId', reservationId)
        .update({
          status: 'no_show',
          lastModifiedBy: auth.user?.id,
          updatedAt: now.toJSDate()
        })
      
      // Create audit log
      await LoggerService.logActivity({
        userId: auth.user?.id,
        action: 'mark_no_show',
        resourceType: 'reservation',
        resourceId: reservationId,
        details: {
          originalStatus,
          newStatus: 'no_show',
          reason: reason || 'Guest did not arrive',
          notes,
          noShowDate: now.toISO(),
          reservationNumber: reservation.reservationNumber
        },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent')
      }, trx)
      
      await trx.commit()
      
      return response.ok({ 
        message: 'Reservation marked as no-show successfully', 
        reservationId: params.reservationId,
        data: {
          reservationNumber: reservation.reservationNumber,
          status: 'no_show',
          noShowDate: now.toISO(),
          reason: reason || 'Guest did not arrive'
        }
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({ message: 'Failed to mark as no-show', error: error.message })
    }
  }

  public async voidReservation({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    
    try {
      const { reservationId } = params
      const { reason, notes } = request.body()
      
      // Validate required fields
      if (!reason) {
        await trx.rollback()
        return response.badRequest({ message: 'Void reason is required' })
      }
      
      // Get reservation with related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms')
        .first()
      
      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }
      
      // Check if reservation can be voided
      const allowedStatuses = ['confirmed', 'pending', 'checked_in']
      if (!allowedStatuses.includes(reservation.status)) {
        await trx.rollback()
        return response.badRequest({ 
          message: `Cannot void reservation with status: ${reservation.status}. Allowed statuses: ${allowedStatuses.join(', ')}` 
        })
      }
      
      // Store original status for audit
      const originalStatus = reservation.status
      
      // Update reservation status to voided
      await reservation.useTransaction(trx).merge({
        status: 'voided' as ReservationStatus,
        voidedDate: DateTime.now(),
        voidReason: reason,
        voidNotes: notes || null,
        lastModifiedBy: auth.user?.id
      }).save()
      
      // Update all reservation rooms to voided status
      await ReservationRoom.query({ client: trx })
        .where('reservationId', reservationId)
        .update({
          status: 'voided',
          lastModifiedBy: auth.user?.id,
          updatedAt: DateTime.now()
        })
      
      // Create audit log
      await LoggerService.log({
        userId: auth.user?.id,
        action: 'reservation_voided',
        entityType: 'reservation',
        entityId: reservationId,
        details: {
          originalStatus,
          newStatus: 'voided',
          reason,
          notes,
          voidedDate: DateTime.now().toISO(),
          roomsAffected: reservation.reservationRooms.length
        },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent')
      }, trx)
      
      await trx.commit()
      
      return response.ok({
        message: 'Reservation voided successfully',
        reservationId,
        voidDetails: {
          originalStatus,
          voidedDate: DateTime.now().toISO(),
          reason,
          notes,
          roomsAffected: reservation.reservationRooms.length
        }
      })
      
    } catch (error) {
      await trx.rollback()
      logger.error('Error voiding reservation:', error)
      return response.badRequest({ 
        message: 'Failed to void reservation', 
        error: error.message 
      })
    }
  }

  public async unassignRoom({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    
    try {
      const { reservationId } = params
      const { roomId, reason, notes } = request.body()
      
      // Validate required fields
      if (!roomId) {
        await trx.rollback()
        return response.badRequest({ message: 'Room ID is required' })
      }
      
      if (!reason) {
        await trx.rollback()
        return response.badRequest({ message: 'Unassignment reason is required' })
      }
      
      // Get reservation with related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.where('roomId', roomId).where('status', 'active')
        })
        .first()
      
      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }
      
      // Check if reservation allows room unassignment
      const allowedStatuses = ['confirmed', 'checked_in', 'pending']
      if (!allowedStatuses.includes(reservation.status)) {
        await trx.rollback()
        return response.badRequest({ 
          message: `Cannot unassign room from reservation with status: ${reservation.status}. Allowed statuses: ${allowedStatuses.join(', ')}` 
        })
      }
      
      // Find the active room assignment
      const roomAssignment = reservation.reservationRooms.find(rr => rr.roomId === roomId && rr.status === 'active')
      
      if (!roomAssignment) {
        await trx.rollback()
        return response.notFound({ 
          message: 'Active room assignment not found for this reservation and room' 
        })
      }
      
      // Check if this is the only room assigned to the reservation
      const totalActiveRooms = await ReservationRoom.query({ client: trx })
        .where('reservationId', reservationId)
        .where('status', 'active')
        .count('* as total')
      
      const activeRoomCount = Number(totalActiveRooms[0].$extras.total)
      
      if (activeRoomCount <= 1) {
        await trx.rollback()
        return response.badRequest({ 
          message: 'Cannot unassign the only room from a reservation. Consider voiding the reservation instead.' 
        })
      }
      
      // Store original data for audit
      const originalRoomData = {
        roomId: roomAssignment.roomId,
        status: roomAssignment.status,
        assignedDate: roomAssignment.createdAt
      }
      
      // Update room assignment status to unassigned
      await roomAssignment.useTransaction(trx).merge({
        status: 'unassigned',
        unassignedDate: DateTime.now(),
        unassignReason: reason,
        unassignNotes: notes || null,
        lastModifiedBy: auth.user?.id
      }).save()
      
      // Create audit log
      await LoggerService.log({
        userId: auth.user?.id,
        action: 'room_unassigned',
        entityType: 'reservation_room',
        entityId: roomAssignment.id,
        details: {
          reservationId,
          roomId,
          originalStatus: originalRoomData.status,
          newStatus: 'unassigned',
          reason,
          notes,
          unassignedDate: DateTime.now().toISO(),
          remainingActiveRooms: activeRoomCount - 1
        },
        ipAddress: request.ip(),
        userAgent: request.header('user-agent')
      }, trx)
      
      await trx.commit()
      
      return response.ok({
        message: 'Room unassigned successfully',
        reservationId,
        unassignmentDetails: {
          roomId,
          originalStatus: originalRoomData.status,
          unassignedDate: DateTime.now().toISO(),
          reason,
          notes,
          remainingActiveRooms: activeRoomCount - 1
        }
      })
      
    } catch (error) {
      await trx.rollback()
      logger.error('Error unassigning room:', error)
      return response.badRequest({ 
        message: 'Failed to unassign room', 
        error: error.message 
      })
    }
  }

}
