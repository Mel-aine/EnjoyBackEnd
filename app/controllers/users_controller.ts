import User from '#models/user'
// import Role from '#models/role'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceUserAssignment from '#models/service_user_assignment'
import type { HttpContext } from '@adonisjs/core/http'
// const userService = new CrudService(User)

export default class UsersController extends CrudController<typeof User> {
  //  constructor() {
  //   super(userService)
  // }
  private userService: CrudService<typeof User>
  // private roleService: CrudService<typeof Role>
  constructor() {
    //super(userService)
    super(new CrudService(User))
    this.userService = new CrudService(User)
    // this.roleService = new CrudService(Role)
  }
  public async createWithUserAndRole({ request, response }: HttpContext) {
    const data = request.body()

    try {
  //     // Validation de role_name
  //     if (typeof data.role_name !== 'string' || !data.role_name.trim()) {
  //       return response.status(400).send({
  //         message: 'Le champ "role_name" est requis et doit être une chaîne non vide.',
  //       })
  //     }

  //     const roleName = data.role_name.trim().toLowerCase()
  //     let role = await this.roleService.findOne({
  //       role_name: roleName.toLowerCase(),
  //     })

  //     if (!role) {
  //       role = await this.roleService.create({
  //         role_name: roleName,
  //         description: data.description || null,
  //         created_by: data.created_by || null,
  //         last_modified_by: data.last_modified_by || null,
  //       })
  //     }

  //     const user = await this.userService.create({
  //       first_name: data.first_name,
  //       last_name: data.last_name,
  //       email: data.email,
  //       phone_number: data.phone_number,
  //       role_id: role.id,
  //       address: data.address,
  //       service_id: data.service_id,
  //       status: 'active',
  //       created_by: data.created_by || null,
  //       last_modified_by: data.last_modified_by || null,
  //       password: data.password,
  //     })

  //     return response.created({ role, user })
  //   } catch (error) {
  //     console.error('Error in createWithUserAndRole:', error)
  //     return response.status(500).send({
  //       message: 'Erreur lors de la création',
  //       error: error.message,
  //     })
  //   }
  // }
   const user = await this.userService.create({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        role_id: data.role_id,
        address: data.address,
        service_id: data.service_id,
        status: 'active',
        created_by: data.created_by || null,
        last_modified_by: data.last_modified_by || null,
        password: data.password,
      })

        await ServiceUserAssignment.create({
        user_id: user.id,
        service_id: data.service_id,
        role: data.role,
      })

      return response.created({ user })

} catch (error) {
      console.error('Error in createWithUser:', error)
      return response.status(500).send({
        message: 'Erreur lors de la création',
        error: error.message,
      })
    }
  }



}
