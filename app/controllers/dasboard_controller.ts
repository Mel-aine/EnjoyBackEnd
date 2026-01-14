import { RoomAvailabilityService, RoomAnalyticsService } from '#services/dashboard_service'
import type { HttpContext } from '@adonisjs/core/http'
import { HotelAnalyticsDashboardService } from '#services/dasboard_servicepd'
import { HotelAnalyticsService } from '#services/hotel_analytics_service'
import { DateTime } from 'luxon'
import Task from '#models/task'
import Reservation from '#models/reservation'
import Room from '#models/room'
import RoomType from '#models/room_type'
import ActivityLog from '#models/activity_log'
import Guest from '#models/guest'
import Folio from '#models/folio'
import ReservationRoom from '#models/reservation_room'
import Database from '@adonisjs/lucid/services/db'
import { ReservationStatus } from '../enums.js'

import RoomBlock from '#models/room_block'
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
          currentYear: averageStay.currentYear,
          currentALOS: `${averageStay.currentALOS}`,
          previousYear: averageStay.previousYear,
          previousALOS: `${averageStay.previousALOS}`,
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

      const now = DateTime.now()
      const year = now.year
      const startOfYear = DateTime.local(year, 1, 1).startOf('day').toSQL()
      const endOfYear = DateTime.local(year, 12, 31).endOf('day').toSQL()

      const previousYear = year - 1
      const startOfPrevYear = DateTime.local(previousYear, 1, 1).startOf('day').toSQL()
      const endOfPrevYear = DateTime.local(previousYear, 12, 31).endOf('day').toSQL()

      // Fonction pour calculer progression
      const calcProgression = (current: number, previous: number) => {
        return previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100)
      }

      if (period === 'monthly') {
        const currentMonthName = now.toFormat('MMM')

        // Revenu de tous les mois
        const results = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfYear!, endOfYear!])
          .select(Database.raw("TO_CHAR(transaction_date, 'Mon') AS month"))
          .sum('amount as totalRevenue')
          .groupByRaw(Database.raw("TO_CHAR(transaction_date, 'Mon')"))
          .orderByRaw('MIN(transaction_date)')

        const prevResults = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfPrevYear!, endOfPrevYear!])
          .select(Database.raw("TO_CHAR(transaction_date, 'Mon') AS month"))
          .sum('amount as totalRevenue')
          .groupByRaw(Database.raw("TO_CHAR(transaction_date, 'Mon')"))

        // On ne garde que le mois courant
        const currentMonthResult = results.find(r => r.month === currentMonthName)
        const prevMonthResult = prevResults.find(r => r.month === currentMonthName)

        const progression = calcProgression(currentMonthResult?.totalRevenue || 0, prevMonthResult?.totalRevenue || 0)

        return response.ok({
          success: true,
          data: [{
            month: currentMonthName,
            totalRevenue: currentMonthResult?.totalRevenue || 0,
            progression
          }]
        })
      }


      if (period === 'quarterly') {
        const results = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfYear!, endOfYear!])
          .select(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 3 THEN 'Q1'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 4 AND 6 THEN 'Q2'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 7 AND 9 THEN 'Q3'
            ELSE 'Q4'
          END AS quarter
        `))
          .sum('amount as totalRevenue')
          .groupByRaw(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 3 THEN 'Q1'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 4 AND 6 THEN 'Q2'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 7 AND 9 THEN 'Q3'
            ELSE 'Q4'
          END
        `))
          .orderByRaw('MIN(transaction_date)')

        const prevResults = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfPrevYear!, endOfPrevYear!])
          .select(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 3 THEN 'Q1'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 4 AND 6 THEN 'Q2'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 7 AND 9 THEN 'Q3'
            ELSE 'Q4'
          END AS quarter
        `))
          .sum('amount as totalRevenue')
          .groupByRaw(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 3 THEN 'Q1'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 4 AND 6 THEN 'Q2'
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 7 AND 9 THEN 'Q3'
            ELSE 'Q4'
          END
        `))

        const currentMonth = now.month
        let currentQuarter = ''
        if (currentMonth >= 1 && currentMonth <= 3) currentQuarter = 'Q1'
        else if (currentMonth >= 4 && currentMonth <= 6) currentQuarter = 'Q2'
        else if (currentMonth >= 7 && currentMonth <= 9) currentQuarter = 'Q3'
        else currentQuarter = 'Q4'

        const data = results.map(r => {
          const prev = prevResults.find(p => p.quarter === r.quarter)
          const progression = calcProgression(r.totalRevenue || 0, prev?.totalRevenue || 0)
          return { ...r, progression }
        })

        // On garde seulement le trimestre courant
        const currentQuarterData = data.find(d => d.quarter === currentQuarter)

        return response.ok({ success: true, data: [currentQuarterData] })
      }

      if (period === 'semester') {
        const results = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfYear!, endOfYear!])
          .select(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 6 THEN 'S1'
            ELSE 'S2'
          END AS semester
        `))
          .sum('amount as totalRevenue')
          .groupByRaw(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 6 THEN 'S1'
            ELSE 'S2'
          END
        `))
          .orderByRaw('MIN(transaction_date)')

        const prevResults = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfPrevYear!, endOfPrevYear!])
          .select(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 6 THEN 'S1'
            ELSE 'S2'
          END AS semester
        `))
          .sum('amount as totalRevenue')
          .groupByRaw(Database.raw(`
          CASE
            WHEN EXTRACT(MONTH FROM transaction_date) BETWEEN 1 AND 6 THEN 'S1'
            ELSE 'S2'
          END
        `))

        const data = results.map(r => {
          const prev = prevResults.find(p => p.semester === r.semester)
          const progression = calcProgression(r.totalRevenue || 0, prev?.totalRevenue || 0)
          return { ...r, progression }
        })

        return response.ok({ success: true, data })
      }

      if (period === 'yearly') {
        const result = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfYear!, endOfYear!])
          .sum('amount as totalRevenue')
          .first()

        const prevResult = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('current_working_date', [startOfPrevYear!, endOfPrevYear!])
          .sum('amount as totalRevenue')
          .first()

        const progression = calcProgression(result?.totalRevenue || 0, prevResult?.totalRevenue || 0)

        return response.ok({
          success: true,
          data: [{ year: year.toString(), totalRevenue: result?.totalRevenue || 0, progression }]
        })
      }

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
      const data = await HotelAnalyticsDashboardService.getMonthlyRevenueComparison(serviceId)

      return response.ok({
        success: true,
        data
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

      const today = DateTime.now().startOf('day')
      const selectedDate = today
      const startDate = today
      const endDate = today.endOf('day')

      console.log('Dashboard request ', {
        selectedDate: selectedDate.toISO(),
        startDate: startDate.toISO(),
        endDate: endDate.toISO(),
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
        unpaidFoliosData,
        recentActivities
      ] = await Promise.all([
        this.getArrivalsData(serviceId, targetDate),
        this.getDeparturesData(serviceId, targetDate),
        this.getInHouseData(serviceId, targetDate),
        this.getRoomStatusData(serviceId, today),
        this.getRevenueData(serviceId, startDate, endDate),
        this.getSuiteOccupancyData(serviceId),
        this.getHousekeepingData(serviceId, today),
        this.getUnpaidFoliosData(serviceId),

        ActivityLog.query()
          .where('hotel_id', serviceId)
          .whereBetween('created_at', [startDate.toSQL()!, endDate.toSQL()!])
          .select('id', 'description', 'action', 'created_at', 'entity_type', 'entity_id', 'user_id')
          .orderBy('created_at', 'desc')
          .limit(5)
          .preload('user', (userQuery) => userQuery.select('id', 'first_name', 'last_name')),
      ])

      const performanceEnd = Date.now()
      const loadTime = performanceEnd - performanceStart

      const metadata = {
        selectedDate: selectedDate.toFormat('yyyy-MM-dd'),
        range: 'today',
        startDate: startDate.toFormat('yyyy-MM-dd'),
        endDate: endDate.toFormat('yyyy-MM-dd'),
        isToday: true,
        isPastDate: false,
        isFutureDate: false,
        loadTime: loadTime,
        lastUpdated: DateTime.now().toISO(),
        totalRooms: roomStatusData.total,
        dataPoints: {
          arrivals: arrivalsData.total,
          departures: departuresData.total ,
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
          unpaidFoliosData,

          activityFeeds: Array.isArray(recentActivities) ? recentActivities.map((activity: any) => ({
            id: activity.id,
            description: activity.description,
            action: activity.action,
            user: activity.user?.fullName,
            userId: activity.user?.id || null,
            timestamp: activity.createdAt.toFormat('HH:mm'),
            fullTimestamp: activity.createdAt.toISO(),
            type: this.getActivityType(activity.action),
            date: activity.createdAt.toFormat('yyyy-MM-dd'),
            isToday: activity.createdAt.hasSame(DateTime.now(), 'day'),
            priority: this.getActivityPriority(activity.action),
            entityType: activity.entityType,
            entityId: activity.entityId,
          })) : [],
          metadata: metadata,
          performance: {
            loadTime: loadTime,
            queriesExecuted: 15,
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
    const typeMap: any = {
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
      room_assignment: 'assignment',
      ROOM_ASSIGNMENT: 'assignment',
      rate_change: 'modification',
      RATE_CHANGE: 'modification',
      folio_adjustment: 'modification',
      FOLIO_ADJUSTMENT: 'modification',
      CREATE_FOLIOS: 'creation',
      create_folios: 'creation',
      CREATE : 'creation',
      create: 'creation',
      UPDATE: 'modification',
      update: 'modification',
      DELETE: 'deletion',
      delete: 'deletion',
      FOLIOS_CREATED: 'creation',
      folios_created: 'creation',
      TRANSACTION_UPDATED: 'modification',
      transaction_updated: 'modification',
      TRANSACTION_DELETED: 'deletion',
      transaction_deleted: 'deletion',
      RESEND_VERIFICATION_EMAIL: 'communication',
      EMAIL_VERIFIED: 'communication',
      FORGOT_PASSWORD_CREATE: 'communication',
      PASSWORD_RESET: 'communication',
      SETUP : 'system',
      VOID_RESERVATION : 'cancellation',
      UNDO_CHECK_IN : 'modification',
      UNDO_CHECK_OUT : 'modification',
      GUEST_RESERVATION_VOIDED : 'cancellation',
      folio_transaction_voided : 'modification',
      FOLIO_TRANSACTION_VOIDED : 'modification',
      CONFIRM_RESERVATION : 'booking',
      MARK_NO_SHOW : 'cancellation',
      CANCEL_RESERVATION : 'cancellation',
      ASSIGNED : 'assignment',
      CANCEL : 'cancellation',
      AMEND_STAY : 'modification',
      ROOM_MOVE : 'modification',




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

  private async getArrivalsData(serviceId: number, targetDate: string, trx?: any) {
    const grouped = await Reservation.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .where('arrived_date', targetDate)
      .whereIn('status', ['confirmed', 'checked_in'])
      .groupBy('status')
      .select('status')
      .count('* as total')

    const pending = Number(grouped.find((r) => r.status === 'confirmed')?.$extras.total || 0)
    const arrived = Number(grouped.find((r) => r.status === 'checked_in')?.$extras.total || 0)
    const total = pending + arrived

    return {
      arrival: { pending, arrived, total },
    }
  }

  private async getDeparturesData(serviceId: number, targetDate: string, trx?: any) {
    const grouped = await Reservation.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .where('depart_date', targetDate)
      .whereIn('status', ['checked_in', 'checked_out'])
      .groupBy('status')
      .select('status')
      .count('* as total')

    const pending = Number(grouped.find((r) => r.status === 'checked_in')?.$extras.total || 0)
    const checkedOut = Number(grouped.find((r) => r.status === 'checked_out')?.$extras.total || 0)
    const total = pending + checkedOut

    return {
      departure: { pending, checkedOut, total },
    }
  }

  private async getInHouseData(serviceId: number, targetDate: string, trx?: any) {
    const aggregate = await Reservation.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .where('status', 'checked_in')
      .where('arrived_date', '<=', targetDate)
      .where('depart_date', '>=', targetDate)
      .sum('adults as adults_total')
      .sum('children as children_total')
      .count('* as rooms_total')

    const row = aggregate[0]
    const adult = Number(row?.$extras?.adults_total || 0)
    const child = Number(row?.$extras?.children_total || 0)
    const rooms = Number(row?.$extras?.rooms_total || 0)
    const totalGuests = adult + child

    return {
      guestInHouse: {
        adult,
        child,
        total: rooms,
        totalGuests,
        averageGuestsPerRoom: rooms > 0 ? Math.round((totalGuests / rooms) * 100) / 100 : 0,
      },
    }
  }


  private async getRoomStatusData(serviceId: number, currentDate?: DateTime, trx?: any) {
    const targetDate = currentDate || DateTime.now()
    const dateStr = targetDate.toFormat('yyyy-MM-dd')

    const totalRoomsQuery = Room.query(trx ? { client: trx } : undefined)
        .where('hotel_id', serviceId)
        .count('* as total')

    //  Chambres occupées (réservations check-in et pas encore check-out)
    const occupiedRoomsQuery = ReservationRoom.query(trx ? { client: trx } : undefined)
        .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
        .where('reservations.hotel_id', serviceId)
        .where('reservation_rooms.status', 'checked_in')
        .where('reservations.check_in_date', '<=', dateStr)
        .where('reservations.check_out_date', '>', dateStr)
        .count('* as total')

    //  Chambres day use

    const dayUseRoomsQuery = await Reservation.query(trx ? { client: trx } : undefined)
        .where('hotel_id', serviceId)
        .where('check_in_date', dateStr)
        .where('check_out_date', dateStr)
        .where('status', 'confirmed')
        .count('* as total');

    //  Chambres offertes (complimentary)
    const complimentaryRoomsQuery = Reservation.query(trx ? { client: trx } : undefined)
        .where('hotel_id', serviceId)
        .where('complimentary_room', true)
        .where('check_in_date', '<=', dateStr)
        .where('check_out_date', '>', dateStr)
        .count('* as total')

    //  Chambres bloquées temporairement (room blocks)
    const blockedRoomsQuery = RoomBlock.query(trx ? { client: trx } : undefined)
        .where('hotel_id', serviceId)
        .where('block_from_date', '<=', dateStr)
        .where('block_to_date', '>=', dateStr)
        .whereNot('status', 'completed')
        .count('* as total')

    // Exécution en parallèle
    const [
        totalRoomsResult,
        occupiedRoomsResult,
        dayUseRoomsResult,
        complimentaryRoomsResult,
        blockedRoomsResult
    ] = await Promise.all([
        totalRoomsQuery,
        occupiedRoomsQuery,
        dayUseRoomsQuery,
        complimentaryRoomsQuery,
        blockedRoomsQuery
    ])

    const totalRooms = Number(totalRoomsResult[0].$extras.total || 0)
    const occupiedRooms = Number(occupiedRoomsResult[0].$extras.total || 0)
    const dayUseRooms = Number(dayUseRoomsResult[0].$extras.total || 0)
    const complimentaryRooms = Number(complimentaryRoomsResult[0].$extras.total || 0)
    const blockedRooms = Number(blockedRoomsResult[0].$extras.total || 0)

    const availableRooms = totalRooms - (occupiedRooms + dayUseRooms + complimentaryRooms + blockedRooms)

    // Taux d'occupation
    const occupiedTotal = occupiedRooms + dayUseRooms + complimentaryRooms
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedTotal / totalRooms) * 100) : 0

    return {
        roomStatus: {
            vacant: availableRooms > 0 ? availableRooms : 0,
            sold: occupiedRooms,
            dayUse: dayUseRooms,
            complimentary: complimentaryRooms,
            blocked: blockedRooms,
            blockedForDate: blockedRooms,
            total: totalRooms ,
            occupancyRate: occupancyRate,
            availableRooms: availableRooms > 0 ? availableRooms : 0,
        }
    }
  }

  private async getRevenueData(serviceId: number, startDate: DateTime, endDate: DateTime, trx?: any) {
    const revenueDataOptimized = await ReservationRoom.query(trx ? { client: trx } : undefined)
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

    const occupiedRooms = await Reservation.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .where('status', 'checked_in')
      .count('* as total')
    const totalRooms = await Room.query(trx ? { client: trx } : undefined).where('hotel_id', serviceId).count('* as total')

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

  private async getSuiteOccupancyData(serviceId: number, trx?: any) {
    // Aggregated counts by room type to avoid heavy preloads
    const roomTypes = await RoomType
      .query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .where('is_deleted', false)
      .orderBy('sort_order', 'asc')
      .select(['id', 'room_type_name', 'sort_order'])

    const totalRows = await Database
      .from('rooms')
      .where('hotel_id', serviceId)
      .groupBy('room_type_id')
      .select('room_type_id')
      .count('* as total')

    const occupiedRows = await Database
      .from('reservation_rooms')
      .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
      .join('rooms', 'reservation_rooms.room_id', 'rooms.id')
      .where('reservations.hotel_id', serviceId)
      .where('reservations.status', 'checked_in')
      .groupBy('rooms.room_type_id')
      .select('rooms.room_type_id')
      .select(Database.raw('COUNT(DISTINCT reservation_rooms.room_id) AS occupied'))

    const totalMap = new Map<number, number>()
    for (const row of totalRows) {
      totalMap.set(Number(row.room_type_id), Number(row.total || 0))
    }

    const occupiedMap = new Map<number, number>()
    for (const row of occupiedRows) {
      occupiedMap.set(Number(row.room_type_id), Number((row as any).occupied || 0))
    }

    const suites = roomTypes.map((rt) => {
      const totalRooms = totalMap.get(rt.id) ?? 0
      const occupied = occupiedMap.get(rt.id) ?? 0
      const free = Math.max(totalRooms - occupied, 0)
      const rate = totalRooms > 0 ? (occupied / totalRooms) * 100 : 0
      return {
        roomTypeId: rt.id,
        roomTypeName: rt.roomTypeName,
        totalRooms,
        occupied,
        free,
        occupancyRate: `${rate.toFixed(0)}%`,
      }
    })

    return { suites }
  }


  private async getHousekeepingData(serviceId: number, targetDate?: DateTime, trx?: any) {
    const date = targetDate || DateTime.now()
    const dateStr = date.toFormat('yyyy-MM-dd')

    // Récupérer les IDs des chambres bloquées
    const blockedRooms = await RoomBlock.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .where('block_from_date', '<=', dateStr)
      .where('block_to_date', '>=', dateStr)
      .whereNot('status', 'completed')
      .select('room_id')
      .distinct('room_id')

    const blockedRoomIds = blockedRooms.map(br => br.roomId)

    //  Compter les statuts pour les chambres non bloquées
    const housekeepingStatusCounts = await Room.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .whereNotIn('id', blockedRoomIds.length ? blockedRoomIds : [0])
      .groupBy('housekeeping_status')
      .select('housekeeping_status')
      .count('* as total')

    //  Compter le total de chambres
    const totalRooms = await Room.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .count('* as total')

    const total = Number(totalRooms[0].$extras.total || 0)

    // Initialiser les compteurs
    const counts = {
      clean: 0,
      inspected: 0,
      dirty: 0,
      checkout: 0,
      other: 0,
      blocked: blockedRoomIds.length
    }

    //  Remplir les compteurs à partir de la requête groupée
    for (const item of housekeepingStatusCounts) {
      const status = item.housekeepingStatus
      const count = Number(item.$extras.total || 0)

      if (status === 'clean') counts.clean = count
      else if (status === 'inspected') counts.inspected = count
      else if (status === 'dirty') counts.dirty = count
      else if (status === 'checkout') counts.checkout = count
      else if (status) counts.other = count
    }

    //  Calculer le total non bloqué (pour vérification)
    const nonBlockedTotal = counts.clean + counts.inspected + counts.dirty + counts.checkout + counts.other

    console.log({
      total,
      blocked: counts.blocked,
      nonBlockedTotal,
      counts
    })

    return {
      housekeepingStatus: {
        clean: counts.clean,
        inspected: counts.inspected,
        dirty: counts.dirty,
        blocked: counts.blocked,
        toClean: counts.dirty + counts.checkout,
        cleanPercentage: (total - counts.blocked) > 0
          ? Math.round((counts.clean / (total - counts.blocked)) * 100)
          : 0,
        total: total,
      }
    }
  }



  private async getUnpaidFoliosData(serviceId: number, startDate?: string, endDate?: string, status?: string, trx?: any) {
    const query = Folio.query(trx ? { client: trx } : undefined)
      .where('hotel_id', serviceId)
      .where('balance', '>', 0)
      .where('status', 'open')
      .whereHas('reservation', (reservationQuery) => {
        reservationQuery.whereIn('status', [ReservationStatus.CHECKED_OUT])

        if (startDate) reservationQuery.where('arrival_date', '>=', startDate)
        if (endDate) reservationQuery.where('departure_date', '<=', endDate)

        if (status) {
          switch (status.toLowerCase()) {
            case 'checkout':
              reservationQuery.where('status', ReservationStatus.CHECKED_OUT)
              break
            case 'inhouse':
              reservationQuery.where('status', ReservationStatus.CHECKED_IN)
              break
            case 'noshow':
              reservationQuery.where('status', ReservationStatus.NOSHOW)
              break
            case 'cancelled':
              reservationQuery.where('status', ReservationStatus.CANCELLED)
              break
          }
        }
      })

    // Select only fields used for rendering and necessary foreign keys for preloads
    query.select('id', 'folio_number', 'balance', 'guest_id', 'reservation_id', 'reservation_room_id')

    const unpaidFolios = await query
      .preload('guest', (guestQuery) => guestQuery.select('id', 'title', 'first_name', 'last_name'))
      .preload('reservation', (reservationQuery) =>
        reservationQuery
          .select('id', 'reservation_number', 'arrived_date', 'depart_date', 'status','guest_id')
          .preload('guest', (guestQuery) => guestQuery.select('id', 'title', 'first_name', 'last_name'))
      )
      .preload('reservationRoom', (roomQuery) =>
        roomQuery
          .select('id', 'room_id')
          .preload('room', (roomInnerQuery) => roomInnerQuery.select('id', 'room_number'))
      )
      .orderBy('balance', 'desc')
      .limit(20)

    const formattedData = unpaidFolios.map(folio => {
      const reservation = folio.reservation
      const guest = folio.guest
      const reservationRoom = folio.reservationRoom

      let displayStatus = reservation?.status
      if (reservation) {
        switch (reservation.status) {
          case ReservationStatus.CHECKED_OUT:
            displayStatus = 'checkout'
            break
          case ReservationStatus.CHECKED_IN:
            displayStatus = 'inhouse'
            break
          case 'checked_in':
            displayStatus = 'inhouse'
            break
          case ReservationStatus.NOSHOW:
            displayStatus = 'noshow'
            break
          case ReservationStatus.CANCELLED:
            displayStatus = 'cancelled'
            break
        }
      }

      return {
        folioNumber: folio.folioNumber,
        id: folio.id,
        reservationNumber: reservation?.reservationNumber || reservation?.confirmationCode || 'N/A',
        guestName: guest ? `${guest.displayName}`.trim() : 'N/A',
        arrival: reservation?.arrivedDate?.toFormat('yyyy-MM-dd') || 'N/A',
        departure: reservation?.departDate?.toFormat('yyyy-MM-dd') || 'N/A',
        status: displayStatus,
        balance: folio.balance,
        roomNumber: reservationRoom?.room?.roomNumber || 'N/A',
        reservationId: reservation?.id,
      }
    })

    return {
      unpaidFolios: {
        total: formattedData.length,
        foliosList: formattedData
      }
    }
  }


}
