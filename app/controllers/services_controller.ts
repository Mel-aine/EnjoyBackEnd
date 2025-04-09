// import type { HttpContext } from '@adonisjs/core/http'

import Service from '#models/service'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const serviceService = new CrudService(Service)

export default class ServicesController extends CrudController<typeof Service> {
  constructor() {
    super(serviceService)
  }
}


