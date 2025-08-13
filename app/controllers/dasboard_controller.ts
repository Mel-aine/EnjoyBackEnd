import { RoomAvailabilityService, RoomAnalyticsService, RevenueAnalyticsService } from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'
import { HotelAnalyticsDashboardService } from '#services/dasboard_servicepd'
import { HotelAnalyticsService } from '#services/hotel_analytics_service'
import { DateTime } from 'luxon'
import Task from '#models/task'
import Reservation from '#models/reservation'
import Room from '#models/room'
import ActivityLog from '#models/activity_log'
import Guest from '#models/guest'
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

public async customerTypeStats({ params, response }: HttpContext) {
  const serviceId = Number(params.serviceId)
  if (!serviceId) {
    return response.badRequest({ success: false, message: 'Service ID invalide' })
  }
  const data = await HotelAnalyticsDashboardService.getCustomerTypeStats(serviceId)
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

  /**
   * Front Office Dashboard - Comprehensive dashboard data for front office operations
   * Returns all necessary data for the front office dashboard including:
   * - Arrival/Departure statistics
   * - Guest in house count
   * - Room status breakdown
   * - Housekeeping status
   * - Notifications (work orders, bookings, payments, etc.)
   * - Activity feeds
   */
  public async getFrontOfficeDashboard({ params, response }: HttpContext) {
    try {
      const serviceId = parseInt(params.serviceId)
      if (!serviceId || isNaN(serviceId)) {
        return response.badRequest({ success: false, message: 'ID de service invalide' })
      }

      const today = DateTime.now().startOf('day')
      const tomorrow = today.plus({ days: 1 })

      // Arrival Statistics
      const arrivalPending = await Reservation.query()
        .where('service_id', serviceId)
        .where('check_in_date', today.toSQLDate())
        .where('status', 'confirmed')
        .count('* as total')

      const arrivalCheckedIn = await Reservation.query()
        .where('service_id', serviceId)
        .where('check_in_date', today.toSQLDate())
        .where('status', 'checked_in')
        .count('* as total')

      // Departure Statistics
      const departurePending = await Reservation.query()
        .where('service_id', serviceId)
        .where('check_out_date', today.toSQLDate())
        .where('status', 'checked_in')
        .count('* as total')

      const departureCheckedOut = await Reservation.query()
        .where('service_id', serviceId)
        .where('check_out_date', today.toSQLDate())
        .where('status', 'checked_out')
        .count('* as total')

      // Guest In House Statistics
      const guestInHouseAdult = await Reservation.query()
        .where('service_id', serviceId)
        .where('status', 'checked_in')
        .sum('adults as total')

      const guestInHouseChild = await Reservation.query()
        .where('service_id', serviceId)
        .where('status', 'checked_in')
        .sum('children as total')

      // Room Status Statistics
      const roomStatusVacant = await Room.query()
        .where('service_id', serviceId)
        .where('status', 'available')
        .where('availability', true)
        .count('* as total')

      const roomStatusSold = await Room.query()
        .where('service_id', serviceId)
        .where('status', 'occupied')
        .count('* as total')

      const roomStatusDayUse = await Room.query()
        .where('service_id', serviceId)
        .where('status', 'day_use')
        .count('* as total')

      const roomStatusComplimentary = await Room.query()
        .where('service_id', serviceId)
        .where('status', 'complimentary')
        .count('* as total')

      const roomStatusBlocked = await Room.query()
        .where('service_id', serviceId)
        .where('status', 'blocked')
        .count('* as total')

      // Housekeeping Status
      const housekeepingClean = await Room.query()
        .where('service_id', serviceId)
        .where('housekeeping_status', 'clean')
        .count('* as total')

      const housekeepingInspected = await Room.query()
        .where('service_id', serviceId)
        .where('housekeeping_status', 'inspected')
        .count('* as total')

      const housekeepingDirty = await Room.query()
        .where('service_id', serviceId)
        .where('housekeeping_status', 'dirty')
        .count('* as total')

      const housekeepingBlocked = await Room.query()
        .where('service_id', serviceId)
        .where('housekeeping_status', 'blocked')
        .count('* as total')

      // Notifications
      const workOrders = await Task.query()
        .where('hotel_id', serviceId)
        .where('task_type', 'maintenance')
        .where('status', '!=', 'done')
        .count('* as total')

      const bookingInquiry = await Reservation.query()
        .where('service_id', serviceId)
        .where('status', 'inquiry')
        .count('* as total')

      const paymentFailed = await Reservation.query()
        .where('service_id', serviceId)
        .where('payment_status', 'failed')
        .count('* as total')

      const overbooking = await Reservation.query()
        .where('service_id', serviceId)
        .where('status', 'overbooked')
        .count('* as total')

      const guestPortal = await Guest.query()
        .whereHas('reservations', (query) => {
          query.where('service_id', serviceId)
            .where('status', 'checked_in')
        })
        .where('portal_access_requested', true)
        .count('* as total')

      const guestMessage = await ActivityLog.query()
        .where('entity_type', 'guest_message')
        .where('action', 'unread')
        .whereRaw('DATE(created_at) = ?', [today.toSQLDate()])
        .count('* as total')

      const cardkeyFailed = await Task.query()
        .where('hotel_id', serviceId)
        .where('task_type', 'cardkey_issue')
        .where('status', '!=', 'done')
        .count('* as total')

      const tasksCount = await Task.query()
        .where('hotel_id', serviceId)
        .where('status', '!=', 'done')
        .count('* as total')

      const reviewCount = await ActivityLog.query()
        .where('entity_type', 'review')
        .where('action', 'pending')
        .whereRaw('DATE(created_at) = ?', [today.toSQLDate()])
        .count('* as total')

      // Recent Activity Feed
      const recentActivities = await ActivityLog.query()
        .where('entity_type', 'guest')
        .whereRaw('DATE(created_at) = ?', [today.toSQLDate()])
        .orderBy('created_at', 'desc')
        .limit(10)
        .preload('user')

      return response.ok({
        success: true,
        data: {
          arrival: {
            pending: Number(arrivalPending[0].$extras.total || '0'),
            arrived: Number(arrivalCheckedIn[0].$extras.total || '0'),
            total: Number(arrivalPending[0].$extras.total || '0') + Number(arrivalCheckedIn[0].$extras.total || '0')
          },
          checkedOut: {
            pending: Number(departurePending[0].$extras.total || '0'),
            checkedOut: Number(departureCheckedOut[0].$extras.total || '0'),
            total: Number(departurePending[0].$extras.total || '0') + Number(departureCheckedOut[0].$extras.total || '0')
          },
          guestInHouse: {
            adult: Number(guestInHouseAdult[0].$extras.total || '0'),
            child: Number(guestInHouseChild[0].$extras.total || '0'),
            total: Number(guestInHouseAdult[0].$extras.total || '0') + Number(guestInHouseChild[0].$extras.total || '0')
          },
          roomStatus: {
            vacant: Number(roomStatusVacant[0].$extras.total || '0'),
            sold: Number(roomStatusSold[0].$extras.total || '0'),
            dayUse: Number(roomStatusDayUse[0].$extras.total || '0'),
            complimentary: Number(roomStatusComplimentary[0].$extras.total || '0'),
            blocked: Number(roomStatusBlocked[0].$extras.total || '0')
          },
          housekeepingStatus: {
            clean: Number(housekeepingClean[0].$extras.total || '0'),
            inspected: Number(housekeepingInspected[0].$extras.total || '0'),
            dirty: Number(housekeepingDirty[0].$extras.total || '0'),
            blocked: Number(housekeepingBlocked[0].$extras.total || '0')
          },
          notifications: {
            workOrder: Number(workOrders[0].$extras.total || '0'),
            bookingInquiry: Number(bookingInquiry[0].$extras.total || '0'),
            paymentFailed: Number(paymentFailed[0].$extras.total || '0'),
            overbooking: Number(overbooking[0].$extras.total || '0'),
            guestPortal: Number(guestPortal[0].$extras.total || '0'),
            guestMessage: Number(guestMessage[0].$extras.total || '0'),
            cardkeyFailed: Number(cardkeyFailed[0].$extras.total || '0'),
            tasks: Number(tasksCount[0].$extras.total || '0'),
            review: Number(reviewCount[0].$extras.total || '0')
          },
          activityFeeds: recentActivities.map(activity => ({
            id: activity.id,
            description: activity.description,
            action: activity.action,
            user: activity.user?.username || 'System',
            timestamp: activity.createdAt.toFormat('HH:mm'),
            type: this.getActivityType(activity.action)
          }))
        }
      })
    } catch (error) {
      console.error('Error fetching front office dashboard data:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des données du dashboard'
      })
    }
  }

  private getActivityType(action: string): string {
    const actionTypes: Record<string, string> = {
      'checked_out': 'Checked Out',
      'checked_in': 'Checked In',
      'reservation_created': 'Reservation',
      'payment_received': 'Payment',
      'room_assigned': 'Room Assignment',
      'guest_message': 'Message',
      'maintenance_request': 'Maintenance'
    }
    return actionTypes[action] || 'Activity'
  }
}
