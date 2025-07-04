// import type { HttpContext } from '@adonisjs/core/http'
import Department from '#models/department';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
const departmentService = new CrudService(Department)

export default class DepartmentsController extends CrudController<typeof Department> {
  constructor() {
    super(departmentService)
  }
}
