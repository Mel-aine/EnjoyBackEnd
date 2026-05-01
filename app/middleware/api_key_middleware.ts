import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Hotel from '#models/hotel'
import env from '#start/env'

/**
 * API Key authentication middleware for integrations (POS, Enjoy Rental)
 * Validates API key from request headers
 */
export default class ApiKeyMiddleware {
  /**
   * Handle the incoming request and validate API key
   */
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx

    const enjoyRentalApiKey = request.header('x-enjoy-rental-api-key')
    if (enjoyRentalApiKey) {
      const expected = env.get('ENJOY_RENTAL_API_KEY')
      if (!expected) {
        return response.status(500).json({
          success: false,
          message: 'Enjoy Rental API key is not configured',
        })
      }

      if (enjoyRentalApiKey !== expected) {
        return response.status(401).json({
          success: false,
          message: 'Invalid Enjoy Rental API key',
          error: 'Provided x-enjoy-rental-api-key does not match',
        })
      }

      ;(ctx as any).enjoyRental = true
      await next()
      return
    }

    const posApiKey = request.header('x-pos-api-key')
    if (!posApiKey) {
      return response.status(401).json({
        success: false,
        message: 'API key is required',
        error: 'Missing x-pos-api-key or x-enjoy-rental-api-key in request headers',
      })
    }

    const hotel = await Hotel.query().select(['id', 'pos_api_key']).where('pos_api_key', posApiKey).first()

    if (!hotel) {
      return response.status(401).json({
        success: false,
        message: 'Invalid POS API key',
        error: 'No hotel found for provided x-pos-api-key',
      })
    }

    ;(ctx as any).hotel = hotel
    await next()
  }
}
