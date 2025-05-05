// import type { HttpContext } from '@adonisjs/core/http'

import Expense from '#models/expense'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

const expenseService = new CrudService(Expense)

export default class ExpensesController extends CrudController<typeof Expense> {
  constructor() {
    super(expenseService)
  }
}
