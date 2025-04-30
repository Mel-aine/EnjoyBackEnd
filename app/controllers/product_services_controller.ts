

import ProductService from '#models/product_service';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// // import type { HttpContext } from '@adonisjs/core/http'
 const productService = new CrudService(ProductService)



export default class ProductServicesController extends CrudController<typeof ProductService> {
  constructor() {
    super(productService)
  }
}
