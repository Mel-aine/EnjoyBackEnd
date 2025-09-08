import type { HttpContext } from '@adonisjs/core/http'
import Discount from '#models/discount'
import fs from 'fs/promises'
import path from 'path'

export default class ConfigurationController {
  /**
   * Get configuration data including privileges, reports, and discounts
   */
  async getConfiguration({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotel_id')

      // Read privileges from JSON file
      const privilegesPath = path.join(process.cwd(), 'data', '1-priviledger.json')
      const privilegesData = await fs.readFile(privilegesPath, 'utf-8')
      const privileges = JSON.parse(privilegesData)

      // Read reports from JSON file
      const reportsPath = path.join(process.cwd(), 'data', '1-reservation-reports.json')
      const reportsData = await fs.readFile(reportsPath, 'utf-8')
      const reports = JSON.parse(reportsData)

      // Get discounts from database
      const discountQuery = Discount.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('creator')
        .preload('modifier')

      if (hotelId) {
        discountQuery.where('hotel_id', hotelId)
      }

      const discounts = await discountQuery.orderBy('created_at', 'desc')

      return response.ok({
        success: true,
        data: {
          privileges,
          reports,
          discounts
        },
        message: 'Configuration data retrieved successfully'
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve configuration data',
        error: error.message
      })
    }
  }
}