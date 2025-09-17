import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

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
    const apiKey = request.header('x-api-key') || request.header('api-key')
    
    if (!apiKey) {
      return response.status(401).json({
        success: false,
        message: 'API key is required',
        error: 'Missing API key in request headers'
      })
    }
    
    // Validate API key (you can customize this validation logic)
    const validApiKeys = [
      process.env.POS_API_KEY,
      process.env.MASTER_API_KEY,
      // Add more valid API keys as needed
    ].filter(Boolean)
    
    if (!validApiKeys.includes(apiKey)) {
      return response.status(401).json({
        success: false,
        message: 'Invalid API key',
        error: 'The provided API key is not valid'
      })
    }
    
    // API key is valid, proceed to next middleware/controller
    await next()
  }
}