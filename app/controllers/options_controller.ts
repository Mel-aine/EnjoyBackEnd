

import Option from '#models/option';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const optionService = new CrudService(Option)

export default class OptionsController extends CrudController<typeof Option> {
  constructor() {
    super(optionService)
  }
}
