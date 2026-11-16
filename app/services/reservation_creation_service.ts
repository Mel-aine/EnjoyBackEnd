import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'
import Guest from '#models/guest'
import RoomType from '#models/room_type'
import Currency from '#models/currency'
import CurrencyCacheService from '#services/currency_cache_service'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { generateConfirmationNumber } from '../utils/generate_confirmation_number.js'
import ReservationService from '#services/reservation_service'
import ReservationFolioService from '#services/reservation_folio_service'
import LoggerService from '#services/logger_service'
import GuestSummaryService from '#services/guest_summary_service'
import logger from '@adonisjs/core/services/logger'
import { ChannexService } from '../services/channex_service.js'
import ReservationHook from '../hooks/reservation_hooks.js'
import type { ReservationData } from '../types/reservationData.js'
import { FolioStatus, ReservationProductStatus, ReservationStatus, TransactionType, TransactionCategory, WorkflowStatus } from '../enums.js'
import Room from '../models/room.js'
import ReservationRoomService from '#services/reservation_room_service'
import ReservationPenaltyService from '#services/reservation_penalty_service'

/**
 * Interface pour les données d'une chambre de réservation
 */
interface RoomData {
  room_type_id: number
  room_id?: number | null
  adult_count: number
  child_count: number
  room_rate: number
  room_rate_id?: number | null
  rate_type_id?: number | null
  meal_plan_id?: number | null
  taxes?: number
  nights?: number
  checkin_date?: string
  checkout_date?: string
  channex_booking_room_id?: string
  is_cancelled?: boolean
  // Original pricing snapshot from OTA
  original_room_rate?: number
  original_currency_code?: string
  original_exchange_rate?: number
  // Hub OTA only: what the hub sold for this room (nights [from, to) of this room type).
  hub_sold_from?: string
  hub_sold_to?: string
}

/**
 * Interface pour les données d'un invité additionnel
 */
interface AdditionalGuestData {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  guestType?: string
  isAccompanying?: boolean
}

/**
 * Interface principale pour les données de réservation
 */
interface ReservationCreationData {
  // Données obligatoires
  hotel_id: number
  arrived_date: string | Date
  depart_date: string | Date
  created_by: number

  // Données du guest principal
  guest?: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    address?: string
    city?: string
    country?: string
    postalCode?: string
    language?: string
    idType?: string
    idNumber?: string
    passportNumber?: string
    companyName?: string
  }

  // OU guest_id si le guest existe déjà
  guest_id?: number

  // Invités additionnels
  additional_guests?: AdditionalGuestData[]

  // Chambres
  rooms?: RoomData[]

  // Dates et heures
  check_in_time?: string
  check_out_time?: string
  arrived_time?: string
  depart_time?: string

  // Statut
  status?: string

  // Informations de réservation
  reservation_type_id?: number
  booking_source?: number
  business_source?: number
  payment_mod?: number
  market_code_id?: number
  payment_type?: string
  bill_to?: string

  // Montants
  total_amount?: number
  tax_amount?: number
  final_amount?: number
  paid_amount?: number
  remaining_amount?: number

  // Options
  complimentary_room?: boolean
  tax_exempt?: boolean
  isHold?: boolean
  holdReleaseDate?: string
  ReleaseTem?: string
  ReleaseRemindGuestbeforeDays?: number
  ReleaseRemindGuestbefore?: string

  // Transport
  arriving_to?: string
  going_to?: string
  means_of_transportation?: string

  // Channex
  channex_booking_id?: string
  reservation_number?: string
  confirmation_number?: string

  ota_guarantee?: object
  ota_status?: string
  ota_name?: string
  ota_reservation_code?: string
  payment_collect?: string
  ota_commission?: string

  // Hub OTA (local OTAs such as KasaStay). Absent for every other source.
  hub_booking_id?: number
  hub_revision_seq?: number | null

  // Notes
  special_requests?: string
}

/**
 * Interface pour le résultat de création
 */
interface ReservationCreationResult {
  success: boolean
  reservationId?: number
  confirmationNumber?: string
  reservationNumber?: string
  status?: string
  reservationType?: 'day-use' | 'overnight' | 'no-room'
  isDayUse?: boolean
  hasRooms?: boolean
  primaryGuest?: {
    id: number
    name: string
    email: string
  }
  totalGuests?: number
  guests?: Array<{
    id: number
    name: string
    email: string
  }>
  folios?: Array<{
    id: number
    folioNumber: string
    guestId: number
    folioType: string
  }>
  message?: string
  error?: string
  validationErrors?: string[]
  acknowledgedToChannex?: boolean // Nouveau champ pour indiquer si l'accusé a été envoyé
}

/**
 * Service de création de réservations
 * Suit exactement la même logique que saveReservation du controller
 */
export default class ReservationCreationService {
  private static channexService: ChannexService = new ChannexService()
  private static reservationRoomService: ReservationRoomService = new ReservationRoomService()



