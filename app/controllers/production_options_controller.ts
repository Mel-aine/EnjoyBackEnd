// import type { HttpContext } from '@adonisjs/core/http'

import ProductionOption from '#models/production_option';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const productionOptionService = new CrudService(ProductionOption)

export default class ProductionOptionsController extends CrudController<typeof ProductionOption> {
  constructor() {
    super(productionOptionService)
  }
}
