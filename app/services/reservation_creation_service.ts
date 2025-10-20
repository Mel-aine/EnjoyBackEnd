import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'
import Guest from '#models/guest'
import Room from '#models/room'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { generateConfirmationNumber } from '../utils/generate_confirmation_number.js'
import ReservationService from '#services/reservation_service'
import ReservationFolioService from '#services/reservation_folio_service'
import LoggerService from '#services/logger_service'
import GuestSummaryService from '#services/guest_summary_service'
import logger from '@adonisjs/core/services/logger'

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
}

/**
 * Service de création de réservations
 * Suit exactement la même logique que saveReservation du controller
 */
export default class ReservationCreationService {
  /**
   * Crée une nouvelle réservation avec la même logique que saveReservation
   */
  static async createReservation(
    data: ReservationCreationData,
    ctx?: any
  ): Promise<ReservationCreationResult> {
    const trx = await db.transaction()

    console.log('data.receive@@@', data)

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
            first_name: data.guest.firstName || 'Unknown',
            last_name: data.guest.lastName || 'Guest',
            email: data.guest.email || `guest_${Date.now()}@channex.placeholder`,
            phone_primary: data.guest.phone,
            address_line: data.guest.address,
            city: data.guest.city,
            country: data.guest.country,
            zipcode: data.guest.postalCode,
            guest_language: data.guest.language,
            guest_id_type: data.guest.idType,
            guest_id_number: data.guest.idNumber,
            guest_passport_number: data.guest.passportNumber,
            company_name: data.guest.companyName,
            created_by: data.created_by,
          },
          trx
        )
      } else {
        await trx.rollback()
        return {
          success: false,
          message: 'Either guest_id or guest data must be provided',
        }
      }

      console.log('🔍 [DEBUG] Guest processed successfully:', guest.id)

      // === GÉNÉRATION DES NUMÉROS ===
      const confirmationNumber = data.confirmation_number || generateConfirmationNumber()
      const reservationNumber = data.reservation_number || generateReservationNumber()

      // === CALCUL DES TOTAUX ===
      const rooms = data.rooms || []
      const totalAdults = rooms.reduce((sum, room) => sum + (room.adult_count || 0), 0)
      const totalChildren = rooms.reduce((sum, room) => sum + (room.child_count || 0), 0)

      // === VALIDATION DE LA DISPONIBILITÉ DES CHAMBRES ===
      if (rooms.length > 0) {
        const roomIds = rooms.map((r) => r.room_id).filter((id): id is number => Boolean(id))

        if (roomIds.length > 0) {
          let existingReservationsQuery = ReservationRoom.query({ client: trx })
            .whereIn('roomId', roomIds)
            .where('status', 'reserved')

          if (arrivedDate.toISODate() === departDate.toISODate()) {
            // Cas same-day (day use) → check overlap par heures
            const arrivalDateTime = DateTime.fromISO(`${data.arrived_date}T${data.check_in_time}`)
            const departureDateTime = DateTime.fromISO(`${data.depart_date}T${data.check_out_time}`)

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
              query
                .whereBetween('checkInDate', [arrivedDate.toISODate(), departDate.toISODate()])
                .orWhereBetween('checkOutDate', [arrivedDate.toISODate(), departDate.toISODate()])
                .orWhere((overlapQuery) => {
                  overlapQuery
                    .where('checkInDate', '<=', arrivedDate.toISODate())
                    .where('checkOutDate', '>=', departDate.toISODate())
                })
            })
          }

          const existingReservations = await existingReservationsQuery

          if (existingReservations.length > 0) {
            await trx.rollback()
            return {
              success: false,
              message: 'One or more rooms are not available for the selected dates/times',
              conflicts: existingReservations.map((r) => ({
                roomId: r.roomId,
                checkInDate: r.checkInDate,
                checkOutDate: r.checkOutDate,
                checkInTime: r.checkInTime,
                checkOutTime: r.checkOutTime,
              })),
            }
          }
        }
      }

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
          taxExempt: data.tax_exempt,
          isHold: data.isHold,
          holdReleaseDate:
            data.isHold && data.holdReleaseDate ? DateTime.fromISO(data.holdReleaseDate) : null,
          releaseTem: data.isHold ? data.ReleaseTem : null,
          releaseRemindGuestbeforeDays: data.isHold ? data.ReleaseRemindGuestbeforeDays : null,
          releaseRemindGuestbefore: data.isHold ? data.ReleaseRemindGuestbefore : null,
          reservedBy: data.created_by,
          createdBy: data.created_by,
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
          email: data.guest?.email || guest.email,
          phone_primary: data.guest?.phone,
          created_by: data.created_by,
          // Si vous avez des invités additionnels, passez-les dans le format attendu
          guests: data.additional_guests?.map(guest => ({
            first_name: guest.firstName,
            last_name: guest.lastName,
            email: guest.email || `additional_${Date.now()}@guest.placeholder`,
            phone_primary: guest.phone,
            guest_type: guest.guestType || 'adult',
            is_primary: false,
          })) || [],
        },
        trx
      )

      console.log('🔍 [DEBUG] Guests processed:', allGuests.length)

      // === MISE À JOUR DU GUEST_ID ===
      await reservation.merge({ guestId: primaryGuest.id }).useTransaction(trx).save()

      // === CRÉATION DES RESERVATION ROOMS ===
      if (rooms.length > 0) {
        for (let index = 0; index < rooms.length; index++) {
          const room = rooms[index]

          await ReservationRoom.create(
            {
              reservationId: reservation.id,
              roomTypeId: room.room_type_id,
              roomId: room.room_id || null,
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
              rateTypeId: room.rate_type_id,
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

      await trx.commit()

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

    if (data.guest && (!data.guest.firstName || !data.guest.lastName || !data.guest.email)) {
      errors.push('Guest firstName, lastName, and email are required')
    }

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
      console.log('🔍 [DEBUG] Processing Channex booking:', {
        id: channexBooking.id,
        status: channexBooking.attributes?.status,
        customer: channexBooking.attributes?.customer
      })

      const bookingData = channexBooking.attributes || channexBooking

      // ✅ CORRECTION: Utilisation sécurisée de mapChannexStatus
      const mappedStatus = this.mapChannexStatus(bookingData.status)

      // ✅ CORRECTION: Validation robuste des données client
      const customer = bookingData.customer || {}
      const customerName = customer.name || 'Unknown'
      const customerSurname = customer.surname || 'Guest'
      const customerEmail = customer.mail || `guest_${channexBooking.id}@channex.placeholder`
      const customerPhone = customer.phone || null

      console.log('🔍 [DEBUG] Customer data processed:', {
        name: customerName,
        surname: customerSurname,
        email: customerEmail,
        phone: customerPhone
      })

      // ✅ CORRECTION: Validation et transformation des chambres
      const rooms = (bookingData.rooms || []).map((room: any, index: number) => {
        console.log(`🔍 [DEBUG] Processing room ${index + 1}:`, {
          room_type_id: room.room_type_id,
          adult_count: room.occupancy?.adults || 0,
          amount: room.amount
        })

        return {
          room_type_id: room.room_type_id,
          adult_count: room.occupancy?.adults || 0,
          child_count: room.occupancy?.children || 0,
          room_rate: parseFloat(room.amount || '0'),
          checkin_date: room.checkin_date,
          checkout_date: room.checkout_date,
          channex_booking_room_id: room.booking_room_id,
          is_cancelled: room.is_cancelled || false,
        }
      })

      console.log('🔍 [DEBUG] Rooms processed:', rooms.length)

      // Mapper les données Channex vers notre format
      const reservationData: ReservationCreationData = {
        hotel_id: hotelId,
        arrived_date: bookingData.arrival_date,
        depart_date: bookingData.departure_date,
        created_by: userId,
        
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

        // ✅ CORRECTION: Chambres transformées
        rooms: rooms,

        // ✅ CORRECTION: Utilisation du statut mappé
        status: mappedStatus,
        total_amount: parseFloat(bookingData.amount || '0'),
        special_requests: bookingData.notes,
        payment_type: bookingData.payment_type,
        channex_booking_id: channexBooking.id,
        reservation_number: bookingData.unique_id,
      }

      console.log('🔍 [DEBUG] Final reservation data:', {
        hotel_id: reservationData.hotel_id,
        arrived_date: reservationData.arrived_date,
        depart_date: reservationData.depart_date,
        guest: `${reservationData.guest?.firstName} ${reservationData.guest?.lastName}`,
        rooms_count: reservationData.rooms?.length,
        status: reservationData.status
      })

      return await this.createReservation(reservationData, ctx)
    } catch (error) {
      console.error('💥 [ERROR] Error in createFromChannex:', error)
      console.error('💥 [ERROR] Channex booking that caused error:', channexBooking)
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
}