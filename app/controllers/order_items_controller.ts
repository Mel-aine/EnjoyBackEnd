// import type { HttpContext } from '@adonisjs/core/http'

import OrderItem from '#models/order_item';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const orderItemService = new CrudService(OrderItem)

export default class OrderItemsController extends CrudController<typeof OrderItem> {
  constructor() {
    super(orderItemService)
  }
}
