import { RoomAvailabilityService, RoomAnalyticsService, RevenueAnalyticsService } from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'
import { HotelAnalyticsDashboardService } from '#services/dasboard_servicepd'
import { HotelAnalyticsService } from '#services/hotel_analytics_service'
import { DateTime } from 'luxon'
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
    totalRevenueThisMonth: stats.totalRevenueThisMonth,
    revenueGrowthRate: `${stats.revenueGrowthRate}`
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
    const data = await HotelAnalyticsDashboardService.getAverageOccupancyRate(serviceId, period)

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
      const data = await HotelAnalyticsDashboardService.getMonthlyOccupancyRates(Number(id))

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
      
      const result = await HotelAnalyticsDashboardService.getAverageDailyRate(
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

  public async nationalityStats({ params, response }: HttpContext) {
  const serviceId = Number(params.serviceId)

  if (!serviceId) {
    return response.badRequest({ success: false, message: 'Service ID invalide' })
  }

  const data = await HotelAnalyticsDashboardService.getNationalityStats(serviceId)

  return response.ok({ success: true, data })
}


public async stayDurationStats({ params, response }: HttpContext) {
  try {
    const { serviceId } = params

    const result = await HotelAnalyticsDashboardService.getStayDurationDistribution(Number(serviceId))

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


  public async yearlyReservationTypes({ params, request, response }: HttpContext) {
  const serviceId = Number(params.serviceId)
  const year = Number(request.input('year')) || DateTime.now().year

  if (!serviceId) {
    return response.badRequest({ success: false, message: 'Service ID invalide' })
  }

  const data = await HotelAnalyticsDashboardService.getYearlyReservationTypesStats(serviceId, year)

  return response.ok({ success: true, data })
}

  public async getDailyOccupancyAndReservations({ params, request, response }: HttpContext) {
    const { serviceId } = params
    const { start_date, end_date } = request.qs()

    if (!serviceId) {
      return response.badRequest({ message: 'serviceId is required.' })
    }
    if (!start_date || !end_date) {
      return response.badRequest({ message: 'start_date and end_date are required.' })
    }

    try {
      const startDateDt = DateTime.fromISO(start_date)
      const endDateDt = DateTime.fromISO(end_date)

      if (!startDateDt.isValid || !endDateDt.isValid) {
        return response.badRequest({ message: 'Invalid date format.' })
      }

      const data = await HotelAnalyticsService.getDailyOccupancyAndReservations(
        Number(serviceId),
        startDateDt,
        endDateDt
      )

      return response.ok(data)
    } catch (error) {
      console.error('Error fetching daily occupancy and reservations:', error)
      return response.internalServerError({
        message: 'Failed to fetch data.',
        error: error.message,
      })
    }
  }
}
