import type { HttpContext } from '@adonisjs/core/http'
import Department from '#models/department';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceUserAssignment from '#models/service_user_assignment'
import Task from '#models/task'
import Schedules from '#models/employee_schedule'
import ActivityLog from '#models/activity_log'
const departmentService = new CrudService(Department)

export default class DepartmentsController extends CrudController<typeof Department> {
  constructor() {
    super(departmentService)
  }

  public async getDepartmentDetails({ params, response }: HttpContext) {
    const { serviceId, departmentId } = params

    if (!serviceId || !departmentId) {
      return response.badRequest({ message: 'serviceId and departmentId are required.' })
    }

    try {
      // 1. Department Details (including responsible user)
      const department = await Department.query()
        .where('id', departmentId)
        .andWhere('service_id', serviceId)
        .preload('responsibleUser')
        .firstOrFail()

      // 2. Staff in the department
      const staffAssignments = await ServiceUserAssignment.query()
        .where('department_id', departmentId)
        .preload('user', (userQuery) => {
          userQuery.preload('role')
        })

      const staff = staffAssignments.map((a) => a.user)
      const staffIds = staff.map((s) => s.id)

      // 3. Tasks for the staff
      const tasks =
        staffIds.length > 0
          ? await Task.query()
              .whereIn('assigned_to', staffIds)
              .preload('assignedUser')
              .orderBy('due_date', 'desc')
          : []

      // 4. Planning for the staff
      const planning =
        staffIds.length > 0
          ? await Schedules.query()
              .whereIn('user_id', staffIds)
              .preload('user')
              .orderBy('schedule_date', 'desc')
          : []

      // 5. Activity History for the department and its staff
      const activityHistory = await ActivityLog.query()
        .where((query) => {
          query.where('entity_type', 'Department').andWhere('entity_id', departmentId)
          if (staffIds.length > 0) {
            query.orWhereIn('user_id', staffIds)
          }
        })
        .preload('user')
        .orderBy('created_at', 'desc')
        .limit(100)

      return response.ok({
        departmentDetails: department.serialize(),
        staff: staff.map((s) => s.serialize()),
        tasks: tasks.map((t) => t.serialize()),
        planning: planning.map((p) => p.serialize()),
        activityHistory: activityHistory.map((ah) => ah.serialize()),
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'Department not found in this service.' })
      }
      console.error('Error fetching department details:', error)
      return response.internalServerError({
        message: 'Failed to fetch department details',
        error: error.message,
      })
    }
  }
}
