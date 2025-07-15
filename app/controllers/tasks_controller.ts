import Task from '#models/task'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service'
import User from '#models/user'

const TaskService = new CrudService(Task)

export default class TasksController extends CrudController<typeof Task> {
  constructor() {
    super(TaskService)
  }

  public async updateStatus(ctx: HttpContext) {
    const { params, request, response } = ctx
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
          actorName = `${actor.first_name} ${actor.last_name || ''}`.trim()
        }
      }

      task.status = newStatus
      await task.save()

      const changes = LoggerService.extractChanges(
        { status: oldStatus },
        { status: newStatus }
      )

      await LoggerService.log({
        actorId: updatedBy || 0,
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
}
