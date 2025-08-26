import type { HttpContext } from '@adonisjs/core/http'
import ServiceUserAssignment from '#models/service_user_assignment'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import User from '#models/user'
import { DateTime } from 'luxon'
const UserAssigmentService = new CrudService(ServiceUserAssignment)

export default class AssigmentUsersController extends CrudController<typeof ServiceUserAssignment> {
  private userService: CrudService<typeof User>
  constructor() {
    super(UserAssigmentService)
    this.userService = new CrudService(User)
  }

  public async createUser(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const data = request.body()

    try {
      const serviceId = Number.parseInt(data.service_id, 10)
      if (Number.isNaN(serviceId)) {
        return response.badRequest({ message: 'Invalid serviceId' })
      }

      // 1. Vérifier si l'utilisateur existe déjà (par email)
      let user = await User.query().where('email', data.email).first()

      let isNewUser = false

      if (!user) {
        user = await this.userService.create({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone_number: data.phone_number,
          role_id: data.role_id,
          address: data.address,
          nationality: data.nationality,
          status: 'active',
          created_by: auth.user?.id || null,
          last_modified_by: auth.user?.id || null,
          password: data.password,
          date_of_birth: data.date_of_birth ? DateTime.fromISO(data.date_of_birth) : null,
          place_of_birth: data.place_of_birth,
          gender: data.gender,
          city: data.city,
          country: data.country,
          emergency_phone: data.emergency_phone,
          personal_email: data.personal_email,
          social_security_number: data.social_security_number,
          national_id_number: data.national_id_number,
          hire_date: data.hire_date ? DateTime.fromISO(data.hire_date) : null,
          contract_type: data.contract_type,
          contract_end_date: data.contract_end_date ? DateTime.fromISO(data.contract_end_date) : null,
          data_processing_consent: data.data_processing_consent || false,
          consent_date: data.consent_date ? DateTime.fromISO(data.consent_date) : null,
        })
        isNewUser = true;
        await user.save();
      }

      // 3. Vérifier si une assignation existe déjà
      const existingAssignment = await ServiceUserAssignment.query()
        .where('user_id', user.id)
        .andWhere('hotel_id', serviceId)
        .first()

      if (existingAssignment) {
        return response.status(200).json({
          message: 'User already assigned to this service',
          user,
          assignment: existingAssignment,
          note: isNewUser ? 'New user created' : 'Existing user reused',
        })
      }

      // 4. Créer une assignation si elle n'existe pas encore
      const assignment = new ServiceUserAssignment()
      assignment.user_id = user.id
      assignment.service_id = serviceId
      assignment.role = data.role
      assignment.department_id = data.department_id
      assignment.hire_date = data.hire_date ? DateTime.fromISO(data.hire_date) : null

      await assignment.save()

      return response.status(isNewUser ? 201 : 200).json({
        message: isNewUser
          ? 'User and assignment created successfully'
          : 'Existing user assigned to new service',
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

      const query = ServiceUserAssignment.query().where('service_id', serviceId)

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
          userQuery.whereILike('first_name', `%${search}%`).orWhereILike('last_name', `%${search}%`)
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
