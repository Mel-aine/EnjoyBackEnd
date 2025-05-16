import User from '#models/user'
import Role from '#models/role'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

import type { HttpContext } from '@adonisjs/core/http'
// const userService = new CrudService(User)

export default class UsersController extends CrudController<typeof User> {
  private userService: CrudService<typeof User>
  private roleService: CrudService<typeof Role>
  constructor() {
    //super(userService)
    super(new CrudService(User))
    this.userService = new CrudService(User)
    this.roleService = new CrudService(Role)
  }
  public async createWithUserAndRole({ request, response }: HttpContext) {
    const data = request.body()

    try {

      const roleName = data.role_name.trim().toLowerCase()

      let role = await this.roleService.findOne({ role_name: roleName })

      if (!role) {
        role = await this.roleService.create({
          role_name: roleName,
          description: data.description || null,
          created_by: data.created_by || null,
          last_modified_by: data.last_modified_by || null,
        })
      }

      // Crée l’utilisateur avec le role_id trouvé ou créé
      const user = await this.userService.create({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        role_id: role.id,
        service_id : data.service_id,
        status: 'active',
        created_by: data.created_by || null,
        last_modified_by: data.last_modified_by || null,
        password: data.password,
      })

      return response.created({ role, user })
    } catch (error) {
      console.error('Error in createWithUserAndRole:', error)
      return response.status(500).send({
        message: 'Error while creating',
        error: error.message,
      })
    }
  }

}


