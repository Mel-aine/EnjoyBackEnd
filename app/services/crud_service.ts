/* eslint-disable prettier/prettier */
import { BaseModel } from '@adonisjs/lucid/orm'
import LoggerService from '#services/logger_service'

export default class CrudService<T extends typeof BaseModel> {
  private model: T

  constructor(model: T) {
    this.model = model
  }

  // Ajout d un getter getter
  getModelName(): string {
    return this.model.name
  }

  public getModel(): T {
    return this.model
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

  async create(data: any, actorId?: number, hotelId?: number,ctx?:any) {
    console.log('respone', data)
    const item = await this.model.create(data)
    
    // Log the create action if actorId is provided
    if (actorId) {
      await LoggerService.log({
        actorId: actorId,
        action: 'CREATE',
        entityType: this.getModelName(),
        entityId: (item as any).id,
        hotelId: hotelId || (item as any).hotelId || (item as any).hotel_id || 0,
        description: `${this.getModelName()} #${(item as any).id} created.`,
        changes: LoggerService.extractChanges({}, item.toJSON()),
        ctx:ctx
      })
    }
    
    return item
  }

  async update(id: number, data: any, actorId?: number, hotelId?: number, ctx?:any) {
    const item = await this.model.find(id)
    if (!item) return null
    
    const oldData = item.toJSON()
    item.merge(data)
    await item.save()
    
    // Log the update action if actorId is provided
    if (actorId) {
      const changes = LoggerService.extractChanges(oldData, data)
      if (Object.keys(changes).length > 0) {
        await LoggerService.log({
          actorId: actorId,
          action: 'UPDATE',
          entityType: this.getModelName(),
          entityId: (item as any).id,
          hotelId: hotelId || (item as any).hotelId || (item as any).hotel_id || 0,
          description: `${this.getModelName()} #${(item as any).id} updated.`,
          changes: changes,
          ctx:ctx 
        })
      }
    }
    
    return item
  }

  async delete(id: number, actorId?: number, hotelId?: number, ctx?:any) {
    const item = await this.model.find(id)
    if (!item) return null
    
    // Log the delete action if actorId is provided
    if (actorId) {
      await LoggerService.log({
        actorId: actorId,
        action: 'DELETE',
        entityType: this.getModelName(),
        entityId: (item as any).id,
        hotelId: hotelId || (item as any).hotelId || (item as any).hotel_id || 0,
        description: `${this.getModelName()} #${(item as any).id} deleted.`,
        changes: {},
        ctx:ctx
      })
    }
    
    await item.delete()
    return item
  }

  async createMany(data: any[], actorId?: number, hotelId?: number, ctx?:any) {
    const items = await this.model.createMany(data)
    
    // Log the bulk create action if actorId is provided
    if (actorId && items.length > 0) {
      const logEntries = items.map((item: any) => ({
        actorId: actorId,
        action: 'CREATE',
        entityType: this.getModelName(),
        entityId: item.id,
        hotelId: hotelId || item.hotelId || item.hotel_id || 0,
        description: `${this.getModelName()} #${item.id} created (bulk operation).`,
        changes: LoggerService.extractChanges({}, item.toJSON()),
        ctx:ctx
      }))
      
      await LoggerService.bulkLog(logEntries)
    }
    
    return items
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
      .limit(30)
  }

    async getReservationtServiceProductByReservationId(reservation_id: number, fields: string[]) {
    if (!reservation_id) {
      throw new Error('reservation_id is required')
    }

    const Model = this.model as any
    return await Model.query()
      .where('reservation_id', reservation_id)
      .preload('serviceProduct', (query: any) => {
        query.preload('service')
      })
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
