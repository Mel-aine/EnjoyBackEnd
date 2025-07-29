import type { HttpContext } from '@adonisjs/core/http'
import AmenityProduct from '#models/amenity_product'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import {
  createAmenityProductValidator,
  updateAmenityProductValidator,
} from '#validators/amenity_product_validator'

const AmenityProductService = new CrudService(AmenityProduct)

export default class AmenityProductsController extends CrudController<typeof AmenityProduct> {
  constructor() {
    super(AmenityProductService)
  }

  public async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createAmenityProductValidator)
      const data = {
        ...payload,
        created_by: auth.user?.id || null,
        last_modified_by: auth.user?.id || null,
      }

      const amenityProduct = await AmenityProductService.create(data)
      return response.created(amenityProduct)
    } catch (error) {
      if (error.name === 'E_VALIDATION_ERROR') {
        return response.badRequest(error.messages)
      }
      return response.internalServerError({ message: 'Error creating amenity product', error })
    }
  }

  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateAmenityProductValidator)
      const data = {
        ...payload,
        last_modified_by: auth.user?.id || null,
      }

      const amenityProduct = await AmenityProductService.update(params.id, data)
      if (!amenityProduct) {
        return response.notFound({ message: 'Amenity product not found' })
      }
      return response.ok(amenityProduct)
    } catch (error) {
      if (error.name === 'E_VALIDATION_ERROR') {
        return response.badRequest(error.messages)
      }
      return response.internalServerError({ message: 'Error updating amenity product', error })
    }
  }

  /**
   * Get amenity products by service and category.
   */
  public async getByServiceAndCategory({ params, response }: HttpContext) {
    try {
      const { serviceId, categoryId } = params
      const products = await AmenityProduct.query()
        .where('service_id', serviceId)
        .where('amenities_category_id', categoryId)

      return response.ok(products)
    } catch (error) {
      return response.internalServerError({ message: 'Failed to fetch amenity products.', error })
    }
  }

  /**
   * Search amenity products by name within a service.
   */
  public async searchByName({ params, request, response }: HttpContext) {
    try {
      const { serviceId } = params
      const { name } = request.qs()

      if (!name) {
        return response.badRequest({ message: 'Search term "name" is required.' })
      }

      const products = await AmenityProduct.query()
        .where('service_id', serviceId)
        .where('name', 'ILIKE', `%${name}%`)

      return response.ok(products)
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to search for amenity products.',
        error,
      })
    }
  }
}
