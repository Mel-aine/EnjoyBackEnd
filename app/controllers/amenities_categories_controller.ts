import type { HttpContext } from '@adonisjs/core/http'
import AmenitiesCategory from '#models/amenities_category'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import {
    createAmenityCategoryValidator,
    updateAmenityCategoryValidator,
} from '#validators/amenity_category_validator'

const AmenityCategoryService = new CrudService(AmenitiesCategory)

export default class AmenitiesCategoriesController extends CrudController<typeof AmenitiesCategory> {
    constructor() {
        super(AmenityCategoryService)
    }

    /**
     * Create a new amenity category.
     */
    public async store({ request, response, auth }: HttpContext) {
        try {
            const payload = await request.validateUsing(createAmenityCategoryValidator)
            const data = {
                ...payload,
                created_by: auth.user?.id || null,
                last_modified_by: auth.user?.id || null,
            }

            const amenityCategory = await AmenityCategoryService.create(data)
            return response.created(amenityCategory)
        } catch (error) {
            if (error.name === 'E_VALIDATION_ERROR') {
                return response.badRequest(error.messages)
            }
            return response.internalServerError({ message: 'Error creating amenity category', error })
        }
    }

    /**
     * Update an existing amenity category.
     */
    public async update({ params, request, response, auth }: HttpContext) {
        try {
            const payload = await request.validateUsing(updateAmenityCategoryValidator)
            const data = {
                ...payload,
                last_modified_by: auth.user?.id || null,
            }

            const amenityCategory = await AmenityCategoryService.update(params.id, data)
            if (!amenityCategory) {
                return response.notFound({ message: 'Amenity category not found' })
            }
            return response.ok(amenityCategory)
        } catch (error) {
            if (error.name === 'E_VALIDATION_ERROR') {
                return response.badRequest(error.messages)
            }
            return response.internalServerError({ message: 'Error updating amenity category', error })
        }
    }

    /**
     * Find amenities categories by service ID.
     */
    public async getByService({ params, response }: HttpContext) {
        try {
            const { serviceId } = params

            if (!serviceId) {
                return response.badRequest({ message: 'Service ID is required.' })
            }

            const numericServiceId = Number(serviceId)
            if (isNaN(numericServiceId)) {
                return response.badRequest({ message: 'Invalid Service ID.' })
            }

            const categories = await AmenitiesCategory.query().where('service_id', numericServiceId)

            return response.ok(categories)
        } catch (error) {
            console.error('Error fetching amenity categories by service ID:', error)
            return response.internalServerError({ message: 'Failed to fetch amenity categories.', error: error.message })
        }
    }
}