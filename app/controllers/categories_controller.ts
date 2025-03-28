
import Category from '#models/category';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// import type { HttpContext } from '@adonisjs/core/http'
const categoryService = new CrudService(Category)

export default class CategoriesController extends CrudController<typeof Category> {
  constructor() {
    super(categoryService)
  }
}
