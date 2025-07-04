import CrudController from '#controllers/crud_controller'
import CrudService from '#services/crud_service'
import Supplier from '#models/supplier'
//import type { HttpContext } from '@adonisjs/core/http'

const supplierService = new CrudService(Supplier)

export default class SuppliersController extends CrudController<typeof Supplier> {
  constructor() {
    super(supplierService)
  }
}
