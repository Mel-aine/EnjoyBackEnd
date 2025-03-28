// import type { HttpContext } from '@adonisjs/core/http'


import Payment from '#models/payment';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const paymentService = new CrudService(Payment)

export default class PaymentsController extends CrudController<typeof Payment> {
  constructor() {
    super(paymentService)
  }
}
