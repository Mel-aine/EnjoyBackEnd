
import Invoice from '#models/invoice';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const invoiceService = new CrudService(Invoice)

export default class InvoicesController extends CrudController<typeof Invoice> {
  constructor() {
    super(invoiceService)
  }
}
