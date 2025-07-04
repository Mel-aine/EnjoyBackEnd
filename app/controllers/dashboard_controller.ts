import { RoomAvailabilityService, RoomAnalyticsService,RevenueAnalyticsService } from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'
import { HotelAnalyticsService } from '#services/dashboard_servicedp'
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
    reservationRateLastWeek: `${stats.reservationRateLastWeek}%`,
    totalReservationsThisMonth: stats.totalReservationsThisMonth,
    totalRevenueThisMonth: stats.totalRevenueThisMonth
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

public async getRevenueStats({ params, request, response }: HttpContext) {
  try {
    const serviceId = parseInt(params.serviceId)
    const period = request.qs().period as 'monthly' | 'quarterly' | 'semester' | 'yearly'

    if (!['monthly', 'quarterly', 'semester', 'yearly'].includes(period)) {
      return response.badRequest({ success: false, message: 'Période invalide' })
    }

    const stats = await RevenueAnalyticsService.getRevenueByPeriod(serviceId, period)

    return response.ok({ success: true, data: stats })
  } catch (error) {
    return response.internalServerError({ success: false, message: error.message })
  }
} 
public async getMonthlyRevenueComparison({ params, response }: HttpContext) {
  try {
    const serviceId = parseInt(params.serviceId)
    if (!serviceId || isNaN(serviceId)) {
      return response.badRequest({ success: false, message: 'ID de service invalide' })
    }

    const stats = await RevenueAnalyticsService.getMonthlyRevenueComparison(serviceId)

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

public async averageOccupancyRate({ params, request, response }: HttpContext) {
  const serviceId = parseInt(params.serviceId)
  const period = request.qs().period as 'monthly' | 'quarterly' | 'semester' | 'yearly'

  try {
    const data = await HotelAnalyticsService.getAverageOccupancyRate(serviceId, period)

    return response.ok({
      success: true,
      data
    })
  } catch (error) {
    return response.badRequest({ success: false, message: error.message })
  }
}
 public async monthlyOccupancy({ params, response }: HttpContext) {
    const { id } = params

    try {
      const data = await HotelAnalyticsService.getMonthlyOccupancyRates(Number(id))

      return response.ok({
        success: true,
        data,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message,
      })
    }
  }
  public async getAverageDailyRate({ params, response }: HttpContext) {
    try {
      const { serviceId } = params
      const { period = 'monthly' } = params
      
      const result = await HotelAnalyticsService.getAverageDailyRate(
        Number(serviceId),
        period as 'monthly' | 'quarterly' | 'semester' | 'yearly'
      )
      
      return response.ok({
        success: true,
        data: result
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message
      })
    }
  }

//   public async getNationalityStats({ response }: HttpContext) {
//   try {
//     const stats = await HotelAnalyticsService.getNationalityStats()

//     return response.ok({
//       success: true,
//       data: stats
//     })
//   } catch (error) {
//     return response.badRequest({
//       success: false,
//       message: error.message
//     })
//   }
// }

public async stayDurationStats({ params, response }: HttpContext) {
  try {
    const { serviceId } = params

    const result = await HotelAnalyticsService.getStayDurationDistribution(Number(serviceId))

    return response.ok({
      success: true,
      data: result
    })
  } catch (error) {
    return response.badRequest({
      success: false,
      message: error.message
    })
  }
}

}