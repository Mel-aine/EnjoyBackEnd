// import type { HttpContext } from '@adonisjs/core/http'

import Reservation from '#models/reservation'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const reservationService = new CrudService(Reservation)

export default class ReservationsController extends CrudController<typeof Reservation> {
  constructor() {
    super(reservationService)
  }
}
