import { RoomAvailabilityService, RoomAnalyticsService } from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class DashboardController {
  public async getAvailability({ params, response }: HttpContext) {
    try {
      const serviceId = parseInt(params.serviceId)
      if (!serviceId || isNaN(serviceId)) {
        return response.badRequest({ success: false, message: 'ID de service invalide' })
      }

      const stats = await RoomAvailabilityService.getHotelStats(serviceId)

      return response.ok({
  success: true,
  data: {
    availableRooms: stats.available,
    totalRooms: stats.total,
    occupiedRooms: stats.total - stats.available,
    occupancyRate: `${Math.round(((stats.total - stats.available) / stats.total) * 10000) / 100}%`,
    reservedToday: stats.reservedToday,
    reservationRateToday: `${stats.reservationRateToday}%`,
    reservationRateLastWeek: `${stats.reservationRateLastWeek}%`
  }
})

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des données'
      })
    }
  }
  public async averageStay({ params, response }: HttpContext) {
  try {
    const serviceId = parseInt(params.serviceId)
    if (!serviceId || isNaN(serviceId)) {
      return response.badRequest({ success: false, message: 'ID de service invalide' })
    }

    const averageStay = await RoomAnalyticsService.getAverageLengthOfStay(serviceId)

    return response.ok({
      success: true,
      data: {
        averageLengthOfStay: `${averageStay} jours`
      }
    })
  } catch (error) {
    return response.internalServerError({
      success: false,
      message: error.message || 'Erreur lors du calcul de la durée moyenne de séjour'
    })
  }
}


  public async occupancyStats({ request, params, response }: HttpContext) {
    try {
      const serviceId = parseInt(params.serviceId)
      const period = request.qs().period as 'weekly' | 'monthly' | 'yearly'

      if (!['weekly', 'monthly', 'yearly'].includes(period)) {
        return response.badRequest({
          success: false,
          message: 'Période invalide. Utilisez ?period=weekly|monthly|yearly'
        })
      }

      const stats = await RoomAnalyticsService.getOccupancyStats(serviceId, period)

      return response.ok({
        success: true,
        data: stats
      })

    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur serveur'
      })
    }
  }
}
