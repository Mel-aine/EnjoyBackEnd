 import type { HttpContext } from '@adonisjs/core/http'

// import ReservationServiceProduct from '#models/reservation_service_product';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
// import Reservation from '#models/reservation'
// import { DateTime } from 'luxon';

// import type { HttpContext } from '@adonisjs/core/http'
const reservationServiceProductService = new CrudService(ReservationServiceProduct)

export default class ReservationServiceProductsController extends CrudController<typeof ReservationServiceProduct> {
  constructor() {
    super(reservationServiceProductService)
  }
  async getRecentBookings({ params, response }: HttpContext) {
    const serviceId = params.serviceId

    if (!serviceId) {
      return response.badRequest({ error: 'Le serviceId est requis.' })
    }

  try {
      const reservations = await ReservationServiceProduct
        .query()
        .whereHas('serviceProduct', (query) => {
          query.where('service_id', serviceId)
        })
        .preload('reservation', (resQuery) => {
          resQuery.preload('user')
        })
        .preload('serviceProduct')
        .orderBy('start_date', 'desc')
        .limit(10)

      const formatted = reservations.map((res) => {
        const reservation = res.reservation
        const user = reservation?.user
        const product = res.serviceProduct

        return {
          guest: user ? `${user.first_name} ${user.last_name}` : 'Inconnu',
          email: user?.email ?? '',
          room: product?.product_name ?? 'Non spécifié',
          checkin: res.start_date?.toFormat('dd/MM/yyyy') ?? '',
          checkout: res.end_date?.toFormat('dd/MM/yyyy') ?? '',
          status: reservation?.status ?? '',
          amount: reservation?.final_amount ?? 0,
        }
      })

      return response.ok(formatted)
    } catch (error) {
      console.error(error)
      return response.internalServerError({ message: 'Erreur lors de la récupération des réservations.' })
    }
  }

}
