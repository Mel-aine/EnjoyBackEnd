// import type { HttpContext } from '@adonisjs/core/http'


import TravelVehicle from '#models/travel_vehicle';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const travelVehicleService = new CrudService(TravelVehicle)

export default class TravelVehiclesController extends CrudController<typeof TravelVehicle> {
  constructor() {
    super(travelVehicleService)
  }
}
