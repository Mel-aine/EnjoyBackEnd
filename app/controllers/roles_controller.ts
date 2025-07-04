// import type { HttpContext } from '@adonisjs/core/http'


import Role from '#models/role'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const roleService = new CrudService(Role)

export default class RolesController extends CrudController<typeof Role> {
  constructor() {
    super(roleService)
  }
}
