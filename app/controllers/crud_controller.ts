import { HttpContext } from '@adonisjs/core/http'
import CrudService from '../services/crud_service.js'
import { BaseModel } from '@adonisjs/lucid/orm'

export default class CrudController<T extends typeof BaseModel> {
  private service: CrudService<T>

  constructor(service: CrudService<T>) {
    this.service = service
  }

  /**
   * Fetch a paginated list of records with dynamic filters, sorting, and field selection.
   */
  async list({ request, response }: HttpContext) {
    try {
      const filters = request.input('filters', {})
      const fields = request.input('fields', ['*'])
      const sortBy = request.input('sortBy', 'id')
      const order = request.input('order', 'asc') // 'asc' or 'desc'
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 50)

      const data = await this.service.list(filters, fields, sortBy, order, page, perPage)
      return response.ok(data)
    } catch (error) {
      return response.internalServerError({
        message: 'Error fetching records' + error.stack,
        error: error.message,
      })
    }
  }

  /**
   * Fetch a single record by ID with optional field selection.
   */
  async show({ params, request, response }: HttpContext) {
    try {
      const fields = request.input('fields', ['*'])
      const item = await this.service.getById(params.id, fields)

      if (!item) {
        return response.notFound({ message: 'Record not found' })
      }

      return response.ok(item)
    } catch (error) {
      return response.internalServerError({
        message: 'Error fetching record',
        error: error.message,
      })
    }
  }

  /**
   * Create a new record with dynamic fields.
   */
  async store({ request, response }: HttpContext) {
    try {
      const data = request.all()
      const item = await this.service.create(data)
      return response.created(item)
    } catch (error) {
      return response.badRequest({ message: 'Error creating record', error: error.message })
    }
  }

  /**
   * Update an existing record dynamically.
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const data = request.all()
      const item = await this.service.update(params.id, data)

      if (!item) {
        return response.notFound({ message: 'Record not found' })
      }

      return response.ok(item)
    } catch (error) {
      return response.badRequest({ message: 'Error updating record', error: error.message })
    }
  }

  /**
   * Delete a record by ID.
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const item = await this.service.delete(params.id)

      if (!item) {
        return response.notFound({ message: 'Record not found' })
      }

      return response.ok({ message: 'Record deleted successfully' })
    } catch (error) {
      return response.internalServerError({
        message: 'Error deleting record',
        error: error.message,
      })
    }
  }


  public async bulkCreate({ request, response }: HttpContext) {
  try {
    const data = request.input('data')

    if (!Array.isArray(data)) {
      return response.badRequest({ message: 'Expected "data" to be an array' })
    }

    const items = await this.service.createMany(data)
    return response.created(items)
  } catch (error) {
    return response.badRequest({ message: 'Error creating records', error: error.message })
  }
}

async showByCategorie({ params, request, response }: HttpContext) {
  try {
    const { categoryId } = params
    if (!categoryId) {
      return response.badRequest({ message: 'categoryId is required' })
    }

    const fields = request.input('fields', ['*'])
    const categoryIdNum = parseInt(categoryId, 10)
    if (isNaN(categoryIdNum)) {
      return response.badRequest({ message: 'Invalid categoryId' })
    }

    const items = await this.service.getByCategoryId(categoryIdNum, fields)

    if (!items || items.length === 0) {
      return response.notFound({ message: 'Record not found' })
    }

    return response.ok(items)
  } catch (error) {
    return response.internalServerError({
      message: 'Error fetching record',
      error: error.message,
    })
  }
}




}
