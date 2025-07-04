// import type { HttpContext } from '@adonisjs/core/http'


import StockCategory from '#models/stock_category';
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'

// // import type { HttpContext } from '@adonisjs/core/http'
 const stockCategoryService = new CrudService(StockCategory)



export default class StockCategoriesController extends CrudController<typeof StockCategory> {
  constructor() {
    super(stockCategoryService)
  }


}
