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
public async countRoomsByType({ params, response }: HttpContext) {
    console.log('Route appelée avec typeId:', params.typeId)

    const typeId = params.typeId

    if (!typeId) {
      return response.badRequest({ message: 'product_type_id est requis' })
    }

    try {
      const result = await ServiceProduct.query()
        .where('product_type_id', typeId)
        .count('* as total')
        .first()

      const total = result?.$extras?.total || 0

      return response.ok({
        product_type_id: typeId,
        total_rooms: Number(total),
      })
    } catch (error) {
      console.error('Erreur lors du comptage des chambres:', error)
      return response.internalServerError({
        message: 'Erreur lors du comptage des chambres'
      })
    }
  }


}
