
import Task from '#models/task';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const TaskService = new CrudService(Task)

export default class TasksController extends CrudController<typeof Task> {
  constructor() {
    super(TaskService)
  }
}
