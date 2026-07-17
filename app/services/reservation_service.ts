// services/reservation_service.ts

import Guest from '#models/guest'
import logger from '@adonisjs/core/services/logger'
import LoggerService from '#services/logger_service'
import type { ReservationData, GuestData } from '../types/reservationData.js'
import { generateGuestCode } from '../utils/generate_guest_code.js'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import ReservationGuest from '#models/reservation_guest'
import ReservationRoom from '#models/reservation_room'
import Reservation from '#models/reservation'
import { generateReservationNumber } from '../utils/generate_reservation_number.js'
import { generateConfirmationNumber } from '../utils/generate_confirmation_number.js'



export default class ReservationService {
  /**
   * Valide les données de réservation
   */
  // public static validateReservationData(data: ReservationData): string[] {
  //   const errors: string[] = []

  //   // Champs obligatoires
  //   if (!data.first_name?.trim()) errors.push('Le prénom est requis')
  //   if (!data.last_name?.trim()) errors.push('Le nom est requis')
  //   if (!data.email?.trim()) errors.push("L'email est requis")
  //   if (!data.hotel_id) errors.push("L'ID du service/hôtel est requis")
  //   if (!data.arrived_date) errors.push("La date d'arrivée est requise")
  //   if (!data.depart_date) errors.push("La date de départ est requise")
  //   if (!data.rooms || data.rooms.length === 0) errors.push('Au moins une chambre est requise')

  //   // Email
  //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  //   if (data.email && !emailRegex.test(data.email)) {
  //     errors.push("Format d'email invalide")
  //   }

  //   // Dates
  //   const arrivalDate = new Date(data.arrived_date)
  //   const departureDate = new Date(data.depart_date)
  //   const today = new Date()
  //   today.setHours(0, 0, 0, 0)

  //   if (arrivalDate < today) {
  //     errors.push("La date d'arrivée ne peut pas être dans le passé")
  //   }
  //   if (departureDate <= arrivalDate) {
  //     errors.push("La date de départ doit être après la date d'arrivée")
  //   }

  //   // Chambres
  //   data.rooms.forEach((room, index) => {
  //     if (!room.room_type_id) {
  //       errors.push(`Le type de chambre est requis pour la chambre ${index + 1}`)
  //     }
  //     if (room.adult_count < 1) {
  //       errors.push(`Au moins 1 adulte est requis pour la chambre ${index + 1}`)
  //     }
  //     if (room.room_rate < 0) {
  //       errors.push(`Le tarif de la chambre ${index + 1} ne peut pas être négatif`)
  //     }
  //   })

  //   // Montants
  //   if (data.total_amount < 0) errors.push('Le montant total ne peut pas être négatif')
  //   if (data.tax_amount < 0) errors.push('Le montant des taxes ne peut pas être négatif')
  //   if (data.final_amount < 0) errors.push('Le montant final ne peut pas être négatif')

