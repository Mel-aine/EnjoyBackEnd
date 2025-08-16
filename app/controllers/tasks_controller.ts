import Task from '#models/task'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import User from '#models/user'
import ServiceUserAssignment from '#models/service_user_assignment'

const TaskService = new CrudService(Task)

export default class TasksController extends CrudController<typeof Task> {
  constructor() {
    super(TaskService)
  }

  public async updateStatus(ctx: HttpContext) {
    const { params, request, response,auth } = ctx
    const taskId = params.id
    const newStatus = request.input('status')
    const updatedBy = request.input('updated_by')

    const validStatuses = ['todo', 'in_progress', 'done']
    if (!validStatuses.includes(newStatus)) {
      return response.badRequest({ message: 'Statut invalide' })
    }

    try {
      const task = await Task.findOrFail(taskId)
      const oldStatus = task.status

      let actorName = 'Unknown'
      if (updatedBy) {
        const actor = await User.find(updatedBy)
        if (actor) {
          actorName = `${actor.firstName} ${actor.lastName || ''}`.trim()
        }
      }

      task.status = newStatus
      await task.save()

      const changes = LoggerService.extractChanges(
        { status: oldStatus },
        { status: newStatus }
      )

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'UPDATE',
        entityType: 'Task',
        entityId: taskId.toString(),
        description: `the status of task #${taskId} changed from '${oldStatus}' to '${newStatus}' by ${actorName}`,
        changes,
        ctx: ctx,
      })

      return response.ok({ message: 'Status updated', task })
    } catch (error) {
      console.error('Erreur mise à jour tâche:', error)
      return response.internalServerError({ message: 'Erreur serveur' })
    }
  }

  public async filter(ctx: HttpContext) {
    const { request, response } = ctx
    const { userId, departmentId, createdDate, dueDate, status, serviceId, searchText } = request.qs()

    try {
      const query = Task.query()

      if (serviceId) {
        query.where('service_id', serviceId)
      }

      if (userId) {
        query.where('assigned_to', userId)
      }

      if (searchText) {
        query.whereHas('assignedUser', (userQuery) => {
          userQuery
            .where('first_name', 'ilike', `%${searchText}%`)
            .orWhere('last_name', 'ilike', `%${searchText}%`)
        })
      }

      if (departmentId) {
        const userAssignmentsQuery = ServiceUserAssignment.query().where(
          'department_id',
          departmentId
        )

        if (serviceId) {
          userAssignmentsQuery.where('service_id', serviceId)
        }

        const userAssignments = await userAssignmentsQuery.select('user_id')
        const userIdsInDepartment = userAssignments.map((assignment) => assignment.user_id)

        if (userIdsInDepartment.length > 0) {
          query.whereIn('assigned_to', userIdsInDepartment)
        } else {
          return response.ok([])
        }
      }

      if (createdDate) {
        query.whereRaw('DATE(created_at) = ?', [createdDate])
      }

      if (dueDate) {
        query.whereRaw('DATE(due_date) = ?', [dueDate])
      }

      if (status) {
        query.where('status', status)
      }

      const tasks = await query.preload('assignedUser').preload('creator').orderBy('created_at', 'desc')

      return response.ok(tasks)
    } catch (error) {
      console.error('Error filtering tasks:', error)
      return response.internalServerError({ message: 'Error filtering tasks', error: error.message })
    }
  }
}
