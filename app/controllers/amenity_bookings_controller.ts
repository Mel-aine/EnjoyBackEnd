import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import AmenityBooking from '#models/amenity_booking'
import AmenityProduct from '#models/amenity_product'
import Reservation from '#models/reservation'
import {
  createAmenityBookingValidator,
  updateAmenityBookingValidator,
} from '#validators/amenity_booking_validator'

export default class AmenityBookingsController {
  /**
   * Affiche une liste de toutes les réservations d'aménités.
   */
  public async index({ response }: HttpContext) {
    const bookings = await AmenityBooking.query()
      .preload('reservation')
      .preload('items', (query) => query.preload('amenityProduct'))
      .orderBy('createdAt', 'desc')
    return response.ok(bookings)
  }

  /**
   * Crée une nouvelle réservation d'aménités avec ses articles.
   */
  public async store({ request, response, auth }: HttpContext) {
    const trx = await db.transaction()

    try {
      const payload = await request.validateUsing(createAmenityBookingValidator)
      const user = auth.user!

      // 1. Récupérer tous les IDs de produits depuis la charge utile
      const productIds = payload.items.map((item) => item.amenity_product_id)

      // 2. Récupérer tous les produits pertinents en une seule fois
      const products = await AmenityProduct.query().whereIn('id', productIds)

      // Créer une map pour une recherche rapide des produits
      const productMap = new Map(products.map((p) => [p.id, p]))

      // 3. Regrouper les articles par ID de catégorie
      const itemsByCategory = new Map<number, { product: AmenityProduct; quantity: number }[]>()

      for (const item of payload.items) {
        const product = productMap.get(item.amenity_product_id)
        if (!product) {
          throw new Error(`Produit avec ID ${item.amenity_product_id} non trouvé.`)
        }

        const categoryId = product.amenitiesCategoryId
        if (!itemsByCategory.has(categoryId)) {
          itemsByCategory.set(categoryId, [])
        }
        itemsByCategory.get(categoryId)!.push({
          product: product,
          quantity: item.quantity,
        })
      }

      // 4. Créer une réservation pour chaque catégorie
      const createdBookings: AmenityBooking[] = []

      for (const [_categoryId, items] of itemsByCategory.entries()) {
        let totalAmount = 0
        const bookingItemsData = items.map((item) => {
          const pricePerUnit = item.product.price
          const subtotal = pricePerUnit * item.quantity
          totalAmount += subtotal
          return {
            amenityProductId: item.product.id,
            quantity: item.quantity,
            pricePerUnit: pricePerUnit,
            subtotal: subtotal,
          }
        })

        const amenityBooking = await AmenityBooking.create(
          { reservationId: payload.reservation_id, totalAmount, status: payload.status, createdBy: user.id, lastModifiedBy: user.id },
          { client: trx }
        )
        await amenityBooking.related('items').createMany(bookingItemsData, { client: trx })
        await amenityBooking.load('items', (query) => query.preload('amenityProduct'))
        createdBookings.push(amenityBooking)
      }

      await trx.commit()
      return response.created(createdBookings)
    } catch (error) {
      await trx.rollback()
      if (error.name === 'E_VALIDATION_ERROR') {
        return response.badRequest(error.messages)
      }
      console.error(error)
      return response.internalServerError({
        message: 'Erreur lors de la création de la réservation.',
        error: error.message,
      })
    }
  }

  /**
   * Affiche une réservation d'aménités spécifique.
   */
  public async show({ params, response }: HttpContext) {
    try {
      const booking = await AmenityBooking.query()
        .where('id', params.id)
        .preload('reservation')
        .preload('items', (query) => query.preload('amenityProduct'))
        .firstOrFail()
      return response.ok(booking)
    } catch (error) {
      return response.notFound({ message: 'Réservation non trouvée.' })
    }
  }

