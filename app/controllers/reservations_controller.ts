import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import User from '#models/user'
import Reservation, { ReservationStatus } from '#models/reservation'
import Room from '#models/room'
import ReservationRoom from '#models/reservation_room'
import RoomRate from '#models/room_rate'
import Discount from '#models/discount'
import MealPlan from '#models/meal_plan'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { generateConfirmationNumber } from '../utils/generate_confirmation_number.js'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import CancellationPolicy from '#models/cancellation_policy'
import {
  FolioStatus,
  FolioType,
  ReservationProductStatus,
  SettlementStatus,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  WorkflowStatus,
} from '#app/enums'
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
import { updateReservationDetailsValidator } from '#validators/reservation_update_details'
import { applyRoomChargeDiscountValidator } from '#validators/reservation_apply_discount'
import TaxRate from '#models/tax_rate'
import GuestSummaryService from '#services/guest_summary_service'
import ReservationHook from '../hooks/reservation_hooks.js'
import ReservationEmailService from '#services/reservation_email_service'


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
        .preload('paymentMethod')

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
    const { params, response, request, auth } = ctx
    const { reservationRooms, actualCheckInTime, notes } = request.body()

    // On démarre une transaction
    const trx = await db.transaction()
    console.log('Transaction started')

    if (!auth.user) {
      await trx.rollback()
      return response.unauthorized({ message: 'Authentication required' })
    }

    try {
      const reservationId = Number(params.reservationId)

      if (isNaN(reservationId)) {
        console.log('Invalid reservation ID')
        await trx.rollback()
        return response.badRequest({ message: 'Reservation ID is required' })
      }

      if (!reservationRooms || !Array.isArray(reservationRooms) || reservationRooms.length === 0) {
        console.log('No reservation rooms provided')
        await trx.rollback()
        return response.badRequest({ message: 'At least one reservation room ID is required' })
      }

      //  Récupération de la réservation
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => query.preload('room'))
        .first()

      if (!reservation) {
        console.log('Reservation not found')
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Vérification du statut
      if (!['confirmed', 'pending'].includes(reservation.status)) {
        console.log(`Cannot check in reservation with status: ${reservation.status}`)
        await trx.rollback()
        return response.badRequest({
          message: `Cannot check in reservation with status: ${reservation.status}`,
        })
      }

      //  Récupération des chambres à check-in
      const reservationRoomsToCheckIn = await ReservationRoom.query({ client: trx })
        .whereIn('id', reservationRooms)
        .where('reservation_id', reservation.id)
        .preload('room')

      if (reservationRoomsToCheckIn.length === 0) {
        console.log('No valid reservation rooms found')
        await trx.rollback()
        return response.notFound({ message: 'No valid reservation rooms found for check-in' })
      }

      // Vérifie si certaines chambres sont déjà check-in
      const alreadyCheckedIn = reservationRoomsToCheckIn.filter((rr) => rr.status === 'checked_in')
      if (alreadyCheckedIn.length > 0) {
        console.log('Some rooms already checked in:', alreadyCheckedIn)
        await trx.rollback()
        return response.badRequest({
          message: `Some rooms are already checked in: ${alreadyCheckedIn
            .map((r) => r.room?.roomNumber || r.roomId)
            .join(', ')}`,
        })
      }

      // Use the scheduled arrival/check-in date, not the actual time
      // const checkInDateTime = reservation.checkInDate ?? reservation.arrivedDate ?? DateTime.now()
      let checkInDateTime: DateTime

      if (reservation.checkInDate) {
        checkInDateTime = DateTime.isDateTime(reservation.checkInDate)
          ? reservation.checkInDate
          : DateTime.fromJSDate(new Date(reservation.checkInDate))
      } else if (reservation.arrivedDate) {
        checkInDateTime = DateTime.isDateTime(reservation.arrivedDate)
          ? reservation.arrivedDate
          : DateTime.fromJSDate(new Date(reservation.arrivedDate))
      } else {
        checkInDateTime = DateTime.now()
      }
      const checkedInRooms = []
      // Vérifier que toutes les chambres ont un roomId valide
      const invalidRooms = reservationRoomsToCheckIn.filter((rr) => !rr.roomId)
      if (invalidRooms.length > 0) {
        console.log('Invalid reservation rooms without roomId:', invalidRooms.map(r => r.id))
        await trx.rollback()
        return response.badRequest({
          code: "ROOM_NOT_ASSIGNED",
          message: `Cannot check in reservation rooms without an assigned room.`
        })
      }


      //  Mise à jour de chaque chambre
      for (const reservationRoom of reservationRoomsToCheckIn) {
        reservationRoom.status = 'checked_in'
        reservationRoom.checkInDate = checkInDateTime
        reservationRoom.actualCheckIn = checkInDateTime
        // Keep actualCheckInTime aligned to the scheduled check-in date
        reservationRoom.actualCheckIn = checkInDateTime
        reservationRoom.checkedInBy = auth.user!.id
        reservationRoom.guestNotes = notes || reservationRoom.guestNotes

        console.log('Updating reservation room:', reservationRoom.id)
        console.log('Reservation room data:', trx)

        await reservationRoom.useTransaction(trx).save()

        //  Met à jour la chambre correspondante
        if (reservationRoom.room) {
          reservationRoom.room.status = 'occupied'
          await reservationRoom.room.useTransaction(trx).save()
          console.log('Room status updated to occupied:', reservationRoom.room.roomNumber)
        }

        checkedInRooms.push({
          id: reservationRoom.id,
          roomId: reservationRoom.roomId,
          roomNumber: reservationRoom.room?.roomNumber,
          status: reservationRoom.status,
          checkInDate: reservationRoom.checkInDate,
          keyCardsIssued: reservationRoom.keyCardsIssued,
        })
      }

      // Vérifie si toutes les chambres de la réservation sont check-in
      const allReservationRooms = await ReservationRoom.query({ client: trx }).where(
        'reservation_id',
        reservation.id
      )

      const allRoomsCheckedIn = allReservationRooms.every(
        (room) => room.status === 'checked_in' || reservationRooms.includes(room.id)
      )

      // Met à jour la réservation
      if (allRoomsCheckedIn) {
        reservation.status = ReservationStatus.CHECKED_IN
        reservation.checkInDate = checkInDateTime
        reservation.checkedInBy = auth.user!.id
        console.log('Updating reservation status to CHECKED_IN')
      } else {
        reservation.status = 'confirmed'
        console.log('Partial check-in: updating reservation to confirmed')
      }

      reservation.lastModifiedBy = auth.user!.id
      await reservation.useTransaction(trx).save()

      await trx.commit()

      // Logs d’audit

      const checkedRoomNumbers = checkedInRooms.map((r) => r.roomNumber).join(', ') || 'N/A'
      const checkInType = allRoomsCheckedIn ? 'FULL' : 'PARTIAL'
      const checkInTimeStr = checkInDateTime.toFormat('yyyy-MM-dd HH:mm')

      const logDescription = allRoomsCheckedIn
        ? `Full check-in completed for Reservation #${reservation.reservationNumber}. Rooms: ${checkedRoomNumbers}. Checked in at ${checkInTimeStr}.`
        : `🟡 Partial check-in for Reservation #${reservation.reservationNumber}. Rooms: ${checkedRoomNumbers}. Checked in at ${checkInTimeStr}.`

      //  Log pour la réservation
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CHECK_IN',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: logDescription,
        meta: {
          type: checkInType,
          checkInTime: checkInDateTime.toISO(),
          roomsCheckedIn: checkedInRooms.map((r) => ({
            id: r.id,
            roomId: r.roomId,
            roomNumber: r.roomNumber,
          })),
          totalRoomsCheckedIn: checkedInRooms.length,
          totalRoomsInReservation: allReservationRooms.length,
          userId: auth.user!.id,
        },
        ctx,
      })

      //  Log pour le guest
      if (reservation.guestId) {
        await LoggerService.log({
          actorId: auth.user!.id,
          action: 'CHECK_IN',
          entityType: 'Guest',
          entityId: reservation.guestId,
          hotelId: reservation.hotelId,
          description: `Guest checked in under Reservation #${reservation.reservationNumber} (${checkInType}). Rooms: ${checkedRoomNumbers}.`,
          meta: {
            reservationId: reservation.id,
            reservationNumber: reservation.reservationNumber,
            checkInType,
            checkInTime: checkInDateTime.toISO(),
            rooms: checkedRoomNumbers,
            notes,
          },
          ctx,
        })
      }


      //
      await trx.commit()
      console.log('Transaction committed successfully')

      // Queue post-commit tasks to run asynchronously
      setImmediate(() => {
        (async () => {
          try {
            const CheckinCheckoutNotificationService = (
              await import('#services/notification_action_service')
            ).default
            await CheckinCheckoutNotificationService.notifyCheckInCompleted(
              reservation.id,
              auth.user!.id
            )
          } catch (notifError) {
            console.error('Error sending check-in notifications:', notifError)
          }

          try {
            await GuestSummaryService.recomputeFromReservation(reservation.id)
          } catch (summaryError) {
            console.error('Error recomputing guest summary:', summaryError)
          }
        })()
      })

      return response.ok({
        message: allRoomsCheckedIn ? 'Check-in successful' : 'Partial check-in successful',
        data: {
          reservationId: reservation.id,
          reservationNumber: reservation.reservationNumber,
          status: reservation.status,
          checkInDate: reservation.checkInDate,
          checkedInRooms,
          totalRoomsCheckedIn: checkedInRooms.length,
          isPartialCheckIn: !allRoomsCheckedIn,
          totalRoomsInReservation: allReservationRooms.length,
        },
      })
    } catch (error) {
      console.error('Error during check-in:', error)
      await trx.rollback()
      return response.badRequest({
        message: 'Failed to check in reservation',
        error: error.message,
      })
    }
  }


  // public async checkOut(ctx: HttpContext) {
  //   const { params, response, request, auth } = ctx
  //   const { reservationRooms, actualCheckOutTime, notes } = request.body()
  //   console.log('➡️ checkOut called with params:', params, 'body:', request.body())

  //   if (!auth.user) {
  //     return response.unauthorized({
  //       success: false,
  //       message: 'Authentication required',
  //       errors: ['User is not authenticated'],
  //     })
  //   }

  //   const trx = await db.transaction()

  //   try {
  //     // Validate input parameters
  //     if (!params.reservationId) {
  //       console.log('❌ Missing reservationId')
  //       await trx.rollback()
  //       return response.badRequest({
  //         success: false,
  //         message: 'Reservation ID is required',
  //         errors: ['Missing reservation ID'],
  //       })
  //     }

  //     if (!reservationRooms || !Array.isArray(reservationRooms) || reservationRooms.length === 0) {
  //       console.log('❌ Invalid reservationRooms:', reservationRooms)
  //       await trx.rollback()
  //       return response.badRequest({
  //         success: false,
  //         message: 'Reservation rooms are required',
  //         errors: ['reservationRooms must be a non-empty array'],
  //       })
  //     }

  //     // Fetch reservation with transaction
  //     const reservation = await Reservation.query({ client: trx })
  //       .where('id', params.reservationId)
  //       .preload('folios', (folioQuery) => {
  //         folioQuery.preload('transactions')
  //       })
  //       .first()
  //     console.log('📦 Reservation fetched:', reservation?.id, reservation?.status)

  //     if (!reservation) {
  //       await trx.rollback()
  //       return response.notFound({
  //         success: false,
  //         message: 'Reservation not found',
  //         errors: ['Reservation does not exist'],
  //       })
  //     }

  //     // Validate reservation status
  //     if (reservation.status === ReservationStatus.CHECKED_OUT) {
  //       await trx.rollback()
  //       return response.badRequest({
  //         success: false,
  //         message: 'Reservation is already checked out',
  //         errors: ['Cannot check out an already checked out reservation'],
  //       })
  //     }

  //     if (reservation.status !== ReservationStatus.CHECKED_IN) {
  //       await trx.rollback()
  //       return response.badRequest({
  //         success: false,
  //         message: 'Reservation must be checked in before check out',
  //         errors: [`Current status: ${reservation.status}`],
  //       })
  //     }

  //     const balanceSummary = ReservationsController.calculateBalanceSummary(reservation.folios)
  //     console.log('💰 Balance summary calculated:', balanceSummary)

  //     // Check if there's an outstanding balance
  //     if (balanceSummary.outstandingBalance > 0) {
  //       console.log('⚠️ Outstanding balance detected:', balanceSummary.outstandingBalance)
  //       await trx.rollback()
  //       return response.badRequest({
  //         success: false,
  //         message: 'Cannot check out with outstanding balance',
  //         errors: [
  //           `Outstanding balance of ${balanceSummary.outstandingBalance} must be settled before checkout`,
  //         ],
  //         data: {
  //           balanceSummary,
  //           outstandingAmount: balanceSummary.outstandingBalance,
  //         },
  //       })
  //     }

  //     // Fetch reservation rooms with transaction
  //     const reservationRoomRecords = await ReservationRoom.query({ client: trx })
  //       .whereIn('id', reservationRooms)
  //       .where('reservationId', params.reservationId)
  //       .preload('room')
  //     console.log(
  //       '🛏️ Reservation rooms fetched:',
  //       reservationRoomRecords.map((r) => ({ id: r.roomId, status: r.status }))
  //     )

  //     if (reservationRoomRecords.length === 0) {
  //       await trx.rollback()
  //       return response.notFound({
  //         success: false,
  //         message: 'No reservation rooms found',
  //         errors: ['No matching reservation rooms for the provided IDs'],
  //       })
  //     }

  //     // Validate room statuses
  //     const invalidRooms = reservationRoomRecords.filter(
  //       (room) => room.status === 'checked_out' || room.status === 'cancelled'
  //     )

  //     if (invalidRooms.length > 0) {
  //       console.log(
  //         '⚠️ Invalid rooms for checkout:',
  //         invalidRooms.map((r) => ({ id: r.id, status: r.status }))
  //       )
  //       await trx.rollback()
  //       return response.badRequest({
  //         success: false,
  //         message: 'Some rooms cannot be checked out',
  //         errors: invalidRooms.map((room) => `Room ${room.id} is already ${room.status}`),
  //       })
  //     }

  //     const updatedRooms: any[] = []
  //     // Use the scheduled departure/check-out date, not the actual time
  //     // const checkOutDateTime = reservation.checkOutDate ?? reservation.departDate ?? DateTime.now()

  //     let checkOutDateTime: DateTime

  //     if (reservation.checkOutDate) {
  //       checkOutDateTime = DateTime.isDateTime(reservation.checkOutDate)
  //         ? reservation.checkOutDate
  //         : DateTime.fromJSDate(new Date(reservation.checkOutDate))
  //     } else if (reservation.departDate) {
  //       checkOutDateTime = DateTime.isDateTime(reservation.departDate)
  //         ? reservation.departDate
  //         : DateTime.fromJSDate(new Date(reservation.departDate))
  //     } else {
  //       checkOutDateTime = DateTime.now()
  //     }

  //     // Update reservation rooms
  //     for (const reservationRoom of reservationRoomRecords) {
  //       // Update reservation room status
  //       reservationRoom.status = 'checked_out'
  //       reservationRoom.checkOutDate = checkOutDateTime
  //       // Keep actual check-out fields aligned to the scheduled date
  //       reservationRoom.actualCheckOut = checkOutDateTime
  //       reservationRoom.actualCheckOutTime = checkOutDateTime
  //       reservationRoom.checkedOutBy = auth.user!.id
  //       reservationRoom.lastModifiedBy = auth.user!.id

  //       if (notes) {
  //         reservationRoom.guestNotes = notes
  //       }

  //       await reservationRoom.useTransaction(trx).save()
  //       updatedRooms.push(reservationRoom)

  //       // Update associated room status to dirty
  //       if (reservationRoom.room) {
  //         console.log(`🧹 Marking room ${reservationRoom.room.id} as dirty`)
  //         reservationRoom.room.status = 'available'
  //         reservationRoom.room.housekeepingStatus = 'dirty'
  //         await reservationRoom.room.useTransaction(trx).save()
  //         updatedRooms.push(reservationRoom.room.id)
  //       }
  //     }

  //     // Check if all reservation rooms are checked out
  //     const remainingCheckedInRooms = await ReservationRoom.query({ client: trx })
  //       .where('reservationId', params.reservationId)
  //       .whereNotIn('status', ['checked_out', 'cancelled', 'no_show'])

  //     console.log('📊 Remaining checked-in rooms:', remainingCheckedInRooms.length)

  //     const allRoomsCheckedOut = remainingCheckedInRooms.length === 0

  //     // Update reservation status if all rooms are checked out
  //     if (allRoomsCheckedOut) {
  //       console.log('✅ All rooms checked out, updating reservation status')
  //       reservation.checkOutDate = checkOutDateTime
  //       reservation.status = ReservationStatus.CHECKED_OUT
  //       reservation.checkedOutBy = auth.user!.id
  //       await reservation.useTransaction(trx).save()
  //     }

  //     // Log the check-out activity
  //     await LoggerService.log({
  //       actorId: auth.user.id,
  //       action: 'CHECK_OUT',
  //       entityType: 'Reservation',
  //       entityId: reservation.id,
  //       hotelId: reservation.hotelId,
  //       description: `Reservation #${reservation.reservationNumber} rooms checked out. Rooms: ${reservationRooms.join(', ')}`,
  //       ctx: ctx,
  //     })

  //     //log for Guest
  //     if (reservation.guestId) {
  //       await LoggerService.log({
  //         actorId: auth.user.id,
  //         action: 'CHECK_OUT',
  //         entityType: 'Guest',
  //         entityId: reservation.guestId,
  //         hotelId: reservation.hotelId,
  //         description: `Checked out from hotel for reservation #${reservation.reservationNumber}.`,
  //         meta: {
  //           reservationId: reservation.id,
  //           reservationNumber: reservation.reservationNumber,
  //           rooms: reservationRooms,
  //         },
  //         ctx: ctx,
  //       })
  //     }

  //     await trx.commit()

  //     // Send thank-you email after successful checkout (non-blocking for transaction)
  //     try {
  //       const folios = reservation.folios || []
  //       const closedFolioIds = folios
  //         .filter((f) => f.status === FolioStatus.CLOSED)
  //         .map((f) => f.id)
  //       const folioIdsForEmail = closedFolioIds.length > 0 ? closedFolioIds : folios.map((f) => f.id)
  //       await ReservationEmailService.sendCheckoutThanks(reservation.id, folioIdsForEmail, auth.user!.id)
  //     } catch (emailErr: any) {
  //       logger.warn('Failed to send checkout thank-you email', {
  //         reservationId: reservation.id,
  //         error: emailErr?.message,
  //       })
  //     }

  //     try {
  //       const CheckinCheckoutNotificationService = (await import('#services/notification_action_service')).default

  //       await CheckinCheckoutNotificationService.notifyCheckOutCompleted(
  //         reservation.id,
  //         auth.user!.id,
  //         {
  //           checkedOutRooms: reservationRoomRecords.map(rr => ({
  //             roomNumber: rr.room?.roomNumber || 'N/A',
  //             roomId: rr.roomId
  //           })),
  //           checkOutTime: checkOutDateTime,
  //           allRoomsCheckedOut
  //         }
  //       )
  //       console.log(' Check-out notifications sent successfully')
  //     } catch (notifError) {
  //       console.error(' Error sending check-out notifications:', notifError)
  //     }

  //     await GuestSummaryService.recomputeFromReservation(reservation.id)
  //     return response.ok({
  //       success: true,
  //       message: 'Check-out completed successfully',
  //       data: {
  //         reservation: {
  //           id: reservation.id,
  //           reservationNumber: reservation.reservationNumber,
  //           status: reservation.status,
  //           checkOutDate: reservation.checkOutDate,
  //           allRoomsCheckedOut,
  //         },
  //         checkedOutRooms: updatedRooms.map((room) => ({
  //           id: room.id,
  //           roomId: room.roomId,
  //           status: room.status,
  //           // actualCheckOutTime: room.actualCheckOutTime,
  //           //checkedOutBy: room.checkedOutBy,
  //           //finalBillAmount: room.finalBillAmount,
  //           //depositRefund: room.depositRefund
  //         })),
  //         updatedRooms,
  //         balanceSummary,
  //       },
  //     })
  //   } catch (error) {
  //     await trx.rollback()
  //     logger.error('Error during reservation check-out:', {
  //       reservationId: params.reservationId,
  //       reservationRooms,
  //       error: error.message,
  //       stack: error.stack,
  //     })

  //     return response.status(500).json({
  //       success: false,
  //       message: 'An error occurred during check-out',
  //       errors: [error.message],
  //     })
  //   }
  // }

  public async checkOut(ctx: HttpContext) {
  const { params, response, request, auth } = ctx
  const { reservationRooms, actualCheckOutTime, notes } = request.body()

  if (!auth.user) {
    console.log('[CHECKOUT] Erreur: Utilisateur non authentifié');
    return response.unauthorized({
      success: false,
      message: 'Authentication required',
      errors: ['User is not authenticated'],
    })
  }

  const trx = await db.transaction()

  try {
    if (!params.reservationId) {
      await trx.rollback()
      return response.badRequest({
        success: false,
        message: 'Reservation ID is required',
        errors: ['Missing reservation ID'],
      })
    }

    if (!reservationRooms || !Array.isArray(reservationRooms) || reservationRooms.length === 0) {
      await trx.rollback()
      return response.badRequest({
        success: false,
        message: 'Reservation rooms are required',
        errors: ['reservationRooms must be a non-empty array'],
      })
    }

    const reservation = await Reservation.query({ client: trx })
      .where('id', params.reservationId)
      .preload('folios', (folioQuery) => {
        folioQuery.preload('transactions')
      })
      .first()

    if (!reservation) {
      await trx.rollback()
      return response.notFound({
        success: false,
        message: 'Reservation not found',
        errors: ['Reservation does not exist'],
      })
    }


    if (reservation.status === ReservationStatus.CHECKED_OUT) {
      await trx.rollback()
      return response.badRequest({
        success: false,
        message: 'Reservation is already checked out',
        errors: ['Cannot check out an already checked out reservation'],
      })
    }

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      await trx.rollback()
      return response.badRequest({
        success: false,
        message: 'Reservation must be checked in before check out',
        errors: [`Current status: ${reservation.status}`],
      })
    }

    const balanceSummary = ReservationsController.calculateBalanceSummary(reservation.folios)

    if (balanceSummary.outstandingBalance > 0) {
      await trx.rollback()
      return response.badRequest({
        success: false,
        message: 'Cannot check out with outstanding balance',
        errors: [
          `Outstanding balance of ${balanceSummary.outstandingBalance} must be settled before checkout`,
        ],
        data: {
          balanceSummary,
          outstandingAmount: balanceSummary.outstandingBalance,
        },
      })
    }

    const reservationRoomRecords = await ReservationRoom.query({ client: trx })
      .whereIn('id', reservationRooms)
      .where('reservationId', params.reservationId)
      .preload('room')


    if (reservationRoomRecords.length === 0) {

      await trx.rollback()
      return response.notFound({
        success: false,
        message: 'No reservation rooms found',
        errors: ['No matching reservation rooms for the provided IDs'],
      })
    }
    const invalidRooms = reservationRoomRecords.filter(
      (room) => room.status === 'checked_out' || room.status === 'cancelled'
    )


    if (invalidRooms.length > 0) {
      console.log('[CHECKOUT] Erreur: Chambres invalides:', invalidRooms.map(r => ({ id: r.id, status: r.status })));
      await trx.rollback()
      return response.badRequest({
        success: false,
        message: 'Some rooms cannot be checked out',
        errors: invalidRooms.map((room) => `Room ${room.id} is already ${room.status}`),
      })
    }

    const updatedRooms: any[] = []

    let checkOutDateTime: DateTime

    if (reservation.checkOutDate) {
      checkOutDateTime = DateTime.isDateTime(reservation.checkOutDate)
        ? reservation.checkOutDate
        : DateTime.fromJSDate(new Date(reservation.checkOutDate))
    } else if (reservation.departDate) {
      checkOutDateTime = DateTime.isDateTime(reservation.departDate)
        ? reservation.departDate
        : DateTime.fromJSDate(new Date(reservation.departDate))
    } else {
      checkOutDateTime = DateTime.now()
    }

    for (const reservationRoom of reservationRoomRecords) {

      reservationRoom.status = 'checked_out'
      reservationRoom.checkOutDate = checkOutDateTime
      reservationRoom.actualCheckOut = checkOutDateTime
      reservationRoom.actualCheckOut = checkOutDateTime
      reservationRoom.checkedOutBy = auth.user!.id
      reservationRoom.lastModifiedBy = auth.user!.id

      if (notes) {
        reservationRoom.guestNotes = notes
      }

      await reservationRoom.useTransaction(trx).save()
      updatedRooms.push(reservationRoom)

      if (reservationRoom.room) {
        reservationRoom.room.status = 'available'
        reservationRoom.room.housekeepingStatus = 'dirty'
        await reservationRoom.room.useTransaction(trx).save()
      }
    }

    const remainingCheckedInRooms = await ReservationRoom.query({ client: trx })
      .where('reservationId', params.reservationId)
      .whereNotIn('status', ['checked_out', 'cancelled', 'no_show'])

    const allRoomsCheckedOut = remainingCheckedInRooms.length === 0

    if (allRoomsCheckedOut) {
      reservation.checkOutDate = checkOutDateTime
      reservation.status = ReservationStatus.CHECKED_OUT
      reservation.checkedOutBy = auth.user!.id
      await reservation.useTransaction(trx).save()
    }

    await LoggerService.log({
      actorId: auth.user.id,
      action: 'CHECK_OUT',
      entityType: 'Reservation',
      entityId: reservation.id,
      hotelId: reservation.hotelId,
      description: `Reservation #${reservation.reservationNumber} rooms checked out. Rooms: ${reservationRooms.join(', ')}`,
      ctx: ctx,
    })

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
          rooms: reservationRooms,
        },
        ctx: ctx,
      })
    }
    await trx.commit()

    try {
      const folios = reservation.folios || []
      const closedFolioIds = folios
        .filter((f) => f.status === FolioStatus.CLOSED)
        .map((f) => f.id)
      const folioIdsForEmail = closedFolioIds.length > 0 ? closedFolioIds : folios.map((f) => f.id)
      await ReservationEmailService.sendCheckoutThanks(reservation.id, folioIdsForEmail, auth.user!.id)
    } catch (emailErr: any) {
      console.error('[CHECKOUT] Erreur lors de l\'envoi de l\'email:', emailErr);
      logger.warn('Failed to send checkout thank-you email', {
        reservationId: reservation.id,
        error: emailErr?.message,
      })
    }

    try {

      const CheckinCheckoutNotificationService = (await import('#services/notification_action_service')).default

      await CheckinCheckoutNotificationService.notifyCheckOutCompleted(
        reservation.id,
        auth.user!.id,
        {
          checkedOutRooms: reservationRoomRecords.map(rr => ({
            roomNumber: rr.room?.roomNumber || 'N/A',
            roomId: rr.roomId
          })),
          checkOutTime: checkOutDateTime,
          allRoomsCheckedOut
        }
      )
    } catch (notifError) {
      console.error('[CHECKOUT] Erreur lors de l\'envoi des notifications:', notifError);
      logger.error('Error sending check-out notifications', notifError)
    }

    await GuestSummaryService.recomputeFromReservation(reservation.id)

    return response.ok({
      success: true,
      message: 'Check-out completed successfully',
      data: {
        reservation: {
          id: reservation.id,
          reservationNumber: reservation.reservationNumber,
          status: reservation.status,
          checkOutDate: reservation.checkOutDate,
          allRoomsCheckedOut,
        },
        checkedOutRooms: updatedRooms.map((room) => ({
          id: room.id,
          roomId: room.roomId,
          status: room.status,
        })),
        updatedRooms,
        balanceSummary,
      },
    })
  } catch (error) {
    console.error('[CHECKOUT] Erreur capturée dans le bloc catch principal:', error);
    console.error('[CHECKOUT] Stack trace:', error.stack);

    await trx.rollback()

    logger.error('Error during reservation check-out', {
      reservationId: params.reservationId,
      reservationRooms,
      error: error.message,
      stack: error.stack,
    })

    return response.status(500).json({
      success: false,
      message: 'An error occurred during check-out',
      errors: [error.message],
    })
  }
}

  public async undoCheckIn(ctx: HttpContext) {
    const { params, response, request, auth } = ctx
    const { reservationRooms, notes } = request.body()

    if (!auth.user) {
      return response.unauthorized({ success: false, message: 'Authentication required' })
    }

    const trx = await db.transaction()

    try {
      const reservationId = Number(params.reservationId)
      if (isNaN(reservationId)) {
        await trx.rollback()
        return response.badRequest({ success: false, message: 'Reservation ID is required' })
      }

      if (!reservationRooms || !Array.isArray(reservationRooms) || reservationRooms.length === 0) {
        await trx.rollback()
        return response.badRequest({ success: false, message: 'reservationRooms must be a non-empty array' })
      }

      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (q) => q.preload('room'))
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ success: false, message: 'Reservation not found' })
      }

      // Only same-day undo allowed
      const todayISO = DateTime.now().toISODate()

      const roomsToUndo = await ReservationRoom.query({ client: trx })
        .whereIn('id', reservationRooms)
        .where('reservationId', reservationId)
        .preload('room')

      if (roomsToUndo.length === 0) {
        await trx.rollback()
        return response.notFound({ success: false, message: 'No matching reservation rooms for the provided IDs' })
      }

      // Validate statuses and dates
      const invalidRooms = roomsToUndo.filter(
        (rr) =>
          rr.status !== 'checked_in' ||
          !(
            (rr.actualCheckIn && rr.actualCheckIn.toISODate() === todayISO) ||
            (rr.checkInDate && rr.checkInDate.toISODate() === todayISO)
          )
      )

      if (invalidRooms.length > 0) {
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Undo check-in only allowed for rooms checked in today',
          errors: invalidRooms.map((rr) => `Room ${rr.roomId} is ${rr.status} or not checked in today`),
        })
      }

      const updatedRooms: any[] = []

      for (const rr of roomsToUndo) {
        rr.status = 'reserved'
        //rr.checkedInBy = null as any
        //rr.actualCheckIn = null as any
        //rr.checkInDate = null as any
        if (notes) rr.guestNotes = notes
        await rr.useTransaction(trx).save()
        updatedRooms.push(rr)

        if (rr.room) {
          rr.room.status = 'available'
          await rr.room.useTransaction(trx).save()
        }
      }

      // If no rooms remain checked-in, revert reservation status and check-in date
      const remainingCheckedIn = await ReservationRoom.query({ client: trx })
        .where('reservationId', reservationId)
        .where('status', ReservationStatus.CHECKED_IN)

      if (remainingCheckedIn.length === 0) {
        reservation.status = ReservationStatus.CONFIRMED
        //reservation.checkInDate = null
        await reservation.useTransaction(trx).save()
      }

      await LoggerService.log({
        actorId: auth.user.id,
        action: 'UNDO_CHECK_IN',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Undo check-in for rooms: ${reservationRooms.join(', ')} on reservation #${reservation.reservationNumber}`,
        ctx,
      })

      if (reservation.guestId) {
        await LoggerService.log({
          actorId: auth.user.id,
          action: 'UNDO_CHECK_IN',
          entityType: 'Guest',
          entityId: reservation.guestId,
          hotelId: reservation.hotelId,
          description: `Undo check-in on reservation #${reservation.reservationNumber}.`,
          meta: { reservationId: reservation.id, reservationNumber: reservation.reservationNumber, rooms: reservationRooms },
          ctx,
        })
      }

      await trx.commit()
      await GuestSummaryService.recomputeFromReservation(reservation.id)

      return response.ok({
        success: true,
        message: 'Undo check-in completed successfully',
        data: {
          reservation: {
            id: reservation.id,
            reservationNumber: reservation.reservationNumber,
            status: reservation.status,
            checkInDate: reservation.checkInDate,
          },
          updatedRooms: updatedRooms.map((room) => ({ id: room.id, roomId: room.roomId, status: room.status })),
        },
      })
    } catch (error) {
      await trx.rollback()
      logger.error('Error during undo check-in:', {
        reservationId: params.reservationId,
        reservationRooms,
        error: error.message,
        stack: error.stack,
      })

      return response.status(500).json({ success: false, message: 'An error occurred during undo check-in', errors: [error.message] })
    }
  }

  public async undoCheckOut(ctx: HttpContext) {
    const { params, response, request, auth } = ctx
    const { reservationRooms, notes } = request.body()

    if (!auth.user) {
      return response.unauthorized({ success: false, message: 'Authentication required' })
    }

    const trx = await db.transaction()

    try {
      const reservationId = Number(params.reservationId)
      if (isNaN(reservationId)) {
        await trx.rollback()
        return response.badRequest({ success: false, message: 'Reservation ID is required' })
      }

      if (!reservationRooms || !Array.isArray(reservationRooms) || reservationRooms.length === 0) {
        await trx.rollback()
        return response.badRequest({ success: false, message: 'reservationRooms must be a non-empty array' })
      }

      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (q) => q.preload('room'))
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ success: false, message: 'Reservation not found' })
      }

      const todayISO = DateTime.now().toJSDate()
      logger.info(reservation.departDate)
      /* const checkedOutTodayAtReservationLevel =
          reservation.checkOutDate && reservation.checkOutDate.toJSDate() === todayISO*/

      const roomsToUndo = await ReservationRoom.query({ client: trx })
        .whereIn('id', reservationRooms)
        .where('reservationId', reservationId)
        .preload('room')

      if (roomsToUndo.length === 0) {
        await trx.rollback()
        return response.notFound({ success: false, message: 'No matching reservation rooms for the provided IDs' })
      }

      const invalidRooms = roomsToUndo.filter((rr) => rr.status !== 'checked_out')
      if (invalidRooms.length > 0) {
        await trx.rollback()
        return response.badRequest({
          success: false,
          message: 'Undo check-out only allowed for rooms that are checked out',
          errors: invalidRooms.map((rr) => `Room ${rr.roomId} is ${rr.status}`),
        })
      }

      // If reservation-level checkout is set, enforce same-day undo
      /* if (!checkedOutTodayAtReservationLevel) {
         // fallback: allow if any selected room updated today (best effort)
         const anySelectedUpdatedToday = roomsToUndo.some(
           (rr) => rr.updatedAt && rr.updatedAt.toISODate() === todayISO
         )
         if (!anySelectedUpdatedToday) {
           await trx.rollback()
           return response.badRequest({
             success: false,
             message: 'Undo check-out only allowed for check-outs performed today',
           })
         }
       }*/

      const updatedRooms: any[] = []
      for (const rr of roomsToUndo) {
        rr.status = 'checked_in'
        //rr.checkedOutBy = null as any
        // rr.actualCheckOutTime = null
        if (notes) rr.guestNotes = notes
        await rr.useTransaction(trx).save()
        updatedRooms.push(rr)

        if (rr.room) {
          rr.room.status = 'occupied'
          await rr.room.useTransaction(trx).save()
        }
      }

      // If any room is no longer checked_out, ensure reservation is not CHECKED_OUT
      const stillCheckedOut = await ReservationRoom.query({ client: trx })
        .where('reservationId', reservationId)
        .where('status', ReservationStatus.CHECKED_OUT)

      if (stillCheckedOut.length === 0) {
        reservation.status = ReservationStatus.CHECKED_IN
        //reservation.checkOutDate = null
        await reservation.useTransaction(trx).save()
      }

      await LoggerService.log({
        actorId: auth.user.id,
        action: 'UNDO_CHECK_OUT',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Undo check-out for rooms: ${reservationRooms.join(', ')} on reservation #${reservation.reservationNumber}`,
        ctx,
      })

      if (reservation.guestId) {
        await LoggerService.log({
          actorId: auth.user.id,
          action: 'UNDO_CHECK_OUT',
          entityType: 'Guest',
          entityId: reservation.guestId,
          hotelId: reservation.hotelId,
          description: `Undo check-out on reservation #${reservation.reservationNumber}.`,
          meta: { reservationId: reservation.id, reservationNumber: reservation.reservationNumber, rooms: reservationRooms },
          ctx,
        })
      }

      await trx.commit()
      await GuestSummaryService.recomputeFromReservation(reservation.id)

      return response.ok({
        success: true,
        message: 'Undo check-out completed successfully',
        data: {
          reservation: {
            id: reservation.id,
            reservationNumber: reservation.reservationNumber,
            status: reservation.status,
            checkOutDate: reservation.checkOutDate,
          },
          updatedRooms: updatedRooms.map((room) => ({ id: room.id, roomId: room.roomId, status: room.status })),
        },
      })
    } catch (error) {
      logger.info(error)
      await trx.rollback()
      logger.error('Error during undo check-out:', {
        reservationId: params.reservationId,
        reservationRooms,
        error: error.message,
        stack: error.stack,
      })

      return response.status(500).json({ success: false, message: 'An error occurred during undo check-out', errors: [error.message] })
    }
  }

  /**
   * Get a single reservation with all its related information,
   * including the user, service product, and payment.
   *
   * GET /reservations/:id
   */
  public async getReservationDetails({ params, response, auth }: HttpContext) {
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
            'is_primary',
            'guest_type',
            'room_assignment',
            'special_requests',
            'dietary_restrictions',
            'accessibility',
            'emergency_contact',
            'emergency_phone',
            'notes',
          ])
        })
        .preload('folios', (query) => {
          query.preload('transactions', (tq) => {
            tq.where('isVoided', false).whereNot('status', TransactionStatus.VOIDED)
          })
        })

        .preload('bookingSource')
        .preload('reservationRooms', (query) => {
          query.preload('roomType')
          query.preload('guest')
          query
            .preload('room')
            .preload('paymentMethod')
            .preload('roomRates', (queryRoom: any) => {
              queryRoom.preload('rateType')
            })
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }

      // Calculate balance summary from folio transactions
      const balanceSummary = ReservationsController.calculateBalanceSummary(reservation.folios)

      // Calculate average daily rate
      const avgDailyRate = this.calculateAvgDailyRate(reservation)

      // Determine available actions based on reservation status
      const availableActions = this.getAvailableActions(
        reservation,
        JSON.parse(auth.user?.permisPrivileges || '[]')
      )

      const result = {
        ...reservation.toJSON(),
        balanceSummary,
        avgDailyRate,
        availableActions,
      }

      return response.ok(result)
    } catch (error) {
      console.error('Error fetching reservation details:', error)
      return response.internalServerError({
        message: 'An error occurred while fetching the reservation.',
      })
    }
  }

  /**
   * Get minimal reservation and room details for quick views.
   * GET /reservation/:reservationId/basicdetails
   */
  public async getReservationBasicDetails({ params, response }: HttpContext) {
    try {
      const reservationId = parseInt(params.reservationId, 10)
      if (isNaN(reservationId)) {
        return response.badRequest({ message: 'Invalid reservation ID. Must be a valid number.' })
      }

      const reservation = await Reservation.query()
        .select(['id', 'reservation_number', 'status', 'guest_id', 'arrived_date', 'depart_date'])
        .where('id', reservationId)
        .preload('guest', (gq) => gq.select(['id', 'firstName', "lastName", 'title']))
        .preload('reservationRooms', (rq) => {
          rq.select(['id', 'room_id', 'status', 'check_in_date', 'check_out_date','roomRateId'])
            .preload('room', (roomQ) => {
              roomQ.select(['id', 'room_number', 'room_type_id'])
                .preload('roomType', (rtQ) => rtQ.select(['id', 'room_type_name']))
            })
            .preload('roomRates', (rateQ) => {
              rateQ.select(['id', 'rate_type_id'])
                .preload('rateType', (rtQ) => rtQ.select(['id', 'rate_type_name']))
            })
        })
        .first()

      if (!reservation) {
        return response.notFound({ message: 'Reservation not found' })
      }
      return response.ok(reservation)
    } catch (error) {
      return response.internalServerError({ message: 'Failed to get basic reservation details', error: error.message })
    }
  }

  /**
   * Calculate balance summary from folio transactions
   */
  public static calculateBalanceSummary(folios: any[]) {
    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0

    folios.forEach((folio) => {
      const activeTransactions = folio.transactions.filter(
        (t: any) => t.status !== TransactionStatus.VOIDED && t.isVoided === false
      )
      if (activeTransactions) {
        activeTransactions.forEach((transaction: any) => {
          const amount = parseFloat(transaction.amount) || 0

          switch (transaction.transactionType) {
            case 'charge':
              totalCharges += amount
              break
            case TransactionType.ROOM_POSTING:
              totalCharges += amount
              break
            case TransactionType.TRANSFER:
              if (transaction.category === TransactionCategory.TRANSFER_IN) {
                // Treat transfer-in as a charge (debit)
                totalCharges += amount
              } else if (transaction.category === TransactionCategory.TRANSFER_OUT) {
                // Treat transfer-out as a payment (credit)
                totalPayments += Math.abs(amount)
              }
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
              totalCharges -= Math.abs(amount)
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

    const outstandingBalance =
      totalCharges +
      totalTaxes +
      totalServiceCharges -
      totalPayments +
      totalAdjustments

    return {
      totalCharges: parseFloat(totalCharges.toFixed(2)),
      totalPayments: parseFloat(totalPayments.toFixed(2)),
      totalAdjustments: parseFloat(totalAdjustments.toFixed(2)),
      totalTaxes: parseFloat(totalTaxes.toFixed(2)),
      totalServiceCharges: parseFloat(totalServiceCharges.toFixed(2)),
      totalDiscounts: parseFloat(totalDiscounts.toFixed(2)),
      outstandingBalance: parseFloat(outstandingBalance.toFixed(2)),
      totalChargesWithTaxes: parseFloat(
        (totalCharges + totalTaxes + totalServiceCharges).toFixed(2)
      ),
      balanceStatus:
        outstandingBalance > 0 ? 'outstanding' : outstandingBalance < 0 ? 'credit' : 'settled',
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
  private getAvailableActions(reservation: any, userPermissions: string[]) {
    const actions = []
    const status =
      reservation.status?.toLowerCase() || reservation.reservation_status?.toLowerCase()
    const currentDate = new Date()
    const arrivalDate = new Date(reservation.arrivedDate || reservation.checkInDate)
    const departureDate = new Date(reservation.departDate || reservation.checkOutDate)
    const canUnAssign = reservation.reservationRooms.some(
      (reservationRoom: any) => reservationRoom.roomId
    )

    const todayISO = DateTime.now().toISODate()
    const reservationCheckedInToday =
      reservation.checkInDate && reservation.checkInDate.toISODate && reservation.checkInDate.toISODate() === todayISO
    const reservationCheckedOutToday =
      reservation.checkOutDate && reservation.checkOutDate.toISODate && reservation.checkOutDate.toISODate() === todayISO

    const hasSameDayRoomCheckIn = Array.isArray(reservation.reservationRooms) && reservation.reservationRooms.some(
      (rr: any) =>
        ['checked_in'].includes((rr.status || '').toLowerCase()) &&
        ((rr.actualCheckIn && rr.actualCheckIn.toISODate && rr.actualCheckIn.toISODate() === todayISO) ||
          (rr.checkInDate && rr.checkInDate.toISODate && rr.checkInDate.toISODate() === todayISO))
    )

    const hasSameDayRoomCheckOut = Array.isArray(reservation.reservationRooms) && reservation.reservationRooms.some(
      (rr: any) => (rr.status || '').toLowerCase() === 'checked_out' && rr.updatedAt && rr.updatedAt.toISODate && rr.updatedAt.toISODate() === todayISO
    )

    // Check-in: Available for confirmed reservations on or after arrival date
    if (
      userPermissions.includes('check_in_guest') &&
      ['confirmed', 'guaranteed', 'pending'].includes(status) &&
      currentDate >= arrivalDate
    ) {
      actions.push({
        action: 'check_in',
        label: 'Check-in',
        description: 'Register guest arrival and assign room',
        available: true,
        route: `/reservations/${reservation.id}/check-in`,
      })
    }
    // Checkout : Available during stay (checked-in status)
    if (
      userPermissions.includes('check_out_guest') &&
      ['checked-in', 'checked_in'].includes(status) &&
      currentDate >= departureDate
    ) {
      actions.push({
        action: 'check_out',
        label: 'Check-out',
        description: 'Check out guest to a different room',
        available: true,
        route: `/reservations/${reservation.id}/check-out`,
      })
    }

    // Undo Check-in: allowed if check-in occurred today on reservation or any room
    if (
      userPermissions.includes('check_in_guest') &&
      ['checked-in', 'checked_in'].includes(status) &&
      (reservationCheckedInToday || hasSameDayRoomCheckIn)
    ) {
      actions.push({
        action: 'undo_check_in',
        label: 'Undo Check-in',
        description: 'Revert same-day check-in for selected rooms',
        available: true,
        route: `/reservations/${reservation.id}/undo-checkin`,
      })
    }

    // Undo Check-out: allowed if check-out occurred today on reservation or any room
    if (
      userPermissions.includes('check_out_guest') &&
      ['checked-out', 'checked_out'].includes(status) &&
      (reservationCheckedOutToday || hasSameDayRoomCheckOut)
    ) {
      actions.push({
        action: 'undo_check_out',
        label: 'Undo Check-out',
        description: 'Revert same-day check-out for selected rooms',
        available: true,
        route: `/reservations/${reservation.id}/undo-check-out`,
      })
    }
    // Add Payment: Available for all active reservations
    if (
      userPermissions.includes('add_item_to_open_folio') &&
      !['cancelled', 'no-show', 'voided'].includes(status)
    ) {
      actions.push({
        action: 'add_payment',
        label: 'Add Payment',
        description: 'Record a payment to reduce outstanding balance',
        available: true,
        route: `/reservations/${reservation.id}/add-payment`,
      })
    }

    // Amend Stay: Available before or during stay
    if (
      userPermissions.includes('access_to_extend_guest_stay') &&
      ['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in'].includes(status)
    ) {
      actions.push({
        action: 'amend_stay',
        label: 'Amend Stay',
        description: 'Modify reservation details, dates, or room type',
        available: true,
        route: `/reservations/${reservation.id}/amend-stay`,
      })
    }

    // Room Move: Available during stay (checked-in status)
    if (
      userPermissions.includes('access_to_move_room') &&
      ['checked-in', 'checked_in', 'confirmed', 'guaranteed', 'pending'].includes(status)
    ) {
      actions.push({
        action: 'room_move',
        label: 'Room Move',
        description: 'Move guest to a different room',
        available: true,
        route: `/reservations/${reservation.id}/room-move`,
      })
    }

    // Exchange Room: Similar to room move
    if (
      userPermissions.includes('access_to_move_room') &&
      ['checked-in', 'checked_in', 'confirmed', 'guaranteed', 'pending'].includes(status)
    ) {
      actions.push({
        action: 'exchange_room',
        label: 'Exchange Room',
        description: 'Exchange guest room assignment',
        available: true,
        route: `/reservations/${reservation.id}/exchange-room`,
      })
    }

    // Stop Room Move: Available if there's a pending room move
    if (
      userPermissions.includes('access_to_override_stop_room_move') &&
      ['confirmed', 'guaranteed', 'pending', 'checked-in', 'checked_in'].includes(status)
    ) {
      actions.push({
        action: 'stop_room_move',
        label: 'Stop Room Move',
        description: 'Add Flag stop move',
        available: false, // Would need to check if there's a pending move
        route: `/reservations/${reservation.id}/stop-room-move`,
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
    if (
      userPermissions.includes('cancel_reservation') &&
      ['confirmed', 'guaranteed', 'pending'].includes(status) &&
      currentDate < arrivalDate
    ) {
      actions.push({
        action: 'cancel_reservation',
        label: 'Cancel Reservation',
        description: 'Cancel the reservation with applicable fees',
        available: true,
        route: `/reservations/${reservation.id}/cancel`,
      })
    }

    // No Show: Available after scheduled arrival time for non-arrived guests
    if (
      userPermissions.includes('mark_no_show') &&
      ['confirmed', 'guaranteed', 'pending'].includes(status) &&
      currentDate > arrivalDate
    ) {
      actions.push({
        action: 'no_show',
        label: 'No Show',
        description: 'Mark reservation as no-show and apply fees',
        available: true,
        route: `/reservations/${reservation.id}/no-show`,
      })
    }

    // Void Reservation: Available for recent reservations with errors
    const numRooms = reservation.reservationRooms?.length || 0

    if (
      userPermissions.includes('void_reservation') &&
      ['confirmed', 'guaranteed', 'pending'].includes(status) &&
      numRooms <= 1
    ) {
      actions.push({
        action: 'void_reservation',
        label: 'Void Reservation',
        description: 'Completely remove reservation from system',
        available: true,
        route: `/reservations/${reservation.id}/void`,
      })
    }

    // Unassign Room: Available for confirmed reservations with assigned rooms
    if (
      userPermissions.includes('unassign_room') &&
      canUnAssign &&
      ['confirmed', 'guaranteed', 'pending'].includes(status)
    ) {
      actions.push({
        action: 'unassign_room',
        label: 'Unassign Room',
        description: 'Remove specific room assignment',
        available: true,
        route: `/reservations/${reservation.id}/unassign-room`,
      })
    }
    return actions
  }

  /**
   * Met à jour les folios après amendement de la réservation
   * Delete existing room charges and repost them based on new stay details
   */


  private async updateFoliosAfterAmendment(reservation: any, trx: any, userId: number) {
  await reservation.load('folios')

  // On utilise le 'trx' passé en paramètre
  await FolioTransaction.query({ client: trx })
    .whereIn('folioId', reservation.folios.map((f: any) => f.id))
    .where('transactionType', TransactionType.CHARGE)
    .where('category', TransactionCategory.ROOM)
    .where('status', '!=', TransactionStatus.VOIDED)
    .delete()


  await ReservationFolioService.postRoomCharges(reservation.id, userId, trx)
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
      messages: '',
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
        await trx.rollback()
        res.messages = 'The new departure date must be later than the current departure date.'
        return response.status(200).json(res)
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
      await trx.rollback()
      res.messages = 'An error has occurred.' + error.message
      console.error('Erreur lors de la prolongation du séjour :', error)
      return response.status(200).json(res)
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
      const body = request.body()
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
      reservation.departDate = body.newDepartDate
      // --- Aucune conflit : Procéder à la prolongation ---
      const oldReservationData = { ...reservation.serialize() }
      const newDepartDate = reservation.departDate

      // const newDepartDateLuxon = DateTime.fromISO(newDepartDate);
      // const arrivedDateLuxon = DateTime.fromJSDate(new Date(reservation.arrivedDate));
      const newDepartDateLuxon = DateTime.fromISO(String(newDepartDate))
      const arrivedDateLuxon = DateTime.fromISO(String(reservation.arrivedDate))

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

      await GuestSummaryService.recomputeFromReservation(reservationId)
      return response.ok({ message: 'The stay was successfully extended.', reservation })
    } catch (error) {
      await trx.rollback()
      console.error('Erreur lors de la prolongation du séjour :', error)
      return response.internalServerError({
        message: 'An error has occurred.',
        error: error.message,
      })
    }
  }

  public async getCancellationSummary({ params, response }: HttpContext) {
    try {
      const reservationId = params.id
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('hotel')
        .preload('reservationRooms')
        .preload('paymentMethod')
        .first()

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
          cancellationFee: 0.0,
          deadline: null,
          summaryMessage: 'Free cancellation possible at any time, as no policy is defined.',
        })
      }

      // Case where cancellation is always free
      if (policy.cancellation_fee_type === 'none') {
        return response.ok({
          isFreeCancellationPossible: true,
          cancellationFee: 0.0,
          deadline: null,
          summaryMessage: 'Free cancellation possible at any time.',
        })
      }

      if (!reservation.arrivedDate) {
        return response.badRequest({ message: 'The reservation does not have an arrival date.' })
      }

      // Calculate free cancellation deadline
      // const arrivalDate = DateTime.fromJSDate(new Date(reservation.arrivedDate))
      const arrivalDate = reservation.arrivedDate
      if (!arrivalDate.isValid) {
        return response.badRequest({ message: 'Invalid arrival date format.' })
      }
      const freeCancellationDeadline = arrivalDate.minus({
        [policy.free_cancellation_period_unit]: 1,
      })

      const now = DateTime.now()
      const isFreeCancellationPossible = now <= freeCancellationDeadline

      let cancellationFee = 0.0
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
    const { reason, cancellationFee, selectedRooms } = request.body()

    const trx = await db.transaction()

    try {
      if (!selectedRooms || selectedRooms.length === 0) {
        // Si rien n'est sélectionné, on ne fait rien ou on renvoie une erreur
        await trx.rollback()
        return response.badRequest({
          message: 'No rooms selected for cancellation.',
        })
      }
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
        [
          ReservationStatus.CANCELLED,
          ReservationStatus.CHECKED_OUT,
          ReservationStatus.CHECKED_IN,
        ].includes(reservation.status as ReservationStatus)
      ) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot cancel a reservation with status '${reservation.status}'.`,
        })
      }



      const cancelledRooms: string[] = []


      for (const resService of reservation.reservationRooms) {
        if (
          selectedRooms.includes(resService.id) &&
          resService.status !== ReservationProductStatus.CANCELLED
        ) {
          resService.status = ReservationProductStatus.CANCELLED
          resService.lastModifiedBy = auth.user!.id
          await resService.save()

          const room = await Room.find(resService.roomId)
          if (room) {
            room.status = 'available'
            room.lastModifiedBy = auth.user!.id
            await room.save()
            cancelledRooms.push(room.roomNumber)
          }

          // Logger pour la chambre
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CANCEL',
            entityType: 'ReservationRoom',
            entityId: resService.id,
            hotelId: reservation.hotelId,
            description: `Room ${room?.roomNumber ?? '(unknown)'} from reservation #${reservation.reservationNumber} was cancelled. Reason: ${reason || 'N/A'}.`,
            meta: { reason, cancellationFee },
            ctx: ctx,
          })
        }
      }

      const allRoomsCancelled = reservation.reservationRooms?.every(
        (room) => room.status === ReservationProductStatus.CANCELLED
      )

      const shouldCancelReservation = allRoomsCancelled

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
      const cancelledList =
        cancelledRooms.length > 0 ? `[${cancelledRooms.join(', ')}]` : '(none)'
      // 6. Log and commit
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CANCEL',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Reservation #${reservation.reservationNumber} cancelled. Rooms: ${cancelledList}. Reason: ${reason || 'N/A'}. Fee applied: ${cancellationFee || 0}.`,
        meta: {
          reason,
          cancellationFee,
          cancelledRooms,
          foliosClosed,
          transactionsCancelled,
        },
        ctx: ctx,
      })
      //log for guest
      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CANCEL_RESERVATION',
        entityType: 'Guest',
        entityId: reservation.guestId,
        hotelId: reservation.hotelId,
        description: `Guest #${reservation.guestId}: Reservation #${reservation.reservationNumber} cancelled. Rooms: ${cancelledList}. Reason: ${reason || 'N/A'}. Fee: ${cancellationFee || 0}.`,
        meta: {
          reason,
          cancellationFee,
          cancelledRooms,
        },
        ctx: ctx,
      })

      await trx.commit()

      if (shouldCancelReservation) {
        try {
          const freshReservation = await Reservation.find(reservation.id)
          if (freshReservation) {
            await freshReservation
              .merge({
                status: ReservationStatus.CANCELLED,
                cancellationReason: reason,
                lastModifiedBy: auth.user!.id,
                cancellationDate: DateTime.now(),
              })
              .save()
          }
        } catch { }
      }


      setImmediate(async () => {
        try {
          const NotificationService = (await import('#services/notification_service')).default

          // Déterminer le type d'annulation
          const isFullCancellation = shouldCancelReservation
          const cancellationType = isFullCancellation ? 'FULL' : 'PARTIAL'

          // Variables communes
          const guestName = reservation.guest
            ? `${reservation.guest.firstName || ''} ${reservation.guest.lastName || ''}`.trim()
            : 'Guest'


          try {

            const staffTemplateCode = isFullCancellation
              ? 'RESERVATION_CANCELLED'
              : 'RESERVATION_PARTIAL_CANCELLED'

            const staffVariables = await NotificationService.buildVariables(staffTemplateCode, {
              hotelId: reservation.hotelId,
              reservationId: reservation.id,
              guestId: reservation.guestId,
              extra: {
                ReservationNumber: reservation.reservationNumber || 'N/A',
                GuestName: guestName,
                CancellationDate: DateTime.now().toISODate(),
                CancelledRooms: cancelledList,
                CancellationReason: reason || 'No reason provided',
                CancellationFee: cancellationFee || '0',
                StaffMember: auth.user?.fullName || `User ${auth.user?.id}`,
                CancellationType: cancellationType,
                TotalRoomsCancelled: cancelledRooms.length,
              },
            })

            await NotificationService.sendWithTemplate({
              templateCode: staffTemplateCode,
              recipientType: 'STAFF',
              recipientId: auth.user!.id,
              variables: staffVariables,
              relatedEntityType: 'Reservation',
              relatedEntityId: reservation.id,
              actorId: auth.user!.id,
              hotelId: reservation.hotelId,
            })

          } catch (staffError) {
            console.error('❌ Erreur notification STAFF:', (staffError as any)?.message)
          }

          if (reservation.guest && reservation.guest.email) {
            try {
              const guestTemplateCode = isFullCancellation
                ? 'RESERVATION_CANCELLED_GUEST'
                : 'RESERVATION_PARTIAL_CANCELLED_GUEST'

              const guestVariables = await NotificationService.buildVariables(guestTemplateCode, {
                hotelId: reservation.hotelId,
                reservationId: reservation.id,
                guestId: reservation.guestId,
                extra: {
                  ReservationNumber: reservation.reservationNumber || 'N/A',
                  GuestName: guestName,
                  CancellationDate: DateTime.now().toISODate(),
                  CancelledRooms: cancelledList,
                  CancellationReason: reason || 'No reason provided',
                  CancellationFee: cancellationFee || '0',
                  ContactEmail: reservation.guest.email,
                  ContactPhone: reservation.guest.phonePrimary || 'N/A',
                  RefundAmount: cancellationFee ? `-${cancellationFee}` : '0',
                  RefundMethod: 'Original payment method'
                },
              })

              await NotificationService.sendWithTemplate({
                templateCode: guestTemplateCode,
                recipientType: 'GUEST',
                recipientId: reservation.guestId,
                variables: guestVariables,
                relatedEntityType: 'Reservation',
                relatedEntityId: reservation.id,
                actorId: auth.user!.id,
                hotelId: reservation.hotelId,
              })

            } catch (guestError) {
              console.error('Erreur notification GUEST:', (guestError as any)?.message)
            }
          } else {
            console.log(' Pas d\'email disponible pour le guest, notification non envoyée')
          }
        } catch (notifError) {
          console.error(' Erreur générale dans les notifications:', notifError)
        }
      })
      await GuestSummaryService.recomputeFromReservation(reservationId)
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

  public async searchReservations({ request, response, auth }: HttpContext) {
    try {
      const {
        searchText = '',
        status = '',
        roomType = '',
        checkInDate = '',
        checkOutDate = '',
        rateType = '',
        source = '',
        showBookings = '',
        dateType = '',
        dateStart = '',
        dateEnd = '',
        stayCheckInDate = '',
        stayCheckOutDate = '',
        reservationType = ''
      } = request.qs()
      const params = request.params()

      const query = Reservation.query()

      // 1. Filter by searchText (guest name, email, reservation number, etc.)
      if (searchText) {
        query.where((builder) => {
          builder
            .where('reservation_number', 'ILIKE', `%${searchText}%`)
            .orWhere('group_name', 'like', `%${searchText}%`)
            .orWhere('company_name', 'like', `%${searchText}%`)
            .orWhere('source_of_business', 'like', `%${searchText}%`)
            .orWhereHas('guest', (userQuery) => {
              userQuery
                .where('first_name', 'ILIKE', `%${searchText}%`)
                .orWhere('last_name', 'ILIKE', `%${searchText}%`)
                .orWhere('email', 'like', `%${searchText}%`)
                .orWhere('phone_primary', 'like', `%${searchText}%`)
            })
            .orWhereHas('reservationRooms', (roomQuery) => {
              roomQuery
                .whereHas('room', (roomSubQuery: any) => {
                  roomSubQuery.where('room_number', 'like', `%${searchText}%`)
                })
                .orWhereHas('roomType', (roomTypeQuery: any) => {
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


      if (stayCheckInDate && stayCheckOutDate) {
        const startDate = DateTime.fromISO(stayCheckInDate).toISODate()
        const endDate = DateTime.fromISO(stayCheckOutDate).toISODate()
        if (startDate && endDate) {
          // Rechercher les réservations qui sont en cours pendant cette période
          query
            .where('arrived_date', '<=', endDate)
            .andWhere('depart_date', '>=', startDate)
            .andWhere('status', 'checked_in')
        }
      }

      if (dateType && dateStart && dateEnd) {
        const startDate = DateTime.fromISO(dateStart).toISODate()
        const endDate = DateTime.fromISO(dateEnd).toISODate()

        if (startDate && endDate) {
          switch (dateType) {
            case 'arrival':
              query.where('arrived_date', '>=', startDate).where('arrived_date', '<=', endDate)
              break
            case 'departure':
              query.where('depart_date', '>=', startDate).where('depart_date', '<=', endDate)
              break
            case 'created':
              query.where('created_at', '>=', startDate).where('created_at', '<=', endDate)
              break
            case 'cancelled':

              query.where('status', 'cancelled')
              break
          }
        }
      }

      // 4. Filter by roomType (product name)
      if (roomType) {
        query.whereHas('reservationRooms', (rspQuery) => {
          rspQuery.whereHas('room', (spQuery: any) => {
            spQuery.where('room_type_id', roomType)
          })
        })
      }
      if (rateType) {
        query.whereHas('reservationRooms', (rspQuery) => {
          rspQuery.whereHas('rateType', (rateTypeQuery: any) => {
            rateTypeQuery.where('rate_type_name', 'like', `%${rateType}%`)
          })
        })
      }
      if (source) {
        query.where('businessSourceId', source)
      }

      // Filter par showBookings (toggles)

      if (showBookings) {
        const bookingTypes = showBookings.split(',')

        query.where((builder) => {
          // Si 'web' ou 'channel' est sélectionné
          if (bookingTypes.includes('web')) {
            builder.orWhere((b) => {
              b.whereNotNull('ota_name').orWhereNotNull('ota_reservation_code')
            })
          }

          if (bookingTypes.includes('channel')) {
            builder.orWhere((b) => {
              b.whereNotNull('channex_booking_id')
            })
          }

          // Si 'pms' est sélectionné
          if (bookingTypes.includes('pms')) {
            builder.orWhere((b) => {
              b.whereNull('ota_name').whereNull('ota_reservation_code')
            })
          }
        })
      }


      if (reservationType) {
        query.where('reservationTypeId', reservationType)
      }

      // Preload related data for the response
      query
        .andWhere('hotel_id', params.id)
        .whereNotNull('hotel_id')
        .preload('guest')
        .preload('roomType')
        .preload('bookingSource')
        .preload('reservationType', (sQuery: any) => {
          sQuery.select(['id', 'name'])
        })
        .preload('discount')
        .preload('paymentMethod')
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions')
        })
        //.preload('hotel')
        .preload('reservationRooms', (rspQuery) => {
          rspQuery.preload('room').preload('rateType', (sQuery: any) => {
            sQuery.select(['id', 'rate_type_name'])
          })
        })
        .orderBy('created_at', 'desc')
        .limit(50)

      const reservations = await query

      // Calculate balanceSummary and availableActions for each reservation
      const enrichedReservations = reservations.map((reservation) => {
        const balanceSummary = ReservationsController.calculateBalanceSummary(reservation.folios)
        const availableActions = this.getAvailableActions(
          reservation,
          JSON.parse(auth.user?.permisPrivileges || '[]')
        )

        // Include computed fields from the reservation model
        const reservationData = reservation.toJSON()

        return {
          ...reservationData,
          // Add computed fields explicitly
          dayuse: reservation.dayuse,
          dayuseDuration: reservation.dayuseDuration,
          totalOccupancy: reservation.totalOccupancy,
          averageRatePerNight: reservation.averageRatePerNight,
          isConfirmed: reservation.isConfirmed,
          isCheckedIn: reservation.isCheckedIn,
          isCheckedOut: reservation.isCheckedOut,
          isCancelled: reservation.isCancelled,
          isActive: reservation.isActive,
          hasBalance: reservation.hasBalance,
          isFullyPaid: reservation.isFullyPaid,
          displayName: reservation.displayName,
          // Additional calculated fields
          balanceSummary,
          availableActions,
        }
      })

      // Calculate statistics
      const today = DateTime.now().toISODate()
      const hotelId = params.id

      // Total reservations count (with same filters)
      const totalQuery = Reservation.query().where('hotel_id', hotelId).whereNotNull('hotel_id').whereNot('status', 'voided')
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
              roomQuery
                .whereHas('room', (roomSubQuery: any) => {
                  roomSubQuery.where('room_number', 'like', `%${searchText}%`)
                })
                .orWhereHas('roomType', (roomTypeQuery: any) => {
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
          rspQuery.whereHas('room', (spQuery: any) => {
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
        inHouse: inHouse[0].$extras.total,
      }

      return response.ok({
        reservations: enrichedReservations,
        statistics,
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
   * List in-house reservations filtered by roomId and roomTypeId
   * Returns ReservationRoom rows with related reservation, guest, room, roomType, rateType
   */
  async getInHouseReservations({ request, response }: HttpContext) {
    try {
      const hotelIdRaw = request.input('hotelId') ?? request.qs().hotelId
      const roomIdRaw = request.input('roomId') ?? request.qs().roomId
      const roomTypeIdRaw = request.input('roomTypeId') ?? request.qs().roomTypeId

      const hotelId = hotelIdRaw ? parseInt(hotelIdRaw) : NaN
      const roomId = roomIdRaw ? parseInt(roomIdRaw) : undefined
      const roomTypeId = roomTypeIdRaw ? parseInt(roomTypeIdRaw) : undefined

      if (!hotelId || Number.isNaN(hotelId)) {
        return response.badRequest({
          success: false,
          message: 'hotelId is required and must be a number',
        })
      }

      const { default: ReservationRoom } = await import('#models/reservation_room')

      let query = ReservationRoom.query().where('hotel_id', hotelId).where('status', 'checked_in')

      if (roomId && !Number.isNaN(roomId)) {
        query = query.where('room_id', roomId)
      }
      if (roomTypeId && !Number.isNaN(roomTypeId)) {
        query = query.where('room_type_id', roomTypeId)
      }

      query
        .preload('reservation', (resQ) => {
          resQ.preload('guest').preload('bookingSource')
        })
        .preload('guest')
        .preload('room', (roomQ) => {
          roomQ.preload('roomType')
        })
        .preload('roomType')
        .preload('rateType')

      const rows = await query

      const data = rows.map((rr) => {
        const res = rr.reservation
        const guest = res?.guest || rr.guest
        return {
          reservationRoomId: rr.id,
          reservationId: res?.id || rr.reservationId,
          guestName: guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : '—',
          roomId: rr.roomId,
          roomNumber: rr.room?.roomNumber,
          roomTypeId: rr.roomTypeId,
          roomTypeName: rr.roomType?.roomTypeName || rr.room?.roomType?.roomTypeName,
          checkInDate: rr.checkInDate?.toISODate?.() || undefined,
          checkOutDate: rr.checkOutDate?.toISODate?.() || undefined,
          nights: rr.nights,
          rateTypeId: rr.rateTypeId,
          rateTypeName: rr.rateType?.rateTypeName,
          bookingSource: res?.bookingSource?.sourceName,
          status: rr.status,
        }
      })

      return response.ok({ success: true, count: data.length, data })
    } catch (error) {
      logger.error('Error fetching in-house reservations:', error)
      return response
        .status(500)
        .json({
          success: false,
          message: 'Failed to fetch in-house reservations',
          error: error.message,
        })
    }
  }

  /**
   * List occupied rooms with rate type relation
   * Returns ReservationRoom rows currently checked-in, grouped by room with rate type.
   */
  async getOccupiedRooms({ request, response }: HttpContext) {
    try {
      const hotelIdRaw = request.input('hotelId') ?? request.qs().hotelId
      const roomTypeIdRaw = request.input('roomTypeId') ?? request.qs().roomTypeId

      const hotelId = hotelIdRaw ? parseInt(hotelIdRaw) : NaN
      const roomTypeId = roomTypeIdRaw ? parseInt(roomTypeIdRaw) : undefined

      if (!hotelId || Number.isNaN(hotelId)) {
        return response.badRequest({
          success: false,
          message: 'hotelId is required and must be a number',
        })
      }

      const { default: ReservationRoom } = await import('#models/reservation_room')

      let query = ReservationRoom.query().where('hotel_id', hotelId).where('status', 'checked_in')

      if (roomTypeId && !Number.isNaN(roomTypeId)) {
        query = query.where('room_type_id', roomTypeId)
      }

      query
        .preload('reservation', (resQ) => {
          resQ.preload('guest')
        })
        .preload('room', (roomQ) => {
          roomQ.preload('roomType')
        })
        .preload('rateType')

      const rows = await query

      const data = rows.map((rr) => ({
        roomId: rr.roomId,
        roomNumber: rr.room?.roomNumber,
        roomTypeId: rr.roomTypeId || rr.room?.roomType?.id,
        roomTypeName: rr.room?.roomType?.roomTypeName,
        reservationRoomId: rr.id,
        reservationId: rr.reservationId,
        guestName: rr.reservation?.guest
          ? `${rr.reservation.guest.firstName || ''} ${rr.reservation.guest.lastName || ''}`.trim()
          : '—',
        rateTypeId: rr.rateTypeId,
        rateTypeName: rr.rateType?.rateTypeName,
        checkInDate: rr.checkInDate?.toISODate?.(),
        checkOutDate: rr.checkOutDate?.toISODate?.(),
      }))

      return response.ok({ success: true, count: data.length, data })
    } catch (error) {
      logger.error('Error fetching occupied rooms:', error)
      return response
        .status(500)
        .json({ success: false, message: 'Failed to fetch occupied rooms', error: error.message })
    }
  }
  public async getReservationById({ request, response, auth, params }: HttpContext) {
    try {
      const reservationId = params.id
      const hotelId = params.hotelId

      // Requête pour récupérer la réservation avec toutes les relations
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .if(hotelId, (query) => query.where('hotel_id', hotelId))
        .preload('guest')
        .preload('roomType')
        .preload('bookingSource')
        .preload('discount')
        .preload('paymentMethod')
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions')
        })
        .preload('reservationRooms', (rspQuery) => {
          rspQuery
            .preload('room')
            .preload('roomType')
        })
        .firstOrFail()

      // Calculer balanceSummary et availableActions
      const balanceSummary = ReservationsController.calculateBalanceSummary(reservation.folios)
      const availableActions = this.getAvailableActions(
        reservation,
        JSON.parse(auth.user?.permisPrivileges || '[]')
      )

      // Construire la réponse complète
      const reservationData = reservation.toJSON()

      const enrichedReservation = {
        ...reservationData,
        // Computed fields du modèle
        dayuse: reservation.dayuse,
        dayuseDuration: reservation.dayuseDuration,
        totalOccupancy: reservation.totalOccupancy,
        averageRatePerNight: reservation.averageRatePerNight,
        isConfirmed: reservation.isConfirmed,
        isCheckedIn: reservation.isCheckedIn,
        isCheckedOut: reservation.isCheckedOut,
        isCancelled: reservation.isCancelled,
        isActive: reservation.isActive,
        hasBalance: reservation.hasBalance,
        isFullyPaid: reservation.isFullyPaid,
        displayName: reservation.displayName,
        // Champs calculés
        balanceSummary,
        availableActions,
      }

      return response.ok(enrichedReservation)
    } catch (error) {
      logger.error('Error fetching reservation: %o', error)

      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          message: 'Reservation not found',
        })
      }

      return response.internalServerError({
        message: 'An error occurred while fetching the reservation.',
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
          message: 'No data received',
        })
      }

      // Validate required fields - rooms are now optional
      if (!data.hotel_id || !data.arrived_date || !data.depart_date) {
        return response.badRequest({
          success: false,
          message: 'Missing required fields: hotel_id, arrived_date, depart_date',
        })
      }

      // Validate date format and logic
      const arrivedDate = DateTime.fromISO(data.arrived_date)
      const departDate = DateTime.fromISO(data.depart_date)

      if (!arrivedDate.isValid || !departDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format. Use ISO format (YYYY-MM-DD)',
        })
      }

      // Modified date validation to allow same day reservations with different times
      if (arrivedDate.toISODate() === departDate.toISODate()) {
        // Same day reservation - validate times
        if (!data.check_in_time || !data.check_out_time) {
          return response.badRequest({
            success: false,
            message: 'For same-day reservations, both arrival and departure times are required',
          })
        }

        const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
        const departureDateTime = DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)

        if (!arrivalDateTime.isValid || !departureDateTime.isValid) {
          return response.badRequest({
            success: false,
            message: 'Invalid time format. Use HH:mm format',
          })
        }

        if (departureDateTime <= arrivalDateTime) {
          return response.badRequest({
            success: false,
            message: 'Departure time must be after arrival time for same-day reservations',
          })
        }
      } else if (departDate <= arrivedDate) {
        return response.badRequest({
          success: false,
          message: 'Departure date must be after arrival date',
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
            message: validationErrors.join(', '),
          })
        }

        // Create or find primary guest
        const guest = await ReservationService.createOrFindGuest(data, trx)

        // Generate reservation numbers
        const confirmationNumber = generateConfirmationNumber()
        const reservationNumber = generateReservationNumber()

        // Calculate guest totals - handle case when rooms array is empty or undefined
        const rooms = data.rooms || []
        const totalAdults = rooms.reduce(
          (sum: number, room: any) => sum + (parseInt(room.adult_count) || 0),
          0
        )
        const totalChildren = rooms.reduce(
          (sum: number, room: any) => sum + (parseInt(room.child_count) || 0),
          0
        )

        // Validate room availability only if rooms are assigned
        /*if (rooms.length > 0) {
          const roomIds = rooms.map((r) => r.room_id).filter((id): id is any => Boolean(id))

          if (roomIds.length > 0) {
            let existingReservationsQuery = ReservationRoom.query({ client: trx })
              .whereIn('roomId', roomIds)
              .where('status', 'reserved')

            if (arrivedDate.toISODate() === departDate.toISODate()) {
              // Cas same-day (day use) → check overlap par heures
              const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
              const departureDateTime = DateTime.fromISO(
                `${data.depart_date}T${data.check_out_time}`
              )

              existingReservationsQuery = existingReservationsQuery
                .where('checkInDate', arrivedDate.toISODate())
                .where('checkOutDate', departDate.toISODate())
                .where((query) => {
                  query
                    .whereBetween('checkInTime', [
                      arrivalDateTime.toFormat('HH:mm'),
                      departureDateTime.toFormat('HH:mm'),
                    ])
                    .orWhereBetween('checkOutTime', [
                      arrivalDateTime.toFormat('HH:mm'),
                      departureDateTime.toFormat('HH:mm'),
                    ])
                    .orWhere((overlapQuery) => {
                      overlapQuery
                        .where('checkInTime', '<=', arrivalDateTime.toFormat('HH:mm'))
                        .where('checkOutTime', '>=', departureDateTime.toFormat('HH:mm'))
                    })
                })
            } else {
              // Cas multi-jours → check overlap par dates
              existingReservationsQuery = existingReservationsQuery.where((query) => {
                query.where('checkInDate', '<', departDate.toISODate())
                  .where('checkOutDate', '>', arrivedDate.toISODate())

              })
            }

            const existingReservations = await existingReservationsQuery

            if (existingReservations.length > 0) {
              await trx.rollback()
              return response.badRequest({
                success: false,
                message: `One or more rooms are not available for the selected dates/times`,
                conflicts: existingReservations.map((r) => ({
                  roomId: r.roomId,
                  checkInDate: r.checkInDate,
                  checkOutDate: r.checkOutDate,
                  checkInTime: r.checkInTime,
                  checkOutTime: r.checkOutTime,
                })),
              })
            }
          }
        }*/

        // Create reservation
        const reservation = await Reservation.create(
          {
            hotelId: data.hotel_id,
            userId: auth.user?.id || data.created_by,
            arrivedDate: arrivedDate,
            departDate: departDate,
            checkInDate: data.arrived_time
              ? DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
              : arrivedDate,
            checkOutDate: data.depart_time
              ? DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)
              : departDate,
            status: data.status || 'confirmed',
            guestCount: totalAdults + totalChildren,
            adults: totalAdults,
            children: totalChildren,
            checkInTime: data.check_in_time || data.arrived_time,
            checkOutTime: data.check_out_time || data.depart_time,
            totalAmount: parseFloat(`${data.total_amount ?? 0}`),
            taxAmount: parseFloat(`${data.tax_amount ?? 0}`),
            isGroup: rooms.length > 1,
            arrivingTo: data.arriving_to,
            goingTo: data.going_to,
            meansOfTransportation: data.means_of_transportation,
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
            paymentMethodId: data.payment_mod,
            billTo: data.bill_to,
            marketCodeId: data.market_code_id,
            customType: data.customType,
            paymentType: data.payment_type,
            taxExempt: data.tax_exempt,
            isHold: data.isHold,
            otaReservationCode: data.ota_reservation_code,
            otaName: data.ota_name,
            bookingDate: data.booking_date
              ? DateTime.fromISO(data.booking_date)
              : DateTime.now(),
            holdReleaseDate:
              data.isHold && data.holdReleaseDate ? DateTime.fromISO(data.holdReleaseDate) : null,
            releaseTem: data.isHold ? data.ReleaseTem : null,
            releaseRemindGuestbeforeDays: data.isHold ? data.ReleaseRemindGuestbeforeDays : null,
            releaseRemindGuestbefore: data.isHold ? data.ReleaseRemindGuestbefore : null,
            reservedBy: auth.user?.id,
            createdBy: auth.user?.id,
          },
          { client: trx }
        )

        // Vérifier que la réservation a bien été créée avec un ID
        if (!reservation.id) {
          throw new Error("La réservation n'a pas pu être créée correctement - ID manquant")
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
            await ReservationRoom.create(
              {
                reservationId: reservation.id,
                roomTypeId: room.room_type_id,
                roomId: room.room_id || null,
                guestId: primaryGuest.id,
                checkInDate: DateTime.fromISO(data.arrived_date),
                checkOutDate: DateTime.fromISO(data.depart_date),
                checkInTime: data.check_in_time,
                checkOutTime: data.check_out_time,
                totalAmount: room.room_rate * numberOfNights,
                nights: numberOfNights,
                adults: room.adult_count,
                children: room.child_count,
                roomRate: room.room_rate,
                roomRateId: room.room_rate_id,
                paymentMethodId: data.payment_mod,
                hotelId: data.hotel_id,
                taxIncludes: true,
                meansOfTransportation: room.means_of_transport,
                goingTo: room.going_to,
                arrivingTo: room.arriving_to,
                totalRoomCharges:
                  numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights,
                taxAmount: room.taxes,
                totalTaxesAmount: numberOfNights === 0 ? room.taxes : room.taxes * numberOfNights,
                netAmount:
                  (numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights) +
                  (numberOfNights === 0 ? room.taxes : room.taxes * numberOfNights),
                status: numberOfNights === 0 ? 'day_use' : 'reserved',
                rateTypeId: room.rate_type_id,
                mealPlanId: room.meal_plan_id,
                isOwner: index === 0,
                reservedByUser: auth.user?.id,
                createdBy: data.created_by,
              },
              { client: trx }
            )
          }
        }

        // Logging
        const guestCount = allGuests.length
        const guestDescription =
          guestCount > 1
            ? `${primaryGuest.firstName} ${primaryGuest.lastName} and ${guestCount - 1} other guest(s)`
            : `${primaryGuest.firstName} ${primaryGuest.lastName}`

        const reservationTypeDescription =
          numberOfNights === 0 ? 'day-use' : rooms.length === 0 ? 'no-room' : 'overnight'

        const reservationId = Number(reservation.id)

        if (!isNaN(reservationId)) {
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'CREATE',
            entityType: 'Reservation',
            entityId: reservationId,
            hotelId: reservation.hotelId,
            description: `New ${reservationTypeDescription} reservation #${reservation.reservationNumber} created for ${guestDescription} (${guestCount} guest${guestCount > 1 ? 's' : ''}) from ${arrivedDate.toISODate()} to ${departDate.toISODate()}${rooms.length === 0 ? ' (no room assigned)' : ''}.`,
            meta: {
              reservationNumber: reservation.reservationNumber,
              arrival: arrivedDate.toISODate(),
              departure: departDate.toISODate(),
              numberOfNights,
              totalGuests: guestCount,
              totalRooms: rooms.length,
              totalAmount: reservation.totalAmount,
            },
            ctx,
          })
        }

        const guestId = Number(guest.id)
        if (!isNaN(guestId)) {
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'RESERVATION_CREATED',
            entityType: 'Guest',
            entityId: guestId,
            hotelId: reservation.hotelId,
            description: `Guest ${primaryGuest.firstName} ${primaryGuest.lastName} has a new ${reservationTypeDescription} reservation (#${reservation.reservationNumber}) from ${arrivedDate.toISODate()} to ${departDate.toISODate()} for ${guestCount} guest${guestCount > 1 ? 's' : ''}${rooms.length ? ` in ${rooms.length} room${rooms.length > 1 ? 's' : ''}` : ''}.`,
            meta: {
              reservationId: reservation.id,
              reservationNumber: reservation.reservationNumber,
              arrival: arrivedDate.toISODate(),
              departure: departDate.toISODate(),
              hasRooms: rooms.length > 0,
              numberOfNights,
              totalAmount: reservation.totalAmount,
            },
            ctx,
          })
        } else {
          console.warn(
            "ID invité invalide. Impossible de créer l'entrée de journal d'activité pour l'invité."
          )
        }

        await trx.commit()

        setImmediate(async () => {
          try {

            const NotificationService = (await import('#services/notification_service')).default

            // Déterminer le type de réservation pour les notifications
            let notificationTemplateCode = 'RESERVATION_CREATED'
            const isDirectWebsite = !!data.ota_name || !!data.ota_reservation_code
            const isManualByStaff = auth.user?.id && !isDirectWebsite

            //  Notification selon le type de réservation
            if (isDirectWebsite) {
              notificationTemplateCode = 'RESERVATION_DIRECT_WEB_CREATED'
            } else if (isManualByStaff) {
              notificationTemplateCode = 'RESERVATION_CREATED'
            }

            const variables = await NotificationService.buildVariables(notificationTemplateCode, {
              hotelId: reservation.hotelId,
              guestId: primaryGuest.id,
              reservationId: reservation.id,
              extra: {
                ReservationNumber: reservation.reservationNumber || '',
                ConfirmationNumber: confirmationNumber,
                GuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
                ArrivalDate: arrivedDate.toFormat('yyyy-MM-dd'),
                DepartureDate: departDate.toFormat('yyyy-MM-dd'),
                NumberOfNights: numberOfNights,
                TotalAmount: reservation.totalAmount || 0,
                RoomCount: rooms.length,
                GuestCount: guestCount,
                OtaName: data.ota_name || '',
                OtaCode: data.ota_reservation_code || '',
                BookingSource: data.booking_source || '',
                Status: reservation.status,
              },
            })

            await NotificationService.sendWithTemplate({
              templateCode: notificationTemplateCode,
              recipientType: 'STAFF',
              recipientId: auth.user?.id || data.created_by,
              variables,
              relatedEntityType: 'Reservation',
              relatedEntityId: reservation.id,
              actorId: auth.user?.id,
              hotelId: reservation.hotelId,
            })

            //  Notification au client (si email disponible)
            if (primaryGuest.email) {
              const guestVariables = await NotificationService.buildVariables('RESERVATION_CONFIRMATION_GUEST', {
                hotelId: reservation.hotelId,
                guestId: primaryGuest.id,
                reservationId: reservation.id,
                extra: {
                  ReservationNumber: reservation.reservationNumber || '',
                  ConfirmationNumber: confirmationNumber,
                  GuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
                  ArrivalDate: arrivedDate.toFormat('yyyy-MM-dd'),
                  DepartureDate: departDate.toFormat('yyyy-MM-dd'),
                  NumberOfNights: numberOfNights,
                  TotalAmount: reservation.totalAmount || 0,
                },
              })

              await NotificationService.sendWithTemplate({
                templateCode: 'RESERVATION_CONFIRMATION_GUEST',
                recipientType: 'GUEST',
                recipientId: primaryGuest.id,
                variables: guestVariables,
                relatedEntityType: 'Reservation',
                relatedEntityId: reservation.id,
                actorId: auth.user?.id,
                hotelId: reservation.hotelId,
              })
            }

            //  Notification si statut "en attente"
            if (reservation.status === 'pending') {
              const pendingVariables = await NotificationService.buildVariables('RESERVATION_PENDING', {
                hotelId: reservation.hotelId,
                reservationId: reservation.id,
                extra: {
                  ReservationNumber: reservation.reservationNumber || '',
                  GuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
                },
              })

              await NotificationService.sendWithTemplate({
                templateCode: 'RESERVATION_PENDING',
                recipientType: 'STAFF',
                recipientId: auth.user?.id || data.created_by,
                variables: pendingVariables,
                relatedEntityType: 'Reservation',
                relatedEntityId: reservation.id,
                actorId: auth.user?.id,
                hotelId: reservation.hotelId,
              })
            }


            console.log('Notification envoyée')
          } catch (notifError) {
            console.warn('Erreur notifications réservation:', (notifError as any)?.message)
          }
        })

        // Schedule availability notification in background after commit
        setImmediate(() => {
          try {
            const now = DateTime.now()
            const nowDay = now.startOf('day')
            const arrivalDay = arrivedDate.startOf('day')
            const departDay = departDate.startOf('day')
            const shouldNotify = arrivalDay > nowDay || (nowDay >= arrivalDay && nowDay < departDay)
            if (shouldNotify) {
              ReservationHook.notifyAvailabilityOnCreate(reservation)
            }
          } catch { }
        })

        // Create folios in background after response; do not block request
        if (rooms.length > 0) {
          const actorId = auth.user?.id!
          const reservationIdForJob = reservation.id
          const reservationNumber = reservation.reservationNumber
          const hotelId = reservation.hotelId
          const guestIdForJob = reservation.guestId || primaryGuest.id

          setImmediate(async () => {
            try {
              const folios = await ReservationFolioService.createFoliosOnConfirmation(
                reservationIdForJob,
                actorId
              )

              await LoggerService.log({
                actorId,
                action: 'CREATE_FOLIOS',
                entityType: 'Reservation',
                entityId: reservationIdForJob,
                hotelId,
                description: `${folios.length} folio${folios.length > 1 ? 's' : ''} generated with room charges for reservation #${reservationNumber}.`,
                meta: {
                  folioIds: folios.map((f) => f.id),
                  folioCount: folios.length,
                  reservationNumber,
                },
                ctx,
              })

              if (guestIdForJob) {
                await LoggerService.log({
                  actorId,
                  action: 'CREATE_FOLIOS',
                  entityType: 'Guest',
                  entityId: guestIdForJob,
                  hotelId,
                  description: `${folios.length} folio${folios.length > 1 ? 's were' : ' was'} created for reservation #${reservationNumber}.`,
                  meta: {
                    reservationId: reservationIdForJob,
                    folioIds: folios.map((f) => f.id),
                    totalFolios: folios.length,
                  },
                  ctx,
                })
              }
              await GuestSummaryService.recomputeFromReservation(reservation.id)
            } catch (e) {
              try {
                logger.error(
                  'Background folio creation failed: ' + (e as Error).message
                )
              } catch { }
            }
          })
        }

        const responseData: any = {
          success: true,
          reservationId: reservation.id,
          confirmationNumber,
          status: reservation.status,
          reservationType: reservationTypeDescription,
          isDayUse: numberOfNights === 0,
          hasRooms: rooms.length > 0,
          primaryGuest: {
            id: primaryGuest.id,
            name: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
            email: primaryGuest.email,
          },
          totalGuests: allGuests.length,
          guests: allGuests.map((g) => ({
            id: g.id,
            name: `${g.firstName} ${g.lastName}`,
            email: g.email,
          })),
          message: `${reservationTypeDescription} reservation created successfully with ${allGuests.length} guest(s)${rooms.length === 0 ? ' (no room assigned)' : ''}`,
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
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la sauvegarde',
      })
    }
  }

  /**
   * Create reservation with past-date handling.
   * - If check-in date is already passed, auto check-in after creation.
   * - If check-out date is already passed, auto check-out after creation.
   * - Channel notifications are sent only if current date falls within the stay interval.
   *   Past-date actions do not trigger channel updates.
   */
  public async insertTransaction(ctx: HttpContext) {
    const { request, auth, response } = ctx

    try {
      const data = request.body() as ReservationData

      if (!data) {
        return response.badRequest({ success: false, message: 'No data received' })
      }

      if (!data.hotel_id || !data.arrived_date || !data.depart_date) {
        return response.badRequest({
          success: false,
          message: 'Missing required fields: hotel_id, arrived_date, depart_date',
        })
      }

      const arrivedDate = DateTime.fromISO(data.arrived_date)
      const departDate = DateTime.fromISO(data.depart_date)

      if (!arrivedDate.isValid || !departDate.isValid) {
        return response.badRequest({ success: false, message: 'Invalid date format' })
      }

      if (arrivedDate.toISODate() === departDate.toISODate()) {
        if (!data.check_in_time || !data.check_out_time) {
          return response.badRequest({
            success: false,
            message: 'For same-day reservations, both arrival and departure times are required',
          })
        }

        const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
        const departureDateTime = DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)
        if (!arrivalDateTime.isValid || !departureDateTime.isValid || departureDateTime <= arrivalDateTime) {
          return response.badRequest({ success: false, message: 'Invalid arrival/departure times' })
        }
      } else if (departDate <= arrivedDate) {
        return response.badRequest({ success: false, message: 'Departure date must be after arrival date' })
      }

      const trx = await db.transaction()
      try {
        // Nights calc
        const numberOfNights = arrivedDate.toISODate() === departDate.toISODate()
          ? 0
          : Math.ceil(departDate.diff(arrivedDate, 'days').days)

        const validationErrors = ReservationService.validateReservationData(data, true)
        if (validationErrors.length > 0) {
          await trx.rollback()
          return response.badRequest({ success: false, message: validationErrors.join(', ') })
        }

        const guest = await ReservationService.createOrFindGuest(data, trx)
        const confirmationNumber = generateConfirmationNumber()
        const reservationNumber = generateReservationNumber()

        const rooms = data.rooms || []
        const totalAdults = rooms.reduce((sum: number, room: any) => sum + (parseInt(room.adult_count) || 0), 0)
        const totalChildren = rooms.reduce((sum: number, room: any) => sum + (parseInt(room.child_count) || 0), 0)

        // Availability check only when rooms provided (same logic as saveReservation)
        if (rooms.length > 0) {
          const roomIds = rooms
            .map((r) => r.room_id)
            .filter((id): id is number => typeof id === 'number')
          if (roomIds.length > 0) {
            let existingReservationsQuery = ReservationRoom.query({ client: trx })
              .whereIn('roomId', roomIds)
              .where('status', 'reserved')
              .select('room_id', 'check_in_date', 'check_out_date', 'check_in_time', 'check_out_time')

            if (arrivedDate.toISODate() === departDate.toISODate()) {
              const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
              const departureDateTime = DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)
              existingReservationsQuery = existingReservationsQuery
                .where('checkInDate', arrivedDate.toISODate())
                .where('checkOutDate', departDate.toISODate())
                .where((query) => {
                  query
                    .whereBetween('checkInTime', [arrivalDateTime.toFormat('HH:mm'), departureDateTime.toFormat('HH:mm')])
                    .orWhereBetween('checkOutTime', [arrivalDateTime.toFormat('HH:mm'), departureDateTime.toFormat('HH:mm')])
                    .orWhere((overlapQuery) => {
                      overlapQuery
                        .where('checkInTime', '<=', arrivalDateTime.toFormat('HH:mm'))
                        .where('checkOutTime', '>=', departureDateTime.toFormat('HH:mm'))
                    })
                })
            } else {
              existingReservationsQuery = existingReservationsQuery.where((query) => {
                query.where('checkInDate', '<', departDate.toISODate()).where('checkOutDate', '>', arrivedDate.toISODate())
              })
            }

            const existingReservations = await existingReservationsQuery
            if (existingReservations.length > 0) {
              await trx.rollback()
              return response.badRequest({
                success: false,
                message: 'One or more rooms are not available for the selected dates/times',
                conflicts: existingReservations.map((r) => ({
                  roomId: r.roomId,
                  checkInDate: r.checkInDate,
                  checkOutDate: r.checkOutDate,
                  checkInTime: r.checkInTime,
                  checkOutTime: r.checkOutTime,
                })),
              })
            }
          }
        }

        // Create reservation
        const reservation = await Reservation.create({
          hotelId: data.hotel_id,
          userId: auth.user?.id || data.created_by,
          arrivedDate: arrivedDate,
          departDate: departDate,
          checkInDate: data.arrived_time ? DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`) : arrivedDate,
          checkOutDate: data.depart_time ? DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`) : departDate,
          status: data.status || 'confirmed',
          guestCount: totalAdults + totalChildren,
          adults: totalAdults,
          children: totalChildren,
          checkInTime: data.check_in_time || data.arrived_time,
          checkOutTime: data.check_out_time || data.depart_time,
          totalAmount: parseFloat(`${data.total_amount ?? 0}`),
          taxAmount: parseFloat(`${data.tax_amount ?? 0}`),
          isGroup: rooms.length > 1,
          arrivingTo: data.arriving_to,
          goingTo: data.going_to,
          meansOfTransportation: data.means_of_transportation,
          finalAmount: parseFloat(`${data.final_amount ?? 0}`),
          confirmationNumber,
          reservationNumber,
          numberOfNights,
          paidAmount: parseFloat(`${data.paid_amount ?? 0}`),
          remainingAmount: parseFloat(`${data.remaining_amount ?? 0}`),
          reservationTypeId: data.reservation_type_id,
          bookingSourceId: data.booking_source,
          businessSourceId: data.business_source,
          complimentaryRoom: data.complimentary_room,
          paymentStatus: 'pending',
          paymentMethodId: data.payment_mod,
          billTo: data.bill_to,
          marketCodeId: data.market_code_id,
          customType: data.customType,
          paymentType: data.payment_type,
          taxExempt: data.tax_exempt,
          isHold: data.isHold,
          otaReservationCode: data.ota_reservation_code,
          otaName: data.ota_name,
          bookingDate: data.booking_date ? DateTime.fromISO(data.booking_date) : DateTime.now(),
          holdReleaseDate: data.isHold && data.holdReleaseDate ? DateTime.fromISO(data.holdReleaseDate) : null,
          releaseTem: data.isHold ? data.ReleaseTem : null,
          releaseRemindGuestbeforeDays: data.isHold ? data.ReleaseRemindGuestbeforeDays : null,
          releaseRemindGuestbefore: data.isHold ? data.ReleaseRemindGuestbefore : null,
          reservedBy: auth.user?.id,
          createdBy: auth.user?.id,
        }, { client: trx })

        if (!reservation.id) throw new Error('Reservation creation failed (missing ID)')

        // Guests
        const { primaryGuest, allGuests } = await ReservationService.processReservationGuests(reservation.id, data, trx)
        await reservation.merge({ guestId: primaryGuest.id }).useTransaction(trx).save()

        // Rooms
        if (rooms.length > 0) {
          const roomRecordsPayload = rooms.map((room, index) => ({
            reservationId: reservation.id,
            roomTypeId: room.room_type_id,
            roomId: room.room_id || null,
            guestId: primaryGuest.id,
            checkInDate: DateTime.fromISO(data.arrived_date),
            checkOutDate: DateTime.fromISO(data.depart_date),
            checkInTime: data.check_in_time,
            checkOutTime: data.check_out_time,
            totalAmount: room.room_rate * numberOfNights,
            nights: numberOfNights,
            adults: room.adult_count,
            children: room.child_count,
            roomRate: room.room_rate,
            roomRateId: room.room_rate_id,
            paymentMethodId: data.payment_mod,
            hotelId: data.hotel_id,
            taxIncludes: true,
            meansOfTransportation: room.means_of_transport,
            goingTo: room.going_to,
            arrivingTo: room.arriving_to,
            totalRoomCharges: numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights,
            taxAmount: room.taxes,
            totalTaxesAmount: numberOfNights === 0 ? room.taxes : room.taxes * numberOfNights,
            netAmount:
              (numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights) +
              (numberOfNights === 0 ? room.taxes : room.taxes * numberOfNights),
            status: numberOfNights === 0 ? 'day_use' : 'reserved',
            rateTypeId: room.rate_type_id,
            mealPlanId: room.meal_plan_id,
            isOwner: index === 0,
            reservedByUser: auth.user?.id,
            createdBy: data.created_by,
          }))

          await ReservationRoom.createMany(roomRecordsPayload, { client: trx })
        }

        await trx.commit()

        // Schedule channel notification in background after commit
        setImmediate(() => {
          try {
            const now = DateTime.now()
            const nowDay = now.startOf('day')
            const arrivalDay = arrivedDate.startOf('day')
            const departDay = departDate.startOf('day')
            const shouldNotify = arrivalDay > nowDay || (nowDay >= arrivalDay && nowDay < departDay)
            if (shouldNotify) {
              ReservationHook.notifyAvailabilityOnCreate(reservation)
            }
          } catch { }
        })

        // Folios only if rooms exist — run in background (do not await)
        if (rooms.length > 0) {
          const actorId = auth.user?.id!
          const reservationIdForJob = reservation.id
          setImmediate(async () => {
            try {
              await ReservationFolioService.createFoliosOnConfirmation(
                reservationIdForJob,
                actorId
              )
            } catch (e) {
              try { logger.error('Background folio creation failed: ' + (e as Error).message) } catch { }
            }
          })
        }

        // Auto check-in / check-out for past dates (no channel notifications for these steps)
        const roomRecords = await ReservationRoom.query().where('reservationId', reservation.id).preload('room')

        // Auto check-in if scheduled check-in time is passed.
        // Use reservation.checkInDate or arrivedDate as the effective check-in time
        const now = DateTime.now()
        const scheduledCheckIn = reservation.checkInDate ?? reservation.arrivedDate
        const shouldAutoCheckIn = scheduledCheckIn && scheduledCheckIn < now
        if (shouldAutoCheckIn && roomRecords.length > 0) {
          for (const rr of roomRecords) {
            if (!rr.roomId) continue
            rr.status = 'checked_in'
            rr.checkInDate = scheduledCheckIn!
            rr.actualCheckIn = scheduledCheckIn!
            rr.checkedInBy = auth.user?.id!
            await rr.save()
            if (rr.room) {
              rr.room.status = 'occupied'
              await rr.room.save()
            }
          }
          reservation.status = ReservationStatus.CHECKED_IN
          reservation.checkInDate = scheduledCheckIn!
          reservation.checkedInBy = auth.user?.id!
          await reservation.save()
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'CHECK_IN',
            entityType: 'Reservation',
            entityId: reservation.id,
            hotelId: reservation.hotelId,
            description: `Auto check-in after creation using scheduled check-in time for reservation #${reservation.reservationNumber}.`,
            ctx,
          })
        }

        // Auto check-out if check-out time is passed
        const shouldAutoCheckOut = reservation.checkOutDate && reservation.checkOutDate <= now
        if (shouldAutoCheckOut && roomRecords.length > 0) {
          for (const rr of roomRecords) {
            rr.status = 'checked_out'
            // Use the scheduled depart date/time as the checkout timestamp
            rr.checkOutDate =( reservation.checkOutDate ?? reservation.departDate )!
            rr.checkedOutBy = auth.user?.id!
            rr.lastModifiedBy = auth.user?.id!
            await rr.save()
            if (rr.room) {
              rr.room.status = 'available'
              rr.room.housekeepingStatus = 'dirty'
              await rr.room.save()
            }
          }
          reservation.status = ReservationStatus.CHECKED_OUT
          // Keep reservation checkout at the scheduled depart date/time
          reservation.checkOutDate = (reservation.checkOutDate ?? reservation.departDate)!
          reservation.checkedOutBy = auth.user?.id!
          await reservation.save()
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'CHECK_OUT',
            entityType: 'Reservation',
            entityId: reservation.id,
            hotelId: reservation.hotelId,
            description: `Auto check-out processed using scheduled depart date/time for reservation #${reservation.reservationNumber}.`,
            ctx,
          })
        }

        await GuestSummaryService.recomputeFromReservation(reservation.id)

        const responseData: any = {
          success: true,
          reservationId: reservation.id,
          confirmationNumber,
          status: reservation.status,
          isDayUse: numberOfNights === 0,
          hasRooms: rooms.length > 0,
          primaryGuest: {
            id: guest.id,
            name: `${guest.firstName} ${guest.lastName}`,
            email: guest.email,
          },
          totalGuests: rooms.length > 0 ? rooms.reduce((sum: number, r: any) => sum + (r.adult_count || 0) + (r.child_count || 0), 0) : 1,
          message: 'Reservation created successfully (insert transaction) with past-date handling',
        }

        return response.created(responseData)
      } catch (error) {
        await trx.rollback()
        console.error('Transaction error (insertTransaction):', error)
        throw error
      }
    } catch (error) {
      return response.internalServerError({ success: false, error: error instanceof Error ? error.message : 'Unknown error during insertTransaction' })
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

      if (data.channex_booking_id !== undefined) {
        data.channexBookingId = data.channex_booking_id
      }

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
          /* const folios = await ReservationFolioService.createFoliosOnConfirmation(
             reservationId,
             auth.user!.id
           )* */

          // Log the folio creation
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CONFIRM_RESERVATION',
            entityType: 'Reservation',
            entityId: reservationId,
            hotelId: reservation.hotelId,
            description: `Reservation #${reservationId} confirmed. `,
            ctx,
          })
          //for guest
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CONFIRM_RESERVATION',
            entityType: 'Guest',
            entityId: reservation.guestId,
            hotelId: reservation.hotelId,
            description: `Reservation #${reservationId} confirmed.`,
            ctx,
          })

          // Return success response with folio information
          await GuestSummaryService.recomputeFromReservation(reservationId)
          return response.ok({
            status: 200,
            message: 'Reservation confirmed successfully',
            reservation: reservation,
          })
        } catch (folioError) {
          console.error('Error creating folios on confirmation:', folioError)
          // Return the update response even if folio creation fails
          await GuestSummaryService.recomputeFromReservation(reservationId)
          return response.ok({
            message: 'Reservation confirmed but folio creation failed',
            reservation: updateResponse,
            error: folioError.message,
          })
        }
      }
      //notification
      setImmediate(async () => {
        try {
          const NotificationService = (await import('#services/notification_service')).default
          const recipientId = auth.user!.id
          const variables = await NotificationService.buildVariables('BOOKING_UPDATE', {
            hotelId: reservation.hotelId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            extra: {
              ReservationNumber: reservation.reservationNumber || '',
              Status: reservation.status,
              UpdatedBy: auth.user?.fullName || '',
            },
          })
          await NotificationService.sendWithTemplate({
            templateCode: 'BOOKING_UPDATE',
            recipientType: 'STAFF',
            recipientId,
            variables,
            relatedEntityType: 'Reservation',
            relatedEntityId: reservation.id,
            actorId: auth.user?.id,
            hotelId: reservation.hotelId,
          })
        } catch (err) {
          console.warn('Notification WORK_ORDER_CREATED failed:', (err as any)?.message)
        }
      })
      await GuestSummaryService.recomputeFromReservation(reservationId)

      return response.ok({
        status: 200,
        message: 'Reservation confirmed successfully',
        reservation: reservation,
      })
    } catch (error) {
      console.error('Error updating reservation:', error)
      return response.internalServerError({
        message: 'Error updating reservation',
        error: error.message,
      })
    }
  }

  // Reservation Action Methods
  public async addPayment(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const trx = await db.transaction()
    try {
      const reservationId = params.reservationId
      const {
        amount,
        paymentMethodId,
        reference,
        description,
        currencyCode = 'USD',
      } = request.all()

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
      let folio = reservation.folios.find((f) => f.status === 'open')
      if (!folio) {
        // Create a new folio if none exists
        folio = await Folio.create(
          {
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
            lastModifiedBy: auth.user?.id || 1,
          },
          { client: trx }
        )
      }

      // Generate transaction number
       const lastTx = await FolioTransaction.query()
              .where('hotelId', folio.hotelId)
              .orderBy('transactionNumber', 'desc')
              .first()
        const transactionNumber = Number((lastTx?.transactionNumber || 0)) + 1



      // Create payment transaction
      const transaction = await FolioTransaction.create(
        {
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
          // Align transaction timestamps with the reservation's depart/checkout date
          transactionDate: reservation.checkOutDate ?? reservation.departDate ?? DateTime.now(),
          transactionTime: (reservation.checkOutDate ?? reservation.departDate ?? DateTime.now()).toFormat('HH:mm:ss'),
          postingDate: reservation.checkOutDate ?? reservation.departDate ?? DateTime.now(),
          serviceDate: reservation.checkOutDate ?? reservation.departDate ?? DateTime.now(),
          reference: reference || '',
          paymentMethodId: paymentMethodId,
          paymentReference: reference || '',
          guestId: reservation.guestId,
          reservationId: reservation.id,
          currencyCode: currencyCode,
          exchangeRate: 1,
          baseCurrencyAmount: -Math.abs(amount),
          originalAmount: -Math.abs(amount),
          originalCurrency: currencyCode,
        },
        { client: trx }
      )

      // Update folio totals
      await folio
        .merge({
          totalPayments: (folio.totalPayments || 0) + Math.abs(amount),
          balance: (folio.balance || 0) - Math.abs(amount),
          lastModifiedBy: auth.user?.id || 1,
        })
        .useTransaction(trx)
        .save()

      // Update reservation payment status if needed
      const updatedFolio = await Folio.query({ client: trx })
        .where('id', folio.id)
        .preload('transactions')
        .first()

      if (updatedFolio) {
        const balance = ReservationsController.calculateBalanceSummary([updatedFolio])
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
        ctx,
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
          transactionDate: transaction.transactionDate,
        },
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error adding payment:', error)
      return response.badRequest({
        message: 'Failed to add payment',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  public async amendStay(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const trx = await db.transaction()
    try {
      logger.info('Audit Data:')
      const reservationId = params.reservationId
      const {
        selectedRooms,
        newArrivalDate,
        newDepartureDate,
        newRoomTypeId,
        newNumAdults,
        newNumChildren,
        newSpecialNotes,
        reason,
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
          message: `Cannot amend reservation with status: ${reservation.reservationStatus}`,
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
          netAmount: rr.netAmount,
        })),
      }
      logger.info('Audit Data:1')
      // 📌 Vérification des dates
      let newArrivalDateTime
      let newDepartureDateTime

      if (newArrivalDate || newDepartureDate) {
        newArrivalDateTime = newArrivalDate
          ? DateTime.fromISO(newArrivalDate)
          : reservation.arrivedDate
        newDepartureDateTime = newDepartureDate
          ? DateTime.fromISO(newDepartureDate)
          : reservation.departDate

        if (
          newArrivalDateTime &&
          newDepartureDateTime &&
          newArrivalDateTime >= newDepartureDateTime
        ) {
          await trx.rollback()
          return response.badRequest({ message: 'Arrival date must be before departure date' })
        }
      }
      logger.info('Audit Data:2')
      // 📌 Vérification du type de chambre
      if (newRoomTypeId) {
        const roomType = await db
          .from('room_types')
          .where('id', newRoomTypeId)
          .where('hotel_id', reservation.hotelId)
          .first()

        if (!roomType) {
          await trx.rollback()
          return response.badRequest({ message: 'Invalid room type selected' })
        }
      }
      logger.info('Audit Data:3')
      // =============================
      // 🎯 AMENDEMENT DES CHAMBRES UNIQUEMENT
      // =============================

      // 🔹 Cas 1 : Amendement global (toutes les chambres)
      if (!selectedRooms || selectedRooms.length === 0) {
        // 🔄 Mise à jour de toutes les chambres liées
        if (reservation.reservationRooms.length > 0) {
          for (const reservationRoom of reservation.reservationRooms) {
            const roomUpdateData: any = {
              lastModifiedBy: auth.user?.id!,
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
              const checkInDate = newArrivalDate
                ? DateTime.fromISO(newArrivalDate)
                : reservationRoom.checkInDate
              const checkOutDate = newDepartureDate
                ? DateTime.fromISO(newDepartureDate)
                : reservationRoom.checkOutDate

              const numberOfNights =
                checkInDate.toISODate() === checkOutDate.toISODate()
                  ? 0 // Day use
                  : Math.ceil(checkOutDate.diff(checkInDate, 'days').days)

              roomUpdateData.nights = numberOfNights

              // Recalculer les montants basés sur le nouveau nombre de nuits
              const roomRate = reservationRoom.roomRate || 0
              const taxPerNight = reservationRoom.taxAmount
                ? reservationRoom.taxAmount / (reservationRoom.nights || 1)
                : 0

              if (numberOfNights === 0) {
                // Day use - pas de multiplication par nuits
                roomUpdateData.totalRoomCharges = roomRate
                roomUpdateData.totalTaxesAmount = taxPerNight
              } else {
                // Séjour normal - multiplier par le nombre de nuits
                roomUpdateData.totalRoomCharges = roomRate * numberOfNights
                roomUpdateData.totalTaxesAmount = taxPerNight * numberOfNights
              }

              roomUpdateData.netAmount =
                roomUpdateData.totalRoomCharges + roomUpdateData.totalTaxesAmount
            }

            await reservationRoom.merge(roomUpdateData).useTransaction(trx).save()
          }
        }
      }

      // 🔹 Cas 2 : Amendement chambre par chambre
      else {
        // Cibler les chambres sélectionnées
        const targetRooms = reservation.reservationRooms.filter((rr) =>
          selectedRooms.includes(rr.roomId)
        )
        logger.info('Audit Data:4')
        if (targetRooms.length === 0) {
          await trx.rollback()
          return response.badRequest({ message: 'No valid rooms selected for amendment' })
        }

        for (const reservationRoom of targetRooms) {
          const roomUpdateData: any = {
            lastModifiedBy: auth.user?.id!,
            id: reservationRoom.id
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
            const numberOfNights =
              checkInDate.toISODate() === checkOutDate.toISODate()
                ? 0 // Day use
                : Math.ceil(checkOutDate.diff(checkInDate, 'days').days)

            roomUpdateData.nights = numberOfNights

            // Recalculer les montants basés sur le nouveau nombre de nuits
            const roomRate = reservationRoom.roomRate || 0

            const taxPerNight = reservationRoom.taxAmount
              ? reservationRoom.taxAmount / (reservationRoom.nights || 1)
              : 0

            if (numberOfNights === 0) {
              // Day use - pas de multiplication par nuits
              roomUpdateData.totalRoomCharges = roomRate
              roomUpdateData.totalTaxesAmount = taxPerNight
            } else {
              // Séjour normal - multiplier par le nombre de nuits
              roomUpdateData.totalRoomCharges = roomRate * numberOfNights
              roomUpdateData.totalTaxesAmount = taxPerNight * numberOfNights
            }

            roomUpdateData.netAmount =
              roomUpdateData.totalRoomCharges + roomUpdateData.totalTaxesAmount
          }
          await reservationRoom.merge(roomUpdateData).useTransaction(trx).save()
        }
      }

      // 📌 Mise à jour uniquement du lastModifiedBy sur la réservation principale
      await reservation
        .merge({
          lastModifiedBy: auth.user?.id!,
          arrivedDate: newArrivalDateTime,
          departDate: newDepartureDateTime,
          nights: reservation.reservationRooms[0].nights,
        })
        .save()
      console.log('audit reservation')
      const auditData = {
        reservationId: reservation.id,
        action: 'amend_stay',
        performedBy: auth.user?.id,
        originalData: originalData,
        newData: {
          selectedRooms,
          newArrivalDate,
          newDepartureDate,
          newRoomTypeId,
          newNumAdults,
          newNumChildren,
          newSpecialNotes,
        },
        reason: reason || 'Stay amendment requested',
        timestamp: DateTime.now(),
      }

      //  Mise à jour des folios si la réservation a des folios existants
      if (reservation.folios && reservation.folios.length > 0) {
        await this.updateFoliosAfterAmendment(reservation, trx, auth.user?.id || 1)
      }



      await GuestSummaryService.recomputeFromReservation(reservationId)
      // log
      const amendedRooms =
        selectedRooms && selectedRooms.length > 0
          ? selectedRooms.join(', ')
          : reservation.reservationRooms.map((rr) => rr.room?.roomNumber || rr.roomId).join(', ')

      const logDescription = `Reservation #${reservation.reservationNumber} amended by ${auth.user?.fullName || 'User ' + auth.user?.id
        }.
        ${selectedRooms && selectedRooms.length > 0 ? `Rooms affected: ${amendedRooms}.` : 'All rooms affected.'}
        ${newArrivalDate ? `New arrival: ${DateTime.fromISO(newArrivalDate).toFormat('yyyy-MM-dd')}.` : ''}
        ${newDepartureDate ? `New departure: ${DateTime.fromISO(newDepartureDate).toFormat('yyyy-MM-dd')}.` : ''}
        ${newRoomTypeId ? `Changed to room type ID: ${newRoomTypeId}.` : ''}
        ${newNumAdults ? `Adults: ${newNumAdults}.` : ''} ${newNumChildren ? `Children: ${newNumChildren}.` : ''}
        ${newSpecialNotes ? `Notes: ${newSpecialNotes}.` : ''}
        Reason: ${reason || 'Stay amendment requested.'}`

      //  Log pour la réservation
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'AMEND_STAY',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: logDescription,
        meta: {
          originalData,
          newData: {
            selectedRooms,
            newArrivalDate,
            newDepartureDate,
            newRoomTypeId,
            newNumAdults,
            newNumChildren,
            newSpecialNotes,
            reason,
          },
          timestamp: DateTime.now().toISO(),
          isPartialAmendment: selectedRooms && selectedRooms.length > 0,
        },
        ctx,
      })

      // pour le Guest si présent
      if (reservation.guestId) {
        await LoggerService.log({
          actorId: auth.user?.id!,
          action: 'AMEND_STAY',
          entityType: 'Guest',
          entityId: reservation.guestId,
          hotelId: reservation.hotelId,
          description: `Guest stay amended under Reservation #${reservation.reservationNumber}.`,
          meta: {
            reservationId: reservation.id,
            reservationNumber: reservation.reservationNumber,
            affectedRooms: amendedRooms,
            newDates: {
              arrival: newArrivalDate || reservation.arrivedDate?.toISODate(),
              departure: newDepartureDate || reservation.departDate?.toISODate(),
            },
            reason,
            performedBy: auth.user?.id,
          },
          ctx,
        })
      }

      try {
        const NotificationService = (await import('#services/notification_service')).default

        // Notifier le guest si la réservation a un guest associé
        if (reservation.guestId) {
          const variables = await NotificationService.buildVariables('STAY_AMENDED', {
            hotelId: reservation.hotelId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            extra: {
              ReservationNumber: reservation.reservationNumber || '',
              OldArrivalDate: originalData.arrivalDate?.toFormat('yyyy-MM-dd') || '',
              ArrivalDate: newArrivalDate ? DateTime.fromISO(newArrivalDate).toFormat('yyyy-MM-dd') : '',
              OldDepartureDate: originalData.departureDate?.toFormat('yyyy-MM-dd') || '',
              DepartureDate: newDepartureDate ? DateTime.fromISO(newDepartureDate).toFormat('yyyy-MM-dd') : '',
              Reason: reason || 'Stay amendment requested',
              AmendedBy: auth.user?.fullName || `User ${auth.user?.id}`,
            },
          })

          await NotificationService.sendWithTemplate({
            templateCode: 'STAY_AMENDED',
            recipientType: 'GUEST',
            recipientId: reservation.guestId,
            variables,
            relatedEntityType: 'Reservation',
            relatedEntityId: reservation.id,
            actorId: auth.user?.id,
            hotelId: reservation.hotelId,
          })
        }

        // Notifier le staff
        const variables = await NotificationService.buildVariables('STAY_AMENDED_STAFF', {
          hotelId: reservation.hotelId,
          reservationId: reservation.id,
          extra: {
            ReservationNumber: reservation.reservationNumber || '',
            ArrivalDate: newArrivalDate ? DateTime.fromISO(newArrivalDate).toFormat('yyyy-MM-dd') : '',
            DepartureDate: newDepartureDate ? DateTime.fromISO(newDepartureDate).toFormat('yyyy-MM-dd') : '',
            GuestName: reservation.guestId ? 'Guest' : 'N/A',
            AffectedRooms: amendedRooms,
            Changes: logDescription,
            AmendedBy: auth.user?.fullName || `User ${auth.user?.id}`,
          },
        })

        await NotificationService.sendWithTemplate({
          templateCode: 'STAY_AMENDED_STAFF',
          recipientType: 'STAFF',
          recipientId: auth.user?.id!,
          variables,
          relatedEntityType: 'Reservation',
          relatedEntityId: reservation.id,
          actorId: auth.user?.id,
          hotelId: reservation.hotelId,
        })
      } catch (err) {
        console.warn('Notification STAY_AMENDED failed:', (err as any)?.message)
      }

       await trx.commit()
      return response.ok({
        message: 'Stay amended successfully',
        reservationId: reservationId,
        changes: {
          originalData,
          newData: auditData.newData,
        },
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error amending stay:', error)
      return response.badRequest({
        message: 'Failed to amend stay',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  public async roomMove(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const trx = await db.transaction()
    try {
      const { moves, reason, effectiveDate } = request.all()
      const reservationId = Number(request.input('reservationId') ?? params.reservationId)

      if (!reservationId) {
        await trx.rollback()
        return response.badRequest({ message: 'reservationId is required in request body' })
      }

      if (!moves || !Array.isArray(moves) || moves.length === 0) {
        await trx.rollback()
        return response.badRequest({ message: 'moves must be a non-empty array' })
      }

      // Consider only the first element for now
      const firstMove = moves[0] || {}
      const { reservationRoomId, newRoomId } = firstMove

      if (!newRoomId) {
        await trx.rollback()
        return response.badRequest({ message: 'New room ID is required' })
      }
      if (!reservationRoomId) {
        await trx.rollback()
        return response.badRequest({ message: 'reservationRoomId is required in moves[0]' })
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
      if (!allowedStatuses.includes(reservation.status.toLowerCase())) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot move room for reservation with status: ${reservation.status}`,
        })
      }

      // Find the specific room assignment to move
      const currentReservationRoom = reservation.reservationRooms.find(
        (rr) => rr.id === reservationRoomId
      )

      if (!currentReservationRoom) {
        await trx.rollback()
        return response.badRequest({
          message: 'Reservation room not found for this reservation',
        })
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
      // Move time: use the later of now and the planned check-in date.
      // This ensures moves cannot become effective before the check-in day.
      const now = DateTime.now()
      const plannedCheckIn =
        currentReservationRoom.checkInDate ||
        reservation.scheduledArrivalDate ||
        reservation.arrivedDate ||
        null
      const moveDate = plannedCheckIn && plannedCheckIn.toMillis() > now.toMillis() ? plannedCheckIn : now
      console.log('effectiveDate', effectiveDate);
      const checkOutDate = reservation.departDate

      const conflictingReservation = await ReservationRoom.query({ client: trx })
        .where('room_id', newRoomId)
        .where('check_in_date', '<', checkOutDate?.toISODate()!)
        .where('check_out_date', '>', moveDate?.toISODate()!)
        .whereIn('status', ['reserved', 'checked_in', 'day_use'])
        .select('id', 'room_id')
        .first()
      if (conflictingReservation) {
        await trx.rollback()
        return response.badRequest({
          message: 'New room is not available for the requested dates',
        })
      }

      // Store original room information for audit
      const originalRoomInfo = {
        roomId: currentReservationRoom.roomId,
        roomNumber: currentReservationRoom.room.roomNumber,
        roomType: currentReservationRoom.room.roomType?.roomTypeName,
      }
      // If not checked in yet, only change the room assignment without folio/actions
      const isCheckedIn = ['checked-in', 'checked_in'].includes(
        (reservation.status || '').toLowerCase()
      )
      // Treat as pre-check-in if either:
      // - The guest is not yet checked in, OR
      // - Today is the planned check-in day
      const todayIso = DateTime.now().toISODate()
      const plannedCheckInIso = reservation.arrivedDate?.toISODate()
      const isCheckingDayToday = plannedCheckInIso === todayIso
      if (!isCheckedIn || isCheckingDayToday) {
        // Enrich notes for check-in context: include check-in info, move time, and actor
        const plannedArrivalIso = reservation.scheduledArrivalDate?.toISO?.() || reservation.arrivedDate?.toISO?.() || reservation.arrivedDate?.toISODate?.() || 'N/A'
        const checkInInfo = currentReservationRoom.actualCheckInTime?.toISO?.() || currentReservationRoom.checkInTime || plannedArrivalIso
        const moveTimeIso = moveDate.toISO()
        const movedBy = auth.user?.fullName || `User ${auth.user?.id}`

        await currentReservationRoom
          .merge({
            roomId: newRoomId,
            roomTypeId: newRoom.roomTypeId,
            lastModifiedBy: auth.user?.id!,
            notes: `room change: ${originalRoomInfo.roomNumber} → ${newRoom.roomNumber}. Reason: ${reason || 'Room change'} | Check-in: ${checkInInfo} | Move time: ${moveTimeIso} | Moved by: ${movedBy}`,
          })
          .useTransaction(trx)
          .save()

        await trx.commit()

        return response.ok({
          message: 'Room updated successfully (pre-check-in)',
          reservationId,
          moveDetails: {
            fromRoom: originalRoomInfo,
            toRoom: {
              roomId: newRoomId,
              roomNumber: newRoom.roomNumber,
              roomType: newRoom.roomType?.roomTypeName,
            },
            effectiveDate: moveDate.toISODate(),
            reason: reason || 'Room change',
          },
        })
      }
      const currentCheckOutDate = currentReservationRoom.checkOutDate;
      // Update current reservation room status to indicate move
      await currentReservationRoom
        .merge({
          status: ReservationStatus.CHECKED_OUT,
          // Move time: use effective move date as the check-out of the old room
          checkOutDate: moveDate,
          isSplitedOrigin: true,
          lastModifiedBy: auth.user?.id!,
          notes: `Moved to room ${newRoom.roomNumber}. Reason: ${reason || 'Room move requested'} | Move time: ${moveDate.toISO()} | Moved by: ${auth.user?.fullName || 'User ' + auth.user?.id}`,
        })
        .save()

      // Calculate number of nights between moveDate and the existing check-out
      const numberOfNights =
        currentCheckOutDate?.toISODate() === moveDate.toISODate()
          ? 0
          : Math.max(
            0,
            currentCheckOutDate
              .startOf('day')
              .diff(moveDate.startOf('day'), 'days').days
          )

      // Do NOT split reservation: keep same reservation and add a new ReservationRoom
      const targetReservationId = reservation.id

      // Create new reservation room record for the new room, attached to the target reservation (new or same)
      const newReservationRoom = await ReservationRoom.create(
        {
          reservationId: targetReservationId,
          hotelId: reservation.hotelId,
          roomId: newRoomId,
          roomTypeId: newRoom.roomTypeId,
          checkInDate: moveDate,
          checkOutDate: currentCheckOutDate,
          status: ReservationStatus.CHECKED_IN,
          createdBy: auth.user?.id!,
          lastModifiedBy: auth.user?.id!,
          guestId: currentReservationRoom.guestId,
          checkInTime: currentReservationRoom.checkInTime,
          checkOutTime: currentReservationRoom.checkOutTime,
          totalAmount: currentReservationRoom.roomRate * numberOfNights,
          nights: numberOfNights,
          adults: currentReservationRoom.adults,
          children: currentReservationRoom.children,
          roomRate: currentReservationRoom.roomRate,
          roomRateId: currentReservationRoom.roomRateId,
          paymentMethodId: currentReservationRoom.paymentMethodId,
          totalRoomCharges: numberOfNights === 0 ? currentReservationRoom.roomRate : currentReservationRoom.roomRate * numberOfNights,
          taxAmount: currentReservationRoom.taxAmount,
          rateTypeId: currentReservationRoom.rateTypeId,
          reservedByUser: auth.user?.id,
          isplitedDestinatination: true,
          notes: `Moved from room ${currentReservationRoom.room.roomNumber}. Reason: ${reason || 'Room move requested'} | Move time: ${moveDate.toISO()} | Moved by: ${auth.user?.fullName || 'User ' + auth.user?.id}`,
        })

      // Reassign ALL open folios on the reservation to the new reservation/room
      const openFolios = await Folio.query()
        .where('reservationId', reservation.id)
      if (openFolios.length > 0) {
        const transferNote = `Room move (${originalRoomInfo.roomNumber} -> ${newRoom.roomNumber}) on ${moveDate.toISODate()}${reason ? ' - ' + reason : ''}`

        for (const f of openFolios) {
          await db.from('folios')
            .where('id', f.id)
            .update({
              reservation_id: targetReservationId,
              reservation_room_id: newReservationRoom.id,
              last_modified_by: auth.user?.id!,
              updated_at: DateTime.now(),
              notes: f.notes && f.notes.length > 0
                ? `${f.notes} | ${transferNote}`
                : transferNote,
            })
        }
      }

      // Update reservation_id and reservation_room_id on future-dated transactions
      // Criteria: transactions with posting_date >= today and belonging to these folios
      const folioIdsToUpdate = openFolios.map((f) => f.id)
      if (folioIdsToUpdate.length > 0) {
        const todayIso = DateTime.now().toISODate()
        await FolioTransaction.query()
          .whereIn('folio_id', folioIdsToUpdate)
          .where('posting_date', '>=', todayIso)
          .update({
            reservation_id: targetReservationId,
            reservation_room_id: newReservationRoom.id,
            last_modified_by: auth.user?.id!,
            updated_at: DateTime.now(),
          })
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
          roomType: newRoom.roomType?.roomTypeName,
        },
        reason: reason || 'Room move requested',
        effectiveDate: moveDate.toISODate(),
        timestamp: DateTime.now(),
      }


      await trx.commit()

        try {
          const NotificationService = (await import('#services/notification_service')).default
          console.log('send notification ROOM_MOVE')

          // Variables communes
          const vars = await NotificationService.buildVariables('ROOM_MOVE', {
            hotelId: reservation.hotelId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            extra: {
              ReservationNumber: reservation.reservationNumber || '',
              OldRoomNumber: originalRoomInfo.roomNumber,
              NewRoomNumber: newRoom.roomNumber,
              EffectiveDate: moveDate.toISODate() || '',
              Reason: reason || '',
            },
          })

          // Notify staff who performed the action
          await NotificationService.sendWithTemplate({
            templateCode: 'ROOM_MOVE_STAFF',
            recipientType: 'STAFF',
            recipientId: auth.user?.id || 1,
            variables: vars,
            relatedEntityType: 'Reservation',
            relatedEntityId: reservation.id,
            actorId: auth.user?.id,
            hotelId: reservation.hotelId,
          })
          // Notify guest if available (email/SMS template)
          if (reservation.guestId) {
            const guestVars = await NotificationService.buildVariables('ROOM_MOVE_GUEST', {
              hotelId: reservation.hotelId,
              reservationId: reservation.id,
              guestId: reservation.guestId,
              extra: {
                ReservationNumber: reservation.reservationNumber || '',
                OldRoomNumber: originalRoomInfo.roomNumber,
                NewRoomNumber: newRoom.roomNumber,
                EffectiveDate: moveDate.toISODate() || '',
              },
            })

            await NotificationService.sendWithTemplate({
              templateCode: 'ROOM_MOVE_GUEST',
              recipientType: 'GUEST',
              recipientId: reservation.guestId,
              variables: guestVars,
              relatedEntityType: 'Reservation',
              relatedEntityId: reservation.id,
              actorId: auth.user?.id,
              hotelId: reservation.hotelId,
            })
          }
          console.log('notification ROOM_MOVE sent')
        } catch (notifErr) {
          console.warn('Notification ROOM_MOVE failed:', (notifErr as any)?.message)
          console.error('Notification ROOM_MOVE failed:', notifErr)
        }


      // Reload reservation with updated room assignments
      const updatedReservation = await Reservation.query()
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.preload('room', (roomQuery) => {
            roomQuery.preload('roomType')
          })
        })
        .first()

      // No split reservation created; nothing else to load

      //  Create audit log for room move
      const logDescription = `Room move performed by ${auth.user?.fullName || 'User ' + auth.user?.id}.
      Reservation #${reservation.reservationNumber}.
      Moved from Room ${originalRoomInfo.roomNumber} (${originalRoomInfo.roomType})
      → Room ${newRoom.roomNumber} (${newRoom.roomType?.roomTypeName}).
      Effective Date: ${DateTime.fromISO(auditData.effectiveDate!).toFormat('yyyy-MM-dd')}.
      Reason: ${reason || 'Room move requested'}.`

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'ROOM_MOVE',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: logDescription,
        meta: {
          reservationId: reservation.id,
          originalRoom: auditData.originalRoom,
          newRoom: auditData.newRoom,
          reason: auditData.reason,
          effectiveDate: auditData.effectiveDate,
          performedBy: auth.user?.id!,
          timestamp: DateTime.now().toISO(),
        },
        ctx,
      })

      // Guest for full audit trail
      if (reservation.guestId) {
        await LoggerService.log({
          actorId: auth.user?.id!,
          action: 'ROOM_MOVE',
          entityType: 'Guest',
          entityId: reservation.guestId,
          hotelId: reservation.hotelId,
          description: `Guest moved from Room ${originalRoomInfo.roomNumber} (${originalRoomInfo.roomType})
      → ${newRoom.roomNumber} (${newRoom.roomType?.roomTypeName}) under Reservation #${reservation.reservationNumber}.`,
          meta: {
            reservationId: reservation.id,
            guestId: reservation.guestId,
            fromRoom: originalRoomInfo,
            toRoom: {
              roomId: newRoom.id,
              roomNumber: newRoom.roomNumber,
              roomType: newRoom.roomType?.roomTypeName,
            },
            reason,
            effectiveDate: auditData.effectiveDate,
            performedBy: auth.user?.id || 1,
            timestamp: DateTime.now().toISO(),
          },
          ctx,
        })
      }

      return response.ok({
        message: 'Room move completed successfully',
        reservationId: reservationId,
        moveDetails: {
          fromRoom: originalRoomInfo,
          toRoom: {
            roomId: newRoomId,
            roomNumber: newRoom.roomNumber,
            roomType: newRoom.roomType?.roomTypeName,
          },
          effectiveDate: moveDate.toISODate(),
          reason: reason || 'Room move requested',
        },
        reservation: updatedReservation,
      })
    } catch (error) {
      await trx.rollback()
      console.error('Error processing room move:', error)
      return response.badRequest({
        message: 'Failed to process room move',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  public async exchangeRoom(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const trx = await db.transaction()

    try {
      const reservationRooms = request.input('reservationRooms', [])

      if (!Array.isArray(reservationRooms) || reservationRooms.length === 0) {
        await trx.rollback()
        console.log(' No reservation rooms provided')
        return response.badRequest({ message: 'No reservation rooms provided for exchange' })
      }

      console.log('📩 Received reservation rooms for exchange:', reservationRooms)

      const exchangeResults: any[] = []

      for (const roomData of reservationRooms) {
        const {
          reservationRoomId,
          roomId,
          roomTypeId,
          reservationId,
          exchangeType,
          targetReservationId,
          reason,
          effectiveDate,
        } = roomData

        console.log('🔁 Processing room exchange:', roomData)

        if (
          !exchangeType ||
          !['reservation_swap', 'room_upgrade_downgrade'].includes(exchangeType)
        ) {
          console.log(
            '⚠️ Invalid exchange type for reservationRoomId',
            reservationRoomId,
            ':',
            exchangeType
          )
          continue
        }

        // --- Charger la réservation principale ---
        const reservation = await Reservation.query({ client: trx })
          .where('id', reservationId)
          .preload('reservationRooms', (query) =>
            query.preload('room', (roomQuery) => roomQuery.preload('roomType'))
          )
          .first()

        if (!reservation) {
          console.log('❌ Reservation not found:', reservationId)
          continue
        }

        const allowedStatuses = [
          'confirmed',
          'guaranteed',
          'pending',
          'checked-in',
          'checked_in',
          'inquiry',
        ]
        if (!allowedStatuses.includes(reservation.status.toLowerCase())) {
          console.log('⚠️ Reservation status not allowed for exchange:', reservation.status)
          continue
        }

        const exchangeDate = effectiveDate ? DateTime.fromISO(effectiveDate) : DateTime.now()
        const currentReservationRoom = reservation.reservationRooms.find(
          (rr) => rr.id === reservationRoomId
        )

        if (!currentReservationRoom) {
          console.log(' Current reservation room not found:', reservationRoomId)
          continue
        }

        // ---  SWAP ENTRE RÉSERVATIONS ---
        if (exchangeType === 'reservation_swap') {
          if (!targetReservationId) {
            console.log(
              ' Missing targetReservationId for swap, reservationRoomId:',
              reservationRoomId
            )
            continue
          }

          const targetReservation = await Reservation.query({ client: trx })
            .where('id', targetReservationId)
            .where('hotel_id', reservation.hotelId)
            .preload('reservationRooms', (query) =>
              query.preload('room', (roomQuery) => roomQuery.preload('roomType'))
            )
            .first()

          if (!targetReservation) {
            console.log(' Target reservation not found or not in same hotel:', targetReservationId)
            continue
          }

          const targetReservationRoom = targetReservation.reservationRooms.find(
            (rr) => rr.status === 'reserved' || rr.status === 'checked_in'
          )

          if (!targetReservationRoom) {
            console.log(' No active room assignment for target reservation:', targetReservationId)
            continue
          }

          console.log(
            ` Swapping room ${currentReservationRoom.room.roomNumber} (Res ${reservationId}) with ${targetReservationRoom.room.roomNumber} (Res ${targetReservationId})`
          )

          // ✅Sauvegarde des valeurs AVANT modification
          const originalRoomId1 = currentReservationRoom.roomId
          const originalRoomTypeId1 = currentReservationRoom.roomTypeId
          const originalRoomId2 = targetReservationRoom.roomId
          const originalRoomTypeId2 = targetReservationRoom.roomTypeId

          const originalRoom1 = {
            reservationId: reservation.id,
            roomId: originalRoomId1,
            roomNumber: currentReservationRoom.room.roomNumber,
            roomType: currentReservationRoom.room.roomType?.roomTypeName,
          }

          const originalRoom2 = {
            reservationId: targetReservation.id,
            roomId: originalRoomId2,
            roomNumber: targetReservationRoom.room.roomNumber,
            roomType: targetReservationRoom.room.roomType?.roomTypeName,
          }

          //  Swap des deux chambres
          await currentReservationRoom
            .merge({
              roomId: originalRoomId2,
              roomTypeId: originalRoomTypeId2,
              lastModifiedBy: auth.user?.id || 1,
              notes: `Room swapped with reservation ${targetReservationId}. Reason: ${reason || 'Room exchange requested'
                }`,
            })
            .useTransaction(trx)
            .save()

          await targetReservationRoom
            .merge({
              roomId: originalRoomId1,
              roomTypeId: originalRoomTypeId1,
              lastModifiedBy: auth.user?.id || 1,
              notes: `Room swapped with reservation ${reservationId}. Reason: ${reason || 'Room exchange requested'
                }`,
            })
            .useTransaction(trx)
            .save()

          //  Mettre à jour le type principal de chaque réservation
          if (originalRoomTypeId2 !== reservation.roomTypeId) {
            await reservation
              .merge({ roomTypeId: originalRoomTypeId2, lastModifiedBy: auth.user?.id || 1 })
              .useTransaction(trx)
              .save()
          }

          if (originalRoomTypeId1 !== targetReservation.roomTypeId) {
            await targetReservation
              .merge({ roomTypeId: originalRoomTypeId1, lastModifiedBy: auth.user?.id || 1 })
              .useTransaction(trx)
              .save()
          }

          exchangeResults.push({
            type: 'reservation_swap',
            reservation1: {
              id: reservation.id,
              originalRoom: originalRoom1,
              newRoom: originalRoom2,
            },
            reservation2: {
              id: targetReservation.id,
              originalRoom: originalRoom2,
              newRoom: originalRoom1,
            },
          })
        }

        // ---  UPGRADE / DOWNGRADE ---
        else if (exchangeType === 'room_upgrade_downgrade') {
          if (!roomId || roomId === currentReservationRoom.roomId) {
            console.log(' Invalid new room for upgrade/downgrade:', roomId)
            continue
          }

          const newRoom = await Room.query({ client: trx })
            .where('id', roomId)
            .where('hotel_id', reservation.hotelId)
            .preload('roomType')
            .first()

          if (
            !newRoom ||
            newRoom.status !== 'active' ||
            ['dirty', 'maintenance'].includes(newRoom.housekeepingStatus)
          ) {
            console.log(' New room not available or not ready:', roomId)
            continue
          }

          const originalRoomInfo = {
            roomId: currentReservationRoom.roomId,
            roomNumber: currentReservationRoom.room.roomNumber,
            roomType: currentReservationRoom.room.roomType?.roomTypeName,
          }

          await currentReservationRoom
            .merge({
              roomId: newRoom.id,
              roomTypeId: newRoom.roomTypeId,
              lastModifiedBy: auth.user?.id || 1,
              notes: `Room exchanged from ${currentReservationRoom.room.roomNumber} to ${newRoom.roomNumber
                }. Reason: ${reason || 'Room exchange requested'}`,
            })
            .useTransaction(trx)
            .save()

          //  Mettre à jour le type principal
          if (newRoom.roomTypeId !== reservation.roomTypeId) {
            await reservation
              .merge({ roomTypeId: newRoom.roomTypeId, lastModifiedBy: auth.user?.id || 1 })
              .useTransaction(trx)
              .save()
          }

          exchangeResults.push({
            type: 'room_upgrade_downgrade',
            reservation: {
              id: reservation.id,
              originalRoom: originalRoomInfo,
              newRoom: {
                roomId: newRoom.id,
                roomNumber: newRoom.roomNumber,
                roomType: newRoom.roomType?.roomTypeName,
              },
            },
          })
        }
      }

      const auditData = {
        action: 'room_exchange',
        performedBy: auth.user?.id || 1,
        exchangeResults,
        timestamp: DateTime.now(),
      }

      console.log(' Room Exchange Audit:', auditData)

      await trx.commit()

      // Create audit logs for each exchange result
      for (const result of exchangeResults) {
        if (result.type === 'reservation_swap') {
          const { reservation1, reservation2 } = result

          // Log pour la première réservation
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'ROOM_EXCHANGE_SWAP',
            entityType: 'Reservation',
            entityId: reservation1.id,
            hotelId: reservation1.hotelId,
            description: `Room swapped between Reservation #${reservation1.id} and #${reservation2.id}.
      From Room ${reservation1.originalRoom.roomNumber} (${reservation1.originalRoom.roomType})
      → Room ${reservation1.newRoom.roomNumber} (${reservation1.newRoom.roomType}).`,
            meta: {
              type: 'reservation_swap',
              reservationId: reservation1.id,
              targetReservationId: reservation2.id,
              fromRoom: reservation1.originalRoom,
              toRoom: reservation1.newRoom,
              effectiveDate: DateTime.now().toISO(),
              performedBy: auth.user?.id || 1,
            },
            ctx,
          })

          // réservation
          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'ROOM_EXCHANGE_SWAP',
            entityType: 'Reservation',
            entityId: reservation2.id,
            hotelId: reservation2.hotelId,
            description: `Room swapped between Reservation #${reservation2.id} and #${reservation1.id}.
      From Room ${reservation2.originalRoom.roomNumber} (${reservation2.originalRoom.roomType})
      → Room ${reservation2.newRoom.roomNumber} (${reservation2.newRoom.roomType}).`,
            meta: {
              type: 'reservation_swap',
              reservationId: reservation2.id,
              targetReservationId: reservation1.id,
              fromRoom: reservation2.originalRoom,
              toRoom: reservation2.newRoom,
              effectiveDate: DateTime.now().toISO(),
              performedBy: auth.user?.id || 1,
            },
            ctx,
          })
        }

        // Upgrade / Downgrade
        else if (result.type === 'room_upgrade_downgrade') {
          const { reservation, originalRoom, newRoom } = result

          await LoggerService.log({
            actorId: auth.user?.id!,
            action: 'ROOM_EXCHANGE_UPGRADE_DOWNGRADE',
            entityType: 'Reservation',
            entityId: reservation.id,
            hotelId: reservation.hotelId,
            description: `Room exchanged (Upgrade/Downgrade) for Reservation #${reservation.id}.
      From Room ${originalRoom.roomNumber} (${originalRoom.roomType})
      → Room ${newRoom.roomNumber} (${newRoom.roomType}).`,
            meta: {
              type: 'room_upgrade_downgrade',
              reservationId: reservation.id,
              fromRoom: originalRoom,
              toRoom: newRoom,
              reason: result.reason || 'Room exchange requested',
              effectiveDate: DateTime.now().toISO(),
              performedBy: auth.user?.id || 1,
            },
            ctx,
          })
        }
      }



      return response.ok({
        message: 'Room exchanges completed successfully',
        exchangeResults,
      })
    } catch (error) {
      await trx.rollback()
      console.error(' Error processing room exchange:', error)
      return response.badRequest({
        message: 'Failed to process room exchange',
        error: error instanceof Error ? error.message : 'Unknown error',
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
      const activeRoom = reservation.reservationRooms.find((room) => room.status === 'checked_in')
      const movedOutRoom = reservation.reservationRooms.find((room) => room.status === 'moved_out')

      if (!activeRoom || !movedOutRoom) {
        await trx.rollback()
        return response.badRequest({
          message:
            'No active room move found to stop. Room move may have already been completed or cancelled.',
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
          message: 'Room move cannot be stopped after 24 hours. Please contact management.',
        })
      }

      // Store original room information for audit
      const originalRoomId = movedOutRoom.roomId
      const newRoomId = activeRoom.roomId

      // Revert the room move:
      // 1. Set the moved_out room back to active
      await movedOutRoom
        .useTransaction(trx)
        .merge({
          status: 'checked_in',
          lastModifiedBy: auth.user?.id,
          updatedAt: now,
        })
        .save()

      // 2. Remove/cancel the new room assignment
      await activeRoom
        .useTransaction(trx)
        .merge({
          status: 'cancelled',
          lastModifiedBy: auth.user?.id,
          updatedAt: now,
        })
        .save()

      // 3. Update reservation's primary room back to original if it was changed
      if (reservation.roomTypeId !== movedOutRoom.roomTypeId) {
        await reservation
          .useTransaction(trx)
          .merge({
            roomTypeId: movedOutRoom.roomTypeId,
            lastModifiedBy: auth.user?.id,
          })
          .save()
      }

      // Create audit log
      await LoggerService.logActivity(
        {
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
            hoursSinceMove,
          },
          ipAddress: request.ip(),
          userAgent: request.header('user-agent'),
        },
        trx
      )

      await trx.commit()

      return response.ok({
        message: 'Room move stopped successfully',
        reservationId: params.reservationId,
        data: {
          reservationNumber: reservation.reservationNumber,
          revertedToRoomId: originalRoomId,
          cancelledRoomId: newRoomId,
          reason: reason || 'Room move stopped by user',
          stopTime: now.toISO(),
        },
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
          breakfast: reservation.reservationRooms.some((room) => room.breakfastIncluded),
          lunch: reservation.reservationRooms.some((room) => room.lunchIncluded),
          dinner: reservation.reservationRooms.some((room) => room.dinnerIncluded),
          drinks: reservation.reservationRooms.some((room) => room.drinksIncluded),
        },

        // Connectivity & Technology
        connectivity: {
          wifi: reservation.reservationRooms.some((room) => room.wifiIncluded),
          digitalKey: reservation.reservationRooms.some((room) => room.digitalKey),
          mobileCheckIn: reservation.reservationRooms.some((room) => room.mobileCheckIn),
        },

        // Transportation
        transportation: {
          parking: reservation.reservationRooms.some((room) => room.parkingIncluded),
          airportTransfer: reservation.reservationRooms.some(
            (room) => room.airportTransferIncluded
          ),
        },

        // Facility Access
        facilities: {
          spaAccess: reservation.reservationRooms.some((room) => room.spaAccessIncluded),
          gymAccess: reservation.reservationRooms.some((room) => room.gymAccessIncluded),
          poolAccess: reservation.reservationRooms.some((room) => room.poolAccessIncluded),
          businessCenter: reservation.reservationRooms.some((room) => room.businessCenterIncluded),
        },

        // Services
        services: {
          conciergeService: reservation.reservationRooms.some(
            (room) => room.conciergeServiceIncluded
          ),
          roomService: reservation.reservationRooms.some((room) => room.roomServiceIncluded),
          laundryService: reservation.reservationRooms.some((room) => room.laundryServiceIncluded),
          turndownService: reservation.reservationRooms.some(
            (room) => room.turndownServiceIncluded
          ),
          dailyHousekeeping: reservation.reservationRooms.some(
            (room) => room.dailyHousekeepingIncluded
          ),
          newspaperDelivery: reservation.reservationRooms.some((room) => room.newspaperDelivery),
          wakeUpCall: reservation.reservationRooms.some((room) => room.wakeUpCall),
        },

        // Special Amenities
        amenities: {
          welcomeGift: reservation.reservationRooms.some((room) => room.welcomeGift),
          roomDecoration: reservation.reservationRooms.some((room) => room.roomDecoration),
          champagne: reservation.reservationRooms.some((room) => room.champagne),
          flowers: reservation.reservationRooms.some((room) => room.flowers),
          chocolates: reservation.reservationRooms.some((room) => room.chocolates),
          fruitBasket: reservation.reservationRooms.some((room) => room.fruitBasket),
        },

        // Check-in/Check-out Services
        checkInOut: {
          earlyCheckIn: reservation.reservationRooms.some((room) => room.earlyCheckIn),
          lateCheckOut: reservation.reservationRooms.some((room) => room.lateCheckOut),
          expressCheckOut: reservation.reservationRooms.some((room) => room.expressCheckOut),
        },

        // Room Features
        roomFeatures: {
          extraBed: reservation.reservationRooms.some((room) => room.extraBed),
          crib: reservation.reservationRooms.some((room) => room.crib),
          rollawayBed: reservation.reservationRooms.some((room) => room.rollawayBed),
          connectingRooms: reservation.reservationRooms.some((room) => room.connectingRooms),
        },

        // Package Information
        packageInfo: {
          packageRate: reservation.reservationRooms.some((room) => room.packageRate),
          packageInclusions: reservation.reservationRooms
            .filter((room) => room.packageInclusions)
            .map((room) => room.packageInclusions)
            .filter(Boolean),
        },
      }

      // Count total inclusions
      const totalInclusions = Object.values(inclusions).reduce((total, category) => {
        if (typeof category === 'object' && category !== null) {
          return (
            total +
            Object.values(category).filter((value) =>
              Array.isArray(value) ? value.length > 0 : Boolean(value)
            ).length
          )
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
            isPackageRate: inclusions.packageInfo.packageRate,
          },
        },
      })
    } catch (error) {
      return response.badRequest({ message: 'Failed to get inclusion list', error: error.message })
    }
  }

  public async markNoShow({ params, request, response, auth }: HttpContext) {
    console.log('--- markNoShow start ---', { params })
    const startTime = Date.now()

    const trx = await db.transaction()

    try {
      const { reservationId } = params
      const {
        selectedRooms = [],
        reason,
        notes,
        noShowFees = 0,
      } = request.only(['selectedRooms', 'reason', 'notes', 'noShowFees'])

      if (!reservationId) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation ID is required' })
      }

      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms')
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.badRequest({ message: 'Reservation not found' })
      }

      const allowedStatuses = ['confirmed', 'checked_in', 'pending']
      if (!allowedStatuses.includes(reservation.status)) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot mark reservation as no-show. Current status: ${reservation.status}`,
        })
      }

      const now = DateTime.now()
      if (now < reservation.arrivedDate!) {
        await trx.rollback()
        return response.badRequest({ message: 'Cannot mark as no-show before arrival date' })
      }

      const allRoomsSelected = selectedRooms.length === reservation.reservationRooms.length
      const originalStatus = reservation.status

      console.log('Updating rooms and reservation status', { allRoomsSelected, selectedRooms })

      // --- Mettre à jour ReservationRoom ---
      for (const room of reservation.reservationRooms) {
        if (allRoomsSelected || selectedRooms.includes(room.id)) {
          room.status = 'no_show'
          room.markNoShowByUser = auth.user?.id ?? null
          await room.useTransaction(trx).save()
        }
      }

      // --- Mettre à jour le statut global de la réservation ---
      const allRoomsNoShow = reservation.reservationRooms.every((room) => room.status === 'no_show')
      reservation.status = allRoomsNoShow ? ReservationStatus.NOSHOW : ReservationStatus.CONFIRMED
      reservation.noShowDate = now
      reservation.noShowReason = reason
      reservation.noShowFees = noShowFees
      reservation.markNoShowBy = auth.user?.id!
      reservation.lastModifiedBy = auth.user?.id!
      // --- Folio fees et voids ---
      const folios = await Folio.query({ client: trx })
        .where('reservationId', reservationId)
        .where('status', '!=', 'voided')

      for (const folio of folios) {
        // Appliquer les frais no-show
        const totalNoShowFees = allRoomsSelected ? noShowFees : noShowFees * selectedRooms.length
        if (totalNoShowFees > 0) {
          await FolioService.postTransaction(
            {
              folioId: folio.id,
              transactionType: TransactionType.CHARGE,
              category: TransactionCategory.NO_SHOW_FEE,
              description: `No-show fee - ${reason || 'Guest did not arrive'}`,
              amount: totalNoShowFees,
              quantity: 1,
              unitPrice: totalNoShowFees,
              reference: `NOSHOW-${reservation.reservationNumber}`,
              notes: `No-show fee applied on ${now.toISODate()}`,
              postedBy: auth.user?.id!,
            },
            trx
          )
        }

        // Annuler les transactions actives
        const activeTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', folio.id)
          .where('status', '!=', 'voided')

        for (const transaction of activeTransactions) {
          // Vérifier qu'on ne void pas une transaction déjà voidée
          if (transaction.status !== 'voided') {
            await FolioService.postTransaction(
              {
                folioId: folio.id,
                transactionType: TransactionType.VOID,
                category: TransactionCategory.VOID,
                description: `Void: ${transaction.description} (No-show)`,
                amount: -transaction.amount,
                quantity: 1,
                unitPrice: -transaction.amount,
                reference: `VOID-${transaction.transactionNumber}`,
                notes: `Voided due to no-show: ${reason || 'Guest did not arrive'}`,
                postedBy: auth.user?.id!,
              },
              trx
            )

            transaction.voidedDate = now
            transaction.voidReason = 'No-show reservation'
            transaction.voidedBy = auth.user?.id!
            await transaction.useTransaction(trx).save()
          }
        }

        // Mettre le folio à jour si nécessaire (balance / status)
        await folio.useTransaction(trx).refresh()
        if (Math.abs(folio.balance) > 0.01) {
          await FolioService.postTransaction(
            {
              folioId: folio.id,
              transactionType: TransactionType.ADJUSTMENT,
              category: TransactionCategory.ADJUSTMENT,
              description: `Balancing adjustment - No-show processing`,
              amount: -folio.balance,
              quantity: 1,
              unitPrice: -folio.balance,
              reference: `BAL-${reservation.reservationNumber}`,
              notes: `Balancing adjustment after no-show processing`,
              postedBy: auth.user?.id!,
            },
            trx
          )
        }

        await folio
          .useTransaction(trx)
          .merge({
            status: FolioStatus.VOIDED,
            voidedDate: now,
            voidReason: `No-show reservation: ${reason || 'Guest did not arrive'}`,
            lastModifiedBy: auth.user?.id,
          })
          .save()
      }

      console.log('All folios processed, sending audit log')

      // --- Audit log ---

      const affectedRooms = allRoomsSelected
        ? reservation.reservationRooms.map(r => r.roomId).join(', ')
        : reservation.reservationRooms
          .filter(r => selectedRooms.includes(r.id))
          .map(r => r.roomId)
          .join(', ')

      await LoggerService.logActivity(
        {
          userId: auth.user?.id,
          action: 'MARK_NO_SHOW',
          resourceType: 'reservation',
          resourceId: reservationId,
          description: `Reservation #${reservation.reservationNumber} marked as No-Show for room(s): ${affectedRooms || 'N/A'}. Reason: ${reason || 'Guest did not arrive'}.`,
          details: {
            originalStatus,
            newStatus: reservation.status,
            roomsAffected: affectedRooms,
            allRoomsSelected,
            reason: reason || 'Guest did not arrive',
            notes,
            noShowDate: now.toISO(),
            noShowFees: noShowFees || null,
            markedByUser: auth.user?.id,
            reservationNumber: reservation.reservationNumber,
          },
          ipAddress: request.ip(),
          userAgent: request.header('user-agent'),
        },
        trx
      )


      await trx.commit()

      await reservation.save() // update the reservation at the end

      console.log('Transaction committed', { durationMs: Date.now() - startTime })

      await GuestSummaryService.recomputeFromReservation(reservation.id)

      return response.ok({
        message: 'Reservation marked as no-show successfully',
        reservationId: reservation.id,
        data: {
          reservationNumber: reservation.reservationNumber,
          status: reservation.status,
          noShowDate: now.toISO(),
          reason: reason || 'Guest did not arrive',
          noShowFees: noShowFees || null,
          markNoShowBy: auth.user?.id,
        },
      })
    } catch (error) {
      await trx.rollback()
      console.log('Error in markNoShow', { error: error.message })
      return response.badRequest({
        message: 'Failed to mark as no-show',
        error: error.message,
      })
    }
  }

  /**
   * new Void reservation
   */
  public async voidReservation(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const trx = await db.transaction()

    try {
      const { reservationId } = params
      const requestBody = request.body()
      const { reason, selectedReservations } = requestBody


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

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Check if reservation can be voided
      const allowedStatuses = ['confirmed', 'pending', 'checked_in']
      if (!allowedStatuses.includes(reservation.status)) {
        await trx.rollback()
        return response.badRequest({
          message: `Cannot void reservation with status: ${reservation.status}. Allowed statuses: ${allowedStatuses.join(', ')}`,
        })
      }

      // Store original status for audit
      const originalStatus = reservation.status

      // Determine which rooms to void
      let roomsToVoid: string[] = []
      const isPartialVoid =
        selectedReservations &&
        Array.isArray(selectedReservations) &&
        selectedReservations.length > 0

      console.log('Is partial void:', isPartialVoid)

      if (isPartialVoid) {
        // Partial void - void only selected rooms
        // Convert to strings for consistency
        roomsToVoid = selectedReservations.map((id) => id.toString())

        // Validate that selected rooms belong to this reservation
        const reservationRoomIds = reservation.reservationRooms.map((rr) => rr.roomId!.toString())
        const invalidRooms = roomsToVoid.filter((roomId) => !reservationRoomIds.includes(roomId))

        console.log('Invalid rooms:', invalidRooms)

        if (invalidRooms.length > 0) {
          await trx.rollback()
          return response.badRequest({
            message: `Invalid room selections. Rooms ${invalidRooms.join(', ')} do not belong to this reservation. Available rooms: ${reservationRoomIds.join(', ')}`,
          })
        }
      } else {
        // Full reservation void - void all rooms
        roomsToVoid = reservation.reservationRooms.map((rr) => rr.roomId!.toString())
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
              await folio
                .useTransaction(trx)
                .merge({
                  status: FolioStatus.VOIDED,
                  workflowStatus: WorkflowStatus.CLOSED,
                  lastModifiedBy: auth.user?.id,
                })
                .save()

              // Void all transactions in the folio
              await FolioTransaction.query({ client: trx })
                .where('folioId', folio.id)
                .where('status', '!=', 'voided')
                .update({
                  status: TransactionStatus.VOIDED,
                  voidedDate: DateTime.now(),
                  voidReason: `Reservation voided: ${reason}`,
                  lastModifiedBy: auth.user?.id,
                  updatedAt: DateTime.now(),
                })

              foliosVoided++
            }
          }
        }
      }

      let shouldVoidReservation = false
      if (!isPartialVoid) {
        shouldVoidReservation = true
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
          voidedByUser: auth.user?.id,
          lastModifiedBy: auth.user?.id,
          updatedAt: DateTime.now(),
        })

      console.log('Rooms updated count:', roomsUpdated)

      // Get room details for response
      const voidedRooms = await ReservationRoom.query({ client: trx }).whereIn('id', roomsToVoid)

      const roomNumbers = voidedRooms.map((rr) => rr.roomId).filter(Boolean)

      // Check if all rooms are voided (to update reservation status)
      const remainingActiveRooms = await ReservationRoom.query({ client: trx })
        .where('reservationId', numericReservationId)
        .where('status', '!=', 'voided')

      console.log('Remaining active rooms:', remainingActiveRooms.length)

      const allRoomsVoided = remainingActiveRooms.length === 0

      // If all rooms are voided and reservation wasn't already voided, void the reservation
      if (allRoomsVoided && reservation.status !== ReservationStatus.VOIDED) {
        shouldVoidReservation = true

        // Also void all folios if not already done
        if (isPartialVoid && reservation.folios && reservation.folios.length > 0) {
          for (const folio of reservation.folios) {
            if (folio.status === 'open') {
              await folio
                .useTransaction(trx)
                .merge({
                  status: FolioStatus.VOIDED,
                  workflowStatus: WorkflowStatus.CLOSED,
                  lastModifiedBy: auth.user?.id,
                })
                .save()

              await FolioTransaction.query({ client: trx })
                .where('folioId', folio.id)
                .where('status', '!=', 'voided')
                .update({
                  status: TransactionStatus.VOIDED,
                  voidedDate: DateTime.now(),
                  voidReason: `All rooms voided: ${reason}`,
                  lastModifiedBy: auth.user?.id,
                  updatedAt: DateTime.now(),
                })

              foliosVoided++
            }
          }
        }
      }

      // Create audit log

      const logMeta = {
        reservationNumber: reservation.reservationNumber,
        originalStatus,
        newStatus: allRoomsVoided
          ? ReservationStatus.VOIDED
          : isPartialVoid
            ? 'partially_voided'
            : ReservationStatus.VOIDED,
        reason,
        voidedDate: DateTime.now().toISO(),
        roomsVoided: roomsToVoid,
        totalRoomsInReservation: reservation.reservationRooms.length,
        isPartialVoid,
        allRoomsVoided,
        foliosVoided,
        userAgent: request.header('user-agent'),
        ipAddress: request.ip(),
      }

      const logDescription = isPartialVoid
        ? allRoomsVoided
          ? `All rooms in reservation #${reservation.reservationNumber} have been voided by ${auth.user?.fullName || 'System'}.`
          : `${roomsToVoid.length} room${roomsToVoid.length > 1 ? 's' : ''} in reservation #${reservation.reservationNumber} have been voided by ${auth.user?.fullName || 'System'}.`
        : `Reservation #${reservation.reservationNumber} was fully voided by ${auth.user?.fullName || 'System'}.`

      await LoggerService.log({
        actorId: auth.user?.id!,
        action: isPartialVoid ? 'VOID_ROOMS' : 'VOID_RESERVATION',
        entityType: 'Reservation',
        entityId: reservation.id,
        hotelId: reservation.hotelId,
        description: logDescription,
        meta: logMeta,
        ctx,
      })

      //  log a Guest-related event
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: isPartialVoid ? 'GUEST_ROOMS_VOIDED' : 'GUEST_RESERVATION_VOIDED',
        entityType: 'Guest',
        entityId: reservation.guestId,
        hotelId: reservation.hotelId,
        description: isPartialVoid
          ? `Guest's reservation #${reservation.reservationNumber} had ${roomsToVoid.length} room${roomsToVoid.length > 1 ? 's' : ''} voided.`
          : `Guest's reservation #${reservation.reservationNumber} was fully voided.`,
        meta: logMeta,
        ctx,
      })


      await trx.commit()

      if (shouldVoidReservation) {
        try {
          const freshReservation = await Reservation.find(numericReservationId)
          if (freshReservation) {
            await freshReservation
              .merge({
                status: ReservationStatus.VOIDED,
                voidedDate: DateTime.now(),
                voidReason: reason,
                voidedBy: auth.user?.id,
                lastModifiedBy: auth.user?.id,
              })
              .save()
          }
        } catch { }
      }

      try {
        const NotificationService = (await import('#services/notification_service')).default

        const guestName = reservation.guest
          ? `${reservation.guest.firstName || ''} ${reservation.guest.lastName || ''}`.trim()
          : 'Guest'

        const voidType = allRoomsVoided ? 'FULL' : 'PARTIAL'
        const roomsList = roomNumbers.length > 0 ? `[${roomNumbers.join(', ')}]` : '(none)'

        // Notification STAFF
        try {
          const staffTemplateCode = allRoomsVoided
            ? 'RESERVATION_VOIDED'
            : 'RESERVATION_PARTIAL_VOIDED'

          const staffVariables = await NotificationService.buildVariables(staffTemplateCode, {
            hotelId: reservation.hotelId,
            reservationId: reservation.id,
            guestId: reservation.guestId,
            extra: {
              ReservationNumber: reservation.reservationNumber || 'N/A',
              GuestName: guestName,
              VoidDate: DateTime.now().toISODate(),
              VoidedRooms: roomsList,
              VoidReason: reason,
              StaffMember: auth.user?.fullName || `User ${auth.user?.id}`,
              VoidType: voidType,
              TotalRoomsVoided: roomNumbers.length,
              OriginalStatus: originalStatus,
              FoliosVoided: foliosVoided,
            },
          })

          await NotificationService.sendWithTemplate({
            templateCode: staffTemplateCode,
            recipientType: 'STAFF',
            recipientId: auth.user!.id,
            variables: staffVariables,
            relatedEntityType: 'Reservation',
            relatedEntityId: reservation.id,
            actorId: auth.user!.id,
            hotelId: reservation.hotelId,
          })
        } catch (staffError) {
          console.error(' Erreur notification STAFF void:', (staffError as any)?.message)
        }

        // Notification GUEST (si email disponible)
        if (reservation.guest && reservation.guest.email) {
          try {
            const guestTemplateCode = allRoomsVoided
              ? 'RESERVATION_VOIDED_GUEST'
              : 'RESERVATION_PARTIAL_VOIDED_GUEST'

            const guestVariables = await NotificationService.buildVariables(guestTemplateCode, {
              hotelId: reservation.hotelId,
              reservationId: reservation.id,
              guestId: reservation.guestId,
              extra: {
                ReservationNumber: reservation.reservationNumber || 'N/A',
                GuestName: guestName,
                VoidDate: DateTime.now().toISODate(),
                VoidedRooms: roomsList,
                ContactEmail: reservation.guest.email,
                ContactPhone: reservation.guest.phonePrimary || 'N/A',
              },
            })

            await NotificationService.sendWithTemplate({
              templateCode: guestTemplateCode,
              recipientType: 'GUEST',
              recipientId: reservation.guestId,
              variables: guestVariables,
              relatedEntityType: 'Reservation',
              relatedEntityId: reservation.id,
              actorId: auth.user!.id,
              hotelId: reservation.hotelId,
            })
          } catch (guestError) {
            console.error(' Erreur notification GUEST void:', (guestError as any)?.message)
          }
        }
      } catch (notifError) {
        console.error(' Erreur générale notifications void:', notifError)
      }


      await GuestSummaryService.recomputeFromReservation(reservation.id)

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
          currentStatus: allRoomsVoided ? 'voided' : isPartialVoid ? 'partially_voided' : 'voided',
          voidedDate: DateTime.now().toISO(),
          reason,
          roomsVoidedCount: roomsToVoid.length,
          totalRoomsInReservation: reservation.reservationRooms.length,
          foliosVoided,
          voidedRoomIds: roomsToVoid,
        },
      })
    } catch (error) {
      await trx.rollback()
      logger.error('Error voiding reservation rooms:', error)
      return response.badRequest({
        message: 'Failed to void reservation/rooms',
        error: error.message,
      })
    }
  }

  public async unassignRoom(ctx: HttpContext) {
    const trx = await db.transaction()
    const { params, request, response, auth } = ctx
    try {
      const { reservationId } = params
      const { reservationRooms, actualCheckInTime } = request.body()

      console.log('--- Début unassignRoom ---')
      console.log('Params:', params)
      console.log('Body reçu:', request.body())
      console.log('User connecté:', auth?.user)

      // Validate required fields
      if (!reservationRooms) {
        console.log('Erreur : reservationRooms manquant')
        await trx.rollback()
        return response.badRequest({ message: 'Room ID is required' })
      }

      // Get reservation with related data
      console.log('Recherche de la réservation ID:', reservationId, 'avec rooms:', reservationRooms)
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (query) => {
          query.whereIn('id', reservationRooms)
        })
        .first()

      console.log('Résultat de la requête Reservation:', reservation)

      if (!reservation) {
        console.log('Erreur : réservation non trouvée')
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Check if reservation allows room unassignment
      const allowedStatuses = ['confirmed', 'pending']
      console.log('Statut réservation:', reservation.status)
      if (!allowedStatuses.includes(reservation.status)) {
        console.log('Erreur : statut non autorisé', reservation.status)
        await trx.rollback()
        return response.badRequest({
          message: `Cannot unassign room from reservation with status: ${reservation.status}. Allowed statuses: ${allowedStatuses.join(', ')}`,
        })
      }
      const unassignedRooms: string[] = []

      console.log('Nombre de reservationRooms trouvées:', reservation.reservationRooms.length)

      for (const reservationRoom of reservation.reservationRooms) {
        console.log(
          'Traitement reservationRoom:',
          reservationRoom.id,
          '-> actuel roomId:',
          reservationRoom.roomId
        )

        // Store the reservation room ID before unassigning
        const reservationRoomId = reservationRoom.id
        const room = await Room.query({ client: trx }).where('id', reservationRoom.roomId!).first()
        if (room) {
          unassignedRooms.push(room.roomNumber)
        }

        reservationRoom.roomId = null
        reservationRoom.lastModifiedBy = auth?.user?.id!
        await reservationRoom.useTransaction(trx).save()
        console.log('Room désaffectée pour reservationRoom:', reservationRoomId)

        // Remove room number from folio transaction descriptions
        await ReservationFolioService.removeRoomChargeDescriptions(
          reservationRoomId,
          auth?.user?.id!
        )
        console.log('Descriptions folio mises à jour pour reservationRoom:', reservationRoomId)
      }

      // Create audit log
      console.log('Création du log audit...')
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'ROOM_UNASSIGNED',
        entityType: 'ReservationRoom',
        entityId: reservationId,
        hotelId: reservation.hotelId,
        description: unassignedRooms.length
          ? `Unassigned Rooms [${unassignedRooms.join(', ')}] from reservation #${reservation.reservationNumber}`
          : `Room(s) unassigned from reservation #${reservation.reservationNumber}`,
        ctx: ctx,
      })

      await trx.commit()
      console.log('--- SUCCESS: Room désaffectée avec succès ---')

      return response.ok({
        message: 'Room unassigned successfully',
        reservationId,
      })
    } catch (error) {
      await trx.rollback()
      console.log('--- ERROR ---')
      console.error('Error unassigning room:', error)
      return response.badRequest({
        message: 'Failed to unassign room',
        error: error.message,
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
        .preload('paymentMethod')
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
        .preload('reservationRoom', (query) => {
          query.preload('room')
        })
      console.log('reservation', roomChargeTransactions)
      // Build room charges breakdown - one row per folio transaction
      const roomChargesTable: any = []

      for (const reservationRoom of reservation.reservationRooms) {
        const stayDuration = reservationRoom.nights
        const totalAdults = reservationRoom.adults
        const totalChildren = reservationRoom.children

        // Get room charge transactions for this specific room
        const roomTransactions = roomChargeTransactions.filter(
          (transaction) =>
            transaction.reservationRoomId === reservationRoom.id
        )

        // Create a row for each folio transaction
        if (roomTransactions.length > 0) {
          roomTransactions.forEach((transaction) => {
            const adjustmentAmount = 0 // Adjustments are typically separate transactions
            const total =
              parseFloat(`${transaction.amount ?? 0}`) -
              parseFloat(`${transaction.discountAmount ?? 0}`) +
              parseFloat(`${transaction.taxAmount ?? 0}`) +
              parseFloat(`${transaction.serviceChargeAmount ?? 0}`)
            roomChargesTable.push({
              transactionId: transaction.id,
              transactionNumber: transaction.transactionNumber,
              transactionDate: transaction.transactionDate?.toISODate(),
              stay: {
                checkInDate: transaction.reservationRoom.checkInDate?.toISODate(),
                checkOutDate: transaction.reservationRoom.checkOutDate?.toISODate(),
                nights: stayDuration,
              },
              room: {
                roomNumber: transaction.reservationRoom.room?.roomNumber || transaction.roomNumber,
                roomType: transaction.reservationRoom.roomType?.roomTypeName,
                roomId: transaction.reservationRoom.room?.id,
              },
              rateType: {
                ratePlanName: reservationRoom.roomRates?.rateType?.rateTypeName,
                ratePlanCode: reservation.ratePlan?.planCode,
                rateAmount: reservationRoom.rateAmount || transaction.unitPrice || 0,
              },
              pax: `${totalAdults}/${totalChildren}`, // Format: Adult/Child
              charge: Number(transaction.amount || 0),
              discount: Number(transaction.discountAmount || 0),
              tax: Number(transaction.taxAmount || 0),
              adjustment: Number(adjustmentAmount || 0),
              netAmount: Number(total || 0),
              description: transaction.description,
            })
          })
        }
      }

      // Calculate summary totals
      const totalCharges = roomChargesTable?.reduce((sum: any, row: any) => sum + Number(row.charge || 0), 0)
      const totalDiscounts = roomChargesTable.reduce(
        (sum: any, row: any) => sum + Number(row.discount || 0),
        0
      )
      const totalTax = roomChargesTable.reduce((sum: any, row: any) => sum + Number(row.tax || 0), 0)
      const totalAdjustments = roomChargesTable.reduce(
        (sum: any, row: any) => sum + Number(row.adjustment || 0),
        0
      )
      const totalNetAmount = roomChargesTable.reduce(
        (sum: any, row: any) => sum + Number(row.netAmount || 0),
        0
      )

      return response.ok({
        success: true,
        data: {
          reservationId: reservation.id,
          reservationNumber: reservation.reservationNumber,
          guestName:
            `${reservation.guest?.firstName || ''} ${reservation.guest?.lastName || ''}`.trim(),
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
            totalNetAmount: totalNetAmount,
          },
        },
        message: 'Room charges table retrieved successfully',
      })
    } catch (error) {
      logger.error('Error fetching room charges:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch room charges',
        error: error.message,
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
          errors: ['hotelId parameter is missing'],
        })
      }

      if (!date) {
        return response.badRequest({
          success: false,
          message: 'Date is required',
          errors: ['date query parameter is missing'],
        })
      }

      // Validate date format
      const targetDate = DateTime.fromISO(date)
      if (!targetDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Invalid date format',
          errors: ['Date must be in ISO format (YYYY-MM-DD)'],
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
      const formattedReservations = releasedReservations.map((reservation) => {
        const guest = reservation.guest
        const rooms = reservation.reservationRooms.map((rr) => ({
          roomId: rr.room?.id,
          roomNumber: rr.room?.roomNumber,
          roomType: rr.roomType?.roomTypeName,
          floorNumber: rr.room?.floorNumber,
          checkInDate: rr.checkInDate?.toISODate(),
          checkOutDate: rr.checkOutDate?.toISODate(),
        }))

        const totalFolioAmount = reservation.folios.reduce(
          (sum, folio) => sum + (folio.totalAmount || 0),
          0
        )
        const totalBalance = reservation.folios.reduce(
          (sum, folio) => sum + (folio.balanceAmount || 0),
          0
        )

        return {
          reservationId: reservation.id,
          reservationNumber: reservation.reservationNumber,
          confirmationNumber: reservation.confirmationNumber,
          status: reservation.status,
          guest: {
            id: guest?.id,
            name: guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : 'N/A',
            email: guest?.email,
            phone: guest?.phonePrimary,
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
            count: reservation.folios.length,
          },
          releasedAt: reservation.checkOutDate || reservation.departDate,
          createdAt: reservation.createdAt,
          updatedAt: reservation.updatedAt,
        }
      })

      return response.ok({
        success: true,
        message: 'Released reservations retrieved successfully',
        data: {
          hotelId: parseInt(hotelId),
          date: targetDate.toISODate(),
          totalCount: formattedReservations.length,
          reservations: formattedReservations,
        },
      })
    } catch (error) {
      logger.error('Error fetching released reservations:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch released reservations',
        error: error.message,
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
      const { reservationRooms } = request.body()
      const resRoomIds = reservationRooms?.map((e: any) => e.reservationRoomId)

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
      const assignedRooms: string[] = []
      for (const reservationRoom of reservation.reservationRooms) {
        if (reservationRoom.roomId && reservationRoom.roomId !== 0) {
          await trx.rollback()
          return response.badRequest({
            message: `Cannot assign room from reservation with room`,
          })
        } else {
          const newRoomId = reservationRooms.filter(
            (e: any) => e.reservationRoomId === reservationRoom.id
          )[0].roomId
          reservationRoom.roomId = newRoomId
          reservationRoom.lastModifiedBy = auth?.user?.id!
          await reservationRoom.useTransaction(trx).save()

          // Get room number and update folio transaction descriptions
          const room = await Room.query({ client: trx }).where('id', newRoomId).first()

          if (room) {
            assignedRooms.push(room.roomNumber)
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
        description: `Assigned Rooms [${assignedRooms.join(', ')}] to reservation #${reservation.reservationNumber}`,
        ctx: ctx,
      })

      await trx.commit()

      return response.ok({
        message: 'Assign Room successfully',
        reservationId,
      })
    } catch (error) {
      await trx.rollback()
      logger.error('Error assigning room:', error)
      return response.badRequest({
        message: 'Failed to unassign room',
        error: error.message,
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
      const { reservationRooms, stopMove } = request.body()
      const resRoomIds = reservationRooms?.map((e: any) => e.reservationRoomId)

      // Validate required fields
      if (!reservationRooms || stopMove === undefined) {
        await trx.rollback()
        return response.badRequest({
          message: 'Reservation rooms and stopMove status are required',
        })
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
        ctx: ctx,
      })

      await trx.commit()

      return response.ok({
        message: `Stop move ${stopMove ? 'enabled' : 'disabled'} successfully`,
        reservationId,
        stopMove,
      })
    } catch (error) {
      await trx.rollback()
      logger.error('Error updating stop move:', error)
      return response.badRequest({
        message: 'Failed to update stop move status',
        error: error.message,
      })
    }
  }

  public async printGuestCard({ request, response }: HttpContext) {
    try {
      const { guestId, reservationId } = request.only(['guestId', 'reservationId'])

      if (!guestId || !reservationId) {
        return response.badRequest({
          message: 'Guest ID and Reservation ID are required',
        })
      }

      // Fetch guest and reservation data
      const guest = await Guest.find(guestId)
      const reservation = await Reservation.query()
        .where('id', reservationId)
        .preload('hotel')
        .preload('folios', (folioQuery) => {
          folioQuery.preload('transactions')
        })
        .preload('reservationRooms', (query) => {
          query
            .preload('room', (roomQuery) => {
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
      const totalsSummary = ReservationsController.calculateBalanceSummary(reservation.folios)

      logger.info(totalsSummary)
      // Generate guest card HTML content
      const htmlContent = this.generateGuestCardHtml(guest, reservation, totalsSummary)

      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        orientation: 'portrait',
      })

      // Set response headers for PDF
      response.header('Content-Type', 'application/pdf')
      response.header(
        'Content-Disposition',
        `attachment; filename="guest-card-${guest.firstName}-${guest.lastName}.pdf"`
      )

      return response.send(pdfBuffer)
    } catch (error) {
      logger.error('Error generating guest card PDF:', error)
      return response.internalServerError({
        message: 'Failed to generate guest card PDF',
        error: error.message,
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
                        <span class="input-line">${reservation.adults} / ${reservation.children || 0} (A/C)</span>
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

  public async updateBookingDetails(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const trx = await db.transaction()

    try {
      const { reservationId } = params
      const payload = request.body()

      // Log pour déboguer
      console.log('Received payload:', payload)

      // Get reservation
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      // Mettre à jour avec les bons noms de champs
      if (payload.billTo !== undefined) {
        reservation.billTo = payload.billTo
      }
      if (payload.businessSourceId !== undefined) {
        reservation.businessSourceId = payload.businessSourceId
      }

      if (payload.paymentMethodId !== undefined) {
        reservation.paymentMethodId = payload.paymentMethodId
      }
      if (payload.paymentType !== undefined) {
        reservation.paymentType = payload.paymentType
      }
      if (payload.marketCodeId !== undefined) {
        reservation.marketCodeId = payload.marketCodeId
      }
      // CORRECTION: reservationType -> reservationTypeId
      if (payload.reservationTypeId !== undefined) {
        reservation.reservationTypeId = payload.reservationTypeId
      }
      if (payload.companyName !== undefined) {
        reservation.companyName = payload.companyName
      }

      reservation.lastModifiedBy = auth?.user?.id!

      // Sauvegarder les changements
      await reservation.useTransaction(trx).save()

      // Log après sauvegarde
      console.log('Reservation updated:', reservation.$attributes)

      // Audit log
      await LoggerService.log({
        actorId: auth.user?.id!,
        action: 'UPDATED',
        entityType: 'Reservation',
        entityId: reservationId,
        hotelId: reservation.hotelId,
        description: `Updated booking details for reservation #${reservation.reservationNumber}`,
        ctx,
      })

      await trx.commit()

      // Retourner les données mises à jour
      return response.ok({
        message: 'Update Booking Details successfully',
        data: reservation,
      })
    } catch (error) {
      await trx.rollback()
      logger.error('Error updating booking details:', error)
      return response.badRequest({
        message: 'Failed to update booking details',
        error: error.message,
      })
    }
  }



  public async updateReservationDetails(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const trx = await db.transaction()
    console.log('🔹 [updateReservationDetails] START')

    try {
      const reservationId = Number(params.id)
      if (!reservationId || Number.isNaN(reservationId)) {
        await trx.rollback()
        return response.badRequest({ message: 'Invalid reservation id' })
      }

      const payload = await request.validateUsing(updateReservationDetailsValidator)
      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('reservationRooms', (q) =>
          q.preload('room', (rq) => rq.preload('taxRates'))
        )
        .preload('folios', (q) =>
          q.preload('transactions', (tr) =>
            tr.where('transactionType', TransactionType.CHARGE)
              .where('category', TransactionCategory.ROOM)
          )
        )
        .preload('hotel', (hq) => hq.preload('roomChargesTaxRates'))
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      const oldRoomRates = new Map<number, number>()
      for (const rr of reservation.reservationRooms) {
        oldRoomRates.set(rr.id, rr.roomRate)
      }
      const oldAdults = reservation.adults
      const oldChildren = reservation.children




      // -------------------------------
      // Build room -> taxRates map
      // -------------------------------
      const roomTaxMap: Record<string, TaxRate[]> = {}
      for (const rr of reservation.reservationRooms) {
        const roomNumber = rr.room?.roomNumber
        const rates = (rr.room?.taxRates || []).filter((r: any) => r.isActive && r.appliesToRoomRate)
        if (roomNumber) roomTaxMap[roomNumber] = rates
      }

      // -------------------------------
      // Update reservation rooms
      // -------------------------------
      for (const rr of reservation.reservationRooms) {
        // Update roomRate (payload.amount has priority)
        if (payload.rateTypeId || payload.amount !== undefined) {
          const roomRate = await RoomRate.query({ client: trx })
            .where('roomTypeId', rr.roomTypeId)
            .where('rateTypeId', payload.rateTypeId)
            .first()

          rr.roomRate = payload.amount ?? roomRate?.baseRate ?? rr.roomRate

          // Update mealPlanId
          rr.mealPlanId = roomRate?.mealPlanId ?? null
        }

        if (payload.notes !== undefined) rr.notes = payload.notes
        if (payload.rateTypeId !== undefined) rr.rateTypeId = payload.rateTypeId as number
        if (payload.isComplementary !== undefined) rr.isComplementary = payload.isComplementary
        if (payload.taxInclude !== undefined) rr.taxIncludes = payload.taxInclude
        if (payload.mealPlanRateInclude !== undefined) rr.mealPlanRateInclude = payload.mealPlanRateInclude

        rr.lastModifiedBy = auth?.user?.id || rr.lastModifiedBy

        await rr.useTransaction(trx).save()
      }

      if (payload.adults !== undefined) {
        reservation.adults = payload.adults
      }
      if (payload.children !== undefined) {
        reservation.children = payload.children
      }

      // -------------------------------
      // Determine transactions to update
      // -------------------------------
      let transactionsToUpdate: FolioTransaction[] = []
      const allFolioTransactions = reservation.folios.flatMap(f => f.transactions)
      if (payload.applyOn === 'stay') {
        transactionsToUpdate = allFolioTransactions
      } else {
        const idSet = new Set(payload.transactionIds || [])
        transactionsToUpdate = allFolioTransactions.filter(t => idSet.has(t.id))
      }

      // -------------------------------
      // Recalculate transactions
      // -------------------------------
      // Use hotel-level room charge tax rates to match creation path
      const hotelTaxRates = ((reservation.hotel as any)?.roomChargesTaxRates || [])

      for (const t of transactionsToUpdate) {
        if (t.isVoided || (t as any).status === 'voided') continue

        const rr = reservation.reservationRooms.find(rr => rr.room?.roomNumber === t.roomNumber)

        // Base amount = transaction amount + meal plan if included
        let mealPlanAmount = 0
        if (rr?.mealPlanRateInclude && rr?.mealPlanId) {
          const mealPlan = await MealPlan.query({ client: trx })
            .where('id', rr.mealPlanId)
            .preload('extraCharges', (q) => q.where('isMealPlanComponent', true))
            .first()
          if (mealPlan) {
            for (const extra of mealPlan.extraCharges) {
              const pivot = (extra as any).$extras || {}
              const quantityPerDay = pivot.quantity_per_day || 1
              const nights = rr.nights || 1
              mealPlanAmount += Number(extra.rate || 0) * quantityPerDay * nights
            }
          }
        }

        // Update transaction fields from payload
        if (payload.amount !== undefined) t.amount = payload.amount
        if (payload.isComplementary !== undefined) t.complementary = payload.isComplementary
        if (payload.date) t.postingDate = DateTime.fromJSDate(payload.date as any)
        if (payload.taxInclude !== undefined) (t as any).taxInclusive = Boolean(payload.taxInclude)
        if (payload.notes !== undefined) t.description = payload.notes

        const baseAmount = Number(t.amount || 0) + mealPlanAmount
        const sc = Number(t.serviceChargeAmount || 0)
        const disc = Number(t.discountAmount || 0)
        const taxRates = hotelTaxRates

        let totalPct = 0
        let totalFlat = 0
        for (const rate of taxRates) {
          if ((rate as any).postingType === 'flat_percentage') totalPct += Number(rate.percentage || 0)
          if ((rate as any).postingType === 'flat_amount') totalFlat += Number(rate.amount || 0)
        }

        if (payload.taxInclude) {
          logger.info(baseAmount);
          const pctIncluded = totalPct > 0 ? baseAmount * (totalPct / (100 + totalPct)) : 0
          t.taxAmount = Number((pctIncluded + totalFlat).toFixed(2))
          t.grossAmount = Number((baseAmount + sc - t.taxAmount - Math.abs(disc)).toFixed(2))
          t.netAmount = Number((baseAmount - t.taxAmount).toFixed(2))
          t.amount = t.grossAmount;
          t.totalAmount = baseAmount;
        } else {
          const pctTax = totalPct > 0 ? baseAmount * (totalPct / 100) : 0
          t.taxAmount = Number((pctTax + totalFlat).toFixed(2))
          t.grossAmount = baseAmount;
          t.grossAmount = Number((baseAmount).toFixed(2))
          t.netAmount = Number((baseAmount - disc).toFixed(2))
          t.totalAmount = Number(baseAmount + t.taxAmount)
        }
        t.lastModifiedBy = auth?.user?.id || t.lastModifiedBy
        await t.useTransaction(trx).save()
      }

      // -------------------------------
      // Update reservation totals
      // -------------------------------
      let totalRoomCharges = 0
      let totalAmount = 0
      for (const rr of reservation.reservationRooms) {
        const roomTransactions = transactionsToUpdate.filter(t => t.roomNumber === rr.room?.roomNumber)
        rr.totalRoomCharges = roomTransactions.reduce((sum, t) => sum + Number(t.amount || 0), 0)
        rr.totalAmount = rr.nights ? rr.roomRate * rr.nights : rr.roomRate
        rr.netAmount = rr.totalAmount
        await rr.useTransaction(trx).save()
        totalRoomCharges += rr.totalRoomCharges
        totalAmount += rr.totalAmount
      }
      reservation.totalAmount = totalAmount
      await reservation.useTransaction(trx).save()

      // Recalculate folio totals/balance to reflect transaction changes
      const affectedFolioIds = new Set<number>()
      for (const t of transactionsToUpdate) {
        if (t.folioId) affectedFolioIds.add(t.folioId)
      }
      for (const folioId of affectedFolioIds) {
        await FolioService.updateFolioTotals(folioId, trx)
      }

      const changedRooms: Array<{ roomNumber: string; oldRate: number; newRate: number; nights?: number }> = []
      for (const rr of reservation.reservationRooms) {
        const oldRate = oldRoomRates.get(rr.id)
        if (oldRate !== undefined && oldRate !== rr.roomRate) {
          changedRooms.push({
            roomNumber: rr.room?.roomNumber || `Room ${rr.id}`,
            oldRate,
            newRate: rr.roomRate,
            nights: rr.nights || 1,
          })
        }
      }
      await trx.commit()
      // Notifications
      try {
        const CheckinCheckoutNotificationService = (await import('#services/notification_action_service')).default

        // Notification de changement de tarif
        if (changedRooms.length > 0) {
          await CheckinCheckoutNotificationService.notifyRateChange(
            reservation.id,
            changedRooms,
            auth.user!.id
          )
        }

        // Notification de changement de pax
        const newAdults = reservation.adults
        const newChildren = reservation.children
        if (oldAdults !== newAdults || oldChildren !== newChildren) {
          await CheckinCheckoutNotificationService.notifyPaxChange(
            reservation.id,
            oldAdults + oldChildren,
            newAdults + newChildren,
            auth.user!.id
          )
        }


      } catch (notifError) {
        console.error(' Erreur lors des notifications:', notifError)
      }


      return response.ok({
        message: 'Reservation details updated successfully',
        data: {
          reservationId: reservation.id,
          updatedRooms: reservation.reservationRooms.map(rr => rr.id),
          updatedTransactions: transactionsToUpdate.map(t => t.id),
          reservation
        }
      })
    } catch (error) {
      console.error(' ERROR updating reservation details:', error)
      await trx.rollback()
      return response.badRequest({ message: 'Failed to update reservation details', error: error.message })
    }
  }



  public async applyRoomChargeDiscount({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()
    try {
      const reservationId = Number(params.id || params.reservationId)
      if (!reservationId || Number.isNaN(reservationId)) {
        await trx.rollback()
        return response.badRequest({ message: 'Invalid reservation id' })
      }

      const payload = await request.validateUsing(applyRoomChargeDiscountValidator)

      const reservation = await Reservation.query({ client: trx })
        .where('id', reservationId)
        .preload('folios', (f) => f.preload('transactions', (t) => t.where('category', TransactionCategory.ROOM).andWhere('transactionType', TransactionType.CHARGE)))
        .first()

      if (!reservation) {
        await trx.rollback()
        return response.notFound({ message: 'Reservation not found' })
      }

      const discount = await Discount.findOrFail(payload.discountId)
      const discountType = (discount as any).type || 'percentage'
      const discountValue = Number((discount as any).value || 0)
      const status = (discount as any).status || 'active'
      const isDeleted = Boolean((discount as any).isDeleted)

      if (status !== 'active' || isDeleted) {
        await trx.rollback()
        return response.badRequest({ message: 'Discount is not active' })
      }


      const roomTransactions = reservation.folios
        .flatMap((f) => f.transactions)
        .filter((t) => t.category === TransactionCategory.ROOM && !t.isVoided)

      if (roomTransactions.length === 0) {
        await trx.rollback()
        return response.badRequest({ message: 'No room charge transactions found to discount' })
      }

      let targetTransactions = roomTransactions
      if (payload.discountRule === 'firstNight') {
        targetTransactions = [...roomTransactions]
          .sort((a, b) => {
            const ad = new Date((a.postingDate || a.transactionDate || a.createdAt) as any).getTime()
            const bd = new Date((b.postingDate || b.transactionDate || b.createdAt) as any).getTime()
            return ad - bd
          })
          .slice(0, 1)
      } else if (payload.discountRule === 'lastNight') {
        targetTransactions = [...roomTransactions]
          .sort((a, b) => {
            const ad = new Date((a.postingDate || a.transactionDate || a.createdAt) as any).getTime()
            const bd = new Date((b.postingDate || b.transactionDate || b.createdAt) as any).getTime()
            return bd - ad
          })
          .slice(0, 1)
      } else if (payload.discountRule === 'selectNights') {
        const idSet = new Set<number>(payload.selectedTransactions || [])
        targetTransactions = roomTransactions.filter((t) => idSet.has(t.id))
      }

      if (targetTransactions.length === 0) {
        await trx.rollback()
        return response.badRequest({ message: 'No matching transactions found for selected discount rule' })
      }

      const updatedIds: number[] = []

      for (const t of targetTransactions) {
        const amount = Number(t.amount || 0)
        let discountAmount = 0
        let discountRate = 0

        if (discountType === 'percentage') {
          // Store percentage as a fraction (e.g., 20% => 0.20) to fit numeric(5,4)
          discountRate = Number((discountValue / 100).toFixed(4))
          discountAmount = amount * (discountValue / 100)
        } else if (discountType === 'flat') {
          discountAmount = Math.min(discountValue, amount)
        }

        discountAmount = Number(discountAmount.toFixed(2))

        t.discountAmount = discountAmount
        t.discountRate = discountRate
        t.discountId = payload.discountId

        if (payload.notes) {
          t.description = [t.description, payload.notes].filter(Boolean).join(' ')
        }

        if (payload.date) {
          try {
            t.postingDate = DateTime.fromJSDate(payload.date as any)
          } catch {
            // Fallback to ISO parsing if payload.date is string
            t.postingDate = DateTime.fromISO(String(payload.date))
          }
        }

        const tax = Number(t.taxAmount || 0)
        const sc = Number(t.serviceChargeAmount || 0)
        const taxInclusive = Boolean((t as any).taxInclusive)
        const disc = discountAmount

        if (taxInclusive) {
          t.grossAmount = Number((amount + sc - Math.abs(disc)).toFixed(2))
          t.netAmount = Number((amount - tax - Math.abs(disc)).toFixed(2))
        } else {
          t.grossAmount = Number((amount + tax + sc - Math.abs(disc)).toFixed(2))
          t.netAmount = Number((amount - Math.abs(disc)).toFixed(2))
        }
        logger.info(t)
        t.lastModifiedBy = auth?.user?.id || t.lastModifiedBy
        await t.useTransaction(trx).save()
        updatedIds.push(t.id)
      }

      await trx.commit()
      return response.ok({
        message: 'Discount applied to room charge transactions',
        data: { reservationId: reservation.id, updatedTransactions: updatedIds },
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({ message: 'Failed to apply discount', error: error.message })
    }
  }

  async filterReservations({ request, response }: HttpContext) {
    try {
      // Récupération des paramètres depuis la query string
      const { hotelId: hotelIdRaw, roomId: roomIdRaw, roomTypeId: roomTypeIdRaw } = request.qs()

      //  Voir ce qui arrive
      console.log(' Received query params:', { hotelIdRaw, roomIdRaw, roomTypeIdRaw })

      // Conversion sécurisée des paramètres
      const hotelId = hotelIdRaw ? parseInt(hotelIdRaw, 10) : null
      const roomId = roomIdRaw ? parseInt(roomIdRaw, 10) : null
      const roomTypeId = roomTypeIdRaw ? parseInt(roomTypeIdRaw, 10) : null

      console.log(' Parsed params:', { hotelId, roomId, roomTypeId })

      // Validation du hotelId (obligatoire)
      if (!hotelId || Number.isNaN(hotelId)) {
        console.log('❌ Invalid hotelId - returning 400')
        return response.badRequest({
          success: false,
          message: 'hotelId is required and must be a valid number',
          received: {
            raw: hotelIdRaw,
            parsed: hotelId,
            type: typeof hotelIdRaw,
          },
        })
      }

      // Construction de la requête de base
      const query = ReservationRoom.query().where('hotel_id', hotelId).where('status', 'checked_in')

      if (roomId && !Number.isNaN(roomId)) {
        console.log(' Filtering by roomId:', roomId)
        query.where('room_id', roomId)
      }

      // Filtre optionnel par roomTypeId
      if (roomTypeId && !Number.isNaN(roomTypeId)) {
        console.log(' Filtering by roomTypeId:', roomTypeId)
        query.where('room_type_id', roomTypeId)
      }

      // Preload des relations (comme dans searchReservations)
      query
        .preload('reservation', (resQ) => {
          resQ.preload('guest').preload('bookingSource')
        })
        .preload('guest')
        .preload('room', (roomQ) => {
          roomQ.preload('roomType')
        })
        .preload('roomType')
        .preload('rateType')
        .orderBy('check_in_date', 'desc')

      console.log('🔍 Executing query...')
      const rows = await query
      console.log(' Query result count:', rows.length)

      // Formatage des données (enrichissement comme searchReservations)
      const data = rows.map((rr) => {
        const res = rr.reservation
        const guest = res?.guest || rr.guest

        return {
          reservationRoomId: rr.id,
          reservationId: res?.id || rr.reservationId,
          guestName: guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : '—',
          guestEmail: guest?.email || null,
          guestPhone: guest?.phonePrimary || null,
          roomId: rr.roomId,
          roomNumber: rr.room?.roomNumber,
          roomTypeId: rr.roomTypeId,
          roomTypeName: rr.roomType?.roomTypeName || rr.room?.roomType?.roomTypeName,
          checkInDate: rr.checkInDate?.toISODate?.() || null,
          checkOutDate: rr.checkOutDate?.toISODate?.() || null,
          nights: rr.nights,
          adults: rr.adults,
          children: rr.children,
          rateTypeId: rr.rateTypeId,
          rateTypeName: rr.rateType?.rateTypeName,
          bookingSource: res?.bookingSource?.sourceName,
          reservationNumber: res?.reservationNumber,
          status: rr.status,
        }
      })

      // Statistiques (optionnel, comme searchReservations)
      const statistics = {
        totalInHouse: data.length,
        byRoomType: data.reduce((acc: any, curr) => {
          const type = curr.roomTypeName || 'Unknown'
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {}),
      }

      return response.ok({
        success: true,
        count: data.length,
        data,
        statistics,
      })
    } catch (error) {
      console.error('💥 Error filtering reservations:', error)
      return response.status(500).json({
        success: false,
        message: 'Failed to filter reservations',
        error: error.message,
      })
    }
  }
}
