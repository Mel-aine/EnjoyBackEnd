import User from '#models/user'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceUserAssignment from '#models/service_user_assignment'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController extends CrudController<typeof User> {
  private userService: CrudService<typeof User>

  constructor() {
    super(new CrudService(User))
    this.userService = new CrudService(User)
  }
  public async createWithUserAndRole({ request, response }: HttpContext) {
    const data = request.body()

    try {
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
        department_id: data.department_id || null,
        hire_date: data.hire_date || null,
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

  public async updateUserWithService({ request, response, params }: HttpContext) {
    const data = request.body()
    const userId = params.id

    try {
      const user = await this.userService.findById(userId)
      if (!user) {
        return response.status(404).send({ message: 'Utilisateur non trouvé' })
      }

      user.first_name = data.first_name
      user.last_name = data.last_name
      user.email = data.email
      user.phone_number = data.phone_number
      user.role_id = data.role_id
      user.address = data.address
      user.last_modified_by = data.last_modified_by || null

      if (data.password) {
        user.password = data.password
      }

      await user.save()

      const assignment = await ServiceUserAssignment.query().where('user_id', user.id).first()

      if (assignment) {
        assignment.service_id = data.service_id
        assignment.role = data.role
        await assignment.save()
      } else {
        await ServiceUserAssignment.create({
          user_id: user.id,
          service_id: data.service_id,
          role: data.role,
        })
      }

      return response.ok({ message: 'Utilisateur mis à jour', user })
    } catch (error) {
      console.error('❌ Error in updateUserWithService:', error)
      return response.status(500).send({
        message: 'Erreur lors de la mise à jour',
        error: error.message,
      })
    }
  }
}
