// import type { HttpContext } from '@adonisjs/core/http'


import Role from '#models/role'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import Service from '#models/service'
import type { HttpContext } from '@adonisjs/core/http'
import RolePermission from '#models/role_permission'


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

public async getRolesByServiceWithPermissions({ params, response }: HttpContext) {
  const serviceId = Number(params.serviceId)

  if (isNaN(serviceId)) {
    return response.badRequest({ message: 'Invalid service ID' })
  }

  try {
    const service = await Service.findOrFail(serviceId)

    const roles = await Role
      .query()
      .where((query) => {
        query
          .whereNull('service_id')
          .andWhere('category_id', service.category_id)
      })
      .orWhere((query) => {
        query.where('service_id', serviceId)
      })
      .orWhere((query) => {
        query
          .where('role_name', 'admin')
          .andWhereNull('service_id')
          .andWhereNull('category_id')
      })

    const result = []

    for (const role of roles) {
      const rolePermissions = await RolePermission
        .query()
        .where('role_id', role.id)
        .andWhere((query) => {
          query
            .where('service_id', serviceId)
            .orWhereNull('service_id')
        })
        .preload('permission')

      const permissionsByService: Record<string, any[]> = {}
      let permissionCount = 0

      for (const rp of rolePermissions) {
        const key = rp.service_id === null ? 'global' : 'service'

        if (!permissionsByService[key]) {
          permissionsByService[key] = []
        }

        permissionsByService[key].push({
          id: rp.permission.id,
          name: rp.permission.name,
          label: rp.permission.label,
          category: rp.permission.category,
        })

        permissionCount++
      }

      result.push({
        id: role.id,
        name: role.role_name,
        description: role.description,
        permissions: permissionsByService,
        permissionsCount: permissionCount,
      })
    }

    return response.ok({
      totalRoles: result.length,
      roles: result,
    })
  } catch (error) {
    console.error(error)
    return response.notFound({ message: 'Service not found' })
  }
}

}
