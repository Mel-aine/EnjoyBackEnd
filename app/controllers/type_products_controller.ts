// import TypeProduct from '#models/product_type'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
// import ServiceProduct from '#models/service_product'

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

  //delete room types
public async destroyed({ request, params, response }: HttpContext) {
  const serviceId = request.input('service_id')

  if (!serviceId) {
    return response.status(400).json({
      status: 'error',
      code: 'MISSING_SERVICE_ID',
      message: 'service_id is required',
    })
  }

  const typeProduct = await TypeProduct.find(params.id)

  if (!typeProduct) {
    return response.status(404).json({
      status: 'error',
      code: 'TYPE_NOT_FOUND',
      message: 'Room type not found.',
    })
  }

  const associatedRooms = await ServiceProduct
    .query()
    .where('product_type_id', typeProduct.id)
    .andWhere('service_id', serviceId)
    .count('* as total')
    .first()

  const total = Number(associatedRooms?.$extras.total || 0)

  if (total > 0) {
    return response.status(400).json({
      status: 'error',
      code: 'ROOMS_ASSOCIATED',
      message: `Unable to delete type "${typeProduct.name}" because ${total} room(s) are still associated with it. Please reclassify or delete these rooms first.`,
    })
  }

  await typeProduct.delete()

  return response.status(200).json({
    status: 'success',
    message: `Type "${typeProduct.name}" successfully deleted.`,
  })
}



}
