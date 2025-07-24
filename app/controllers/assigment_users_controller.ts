import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import { DateTime } from 'luxon';
const UserAssigmentService = new CrudService(ServiceUserAssignment)
import hash from '@adonisjs/core/services/hash'


export default class AssigmentUsersController extends CrudController<typeof ServiceUserAssignment>{
    constructor() {
    super(UserAssigmentService)
  }

  public async createUser({ request, response }: HttpContext) {

    const {
      first_name,
      last_name,
      email,
      nationality,
      phone_number,
      address,
      password,
      role_id,
      status,
      created_by,
      service_id,
      role,
      department_id,    
      hire_date,
    } = request.only([
      'first_name',
      'last_name',
      'email',
      'nationality',
      'phone_number',
      'address',
      'password',
      'role_id',
      'status',
      'created_by',
      'service_id',
      'role',
      'department_id',
      'hire_date',
    ])

    try {
      // 1. Création utilisateur

 

      const user = new User()
      user.first_name = first_name
      user.last_name = last_name
      user.email = email
      user.nationality = nationality ?? null
      user.phone_number = phone_number ?? null
      user.address = address
      user.password = password
      user.role_id = role_id
      user.status = status
      user.created_by = created_by ?? null

      await user.save()


      const assignment = new ServiceUserAssignment()
      assignment.user_id = user.id
      assignment.service_id = service_id
      assignment.role = role
      assignment.department_id = department_id
      assignment.hire_date = hire_date ? DateTime.fromISO(hire_date) : null

      await assignment.save()

      return response.status(201).json({
        message: 'User and assignment created successfully',
        user,
        assignment,
      })
    } catch (error) {
      return response.status(500).json({
        message: 'Error creating user or assignment',
        error: error.message,
      })
    }
  }

}
