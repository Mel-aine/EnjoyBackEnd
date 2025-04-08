import TypeProduct from '#models/type_product'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const typeProductService = new CrudService(TypeProduct)

export default class TypeProductsController extends CrudController<typeof TypeProduct> {
  constructor() {
    super(typeProductService)
  }
}
