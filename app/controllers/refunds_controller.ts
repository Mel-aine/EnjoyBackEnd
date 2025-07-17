//  import type { HttpContext } from '@adonisjs/core/http'
import Refund from '#models/refund';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

const refundService = new CrudService(Refund)

export default class RefundsController extends CrudController<typeof Refund> {
  constructor() {
    super(refundService)
  }
}
