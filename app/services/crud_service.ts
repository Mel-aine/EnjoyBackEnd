import { BaseModel } from '@adonisjs/lucid/orm'

export default class CrudService<T extends typeof BaseModel> {
  private model: T

  constructor(model: T) {
    this.model = model
  }

  /**
   * List records with dynamic filters, sorting, and pagination.
   */

  async list(
    filters: any,
    fields: string[],
    sortBy: string,
    order: string,
    page: number,
    perPage: number

  ) {
    let query = this.model.query()
    // Apply filters dynamically
    for (const key in filters) {
      if (Array.isArray(filters[key])) {
        query.whereIn(key, filters[key])
      } else {
        query.where(key, filters[key])
      }
    }

    return query
      .select(...fields)
      .orderBy(sortBy, order as 'asc' | 'desc')
      .paginate(page, perPage)
  }

  async getById(id: number, fields: string[]) {
    return await this.model
      .query()
      .where('id', id)
      .select(...fields)
      .first()
  }

  async create(data: any) {
    console.log('respone', data)
    console.log('model.user', this.model)
    return await this.model.create(data)
  }

  async update(id: number, data: any) {
    const item = await this.model.find(id)
    if (!item) return null
    item.merge(data)
    await item.save()
    return item
  }

  async delete(id: number) {
    const item = await this.model.find(id)
    if (!item) return null
    await item.delete()
    return item
  }
}
