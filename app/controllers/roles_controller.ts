// import type { HttpContext } from '@adonisjs/core/http'

import Role from '#models/role'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import Service from '#models/service'
import type { HttpContext } from '@adonisjs/core/http'
// const roleService = new CrudService(Role)

export default class RolesController extends CrudController<typeof Role> {

  constructor() {
    super(new CrudService(Role))
  }
  //get role with service_type et service_id
async getRolesByService({ params, response }: HttpContext) {
  const serviceId = Number(params.serviceId)

  if (isNaN(serviceId)) {
    return response.badRequest({ message: 'Invalid service ID' })
  }

  try {
    const service = await Service.findOrFail(serviceId)

    const roles = await Role
      .query()
      .where(query => {
        query
          .whereNull('service_id')
          .andWhere('category_id', service.category_id)
      })
      .orWhere(query => {
        query.where('service_id', serviceId)
      })
      .orWhere(query => {
        query
          .where('role_name', 'admin')
          .andWhereNull('service_id')
          .andWhereNull('category_id')
      })


    return response.ok(roles)

  } catch (error) {
    return response.notFound({ message: 'Service not found' })
  }
}


}
