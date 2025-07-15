import Task from '#models/task'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import type { HttpContext } from '@adonisjs/core/http'
import LoggerService from '#services/logger_service' 

const TaskService = new CrudService(Task)

export default class TasksController extends CrudController<typeof Task> {
  constructor() {
    super(TaskService)
  }

  public async updateStatus(ctx: HttpContext) {
  const { params, request, response } = ctx
  const taskId = params.id
  const newStatus = request.input('status')

  const validStatuses = ['todo', 'in_progress', 'done']
  if (!validStatuses.includes(newStatus)) {
    return response.badRequest({ message: 'Statut invalide' })
  }

  try {
    const task = await Task.findOrFail(taskId)
    const oldStatus = task.status 

    task.status = newStatus
    await task.save()

    const changes = LoggerService.extractChanges(
      { status: oldStatus },
      { status: task.status }
    )

    await LoggerService.log({
      actorId: request.input('updated_by'),
      action: 'UPDATE',
      entityType: 'Task',
      entityId: taskId.toString(),
      description: `Le statut de la tâche #${taskId} a été mis à jour`,
      changes: changes, 
      ctx: ctx,
    })

    return response.ok({ message: 'Statut mis à jour', task })
  } catch (error) {
    console.error('Erreur mise à jour tâche:', error)
    return response.internalServerError({ message: 'Erreur serveur' })
  }
}


}
