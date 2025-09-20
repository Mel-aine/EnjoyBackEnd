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
import Folio from '#models/folio'
import ReservationRoom from '#models/reservation_room'
import RoomRate from '#models/room_rate'
import RoomType from '#models/room_type'
import WorkOrder from '#models/work_order'
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

      // Enhanced date handling with range support
      const dateParam = request.qs().date
      const rangeParam = request.qs().range || 'today'

      let selectedDate: DateTime
      let startDate: DateTime
      let endDate: DateTime

      // Handle different date ranges
      const today = DateTime.now().startOf('day')

      switch (rangeParam) {
        case 'today':
          selectedDate = today
          startDate = today
          endDate = today.endOf('day')
          break
        case 'yesterday':
          selectedDate = today.minus({ days: 1 })
          startDate = selectedDate
          endDate = selectedDate.endOf('day')
          break
        case 'thisWeek':
          selectedDate = today.startOf('week')
          startDate = selectedDate
          endDate = today.endOf('week')
          break
        case 'lastWeek':
          selectedDate = today.minus({ weeks: 1 }).startOf('week')
          startDate = selectedDate
          endDate = selectedDate.endOf('week')
          break
        case 'thisMonth':
          selectedDate = today.startOf('month')
          startDate = selectedDate
          endDate = today.endOf('month')
          break
        case 'lastMonth':
          selectedDate = today.minus({ months: 1 }).startOf('month')
          startDate = selectedDate
          endDate = selectedDate.endOf('month')
          break
        case 'custom':
          if (dateParam) {
            selectedDate = DateTime.fromISO(dateParam)
            if (!selectedDate.isValid) {
              return response.badRequest({ success: false, message: 'Date invalide' })
            }
            startDate = selectedDate.startOf('day')
            endDate = selectedDate.endOf('day')
          } else {
            selectedDate = today
            startDate = today
            endDate = today.endOf('day')
          }
          break
        default:
          selectedDate = dateParam ? DateTime.fromISO(dateParam) : today
          if (!selectedDate.isValid) {
            return response.badRequest({ success: false, message: 'Date invalide' })
          }
          startDate = selectedDate.startOf('day')
          endDate = selectedDate.endOf('day')
      }

      const targetDate = startDate.toSQLDate()!
      const tomorrow = startDate.plus({ days: 1 })
      const yesterday = startDate.minus({ days: 1 })

      // Performance tracking
      const performanceStart = Date.now()

      // Arrival Statistics - Enhanced for date ranges
      const arrivalsQuery = Reservation.query()
        .where('hotel_id', serviceId)
        .whereNotNull('hotel_id')
        .where('arrived_date', targetDate)
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

      // Departure Statistics - Enhanced for date ranges
      const departuresQuery = Reservation.query()
        .where('hotel_id', serviceId)
        .whereNotNull('hotel_id')
        .where('depart_date', targetDate)
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

      // Enhanced In-house guests (currently checked in) - This is the key addition
      const inHouseQuery = Reservation.query()
        .where('hotel_id', serviceId)
        .whereNotNull('hotel_id')
        .where('status', 'checked_in')
        .where('arrived_date', '<=', targetDate)
        .where('depart_date', '>', targetDate)

      const guestInHouseAdult = await inHouseQuery.clone().sum('adults as total')
      const guestInHouseChild = await inHouseQuery.clone().sum('children as total')
      const totalInHouse = await inHouseQuery.count('* as total')

      // Calculate total guests (adults + children)
      const totalGuestsInHouse =
        Number(guestInHouseAdult[0].$extras.total || '0') +
        Number(guestInHouseChild[0].$extras.total || '0')

      // Room Statistics
      const roomStatusVacant = await Room.query()
        .where('hotel_id', serviceId)
        .where('status', 'available')
        .count('* as total')

      const roomStatusSold = await Room.query()
        .where('hotel_id', serviceId)
        .where('status', 'occupied')
        .count('* as total')

        const roomStatusDayUse = await ReservationRoom.query()
        .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
        .where('reservations.hotel_id', serviceId)
        .where('reservation_rooms.status', 'day_use')
        .count('* as total')
      

      const roomStatusComplimentary = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('complimentary_room', 'true')
        .count('* as total')

      const roomStatusBlocked = await Room.query()
        .where('hotel_id', serviceId)
        .where('status', 'blocked')
        .count('* as total')

      // Maintenance rooms
      const roomsInMaintenance = await Room.query()
        .where('hotel_id', serviceId)
        .where('status', 'in_maintenance')
        .count('* as total')

      // Total rooms for occupancy calculation
      const totalRoomsCount = await Room.query().where('hotel_id', serviceId).count('* as total')

      const totalRooms = Number(totalRoomsCount[0].$extras.total || '0')
      const occupiedRooms =
        Number(roomStatusSold[0].$extras.total || '0') +
        Number(roomStatusDayUse[0].$extras.total || '0') +
        Number(roomStatusComplimentary[0].$extras.total || '0')

      const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

      // Enhanced Revenue calculation with better error handling
      const revenueDataOptimized = await ReservationRoom.query()
        .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
        .join('room_rates', 'reservation_rooms.room_rate_id', 'room_rates.id')
        .join('rate_types', 'room_rates.rate_type_id', 'rate_types.id')
        .where('reservations.hotel_id', serviceId)
        .whereBetween('reservations.check_in_date', [startDate.toSQLDate()!, endDate.toSQLDate()!])
        .whereIn('reservations.status', ['confirmed', 'checked_in', 'checked_out'])
        .groupBy('rate_types.id', 'rate_types.rate_type_name')
        .select('rate_types.rate_type_name as rate_type_name')
        .sum('room_rates.base_rate as total_revenue')



      // Process revenue data
      const revenueByRateType: { [key: string]: number } = {}
      let totalRevenue = 0

      for (const result of revenueDataOptimized) {
        const revenue = Number(result.$extras.total_revenue || 0)
        const rateTypeName = result.$extras.rate_type_name
        revenueByRateType[rateTypeName] = revenue
        totalRevenue += revenue
      }

      revenueByRateType['total'] = totalRevenue

      // Enhanced Suite occupancy with dynamic room types
      // const suiteOccupancyData = await ReservationRoom.query()
      //   .join('rooms', 'reservation_rooms.room_id', 'rooms.id')
      //   .join('room_types', 'rooms.room_type_id', 'room_types.id')
      //   .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
      //   .where('reservations.hotel_id', serviceId)
      //   .where('reservations.status', 'checked_in')
      //   .where('room_types.is_deleted', false)
      //   .groupBy('room_types.id', 'room_types.room_type_name')
      //   .select('room_types.room_type_name')
      //   .count('* as occupancy')

      // const suiteOccupancy: { [key: string]: number } = {}
      // for (const result of suiteOccupancyData) {
      //   suiteOccupancy[result.roomTypeId] = Number(result.$extras.occupancy || '0')
      // }

      const roomTypes = await RoomType.query()
      .where('hotel_id', serviceId)
      .where('is_deleted', false) // Si vous utilisez soft delete

    const suiteOccupancy: { [key: string]: number } = {}

    for (const roomType of roomTypes) {
      // Compter les réservations actives pour ce type de chambre
      const occupancy = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .whereHas('reservationRooms', (query) => {
          query.whereHas('room', (roomQuery) => {
            roomQuery.where('room_type_id', roomType.id)
          })
        })
        .count('* as total')

      suiteOccupancy[roomType.roomTypeName] = Number(occupancy[0].$extras.total || '0')
    }
      // Housekeeping Status
      const housekeepingClean = await Room.query()
        .where('hotel_id', serviceId)
        .where('housekeeping_status', 'clean')
        .count('* as total')

      const housekeepingInspected = await Room.query()
        .where('hotel_id', serviceId)
        .where('housekeeping_status', 'inspected')
        .count('* as total')

      const housekeepingDirty = await Room.query()
        .where('hotel_id', serviceId)
        .where('housekeeping_status', 'dirty')
        .count('* as total')

      const housekeepingToClean = await Room.query()
        .where('hotel_id', serviceId)
        .whereIn('housekeeping_status', ['dirty', 'checkout'])
        .count('* as total')

      // Enhanced Weekly data (dynamic based on selected date)
      const weeklyData = []
      const weekStart = selectedDate.startOf('week')

      for (let i = 0; i < 7; i++) {
        const date = weekStart.plus({ days: i })

        const dayArrivals = await Reservation.query()
          .where('hotel_id', serviceId)
          .where('arrived_date', date.toSQLDate()!)
          .whereIn('status', ['confirmed', 'checked_in', 'checked_out'])
          .count('* as total')

        const dayDepartures = await Reservation.query()
          .where('hotel_id', serviceId)
          .where('depart_date', date.toSQLDate()!)
          .whereIn('status', ['checked_out'])
          .count('* as total')

        weeklyData.push({
          date: date.toFormat('yyyy-MM-dd'),
          arrivals: Number(dayArrivals[0].$extras.total || '0'),
          departures: Number(dayDepartures[0].$extras.total || '0'),
          dayName: date.toFormat('cccc'), // Day name for better UX
          shortDate: date.toFormat('dd/MM'),
        })
      }

      // Notifications and alerts (enhanced)
      const unpaidFolios = await Folio.query()
        .where('hotel_id', serviceId)
        .where('balance', '>', 0)
        .where('settlement_status', '!=', 'settled')
        .where('status', 'open')
        .count('* as total')

      const overbookedRooms = await Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'overbooked')
        .where('check_in_date', targetDate)
        .count('* as total')

      // Critical alerts with enhanced logic
      const alerts = []

      if (Number(overbookedRooms[0].$extras.total || '0') > 0) {
        alerts.push({
          type: 'critical',
          message: `${overbookedRooms[0].$extras.total} réservation(s) en surréservation`,
          count: Number(overbookedRooms[0].$extras.total || '0'),
          action: 'manage_overbooking',
        })
      }

      if (Number(unpaidFolios[0].$extras.total || '0') > 0) {
        alerts.push({
          type: 'warning',
          message: `${unpaidFolios[0].$extras.total} folio(s) impayé(s)`,
          count: Number(unpaidFolios[0].$extras.total || '0'),
          action: 'view_unpaid_folios',
        })
      }

      if (Number(roomsInMaintenance[0].$extras.total || '0') > 0) {
        alerts.push({
          type: 'info',
          message: `${roomsInMaintenance[0].$extras.total} chambre(s) en maintenance`,
          count: Number(roomsInMaintenance[0].$extras.total || '0'),
          action: 'view_maintenance',
        })
      }

      // Enhanced notifications
      const workOrders = await WorkOrder.query()
        .where('hotel_id', serviceId)
        .where('status', '!=', 'completed')
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
        .whereRaw('DATE(created_at) = ?', [targetDate])
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
        .whereRaw('DATE(created_at) = ?', [targetDate])
        .count('* as total')

      // Enhanced Recent Activity Feed with current user info
      const recentActivities = await ActivityLog.query()
        .where('hotel_id', serviceId)
        .whereBetween('created_at', [startDate.toSQL()!, endDate.toSQL()!])
        .orderBy('created_at', 'desc')
        .limit(15) // Increased limit
        .preload('user')

      // Performance calculation
      const performanceEnd = Date.now()
      const loadTime = performanceEnd - performanceStart

      // Enhanced metadata
      const metadata = {
        selectedDate: selectedDate.toFormat('yyyy-MM-dd'),
        range: rangeParam,
        startDate: startDate.toFormat('yyyy-MM-dd'),
        endDate: endDate.toFormat('yyyy-MM-dd'),
        isToday: selectedDate.hasSame(DateTime.now(), 'day'),
        isPastDate: selectedDate < DateTime.now().startOf('day'),
        isFutureDate: selectedDate > DateTime.now().startOf('day'),
        loadTime: loadTime,
        lastUpdated: DateTime.now().toISO(),
        totalRooms: totalRooms,
        targetRooms: Array.from(
          { length: totalRooms },
          (_, i) => `${Math.floor(i / 6) + 1}${(i % 6) + 1}`
        ).slice(0, 8), // Example room numbers
        dataPoints: {
          arrivals: Number(totalArrivals[0].$extras.total || '0'),
          departures: Number(totalDepartures[0].$extras.total || '0'),
          inHouse: Number(totalInHouse[0].$extras.total || '0'),
          occupancyRate: occupancyRate,
        },
      }

      return response.ok({
        success: true,
        data: {
          // Basic stats with enhanced in-house data
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
          // Enhanced in-house guests data
          guestInHouse: {
            adult: Number(guestInHouseAdult[0].$extras.total || '0'),
            child: Number(guestInHouseChild[0].$extras.total || '0'),
            total: Number(totalInHouse[0].$extras.total || '0'),
            totalGuests: totalGuestsInHouse,
            averageGuestsPerRoom:
              Number(totalInHouse[0].$extras.total || '0') > 0
                ? Math.round(
                    (totalGuestsInHouse / Number(totalInHouse[0].$extras.total || '1')) * 100
                  ) / 100
                : 0,
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
            availableRooms:
              totalRooms - occupiedRooms - Number(roomsInMaintenance[0].$extras.total || '0'),
          },
          housekeepingStatus: {
            clean: Number(housekeepingClean[0].$extras.total || '0'),
            inspected: Number(housekeepingInspected[0].$extras.total || '0'),
            dirty: Number(housekeepingDirty[0].$extras.total || '0'),
            toClean: Number(housekeepingToClean[0].$extras.total || '0'),
            cleanPercentage:
              totalRooms > 0
                ? Math.round((Number(housekeepingClean[0].$extras.total || '0') / totalRooms) * 100)
                : 0,
          },
          // Enhanced revenue data
          revenue: {
            ...revenueByRateType,
            averageRoomRate:
              occupiedRooms > 0 ? Math.round((totalRevenue / occupiedRooms) * 100) / 100 : 0,
            revpar: totalRooms > 0 ? Math.round((totalRevenue / totalRooms) * 100) / 100 : 0, // Revenue Per Available Room
          },
          // Enhanced suite occupancy
          suites: suiteOccupancy,
          // Enhanced weekly trends with more data
          weeklyTrends: weeklyData,
          // Enhanced alerts and notifications
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
            totalNotifications:
              Number(workOrders[0].$extras.total || '0') +
              Number(bookingInquiry[0].$extras.total || '0') +
              Number(paymentFailed[0].$extras.total || '0') +
              Number(overbookedRooms[0].$extras.total || '0') +
              Number(guestMessage[0].$extras.total || '0') +
              Number(cardkeyFailed[0].$extras.total || '0') +
              Number(tasksCount[0].$extras.total || '0') +
              Number(reviewCount[0].$extras.total || '0') +
              Number(unpaidFolios[0].$extras.total || '0'),
          },
          // Enhanced activity feeds
          activityFeeds: recentActivities.map((activity) => ({
            id: activity.id,
            description: activity.description,
            action: activity.action,
            user: activity.user?.username || 'System',
            userId: activity.user?.id || null,
            timestamp: activity.createdAt.toFormat('HH:mm'),
            fullTimestamp: activity.createdAt.toISO(),
            type: this.getActivityType(activity.action),
            date: activity.createdAt.toFormat('yyyy-MM-dd'),
            isToday: activity.createdAt.hasSame(DateTime.now(), 'day'),
            priority: this.getActivityPriority(activity.action),
            entityType: activity.entityType,
            entityId: activity.entityId,
          })),
          // Enhanced metadata
          metadata: metadata,
          // Performance metrics
          performance: {
            loadTime: loadTime,
            queriesExecuted: 25, // Approximate number of queries
            cacheHit: false, // Could implement caching
            dataFreshness: 'real-time',
          },
        },
      })
    } catch (error) {
      console.error('Error fetching front office dashboard data:', error)
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des données du dashboard',
        errorCode: 'DASHBOARD_FETCH_ERROR',
        timestamp: DateTime.now().toISO(),
      })
    }
  }

  // Enhanced helper method for activity types
  private getActivityType(action: string): string {
    const typeMap = {
      check_in: 'arrival',
      CHECK_IN: 'arrival',
      check_out: 'departure',
      CHECK_OUT: 'departure',
      reservation_created: 'booking',
      RESERVATION_CREATED: 'booking',
      reservation_modified: 'modification',
      RESERVATION_MODIFIED: 'modification',
      reservation_cancelled: 'cancellation',
      RESERVATION_CANCELLED: 'cancellation',
      payment_received: 'payment',
      PAYMENT_RECEIVED: 'payment',
      maintenance_request: 'maintenance',
      MAINTENANCE_REQUEST: 'maintenance',
      housekeeping_update: 'housekeeping',
      HOUSEKEEPING_UPDATE: 'housekeeping',
      guest_message: 'communication',
      GUEST_MESSAGE: 'communication',
      room_assignment: 'system',
      ROOM_ASSIGNMENT: 'system',
      rate_change: 'modification',
      RATE_CHANGE: 'modification',
      default: 'system',
    }
    return typeMap[action] || typeMap['default']
  }

  // New helper method for activity priority
  private getActivityPriority(action: string): 'high' | 'medium' | 'low' {
    const highPriority = [
      'check_in',
      'CHECK_IN',
      'check_out',
      'CHECK_OUT',
      'maintenance_request',
      'MAINTENANCE_REQUEST',
    ]
    const mediumPriority = [
      'reservation_created',
      'RESERVATION_CREATED',
      'payment_received',
      'PAYMENT_RECEIVED',
      'guest_message',
      'GUEST_MESSAGE',
    ]

    if (highPriority.includes(action)) return 'high'
    if (mediumPriority.includes(action)) return 'medium'
    return 'low'
  }
}
