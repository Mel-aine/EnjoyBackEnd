
import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Reservation, { ReservationStatus } from '#models/reservation'
import Room from '#models/room'
import ReservationRoom from '#models/reservation_room'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { generateConfirmationNumber } from '../utils/generate_confirmation_number.js'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import CancellationPolicy from '#models/cancellation_policy'
import { FolioStatus, FolioType, ReservationProductStatus, SettlementStatus, TransactionCategory, TransactionStatus, TransactionType, WorkflowStatus } from '#app/enums'
// import { messages } from '@vinejs/vine/defaults'
import logger from '@adonisjs/core/services/logger'
import ReservationService from '#services/reservation_service'
import type { ReservationData } from '../types/reservationData.js'
import ReservationFolioService from '#services/reservation_folio_service'
import FolioService from '#services/folio_service'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import PaymentMethod from '#models/payment_method'
import PdfGenerationService from '#services/pdf_generation_service'
import Guest from '#models/guest'


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
    const { reservationRooms, actualCheckInTime, notes } = request.body();

    console.log('Check-in request received');
    console.log('Request body:', { reservationRooms, actualCheckInTime, notes });

    const trx = await db.transaction();
    console.log('Transaction started');

    try {
      const reservationId = Number(params.reservationId);
      console.log('Reservation ID:', reservationId);

      // Validate required parameters
      if (isNaN(reservationId)) {
        console.log('Invalid reservation ID');
        return response.badRequest({ message: 'Reservation ID is required' });
      }

      if (!reservationRooms || !Array.isArray(reservationRooms) || reservationRooms.length === 0) {
        console.log('No reservation rooms provided');
        return response.badRequest({ message: 'At least one reservation room ID is required' });
      }

      // Find reservation with related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => query.preload('room'))
        .first();

      console.log('Reservation found:', reservation);

      if (!reservation) {
        console.log('Reservation not found, rolling back');
        await trx.rollback();
        return response.notFound({ message: 'Reservation not found' });
      }

      // Check if reservation can be checked in
      if (!['confirmed', 'pending'].includes(reservation.status)) {
        console.log(`Cannot check in reservation with status: ${reservation.status}`);
        await trx.rollback();
        return response.badRequest({
          message: `Cannot check in reservation with status: ${reservation.status}`
        });
      }

      // Get the specific reservation rooms to check in
      const reservationRoomsToCheckIn = await ReservationRoom.query({ client: trx })
        .whereIn('id', reservationRooms)
        .where('reservation_id', reservation.id)
        .preload('room');

      console.log('Reservation rooms to check in:', reservationRoomsToCheckIn);

      if (reservationRoomsToCheckIn.length === 0) {
        console.log('No valid reservation rooms found for check-in, rolling back');
        await trx.rollback();
        return response.notFound({ message: 'No valid reservation rooms found for check-in' });
      }

      // Check if any rooms are already checked in
      const alreadyCheckedIn = reservationRoomsToCheckIn.filter(rr => rr.status === 'checked_in');
      if (alreadyCheckedIn.length > 0) {
        console.log('Some rooms are already checked in:', alreadyCheckedIn);
        await trx.rollback();
        return response.badRequest({
          message: `Some rooms are already checked in: ${alreadyCheckedIn.map(r => r.room?.roomNumber || r.roomId).join(', ')}`
        });
      }

      const now = actualCheckInTime ? DateTime.fromISO(actualCheckInTime) : DateTime.now();
      const checkedInRooms = [];

      // Update each reservation room
      for (const reservationRoom of reservationRoomsToCheckIn) {
        reservationRoom.status = 'checked_in';
        reservationRoom.checkInDate = now;
        reservationRoom.actualCheckIn = now;
        reservationRoom.checkedInBy = auth.user!.id;
        reservationRoom.guestNotes = notes || reservationRoom.guestNotes;

        console.log('Updating reservation room:', reservationRoom.id);

        await reservationRoom.useTransaction(trx).save();

        // Update room status to occupied
        if (reservationRoom.room) {
          reservationRoom.room.status = 'occupied';
          await reservationRoom.room.useTransaction(trx).save();
          console.log('Room status updated to occupied:', reservationRoom.room.roomNumber);
        }

        checkedInRooms.push({
          id: reservationRoom.id,
          roomId: reservationRoom.roomId,
          roomNumber: reservationRoom.room?.roomNumber,
          status: reservationRoom.status,
          checkInDate: reservationRoom.checkInDate,
          keyCardsIssued: reservationRoom.keyCardsIssued
        });
      }

      // Vérifier si toutes les chambres de la réservation sont maintenant checked-in
      const allReservationRooms = await ReservationRoom.query({ client: trx })
        .where('reservation_id', reservation.id);

      console.log('All reservation rooms:', allReservationRooms.map(r => ({ id: r.id, status: r.status })));

      const allRoomsCheckedIn = allReservationRooms.every(room =>
        room.status === 'checked_in' || reservationRooms.includes(room.id)
      );

      console.log('All rooms checked in?', allRoomsCheckedIn);

      // Ne mettre à jour le statut de la réservation que si toutes les chambres sont check-in
      if (allRoomsCheckedIn) {
        reservation.status = ReservationStatus.CHECKED_IN;
        reservation.checkInDate = now;
        reservation.checkedInBy = auth.user!.id;
        console.log('Updating reservation status to CHECKED_IN - all rooms are checked in');
      } else {
        // Statut intermédiaire pour check-in partiel
        reservation.status = 'confirmed';
        // Ne pas mettre à jour checkInDate et checkedInBy pour un check-in partiel
        console.log('Updating reservation status to PARTIALLY_CHECKED_IN - partial check-in');
      }

      reservation.lastModifiedBy = auth.user!.id;
      await reservation.useTransaction(trx).save();

      // Create audit log
      const logDescription = allRoomsCheckedIn
        ? `Reservation #${reservation.reservationNumber} fully checked in. Rooms: ${checkedInRooms.map(r => r.roomNumber).join(', ')}`
        : `Reservation #${reservation.reservationNumber} partially checked in. Rooms: ${checkedInRooms.map(r => r.roomNumber).join(', ')}`;

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CHECK_IN',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: logDescription,
        ctx: ctx,
      });

      if (reservation.guestId) {
        await LoggerService.log({
          actorId: auth.user!.id,
          action: 'CHECK_IN',
          entityType: 'Guest',
          hotelId: reservation.hotelId,
          entityId: reservation.guestId,
          description: `Checked in from hotel for reservation #${reservation.reservationNumber}.`,
          meta: {
            reservationId: reservation.id,
            reservationNumber: reservation.reservationNumber,
            rooms: reservationRooms,
            isPartialCheckIn: !allRoomsCheckedIn
          },
          ctx: ctx,
        });
      }

      await trx.commit();
      console.log('Transaction committed successfully');

      return response.ok({
        message: allRoomsCheckedIn ? 'Check-in successful' : 'Partial check-in successful',
        data: {
          reservationId: reservation.id,
          reservationNumber: reservation.reservationNumber,
          status: reservation.status,
          checkInDate: reservation.checkInDate,
          checkedInRooms: checkedInRooms,
          totalRoomsCheckedIn: checkedInRooms.length,
          isPartialCheckIn: !allRoomsCheckedIn,
          totalRoomsInReservation: allReservationRooms.length
        }
      });

    } catch (error) {
      await trx.rollback();
      console.error('Error during check-in:', error);
      return response.badRequest({
        message: 'Failed to check in reservation',
        error: error.message
      });
    }
  }



  public async checkOut(ctx: HttpContext) {
    const { params, response, request, auth } = ctx
    const { reservationRooms, actualCheckOutTime, notes } = request.body();
    console.log("➡️ checkOut called with params:", params, "body:", request.body());

    if (!auth.user) {
      return response.unauthorized({
        success: false,
        message: 'Authentication required',
        errors: ['User is not authenticated']
      })
    }

    const trx = await db.transaction()

    try {
      // Validate input parameters
      if (!params.reservationId) {
        console.log("❌ Missing reservationId");
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Reservation ID is required',
          errors: ['Missing reservation ID']
        })
      }

      if (!reservationRooms || !Array.isArray(reservationRooms) || reservationRooms.length === 0) {
        console.log("❌ Invalid reservationRooms:", reservationRooms);
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Reservation rooms are required',
          errors: ['reservationRooms must be a non-empty array']
        })
      }

      // Fetch reservation with transaction
      const reservation = await Reservation.query({ client: trx })
        .where('id', params.reservationId)
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions')
        })
        .first()
      console.log("📦 Reservation fetched:", reservation?.id, reservation?.status);

      if (!reservation) {
        await trx.rollback()
        return response.notFound({
          success: false,
          message: 'Reservation not found',
          errors: ['Reservation does not exist']
        })
      }

      // Validate reservation status
      if (reservation.status === ReservationStatus.CHECKED_OUT) {
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Reservation is already checked out',
          errors: ['Cannot check out an already checked out reservation']
        })
      }

      if (reservation.status !== ReservationStatus.CHECKED_IN) {
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Reservation must be checked in before check out',
          errors: [`Current status: ${reservation.status}`]
        })
      }

      const balanceSummary = this.calculateBalanceSummary(reservation.folios)
      console.log("💰 Balance summary calculated:", balanceSummary);

      // Check if there's an outstanding balance
      if (balanceSummary.outstandingBalance > 0) {
        console.log("⚠️ Outstanding balance detected:", balanceSummary.outstandingBalance);
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Cannot check out with outstanding balance',
          errors: [`Outstanding balance of ${balanceSummary.outstandingBalance} must be settled before checkout`],
          data: {
            balanceSummary,
            outstandingAmount: balanceSummary.outstandingBalance
          }
        })
      }

      // Fetch reservation rooms with transaction
      const reservationRoomRecords = await ReservationRoom.query({ client: trx })
        .whereIn('id', reservationRooms)
        .where('reservationId', params.reservationId)
        .preload('room')
      console.log("🛏️ Reservation rooms fetched:", reservationRoomRecords.map(r => ({ id: r.roomId, status: r.status })));

      if (reservationRoomRecords.length === 0) {
        await trx.rollback()
        return response.notFound({
          success: false,
          message: 'No reservation rooms found',
          errors: ['No matching reservation rooms for the provided IDs']
        })
      }

      // Validate room statuses
      const invalidRooms = reservationRoomRecords.filter(room =>
        room.status === 'checked_out' || room.status === 'cancelled'
      )

      if (invalidRooms.length > 0) {
        console.log("⚠️ Invalid rooms for checkout:", invalidRooms.map(r => ({ id: r.id, status: r.status })));
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Some rooms cannot be checked out',
          errors: invalidRooms.map(room =>
            `Room ${room.id} is already ${room.status}`
          )
        })
      }

      const updatedRooms: any[] = []
      const checkOutDateTime = actualCheckOutTime ? DateTime.fromISO(actualCheckOutTime) : DateTime.now()

      // Update reservation rooms
      for (const reservationRoom of reservationRoomRecords) {
        // Update reservation room status
        reservationRoom.status = 'checked_out'
        //reservationRoom.actualCheckOutTime = checkOutDateTime
        //reservationRoom.checkedOutBy = auth.user!.id

        if (notes) {
          reservationRoom.guestNotes = notes
        }

        await reservationRoom.useTransaction(trx).save()
        updatedRooms.push(reservationRoom)

        // Update associated room status to dirty
        if (reservationRoom.room) {
          console.log(`🧹 Marking room ${reservationRoom.room.id} as dirty`);
          reservationRoom.room.status = 'dirty'
          reservationRoom.room.housekeepingStatus = 'dirty'
          await reservationRoom.room.useTransaction(trx).save()
          updatedRooms.push(reservationRoom.room.id)
        }
      }

      // Check if all reservation rooms are checked out
      const remainingCheckedInRooms = await ReservationRoom.query({ client: trx })
        .where('reservationId', params.reservationId)
        .whereNotIn('status', ['checked_out', 'cancelled', 'no_show'])

      console.log("📊 Remaining checked-in rooms:", remainingCheckedInRooms.length);

      const allRoomsCheckedOut = remainingCheckedInRooms.length === 0

      // Update reservation status if all rooms are checked out
      if (allRoomsCheckedOut) {
        console.log("✅ All rooms checked out, updating reservation status");
        reservation.checkOutDate = checkOutDateTime
        reservation.status = ReservationStatus.CHECKED_OUT
        //reservation.checkedOutBy = auth.user!.id
        await reservation.useTransaction(trx).save()
      }



      // Log the check-out activity
      await LoggerService.log({
        actorId: auth.user.id,
        action: 'CHECK_OUT',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Reservation #${reservation.reservationNumber} rooms checked out. Rooms: ${reservationRooms.join(', ')}`,
        ctx: ctx,
      })

      //log for Guest
      if (reservation.guestId) {
        await LoggerService.log({
          actorId: auth.user.id,
          action: 'CHECK_OUT',
          entityType: 'Guest',
          entityId: reservation.guestId,
          hotelId: reservation.hotelId,
          description: `Checked out from hotel for reservation #${reservation.reservationNumber}.`,
          meta: {
            reservationId: reservation.id,
            reservationNumber: reservation.reservationNumber,
            rooms: reservationRooms
          },
          ctx: ctx,
        });
      }

      await trx.commit()

      return response.ok({
        success: true,
        message: 'Check-out completed successfully',
        data: {
          reservation: {
            id: reservation.id,
            reservationNumber: reservation.reservationNumber,
            status: reservation.status,
            checkOutDate: reservation.checkOutDate,
            allRoomsCheckedOut
          },
          checkedOutRooms: updatedRooms.map(room => ({
            id: room.id,
            roomId: room.roomId,
            status: room.status,
            // actualCheckOutTime: room.actualCheckOutTime,
            //checkedOutBy: room.checkedOutBy,
            //finalBillAmount: room.finalBillAmount,
            //depositRefund: room.depositRefund
          })),
          updatedRooms,
          balanceSummary
        }
      })
    } catch (error) {
      await trx.rollback()
      logger.error('Error during reservation check-out:', {
        reservationId: params.reservationId,
        reservationRooms,
        error: error.message,
        stack: error.stack
      })

      return response.status(500).json({
        success: false,
        message: 'An error occurred during check-out',
        errors: [error.message]
      })
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
          query.preload('roomType')
          query.preload('guest')
          query.preload('room')
            .preload('roomRates', (queryRoom) => {
              queryRoom.preload('rateType')
            })
            .preload('roomType')
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      // Calculate balance summary from folio transactions
      const balanceSummary = this.calculateBalanceSummary(reservation.folios)

      // Calculate average daily rate
      const avgDailyRate = this.calculateAvgDailyRate(reservation)

      // Determine available actions based on reservation status
      const availableActions = this.getAvailableActions(reservation)

      const result = {
        ...reservation.toJSON(),
        balanceSummary,
        avgDailyRate,
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
      totalChargesWithTaxes: parseFloat((totalCharges + totalTaxes + totalServiceCharges).toFixed(2)),
      balanceStatus: outstandingBalance > 0 ? 'outstanding' : outstandingBalance < 0 ? 'credit' : 'settled'
    }
  }

  /**
   * Calculate average daily rate from reservation room rates
   */
  private calculateAvgDailyRate(reservation: any) {
    if (!reservation.reservationRooms || reservation.reservationRooms.length === 0) {
      return 0
    }

    let totalRoomCharges = 0
    let totalNights = 0

    reservation.reservationRooms.forEach((reservationRoom: any) => {
      if (reservationRoom.roomRates && reservationRoom.roomRates.length > 0) {
        reservationRoom.roomRates.forEach((roomRate: any) => {
          const rateAmount = parseFloat(roomRate.rate) || 0
          totalRoomCharges += rateAmount
          totalNights += 1
        })
      }
    })

    if (totalNights === 0) {
      return 0
    }

    return parseFloat((totalRoomCharges / totalNights).toFixed(2))
  }

  /**
   * Get available actions based on reservation status
   */
  private getAvailableActions(reservation: any) {
    const actions = []
    const status = reservation.status?.toLowerCase() || reservation.reservation_status?.toLowerCase()
    const currentDate = new Date()
    const arrivalDate = new Date(reservation.arrivedDate || reservation.checkInDate)

    const departureDate = new Date(reservation.departDate || reservation.checkOutDate)
    console.log("reservation", reservation)

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
    // Checkout : Available during stay (checked-in status)
    if (['checked-in', 'checked_in'].includes(status) && currentDate >= departureDate) {
      actions.push({
        action: 'check_out',
        label: 'Check-out',
        description: 'Check out guest to a different room',
        available: true,
        route: `/reservations/${reservation.id}/check-out`
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
    if (['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in'].includes(status)) {
      actions.push({
        action: 'stop_room_move',
        label: 'Stop Room Move',
        description: 'Add Flag stop move',
        available: false, // Would need to check if there's a pending move
        route: `/reservations/${reservation.id}/stop-room-move`
      })
    }

    /*  // Inclusion List: Available during reservation or stay
      if (['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in'].includes(status)) {
        actions.push({
          action: 'inclusion_list',
          label: 'Inclusion List',
          description: 'Add or modify included amenities and services',
          available: true,
          route: `/reservations/${reservation.id}/inclusion-list`
        })
      }
        */

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
    const numRooms = reservation.reservationRooms?.length || 0;

    if (
      ['confirmed', 'guaranteed', 'pending'].includes(status) &&
      numRooms <= 1
    ) {
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
* Met à jour les folios après amendement de la réservation
*/
  private async updateFoliosAfterAmendment(
    reservation: any,
    trx: any,
    userId: number
  ) {
    // Charger les folios avec les transactions
    await reservation.load('folios', (query: any) => {
      query.preload('transactions')
    })

    for (const folio of reservation.folios) {
      // Calculer les nouveaux totaux basés sur les chambres mises à jour
      let newRoomCharges = 0
      let newTotalTaxes = 0

      if (folio.reservationRoomId) {
        const reservationRoom = reservation.reservationRooms.find((rr: any) => rr.id === folio.reservationRoomId)
        if (reservationRoom) {
          newRoomCharges = reservationRoom.totalRoomCharges || 0
          newTotalTaxes = reservationRoom.totalTaxesAmount || 0
        }
      } else {
        for (const room of reservation.reservationRooms) {
          newRoomCharges += room.totalRoomCharges || 0
          newTotalTaxes += room.totalTaxesAmount || 0
        }
      }

      const oldRoomCharges = folio.roomCharges || 0
      const oldTotalTaxes = folio.totalTaxes || 0
      const roomChargesDiff = newRoomCharges - oldRoomCharges
      const taxesDiff = newTotalTaxes - oldTotalTaxes

      if (Math.abs(roomChargesDiff) > 0.01 || Math.abs(taxesDiff) > 0.01) {
        const totalDiff = roomChargesDiff + taxesDiff;
        const transactionType = totalDiff >= 0 ? TransactionType.CHARGE : TransactionType.ADJUSTMENT;
        const transactionCode = transactionType === TransactionType.CHARGE ? 'CHG' : 'ADJ';
        const transactionNumber = parseInt(Date.now().toString().slice(-9));

        await FolioTransaction.create({
          folioId: folio.id,
          hotelId: reservation.hotelId,
          guestId: folio.guestId,
          reservationId: reservation.id,
          transactionType: transactionType,
          transactionCode: transactionCode,
          transactionNumber: transactionNumber,
          amount: roomChargesDiff,
          taxAmount: taxesDiff,
          totalAmount: totalDiff,
          description: 'Adjustment due to stay modification.',
          transactionDate: DateTime.now(),
          postingDate: DateTime.now(),
          status: TransactionStatus.POSTED,
          createdBy: userId,
        }, { client: trx });

        const safeNumber = (val: any): number => {
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        };


        const newTotalCharges = safeNumber(folio.totalCharges || 0) + roomChargesDiff;
        const newTotalTaxesOnFolio = safeNumber(folio.totalTaxes || 0) + taxesDiff;
        const newBalance = safeNumber(folio.balance || 0) + totalDiff;

        const notes = (folio.internalNotes || '') +
          `\n[${DateTime.now().toFormat('yyyy-MM-dd HH:mm')}] Folio updated after stay amendment. ` +
          `Room charges changed by ${roomChargesDiff.toFixed(2)}. ` +
          `Taxes changed by ${taxesDiff.toFixed(2)}.`;

        console.log({
          oldCharges: folio.totalCharges,
          roomChargesDiff,
          newTotalCharges,
          oldTaxes: folio.totalTaxes,
          taxesDiff,
          newTotalTaxesOnFolio,
          oldBalance: folio.balance,
          totalDiff,
          newBalance,
        });


        await folio.merge({
          roomCharges: newRoomCharges,
          totalTaxes: newTotalTaxesOnFolio,
          totalCharges: newTotalCharges,
          balance: newBalance,
          lastModifiedBy: userId,
          internalNotes: notes,
        }).useTransaction(trx).save()
      }
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
        newDepartDate: vine.date(),
      })
    )
    const trx = await db.transaction()
    try {

      const payload = await request.validateUsing(validator, {
        data: request.body(),
      })

      const newDepartDate = DateTime.fromJSDate(payload.newDepartDate)

      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms')
        .first()

      if (!reservation) {
        await trx.rollback()
        res.messages = 'Reservation not found.'
        return response.status(200).json(res)
      }

      const oldDepartDate = reservation.departDate

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
        const product = await Room.find(rsp.roomId)
        const conflictingReservation = await ReservationRoom.query({ client: trx })
          .where('roomId', rsp.roomId)
          .where('reservationId', '!=', reservationId)
          .andWhere((query) => {
            query

              .where('startDate', '<', newDepartDate.toISODate()!)
              .andWhere('startDate', '>=', DateTime.now().toISODate()!)
            // .andWhere('endDate', '>', oldDepartDate.toISODate()!)
          })
          .first()
        logger.info(conflictingReservation)
        if (conflictingReservation) {
          conflicts.push({
            productName: product?.roomNumber || `ID ${rsp.roomId}`,
            productId: rsp.roomId,
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
    //     newDepartDate: vine.date(),
    //   })
    // )
    const trx = await db.transaction()
    try {

      // const payload = await request.validateUsing(validator, {
      //   data: request.body(),
      // })
      const body = request.body();
      //const newDepartDate = DateTime.fromJSDate(payload.newDepartDate)
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms')
        .first()

      if (!reservation || !reservation.arrivedDate) {
        await trx.rollback()
        return response.notFound({ message: 'Réservation non trouvée.' })
      }

      if (!body.newDepartDate) {
        await trx.rollback()
        return response.notFound({ message: 'Réservation non trouvée.' })
      }
      reservation.departDate = body.newDepartDate;
      // --- Aucune conflit : Procéder à la prolongation ---
      const oldReservationData = { ...reservation.serialize() }
      const newDepartDate = reservation.departDate;

      // const newDepartDateLuxon = DateTime.fromISO(newDepartDate);
      // const arrivedDateLuxon = DateTime.fromJSDate(new Date(reservation.arrivedDate));
      const newDepartDateLuxon = DateTime.fromISO(String(newDepartDate));
      const arrivedDateLuxon = DateTime.fromISO(String(reservation.arrivedDate));

      const oldNumberOfNights = reservation.numberOfNights || 0
      const newNumberOfNights = newDepartDateLuxon!.diff(arrivedDateLuxon, 'days').days
      const additionalNights = newNumberOfNights - oldNumberOfNights
      let additionalAmount = 0
      // Mettre à jour les produits de la réservation
      for (const rsp of reservation.reservationRooms) {
        const rspInTrx = await ReservationRoom.findOrFail(rsp.id, { client: trx })

        const additionalProductCost = parseFloat(`${rspInTrx.netAmount!}`) * additionalNights

        additionalAmount += additionalProductCost

        rspInTrx.checkOutDate = newDepartDate!

        rspInTrx.netAmount = parseFloat(`${rspInTrx.netAmount!}`) + additionalProductCost
        rspInTrx.lastModifiedBy = auth.user!.id
        await rspInTrx.save()
      }

      // Mettre à jour la réservation principale
      reservation.departDate = newDepartDate
      reservation.numberOfNights = newNumberOfNights
      reservation.totalAmount = parseFloat(`${reservation.totalAmount!}`) + additionalAmount
      reservation.finalAmount = parseFloat(`${reservation.finalAmount!}`) + additionalAmount
      reservation.remainingAmount = parseFloat(`${reservation.remainingAmount!}`) + additionalAmount
      reservation.lastModifiedBy = auth.user!.id
      await reservation.save()

      await trx.commit()

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'UPDATE',
        entityType: 'Reservation',
        entityId: reservationId,
        hotelId: reservation.hotelId,
        description: `Stay for reservation #${reservationId} extended until ${newDepartDate}.`,
        changes: LoggerService.extractChanges(oldReservationData, reservation.serialize()),
        ctx,
      })
      //guest log
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'UPDATE',
        entityType: 'Guest',
        entityId: reservation.guestId,
        hotelId: reservation.hotelId,
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
      const reservation = await Reservation.query().where('id', reservationId).preload('hotel').preload('reservationRooms').first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      const policy = await CancellationPolicy.query()
        .where('hotelId', reservation.hotelId)
        .orderBy('createdAt', 'desc')
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

      if (!reservation.arrivedDate) {
        return response.badRequest({ message: "The reservation does not have an arrival date." })
      }

      // Calculate free cancellation deadline
      // const arrivalDate = DateTime.fromJSDate(new Date(reservation.arrivedDate))
      const arrivalDate = reservation.arrivedDate
      if (!arrivalDate.isValid) {
        return response.badRequest({ message: 'Invalid arrival date format.' })
      }
      const freeCancellationDeadline = arrivalDate.minus({ [policy.free_cancellation_period_unit]: 1 })

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
              (reservation.finalAmount || 0) * ((policy.cancellation_fee_value || 0) / 100)
            feeDescription = `${policy.cancellation_fee_value}% of the total amount`
            break
          case 'first_night':
            cancellationFee = reservation.reservationRooms.reduce(
              (total, p) => total + (parseFloat(`${p.netAmount}`) || 0),
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
    const reservationId = params.reservationId
    const { reason, cancellationFee } = request.body()

    const trx = await db.transaction()

    try {
      // 1. Find the reservation and its related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('folios', (query) => {
          query.preload('transactions')
        })
        .preload('reservationRooms')
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

      reservation.status = ReservationStatus.CANCELLED
      reservation.cancellationReason = reason
      // reservation.cancelledBy = auth.user!.id
      reservation.lastModifiedBy = auth.user!.id
      reservation.cancellationDate = DateTime.now()
      //reservation.cancellationFeeAmount = cancellationFee;
      await reservation.save()
      if (reservation.reservationRooms) {
        for (const resService of reservation.reservationRooms) {
          resService.status = ReservationProductStatus.CANCELLED
          resService.lastModifiedBy = auth.user!.id
          await resService.save()

          // Rendre la chambre physique "available"
          const room = await Room.find(resService.roomId)
          if (room) {
            room.status = 'available'
            await room.save()
            room.lastModifiedBy = auth.user!.id;
          }

          // Log pour chaque chambre annulée
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CANCEL',
            entityType: 'ReservationRoom',
            entityId: resService.id,
            hotelId: reservation.hotelId,
            description: `Reservation #${resService.id} cancelled.`,
            ctx: ctx,
          })

          //for guest
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CANCEL',
            entityType: 'Guest',
            entityId: reservation.guestId,
            hotelId: reservation.hotelId,
            description: `Reservation #${reservation.reservationNumber} was cancelled. Reason: ${reason || 'N/A'}.`,
            meta: {
              reason: reason,
              cancellationFee: cancellationFee
            },
            ctx: ctx,

          })
        }




      }

      // 5. Close all related folios and mark transactions as cancelled
      let foliosClosed = 0
      let transactionsCancelled = 0

      if (reservation.folios && reservation.folios.length > 0) {
        for (const folio of reservation.folios) {
          // Only close open folios
          if (folio.status === FolioStatus.OPEN) {
            folio.status = FolioStatus.CLOSED
            folio.workflowStatus = WorkflowStatus.FINALIZED
            folio.closedDate = DateTime.now()
            // folio.finalizedDate = DateTime.now()
            folio.closedBy = auth.user!.id
            folio.lastModifiedBy = auth.user!.id
            await folio.save()
            foliosClosed++

            // Mark all related transactions as cancelled
            if (folio.transactions && folio.transactions.length > 0) {
              for (const transaction of folio.transactions) {
                if (transaction.status != TransactionStatus.CANCELLED) {
                  transaction.status = TransactionStatus.CANCELLED
                  transaction.lastModifiedBy = auth.user!.id
                  await transaction.save()
                  transactionsCancelled++
                }
              }
            }
          }
        }
      }

      // 6. Log and commit
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CANCEL',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Reservation #${reservation.id} cancelled. Fee: ${cancellationFee}. `,
        ctx: ctx,
      })
      //log for guest
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CANCEL_RESERVATION',
        entityType: 'Guest',
        entityId: reservation.guestId,
        hotelId: reservation.hotelId,
        description: `Reservation #${reservation.id} cancelled. Fee: ${cancellationFee}. `,
        ctx: ctx,

      })

      await trx.commit()

      return response.ok({
        message: `Reservation cancelled. Fee: ${cancellationFee}`,
        cancellationFee: cancellationFee,
        refundAmount: cancellationFee,
        foliosClosed,
        transactionsCancelled,
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
            spQuery.where('room_type_id', roomType)
          })
        })
      }

      // Preload related data for the response
      query.andWhere('hotel_id', params.id)
        .whereNotNull('hotel_id')
        .preload('guest')
        .preload('roomType')
        .preload('bookingSource')
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
            spQuery.where('room_type_id', roomType)
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

      // Validate required fields - rooms are now optional
      if (!data.hotel_id || !data.arrived_date || !data.depart_date) {
        return response.badRequest({
          success: false,
          message: 'Missing required fields: hotel_id, arrived_date, depart_date'
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

      // Modified date validation to allow same day reservations with different times
      if (arrivedDate.toISODate() === departDate.toISODate()) {
        // Same day reservation - validate times
        if (!data.check_in_time || !data.check_out_time) {
          return response.badRequest({
            success: false,
            message: 'For same-day reservations, both arrival and departure times are required'
          })
        }

        const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
        const departureDateTime = DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)

        if (!arrivalDateTime.isValid || !departureDateTime.isValid) {
          return response.badRequest({
            success: false,
            message: 'Invalid time format. Use HH:mm format'
          })
        }

        if (departureDateTime <= arrivalDateTime) {
          return response.badRequest({
            success: false,
            message: 'Departure time must be after arrival time for same-day reservations'
          })
        }
      } else if (departDate <= arrivedDate) {
        return response.badRequest({
          success: false,
          message: 'Departure date must be after arrival date'
        })
      }

      const trx = await db.transaction()

      try {
        // Calculate number of nights - for same day, it's 0 (day use)
        let numberOfNights: number
        if (arrivedDate.toISODate() === departDate.toISODate()) {
          numberOfNights = 0 // Day use reservation
        } else {
          numberOfNights = Math.ceil(departDate.diff(arrivedDate, 'days').days)
        }

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

        // Calculate guest totals - handle case when rooms array is empty or undefined
        const rooms = data.rooms || []
        const totalAdults = rooms.reduce((sum: number, room: any) => sum + (parseInt(room.adult_count) || 0), 0)
        const totalChildren = rooms.reduce((sum: number, room: any) => sum + (parseInt(room.child_count) || 0), 0)

        // Validate room availability only if rooms are assigned
        if (rooms.length > 0) {
          for (const room of rooms) {
            if (room.room_id) {
              // For same-day reservations, check time overlap differently
              let existingReservation

              if (arrivedDate.toISODate() === departDate.toISODate()) {
                // Same day - check for time conflicts
                const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
                const departureDateTime = DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)

                existingReservation = await ReservationRoom.query({ client: trx })
                  .where('roomId', room.room_id)
                  .where('status', 'reserved')
                  .where('checkInDate', arrivedDate.toISODate())
                  .where('checkOutDate', departDate.toISODate())
                  .where((query) => {
                    // Check for time overlaps on the same day
                    query.where((subQuery) => {
                      subQuery
                        .whereBetween('checkInTime', [
                          arrivalDateTime.toFormat('HH:mm'),
                          departureDateTime.toFormat('HH:mm')
                        ])
                        .orWhereBetween('checkOutTime', [
                          arrivalDateTime.toFormat('HH:mm'),
                          departureDateTime.toFormat('HH:mm')
                        ])
                        .orWhere((overlapQuery) => {
                          overlapQuery
                            .where('checkInTime', '<=', arrivalDateTime.toFormat('HH:mm'))
                            .where('checkOutTime', '>=', departureDateTime.toFormat('HH:mm'))
                        })
                    })
                  })
                  .first()
              } else {
                // Multi-day reservation - check date overlap
                existingReservation = await ReservationRoom.query({ client: trx })
                  .where('roomId', room.room_id)
                  .where('status', 'reserved')
                  .where((query) => {
                    query.whereBetween('checkInDate', [arrivedDate.toISODate(), departDate.toISODate()])
                      .orWhereBetween('checkOutDate', [arrivedDate.toISODate(), departDate.toISODate()])
                      .orWhere((overlapQuery) => {
                        overlapQuery
                          .where('checkInDate', '<=', arrivedDate.toISODate())
                          .where('checkOutDate', '>=', departDate.toISODate())
                      })
                  })
                  .first()
              }

              if (existingReservation) {
                await trx.rollback()
                return response.badRequest({
                  success: false,
                  message: `Room ${room.room_id} is not available for the selected dates/times`
                })
              }
            }
          }
        }

        // Create reservation
        logger.info('Creating reservation with data: %o', guest)
        const reservation = await Reservation.create({
          hotelId: data.hotel_id,
          userId: auth.user?.id || data.created_by,
          arrivedDate: arrivedDate,
          departDate: departDate,
          checkInDate: data.arrived_time ? DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`) : arrivedDate,
          checkOutDate: data.depart_time ? DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`) : departDate,
          status: data.status || ReservationStatus.PENDING,
          guestCount: totalAdults + totalChildren,
          adults: totalAdults,
          children: totalChildren,
          checkInTime: data.check_in_time || data.arrived_time,
          checkOutTime: data.check_out_time || data.depart_time,
          totalAmount: parseFloat(`${data.total_amount ?? 0}`),
          taxAmount: parseFloat(`${data.tax_amount ?? 0}`),
          finalAmount: parseFloat(`${data.final_amount ?? 0}`),
          confirmationNumber: confirmationNumber,
          reservationNumber: reservationNumber,
          numberOfNights: numberOfNights,
          paidAmount: parseFloat(`${data.paid_amount ?? 0}`),
          remainingAmount: parseFloat(`${data.remaining_amount ?? 0}`),
          reservationTypeId: data.reservation_type_id,
          bookingSourceId: data.booking_source,
          businessSourceId: data.business_source,
          complimentaryRoom: data.complimentary_room,
          paymentStatus: 'pending',
          taxExempt: data.tax_exempt,
          isHold: data.isHold,
          holdReleaseDate: data.isHold && data.holdReleaseDate ? DateTime.fromISO(data.holdReleaseDate) : null,
          releaseTem: data.isHold ? data.ReleaseTem : null,
          releaseRemindGuestbeforeDays: data.isHold ? data.ReleaseRemindGuestbeforeDays : null,
          releaseRemindGuestbefore: data.isHold ? data.ReleaseRemindGuestbefore : null,
          reservedBy: auth.user?.id,
          createdBy: auth.user?.id,
        }, { client: trx })

        // Vérifier que la réservation a bien été créée avec un ID
        logger.info('Réservation créée avec ID:', reservation.id)
        if (!reservation.id) {
          throw new Error('La réservation n\'a pas pu être créée correctement - ID manquant')
        }

        // Process multiple guests for the reservation
        const { primaryGuest, allGuests } = await ReservationService.processReservationGuests(
          reservation.id,
          data,
          trx
        )

        // Mettre à jour la réservation avec l'ID du primary guest
        await reservation.merge({ guestId: primaryGuest.id }).useTransaction(trx).save()
        logger.info('Réservation mise à jour avec primary guest ID:', primaryGuest.id)

        // Réservations de chambres - only if rooms are provided
        if (rooms.length > 0) {
          for (let index = 0; index < rooms.length; index++) {
            const room = rooms[index]
            await ReservationRoom.create({
              reservationId: reservation.id,
              roomTypeId: room.room_type_id,
              roomId: room.room_id || null,
              guestId: primaryGuest.id,
              checkInDate: DateTime.fromISO(data.arrived_date),
              checkOutDate: DateTime.fromISO(data.depart_date),
              checkInTime: data.check_in_time,
              checkOutTime: data.check_out_time,
              nights: numberOfNights,
              adults: room.adult_count,
              children: room.child_count,
              roomRate: room.room_rate,
              roomRateId: room.room_rate_id,
              totalRoomCharges: numberOfNights === 0 ? room.room_rate : (room.room_rate * numberOfNights),
              taxAmount: room.taxes,
              totalTaxesAmount: numberOfNights === 0 ? room.taxes : (room.taxes * numberOfNights),
              netAmount: (numberOfNights === 0 ? room.room_rate : (room.room_rate * numberOfNights)) +
                (numberOfNights === 0 ? room.taxes : (room.taxes * numberOfNights)),
              status: 'reserved',
              isOwner: index === 0,
              createdBy: data.created_by,
            }, { client: trx })
          }
        }

        // Logging
        const guestCount = allGuests.length
        const guestDescription = guestCount > 1
          ? `${primaryGuest.firstName} ${primaryGuest.lastName} and ${guestCount - 1} other guest(s)`
          : `${primaryGuest.firstName} ${primaryGuest.lastName}`

        const reservationTypeDescription = numberOfNights === 0 ? 'day-use' :
          (rooms.length === 0 ? 'no-room' : 'overnight')

        const reservationId = Number(reservation.id);

        if (!isNaN(reservationId)) {
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'CREATE',
            entityType: 'Reservation',
            entityId: reservationId,
            hotelId: reservation.hotelId,
            description: `${reservationTypeDescription} reservation #${reservationId} was created for ${guestDescription} (${guestCount} total guests)${rooms.length === 0 ? ' without room assignment' : ''}.`,
            ctx,
          });
        }

        const guestId = Number(guest.id);
        if (!isNaN(guestId)) {
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'RESERVATION_CREATED',
            entityType: 'Guest',
            entityId: guestId,
            hotelId: reservation.hotelId,
            description: `Une nouvelle réservation ${reservationTypeDescription} #${reservation.reservationNumber} a été créée.`,
            meta: {
              reservationId: reservation.id,
              reservationNumber: reservation.reservationNumber,
              reservationType: reservationTypeDescription,
              hasRooms: rooms.length > 0,
              dates: {
                arrival: reservation.arrivedDate?.toISODate(),
                departure: reservation.departDate?.toISODate(),
                arrivalTime: data.arrived_time,
                departureTime: data.depart_time,
              },
            },
            ctx,
          });
        } else {
          console.warn('ID invité invalide. Impossible de créer l\'entrée de journal d\'activité pour l\'invité.');
        }

        await trx.commit()

        // Create folios if reservation is confirmed and has rooms
        let folios: any[] = []
        if (rooms.length > 0) {
          folios = await ReservationFolioService.createFoliosOnConfirmation(
            reservation.id,
            auth.user?.id!
          )

          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'CREATE_FOLIOS',
            entityType: 'Reservation',
            entityId: reservation.id,
            hotelId: reservation.hotelId,
            description: `Created ${folios.length} folio(s) with room charges for confirmed reservation #${reservation.id}.`,
            ctx,
          })

          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'FOLIOS_CREATED',
            entityType: 'Guest',
            entityId: guest.id,
            hotelId: reservation.hotelId,
            description: `${folios.length} folio(s) were created for reservation #${reservation.reservationNumber}.`,
            meta: {
              reservationId: reservation.id,
              folioIds: folios.map(f => f.id),
            },
            ctx,
          });
        }

        const responseData: any = {
          success: true,
          reservationId: reservation.id,
          confirmationNumber,
          reservationType: reservationTypeDescription,
          isDayUse: numberOfNights === 0,
          hasRooms: rooms.length > 0,
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
          message: `${reservationTypeDescription} reservation created successfully with ${allGuests.length} guest(s)${rooms.length === 0 ? ' (no room assigned)' : ''}`
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
   * Override the update method to handle reservation confirmation and folio creation
   */
  public async update(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
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
      const updateResponse = await super.update(ctx)
      const reservation = await Reservation.findOrFail(reservationId)

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
            hotelId: reservation.hotelId,
            description: `Reservation #${reservationId} confirmed. Created ${folios.length} folio(s) with room charges.`,
            ctx,
          })
          //for guest
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CONFIRM_RESERVATION',
            entityType: 'Guest',
            entityId: reservation.guestId,
            hotelId: reservation.hotelId,
            description: `Reservation #${reservationId} confirmed. Created ${folios.length} folio(s) with room charges.`,
            ctx,
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
  public async addPayment(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
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
          folioType: FolioType.GUEST,
          status: FolioStatus.OPEN,
          settlementStatus: SettlementStatus.PENDING,
          workflowStatus: WorkflowStatus.ACTIVE,
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
        transactionType: TransactionType.PAYMENT,
        category: TransactionCategory.PAYMENT,
        particular: 'Payment Received',
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
      }).useTransaction(trx).save()

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
          await reservation.merge({ paymentStatus: newPaymentStatus }).useTransaction(trx).save()
        }
      }

      await trx.commit()
      //log for guest
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'ADD_PAYMENT',
        entityType: 'Guest',
        entityId: reservation.guestId,
        hotelId: reservation.hotelId,
        description: `Payment of ${amount} ${currencyCode} added to reservation #${reservation.reservationNumber} via ${paymentMethod.methodName}.`,
        meta: {
          paymentId: transaction.id,
          transactionNumber: transaction.transactionNumber,
          method: paymentMethod.methodName,
          amount: amount,
          currency: currencyCode,
        },
        ctx
      })


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
        selectedRooms,
        newArrivalDate,
        newDepartureDate,
        newRoomTypeId,
        newNumAdults,
        newNumChildren,
        newSpecialNotes,
        reason
      } = request.all()

      // 🔎 Charger la réservation
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

      // 🚦 Vérifier si la réservation est amendable
      const allowedStatuses = ['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in']
      if (!allowedStatuses.includes(reservation.status.toLowerCase())) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot amend reservation with status: ${reservation.reservationStatus}`
        })
      }

      // 📌 Sauvegarder l'état initial
      const originalData = {
        arrivalDate: reservation.arrivedDate,
        departureDate: reservation.departDate,
        roomTypeId: reservation.roomTypeId,
        numAdults: reservation.numAdultsTotal,
        numChildren: reservation.numChildrenTotal,
        specialNotes: reservation.specialNotes,
        rooms: reservation.reservationRooms.map((rr) => ({
          id: rr.roomId,
          checkInDate: rr.checkInDate,
          checkOutDate: rr.checkOutDate,
          roomTypeId: rr.roomTypeId,
          nights: rr.nights,
          totalRoomCharges: rr.totalRoomCharges,
          totalTaxesAmount: rr.totalTaxesAmount,
          netAmount: rr.netAmount
        }))
      }

      // 📌 Vérification des dates
      let newArrivalDateTime
      let newDepartureDateTime

      if (newArrivalDate || newDepartureDate) {
        newArrivalDateTime = newArrivalDate ? DateTime.fromISO(newArrivalDate) : reservation.arrivedDate
        newDepartureDateTime = newDepartureDate ? DateTime.fromISO(newDepartureDate) : reservation.departDate

        if (newArrivalDateTime && newDepartureDateTime && newArrivalDateTime >= newDepartureDateTime) {
          await trx.rollback()
          return response.badRequest({ message: 'Arrival date must be before departure date' })
        }
      }

      // 📌 Vérification du type de chambre
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

      // =============================
      // 🎯 AMENDEMENT DES CHAMBRES UNIQUEMENT
      // =============================

      // 🔹 Cas 1 : Amendement global (toutes les chambres)
      if (!selectedRooms || selectedRooms.length === 0) {
        // 🔄 Mise à jour de toutes les chambres liées
        if (reservation.reservationRooms.length > 0) {
          for (const reservationRoom of reservation.reservationRooms) {
            const roomUpdateData: any = {
              lastModifiedBy: auth.user?.id!
            }

            // Mise à jour des dates si spécifiées
            if (newArrivalDate) {
              roomUpdateData.checkInDate = DateTime.fromISO(newArrivalDate)
            }
            if (newDepartureDate) {
              roomUpdateData.checkOutDate = DateTime.fromISO(newDepartureDate)
            }
            if (newRoomTypeId) {
              roomUpdateData.roomTypeId = newRoomTypeId
            }

            // Recalculer le nombre de nuits et les montants
            if (newArrivalDate || newDepartureDate) {
              const checkInDate = newArrivalDate ? DateTime.fromISO(newArrivalDate) : reservationRoom.checkInDate
              const checkOutDate = newDepartureDate ? DateTime.fromISO(newDepartureDate) : reservationRoom.checkOutDate

              const numberOfNights = checkInDate.toISODate() === checkOutDate.toISODate()
                ? 0 // Day use
                : Math.ceil(checkOutDate.diff(checkInDate, 'days').days)

              roomUpdateData.nights = numberOfNights

              // Recalculer les montants basés sur le nouveau nombre de nuits
              const roomRate = reservationRoom.roomRate || 0
              const taxPerNight = reservationRoom.taxAmount ? (reservationRoom.taxAmount / (reservationRoom.nights || 1)) : 0

              if (numberOfNights === 0) {
                // Day use - pas de multiplication par nuits
                roomUpdateData.totalRoomCharges = roomRate
                roomUpdateData.totalTaxesAmount = taxPerNight
              } else {
                // Séjour normal - multiplier par le nombre de nuits
                roomUpdateData.totalRoomCharges = roomRate * numberOfNights
                roomUpdateData.totalTaxesAmount = taxPerNight * numberOfNights
              }

              roomUpdateData.netAmount = roomUpdateData.totalRoomCharges + roomUpdateData.totalTaxesAmount
            }

            await reservationRoom.merge(roomUpdateData).useTransaction(trx).save()
          }
        }
      }

      // 🔹 Cas 2 : Amendement chambre par chambre
      else {
        // Cibler les chambres sélectionnées
        const targetRooms = reservation.reservationRooms.filter(rr => selectedRooms.includes(rr.roomId))

        if (targetRooms.length === 0) {
          await trx.rollback()
          return response.badRequest({ message: "No valid rooms selected for amendment" })
        }

        for (const reservationRoom of targetRooms) {
          const roomUpdateData: any = {
            lastModifiedBy: auth.user?.id || 1
          }

          let checkInDate = reservationRoom.checkInDate
          let checkOutDate = reservationRoom.checkOutDate

          if (newArrivalDate) {
            checkInDate = DateTime.fromISO(newArrivalDate)
            roomUpdateData.checkInDate = checkInDate
          }
          if (newDepartureDate) {
            checkOutDate = DateTime.fromISO(newDepartureDate)
            roomUpdateData.checkOutDate = checkOutDate
          }
          if (newRoomTypeId) {
            roomUpdateData.roomTypeId = newRoomTypeId
          }

          // Recalculer le nombre de nuits et les montants
          if (newArrivalDate || newDepartureDate) {
            const numberOfNights = checkInDate.toISODate() === checkOutDate.toISODate()
              ? 0 // Day use
              : Math.ceil(checkOutDate.diff(checkInDate, 'days').days)

            roomUpdateData.nights = numberOfNights

            // Recalculer les montants basés sur le nouveau nombre de nuits
            const roomRate = reservationRoom.roomRate || 0
            const taxPerNight = reservationRoom.taxAmount ? (reservationRoom.taxAmount / (reservationRoom.nights || 1)) : 0

            if (numberOfNights === 0) {
              // Day use - pas de multiplication par nuits
              roomUpdateData.totalRoomCharges = roomRate
              roomUpdateData.totalTaxesAmount = taxPerNight
            } else {
              // Séjour normal - multiplier par le nombre de nuits
              roomUpdateData.totalRoomCharges = roomRate * numberOfNights
              roomUpdateData.totalTaxesAmount = taxPerNight * numberOfNights
            }

            roomUpdateData.netAmount = roomUpdateData.totalRoomCharges + roomUpdateData.totalTaxesAmount
          }

          await reservationRoom.merge(roomUpdateData).useTransaction(trx).save()
        }
      }

      // 📌 Mise à jour uniquement du lastModifiedBy sur la réservation principale
      await reservation.merge({
        lastModifiedBy: auth.user?.id || 1
      }).useTransaction(trx).save()

      const auditData = {
        reservationId: reservation.id,
        action: 'amend_stay',
        performedBy: auth.user?.id || 1,
        originalData: originalData,
        newData: {
          selectedRooms,
          newArrivalDate,
          newDepartureDate,
          newRoomTypeId,
          newNumAdults,
          newNumChildren,
          newSpecialNotes
        },
        reason: reason || 'Stay amendment requested',
        timestamp: DateTime.now()
      }

      console.log('Reservation Amendment:', auditData)

      //  Mise à jour des folios si la réservation a des folios existants
      if (reservation.folios && reservation.folios.length > 0) {
        await this.updateFoliosAfterAmendment(reservation, trx, auth.user?.id || 1)
      }

      // 🔄 Recharger réservation mise à jour
      const updatedReservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .first()

      await trx.commit()

      return response.ok({
        message: 'Stay amended successfully',
        reservationId: reservationId,
        changes: {
          originalData,
          newData: auditData.newData
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
      const newRoom = await Room.query({ client: trx })
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
      const checkOutDate = reservation.departDate

      const conflictingReservation = await ReservationRoom.query({ client: trx })
        .where('room_id', newRoomId)
        .where('status', 'reserved')
        .where((query) => {
          query.where((subQuery) => {
            subQuery.where('check_in_date', '<=', moveDate.toISODate()!)
              .where('check_out_date', '>', moveDate.toISODate()!)
          })
            .orWhere((subQuery) => {
              subQuery.where('check_in_date', '<', checkOutDate?.toISODate()!)
                .where('check_out_date', '>=', checkOutDate?.toISODate()!)
            })
            .orWhere((subQuery) => {
              subQuery.where('check_in_date', '>=', moveDate?.toISODate()!)
                .where('check_out_date', '<=', checkOutDate?.toISODate()!)
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
      }).useTransaction(trx).save()

      // Create new reservation room record for the new room
      const newReservationRoom = await ReservationRoom.create({
        reservationId: reservation.id,
        roomId: newRoomId,
        roomTypeId: newRoom.roomTypeId,
        checkInDate: moveDate,
        checkOutDate: reservation.departDate,
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
        }).useTransaction(trx).save()
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
          checkIn: reservation.arrivedDate,
          checkOut: reservation.departDate
        }
        const reservation2Dates = {
          checkIn: targetReservation.arrivedDate,
          checkOut: targetReservation.departDate
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
        }).useTransaction(trx).save()

        await targetReservationRoom.merge({
          roomId: currentReservationRoom.roomId,
          roomTypeId: currentReservationRoom.room.roomTypeId,
          lastModifiedBy: auth.user?.id || 1,
          notes: `Room swapped with reservation ${reservationId}. Reason: ${reason || 'Room exchange requested'}`
        }).useTransaction(trx).save()

        // Update primary room types if needed
        if (targetReservationRoom.room.roomTypeId !== reservation.primaryRoomTypeId) {
          await reservation.merge({
            primaryRoomTypeId: targetReservationRoom.room.roomTypeId,
            lastModifiedBy: auth.user?.id || 1
          }).useTransaction(trx).save()
        }

        if (currentReservationRoom.room.roomTypeId !== targetReservation.primaryRoomTypeId) {
          await targetReservation.merge({
            primaryRoomTypeId: currentReservationRoom.room.roomTypeId,
            lastModifiedBy: auth.user?.id || 1
          }).useTransaction(trx).save()
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
        const newRoom = await Room.query({ client: trx })
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
              subQuery.where('check_in_date', '<=', reservation.arrivedDate?.toISODate()!)
                .where('check_out_date', '>', reservation.arrivedDate?.toISODate()!)
            })
              .orWhere((subQuery) => {
                subQuery.where('check_in_date', '<', reservation.departDate?.toISODate()!)
                  .where('check_out_date', '>=', reservation.departDate?.toISODate()!)
              })
              .orWhere((subQuery) => {
                subQuery.where('check_in_date', '>=', reservation.arrivedDate?.toISODate()!)
                  .where('check_out_date', '<=', reservation.departDate?.toISODate()!)
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
        }).useTransaction(trx).save()

        // Update reservation's primary room type if different
        if (newRoom.roomTypeId !== reservation.primaryRoomTypeId) {
          await reservation.merge({
            primaryRoomTypeId: newRoom.roomTypeId,
            lastModifiedBy: auth.user?.id || 1
          }).useTransaction(trx).save()
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
      const { reason, notes, noShowFees } = request.only(['reason', 'notes', 'noShowFees'])

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
      const activeRoom = reservation.reservationRooms.find(room => room.status === 'checked_in')
      const movedOutRoom = reservation.reservationRooms.find(room => room.status === 'moved_out')

      if (!activeRoom || !movedOutRoom) {
        await trx.rollback()
        return response.badRequest({
          message: 'No active room move found to stop. Room move may have already been completed or cancelled.'
        })
      }

      // Check if the move is recent enough to be stopped (within reasonable timeframe)
      const moveTime = activeRoom.createdAt
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
        status: 'checked_in',
        lastModifiedBy: auth.user?.id,
        updatedAt: now
      }).save()

      // 2. Remove/cancel the new room assignment
      await activeRoom.useTransaction(trx).merge({
        status: 'cancelled',
        lastModifiedBy: auth.user?.id,
        updatedAt: now
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

  // public async markNoShow({ params, request, response, auth }: HttpContext) {
  //   const trx = await db.transaction()

  //   try {
  //     const { reservationId } = params
  //     const { reason, notes,noShowFees } = request.only(['reason', 'notes','noShowFees'])

  //     // Validate reservation ID
  //     if (!reservationId) {
  //       await trx.rollback()
  //       return response.badRequest({ message: 'Reservation ID is required' })
  //     }

  //     // Get the reservation with related data
  //     const reservation = await Reservation.query({ client: trx })
  //       .where('id', reservationId)
  //       .preload('reservationRooms')
  //       .first()

  //     if (!reservation) {
  //       await trx.rollback()
  //       return response.badRequest({ message: 'Reservation not found' })
  //     }

  //     // Check if reservation can be marked as no-show
  //     const allowedStatuses = ['confirmed', 'checked_in', 'pending']
  //     if (!allowedStatuses.includes(reservation.status)) {
  //       await trx.rollback()
  //       return response.badRequest({
  //         message: `Cannot mark reservation as no-show. Current status: ${reservation.status}`
  //       })
  //     }

  //     // Check if arrival date has passed (no-show typically applies after expected arrival)
  //     const now = DateTime.now()
  //     const arrivalDate = reservation.arrivedDate!

  //     if (now < arrivalDate) {
  //       await trx.rollback()
  //       return response.badRequest({
  //         message: 'Cannot mark as no-show before arrival date'
  //       })
  //     }

  //     // Store original status for audit
  //     const originalStatus = reservation.status

  //     // Update reservation status to no-show
  //     await reservation.useTransaction(trx).merge({
  //       status: ReservationStatus.NOSHOW,
  //       noShowDate: now,
  //       noShowReason: reason || 'Guest did not arrive',
  //       noShowFees: noShowFees??0,
  //       markNoShowBy: auth.user?.id,
  //       lastModifiedBy: auth.user?.id
  //     }).save()

  //     // Get all folios for this reservation
  //     const folios = await Folio.query({ client: trx })
  //       .where('reservationId', reservationId)
  //       .where('status', '!=', 'voided')

  //     // Process each folio
  //     for (const folio of folios) {
  //       // Post no-show fees if applicable
  //       if (noShowFees && noShowFees > 0) {
  //         await FolioService.postTransaction({
  //           folioId: folio.id,
  //           transactionType: TransactionType.CHARGE,
  //           category: TransactionCategory.NO_SHOW_FEE,
  //           description: `No-show fee - ${reason || 'Guest did not arrive'}`,
  //           amount: noShowFees,
  //           quantity: 1,
  //           unitPrice: noShowFees,
  //           reference: `NOSHOW-${reservation.reservationNumber}`,
  //           notes: `No-show fee applied on ${now.toISODate()}`,
  //           postedBy: auth.user?.id!
  //         })
  //       }

  //       // Void all existing transactions in the folio
  //       const activeTransactions = await FolioTransaction.query({ client: trx })
  //         .where('folioId', folio.id)
  //         .where('status', '!=', 'voided')
  //         //.where('isVoided', false)

  //       for (const transaction of activeTransactions) {
  //         // Create void transaction
  //         await FolioService.postTransaction({
  //           folioId: folio.id,
  //           transactionType: TransactionType.VOID,
  //           category: TransactionCategory.VOID,
  //           description: `Void: ${transaction.description} (No-show)`,
  //           amount: -transaction.amount, // Negative to reverse the original
  //           quantity: 1,
  //           unitPrice: -transaction.amount,
  //           reference: `VOID-${transaction.transactionNumber}`,
  //           notes: `Voided due to no-show: ${reason || 'Guest did not arrive'}`,
  //           postedBy: auth.user?.id!
  //         })

  //         // Mark original transaction as voided
  //         await transaction.useTransaction(trx).merge({
  //           //isVoided: true,
  //           voidedDate: now,
  //           voidReason: 'No-show reservation',
  //           voidedBy: auth.user?.id
  //         }).save()
  //       }

  //       // Balance the folio - ensure zero balance after voiding and fees
  //       await folio.useTransaction(trx).refresh()
  //       const currentBalance = folio.balance

  //       if (Math.abs(currentBalance) > 0.01) {
  //         // Create balancing adjustment
  //         const adjustmentAmount = -currentBalance
  //         await FolioService.postTransaction({
  //           folioId: folio.id,
  //           transactionType: TransactionType.ADJUSTMENT,
  //           category: TransactionCategory.ADJUSTMENT,
  //           description: `Balancing adjustment - No-show processing`,
  //           amount: adjustmentAmount,
  //           quantity: 1,
  //           unitPrice: adjustmentAmount,
  //           reference: `BAL-${reservation.reservationNumber}`,
  //           notes: `Balancing adjustment to zero balance after no-show processing`,
  //           postedBy: auth.user?.id!
  //         })
  //       }

  //       // Update folio status to voided
  //       await folio.useTransaction(trx).merge({
  //         status: FolioStatus.VOIDED,
  //         voidedDate: now,
  //         voidReason: `No-show reservation: ${reason || 'Guest did not arrive'}`,
  //         lastModifiedBy: auth.user?.id
  //       }).save()
  //     }

  //     // Update all associated reservation rooms to no-show status
  //     await ReservationRoom.query({ client: trx })
  //       .where('reservationId', reservationId)
  //       .update({
  //         status: 'no_show',
  //         lastModifiedBy: auth.user?.id,
  //         updatedAt: now.toJSDate()
  //       })

  //     // Create audit log
  //     await LoggerService.logActivity({
  //       userId: auth.user?.id,
  //       action: 'mark_no_show',
  //       resourceType: 'reservation',
  //       resourceId: reservationId,
  //       details: {
  //         originalStatus,
  //         newStatus: 'no_show',
  //         reason: reason || 'Guest did not arrive',
  //         notes,
  //         noShowDate: now.toISO(),
  //         noShowFees: noShowFees || null,
  //         markNoShowBy: auth.user?.id,
  //         reservationNumber: reservation.reservationNumber
  //       },
  //       ipAddress: request.ip(),
  //       userAgent: request.header('user-agent')
  //     }, trx)

  //     await trx.commit()

  //     return response.ok({
  //       message: 'Reservation marked as no-show successfully',
  //       reservationId: params.reservationId,
  //       data: {
  //         reservationNumber: reservation.reservationNumber,
  //         status: 'no_show',
  //         noShowDate: now.toISO(),
  //         reason: reason || 'Guest did not arrive',
  //         noShowFees: noShowFees || null,
  //         markNoShowBy: auth.user?.id
  //       }
  //     })
  //   } catch (error) {
  //     await trx.rollback()
  //     return response.badRequest({ message: 'Failed to mark as no-show', error: error.message })
  //   }
  // }

  public async markNoShow({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()

    try {
      const { reservationId } = params
      const { selectedRooms = [], reason, notes, noShowFees = 0 } = request.only([
        'selectedRooms',
        'reason',
        'notes',
        'noShowFees'
      ])

      // Vérification reservationId
      if (!reservationId) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation ID is required' })
      }

      // Charger la réservation et ses chambres
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms')
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation not found' })
      }

      // Vérifier si le statut permet le no-show
      const allowedStatuses = ['confirmed', 'checked_in', 'pending']
      if (!allowedStatuses.includes(reservation.status)) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot mark reservation as no-show. Current status: ${reservation.status}`
        })
      }

      // Vérifier que la date d’arrivée est passée
      const now = DateTime.now()
      const arrivalDate = reservation.arrivedDate!
      if (now < arrivalDate) {
        await trx.rollback()
        return response.badRequest({ message: 'Cannot mark as no-show before arrival date' })
      }

      // Vérifier si toutes les chambres sont sélectionnées
      const allRoomsSelected = selectedRooms.length === reservation.reservationRooms.length

      // Sauvegarder l'ancien statut pour l'audit
      const originalStatus = reservation.status

      // CAS 1 : NO-SHOW TOTAL
      if (allRoomsSelected) {
        await reservation
          .useTransaction(trx)
          .merge({
            status: ReservationStatus.NOSHOW,
            noShowDate: now,
            noShowReason: reason || 'Group did not arrive',
            noShowFees,
            markNoShowBy: auth.user?.id,
            lastModifiedBy: auth.user?.id
          })
          .save()

        // Toutes les chambres en no_show
        await ReservationRoom.query({ client: trx })
          .where('reservationId', reservationId)
          .update({
            status: 'no_show',
            lastModifiedBy: auth.user?.id,
            updatedAt: now.toJSDate()
          })
      }

      // CAS 2 : NO-SHOW PARTIEL
      else {
        // Marquer uniquement certaines chambres
        for (const room of reservation.reservationRooms) {
          if (selectedRooms.includes(room.roomId)) {
            room.status = 'no_show'
            room.lastModifiedBy = auth.user!.id
            await room.useTransaction(trx).save()

            // Libérer la chambre physique
            const physicalRoom = await Room.find(room.roomId)
            if (physicalRoom) {
              physicalRoom.status = 'available'
              physicalRoom.lastModifiedBy = auth.user!.id
              await physicalRoom.useTransaction(trx).save()
            }
          }
        }

        // Mettre le statut global de la réservation en "partially_no_show"
        await reservation
          .useTransaction(trx)
          .merge({
            status: 'partially_no_show',
            lastModifiedBy: auth.user?.id
          })
          .save()
      }

      // --- Gestion des folios ---
      const folios = await Folio.query({ client: trx })
        .where('reservationId', reservationId)
        .where('status', '!=', 'voided')

      for (const folio of folios) {
        // Appliquer les frais : total ou par chambre
        const totalNoShowFees = allRoomsSelected
          ? noShowFees
          : noShowFees * selectedRooms.length

        if (totalNoShowFees > 0) {
          await FolioService.postTransaction({
            folioId: folio.id,
            transactionType: TransactionType.CHARGE,
            category: TransactionCategory.NO_SHOW_FEE,
            description: `No-show fee - ${reason || 'Guest did not arrive'}`,
            amount: totalNoShowFees,
            quantity: 1,
            unitPrice: totalNoShowFees,
            reference: `NOSHOW-${reservation.reservationNumber}`,
            notes: `No-show fee applied on ${now.toISODate()}`,
            postedBy: auth.user?.id!
          })
        }

        // Annuler toutes les transactions existantes
        const activeTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', folio.id)
          .where('status', '!=', 'voided')

        for (const transaction of activeTransactions) {
          await FolioService.postTransaction({
            folioId: folio.id,
            transactionType: TransactionType.VOID,
            category: TransactionCategory.VOID,
            description: `Void: ${transaction.description} (No-show)`,
            amount: -transaction.amount,
            quantity: 1,
            unitPrice: -transaction.amount,
            reference: `VOID-${transaction.transactionNumber}`,
            notes: `Voided due to no-show: ${reason || 'Guest did not arrive'}`,
            postedBy: auth.user?.id!
          })

          await transaction
            .useTransaction(trx)
            .merge({
              voidedDate: now,
              voidReason: 'No-show reservation',
              voidedBy: auth.user?.id
            })
            .save()
        }

        // Vérifier le solde et équilibrer si besoin
        await folio.useTransaction(trx).refresh()
        const currentBalance = folio.balance
        if (Math.abs(currentBalance) > 0.01) {
          const adjustmentAmount = -currentBalance
          await FolioService.postTransaction({
            folioId: folio.id,
            transactionType: TransactionType.ADJUSTMENT,
            category: TransactionCategory.ADJUSTMENT,
            description: `Balancing adjustment - No-show processing`,
            amount: adjustmentAmount,
            quantity: 1,
            unitPrice: adjustmentAmount,
            reference: `BAL-${reservation.reservationNumber}`,
            notes: `Balancing adjustment after no-show processing`,
            postedBy: auth.user?.id!
          })
        }

        // Mettre le folio en "voided"
        await folio
          .useTransaction(trx)
          .merge({
            status: FolioStatus.VOIDED,
            voidedDate: now,
            voidReason: `No-show reservation: ${reason || 'Guest did not arrive'}`,
            lastModifiedBy: auth.user?.id
          })
          .save()
      }

      // --- Audit log ---
      await LoggerService.logActivity(
        {
          userId: auth.user?.id,
          action: 'mark_no_show',
          resourceType: 'reservation',
          resourceId: reservationId,
          details: {
            originalStatus,
            newStatus: reservation.status,
            reason: reason || 'Guest did not arrive',
            notes,
            noShowDate: now.toISO(),
            noShowFees: noShowFees || null,
            markNoShowBy: auth.user?.id,
            reservationNumber: reservation.reservationNumber
          },
          ipAddress: request.ip(),
          userAgent: request.header('user-agent')
        },
        trx
      )

      await trx.commit()

      return response.ok({
        message: 'Reservation marked as no-show successfully',
        reservationId: reservation.id,
        data: {
          reservationNumber: reservation.reservationNumber,
          status: reservation.status,
          noShowDate: now.toISO(),
          reason: reason || 'Guest did not arrive',
          noShowFees: noShowFees || null,
          markNoShowBy: auth.user?.id
        }
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to mark as no-show',
        error: error.message
      })
    }
  }


  /**
   * new Void reservation
   */
  public async voidReservation({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()

    try {
      const { reservationId } = params
      const requestBody = request.body()
      const { reason, selectedReservations } = requestBody

      // Debug logging
      console.log('Void reservation params:', { reservationId })
      console.log('Void reservation body:', requestBody)
      console.log('Selected reservations:', selectedReservations)
      console.log('Reason:', reason)

      // Validate required fields
      if (!reason || reason.trim() === '') {
        await trx.rollback()
        return response.badRequest({ message: 'Void reason is required' })
      }

      // Validate reservationId is a valid number
      const numericReservationId = parseInt(reservationId)
      if (isNaN(numericReservationId)) {
        await trx.rollback()
        return response.badRequest({ message: 'Invalid reservation ID' })
      }

      // Get reservation with related data including folios and reservation rooms
      const reservation = await Reservation.query({ client: trx })
        .where('id', numericReservationId)
        .preload('reservationRooms')
        .preload('folios')
        .first()

      console.log('Found reservation:', reservation ? reservation.id : 'null')
      console.log('Reservation rooms:', reservation?.reservationRooms?.length || 0)

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

      // Determine which rooms to void
      let roomsToVoid: string[] = []
      const isPartialVoid = selectedReservations && Array.isArray(selectedReservations) && selectedReservations.length > 0

      console.log('Is partial void:', isPartialVoid)

      if (isPartialVoid) {
        // Partial void - void only selected rooms
        // Convert to strings for consistency
        roomsToVoid = selectedReservations.map(id => id.toString())

        console.log('Rooms to void:', roomsToVoid)
        console.log('Available reservation room IDs:', reservation.reservationRooms.map(rr => rr.roomId.toString()))

        // Validate that selected rooms belong to this reservation
        const reservationRoomIds = reservation.reservationRooms.map(rr => rr.roomId.toString())
        const invalidRooms = roomsToVoid.filter(roomId => !reservationRoomIds.includes(roomId))

        console.log('Invalid rooms:', invalidRooms)

        if (invalidRooms.length > 0) {
          await trx.rollback()
          return response.badRequest({
            message: `Invalid room selections. Rooms ${invalidRooms.join(', ')} do not belong to this reservation. Available rooms: ${reservationRoomIds.join(', ')}`
          })
        }
      } else {
        // Full reservation void - void all rooms
        roomsToVoid = reservation.reservationRooms.map(rr => rr.roomId.toString())
        console.log('Full void - all rooms:', roomsToVoid)
      }

      // Handle folio changes
      let foliosVoided = 0
      if (isPartialVoid) {
        // For partial void, we need to handle folios more carefully
        // You might want to void only transactions related to specific rooms
        // This depends on your business logic - for now, we'll keep folios open for partial voids
        console.log('Partial void detected - folios kept open for remaining rooms')
      } else {
        // Full reservation void - void all related folios
        if (reservation.folios && reservation.folios.length > 0) {
          for (const folio of reservation.folios) {
            // Only void open folios
            if (folio.status === 'open') {
              await folio.useTransaction(trx).merge({
                status: FolioStatus.VOIDED,
                workflowStatus: WorkflowStatus.CLOSED,
                lastModifiedBy: auth.user?.id
              }).save()

              // Void all transactions in the folio
              await FolioTransaction.query({ client: trx })
                .where('folioId', folio.id)
                .where('status', '!=', 'voided')
                .update({
                  status: TransactionStatus.VOIDED,
                  voidedDate: DateTime.now(),
                  voidReason: `Reservation voided: ${reason}`,
                  lastModifiedBy: auth.user?.id,
                  updatedAt: DateTime.now()
                })

              foliosVoided++
            }
          }
        }
      }

      // Update reservation status (only if it's a full void)
      if (!isPartialVoid) {
        await reservation.useTransaction(trx).merge({
          status: ReservationStatus.VOIDED,
          voidedDate: DateTime.now(),
          voidReason: reason,
          voidedBy: auth.user?.id,
          lastModifiedBy: auth.user?.id
        }).save()
      }

      // Update selected reservation rooms to voided status
      console.log('About to update ReservationRoom IDs:', roomsToVoid)
      const roomsUpdated = await ReservationRoom.query({ client: trx })
        .whereIn('roomId', roomsToVoid)
        .where('reservationId', numericReservationId) // Extra security check
        .update({
          status: 'voided',
          voided_date: DateTime.now(),
          void_reason: reason,
          lastModifiedBy: auth.user?.id,
          updatedAt: DateTime.now()
        })

      console.log('Rooms updated count:', roomsUpdated)

      // Get room details for response
      const voidedRooms = await ReservationRoom.query({ client: trx })
        .whereIn('id', roomsToVoid)

      const roomNumbers = voidedRooms.map(rr => rr.roomId).filter(Boolean)

      // Check if all rooms are voided (to update reservation status)
      const remainingActiveRooms = await ReservationRoom.query({ client: trx })
        .where('reservationId', numericReservationId)
        .where('status', '!=', 'voided')

      console.log('Remaining active rooms:', remainingActiveRooms.length)

      const allRoomsVoided = remainingActiveRooms.length === 0

      // If all rooms are voided and reservation wasn't already voided, void the reservation
      if (allRoomsVoided && reservation.status !== ReservationStatus.VOIDED) {
        await reservation.useTransaction(trx).merge({
          status: ReservationStatus.VOIDED,
          voidedDate: DateTime.now(),
          voidReason: reason,
          voidedBy: auth.user?.id,
          lastModifiedBy: auth.user?.id
        }).save()

        // Also void all folios if not already done
        if (isPartialVoid && reservation.folios && reservation.folios.length > 0) {
          for (const folio of reservation.folios) {
            if (folio.status === 'open') {
              await folio.useTransaction(trx).merge({
                status: FolioStatus.VOIDED,
                workflowStatus: WorkflowStatus.CLOSED,
                lastModifiedBy: auth.user?.id
              }).save()

              await FolioTransaction.query({ client: trx })
                .where('folioId', folio.id)
                .where('status', '!=', 'voided')
                .update({
                  status: TransactionStatus.VOIDED,
                  voidedDate: DateTime.now(),
                  voidReason: `All rooms voided: ${reason}`,
                  lastModifiedBy: auth.user?.id,
                  updatedAt: DateTime.now()
                })

              foliosVoided++
            }
          }
        }
      }

      // Create audit log
      /*   await LoggerService.log({
           userId: auth.user?.id,
           action: isPartialVoid ? 'reservation_rooms_voided' : 'reservation_voided',
           entityType: 'reservation',
           entityId: reservationId,
           details: {
             originalStatus,
             newStatus: allRoomsVoided ? 'voided' : 'partially_voided',
             reason,
             voidedDate: DateTime.now().toISO(),
             roomsVoided: roomsToVoid,
             totalRoomsInReservation: reservation.reservationRooms.length,
             isPartialVoid,
             allRoomsVoided,
             foliosVoided
           },
           ipAddress: request.ip(),
           userAgent: request.header('user-agent')
         })*/

      await trx.commit()

      const message = isPartialVoid
        ? allRoomsVoided
          ? 'All rooms voided - reservation completed'
          : `${roomsToVoid.length} room(s) voided successfully`
        : 'Reservation voided successfully'

      return response.ok({
        message,
        reservationId,
        isPartialVoid,
        allRoomsVoided,
        roomsVoided: roomNumbers,
        voidDetails: {
          originalStatus,
          currentStatus: allRoomsVoided ? 'voided' : (isPartialVoid ? 'partially_voided' : 'voided'),
          voidedDate: DateTime.now().toISO(),
          reason,
          roomsVoidedCount: roomsToVoid.length,
          totalRoomsInReservation: reservation.reservationRooms.length,
          foliosVoided,
          voidedRoomIds: roomsToVoid
        }
      })

    } catch (error) {
      await trx.rollback()
      logger.error('Error voiding reservation rooms:', error)
      return response.badRequest({
        message: 'Failed to void reservation/rooms',
        error: error.message
      })
    }
  }


  public async unassignRoom(ctx: HttpContext) {
    const trx = await db.transaction()
    const { params, request, response, auth } = ctx
    try {
      const { reservationId } = params
      const { reservationRooms, actualCheckInTime, } = request.body()

      // Validate required fields
      if (!reservationRooms) {
        await trx.rollback()
        return response.badRequest({ message: 'Room ID is required' })
      }


      // Get reservation with related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.whereIn('id', reservationRooms).where('status', 'reserved')
        })
        .first()
      console.log('Reservation trouvée:', reservation)


      if (!reservation) {
        console.log('Erreur : réservation non trouvée')
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Check if reservation allows room unassignment
      const allowedStatuses = ['confirmed', 'pending']
      if (!allowedStatuses.includes(reservation.status)) {
        console.log('Erreur : statut non autorisé', reservation.status)
        await trx.rollback()
        return response.badRequest({
          message: `Cannot unassign room from reservation with status: ${reservation.status}. Allowed statuses: ${allowedStatuses.join(', ')}`
        })
      }

      for (const reservationRoom of reservation.reservationRooms) {
        // Store the reservation room ID before unassigning
        const reservationRoomId = reservationRoom.id

        reservationRoom.roomId = null;
        reservationRoom.lastModifiedBy = auth?.user?.id!
        await reservationRoom.useTransaction(trx).save()

        // Remove room number from folio transaction descriptions
        await ReservationFolioService.removeRoomChargeDescriptions(
          reservationRoomId,
          auth?.user?.id!
        )
      }



      // Create audit log
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'ROOM_UNASSIGNED',
        entityType: 'ReservationRoom',
        entityId: reservationId,
        hotelId: reservation.hotelId,
        description: `Room unassigned from reservation #${reservation.reservationNumber}`,
        ctx: ctx
      })

      await trx.commit()
      console.log('Room désaffectée avec succès')

      return response.ok({
        message: 'Room unassigned successfully',
        reservationId
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

  /**
   * Get detailed room charges breakdown for a reservation
   * Returns stay details, room info, rate type, pax, charges, discounts, taxes, adjustments, and net amount
   */
  public async getRoomCharges({ params, response }: HttpContext) {
    try {
      const { reservationId } = params

      // Validate reservation ID
      if (!reservationId || isNaN(Number(reservationId))) {
        return response.badRequest({ message: 'Valid reservation ID is required' })
      }

      // Find reservation with all related data
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query
            .whereNot('status', 'voided')
            .preload('room')
            .preload('roomType')
            .preload('roomRates', (query) => {
              query.preload('rateType')
            })
        })
        .preload('ratePlan')
        .preload('guest')
        .preload('folios', (query) => {
          query.where('status', '!=', FolioStatus.VOIDED)
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      // Get all room charge transactions from folios related to this reservation
      const roomChargeTransactions = await FolioTransaction.query()
        .where('reservationId', reservationId)
        .where('category', TransactionCategory.ROOM)
        .where('transactionType', TransactionType.CHARGE)
        .where('status', '!=', TransactionStatus.VOIDED)
        .orderBy('transactionDate', 'asc')

      // Build room charges breakdown - one row per folio transaction
      const roomChargesTable = []

      for (const reservationRoom of reservation.reservationRooms) {
        const stayDuration = reservationRoom.nights || 1
        const totalAdults = reservationRoom.adults || 0
        const totalChildren = reservationRoom.children || 0

        // Get room charge transactions for this specific room
        const roomTransactions = roomChargeTransactions.filter(transaction =>
          transaction.roomNumber === reservationRoom.room?.roomNumber ||
          transaction.description?.includes(reservationRoom.room?.roomNumber || '')
        )

        // Create a row for each folio transaction
        if (roomTransactions.length > 0) {
          roomTransactions.forEach(transaction => {
            const adjustmentAmount = 0 // Adjustments are typically separate transactions
            const netAmount = parseFloat(`${transaction.amount ?? 0}`) - parseFloat(`${transaction.discountAmount ?? 0}`) +
              parseFloat(`${transaction.taxAmount ?? 0}`) + parseFloat(`${transaction.serviceChargeAmount ?? 0}`)
            roomChargesTable.push({
              transactionId: transaction.id,
              transactionNumber: transaction.transactionNumber,
              transactionDate: transaction.transactionDate?.toISODate(),
              stay: {
                checkInDate: reservationRoom.checkInDate?.toISODate(),
                checkOutDate: reservationRoom.checkOutDate?.toISODate(),
                nights: stayDuration
              },
              room: {
                roomNumber: reservationRoom.room?.roomNumber || transaction.roomNumber,
                roomType: reservationRoom.roomType?.roomTypeName,
                roomId: reservationRoom.room?.id
              },
              rateType: {
                ratePlanName: reservationRoom.roomRates?.rateType?.rateTypeName,
                ratePlanCode: reservation.ratePlan?.planCode,
                rateAmount: reservationRoom.rateAmount || (transaction.unitPrice || 0)
              },
              pax: `${totalAdults}/${totalChildren}`, // Format: Adult/Child
              charge: Number(transaction.amount || 0),
              discount: Number(transaction.discountAmount || 0),
              tax: Number(transaction.taxAmount || 0),
              adjustment: Number(adjustmentAmount || 0),
              netAmount: Number(netAmount || 0),
              description: transaction.description
            })
          })
        } else {
          // Fallback: create one row from reservation room data if no transactions found
          const baseRoomRate = reservationRoom.roomRate || 0
          const roomCharges = reservationRoom.roomCharges || (baseRoomRate * stayDuration)
          const discountAmount = reservationRoom.discountAmount || 0
          const taxAmount = reservationRoom.taxAmount || 0
          const serviceChargeAmount = reservationRoom.serviceChargeAmount || 0
          const adjustments = (
            (reservationRoom.earlyCheckInFee || 0) +
            (reservationRoom.lateCheckOutFee || 0) +
            (reservationRoom.otherCharges || 0)
          )
          const netAmount = roomCharges - discountAmount + taxAmount + serviceChargeAmount + adjustments

          roomChargesTable.push({
            transactionId: null,
            transactionNumber: 'N/A',
            transactionDate: null,
            stay: {
              checkInDate: reservationRoom.checkInDate?.toISODate(),
              checkOutDate: reservationRoom.checkOutDate?.toISODate(),
              nights: stayDuration
            },
            room: {
              roomNumber: reservationRoom.room?.roomNumber,
              roomType: reservationRoom.roomType?.roomTypeName,
              roomId: reservationRoom.room?.id
            },
            rateType: {
              ratePlanName: reservation.ratePlan?.planName,
              ratePlanCode: reservation.ratePlan?.planCode,
              rateAmount: reservationRoom.rateAmount || baseRoomRate
            },
            pax: `${totalAdults}/${totalChildren}`,
            charge: Number(roomCharges || 0),
            discount: Number(discountAmount || 0),
            tax: Number((taxAmount + serviceChargeAmount) || 0),
            adjustment: Number(adjustments || 0),
            netAmount: Number(netAmount || 0),
            description: 'Room Charge (from reservation data)'
          })
        }
      }

      // Calculate summary totals
      const totalCharges = roomChargesTable.reduce((sum, row) => sum + Number(row.charge || 0), 0)
      const totalDiscounts = roomChargesTable.reduce((sum, row) => sum + Number(row.discount || 0), 0)
      const totalTax = roomChargesTable.reduce((sum, row) => sum + Number(row.tax || 0), 0)
      const totalAdjustments = roomChargesTable.reduce((sum, row) => sum + Number(row.adjustment || 0), 0)
      const totalNetAmount = roomChargesTable.reduce((sum, row) => sum + Number(row.netAmount || 0), 0)

      return response.ok({
        success: true,
        data: {
          reservationId: reservation.id,
          reservationNumber: reservation.reservationNumber,
          guestName: `${reservation.guest?.firstName || ''} ${reservation.guest?.lastName || ''}`.trim(),
          status: reservation.status,
          checkInDate: reservation.arrivedDate?.toISODate(),
          checkOutDate: reservation.departDate?.toISODate(),
          totalNights: reservation.nights,
          roomChargesTable: roomChargesTable,
          summary: {
            totalTransactions: roomChargesTable.length,
            totalRooms: reservation.reservationRooms.length,
            totalCharges: totalCharges,
            totalDiscounts: totalDiscounts,
            totalTax: totalTax,
            totalAdjustments: totalAdjustments,
            totalNetAmount: totalNetAmount
          }
        },
        message: 'Room charges table retrieved successfully'
      })

    } catch (error) {
      logger.error('Error fetching room charges:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch room charges',
        error: error.message
      })
    }
  }

  /**
   * Get released reservations by date for a specific hotel
   * Released reservations are those with status 'checked_out' or 'completed'
   */
  async getReleasedReservationsByDate({ params, request, response }: HttpContext) {
    try {
      const { hotelId } = params
      const { date } = request.qs()

      // Validate required parameters
      if (!hotelId) {
        return response.badRequest({
          success: false,
          message: 'Hotel ID is required',
          errors: ['hotelId parameter is missing']
        })
      }

      if (!date) {
        return response.badRequest({
          success: false,
          message: 'Date is required',
          errors: ['date query parameter is missing']
        })
      }

      // Validate date format
      const targetDate = DateTime.fromISO(date)
      if (!targetDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format',
          errors: ['Date must be in ISO format (YYYY-MM-DD)']
        })
      }

      // Query released reservations (checked_out or completed status)
      const releasedReservations = await Reservation.query()
        .where('hotel_id', hotelId)
        .whereIn('status', [ReservationStatus.CHECKED_OUT, ReservationStatus.COMPLETED])
        .where((query) => {
          // Filter by checkout date or departure date
          query
            .whereRaw('DATE(check_out_date) = ?', [targetDate.toSQLDate()])
            .orWhereRaw('DATE(depart_date) = ?', [targetDate.toSQLDate()])
        })
        .preload('guest', (guestQuery) => {
          guestQuery.select(['id', 'firstName', 'lastName', 'email', 'phone'])
        })
        .preload('reservationRooms', (roomQuery) => {
          roomQuery
            .preload('room', (roomDetailQuery) => {
              roomDetailQuery.select(['id', 'roomNumber', 'floorNumber'])
            })
            .preload('roomType', (typeQuery) => {
              typeQuery.select(['id', 'roomTypeName'])
            })
        })
        .preload('folios', (folioQuery) => {
          folioQuery.select(['id', 'folioNumber', 'totalAmount', 'balanceAmount'])
        })
        .orderBy('check_out_date', 'desc')
        .orderBy('depart_date', 'desc')

      // Format the response data
      const formattedReservations = releasedReservations.map(reservation => {
        const guest = reservation.guest
        const rooms = reservation.reservationRooms.map(rr => ({
          roomId: rr.room?.id,
          roomNumber: rr.room?.roomNumber,
          roomType: rr.roomType?.roomTypeName,
          floorNumber: rr.room?.floorNumber,
          checkInDate: rr.checkInDate?.toISODate(),
          checkOutDate: rr.checkOutDate?.toISODate()
        }))

        const totalFolioAmount = reservation.folios.reduce((sum, folio) => sum + (folio.totalAmount || 0), 0)
        const totalBalance = reservation.folios.reduce((sum, folio) => sum + (folio.balanceAmount || 0), 0)

        return {
          reservationId: reservation.id,
          reservationNumber: reservation.reservationNumber,
          confirmationNumber: reservation.confirmationNumber,
          status: reservation.status,
          guest: {
            id: guest?.id,
            name: guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : 'N/A',
            email: guest?.email,
            phone: guest?.phonePrimary
          },
          checkInDate: reservation.checkInDate?.toISODate(),
          checkOutDate: reservation.checkOutDate?.toISODate(),
          departureDate: reservation.departDate?.toISODate(),
          totalAmount: reservation.totalAmount,
          finalAmount: reservation.finalAmount,
          remainingAmount: reservation.remainingAmount,
          rooms: rooms,
          totalRooms: rooms.length,
          folios: {
            totalAmount: totalFolioAmount,
            balanceAmount: totalBalance,
            count: reservation.folios.length
          },
          releasedAt: reservation.checkOutDate || reservation.departDate,
          createdAt: reservation.createdAt,
          updatedAt: reservation.updatedAt
        }
      })

      return response.ok({
        success: true,
        message: 'Released reservations retrieved successfully',
        data: {
          hotelId: parseInt(hotelId),
          date: targetDate.toISODate(),
          totalCount: formattedReservations.length,
          reservations: formattedReservations
        }
      })

    } catch (error) {
      logger.error('Error fetching released reservations:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch released reservations',
        error: error.message
      })
    }
  }

  /**
   * assign rooom to reservation
   */
  public async assignRoom(ctx: HttpContext) {
    const trx = await db.transaction()
    const { params, request, response, auth } = ctx
    try {
      const { reservationId } = params
      const { reservationRooms, } = request.body();
      const resRoomIds = reservationRooms?.map((e: any) => e.reservationRoomId);


      // Validate required fields
      if (!reservationRooms) {
        await trx.rollback()
        return response.badRequest({ message: 'Room ID is required' })
      }


      // Get reservation with related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.whereIn('id', resRoomIds)
        })
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }


      for (const reservationRoom of reservation.reservationRooms) {
        if (reservationRoom.roomId && reservationRoom.roomId !== 0) {
          await trx.rollback();
          return response.badRequest({
            message: `Cannot assign room from reservation with room`
          })
        } else {
          const newRoomId = reservationRooms.filter((e: any) => e.reservationRoomId === reservationRoom.id)[0].roomId;
          reservationRoom.roomId = newRoomId;
          reservationRoom.lastModifiedBy = auth?.user?.id!
          await reservationRoom.useTransaction(trx).save()

          // Get room number and update folio transaction descriptions
          const room = await Room.query({ client: trx })
            .where('id', newRoomId)
            .first()

          if (room) {
            await ReservationFolioService.updateRoomChargeDescriptions(
              reservationRoom.id,
              room.roomNumber,
              auth?.user?.id!
            )
          }
        }
      }
      // Create audit log
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'ASSIGNED',
        entityType: 'ReservationRoom',
        entityId: reservationId,
        hotelId: reservation.hotelId,
        description: `Assign Room from reservation #${reservation.reservationNumber}`,
        ctx: ctx
      })

      await trx.commit()

      return response.ok({
        message: 'Assign Room successfully',
        reservationId
      })

    } catch (error) {
      await trx.rollback()
      logger.error('Error assigning room:', error)
      return response.badRequest({
        message: 'Failed to unassign room',
        error: error.message
      })
    }
  }

  /**
   * Update stopMove status for reservation rooms
   */
  public async updateStopMove(ctx: HttpContext) {
    const trx = await db.transaction()
    const { params, request, response, auth } = ctx
    try {
      const { reservationId } = params
      const { reservationRooms, stopMove } = request.body();
      const resRoomIds = reservationRooms?.map((e: any) => e.reservationRoomId);

      // Validate required fields
      if (!reservationRooms || stopMove === undefined) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation rooms and stopMove status are required' })
      }

      // Get reservation with related data
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.whereIn('id', resRoomIds)
        })
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Update stopMove status for each reservation room
      for (const reservationRoom of reservation.reservationRooms) {
        reservationRoom.stopMove = stopMove
        reservationRoom.lastModifiedBy = auth?.user?.id!
        await reservationRoom.useTransaction(trx).save()
      }

      // Create audit log
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: stopMove ? 'STOP_MOVE_ENABLED' : 'STOP_MOVE_DISABLED',
        entityType: 'ReservationRoom',
        entityId: reservationId,
        hotelId: reservation.hotelId,
        description: `${stopMove ? 'Enabled' : 'Disabled'} stop move for reservation #${reservation.reservationNumber}`,
        ctx: ctx
      })

      await trx.commit()

      return response.ok({
        message: `Stop move ${stopMove ? 'enabled' : 'disabled'} successfully`,
        reservationId,
        stopMove
      })

    } catch (error) {
      await trx.rollback()
      logger.error('Error updating stop move:', error)
      return response.badRequest({
        message: 'Failed to update stop move status',
        error: error.message
      })
    }
  }

  public async printGuestCard({ request, response }: HttpContext) {
    try {
      const { guestId, reservationId } = request.only(['guestId', 'reservationId'])

      if (!guestId || !reservationId) {
        return response.badRequest({
          message: 'Guest ID and Reservation ID are required'
        })
      }

      // Fetch guest and reservation data
      const guest = await Guest.find(guestId)
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('hotel')
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions');
        })
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
            .preload('roomRates', (roomRateQuery) => {
              roomRateQuery.preload('rateType')
            })
        })
        .first()

      if (!guest) {
        return response.notFound({ message: 'Guest not found' })
      }

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }
      const totalsSummary = this.calculateBalanceSummary(reservation.folios);

      logger.info(totalsSummary)
      // Generate guest card HTML content
      const htmlContent = this.generateGuestCardHtml(guest, reservation, totalsSummary)

      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        orientation: 'portrait'
      })

      // Set response headers for PDF
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="guest-card-${guest.firstName}-${guest.lastName}.pdf"`)

      return response.send(pdfBuffer)

    } catch (error) {
      logger.error('Error generating guest card PDF:', error)
      return response.internalServerError({
        message: 'Failed to generate guest card PDF',
        error: error.message
      })
    }
  }

  private generateGuestCardHtml(guest: Guest, reservation: Reservation, totalSummary: any): string {
    const room = reservation.reservationRooms?.[0]?.room
    const reservationRoom = reservation.reservationRooms?.[0]

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Guest Registration Card</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
                font-family: 'Inter', sans-serif;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
                background-color: #f8fafc;
                font-size: 0.875rem;
            }
            .registration-card {
                margin: 0 auto;
                background-color: #ffffff;
                padding: 1.5rem;
                line-height: 1.5;
            }
            .hotel-info {
                text-align: center;
                margin-bottom: 1rem;
            }
            .hotel-info p {
                font-size: 0.875rem;
                margin: 0;
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-bottom: 1rem;
            }
            .header .title {
                font-size: 1.25rem;
                font-weight: 700;
            }
            .header .card-no {
                font-size: 1rem;
                font-weight: 500;
            }
            .section {
                border-bottom: 1px solid #000;
                padding: 0.25rem 0;
                margin-top: 1rem;
                display: flex;
                gap: 1.5rem;
            }
            .section-title {
                font-weight: 700;
                flex-basis: 20%;
                flex-shrink: 0;
                margin-right: 0.5rem;
                white-space: nowrap;
            }
            .section-content {
                flex-grow: 1;
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                justify-content: space-between;
            }
            .field {
                 display: flex;
                 align-items: flex-end;
                 flex-basis: 50%;
                 padding-bottom: 0.5rem;
                 gap: 0.5rem;
                 min-height: 2rem;
             }
             .field-label {
                 font-weight: 500;
                 white-space: nowrap;
                 line-height: 1.5;
                 min-width: 80px;
                 flex-shrink: 0;
             }
            .input-line {
                flex-grow: 1;
                border-bottom: 1px solid #000;
                min-height: 1.2em;
                padding-left: 0.25rem;
            }
            .note-section {
                margin-top: 1rem;
                padding: 0.5rem 0;
                border: 1px solid #000;
                padding-left: 0.5rem;
            }
            .note-section .field-label {
                margin-right: 0.5rem;
            }
            .signature-section {
                margin-top: 2rem;
                display: flex;
                justify-content: space-between;
            }
            .signature-section .signature-field {
                flex-basis: 48%;
            }
            .divider {
                border-top: 1px solid #000;
                margin: 1rem 0;
            }
            @media print {
                body {
                    background: none;
                    padding: 0;
                }
                .registration-card {
                    box-shadow: none;
                    border: 1px solid #000;
                }
            }
        </style>
    </head>
    <body>
        <div class="registration-card">
            <div class="hotel-info">
                <h3 style="font-weight: 600; margin-top: 0.5rem;">${reservation.hotel?.hotelName}</h3>
                <p>${reservation.hotel?.address}</p>
                <p>Phone: ${reservation.hotel?.phoneNumber}; Email: ${reservation.hotel?.email};</p>
                <p>URL: ${reservation.hotel?.website}</p>
            </div>
            <div class="divider"></div>
            <div class="header">
                <div class="title">Guest Registration Card</div>
                <div class="title">GR Card No.: ${reservation.confirmationNumber || '____________'}</div>
            </div>
<div class="divider"></div>
            <div class="section">
                <div class="section-title">Personal</div>
                <div class="section-content flex-wrap">
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Name</span>
                        <span class="input-line">${guest.displayName}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Email</span>
                        <span class="input-line">${guest.email || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Phone</span>
                        <span class="input-line">${guest.phonePrimary || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Fax</span>
                        <span class="input-line">${guest.fax || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Mobile</span>
                        <span class="input-line">${guest.phonePrimary || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">City</span>
                        <span class="input-line">${guest.city || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Address</span>
                        <span class="input-line">${guest.address || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Country</span>
                        <span class="input-line">${guest.country || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 100%;">
                        <span class="field-label">ID/Passport No.</span>
                        <span class="input-line">${guest.idType || ''} - ${guest.passportNumber || guest.idNumber || ''}</span>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Company Details</div>
                <div class="section-content flex-wrap">
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Company</span>
                        <span class="input-line">${guest.companyName || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Business Source</span>
                        <span class="input-line">${reservation.businessSource?.name || ''}</span>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Accommodation</div>
                <div class="section-content flex-wrap">
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Arrival Date</span>
                        <span class="input-line">${new Date(reservation.checkInDate).toLocaleDateString()}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Arrival Time</span>
                        <span class="input-line">${reservation.checkInTime || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Dep. Date</span>
                        <span class="input-line">${new Date(reservation.checkOutDate).toLocaleDateString()}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Dep. Time</span>
                        <span class="input-line">${reservation.checkOutTime || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Night(s)</span>
                        <span class="input-line">${reservation.numberOfNights || ''}</span>
                    </div>
                     <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Pax</span>
                        <span class="input-line">${reservation.adults} / ${(reservation.children || 0)} (A/C)</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Room</span>
                        <span class="input-line">${room?.roomNumber || ''} - ${room?.roomType?.roomTypeName || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Rate Type</span>
                        <span class="input-line">${reservationRoom?.roomRates?.rateType?.rateTypeName || ''}</span>
                    </div>
                   
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Tariff</span>
                        <span class="input-line">${reservationRoom.roomRate || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Total Charges</span>
                        <span class="input-line">${totalSummary.totalCharges}</span>
                    </div>
                     <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Tax</span>
                        <span class="input-line">${totalSummary.totalTaxes}</span>
                    </div>
                     <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Amount Paid</span>
                        <span class="input-line">${totalSummary.totalPayments}</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Discount</span>
                        <span class="input-line">${totalSummary.totalDiscounts}</span>
                    </div>
                      <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Due Amount</span>
                        <span class="input-line">${totalSummary.outstandingBalance}</span>
                    </div>
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Adjustment</span>
                        <span class="input-line">${totalSummary.totalAdjustments}</span>
                    </div>
                  
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Net</span>
                        <span class="input-line">${totalSummary.totalChargesWithTaxes}</span>
                    </div>
                   
                </div>
            </div>

            <div class="section">
                <div class="section-title">Payment Details</div>
                <div class="section-content flex-wrap">
                    <div class="field" style="flex-basis: 45%;">
                        <span class="field-label">Payment Type</span>
                        <span class="input-line">${reservation.paymentMethod || ''}</span>
                    </div>
                    <div class="field" style="flex-basis: 50%;">
                        <span class="field-label">Direct Billing A/C</span>
                        <span class="input-line">${reservation.billingAccount || ''}</span>
                    </div>
                </div>
            </div>
            
            <div class="note-section">
                <div class="section-title">Please Note</div>
                <p style="margin-top: 0.5rem; font-size: 0.75rem;">
                   ${reservation.hotel?.notices?.registrationCard}
                </p>
            </div>

            <div class="signature-section">
                <div class="signature-field">
                    <label style="display: block; width: 100%; font-size: 0.875rem; font-weight: 500; color: #4b5063;">Guest Signature</label>
                    <span class="input-line"></span>
                </div>
                <div class="signature-field">
                    <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #4b5063;">Date</label>
                    <span class="input-line">${new Date().toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    </body>
    </html>
    `
  }
}
