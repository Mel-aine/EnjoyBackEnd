// import type { HttpContext } from '@adonisjs/core/http'

import TravelSchedule from '#models/travel_schedule';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const travelScheduleService = new CrudService(TravelSchedule)

export default class TravelSchedulesController extends CrudController<typeof TravelSchedule> {
  constructor() {
    super(travelScheduleService)
  }
}