  /**
   * Met à jour une réservation d'aménités.
   * Note : Cette implémentation remplace tous les articles existants par les nouveaux fournis.
   */
  public async update({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()

    try {
      const amenityBooking = await AmenityBooking.findOrFail(params.id, { client: trx })
      const payload = await request.validateUsing(updateAmenityBookingValidator)
      const user = auth.user!

      if (payload.status) {
        amenityBooking.status = payload.status
      }

      if (payload.items) {
        await amenityBooking.related('items').query().useTransaction(trx).delete()

        let totalAmount = 0
        const newItemsData = []
        for (const item of payload.items) {
          const product = await AmenityProduct.findOrFail(item.amenity_product_id)
          const pricePerUnit = product.price
          const subtotal = pricePerUnit * item.quantity
          totalAmount += subtotal
          newItemsData.push({
            amenityProductId: item.amenity_product_id,
            quantity: item.quantity,
            pricePerUnit: pricePerUnit,
            subtotal: subtotal,
          })
        }

        amenityBooking.totalAmount = totalAmount
        await amenityBooking.related('items').createMany(newItemsData, { client: trx })
      }

      amenityBooking.lastModifiedBy = user.id
      await amenityBooking.save()

      await trx.commit()

      await amenityBooking.load('items', (query) => query.preload('amenityProduct'))
      return response.ok(amenityBooking)
    } catch (error) {
      await trx.rollback()
      // ... (gestion des erreurs comme dans la méthode store)
      return response.internalServerError({ message: 'Erreur lors de la mise à jour.' })
    }
  }

  /**
   * Supprime une réservation d'aménités.
   */
  public async destroy({ params, response }: HttpContext) {
    const trx = await db.transaction()
    try {
      const booking = await AmenityBooking.findOrFail(params.id, { client: trx })
      await booking.delete()
      await trx.commit()
      return response.ok({ message: 'Réservation supprimée avec succès.' })
    } catch (error) {
      await trx.rollback()
      return response.internalServerError({ message: 'Erreur lors de la suppression.' })
    }
  }

  /**
   * Récupère les réservations par ID de réservation et ID de service.
   */
  public async getByReservationAndService({ params, response }: HttpContext) {
    try {
      const { reservationId, serviceId } = params
      
      const reservationIdNum = parseInt(reservationId)
      const serviceIdNum = parseInt(serviceId)
      
      if (isNaN(reservationIdNum)) {
        return response.badRequest({ message: 'Invalid reservationId' })
      }
      
      if (isNaN(serviceIdNum)) {
        return response.badRequest({ message: 'Invalid serviceId' })
      }

      const bookings = await AmenityBooking.query()
        .where('reservation_id', reservationIdNum)
        .whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('service_id', serviceIdNum)
        })
        .preload('items', (query) => query.preload('amenityProduct'))
        .orderBy('createdAt', 'desc')

      if (!bookings.length) {
        return response.notFound({
          message: 'Aucune réservation de service trouvée pour cette réservation et ce service.',
        })
      }

      return response.ok(bookings)
    } catch (error) {
      console.error('Erreur lors de la récupération des réservations par réservation et service:', error)
      return response.internalServerError({ message: 'Échec de la récupération des réservations.' })
    }
  }

  /**
   * Récupère les réservations contenant des produits d'une catégorie de service spécifique.
   */
  public async getByAmenityCategory({ params, response }: HttpContext) {
    try {
      const { categoryId } = params

      const bookings = await AmenityBooking.query()
        .whereHas('items', (itemQuery) => {
          itemQuery.whereHas('amenityProduct', (productQuery) => {
            productQuery.where('amenities_category_id', categoryId)
          })
        })
        .preload('items', (itemQuery) => {
          itemQuery.preload('amenityProduct', (productQuery) => {
            productQuery.preload('category')
          })
        })
        .preload('reservation')
        .orderBy('createdAt', 'desc')

      return response.ok(bookings)
    } catch (error) {
      console.error("Erreur lors de la récupération des réservations par catégorie d'aménités:", error)
      return response.internalServerError({ message: 'Échec de la récupération des réservations.' })
    }
  }

  /**
   * Get unpaid amenity bookings for a reservation, along with room's remaining price.
   */
  public async getUnpaidByReservation({ params, response }: HttpContext) {
    try {
      const reservationId = parseInt(params.reservationId)
      
      if (isNaN(reservationId)) {
        return response.badRequest({ message: 'Invalid reservationId' })
      }

      // 1. Find the reservation to get the remaining room price
      const reservation = await Reservation.findOrFail(reservationId)

      // 2. Find all 'pending' amenity bookings for this reservation
      const unpaidAmenityBookings = await AmenityBooking.query()
        .where('reservation_id', reservationId)
        .where('status', 'pending') // Assuming 'pending' means unpaid
        .preload('items', (itemQuery) => {
          itemQuery.preload('amenityProduct')
        })

      // 3. Calculate total for unpaid amenities
      const totalUnpaidAmenitiesAmount = unpaidAmenityBookings.reduce(
        (sum, booking) => sum + parseFloat(booking.totalAmount.toString()),
        0
      )

      return response.ok({
        unpaidAmenityBookings: unpaidAmenityBookings.map((b) => b.serialize()),
        totalUnpaidAmenitiesAmount,
        totalRemainingPrice: parseFloat((reservation.remaining_amount??'0').toString()),
      })
    } catch (error) {
      // ... (Error handling as before)
      return response.internalServerError({ message: 'Failed to fetch unpaid amenities.' })
    }
  }
}
