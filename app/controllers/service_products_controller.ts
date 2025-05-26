import type { HttpContext } from '@adonisjs/core/http'

import ServiceProduct from '#models/service_product'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
const serviceProductService = new CrudService(ServiceProduct)

export default class ServiceProductsController extends CrudController<typeof ServiceProduct> {
  constructor() {
    super(serviceProductService)
  }
  public async getAllWithOptions({ request, response }: HttpContext) {
    const serviceId = request.qs().serviceId

    const query = ServiceProduct.query().preload('options')

    if (serviceId) {
      query.where('service_id', serviceId)
    }

    const serviceProducts = await query
    return response.ok(serviceProducts)
  }

  public async adminIndex({ request, response }: HttpContext) {
    const { status, search } = request.qs()

    const query = ServiceProduct.query()

    if (status) {
      query.where('status', status)
    }

    if (search) {
      query.whereILike('product_name', `%${search}%`)
    }

    const rooms = await query.orderBy('id', 'desc')

    return response.ok({ success: true, data: rooms })
  }

  public async setAvailable({ params, response }: HttpContext) {
    const serviceProduct = await ServiceProduct.find(params.id)

    if (!serviceProduct) {
      return response.notFound({ message: 'Service product not found' })
    }

    serviceProduct.status = 'available'
    await serviceProduct.save()

    return response.ok({ success: true, message: 'Room status set to available' })

  }


  public async updateStatus({ params, request, response }: HttpContext) {
    const { status } = request.only(['status'])

    const room = await ServiceProduct.findOrFail(params.id)
    room.status = status
    await room.save()

    return response.ok({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: room,
    })
  }
}