  /**
   * Envoie un accusé de réception à Channex pour une réservation créée
   */
  public static async sendAcknowledgeToChannex(revisionId: string, reservationId: number, userId: number, ctx?: any): Promise<boolean> {
    try {
      console.log(`📤 [ACKNOWLEDGE] Envoi accusé avec revision_id: ${revisionId}`)

      // Vérifier que le revision_id n'est pas vide
      if (!revisionId || revisionId.trim() === '') {
        throw new Error('Revision ID est vide')
      }

      console.log(`🔍 [ACK DETAILS]`, {
        revision_id: revisionId,
        reservation_id: reservationId,
        url: `/booking_revisions/${revisionId}/ack`
      })

      // ✅ Utilisation du revision_id avec postAcknowledge
      await this.channexService.postAcknowledge(revisionId)

      console.log(`✅ [SUCCESS] Accusé de réception envoyé avec succès pour revision_id: ${revisionId}`)

      // Logger l'action
      if (ctx) {
        await LoggerService.log({
          actorId: userId,
          action: 'CHANNEX_ACKNOWLEDGE_SENT',
          entityType: 'Reservation',
          entityId: reservationId,
          description: `Accusé de réception envoyé à Channex pour la réservation ${reservationId}`,
          meta: {
            channexRevisionId: revisionId,
            reservationId: reservationId
          },
          ctx,
        })
      }

      return true
    } catch (error: any) {
      console.error(`❌ [ACK ERROR] Erreur lors de l'envoi de l'accusé de réception:`, {
        message: error.message,
        revision_id: revisionId,
        reservation_id: reservationId,
        status: error.response?.status,
        data: error.response?.data
      })

      // Logger l'erreur
      if (ctx) {
        await LoggerService.log({
          actorId: userId,
          action: 'CHANNEX_ACKNOWLEDGE_FAILED',
          entityType: 'Reservation',
          entityId: reservationId,
          description: `Échec de l'envoi de l'accusé de réception à Channex pour la réservation ${reservationId}`,
          meta: {
            channexRevisionId: revisionId,
            reservationId: reservationId,
            error: error.message,
            status: error.response?.status,
            responseData: error.response?.data
          },
          ctx,
        })
      }

      return false
    }
  }

  /**
   * Trouve le room_type_id local basé sur channex_room_type_id
   */
  private static async findRoomTypeByChannexId(channexRoomTypeId: string, hotelId: number): Promise<number> {
    try {

      if (!channexRoomTypeId) {
        return await this.getDefaultRoomType(hotelId)
      }

      const roomType = await RoomType.query()
        .where('channex_room_type_id', channexRoomTypeId)
        .andWhere('hotel_id', hotelId)
        .first()

      if (roomType) {
        return roomType.id
      } else {
        // Log pour debug
        const availableMappings = await RoomType.query()
          .where('hotel_id', hotelId)
          .whereNotNull('channex_room_type_id')
          .select('id', 'name', 'channex_room_type_id')

        console.log('📋 Mappings Channex disponibles:', availableMappings)

        return await this.getDefaultRoomType(hotelId)
      }
    } catch (error) {
      console.error('❌ Erreur lors de la recherche du room type:', error)
      return await this.getDefaultRoomType(hotelId)
    }
  }

  /**
   * Récupère un room type par défaut pour l'hôtel
   */
  private static async getDefaultRoomType(hotelId: number): Promise<number> {
    const defaultRoomType = await RoomType.query()
      .where('hotel_id', hotelId)
      .first()

    if (!defaultRoomType) {
      throw new Error(`Aucun room type trouvé pour l'hôtel ${hotelId}`)
    }

    return defaultRoomType.id
  }

