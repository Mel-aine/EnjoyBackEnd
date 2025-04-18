 import type { HttpContext } from '@adonisjs/core/http'

import ServiceProduct from '#models/service_product'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
const serviceProductService = new CrudService(ServiceProduct)

// export default class ServiceProductsController extends CrudController<typeof ServiceProduct> {
//   constructor() {
//     super(serviceProductService)
//   }
// }

export default class ServiceProductsController extends CrudController<typeof ServiceProduct> {
  constructor() {
    super(serviceProductService)
  }

  // public async getAllWithOptions({ response }: HttpContext) {
  //   const serviceProducts = await ServiceProduct.query().preload('options')
  //   return response.ok(serviceProducts)
  // }
  public async getAllWithOptions({ request, response }: HttpContext) {
    const serviceId = request.qs().serviceId

    const query = ServiceProduct.query().preload('options')

    if (serviceId) {
      query.where('service_id', serviceId)
    }

    const serviceProducts = await query
    return response.ok(serviceProducts)
  }

}
