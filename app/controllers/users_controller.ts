import User from '#models/user'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const userService = new CrudService(User)

export default class UsersController extends CrudController<typeof User> {
  constructor() {
    super(userService)
  }
}
