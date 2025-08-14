// services/reservation_service.ts

import Guest from '#models/guest'
import type { ReservationData } from '../types/reservationData.js'
import {generateGuestCode} from '../utils/generate_guest_code.js'

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
  public static async createOrFindGuest(data: ReservationData): Promise<Guest> {
    let guest = await Guest.query()
      .where('email', data.email.toLowerCase().trim())
      .first()

    if (guest) {
      guest.merge({
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
      await guest.save()
    } else {
      guest = await Guest.create({
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
      })
    }

    return guest
  }
}
