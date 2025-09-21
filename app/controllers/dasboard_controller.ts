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

      // CORRECTION: Lire les paramètres de query string ET du body
      const queryParams = request.qs()
      const bodyParams = request.all()

      // Priorité aux paramètres du body si disponibles, sinon query string
      const dateParam = bodyParams.date || queryParams.date
      const rangeParam = bodyParams.range || queryParams.range || 'today'
      const startDateParam = bodyParams.startDate || queryParams.startDate
      const endDateParam = bodyParams.endDate || queryParams.endDate

      console.log('Raw parameters received:', {
        queryParams,
        bodyParams,
        dateParam,
        rangeParam,
        startDateParam,
        endDateParam,
      })

      let selectedDate: DateTime
      let startDate: DateTime
      let endDate: DateTime

      const today = DateTime.now().startOf('day')

      // CORRECTION: Utiliser les dates explicites si fournies
      if (startDateParam && endDateParam) {
        console.log('Using explicit date range:', { startDateParam, endDateParam })
        startDate = DateTime.fromISO(startDateParam).startOf('day')
        endDate = DateTime.fromISO(endDateParam).endOf('day')
        selectedDate = startDate

        if (!startDate.isValid || !endDate.isValid) {
          return response.badRequest({ success: false, message: 'Format de date invalide' })
        }
      } else {
        // Logique existante pour les ranges prédéfinis
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
      }

      console.log('Final date calculation:', {
        rangeParam,
        selectedDate: selectedDate.toISO(),
        startDate: startDate.toISO(),
        endDate: endDate.toISO(),
      })

      // Détecter automatiquement le type de période pour le graphique
      const daysDifference = endDate.diff(startDate, 'days').days
      let actualRangeParam = rangeParam

      if (daysDifference >= 6 && daysDifference <= 7) {
        actualRangeParam = rangeParam.includes('Week') ? rangeParam : 'thisWeek'
      } else if (daysDifference >= 28 && daysDifference <= 31) {
        actualRangeParam = rangeParam.includes('Month') ? rangeParam : 'thisMonth'
      }

      console.log('Range detection:', {
        daysDifference,
        originalRange: rangeParam,
        detectedRange: actualRangeParam,
      })

      const targetDate = startDate.toSQLDate()!
      const performanceStart = Date.now()

      const [
        arrivalsData,
        departuresData,
        inHouseData,
        roomStatusData,
        revenueData,
        suiteOccupancyData,
        housekeepingData,
        weeklyDataResult,
        notificationData,
        recentActivities,
      ] = await Promise.all([
        this.getArrivalsData(serviceId, targetDate),
        this.getDeparturesData(serviceId, targetDate),
        this.getInHouseData(serviceId, targetDate),
        this.getRoomStatusData(serviceId),
        this.getRevenueData(serviceId, startDate, endDate),
        this.getSuiteOccupancyData(serviceId),
        this.getHousekeepingData(serviceId),
        this.getWeeklyData(serviceId, selectedDate),
        this.getNotificationData(serviceId, targetDate),

        ActivityLog.query()
          .where('hotel_id', serviceId)
          .whereBetween('created_at', [startDate.toSQL()!, endDate.toSQL()!])
          .orderBy('created_at', 'desc')
          .limit(15)
          .preload('user'),
      ])
      const revenueChartData = await this.generateRevenueChartData(
        serviceId,
        startDate,
        endDate,
        rangeParam
      )

      const performanceEnd = Date.now()
      const loadTime = performanceEnd - performanceStart

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
        totalRooms: roomStatusData.total,
        dataPoints: {
          arrivals: arrivalsData.total,
          departures: departuresData.total,
          inHouse: inHouseData.total,
          occupancyRate: roomStatusData.occupancyRate,
        },
      }

      return response.ok({
        success: true,
        data: {
          ...arrivalsData,
          ...departuresData,
          ...inHouseData,
          ...roomStatusData,
          ...revenueData,
          ...suiteOccupancyData,
          ...housekeepingData,
          weeklyTrends: weeklyDataResult,
          ...notificationData,
          revenueChartData: revenueChartData,
          activityFeeds: (recentActivities || []).map((activity: any) => ({
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
          metadata: metadata,
          performance: {
            loadTime: loadTime,
            queriesExecuted: 10, // Approximate number of queries
            cacheHit: false,
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

  private async getArrivalsData(serviceId: number, targetDate: string) {
    const [arrivalPending, arrivalCheckedIn, totalArrivals] = await Promise.all([
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('arrived_date', targetDate)
        .where('status', 'confirmed')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('arrived_date', targetDate)
        .where('status', 'checked_in')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('arrived_date', targetDate)
        .whereIn('status', ['confirmed', 'checked_in'])
        .count('* as total'),
    ])

    return {
      arrival: {
        pending: Number(arrivalPending[0].$extras.total || '0'),
        arrived: Number(arrivalCheckedIn[0].$extras.total || '0'),
        total: Number(totalArrivals[0].$extras.total || '0'),
      },
    }
  }

  private async getDeparturesData(serviceId: number, targetDate: string) {
    const [departurePending, departureCheckedOut, totalDepartures] = await Promise.all([
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('depart_date', targetDate)
        .where('status', 'checked_in')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('depart_date', targetDate)
        .where('status', 'checked_out')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('depart_date', targetDate)
        .whereIn('status', ['checked_in', 'checked_out'])
        .count('* as total'),
    ])

    return {
      departure: {
        pending: Number(departurePending[0].$extras.total || '0'),
        checkedOut: Number(departureCheckedOut[0].$extras.total || '0'),
        total: Number(totalDepartures[0].$extras.total || '0'),
      },
    }
  }

  private async getInHouseData(serviceId: number, targetDate: string) {
    const [guestInHouseAdult, guestInHouseChild, totalInHouse] = await Promise.all([
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .where('arrived_date', '<=', targetDate)
        .where('depart_date', '>', targetDate)
        .sum('adults as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .where('arrived_date', '<=', targetDate)
        .where('depart_date', '>', targetDate)
        .sum('children as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .where('arrived_date', '<=', targetDate)
        .where('depart_date', '>', targetDate)
        .count('* as total'),
    ])

    const totalGuestsInHouse =
      Number(guestInHouseAdult[0].$extras.total || '0') +
      Number(guestInHouseChild[0].$extras.total || '0')

    return {
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
    }
  }

  private async getRoomStatusData(serviceId: number) {
    const [roomStatusCounts, roomStatusDayUse, roomStatusComplimentary, totalRoomsCount] =
      await Promise.all([
        Room.query()
          .where('hotel_id', serviceId)
          .groupBy('status')
          .select('status')
          .count('* as total'),
        ReservationRoom.query()
          .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
          .where('reservations.hotel_id', serviceId)
          .where('reservation_rooms.status', 'day_use')
          .count('* as total'),
        Reservation.query()
          .where('hotel_id', serviceId)
          .where('complimentary_room', 'true')
          .count('* as total'),
        Room.query().where('hotel_id', serviceId).count('* as total'),
      ])

    const totalRooms = Number(totalRoomsCount[0].$extras.total || '0')
    const occupiedRooms =
      (Number(roomStatusCounts.find((item) => item.status === 'occupied')?.$extras.total) || 0) +
      Number(roomStatusDayUse[0].$extras.total || '0') +
      Number(roomStatusComplimentary[0].$extras.total || '0')
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
    const roomsInMaintenanceCount =
      Number(roomStatusCounts.find((item) => item.status === 'in_maintenance')?.$extras.total) || 0

    return {
      roomStatus: {
        vacant: Number(
          roomStatusCounts.find((item) => item.status === 'available')?.$extras.total || '0'
        ),
        sold: Number(
          roomStatusCounts.find((item) => item.status === 'occupied')?.$extras.total || '0'
        ),
        dayUse: Number(roomStatusDayUse[0].$extras.total || '0'),
        complimentary: Number(roomStatusComplimentary[0].$extras.total || '0'),
        blocked: Number(
          roomStatusCounts.find((item) => item.status === 'blocked')?.$extras.total || '0'
        ),
        maintenance: roomsInMaintenanceCount,
        total: totalRooms,
        occupancyRate: occupancyRate,
        availableRooms: totalRooms - occupiedRooms - roomsInMaintenanceCount,
      },
    }
  }

  private async getRevenueData(serviceId: number, startDate: DateTime, endDate: DateTime) {
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

    const revenueByRateType: { [key: string]: number } = {}
    let totalRevenue = 0
    for (const result of revenueDataOptimized) {
      const revenue = Number(result.$extras.total_revenue || 0)
      const rateTypeName = result.$extras.rate_type_name
      revenueByRateType[rateTypeName] = revenue
      totalRevenue += revenue
    }
    revenueByRateType['total'] = totalRevenue

    const occupiedRooms = await Reservation.query()
      .where('hotel_id', serviceId)
      .where('status', 'checked_in')
      .count('* as total')
    const totalRooms = await Room.query().where('hotel_id', serviceId).count('* as total')

    return {
      revenue: {
        ...revenueByRateType,
        averageRoomRate:
          Number(occupiedRooms[0].$extras.total) > 0
            ? Math.round((totalRevenue / Number(occupiedRooms[0].$extras.total)) * 100) / 100
            : 0,
        revpar:
          Number(totalRooms[0].$extras.total) > 0
            ? Math.round((totalRevenue / Number(totalRooms[0].$extras.total)) * 100) / 100
            : 0,
      },
    }
  }

  private async getSuiteOccupancyData(serviceId: number) {
    const suiteOccupancyResult = await Reservation.query()
      .where('reservations.hotel_id', serviceId)
      .where('reservations.status', 'checked_in')
      .join('reservation_rooms', 'reservations.id', 'reservation_rooms.reservation_id')
      .join('rooms', 'reservation_rooms.room_id', 'rooms.id')
      .join('room_types', 'rooms.room_type_id', 'room_types.id')
      .groupBy('room_types.id', 'room_types.room_type_name')
      .select('room_types.id')
      .select('room_types.room_type_name')
      .count('* as total')

    console.log('RAW suiteOccupancyResult:', suiteOccupancyResult)

    const suiteOccupancy = suiteOccupancyResult.reduce((acc: any, item: any) => {
      const roomTypeName = item.$extras.room_type_name
      const total = Number(item.$extras.total || 0)
      acc[roomTypeName] = total
      return acc
    }, {})

    console.log('Final suiteOccupancy:', suiteOccupancy)

    return { suites: suiteOccupancy }
  }

  // Nouvelle méthode pour générer les données du graphique de revenus
  // Méthode corrigée pour générer les données du graphique de revenus
  private async generateRevenueChartData(
    serviceId: number,
    startDate: DateTime,
    endDate: DateTime,
    rangeParam: string
  ) {
    console.log('generateRevenueChartData called with:', {
      serviceId,
      startDate: startDate.toISO(),
      endDate: endDate.toISO(),
      rangeParam,
    })

    const chartData = []

    if (rangeParam === 'thisWeek' || rangeParam === 'lastWeek') {
      // Pour la semaine : données par jour (Lundi à Dimanche)
      const weekStart = startDate.startOf('week')
      console.log('Week mode - weekStart:', weekStart.toISO())

      for (let i = 0; i < 7; i++) {
        const date = weekStart.plus({ days: i })
        console.log(`Processing day ${i + 1}/7:`, date.toISO())
        const dayRevenue = await this.getDailyRevenueByRateType(serviceId, date)
        console.log(`Revenue for ${date.toISO()}:`, dayRevenue)

        chartData.push({
          date: date.toFormat('yyyy-MM-dd'),
          label: date.toFormat('cccc'), // Lundi, Mardi, etc.
          ...dayRevenue,
        })
      }
    } else if (rangeParam === 'thisMonth' || rangeParam === 'lastMonth') {
      // Pour le mois : données par semaine
      const monthStart = startDate.startOf('month')
      const monthEnd = endDate.endOf('month')
      console.log('Month mode:', { monthStart: monthStart.toISO(), monthEnd: monthEnd.toISO() })

      let weekNumber = 1
      let currentWeekStart = monthStart.startOf('week')

      while (currentWeekStart <= monthEnd && weekNumber <= 5) {
        const weekEnd = DateTime.min(currentWeekStart.endOf('week'), monthEnd)
        console.log(`Processing week ${weekNumber}:`, {
          start: currentWeekStart.toISO(),
          end: weekEnd.toISO(),
        })

        const weekRevenue = await this.getWeeklyRevenueByRateType(
          serviceId,
          currentWeekStart,
          weekEnd
        )
        console.log(`Revenue for week ${weekNumber}:`, weekRevenue)

        chartData.push({
          date: currentWeekStart.toFormat('yyyy-MM-dd'),
          label: `S${weekNumber}`,
          ...weekRevenue,
        })

        currentWeekStart = currentWeekStart.plus({ weeks: 1 })
        weekNumber++
      }
    } else {
      // Pour les autres plages : données par jour sur la période définie
      console.log('Daily mode - processing from', startDate.toISO(), 'to', endDate.toISO())

      let currentDate = startDate
      while (currentDate <= endDate) {
        console.log('Processing date:', currentDate.toISO())
        const dayRevenue = await this.getDailyRevenueByRateType(serviceId, currentDate)
        console.log(`Revenue for ${currentDate.toISO()}:`, dayRevenue)

        chartData.push({
          date: currentDate.toFormat('yyyy-MM-dd'),
          label: currentDate.toFormat('dd/MM'),
          ...dayRevenue,
        })

        currentDate = currentDate.plus({ days: 1 })
      }
    }

    console.log('Final chartData:', chartData)
    return chartData
  }

  private async getWeeklyRevenueByRateType(
    serviceId: number,
    weekStart: DateTime,
    weekEnd: DateTime
  ) {
    const revenueQuery = await ReservationRoom.query()
      .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
      .join('room_rates', 'reservation_rooms.room_rate_id', 'room_rates.id')
      .join('rate_types', 'room_rates.rate_type_id', 'rate_types.id')
      .where('reservations.hotel_id', serviceId)
      .where(function (query) {
        query
          .where(function (subQuery) {
            // Réservations qui commencent dans cette semaine
            subQuery.whereBetween('reservations.arrived_date', [
              weekStart.toSQLDate()!,
              weekEnd.toSQLDate()!,
            ])
          })
          .orWhere(function (subQuery) {
            // Réservations qui chevauchent cette semaine
            subQuery
              .where('reservations.arrived_date', '<=', weekEnd.toSQLDate()!)
              .where('reservations.depart_date', '>', weekStart.toSQLDate()!)
          })
      })
      .whereIn('reservations.status', ['confirmed', 'checked_in', 'checked_out'])
      .groupBy('rate_types.rate_type_name')
      .select('rate_types.rate_type_name as rate_type_name')
      .sum('room_rates.base_rate as total_revenue')

    const revenues: { [key: string]: number } = {}
    let totalRevenue = 0

    for (const result of revenueQuery) {
      const rateTypeName = result.$extras.rate_type_name
      const revenue = Number(result.$extras.total_revenue || 0)
      revenues[rateTypeName] = revenue
      totalRevenue += revenue
    }

    revenues['total'] = totalRevenue

    return { revenues }
  }

  private async getDailyRevenueByRateType(serviceId: number, date: DateTime) {
    console.log(`getDailyRevenueByRateType for date: ${date.toISO()}`)

    // Première requête : réservations avec check-in ce jour
    const checkInRevenueQuery = await ReservationRoom.query()
      .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
      .join('room_rates', 'reservation_rooms.room_rate_id', 'room_rates.id')
      .join('rate_types', 'room_rates.rate_type_id', 'rate_types.id')
      .where('reservations.hotel_id', serviceId)
      .where('reservations.check_in_date', date.toSQLDate()!)
      .whereIn('reservations.status', ['confirmed', 'checked_in', 'checked_out'])
      .groupBy('rate_types.rate_type_name')
      .select('rate_types.rate_type_name as rate_type_name')
      .sum('room_rates.base_rate as total_revenue')

    console.log(`Check-in reservations for ${date.toISO()}:`, checkInRevenueQuery.length)

    // Deuxième requête : réservations actives ce jour (déjà check-in, pas encore check-out)
    const activeRevenueQuery = await ReservationRoom.query()
      .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
      .join('room_rates', 'reservation_rooms.room_rate_id', 'room_rates.id')
      .join('rate_types', 'room_rates.rate_type_id', 'rate_types.id')
      .where('reservations.hotel_id', serviceId)
      .where('reservations.check_in_date', '<', date.toSQLDate()!)
      .where('reservations.check_out_date', '>', date.toSQLDate()!)
      .whereIn('reservations.status', ['confirmed', 'checked_in', 'checked_out'])
      .groupBy('rate_types.rate_type_name')
      .select('rate_types.rate_type_name as rate_type_name')
      .sum('room_rates.base_rate as total_revenue')

    console.log(`Active reservations for ${date.toISO()}:`, activeRevenueQuery.length)

    const revenues: { [key: string]: number } = {}
    let totalRevenue = 0

    // Traiter les revenus du check-in
    for (const result of checkInRevenueQuery) {
      const rateTypeName = result.$extras.rate_type_name
      const revenue = Number(result.$extras.total_revenue || 0)
      if (!revenues[rateTypeName]) revenues[rateTypeName] = 0
      revenues[rateTypeName] += revenue
      totalRevenue += revenue
    }

    // Traiter les revenus des réservations actives (au prorata)
    for (const result of activeRevenueQuery) {
      const rateTypeName = result.$extras.rate_type_name
      const revenue = Number(result.$extras.total_revenue || 0)

      // Pour les réservations actives, on peut soit :
      // 1. Compter le revenu total (comme ci-dessous)
      // 2. Ou le diviser par le nombre de jours de séjour

      if (!revenues[rateTypeName]) revenues[rateTypeName] = 0
      revenues[rateTypeName] += revenue
      totalRevenue += revenue
    }

    revenues['total'] = totalRevenue

    console.log(`Final revenues for ${date.toISO()}:`, revenues)
    return { revenues }
  }

  private async getHousekeepingData(serviceId: number) {
    const housekeepingStatusCounts = await Room.query()
      .where('hotel_id', serviceId)
      .groupBy('housekeeping_status')
      .select('housekeeping_status')
      .count('* as total')
    const totalRooms = await Room.query().where('hotel_id', serviceId).count('* as total')

    return {
      housekeepingStatus: {
        clean: Number(
          housekeepingStatusCounts.find((item) => item.housekeepingStatus === 'clean')?.$extras
            .total || '0'
        ),
        inspected: Number(
          housekeepingStatusCounts.find((item) => item.housekeepingStatus === 'inspected')?.$extras
            .total || '0'
        ),
        dirty: Number(
          housekeepingStatusCounts.find((item) => item.housekeepingStatus === 'dirty')?.$extras
            .total || '0'
        ),
        toClean:
          (Number(
            housekeepingStatusCounts.find((item) => item.housekeepingStatus === 'dirty')?.$extras
              .total
          ) || 0) +
          (Number(
            housekeepingStatusCounts.find((item) => item.housekeepingStatus === 'checkout')?.$extras
              .total
          ) || 0),
        cleanPercentage:
          Number(totalRooms[0].$extras.total) > 0
            ? Math.round(
                (Number(
                  housekeepingStatusCounts.find((item) => item.housekeepingStatus === 'clean')
                    ?.$extras.total || '0'
                ) /
                  Number(totalRooms[0].$extras.total)) *
                  100
              )
            : 0,
      },
    }
  }

  private async getWeeklyData(serviceId: number, selectedDate: DateTime) {
    const weekStart = selectedDate.startOf('week')
    const weekEnd = selectedDate.endOf('week')

    const [weeklyArrivals, weeklyDepartures] = await Promise.all([
      Reservation.query()
        .where('hotel_id', serviceId)
        .whereBetween('arrived_date', [weekStart.toSQLDate()!, weekEnd.toSQLDate()!])
        .whereIn('status', ['confirmed', 'checked_in', 'checked_out'])
        .groupBy('arrived_date')
        .select('arrived_date')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .whereBetween('depart_date', [weekStart.toSQLDate()!, weekEnd.toSQLDate()!])
        .whereIn('status', ['checked_out'])
        .groupBy('depart_date')
        .select('depart_date')
        .count('* as total'),
    ])

    const weeklyArrivalsMap = weeklyArrivals.reduce((acc: any, item: any) => {
      if (item.arrived_date) {
        acc[item.arrived_date] = Number(item.$extras.total)
      }
      return acc
    }, {})

    const weeklyDeparturesMap = weeklyDepartures.reduce((acc: any, item: any) => {
      if (item.depart_date) {
        acc[item.depart_date] = Number(item.$extras.total)
      }
      return acc
    }, {})

    const weeklyData = []
    for (let i = 0; i < 7; i++) {
      const date = weekStart.plus({ days: i })
      const dateSQL = date.toSQLDate()!
      weeklyData.push({
        date: date.toFormat('yyyy-MM-dd'),
        arrivals: weeklyArrivalsMap[dateSQL] || 0,
        departures: weeklyDeparturesMap[dateSQL] || 0,
        dayName: date.toFormat('cccc'),
        shortDate: date.toFormat('dd/MM'),
      })
    }

    return weeklyData
  }

  private async getNotificationData(serviceId: number, targetDate: string) {
    const [
      unpaidFolios,
      overbookedRooms,
      workOrders,
      bookingInquiry,
      paymentFailed,
      guestPortal,
      guestMessage,
      cardkeyFailed,
      tasksCount,
      reviewCount,
    ] = await Promise.all([
      Folio.query()
        .where('hotel_id', serviceId)
        .where('balance', '>', 0)
        .where('settlement_status', '!=', 'settled')
        .where('status', 'open')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'overbooked')
        .where('check_in_date', targetDate)
        .count('* as total'),
      WorkOrder.query()
        .where('hotel_id', serviceId)
        .where('status', '!=', 'completed')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('status', 'inquiry')
        .count('* as total'),
      Reservation.query()
        .where('hotel_id', serviceId)
        .where('payment_status', 'failed')
        .count('* as total'),
      Guest.query()
        .whereHas('reservations', (query) => {
          query.where('hotel_id', serviceId).where('status', 'checked_in')
        })
        .count('* as total'),
      ActivityLog.query()
        .where('entity_type', 'guest_message')
        .where('action', 'unread')
        .whereRaw('DATE(created_at) = ?', [targetDate])
        .count('* as total'),
      Task.query()
        .where('hotel_id', serviceId)
        .where('task_type', 'cardkey_issue')
        .where('status', '!=', 'done')
        .count('* as total'),
      Task.query().where('hotel_id', serviceId).where('status', '!=', 'done').count('* as total'),
      ActivityLog.query()
        .where('entity_type', 'review')
        .where('action', 'pending')
        .whereRaw('DATE(created_at) = ?', [targetDate])
        .count('* as total'),
    ])

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
    const roomsInMaintenanceCount = await Room.query()
      .where('hotel_id', serviceId)
      .where('status', 'in_maintenance')
      .count('* as total')
    if (Number(roomsInMaintenanceCount[0].$extras.total || '0') > 0) {
      alerts.push({
        type: 'info',
        message: `${roomsInMaintenanceCount[0].$extras.total} chambre(s) en maintenance`,
        count: Number(roomsInMaintenanceCount[0].$extras.total || '0'),
        action: 'view_maintenance',
      })
    }

    return {
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
    }
  }
}
