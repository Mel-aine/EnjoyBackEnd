import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import IpConfiguration from '#models/ip_configuration'

const createValidator = vine.compile(
  vine.object({
    ipAddress: vine.string().trim().minLength(3),
    ipRequestFrom: vine.string().trim().minLength(3),
    description: vine.string().optional(),
  })
)

const updateValidator = vine.compile(
  vine.object({
    ipAddress: vine.string().trim().minLength(3).optional(),
    ipRequestFrom: vine.string().trim().minLength(3).optional(),
    description: vine.string().optional(),
  })
)

export default class IpConfigurationsController {
  async index({ params, request, response }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      const page = Number(request.input('page', 1))
      const limit = Number(request.input('limit', 10))

      if (!hotelId) {
        return response.badRequest({ message: 'hotelId is required in route params' })
      }

      const query = IpConfiguration.query().where('hotel_id', hotelId)
      const ipConfigs = await query.orderBy('created_at', 'desc').paginate(page, limit)

      return response.ok({ message: 'IP configurations retrieved', data: ipConfigs })
    } catch (error) {
      return response.badRequest({ message: 'Failed to retrieve IP configurations', error: (error as any).message })
    }
  }

  async show({ params, response }: HttpContext) {
    try {
      const id = Number(params.id)
      const record = await IpConfiguration.findOrFail(id)
      return response.ok({ message: 'IP configuration', data: record })
    } catch {
      return response.notFound({ message: 'IP configuration not found' })
    }
  }

  async store({ params, request, response, auth }: HttpContext) {
    try {
      const hotelId = Number(params.hotelId)
      if (!hotelId) return response.badRequest({ message: 'hotelId is required in route params' })

      const payload = await request.validateUsing(createValidator)

      const rec = await IpConfiguration.create({
        hotelId,
        ipAddress: payload.ipAddress,
        ipRequestFrom: payload.ipRequestFrom,
        description: payload.description || null,
        createdByUserId: auth?.user?.id || null,
        updatedByUserId: auth?.user?.id || null,
      })
      return response.created({ message: 'IP configuration created', data: rec })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({ message: 'Validation failed', errors: (error as any).messages })
      }
      return response.badRequest({ message: 'Failed to create IP configuration', error: (error as any).message })
    }
  }

  async update({ params, request, response, auth }: HttpContext) {
    try {
      const id = Number(params.id)
      const payload = await request.validateUsing(updateValidator)
      const rec = await IpConfiguration.findOrFail(id)
      rec.ipAddress = payload.ipAddress ?? rec.ipAddress
      rec.ipRequestFrom = payload.ipRequestFrom ?? rec.ipRequestFrom
      rec.description = payload.description ?? rec.description
      rec.updatedByUserId = auth?.user?.id || rec.updatedByUserId
      await rec.save()
      return response.ok({ message: 'IP configuration updated', data: rec })
    } catch (error) {
      if ((error as any).code === 'E_VALIDATION_ERROR') {
        return response.badRequest({ message: 'Validation failed', errors: (error as any).messages })
      }
      return response.badRequest({ message: 'Failed to update IP configuration', error: (error as any).message })
    }
  }

  async destroy({ params, response }: HttpContext) {
    try {
      const id = Number(params.id)
      const rec = await IpConfiguration.findOrFail(id)
      await rec.delete()
      return response.ok({ message: 'IP configuration deleted' })
    } catch (error) {
      return response.badRequest({ message: 'Failed to delete IP configuration', error: (error as any).message })
    }
  }
}