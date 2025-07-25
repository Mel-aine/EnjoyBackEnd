import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import { DateTime } from 'luxon';
const UserAssigmentService = new CrudService(ServiceUserAssignment)

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

  /**
   * Get a paginated list of employees for a specific service,
   * including their role and department for that assignment.
   */
  public async getEmployeesForService({ params, request, response }: HttpContext) {
    try {
      const serviceId = Number.parseInt(params.serviceId, 10)
      if (Number.isNaN(serviceId)) {
        return response.badRequest({ message: 'Invalid serviceId' })
      }

      const { roleId, departmentId, search } = request.qs()
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 15)

      const query = ServiceUserAssignment.query()
        .where('service_id', serviceId)

      if (departmentId) {
        query.where('department_id', departmentId)
      }

      if (roleId) {
        query.whereHas('user', (userQuery) => {
          userQuery.where('role_id', roleId)
        })
      }

      if (search) {
        query.whereHas('user', (userQuery) => {
          userQuery
            .whereILike('first_name', `%${search}%`)
            .orWhereILike('last_name', `%${search}%`)
        })
      }

      const assignmentsPaginator = await query
        .preload('user', (userQuery) => {
          userQuery.preload('role')
        })
        .preload('department')
        .paginate(page, perPage)

      // Transform paginated data to include role and department with user details
      const result = assignmentsPaginator.toJSON()
      result.data = result.data
        .map((assignment) => {
          if (!assignment.user) return null

          return {
            ...assignment.$attributes,
            ...assignment.user.$attributes,
            role: assignment.role,
            department: assignment.department,
          }
        })
        .filter(Boolean) // Remove any null entries if a user was not found

      return response.ok(result)
    } catch (error) {
      console.error('Error fetching employees for service:', error)
      return response.internalServerError({
        message: 'Error fetching employees for the service',
        error: error.message,
      })
    }
  }
}
