import TypeProduct from '#models/product_type'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import ServiceProduct from '#models/service_product'

import type { HttpContext } from '@adonisjs/core/http'
const typeProductService = new CrudService(TypeProduct)

export default class TypeProductsController extends CrudController<typeof TypeProduct> {
  constructor() {
    super(typeProductService)
  }
public async countRoomsByType({ request, response }: HttpContext) {
    const serviceId = request.input('service_id')
    const typeId = request.input('product_type_id')

    if (!serviceId || !typeId) {
      return response.badRequest({ message: 'service_id et product_type_id are required' })
    }

    const count = await ServiceProduct.query()
      .where('service_id', serviceId)
      .andWhere('product_type_id', typeId)
      .count('* as total')
      .first()

    return {
      service_id: serviceId,
      product_type_id: typeId,
      total_rooms: count?.$extras.total || 0,
    }

  }


}
