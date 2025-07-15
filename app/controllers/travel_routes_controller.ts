
// import type { HttpContext } from '@adonisjs/core/http'

import TravelRoute from '#models/travel_route';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'


const TravelRouteService = new CrudService(TravelRoute)

export default class TravelRoutesController extends CrudController<typeof TravelRoute> {
  constructor() {
    super(TravelRouteService)
  }
}
