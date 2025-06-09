import type { HttpContext } from '@adonisjs/core/http'

import ServiceProduct from '#models/service_product'
import Option from '#models/option'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
const serviceProductService = new CrudService(ServiceProduct)

export default class ServiceProductsController extends CrudController<typeof ServiceProduct> {
  constructor() {
    super(serviceProductService)
  }
  // public async getAllWithOptions({ request, response }: HttpContext) {
  //   const serviceId = request.qs().serviceId

  //   const query = ServiceProduct.query().preload('options')

  // //    const query = ServiceProduct.query().preload('availableOptions', (optionQuery) => {
  // //   optionQuery.select('id', 'option_name')
  // // })

  //   if (serviceId) {
  //     query.where('service_id', serviceId)
  //   }

  //   const serviceProducts = await query
  //   return response.ok(serviceProducts)
  // }

public async getAllWithOptions({ request, response }: HttpContext) {
  const serviceId = request.qs().serviceId

  const query = ServiceProduct.query()
    .preload('options', (optionQuery) => {
      optionQuery.preload('option', (opt) => {
        opt.select(['id', 'option_name'])
      })
    })

  if (serviceId) {
    query.where('service_id', serviceId)
  }

  const serviceProducts = await query
  const formatted = serviceProducts.map(product => {
    return {
      ...product.serialize(),
      options: product.options.map(opt => ({
        optionId: opt.option_id,
        optionName: opt.option?.option_name,
        value: opt.value,
      })),
    }
  })

  return response.ok(formatted)
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

  public async getServiceProductByDate({ request, response }: HttpContext) {
    const serviceId = request.qs().serviceId
    const startDate = request.qs().start_date
    const endDate = request.qs().end_date

    if (!startDate || !endDate) {
      return response.badRequest({ message: 'start_date and end_date are required' })
    }

    const query = ServiceProduct.query()
      .preload('options')
      .preload('reservationServiceProducts', (reservationQuery) => {
        reservationQuery.select(['id', 'start_date', 'end_date', 'service_product_id'])
      })
      .whereNotExists((subquery) => {
        subquery
          .from('reservation_service_products')
          .whereRaw('reservation_service_products.service_product_id = service_products.id')
          .whereRaw('? <= reservation_service_products.end_date', [endDate])
          .whereRaw('? >= reservation_service_products.start_date', [startDate])
      })

    if (serviceId) {
      query.where('service_id', serviceId)
    }

    const serviceProducts = await query
    return response.ok({
      count: serviceProducts.length,
      serviceProducts: serviceProducts,
    })

  }

}
