// import type { HttpContext } from '@adonisjs/core/http'

import ReservationServiceProduct from '#models/reservation_service_product';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const reservationServiceProductService = new CrudService(ReservationServiceProduct)

export default class ReservationServiceProductsController extends CrudController<typeof ReservationServiceProduct> {
  constructor() {
    super(reservationServiceProductService)
  }
}
