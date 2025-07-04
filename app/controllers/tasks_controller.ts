
import Task from '#models/task';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import type { HttpContext } from '@adonisjs/core/http'
const TaskService = new CrudService(Task)

export default class TasksController extends CrudController<typeof Task> {
  constructor() {
    super(TaskService)
  }

   public async updateStatus({ params, request, response }: HttpContext) {
    const taskId = params.id
    const newStatus = request.input('status')

    const validStatuses = ['todo', 'in_progress', 'done']
    if (!validStatuses.includes(newStatus)) {
      return response.badRequest({ message: 'Statut invalide' })
    }

    try {
      const task = await Task.findOrFail(taskId)
      task.status = newStatus
      await task.save()

      return response.ok({ message: 'Statut mis à jour', task })
    } catch (error) {
      console.error('Erreur mise à jour tâche:', error)
      return response.internalServerError({ message: 'Erreur serveur' })
    }
  }


}
