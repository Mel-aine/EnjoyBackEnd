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

  async createMany(data: any[]) {
    return await this.model.createMany(data)
  }

  async getByCategoryId(category_id: number, fields: string[]) {
    if (!category_id) {
      throw new Error('category_id is required')
    }

    return await this.model
      .query()
      .where('category_id', category_id)
      .select(...fields)
      .limit(25)
  }


  async getServiceProductByServiceId(service_id: number, fields: string[]) {
    if (!service_id) {
      throw new Error('service_id is required')
    }

    return await this.model
      .query()
      .where('service_id', service_id)
      .select(...fields)
  }

  async getProductOptionByServiceProductId(service_product_id: number, fields: string[]) {
    if (!service_product_id) {
      throw new Error('service_product_id is required')
    }

    return await this.model
      .query()
      .where('service_product_id', service_product_id)
      .select(...fields)
  }

  async getByServiceId(service_id: number, fields: string[]) {
    if (!service_id) {
      throw new Error('service_id is required')
    }

    return await this.model
      .query()
      .where('service_id', service_id)
      .select(...fields)
  }

    async getReservationtServiceProductByReservationId(reservation_id: number, fields: string[]) {
    if (!reservation_id) {
      throw new Error('reservation_id is required')
    }

    return await this.model
      .query()
      .where('reservation_id', reservation_id)
      .select(...fields)
  }

  async findById(id: number | string) {
    return this.model.find(id)
  }



  public async findOne(conditions: Partial<InstanceType<T>>): Promise<InstanceType<T> | null> {
    return this.model.query().where(conditions).first()
  }

  async updateByServiceProductId(service_product_id:number, optionsPayload:any) {
    for (const option of optionsPayload) {
      const existing = await this.model
        .query()
        .where('service_product_id', service_product_id)
        .where('option_id', option.option_id)
        .first();

      if (existing) {
        existing.merge(option);
        await existing.save();
      } else {
        await this.model.create(option);
      }
    }
  }

  async findByEmail(email: string) {
  return await this.model.query().where('email', email).first()
}



}
