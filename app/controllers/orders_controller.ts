// import type { HttpContext } from '@adonisjs/core/http'

import Order from '#models/order';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

const orderService = new CrudService(Order)

export default class OrdersController extends CrudController<typeof Order> {
  constructor() {
    super(orderService)
  }
}