  //   return errors
  // }
  public static validateReservationData(data: ReservationData,isTransaction:boolean = false): string[] {
    const errors: string[] = []

    // Champs obligatoires
    if (!data.first_name?.trim()) errors.push('Le prénom est requis')
    // if (!data.last_name?.trim()) errors.push('Le nom est requis')
    //if (!data.email?.trim()) errors.push("L'email est requis")
    if (!data.hotel_id) errors.push("L'ID du service/hôtel est requis")
    if (!data.arrived_date) errors.push("La date d'arrivée est requise")
    if (!data.depart_date) errors.push("La date de départ est requise")


    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (data.email && !emailRegex.test(data.email)) {
      errors.push("Format d'email invalide")
    }

    // Dates - MODIFIÉ pour supporter les réservations le même jour
    const arrivalDate = new Date(data.arrived_date)
    const departureDate = new Date(data.depart_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if(!isTransaction){
      if (arrivalDate < today) {
        errors.push("La date d'arrivée ne peut pas être dans le passé")
      }
    }
    // Validation des dates modifiée pour supporter les réservations le même jour
    if (arrivalDate.toISOString().split('T')[0] === departureDate.toISOString().split('T')[0]) {
      // Même jour - vérifier les heures
      const arrivalTime = data.arrived_time || data.check_in_time
      const departureTime = data.depart_time || data.check_out_time

      if (!arrivalTime || !departureTime) {
        errors.push("Pour une réservation le même jour, les heures d'arrivée et de départ sont requises")
      } else {
        // Convertir les heures en minutes pour comparaison
        const [arrHour, arrMin] = arrivalTime.split(':').map(Number)
        const [depHour, depMin] = departureTime.split(':').map(Number)
        const arrivalMinutes = arrHour * 60 + arrMin
        const departureMinutes = depHour * 60 + depMin

        if (departureMinutes <= arrivalMinutes) {
          errors.push("L'heure de départ doit être après l'heure d'arrivée pour une réservation le même jour")
        }
      }
    } else if (departureDate <= arrivalDate) {
      errors.push("La date de départ doit être après la date d'arrivée")
    }

    // Chambres valider seulement si des chambres sont fournies
    if (data.rooms && data.rooms.length > 0) {
      data.rooms.forEach((room, index) => {
        if (!room.room_type_id) {
          errors.push(`Le type de chambre est requis pour la chambre ${index + 1}`)
        }
        if (room.adult_count < 1) {
          errors.push(`Au moins 1 adulte est requis pour la chambre ${index + 1}`)
        }
        if (room.room_rate < 0) {
          errors.push(`Le tarif de la chambre ${index + 1} ne peut pas être négatif`)
        }
      })
    }

    // Montants
    if (data.total_amount < 0) errors.push('Le montant total ne peut pas être négatif')
    if (data.tax_amount < 0) errors.push('Le montant des taxes ne peut pas être négatif')
    if (data.final_amount < 0) errors.push('Le montant final ne peut pas être négatif')

    return errors
  }

  /**
   * Crée ou met à jour un invité
  */


  public static async createOrFindGuest(data: ReservationData, trx?: any): Promise<Guest> {
    // Convert email to lowercase for consistent matching
    const normalizedEmail = data.email?.toLowerCase().trim() || ''
    let guest: Guest | null = null

    // 1) If explicit guest_id is provided, load and update that guest directly
    if (data.guest_id) {
      guest = await Guest.query({ client: trx }).where('id', data.guest_id).first()
      if (guest) {
        guest.merge({
          hotelId: data.hotel_id,
          firstName: data.first_name,
          lastName: data.last_name,
          phonePrimary: data.phone_primary,
          phoneWhatsapp: data.whatsapp_number,
          title: data.title,
          companyName: data.company_name,
          companyId: data.company_id,
          profession: data.profession,
          addressLine: data.address_line,
          country: data.country,
          stateProvince: data.state,
          city: data.city,
          postalCode: data.zipcode,
          language: data.language,
          email: normalizedEmail || guest.email,
        })
        await guest.useTransaction(trx).save()
        return guest
      }
      // If the provided guest_id does not exist, fall back to email/LIKE matching below
    }

    // 2) Try email matching
    if (!guest && normalizedEmail) {
      guest = await Guest.query({ client: trx })
        .where('email', normalizedEmail)
        .first()
    }

    // Helper to normalize display names (remove dots, collapse spaces, lowercase)
    const normalizeName = (value: string) =>
      value
        ?.toLowerCase()
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim()

    // Build the input display name using Title + First + Last
    const inputDisplayName = normalizeName([
      data.title || '',
      data.first_name || '',
      (data.last_name || '-'),
    ].filter(Boolean).join(' '))

    // If email lookup did not find the guest, try LIKE matching on first/last within hotel
    if (!guest && data.hotel_id) {
      const first = (data.first_name || '').trim()
      const last = (data.last_name || '-').trim()

      // Primary candidate search: hotel + first_name LIKE + last_name LIKE
      const candidates = await Guest.query({ client: trx })
        .where('hotel_id', data.hotel_id)
        .whereILike('first_name', `%${first}%`)
        .whereILike('last_name', `%${last}%`)

      // Prefer exact normalized display name match (Title First Last)
      guest = candidates.find((g) => {
        const candidateDisplay = normalizeName([
          g.title || '',
          g.firstName || '',
          g.lastName || '-',
        ].filter(Boolean).join(' '))
        return candidateDisplay === inputDisplayName
      }) || candidates[0] || null

      // If still no guest found, broaden the search to all hotel guests and match by normalized display name
      if (!guest) {
        const hotelGuests = await Guest.query({ client: trx })
          .where('hotel_id', data.hotel_id)

        guest = hotelGuests.find((g) => {
          const candidateDisplay = normalizeName([
            g.title || '',
            g.firstName || '',
            g.lastName || '-',
          ].filter(Boolean).join(' '))
          return candidateDisplay === inputDisplayName
        }) || null
      }
    }

    if (guest) {
      guest.merge({
        hotelId: data.hotel_id,
        firstName: data.first_name,
        lastName: data.last_name,
        phonePrimary: data.phone_primary,
        phoneWhatsapp: data.whatsapp_number,
        title: data.title,
        companyName: data.company_name,
        companyId: data.company_id,
        profession: data.profession,
        addressLine: data.address_line,
        country: data.country,
        stateProvince: data.state,
        city: data.city,
        postalCode: data.zipcode,
        language: data.language,
        email: normalizedEmail || guest.email,
      })
      await guest.useTransaction(trx).save()
    } else {
      // Helper function to safely convert dates
      const convertToDateTime = (dateValue: any): DateTime | null => {
        if (!dateValue) return null

        try {
          // If it's already a DateTime object, return it
          if (DateTime.isDateTime(dateValue)) {
            return dateValue.isValid ? dateValue : null
          }

          // If it's a JavaScript Date object
          if (dateValue instanceof Date) {
            const dt = DateTime.fromJSDate(dateValue)
            return dt.isValid ? dt : null
          }

          // If it's a string, try to parse it
          if (typeof dateValue === 'string') {
            // Try ISO format first
            let dt = DateTime.fromISO(dateValue)
            if (dt.isValid) return dt

            // Try other common formats
            dt = DateTime.fromSQL(dateValue)
            if (dt.isValid) return dt

            // Try parsing as a regular date string
            dt = DateTime.fromJSDate(new Date(dateValue))
            if (dt.isValid) return dt
          }

          console.warn(`Invalid date format for value: ${dateValue}`)
          return null
        } catch (error) {
          console.error(`Error converting date value ${dateValue}:`, error)
          return null
        }
      }

      // Prepare guest data object
      const guestData: any = {
        hotelId: data.hotel_id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email?.toLowerCase().trim(),
        guestCode: generateGuestCode(),
        phonePrimary: data.phone_primary,
        title: data.title,
        companyName: data.company_name,
        companyId: data.company_id,
        profession: data.profession,
        nationality: data.nationality,
        maidenName: data.maiden_name,
        contactType: data.contact_type,
        contactTypeValue: data.contact_type_value,
        addressLine: data.address_line,
        country: data.country,
        stateProvince: data.state,
        city: data.city,
        postalCode: data.zipcode,
        dateOfBirth: data.dateOfBirth ? convertToDateTime(data.dateOfBirth) : null,
        placeOfBirth: data.placeOfBirth,
        createdBy: data.created_by,
        idPhoto: data.idPhoto,
        idType: data.idType,
        issuingCountry: data.issuingCountry,
        issuingCity: data.issuingCity,
        profilePhoto: data.profilePhoto
      }

      // Handle identity document mapping based on ID type
      if (data.idType) {
        const normalizedIdType = data.idType.toLowerCase().trim()

        switch (normalizedIdType) {
          case 'passport':
          case 'passeport':
            if (data.idNumber) {
              guestData.passportNumber = data.idNumber
            }
            if (data.idExpiryDate) {
              const convertedDate = convertToDateTime(data.idExpiryDate)
              if (convertedDate) {
                guestData.passportExpiry = convertedDate
                console.log('Converted passportExpiry:', convertedDate.toISO())
              } else {
                console.warn('Failed to convert passportExpiry, skipping field')
              }
            }
            break

          case 'visa':
            if (data.idNumber) {
              guestData.visaNumber = data.idNumber
            }
            if (data.idExpiryDate) {
              const convertedDate = convertToDateTime(data.idExpiryDate)
              if (convertedDate) {
                guestData.visaExpiry = convertedDate
                console.log('Converted visaExpiry:', convertedDate.toISO())
              } else {
                console.warn('Failed to convert visaExpiry, skipping field')
              }
            }
            break

          default:
            if (data.idNumber) {
              guestData.idNumber = data.idNumber
            }
            if (data.idExpiryDate) {
              const convertedDate = convertToDateTime(data.idExpiryDate)
              if (convertedDate) {
                guestData.idExpiryDate = convertedDate
                console.log('Converted idExpiryDate:', convertedDate.toISO())
              } else {
                console.warn('Failed to convert idExpiryDate, skipping field')
              }
            }
            break
        }
      }

      // Handle legacy direct field mappings (fallback)
      if (!data.idType) {
        if (data.passportNumber) {
          guestData.passportNumber = data.passportNumber
        }
        if (data.visaNumber) {
          guestData.visaNumber = data.visaNumber
        }
        if (data.passportExpiry) {
          const convertedDate = convertToDateTime(data.passportExpiry)
          if (convertedDate) {
            guestData.passportExpiry = convertedDate
            console.log('Converted passportExpiry (legacy):', convertedDate.toISO())
          }
        }
        if (data.visaExpiry) {
          const convertedDate = convertToDateTime(data.visaExpiry)
          if (convertedDate) {
            guestData.visaExpiry = convertedDate
            console.log('Converted visaExpiry (legacy):', convertedDate.toISO())
          }
        }
        if (data.idExpiryDate) {
          const convertedDate = convertToDateTime(data.idExpiryDate)
          if (convertedDate) {
            guestData.idExpiryDate = convertedDate
            console.log('Converted idExpiryDate (legacy):', convertedDate.toISO())
          }
        }
      }

      guest = await Guest.create(guestData, { client: trx })

      // Log guest creation if actorId is available
      if (data.created_by) {
        await LoggerService.logActivity({
          userId: data.created_by,
          action: 'CREATE',
          resourceType: 'Guest',
          resourceId: guest.id,
          hotelId: data.hotel_id,
          description: `Guest "${guest.firstName} ${guest.lastName}" created via reservation service`,
          details: LoggerService.extractChanges({}, guest.toJSON())
        })
      }
    }

    return guest
  }
  /**
   * Create or find a guest from guest data
   */
  public static async createOrFindGuestFromData(guestData: GuestData, createdBy: number, trx?: any): Promise<Guest> {
    let guest: Guest | null = null
   if (guestData.email) {
    guest = await Guest.query({ client: trx })
      .where('email', guestData.email.toLowerCase())
      .first()
  }

    // let guest = await Guest.query({ client: trx })
    //   .where('email', guestData.email.toLowerCase().trim())
    //   .first()

    if (guest) {
      guest.merge({
        firstName: guestData.first_name,
        lastName: guestData.last_name,
        phonePrimary: guestData.phone_primary,
        title: guestData.title,
        companyName: guestData.company_name,
        companyId: guestData.company_id,
        profession: guestData.profession,
        addressLine: guestData.address_line,
        country: guestData.country,
        stateProvince: guestData.state,
        city: guestData.city,
        postalCode: guestData.zipcode,
      })
      await guest.useTransaction(trx).save()
    } else {

      guest = await Guest.create({
        firstName: guestData.first_name,
        lastName: guestData.last_name,
        email: guestData.email || null,
        guestCode: generateGuestCode(),
        phonePrimary: guestData.phone_primary,
        title: guestData.title,
        companyName: guestData.company_name,
        companyId: guestData.company_id,
        profession: guestData.profession,
        nationality: guestData.nationality,
        dateOfBirth: guestData.dateOfBirth ? DateTime.fromISO(guestData.dateOfBirth) : undefined,
        placeOfBirth: guestData.placeOfBirth,
        maidenName: guestData.maiden_name,
        contactType: guestData.contact_type,
        contactTypeValue: guestData.contact_type_value,
        addressLine: guestData.address_line,
        country: guestData.country,
        stateProvince: guestData.state,
        city: guestData.city,
        postalCode: guestData.zipcode,
        createdBy: createdBy,
      }, { client: trx })

      // Log guest creation
      if (createdBy) {
        await LoggerService.logActivity({
          userId: createdBy,
          action: 'CREATE',
          resourceType: 'Guest',
          resourceId: guest.id,
          description: `Guest "${guest.firstName} ${guest.lastName}" created from guest data`,
          details: LoggerService.extractChanges({}, guest.toJSON())
        })
      }
    }

    return guest
  }

  /**
   * Create multiple guests and associate them with a reservation
   */
  public static async createGuestsForReservation(
    reservationId: number,
    guestsData: GuestData[],
    createdBy: number,
    trx?: any
  ): Promise<Guest[]> {
    // Vérifier que la réservation existe avant d'y associer des invités
    const reservationExists = await db.from('reservations')
      .where('id', reservationId)
      .useTransaction(trx)
      .first()

    if (!reservationExists) {
      throw new Error(`La réservation avec l'ID ${reservationId} n'existe pas. Impossible d'associer des invités.`)
    }

    const guests: Guest[] = []

    for (const guestData of guestsData) {
      // Create or find the guest
      const guest = await this.createOrFindGuestFromData(guestData, createdBy, trx)
      guests.push(guest)
      logger.info('guest', guest)
      logger.info('guest', reservationId)
      // Associate guest with reservation through pivot table
      await db.table('reservation_guests')
        .useTransaction(trx)
        .insert({
          reservation_id: reservationId,
          guest_id: guest.id,
          is_primary: guestData.is_primary || false,
          guest_type: guestData.guest_type || 'adult',
          room_assignment: guestData.room_assignment,
          special_requests: guestData.special_requests,
          dietary_restrictions: guestData.dietary_restrictions,
          accessibility: guestData.accessibility,
          emergency_contact: guestData.emergency_contact,
          emergency_phone: guestData.emergency_phone,
          notes: guestData.notes,
          created_by: createdBy,
          created_at: new Date(),
          updated_at: new Date()
        })
    }

    return guests
  }

  /**
   * Process reservation with multiple guests support
   */
   public static async processReservationGuests(
  reservationId: number,
  data: ReservationData,
  trx?: any
): Promise<{ primaryGuest: Guest; allGuests: Guest[] }> {
  // Vérifier que l'ID de réservation est valide
  if (!reservationId || isNaN(reservationId)) {
    throw new Error(`ID de réservation invalide: ${reservationId}`)
  }

  // Vérifier que la transaction est bien passée
  logger.info('Transaction dans processReservationGuests:', !!trx)

  // Vérifier que la réservation existe avant de traiter les invités
  const reservationExists = await db.from('reservations')
    .where('id', reservationId)
    .useTransaction(trx)
    .first()

  if (!reservationExists) {
    throw new Error(`La réservation avec l'ID ${reservationId} n'existe pas dans processReservationGuests`)
  }

  const createdBy = data.created_by

  // Create primary guest from main reservation data
  let primaryGuest = await this.createOrFindGuest(data, trx)

  //Ne créer QU'UNE SEULE entrée reservation_guest pour le primary
  let allGuests: Guest[] = [primaryGuest]

  // Créer UNE SEULE entrée pour le primary guest dans reservation_guests
  await db.table('reservation_guests')
    .useTransaction(trx)
    .insert({
      reservation_id: reservationId,
      guest_id: primaryGuest.id,
      is_primary: true,
      guest_type: 'adult',
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date()
    })

  return { primaryGuest, allGuests }
}

 /**
   * Cœur transactionnel de création de réservation.
   * Extrait du contrôleur pour être appelable aussi bien en ligne
   * (via HTTP) qu'en synchronisation offline (via SyncService).
   *
   * Ne gère volontairement PAS : logs d'activité (ctx-dépendants),
   * notifications, création de folios — laissés à l'appelant.
   */
  static async createFullReservation(
    data: any,
    actorId: number
  ): Promise<{ reservation: Reservation; primaryGuest: Guest; allGuests: Guest[]; roomsCreated: number }> {
    const arrivedDate = DateTime.fromISO(data.arrived_date)
    const departDate = DateTime.fromISO(data.depart_date)

    if (!arrivedDate.isValid || !departDate.isValid) {
      throw new Error('Invalid date format. Use ISO format (YYYY-MM-DD)')
    }

    const trx = await db.transaction()

    try {
      const numberOfNights =
        arrivedDate.toISODate() === departDate.toISODate()
          ? 0
          : Math.ceil(departDate.diff(arrivedDate, 'days').days)

      const validationErrors = this.validateReservationData(data)
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '))
      }

      const confirmationNumber = generateConfirmationNumber()
      const reservationNumber = generateReservationNumber()

      const rooms = data.rooms || []
      const totalAdults = rooms.reduce((s: number, r: any) => s + (parseInt(r.adult_count) || 0), 0)
      const totalChildren = rooms.reduce((s: number, r: any) => s + (parseInt(r.child_count) || 0), 0)

      // Re-vérification de dispo côté serveur — ESSENTIEL pour la sync :
      // la chambre a pu être prise par quelqu'un d'autre entre la création offline et la sync
      if (rooms.length > 0) {
        const roomIds = rooms.map((r: any) => r.room_id).filter(Boolean)
        if (roomIds.length > 0) {
          const conflicts = await ReservationRoom.query({ client: trx })
            .whereIn('room_id', roomIds)
            .whereIn('status', ['reserved', 'checked_in', 'day_use'])
            .where((q) => {
              q.where('check_in_date', '<', departDate.toISODate()!)
               .where('check_out_date', '>', arrivedDate.toISODate()!)
            })
          if (conflicts.length > 0) {
            throw new Error('One or more rooms are not available for the selected dates')
          }
        }
      }

      const reservation = await Reservation.create(
        {
          hotelId: data.hotel_id,
          userId: actorId,
          arrivedDate,
          departDate,
          checkInDate: arrivedDate,
          checkOutDate: departDate,
          status: data.status || 'confirmed',
          guestCount: totalAdults + totalChildren,
          adults: totalAdults,
          children: totalChildren,
          checkInTime: data.check_in_time,
          checkOutTime: data.check_out_time,
          totalAmount: parseFloat(`${data.total_amount ?? 0}`),
          taxAmount: parseFloat(`${data.tax_amount ?? 0}`),
          isGroup: rooms.length > 1,
          arrivingTo: data.arriving_to,
          goingTo: data.going_to,
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
          customerType: data.customType,
          paymentType: data.payment_type,
          taxExempt: data.tax_exempt,
          isHold: data.isHold,
          bookingDate: DateTime.now(),
          whatsappNotificationEnable: data.whatsapp_notification_enable ?? false,
          whatsappNumber: data.whatsapp_number || null,
          reservedBy: actorId,
          createdBy: actorId,
        },
        { client: trx }
      )

      if (!reservation.id) throw new Error("La réservation n'a pas pu être créée — ID manquant")

      const { primaryGuest, allGuests } = await this.processReservationGuests(reservation.id, data, trx)
      await reservation.merge({ guestId: primaryGuest.id }).useTransaction(trx).save()

      if (rooms.length > 0) {
        for (let index = 0; index < rooms.length; index++) {
          const room = rooms[index]
          let assignedGuestId = primaryGuest.id

          if (index > 0) {
            const roomGuest = await Guest.create({
              hotelId: data.hotel_id,
              title: primaryGuest.title,
              firstName: primaryGuest.firstName,
              lastName: primaryGuest.lastName,
              phonePrimary: primaryGuest.phonePrimary,
              nationality: primaryGuest.nationality,
              guestType: 'individual',
              guestCode: generateGuestCode(),
              status: 'active',
              createdBy: actorId,
            }, { client: trx })
            assignedGuestId = roomGuest.id
            await ReservationGuest.create({
              reservationId: reservation.id,
              guestId: roomGuest.id,
              isPrimary: false,
              createdBy: actorId,
            }, { client: trx })
          }

          await ReservationRoom.create(
            {
              reservationId: reservation.id,
              roomTypeId: room.room_type_id,
              roomId: room.room_id || null,
              guestId: assignedGuestId,
              checkInDate: arrivedDate,
              checkOutDate: departDate,
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
              totalRoomCharges: numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights,
              taxAmount: room.taxes,
              totalTaxesAmount: numberOfNights === 0 ? room.taxes : room.taxes * numberOfNights,
              netAmount:
                (numberOfNights === 0 ? room.room_rate : room.room_rate * numberOfNights) +
                (numberOfNights === 0 ? room.taxes : room.taxes * numberOfNights),
              status: numberOfNights === 0 ? 'day_use' : 'reserved',
              rateTypeId: room.rate_type_id,
              mealPlanId: room.meal_plan_id,
              mealPlanRateInclude: room.meal_plan_rate_include ?? true,
              isOwner: index === 0,
              reservedByUser: actorId,
              createdBy: actorId,
            },
            { client: trx }
          )
        }
      }

      await trx.commit()
      return { reservation, primaryGuest, allGuests, roomsCreated: rooms.length }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }




}
