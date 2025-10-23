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
import db from '@adonisjs/lucid/services/db'
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

  //   public async getRevenueStats({ params, request, response }: HttpContext) {
  //     try {
  //       const serviceId = parseInt(params.serviceId)
  //       const period = request.qs().period as 'monthly' | 'quarterly' | 'semester' | 'yearly'

  //       if (!['monthly', 'quarterly', 'semester', 'yearly'].includes(period)) {
  //         return response.badRequest({ success: false, message: 'Période invalide' })
  //       }


  //     return response.ok({ success: true, data: [] })
  //   } catch (error) {
  //     return response.internalServerError({ success: false, message: error.message })
  //   }
  // }
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
          .whereBetween('transaction_date', [startOfYear!, endOfYear!])
          .select(Database.raw("TO_CHAR(transaction_date, 'Mon') AS month"))
          .sum('amount as totalRevenue')
          .groupByRaw(Database.raw("TO_CHAR(transaction_date, 'Mon')"))
          .orderByRaw('MIN(transaction_date)')

        const prevResults = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('transaction_date', [startOfPrevYear!, endOfPrevYear!])
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
          .whereBetween('transaction_date', [startOfYear!, endOfYear!])
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
          .whereBetween('transaction_date', [startOfPrevYear!, endOfPrevYear!])
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
          .whereBetween('transaction_date', [startOfYear!, endOfYear!])
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
          .whereBetween('transaction_date', [startOfPrevYear!, endOfPrevYear!])
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
          .whereBetween('transaction_date', [startOfYear!, endOfYear!])
          .sum('amount as totalRevenue')
          .first()

        const prevResult = await Database
          .from('folio_transactions')
          .where('hotel_id', serviceId)
          .where('transaction_type', 'payment')
          .where('is_voided', false)
          .whereBetween('transaction_date', [startOfPrevYear!, endOfPrevYear!])
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
    const trx = await db.transaction()
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
        notificationData,
        unpaidFoliosData,
        recentActivities
      ] = await Promise.all([
        this.getArrivalsData(serviceId, targetDate, trx),
        this.getDeparturesData(serviceId, targetDate, trx),
        this.getInHouseData(serviceId, targetDate, trx),
        this.getRoomStatusData(serviceId, trx, startDate),
        this.getRevenueData(serviceId, startDate, endDate, trx),
        this.getSuiteOccupancyData(serviceId, trx),
        this.getHousekeepingData(serviceId, trx),
        // this.getWeeklyData(serviceId, selectedDate, trx),
        this.getNotificationData(serviceId, targetDate, trx),
        this.getUnpaidFoliosData(serviceId, trx),

        ActivityLog.query({ client: trx })
          .where('hotel_id', serviceId)
          .whereBetween('created_at', [startDate.toSQL()!, endDate.toSQL()!])
          .orderBy('created_at', 'desc')
          .limit(5)
          .preload('user'),
      ])


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
      await trx.commit()

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
          ...notificationData,

          activityFeeds: Array.isArray(recentActivities) ? recentActivities.map((activity: any) => ({
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
          })) : [],
          metadata: metadata,
          performance: {
            loadTime: loadTime,
            queriesExecuted: 15, // Approximate number of queries
            cacheHit: false,
            dataFreshness: 'real-time',
          },
        },
      })
    } catch (error) {
      await trx.rollback()
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

  private async getArrivalsData(serviceId: number, targetDate: string, trx: any) {
    const [arrivalPending, arrivalCheckedIn, totalArrivals] = await Promise.all([
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('arrived_date', targetDate)
        .where('status', 'confirmed')
        .count('* as total'),
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('arrived_date', targetDate)
        .where('status', 'checked_in')
        .count('* as total'),
      Reservation.query({ client: trx })
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

  private async getDeparturesData(serviceId: number, targetDate: string, trx: any) {
    const [departurePending, departureCheckedOut, totalDepartures] = await Promise.all([
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('depart_date', targetDate)
        .where('status', 'checked_in')
        .count('* as total'),
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('depart_date', targetDate)
        .where('status', 'checked_out')
        .count('* as total'),
      Reservation.query({ client: trx })
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

  private async getInHouseData(serviceId: number, targetDate: string, trx: any) {
    const [guestInHouseAdult, guestInHouseChild, totalInHouse] = await Promise.all([
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .where('arrived_date', '<=', targetDate)
        .where('depart_date', '>', targetDate)
        .sum('adults as total'),
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('status', 'checked_in')
        .where('arrived_date', '<=', targetDate)
        .where('depart_date', '>', targetDate)
        .sum('children as total'),
      Reservation.query({ client: trx })
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

  private async getRoomStatusData(serviceId: number, trx: any, currentDate?: DateTime) {
    const targetDate = currentDate || DateTime.now();

    const [
      roomStatusCounts,
      roomStatusDayUse,
      roomStatusComplimentary,
      totalRoomsCount,
      roomBlocksForDate
    ] = await Promise.all([
      Room.query({ client: trx })
        .where('hotel_id', serviceId)
        .groupBy('status')
        .select('status')
        .count('* as total'),
      ReservationRoom.query({ client: trx })
        .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
        .where('reservations.hotel_id', serviceId)
        .where('reservation_rooms.status', 'day_use')
        .count('* as total'),
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('complimentary_room', 'true')
        .count('* as total'),
      Room.query({ client: trx }).where('hotel_id', serviceId).count('* as total'),
      // Récupération des chambres bloquées pour la date donnée
      RoomBlock.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('block_from_date', '<=', targetDate.toFormat('yyyy-MM-dd'))
        .where('block_to_date', '>=', targetDate.toFormat('yyyy-MM-dd'))
        .whereNot('status', 'completed')
        .preload('room')
    ])

    // Créer un Set des IDs des chambres bloquées
    const blockedRoomIds = new Set<number>()
    roomBlocksForDate.forEach(block => {
      if (block.room) {
        blockedRoomIds.add(block.room.id)
      }
    })

    const totalRooms = Number(totalRoomsCount[0].$extras.total || '0')
    const occupiedRooms =
      (Number(roomStatusCounts.find((item) => item.status === 'occupied')?.$extras.total) || 0) +
      Number(roomStatusDayUse[0].$extras.total || '0') +
      Number(roomStatusComplimentary[0].$extras.total || '0')
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0
    const roomsInMaintenanceCount =
      Number(roomStatusCounts.find((item) => item.status === 'in_maintenance')?.$extras.total) || 0

    // Nombre de chambres bloquées pour la date
    const blockedRoomsCount = blockedRoomIds.size

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
        // Ajout des chambres bloquées par date
        blockedForDate: blockedRoomsCount,
        maintenance: roomsInMaintenanceCount,
        total: totalRooms,
        occupancyRate: occupancyRate,
        availableRooms: totalRooms - occupiedRooms - roomsInMaintenanceCount - blockedRoomsCount,
      },
      // Détails des chambres bloquées
      blockedRoomsDetails: roomBlocksForDate.map(block => ({
        blockId: block.id,
        roomId: block.room?.id,
        roomNumber: block.room?.roomNumber,
        blockFromDate: block.blockFromDate,
        blockToDate: block.blockToDate,
        blockReason: block.reason || 'Non spécifié',
        notes: block.description || 'Aucune description',
      }))
    }
  }

  private async getRevenueData(serviceId: number, startDate: DateTime, endDate: DateTime, trx: any) {
    const revenueDataOptimized = await ReservationRoom.query({ client: trx })
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

    const occupiedRooms = await Reservation.query({ client: trx })
      .where('hotel_id', serviceId)
      .where('status', 'checked_in')
      .count('* as total')
    const totalRooms = await Room.query({ client: trx }).where('hotel_id', serviceId).count('* as total')

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

  private async getSuiteOccupancyData(serviceId: number, trx: any) {
    // Preload-based aggregation without manual joins, ordered by sort_order
    const roomTypes = await RoomType
      .query({ client: trx })
      .where('hotel_id', serviceId)
      .orderBy('sort_order', 'asc')
      .preload('rooms', (roomQuery) => {
        roomQuery.where('hotel_id', serviceId).select(['id', 'room_type_id', 'hotel_id'])
      })

    const checkedInReservations = await Reservation
      .query({ client: trx })
      .where('hotel_id', serviceId)
      .where('status', 'checked_in')
      .preload('reservationRooms', (rrQuery) => {
        rrQuery.preload('room', (roomQuery: any) => {
          roomQuery.select(['id', 'room_type_id', 'hotel_id'])
        })
      })

    // Build occupancy map: roomTypeId -> distinct occupied room ids
    const occupiedByType = new Map<number, Set<number>>()
    for (const res of checkedInReservations) {
      const rrs = (res as any).reservationRooms || []
      for (const rr of rrs) {
        const room = (rr as any).room
        if (!room) continue
        if (room.hotelId !== serviceId) continue
        const typeId = room.roomTypeId
        if (!occupiedByType.has(typeId)) {
          occupiedByType.set(typeId, new Set<number>())
        }
        occupiedByType.get(typeId)!.add(room.id)
      }
    }

    const suites = roomTypes.map((rt) => {
      const totalRooms = rt.rooms ? rt.rooms.length : 0
      const occupied = occupiedByType.get(rt.id)?.size || 0
      const free = totalRooms - occupied
      const rate = totalRooms > 0 ? (occupied / totalRooms) * 100 : 0

      return {
        roomTypeId: rt.id,
        roomTypeName: rt.roomTypeName,
        totalRooms,
        occupied,
        free,
        occupancyRate: `${rate.toFixed(2)}%`,
      }
    })

    return { suites: suites }
  }




  private async getHousekeepingData(serviceId: number, trx: any, targetDate?: DateTime) {
    const date = targetDate || DateTime.now()
    const housekeepingStatusCounts = await Room.query({ client: trx })
      .where('hotel_id', serviceId)
      .groupBy('housekeeping_status')
      .select('housekeeping_status')
      .count('* as total')
    const totalRooms = await Room.query({ client: trx }).where('hotel_id', serviceId).count('* as total')

    const blockedCountResult = await RoomBlock.query({ client: trx })
      .where('hotel_id', serviceId)
      .where('block_from_date', '<=', date.toFormat('yyyy-MM-dd'))
      .where('block_to_date', '>=', date.toFormat('yyyy-MM-dd'))
      .whereNot('status', 'completed')
      .count('* as total')

    const blockedCount = Number(blockedCountResult[0].$extras.total || 0)

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
        blocked: blockedCount,
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


  private async getNotificationData(serviceId: number, targetDate: string, trx: any) {
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
      Folio.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('balance', '>', 0)
        .where('settlement_status', '!=', 'settled')
        .where('status', 'open')
        .whereHas('reservation', (query) => {
          query.whereNotIn('status', ['confirmed', 'pending'])
        })
        .count('* as total'),
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('status', 'overbooked')
        .where('check_in_date', targetDate)
        .count('* as total'),
      WorkOrder.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('status', '!=', 'completed')
        .count('* as total'),
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('status', 'inquiry')
        .count('* as total'),
      Reservation.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('payment_status', 'failed')
        .count('* as total'),
      Guest.query({ client: trx })
        .whereHas('reservations', (query) => {
          query.where('hotel_id', serviceId).where('status', 'checked_in')
        })
        .count('* as total'),
      ActivityLog.query({ client: trx })
        .where('entity_type', 'guest_message')
        .where('action', 'unread')
        .whereRaw('DATE(created_at) = ?', [targetDate])
        .count('* as total'),
      Task.query({ client: trx })
        .where('hotel_id', serviceId)
        .where('task_type', 'cardkey_issue')
        .where('status', '!=', 'done')
        .count('* as total'),
      Task.query({ client: trx }).where('hotel_id', serviceId).where('status', '!=', 'done').count('* as total'),
      ActivityLog.query({ client: trx })
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
    const roomsInMaintenanceCount = await Room.query({ client: trx })
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

  private async getUnpaidFoliosData(serviceId: number, trx: any, startDate?: string, endDate?: string, status?: string) {
    const query = Folio.query({ client: trx })
      .where('hotel_id', serviceId)
      .where('balance', '>', 0)
      .where('status', 'open')
      .whereHas('reservation', (reservationQuery) => {
        reservationQuery.whereNotIn('status', [ReservationStatus.CONFIRMED, ReservationStatus.PENDING])

        if (startDate) reservationQuery.where('scheduled_arrival_date', '>=', startDate)
        if (endDate) reservationQuery.where('scheduled_departure_date', '<=', endDate)

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

    const unpaidFolios = await query
      .preload('guest')
      .preload('reservation', (reservationQuery) => reservationQuery.preload('guest'))
      .preload('reservationRoom', (roomQuery) => roomQuery.preload('room'))
      .preload('transactions', (transactionQuery) => transactionQuery.where('is_voided', false).orderBy('transaction_date', 'desc'))
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
