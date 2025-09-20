import { RoomAvailabilityService, RoomAnalyticsService } from '#services/dashboard_service'
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
          revenueGrowthRate: `${stats.revenueGrowthRate}`,
        },
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des données',
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
          averageLengthOfStay: `${averageStay} jours`,
        },
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors du calcul de la durée moyenne de séjour',
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
          message: 'Période invalide. Utilisez ?period=weekly|monthly|yearly',
        })
      }

      const stats = await RoomAnalyticsService.getOccupancyStats(serviceId, period)

      return response.ok({
        success: true,
        data: stats,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur serveur',
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

      return response.ok({ success: true, data: [] })
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

      return response.ok({
        success: true,
        data: [],
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur serveur',
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
        data,
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
        data: result,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message,
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

      const result = await HotelAnalyticsDashboardService.getStayDurationDistribution(
        Number(serviceId)
      )

      return response.ok({
        success: true,
        data: result,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message,
      })
    }
  }

  public async yearlyReservationTypes({ params, request, response }: HttpContext) {
    const serviceId = Number(params.serviceId)
    const year = Number(request.input('year')) || DateTime.now().year

    if (!serviceId) {
      return response.badRequest({ success: false, message: 'Service ID invalide' })
    }

    const data = await HotelAnalyticsDashboardService.getYearlyReservationTypesStats(
      serviceId,
      year
    )

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
  public async getFrontOfficeDashboard({ params, response, request }: HttpContext) {
    try {
      const serviceId = parseInt(params.serviceId)
      if (!serviceId || isNaN(serviceId)) {
        return response.badRequest({ success: false, message: 'ID de service invalide' })
      }

      // Get date from query params or use today
      const dateParam = request.qs().date
      const selectedDate = dateParam ? DateTime.fromISO(dateParam) : DateTime.now()
      const today = selectedDate.startOf('day')
      const tomorrow = today.plus({ days: 1 })
      const yesterday = today.minus({ days: 1 })
      const weekAgo = today.minus({ days: 7 })

      // Check if date is valid
      if (!selectedDate.isValid) {
        return response.badRequest({ success: false, message: 'Date invalide' })
      }

      // Arrival Statistics - Updated logic
      const arrivalsQuery = Reservation.query()
        .where('hotel_id', serviceId)
        .whereNotNull('hotel_id')
        .where('check_in_date', today.toSQLDate())
        .whereIn('status', ['confirmed', 'checked_in'])

      const arrivalPending = await arrivalsQuery
        .clone()
        .where('status', 'confirmed')
        .count('* as total')
      const arrivalCheckedIn = await arrivalsQuery
        .clone()
        .where('status', 'checked_in')
        .count('* as total')
      const totalArrivals = await arrivalsQuery.count('* as total')

      // Departure Statistics - Updated logic
      const departuresQuery = Reservation.query()
        .where('hotel_id', serviceId)
        .whereNotNull('hotel_id')
        .where('check_out_date', today.toSQLDate())
        .whereIn('status', ['checked_in', 'checked_out'])

      const departurePending = await departuresQuery
        .clone()
        .where('status', 'checked_in')
        .count('* as total')
      const departureCheckedOut = await departuresQuery
        .clone()
        .where('status', 'checked_out')
        .count('* as total')
      const totalDepartures = await departuresQuery.count('* as total')

      // In-house guests (currently checked in)
      const inHouseQuery = Reservation.query()
        .where('hotel_id', serviceId)
        .whereNotNull('hotel_id')
        .where('status', 'checked_in')
        .where('check_in_date', '<=', today.toSQLDate())
        .where('check_out_date', '>', today.toSQLDate())

      const guestInHouseAdult = await inHouseQuery.clone().sum('adults as total')
      const guestInHouseChild = await inHouseQuery.clone().sum('children as total')
      const totalInHouse = await inHouseQuery.count('* as total')

      // Room Statistics with specific room numbers (101-106, 201-202)
      const targetRooms = ['101', '102', '103', '104', '105', '106', '201', '202']

      const roomStatusVacant = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('status', 'available')
        .count('* as total')

      const roomStatusSold = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('status', 'occupied')
        .count('* as total')

      const roomStatusDayUse = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('status', 'day_use')
        .count('* as total')

      const roomStatusComplimentary = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('status', 'complimentary')
        .count('* as total')

      const roomStatusBlocked = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('status', 'blocked')
        .count('* as total')

      // Maintenance rooms
      // const roomsInMaintenance = await Room.query()
      //   .where('hotel_id', serviceId)
      //   .whereIn('room_number', targetRooms)
      //   .where('maintenance_status', 'in_maintenance')
      //   .count('* as total')

      // Total rooms for occupancy calculation
      const totalRoomsCount = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .count('* as total')

      const totalRooms = Number(totalRoomsCount[0].$extras.total || '0')
      const occupiedRooms =
        Number(roomStatusSold[0].$extras.total || '0') +
        Number(roomStatusDayUse[0].$extras.total || '0') +
        Number(roomStatusComplimentary[0].$extras.total || '0')

      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

      // Revenue Statistics (BO vs BB rates)
      const revenueBO = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('check_in_date', today.toSQLDate())
        .where('rate_type', 'BO') // Bed Only
        .sum('total_amount as total')

      const revenueBB = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('check_in_date', today.toSQLDate())
        .where('rate_type', 'BB') // Bed & Breakfast
        .sum('total_amount as total')

      // Suite-specific occupancy (Home Suite, Lifestyle Suite)
      const homeSuiteOccupancy = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .whereHas('room', (query) => {
          query.where('room_type', 'Home Suite')
        })
        .count('* as total')

      const lifestyleSuiteOccupancy = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .whereHas('room', (query) => {
          query.where('room_type', 'Lifestyle Suite')
        })
        .count('* as total')

      // Housekeeping Status for target rooms
      const housekeepingClean = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('housekeeping_status', 'clean')
        .count('* as total')

      const housekeepingInspected = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('housekeeping_status', 'inspected')
        .count('* as total')

      const housekeepingDirty = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .where('housekeeping_status', 'dirty')
        .count('* as total')

      const housekeepingToClean = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('room_number', targetRooms)
        .whereIn('housekeeping_status', ['dirty', 'checkout'])
        .count('* as total')

      // Unpaid Folios
      // const unpaidFolios = await Folio.query()
      //   .where('hotel_id', serviceId)
      //   .where('payment_status', 'unpaid')
      //   .whereNotNull('total_amount')
      //   .where('total_amount', '>', 0)
      //   .count('* as total')

      // Overbooked rooms alert
      const overbookedRooms = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'overbooked')
        .where('check_in_date', today.toSQLDate())
        .count('* as total')

      // Weekly data (7 days)
      const weeklyData = []
      for (let i = 6; i >= 0; i--) {
        const date = today.minus({ days: i })
        const dayArrivals = await Reservation.query()
          .where('hotel_id', serviceId)
          .where('check_in_date', date.toSQLDate())
          .whereIn('status', ['confirmed', 'checked_in', 'checked_out'])
          .count('* as total')

        const dayDepartures = await Reservation.query()
          .where('hotel_id', serviceId)
          .where('check_out_date', date.toSQLDate())
          .whereIn('status', ['checked_out'])
          .count('* as total')

        weeklyData.push({
          date: date.toFormat('yyyy-MM-dd'),
          arrivals: Number(dayArrivals[0].$extras.total || '0'),
          departures: Number(dayDepartures[0].$extras.total || '0'),
        })
      }

      // Critical alerts
      const alerts = []

      if (Number(overbookedRooms[0].$extras.total || '0') > 0) {
        alerts.push({
          type: 'critical',
          message: `${overbookedRooms[0].$extras.total} réservation(s) en surréservation`,
          count: Number(overbookedRooms[0].$extras.total || '0'),
        })
      }

      if (Number(unpaidFolios[0].$extras.total || '0') > 0) {
        alerts.push({
          type: 'warning',
          message: `${unpaidFolios[0].$extras.total} folio(s) impayé(s)`,
          count: Number(unpaidFolios[0].$extras.total || '0'),
        })
      }

      if (Number(roomsInMaintenance[0].$extras.total || '0') > 0) {
        alerts.push({
          type: 'info',
          message: `${roomsInMaintenance[0].$extras.total} chambre(s) en maintenance`,
          count: Number(roomsInMaintenance[0].$extras.total || '0'),
        })
      }

      // Notifications with updated counts
      const workOrders = await Task.query()
        .where('hotel_id', serviceId)
        .where('task_type', 'maintenance')
        .where('status', '!=', 'done')
        .count('* as total')

      const bookingInquiry = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'inquiry')
        .count('* as total')

      const paymentFailed = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('payment_status', 'failed')
        .count('* as total')

      const guestPortal = await Guest.query()
        .whereHas('reservations', (query) => {
          query.where('hotel_id', serviceId).where('status', 'checked_in')
        })
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

      // Recent Activity Feed with current user info
      const recentActivities = await ActivityLog.query()
        .where('hotel_id', serviceId)
        .whereRaw('DATE(created_at) = ?', [today.toSQLDate()])
        .orderBy('created_at', 'desc')
        .limit(10)
        .preload('user')

      // Performance metrics
      const performanceStart = Date.now()
      const performanceEnd = Date.now()
      const loadTime = performanceEnd - performanceStart

      return response.ok({
        success: true,
        data: {
          // Basic stats
          arrival: {
            pending: Number(arrivalPending[0].$extras.total || '0'),
            arrived: Number(arrivalCheckedIn[0].$extras.total || '0'),
            total: Number(totalArrivals[0].$extras.total || '0'),
          },
          departure: {
            pending: Number(departurePending[0].$extras.total || '0'),
            checkedOut: Number(departureCheckedOut[0].$extras.total || '0'),
            total: Number(totalDepartures[0].$extras.total || '0'),
          },
          guestInHouse: {
            adult: Number(guestInHouseAdult[0].$extras.total || '0'),
            child: Number(guestInHouseChild[0].$extras.total || '0'),
            total: Number(totalInHouse[0].$extras.total || '0'),
            totalGuests:
              Number(guestInHouseAdult[0].$extras.total || '0') +
              Number(guestInHouseChild[0].$extras.total || '0'),
          },
          roomStatus: {
            vacant: Number(roomStatusVacant[0].$extras.total || '0'),
            sold: Number(roomStatusSold[0].$extras.total || '0'),
            dayUse: Number(roomStatusDayUse[0].$extras.total || '0'),
            complimentary: Number(roomStatusComplimentary[0].$extras.total || '0'),
            blocked: Number(roomStatusBlocked[0].$extras.total || '0'),
            maintenance: Number(roomsInMaintenance[0].$extras.total || '0'),
            total: totalRooms,
            occupancyRate: occupancyRate,
          },
          housekeepingStatus: {
            clean: Number(housekeepingClean[0].$extras.total || '0'),
            inspected: Number(housekeepingInspected[0].$extras.total || '0'),
            dirty: Number(housekeepingDirty[0].$extras.total || '0'),
            toClean: Number(housekeepingToClean[0].$extras.total || '0'),
          },
          // Revenue data
          revenue: {
            bo: Number(revenueBO[0].$extras.total || '0'),
            bb: Number(revenueBB[0].$extras.total || '0'),
            total:
              Number(revenueBO[0].$extras.total || '0') + Number(revenueBB[0].$extras.total || '0'),
          },
          // Suite occupancy
          suites: {
            homeSuite: Number(homeSuiteOccupancy[0].$extras.total || '0'),
            lifestyleSuite: Number(lifestyleSuiteOccupancy[0].$extras.total || '0'),
          },
          // Weekly trends
          weeklyTrends: weeklyData,
          // Alerts and notifications
          alerts: alerts,
          notifications: {
            workOrder: Number(workOrders[0].$extras.total || '0'),
            bookingInquiry: Number(bookingInquiry[0].$extras.total || '0'),
            paymentFailed: Number(paymentFailed[0].$extras.total || '0'),
            overbooking: Number(overbookedRooms[0].$extras.total || '0'),
            guestPortal: Number(guestPortal[0].$extras.total || '0'),
            guestMessage: Number(guestMessage[0].$extras.total || '0'),
            cardkeyFailed: Number(cardkeyFailed[0].$extras.total || '0'),
            tasks: Number(tasksCount[0].$extras.total || '0'),
            review: Number(reviewCount[0].$extras.total || '0'),
            unpaidFolios: Number(unpaidFolios[0].$extras.total || '0'),
          },
          activityFeeds: recentActivities.map((activity) => ({
            id: activity.id,
            description: activity.description,
            action: activity.action,
            user: activity.user?.username || 'System',
            timestamp: activity.createdAt.toFormat('HH:mm'),
            type: this.getActivityType(activity.action),
            date: activity.createdAt.toFormat('yyyy-MM-dd'),
          })),
          // Metadata
          metadata: {
            selectedDate: today.toFormat('yyyy-MM-dd'),
            isToday: today.hasSame(DateTime.now(), 'day'),
            isPastDate: today < DateTime.now().startOf('day'),
            isFutureDate: today > DateTime.now().startOf('day'),
            loadTime: loadTime,
            targetRooms: targetRooms,
            lastUpdated: DateTime.now().toISO(),
          },
        },
      })
    } catch (error) {
      console.error('Error fetching front office dashboard data:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des données du dashboard',
      })
    }
  }

  // Helper method for activity types
  private getActivityType(action: string): string {
    const typeMap = {
      check_in: 'arrival',
      check_out: 'departure',
      reservation_created: 'booking',
      reservation_modified: 'modification',
      reservation_cancelled: 'cancellation',
      payment_received: 'payment',
      maintenance_request: 'maintenance',
      housekeeping_update: 'housekeeping',
      guest_message: 'communication',
      default: 'system',
    }
    return typeMap[action] || typeMap['default']
  }


}
