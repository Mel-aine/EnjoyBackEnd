// import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

const UserAssigmentService = new CrudService(ServiceUserAssignment)

export default class AssigmentUsersController extends CrudController<typeof ServiceUserAssignment>{
    constructor() {
    super(UserAssigmentService)
  }
}
