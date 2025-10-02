import type { HttpContext } from '@adonisjs/core/http'
import HouseKeeperService from '#services/house_keeper_service'

const houseKeeperService = new HouseKeeperService()

export default class HouseKeepersController {
  public async index({ request, response }: HttpContext) {
    try {
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 20))
      const hotelId = request.input('hotel_id') ? Number(request.input('hotel_id')) : undefined
      const search = request.input('search')

      const data = await houseKeeperService.list({ page, limit, hotelId, search })
      return response.ok({ message: 'HouseKeepers retrieved successfully', data })
    } catch (error) {
      return response.internalServerError({ message: 'Failed to retrieve HouseKeepers', error: error.message })
    }
  }

  public async show({ params, response }: HttpContext) {
    try {
      const id = Number(params.id)
      if (Number.isNaN(id)) return response.badRequest({ message: 'Invalid id' })

      const hk = await houseKeeperService.findById(id)
      if (!hk) return response.notFound({ message: 'HouseKeeper not found' })
      return response.ok({ message: 'HouseKeeper retrieved successfully', data: hk })
    } catch (error) {
      return response.internalServerError({ message: 'Failed to retrieve HouseKeeper', error: error.message })
    }
  }

  public async store({ request, response }: HttpContext) {
    try {
      const hotel_id = Number(request.input('hotel_id'))
      const name = request.input('name')
      const phone = request.input('phone')

      if (!hotel_id || Number.isNaN(hotel_id)) {
        return response.badRequest({ message: 'hotel_id is required and must be a number' })
      }
      if (!name) return response.badRequest({ message: 'name is required' })
      if (!phone) return response.badRequest({ message: 'phone is required' })

      const hk = await houseKeeperService.create({ hotel_id, name, phone })
      return response.created({ message: 'HouseKeeper created successfully', data: hk })
    } catch (error) {
      return response.internalServerError({ message: 'Failed to create HouseKeeper', error: error.message })
    }
  }

  public async update({ params, request, response }: HttpContext) {
    try {
      const id = Number(params.id)
      if (Number.isNaN(id)) return response.badRequest({ message: 'Invalid id' })

      const payload: any = {}
      if (request.input('hotel_id') !== undefined) {
        const hotelId = Number(request.input('hotel_id'))
        if (Number.isNaN(hotelId)) return response.badRequest({ message: 'hotel_id must be a number' })
        payload.hotel_id = hotelId
      }
      if (request.input('name') !== undefined) payload.name = request.input('name')
      if (request.input('phone') !== undefined) payload.phone = request.input('phone')

      const hk = await houseKeeperService.update(id, payload)
      return response.ok({ message: 'HouseKeeper updated successfully', data: hk })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'HouseKeeper not found' })
      }
      return response.internalServerError({ message: 'Failed to update HouseKeeper', error: error.message })
    }
  }

  public async destroy({ params, response }: HttpContext) {
    try {
      const id = Number(params.id)
      if (Number.isNaN(id)) return response.badRequest({ message: 'Invalid id' })

      await houseKeeperService.delete(id)
      return response.ok({ message: 'HouseKeeper deleted successfully' })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({ message: 'HouseKeeper not found' })
      }
      return response.internalServerError({ message: 'Failed to delete HouseKeeper', error: error.message })
    }
  }
}