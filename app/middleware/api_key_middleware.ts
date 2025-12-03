import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Hotel from '#models/hotel'

/**
 * API Key authentication middleware for POS routes
 * Validates API key from request headers
 */
export default class ApiKeyMiddleware {
  /**
   * Handle the incoming request and validate API key
   */
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response } = ctx
    
    // Get API key from headers
    const apiKey = request.header('x-pos-api-key')
    
    if (!apiKey) {
      return response.status(401).json({
        success: false,
        message: 'POS API key is required',
        error: 'Missing x-pos-api-key in request headers'
      })
    }
    
    // Find the hotel by POS API key only (no route param needed)
    const hotel = await Hotel.query()
      .select(['id', 'pos_api_key'])
      .where('pos_api_key', apiKey!)
      .first()

    if (!hotel) {
      return response.status(401).json({
        success: false,
        message: 'Invalid POS API key',
        error: 'No hotel found for provided x-pos-api-key'
      })
    }

    // Attach the hotel to context for downstream handlers
    ;(ctx as any).hotel = hotel

    // Proceed
    await next()
  }
}
