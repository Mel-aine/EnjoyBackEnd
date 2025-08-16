// services/reservation_service.ts

import Guest from '#models/guest'
import logger from '@adonisjs/core/services/logger'
import type { ReservationData, GuestData } from '../types/reservationData.js'
import {generateGuestCode} from '../utils/generate_guest_code.js'
import db from '@adonisjs/lucid/services/db'

export default class ReservationService {
  /**
   * Valide les données de réservation
   */
  public static validateReservationData(data: ReservationData): string[] {
    const errors: string[] = []

    // Champs obligatoires
    if (!data.first_name?.trim()) errors.push('Le prénom est requis')
    if (!data.last_name?.trim()) errors.push('Le nom est requis')
    if (!data.email?.trim()) errors.push("L'email est requis")
    if (!data.hotel_id) errors.push("L'ID du service/hôtel est requis")
    if (!data.arrived_date) errors.push("La date d'arrivée est requise")
    if (!data.depart_date) errors.push("La date de départ est requise")
    if (!data.rooms || data.rooms.length === 0) errors.push('Au moins une chambre est requise')

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (data.email && !emailRegex.test(data.email)) {
      errors.push("Format d'email invalide")
    }

    // Dates
    const arrivalDate = new Date(data.arrived_date)
    const departureDate = new Date(data.depart_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (arrivalDate < today) {
      errors.push("La date d'arrivée ne peut pas être dans le passé")
    }
    if (departureDate <= arrivalDate) {
      errors.push("La date de départ doit être après la date d'arrivée")
    }

    // Chambres
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
    let guest = await Guest.query({ client: trx })
      .where('email', data.email.toLowerCase().trim())
      .first()

    if (guest) {
      guest.merge({
        hotelId:data.hotel_id,
        firstName: data.first_name,
        lastName: data.last_name,
        phonePrimary: data.phone_primary,
        title: data.title,
        companyName: data.company_name,
        addressLine: data.address_line,
        country: data.country,
        stateProvince: data.state,
        city: data.city,
        postalCode: data.zipcode,
      })
      await guest.useTransaction(trx).save()
    } else {
      guest = await Guest.create({
        hotelId:data.hotel_id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email.toLowerCase().trim(),
        guestCode : generateGuestCode(),
        phonePrimary: data.phone_primary,
        title: data.title,
        companyName: data.company_name,
        addressLine: data.address_line,
        country: data.country,
        stateProvince: data.state,
        city: data.city,
        postalCode: data.zipcode,
        createdBy: data.created_by,
      }, { client: trx })
    }

    return guest
  }

  /**
   * Create or find a guest from guest data
   */
  public static async createOrFindGuestFromData(guestData: GuestData, createdBy: number, trx?: any): Promise<Guest> {
    let guest = await Guest.query({ client: trx })
      .where('email', guestData.email.toLowerCase().trim())
      .first()

    if (guest) {
      guest.merge({
        firstName: guestData.first_name,
        lastName: guestData.last_name,
        phonePrimary: guestData.phone_primary,
        title: guestData.title,
        companyName: guestData.company_name,
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
        email: guestData.email.toLowerCase().trim(),
        guestCode: generateGuestCode(),
        phonePrimary: guestData.phone_primary,
        title: guestData.title,
        companyName: guestData.company_name,
        addressLine: guestData.address_line,
        country: guestData.country,
        stateProvince: guestData.state,
        city: guestData.city,
        postalCode: guestData.zipcode,
        createdBy: createdBy,
      }, { client: trx })
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
      logger.info('guest',guest)
      logger.info('guest',reservationId)
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

    // If additional guests are provided, create them
    let allGuests: Guest[] = [primaryGuest]

    if (data.guests && data.guests.length > 0) {
      // Ensure primary guest is marked as primary if not explicitly set
      const primaryGuestData: GuestData = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_primary: data.phone_primary,
        title: data.title,
        company_name: data.company_name,
        address_line: data.address_line,
        country: data.country,
        state: data.state,
        city: data.city,
        zipcode: data.zipcode,
        is_primary: true,
        guest_type: 'adult'
      }

      // Combine primary guest with additional guests
      const allGuestsData = [primaryGuestData, ...data.guests]

      // Create all guests and associate with reservation
      allGuests = await this.createGuestsForReservation(reservationId, allGuestsData, createdBy, trx)

      // S'assurer que primaryGuest est bien l'invité principal
      const primaryGuestFromList = allGuests.find(g => g.email.toLowerCase() === data.email.toLowerCase())
      if (primaryGuestFromList) {
        primaryGuest = primaryGuestFromList
      }
    } else {
      // Just associate the primary guest with the reservation
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
    }

    return { primaryGuest, allGuests }
  }
}