  /**
   * Crée une nouvelle réservation avec la même logique que saveReservation
   */
  static async createReservation(
    data: ReservationCreationData,
    ctx?: any
  ): Promise<ReservationCreationResult> {
    const trx = await db.transaction()

    try {
      // === VALIDATION DES DONNÉES OBLIGATOIRES ===
      if (!data.hotel_id || !data.arrived_date || !data.depart_date) {
        await trx.rollback()
        return {
          success: false,
          message: 'Missing required fields: hotel_id, arrived_date, depart_date',
        }
      }

      // === VALIDATION DES DATES ===
      const arrivedDate = DateTime.fromISO(data.arrived_date as string)
      const departDate = DateTime.fromISO(data.depart_date as string)

      if (!arrivedDate.isValid || !departDate.isValid) {
        await trx.rollback()
        return {
          success: false,
          message: 'Invalid date format. Use ISO format (YYYY-MM-DD)',
        }
      }

      // Validation des dates same-day (identique à saveReservation)
      let numberOfNights: number
      if (arrivedDate.toISODate() === departDate.toISODate()) {
        // Day use reservation
        if (!data.check_in_time || !data.check_out_time) {
          await trx.rollback()
          return {
            success: false,
            message: 'For same-day reservations, both arrival and departure times are required',
          }
        }

        const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
        const departureDateTime = DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)

        if (!arrivalDateTime.isValid || !departureDateTime.isValid) {
          await trx.rollback()
          return {
            success: false,
            message: 'Invalid time format. Use HH:mm format',
          }
        }

        if (departureDateTime <= arrivalDateTime) {
          await trx.rollback()
          return {
            success: false,
            message: 'Departure time must be after arrival time for same-day reservations',
          }
        }
        numberOfNights = 0
      } else if (departDate <= arrivedDate) {
        await trx.rollback()
        return {
          success: false,
          message: 'Departure date must be after arrival date',
        }
      } else {
        numberOfNights = Math.ceil(departDate.diff(arrivedDate, 'days').days)
      }

      // === VALIDATION BUSINESS LOGIC VIA SERVICE ===
      const validationErrors = this.validateReservationData(data)
      if (validationErrors.length > 0) {
        await trx.rollback()
        return {
          success: false,
          message: validationErrors.join(', '),
        }
      }

      // === CRÉATION OU RÉCUPÉRATION DU GUEST PRINCIPAL ===
      let guest: Guest

      if (data.guest_id) {
        // Utiliser un guest existant
        const existingGuest = await Guest.query({ client: trx }).where('id', data.guest_id).first()
        if (!existingGuest) {
          await trx.rollback()
          return {
            success: false,
            message: `Guest with ID ${data.guest_id} not found`,
          }
        }
        guest = existingGuest
      } else if (data.guest) {
        // ✅ CORRECTION: Format correct pour createOrFindGuest
        console.log('🔍 [DEBUG] Creating/finding guest with data:', {
          firstName: data.guest.firstName,
          lastName: data.guest.lastName,
          email: data.guest.email
        })

        guest = await ReservationService.createOrFindGuest(
          {
            hotel_id: data.hotel_id,
            first_name: data.guest.firstName,
            last_name: data.guest.lastName,
            email: data.guest.email,
            phone_primary: data.guest.phone,
            address_line: data.guest.address,
            city: data.guest.city,
            country: data.guest.country,
            zipcode: data.guest.postalCode,
            language: data.guest.language,
            idType: data.guest.idType,
            //guest_id_number: data.guest.idNumber,
            //guest_passport_number: data.guest.passportNumber,
            company_name: data.guest.companyName,
            created_by: data.created_by,
          } as ReservationData,
          trx
        )
      } else {
        await trx.rollback()
        return {
          success: false,
          message: 'Either guest_id or guest data must be provided',
        }
      }


      // === GÉNÉRATION DES NUMÉROS ===
      const confirmationNumber = data.confirmation_number || generateConfirmationNumber()
      const reservationNumber = data.reservation_number || generateReservationNumber()

      // === CALCUL DES TOTAUX ===
      const rooms = data.rooms || []
      const totalAdults = rooms.reduce((sum, room) => sum + (room.adult_count || 0), 0)
      const totalChildren = rooms.reduce((sum, room) => sum + (room.child_count || 0), 0)

      // === CRÉATION DE LA RÉSERVATION ===
      const reservation = await Reservation.create(
        {
          hotelId: data.hotel_id,
          userId: data.created_by,
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
          paymentType: data.payment_type,
          channexBookingId: data.channex_booking_id,
          taxExempt: data.tax_exempt,
          isHold: data.isHold,
          otaGuarantee: data.ota_guarantee,
          otaStatus: data.ota_status,
          otaName: data.ota_name,
          otaReservationCode: data.ota_reservation_code,
          paymentCollect: data.payment_collect ?? null,
          otaCommission: data.ota_commission ?? null,
          specialRequests: data.special_requests,
          holdReleaseDate:
            data.isHold && data.holdReleaseDate ? DateTime.fromISO(data.holdReleaseDate) : null,
          releaseRemindGuestbeforeDays: data.isHold ? data.ReleaseRemindGuestbeforeDays : null,
          reservedBy: data.created_by,
          createdBy: data.created_by,
          // Set at creation so that the hub availability push never counts it.
          ...(data.hub_booking_id
            ? { hubBookingId: data.hub_booking_id, hubRevisionSeq: data.hub_revision_seq ?? null }
            : {}),
        },
        { client: trx }
      )

      // Vérifier que la réservation a bien été créée avec un ID
      if (!reservation.id) {
        throw new Error("La réservation n'a pas pu être créée correctement - ID manquant")
      }

      // === TRAITEMENT DES INVITÉS ===
      console.log('🔍 [DEBUG] Processing reservation guests...')
      const { primaryGuest, allGuests } = await ReservationService.processReservationGuests(
        reservation.id,
        {
          // ✅ CORRECTION: Format correct pour processReservationGuests
          hotel_id: data.hotel_id,
          first_name: data.guest?.firstName || guest.firstName,
          last_name: data.guest?.lastName || guest.lastName,
          email: (data.guest?.email || guest.email) ?? '',
          phone_primary: data.guest?.phone,
          created_by: data.created_by,
          // Si vous avez des invités additionnels, passez-les dans le format attendu
          guests: data.additional_guests?.map(guest => ({
            first_name: guest.firstName,
            last_name: guest.lastName,
            email: guest.email || `additional_${Date.now()}@guest.placeholder`,
            phone_primary: guest.phone,
            guest_type: (guest.guestType as "adult" | "child" | "infant" | undefined) ?? 'adult',
            is_primary: false,
          })) || [],
        } as ReservationData,
        trx
      )

      // === MISE À JOUR DU GUEST_ID ===
      await reservation.merge({ guestId: primaryGuest.id }).useTransaction(trx).save()

      // === CRÉATION DES RESERVATION ROOMS ===
      if (rooms.length > 0) {
        // Track assigned rooms in this transaction to prevent double booking
        const assignedRoomIds = new Set<number>()
        // Pre-populate with manually assigned rooms
        rooms.forEach((r) => {
          if (r.room_id) assignedRoomIds.add(r.room_id)
        })

        for (let index = 0; index < rooms.length; index++) {
          const room = rooms[index]

          // Auto-assign room if not provided
          if (!room.room_id) {
            try {
              const availableRooms = await this.reservationRoomService.findAvailableRooms(
                data.hotel_id,
                arrivedDate.toJSDate(),
                departDate.toJSDate(),
                room.room_type_id
              )

              // Find first available room that is not already assigned in this batch
              const freeRoom = availableRooms.find((r) => !assignedRoomIds.has(r.id))

              if (freeRoom) {
                console.log(
                  `✅ [AUTO-ASSIGN] Auto-assigned room ${freeRoom.roomNumber} (ID: ${freeRoom.id}) to reservation`
                )
                room.room_id = freeRoom.id
                assignedRoomIds.add(freeRoom.id)
              } else {
                console.log(
                  `⚠️ [AUTO-ASSIGN] No available room found for room type ${room.room_type_id}`
                )
              }
            } catch (err) {
              console.error('❌ [AUTO-ASSIGN] Error finding available room:', err)
            }
          }

          await ReservationRoom.create(
            {
              reservationId: reservation.id,
              roomTypeId: room.room_type_id,
              roomId: room.room_id || null,
              rateTypeId: room.rate_type_id,
              guestId: primaryGuest.id,
              checkInDate: DateTime.fromISO(data.arrived_date as string),
              checkOutDate: DateTime.fromISO(data.depart_date as string),
              checkInTime: data.check_in_time,
              checkOutTime: data.check_out_time,
              totalAmount: room.room_rate * numberOfNights,
              nights: numberOfNights,
              adults: room.adult_count,
              children: room.child_count,
              roomRate: room.room_rate,
              originalRoomRate: room.original_room_rate ?? null,
              originalCurrencyCode: room.original_currency_code ?? null,
              originalExchangeRate: room.original_exchange_rate ?? null,
              ...(room.hub_sold_from && room.hub_sold_to
                ? {
                    hubSoldFrom: DateTime.fromISO(room.hub_sold_from),
                    hubSoldTo: DateTime.fromISO(room.hub_sold_to),
                    hubRoomTypeId: room.room_type_id,
                  }
                : {}),
              roomRateId: room.room_rate_id,
              paymentMethodId: data.payment_mod,
              hotelId: data.hotel_id,
              totalRoomCharges: numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights,
              taxAmount: room.taxes || 0,
              totalTaxesAmount: numberOfNights === 0 ? (room.taxes || 0) : (room.taxes || 0) * numberOfNights,
              netAmount:
                (numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights) +
                (numberOfNights === 0 ? (room.taxes || 0) : (room.taxes || 0) * numberOfNights),
              status: numberOfNights === 0 ? 'day_use' : 'reserved',
              mealPlanId: room.meal_plan_id,
              isOwner: index === 0,
              reservedByUser: data.created_by,
              createdBy: data.created_by,
            },
            { client: trx }
          )
        }
      }

      // === LOGGING ===
      const guestCount = allGuests.length
      const guestDescription =
        guestCount > 1
          ? `${primaryGuest.firstName} ${primaryGuest.lastName} and ${guestCount - 1} other guest(s)`
          : `${primaryGuest.firstName} ${primaryGuest.lastName}`

      const reservationTypeDescription =
        numberOfNights === 0 ? 'day-use' : rooms.length === 0 ? 'no-room' : 'overnight'

      if (ctx) {
        await LoggerService.log({
          actorId: data.created_by,
          action: 'CREATE',
          entityType: 'Reservation',
          entityId: reservation.id,
          hotelId: reservation.hotelId,
          description: `${reservationTypeDescription} reservation #${reservation.id} was created for ${guestDescription} (${guestCount} total guests)${rooms.length === 0 ? ' without room assignment' : ''}.`,
          ctx,
        })

        await LoggerService.log({
          actorId: data.created_by,
          action: 'RESERVATION_CREATED',
          entityType: 'Guest',
          entityId: guest.id,
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
        })
      }
      /// After the comming notify the booking for the nes update data
      await trx.commit().then(() => {
        try {
          ReservationHook.notifyAvailabilityOnCreate(reservation)
        } catch {
        }
      })

      try {
        const NotificationService = (await import('#services/notification_service')).default

        // Déterminer si c'est une réservation OTA
        const isOtaReservation =  !!data.channex_booking_id || !!data.hub_booking_id

        // Notification principale selon le type
        let notificationTemplateCode = isOtaReservation
          ? 'NEW_OTA_BOOKING'
          : 'RESERVATION_CREATED'

        const variables = await NotificationService.buildVariables(notificationTemplateCode, {
          hotelId: reservation.hotelId,
          guestId: primaryGuest.id,
          reservationId: reservation.id,
          extra: {
            ReservationNumber: reservation.reservationNumber || '',
            ConfirmationNumber: confirmationNumber,
            GuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
            ArrivalDate: arrivedDate.toISODate(),
            DepartureDate: departDate.toISODate(),
            NumberOfNights: numberOfNights,
            TotalAmount: reservation.totalAmount || 0,
            RoomCount: rooms.length,
            GuestCount: guestCount,
            OtaName: data.ota_name || 'Channel Manager',
            OtaCode: data.ota_reservation_code || data.channex_booking_id || '',
            OtaStatus: data.ota_status || '',
            Status: reservation.status,
            SpecialRequests: data.special_requests || '',
          },
        })

        await NotificationService.sendWithTemplate({
          templateCode: notificationTemplateCode,
          recipientType: 'STAFF',
          recipientId: data.created_by,
          variables,
          relatedEntityType: 'Reservation',
          relatedEntityId: reservation.id,
          actorId: data.created_by,
          hotelId: reservation.hotelId,
        })

        // Notification au client (confirmation)
        if (primaryGuest.email) {
          const guestVariables = await NotificationService.buildVariables('RESERVATION_CONFIRMATION_GUEST', {
            hotelId: reservation.hotelId,
            guestId: primaryGuest.id,
            reservationId: reservation.id,
            extra: {
              ReservationNumber: reservation.reservationNumber || '',
              ConfirmationNumber: confirmationNumber,
              GuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
              ArrivalDate: arrivedDate.toISODate(),
              DepartureDate: departDate.toISODate(),
              NumberOfNights: numberOfNights,
              TotalAmount: reservation.totalAmount || 0,
              SpecialRequests: data.special_requests || '',
            },
          })

          await NotificationService.sendWithTemplate({
            templateCode: 'RESERVATION_CONFIRMATION_GUEST',
            recipientType: 'GUEST',
            recipientId: primaryGuest.id,
            variables: guestVariables,
            relatedEntityType: 'Reservation',
            relatedEntityId: reservation.id,
            actorId: data.created_by,
            hotelId: reservation.hotelId,
          })
        }


        // Alerte si statut "pending"
        if (reservation.status === 'pending') {
          const pendingVariables = await NotificationService.buildVariables('RESERVATION_PENDING', {
            hotelId: reservation.hotelId,
            reservationId: reservation.id,
            extra: {
              ReservationNumber: reservation.reservationNumber || '',
              GuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
              OtaName: data.ota_name || 'OTA',
              ArrivalDate: arrivedDate.toISODate(),
            },
          })

          await NotificationService.sendWithTemplate({
            templateCode: 'RESERVATION_PENDING',
            recipientType: 'STAFF',
            recipientId: data.created_by,
            variables: pendingVariables,
            relatedEntityType: 'Reservation',
            relatedEntityId: reservation.id,
            actorId: data.created_by,
            hotelId: reservation.hotelId,
          })
        }



      } catch (notifError) {
        console.warn('Erreur notifications OTA:', (notifError as any)?.message)
      }
      // === CRÉATION DES FOLIOS (après commit) ===
      let folios: any[] = []
      if (rooms.length > 0) {
        folios = await ReservationFolioService.createFoliosOnConfirmation(
          reservation.id,
          data.created_by
        )

        if (ctx && folios.length > 0) {
          await LoggerService.log({
            actorId: data.created_by,
            action: 'CREATE_FOLIOS',
            entityType: 'Reservation',
            entityId: reservation.id,
            hotelId: reservation.hotelId,
            description: `Created ${folios.length} folio(s) with room charges for confirmed reservation #${reservation.id}.`,
            ctx,
          })

          await LoggerService.log({
            actorId: data.created_by,
            action: 'FOLIOS_CREATED',
            entityType: 'Guest',
            entityId: guest.id,
            hotelId: reservation.hotelId,
            description: `${folios.length} folio(s) were created for reservation #${reservation.reservationNumber}.`,
            meta: {
              reservationId: reservation.id,
              folioIds: folios.map((f) => f.id),
            },
            ctx,
          })
        }
      }

      // === RECOMPUTE GUEST SUMMARY ===
      await GuestSummaryService.recomputeFromReservation(reservation.id)

      // === RÉSULTAT ===
      const result: ReservationCreationResult = {
        success: true,
        reservationId: reservation.id,
        confirmationNumber,
        reservationNumber,
        status: reservation.status,
        reservationType: reservationTypeDescription as any,
        isDayUse: numberOfNights === 0,
        hasRooms: rooms.length > 0,
        primaryGuest: {
          id: primaryGuest.id,
          name: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
          email: primaryGuest.email ?? '',
        },
        totalGuests: allGuests.length,
        guests: allGuests.map((g) => ({
          id: g.id,
          name: `${g.firstName} ${g.lastName}`,
          email: g.email ?? '',
        })),
        message: `${reservationTypeDescription} reservation created successfully with ${allGuests.length} guest(s)${rooms.length === 0 ? ' (no room assigned)' : ''}`,
      }

      // Add folio information if folios were created
      if (folios.length > 0) {
        result.folios = folios.map((folio) => ({
          id: folio.id,
          folioNumber: folio.folioNumber,
          guestId: folio.guestId,
          folioType: folio.folioType,
        }))
        result.message += ` and ${folios.length} folio(s) with room charges`
      }

      return result
    } catch (error) {
      await trx.rollback()
      logger.error('Error in ReservationCreationService:', error)
      console.error('💥 [ERROR] Detailed error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        data: data
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Valide les données de réservation (identique à saveReservation)
   */
  private static validateReservationData(data: ReservationCreationData): string[] {
    const errors: string[] = []

    if (!data.hotel_id) {
      errors.push('hotel_id is required')
    }

    if (!data.arrived_date) {
      errors.push('arrived_date is required')
    }

    if (!data.depart_date) {
      errors.push('depart_date is required')
    }

    if (!data.created_by) {
      errors.push('created_by is required')
    }

    if (!data.guest_id && !data.guest) {
      errors.push('Either guest_id or guest data must be provided')
    }

    /*if (data.guest && (!data.guest.firstName || !data.guest.lastName || !data.guest.email)) {
      errors.push('Guest firstName, lastName, and email are required')
    }*/

    return errors
  }

  /**
   * Méthode helper pour créer une réservation depuis Channex
   */
  static async createFromChannex(
    channexBooking: any,
    hotelId: number,
    userId: number,
    ctx?: any
  ): Promise<ReservationCreationResult> {
    try {

      const bookingData = channexBooking.attributes || channexBooking
      const revisionId = channexBooking.id
      const bookingId = channexBooking.id

      // CORRECTION: Utilisation sécurisée de mapChannexStatus
      const mappedStatus = this.mapChannexStatus(bookingData.status)

      //  CORRECTION: Validation robuste des données client
      const customer = bookingData.customer || {}
      const customerName = customer.name || customer.first_name
      const customerSurname = customer.surname || customer.last_name
      const customerEmail = customer.mail || customer.email
      const customerPhone = customer.phone || null


      // === CURRENCY CONVERSION SETUP ===
      // Normalize currency codes to uppercase and prefer cached default currency for the hotel
      const defaultCurrencyPayload = await CurrencyCacheService.getHotelDefaultCurrency(hotelId)
      const baseCurrencyCode = (defaultCurrencyPayload?.currencyCode || '').toUpperCase()
      const rawBookingCurrency = bookingData.currency?.toUpperCase()
      const isCrossRate = !!rawBookingCurrency && rawBookingCurrency !== baseCurrencyCode
      let exchangeRate = 1
      if (isCrossRate) {
        const sourceCurrency = await Currency.query()
          .where('hotelId', hotelId)
          .where('currencyCode', rawBookingCurrency)
          .select('exchangeRate', 'currencyCode')
          .first();
        exchangeRate = sourceCurrency?.exchangeRate || 1
      }


      // ✅ Transformation AVEC MAPPING des chambres + conversion des montants
      const roomsData = bookingData.rooms || bookingData.unit_assignments || []

      const rooms = await Promise.all(
        roomsData.map(async (room: any) => {
          try {
            const preloaded = ctx?.preloaded || {}
            const channexRoomTypeId: string | undefined = room.room_type_id
            const channexRatePlanId: string | undefined = room.rate_plan_id || room.rate_plan

            // Compute nights for the room (falls back to booking dates)
            const checkinStr = room.checkin_date || bookingData.arrival_date
            const checkoutStr = room.checkout_date || bookingData.departure_date
            const checkinDt = DateTime.fromISO(checkinStr)
            const checkoutDt = DateTime.fromISO(checkoutStr)
            const nights = checkinDt.isValid && checkoutDt.isValid
              ? Math.max(0, Math.ceil(checkoutDt.diff(checkinDt, 'days').days))
              : undefined

            // Resolve local room_type_id from preloaded map if available, otherwise fallback to DB lookup
            let localRoomTypeId: number
            const roomTypeMap: Map<string, number> | undefined = preloaded.roomTypeByChannexId
            if (roomTypeMap && channexRoomTypeId && roomTypeMap.has(channexRoomTypeId)) {
              localRoomTypeId = roomTypeMap.get(channexRoomTypeId) as number
            } else if (channexRoomTypeId) {
              localRoomTypeId = await this.findRoomTypeByChannexId(channexRoomTypeId, hotelId)
            } else {
              throw new Error(`No room type found for Channex room type ID: ${channexRoomTypeId}`)
            }

            // Resolve room_rate_id and rate_type_id from preloaded room rate map if available
            let roomRateId: number | null = null
            let rateTypeId: number | null = null
            const roomRateMap: Map<string, { roomRateId: number; rateTypeId: number }> | undefined = preloaded.roomRateByChannexRateId
            if (roomRateMap && channexRatePlanId && roomRateMap.has(channexRatePlanId)) {
              const mapped = roomRateMap.get(channexRatePlanId)!
              roomRateId = mapped.roomRateId
              rateTypeId = mapped.rateTypeId
            }

            // Derive nightly rate: use first day amount if provided, otherwise total/nights
            const totalStayAmountSrc = parseFloat(room.amount ?? room.rate ?? '0')
            let firstDayAmountSrc: number | undefined
            if (Array.isArray(room.days) && room.days.length > 0) {
              firstDayAmountSrc = parseFloat(room.days[0]?.amount ?? room.days[0]?.rate ?? '0')
            } else if (room.days && typeof room.days === 'object') {
              const dayKeys = Object.keys(room.days as Record<string, any>)
              if (dayKeys.length > 0) {
                // Use earliest date key (ISO date strings sort chronologically)
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

            return {
              room_type_id: localRoomTypeId,
              room_rate_id: roomRateId ?? undefined,
              rate_type_id: rateTypeId ?? undefined,
              adult_count: room.occupancy?.adults || 0,
              child_count: room.occupancy?.children || 0,
              room_rate: exchangeRate * nightlyRateSrc,
              taxes: room.taxes !== undefined ? exchangeRate * parseFloat(`${room.taxes}`) : undefined,
              checkin_date: checkinStr,
              checkout_date: checkoutStr,
              nights: nights,
              channex_booking_room_id: room.booking_room_id || room.id,
              is_cancelled: room.is_cancelled || false,
              original_room_rate: nightlyRateSrc,
              original_currency_code: rawBookingCurrency ?? baseCurrencyCode,
              original_exchange_rate: isCrossRate ? exchangeRate : 1,
            }
          } catch (roomError: any) {
          }
        })
      )

      // Mapper les données Channex vers notre format
      const reservationData: ReservationCreationData = {
        hotel_id: hotelId,
        arrived_date: bookingData.arrival_date,
        depart_date: bookingData.departure_date,
        created_by: userId,
        check_in_time: bookingData.arrival_hour ?? "14:00",
        check_out_time: '12:00',
        ota_guarantee: bookingData.guarantee,
        ota_status: bookingData.status,
        ota_name: bookingData.ota_name,
        ota_reservation_code: bookingData.ota_reservation_code,
        payment_collect: bookingData.payment_collect ?? null,
        ota_commission: bookingData.ota_commission ?? null,


        // ✅ CORRECTION: Données client sécurisées
        guest: {
          firstName: customerName,
          lastName: customerSurname,
          email: customerEmail,
          phone: customerPhone,
          address: customer.address,
          city: customer.city,
          country: customer.country,
          postalCode: customer.zip,
          language: customer.language,
        },

        // ✅ CORRECTION: Chambres transformées AVEC MAPPING
        rooms: rooms,

        // ✅ CORRECTION: Utilisation du statut mappé
        status: mappedStatus,
        total_amount: exchangeRate * parseFloat(bookingData.amount || '0'),
        special_requests: bookingData.notes,
        payment_type: bookingData.payment_type,
        channex_booking_id: bookingId,
        reservation_number: bookingData.unique_id,
      }

      // Créer la réservation
      const creationResult = await this.createReservation(reservationData, ctx)

      // ✅ CORRECTION: ENVOYER L'ACCUSÉ AVEC LE REVISION_ID
      if (creationResult.success && creationResult.reservationId) {
        // Mettre à jour la devise de la réservation vers la devise par défaut de l'hôtel
        try {
          const createdReservation = await Reservation.find(creationResult.reservationId)
          if (createdReservation) {
            await createdReservation
              .merge({ currencyCode: baseCurrencyCode, exchangeRate: exchangeRate })
              .save()
          }
        } catch (currencySaveErr) {
          console.warn('⚠️ [CURRENCY] Impossible de mettre à jour la devise de la réservation:', currencySaveErr)
        }

        if (revisionId) {
          const acknowledged = await this.sendAcknowledgeToChannex(
            revisionId, // ← UTILISER LE REVISION_ID ICI
            creationResult.reservationId,
            userId,
            ctx
          )

          // Ajouter l'information d'accusé au résultat
          creationResult.acknowledgedToChannex = acknowledged

          if (acknowledged) {
            creationResult.message += ' (Accusé de réception envoyé à Channex)'
            console.log(`✅ [SUCCESS] Accusé de réception réussi avec revision_id: ${revisionId}`)
          } else {
            creationResult.message += ' (Échec envoi accusé de réception à Channex)'
            console.warn(`⚠️ [FAILED] Accusé échoué avec revision_id: ${revisionId}`)
          }
        } else {
          console.warn('❌ [SKIP] Aucun revision_id trouvé dans les données Channex')
          creationResult.message += ' (Aucun revision_id pour accusé)'
          creationResult.acknowledgedToChannex = false
        }
      }

      return creationResult
    } catch (error) {
      return {
        success: false,
        error: `Failed to process Channex booking: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Mapper le statut Channex vers notre statut - VERSION ULTRA SÉCURISÉE
   */
  private static mapChannexStatus(channexStatus: any): string {
    try {
      // ✅ Vérification de sécurité complète
      if (channexStatus === null || channexStatus === undefined) {
        console.warn('⚠️ Statut Channex manquant, utilisation de "confirmed" par défaut')
        return 'confirmed'
      }

      // ✅ Conversion sécurisée en string
      const statusString = String(channexStatus).trim()
      if (!statusString) {
        console.warn('⚠️ Statut Channex vide, utilisation de "confirmed" par défaut')
        return 'confirmed'
      }

      const statusMapping: Record<string, string> = {
        'new': 'confirmed',
        'modified': 'confirmed',
        'cancelled': 'cancelled',
      }

      // ✅ Conversion sécurisée en lowercase
      const normalizedStatus = statusString.toLowerCase()
      const mappedStatus = statusMapping[normalizedStatus] || 'confirmed'

      console.log('🔍 [DEBUG] Status mapping result:', {
        original: channexStatus,
        normalized: normalizedStatus,
        mapped: mappedStatus
      })

      return mappedStatus
    } catch (error) {
      console.error('💥 [ERROR] Error in mapChannexStatus:', error, 'Input:', channexStatus)
      return 'confirmed' // Fallback sécurisé
    }
  }

  public static async cancelReservation(reservation: Reservation, userId: number,reason:string, ctx?: any, cancellationFeeAmount?: number, feeTaxInclusive = false) {
    // If OTA status indicates total cancellation, mirror controller cancelReservation
    const cancelledRooms: string[] = []
    // Cancel all reservation rooms
    for (const resRoom of reservation.reservationRooms) {
      if (resRoom.status !== ReservationProductStatus.CANCELLED) {
        resRoom.status = ReservationProductStatus.CANCELLED
        resRoom.lastModifiedBy = userId!
        await resRoom.save()

        const room = await Room.find(resRoom.roomId)
        if (room) {
          room.status = 'available'
          room.lastModifiedBy = userId!
          await room.save()
          cancelledRooms.push(room.roomNumber)
        }

        await LoggerService.log({
          actorId: userId!,
          action: 'CANCEL',
          entityType: 'ReservationRoom',
          entityId: resRoom.id,
          hotelId: reservation.hotelId,
          description: `Room ${room?.roomNumber ?? '-'} from reservation #${reservation.reservationNumber} was cancelled via Channex sync.`,
          meta: { reason: reason },
          ctx: ctx,
        })
      }
    }

    // Close folios and cancel transactions
    let foliosClosed = 0
    let transactionsCancelled = 0
    const existingPenalty = cancellationFeeAmount !== undefined
      ? await ReservationPenaltyService.reconcileOtaPenalty(
        reservation.folios.map((folio) => folio.id), TransactionCategory.CANCELLATION_FEE,
        cancellationFeeAmount, userId, feeTaxInclusive
      ) : undefined
    let cancellationFeePosted = !!existingPenalty
    // enjoy closes a folio as soon as it is created (see TransactionHook), so a
    // reservation often has no open folio: the OTA fee then goes on its closed
    // folio, which its new balance reopens. Before, the fee was silently lost.
    const feeFolio =
      reservation.folios.find((f) => f.status === FolioStatus.OPEN) ??
      reservation.folios.find((f) => f.status === FolioStatus.CLOSED)
    for (const folio of reservation.folios) {
      {
        // Post cancellation fee transaction BEFORE closing the folio
        if (
          folio === feeFolio &&
          !cancellationFeePosted &&
          cancellationFeeAmount &&
          cancellationFeeAmount > 0
        ) {
          try {
            const FolioService = (await import('../services/folio_service.js')).default
            await FolioService.postTransaction({
              folioId: folio.id,
              transactionType: TransactionType.CHARGE,
              category: TransactionCategory.CANCELLATION_FEE,
              description: 'Cancellation Fee',
              amount: cancellationFeeAmount,
              quantity: 1,
              unitPrice: cancellationFeeAmount,
              taxAmount: feeTaxInclusive ? 0 : undefined,
              notes: `Cancellation fee charged per OTA booking revision. Reason: ${reason || 'N/A'}`,
              postedBy: userId,
              transactionDate: DateTime.now(),
            })
            cancellationFeePosted = true
            await LoggerService.log({
              actorId: userId,
              action: 'CANCELLATION_FEE_POSTED',
              entityType: 'FolioTransaction',
              entityId: folio.id,
              hotelId: reservation.hotelId,
              description: `Cancellation fee of ${cancellationFeeAmount} posted to folio ${folio.id} for reservation #${reservation.reservationNumber}`,
              meta: { folioId: folio.id, cancellationFeeAmount, reservationId: reservation.id },
              ctx,
            })
          } catch (feeErr) {
            await LoggerService.log({
              actorId: userId,
              action: 'CANCELLATION_FEE_FAILED',
              entityType: 'FolioTransaction',
              entityId: folio.id,
              hotelId: reservation.hotelId,
              description: `Failed to post cancellation fee to folio ${folio.id}: ${(feeErr as any)?.message}`,
              meta: { error: (feeErr as any)?.message, folioId: folio.id, cancellationFeeAmount },
              ctx,
            })
          }
        }

        if (folio.status === FolioStatus.OPEN) {
          folio.status = FolioStatus.CLOSED
          folio.workflowStatus = WorkflowStatus.FINALIZED
          folio.closedDate = DateTime.now()
          folio.closedBy = userId!
          folio.lastModifiedBy = userId!
          await folio.save()
          foliosClosed++
        }
      }
      transactionsCancelled += await ReservationPenaltyService.voidCharges(
        folio.id, TransactionCategory.CANCELLATION_FEE, userId, reason || 'Channex cancellation'
      )
    }

    const cancelledList = cancelledRooms.length > 0 ? `[${cancelledRooms.join(', ')}]` : '(none)'
    await LoggerService.log({
      actorId: userId!,
      action: 'CANCEL',
      entityType: 'Reservation',
      entityId: reservation.id,
      hotelId: reservation.hotelId,
      description: `Reservation #${reservation.reservationNumber} cancelled via Channex sync. Rooms: ${cancelledList}. Reason: ${reason || 'N/A'}.`,
      meta: { cancelledRooms, foliosClosed, transactionsCancelled },
      ctx: ctx,
    })

    // Mark reservation cancelled
    await reservation
      .merge({
        status: ReservationStatus.CANCELLED,
        cancellationReason: reason,
        cancellationDate: DateTime.now(),
        lastModifiedBy: userId!,
      })
      .save()

       try {
    const NotificationService = (await import('#services/notification_service')).default

    // Précharger le guest si nécessaire
    if (!reservation.guest) {
      await reservation.load('guest')
    }

    const guestName = reservation.guest
      ? `${reservation.guest.firstName || ''} ${reservation.guest.lastName || ''}`.trim()
      : 'Guest'

    const isOtaCancellation = !!reservation.otaName || !!reservation.otaReservationCode

    //  Notification STAFF - Annulation OTA
    try {
      const staffTemplateCode = isOtaCancellation
        ? 'OTA_CANCELLATION'
        : 'RESERVATION_CANCELLED'

      const staffVariables = await NotificationService.buildVariables(staffTemplateCode, {
        hotelId: reservation.hotelId,
        reservationId: reservation.id,
        guestId: reservation.guestId,
        extra: {
          ReservationNumber: reservation.reservationNumber || 'N/A',
          GuestName: guestName,
          DepartureDate: reservation.departDate?.toISODate() || 'N/A',
          ArrivalDate: reservation.arrivedDate?.toISODate() || 'N/A',
          CancellationDate: DateTime.now().toISODate(),
          CancelledRooms: cancelledList,
          CancellationReason: reason || 'Cancelled by OTA',
          OtaName: reservation.otaName || 'Channel Manager',
          OtaCode: reservation.otaReservationCode || '',
          TotalRoomsCancelled: cancelledRooms.length,
          FoliosClosed: foliosClosed,
          TransactionsCancelled: transactionsCancelled,
        },
      })

      await NotificationService.sendWithTemplate({
        templateCode: staffTemplateCode,
        recipientType: 'STAFF',
        recipientId: userId,
        variables: staffVariables,
        relatedEntityType: 'Reservation',
        relatedEntityId: reservation.id,
        actorId: userId,
        hotelId: reservation.hotelId,
      })
    } catch (staffError) {
      console.error(' Erreur notification STAFF OTA:', (staffError as any)?.message)
    }
    // Notification GUEST - Confirmation d'annulation
    if (reservation.guest && reservation.guest.email) {
      try {
        const guestTemplateCode = isOtaCancellation
          ? 'RESERVATION_CANCELLED_GUEST_OTA'
          : 'RESERVATION_CANCELLED_GUEST'

        const guestVariables = await NotificationService.buildVariables(guestTemplateCode, {
          hotelId: reservation.hotelId,
          reservationId: reservation.id,
          guestId: reservation.guestId!,
          extra: {
            ReservationNumber: reservation.reservationNumber || 'N/A',
            GuestName: guestName,
            CancellationDate: DateTime.now().toISODate(),
             DepartureDate: reservation.departDate?.toISODate() || 'N/A',
             ArrivalDate: reservation.arrivedDate?.toISODate() || 'N/A',
            CancelledRooms: cancelledList,
            CancellationReason: reason || 'Cancelled by OTA',
            OtaName: reservation.otaName || 'Channel Manager',
            OtaCode: reservation.otaReservationCode || '',
          },
        })

        await NotificationService.sendWithTemplate({
          templateCode: guestTemplateCode,
          recipientType: 'GUEST',
          recipientId: reservation.guestId!,
          variables: guestVariables,
          relatedEntityType: 'Reservation',
          relatedEntityId: reservation.id,
          actorId: userId,
          hotelId: reservation.hotelId,
        })
      } catch (guestError) {
        console.error(' Erreur notification GUEST OTA:', (guestError as any)?.message)
      }
    }
  } catch (notifError) {
    console.error(' Erreur générale dans les notifications d\'annulation:', (notifError as any)?.message)
  }


    // Recompute guest summary
    await GuestSummaryService.recomputeFromReservation(reservation.id)
  }
}
