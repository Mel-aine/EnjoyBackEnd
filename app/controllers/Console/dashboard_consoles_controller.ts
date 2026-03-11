
import type { HttpContext } from '@adonisjs/core/http'
import Hotel from '#models/hotel'
import Subscription from '#models/subscription'
import ActivityLog from '#models/activity_log'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'



const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

interface ChartRow {
  day?: string
  month?: string
  total: string
}

const now = DateTime.now()

const mapChart = (rows: ChartRow[], type: 'week' | 'year') => {
  return rows.map((row, i, arr) => {
    const value = Number(row.total)
    const prev = i > 0 ? Number(arr[i - 1].total) : null
    const trendUp = prev === null ? true : value >= prev
    const trend =
          prev !== null && prev > 0 && value > 0
            ? `${trendUp ? '+' : ''}${(((value - prev) / prev) * 100).toFixed(1)}%`
            : null



    const date = DateTime.fromJSDate(new Date(row.day ?? row.month ?? ''))
    const label =
      type === 'week'
        ? DAYS_FR[date.weekday - 1]
        : MONTHS_FR[date.month - 1]


    const current =
      type === 'week'
        ? date.weekday === now.weekday
        : date.month === now.month

    return { label, value, trend, trendUp, current }
  })
}

export default class DashboardConsolesController {
 public async index({ response ,request}: HttpContext) {
    const now = DateTime.now()
    const startOfMonth = now.startOf('month')
    const lastMonthStart = startOfMonth.minus({ months: 1 })
    const lastMonthEnd = startOfMonth.minus({ seconds: 1 })
    const in30Days = now.startOf('day').plus({ days: 30 }).endOf('day')
    const alertsPage = request.input('alertsPage', 1)

    const [totalHotelsRow, hotelsThisMonthRow] = await Promise.all([
      Hotel.query().count('* as total').first(),
      Hotel.query()
        .where('created_at', '>=', startOfMonth.toSQL())
        .count('* as total')
        .first(),
    ])

    const [mrrMonthlyRow, mrrLastMonthRow] = await Promise.all([
      Subscription.query()
        .where('status', 'active')
        .where('ends_at', '>', now.toSQL())
        .where('billing_cycle', 'monthly')
        .sum('price as total')
        .first(),

      Subscription.query()
        .where('status', 'active')
        .where('billing_cycle', 'monthly')
        .where('starts_at', '<=', lastMonthEnd.toSQL())
        .where('ends_at', '>', lastMonthStart.toSQL())
        .sum('price as total')
        .first(),
    ])

    const mrrYearlyResult = await db.rawQuery(
      `SELECT COALESCE(SUM(ROUND(price::numeric / 12)), 0) AS total
       FROM subscriptions
       WHERE status = 'active'
       AND ends_at > :now
       AND billing_cycle = 'yearly'`,
      { now: now.toSQL() }
    )

    const mrr = Number(mrrMonthlyRow?.$extras?.total ?? 0)
              + Number(mrrYearlyResult.rows[0]?.total ?? 0)

    const mrrPrev = Number(mrrLastMonthRow?.$extras?.total ?? 0)
    const mrrDiff = mrrPrev > 0 ? (((mrr - mrrPrev) / mrrPrev) * 100).toFixed(1) : null
    const mrrTrend = mrrDiff
      ? `${Number(mrrDiff) >= 0 ? '+' : ''}${mrrDiff}% vs mois dernier`
      : null


    const expiredSubs = await Subscription.query()
      .where('status', 'canceled')
      .where('ends_at', '>=', startOfMonth.toSQL())
      .where('ends_at', '<=', now.toSQL())
      .select('hotel_id', 'module_id')

    let renewedCount = 0

    await Promise.all(
      expiredSubs.map(async (sub) => {

        const previousSub = await Subscription.query()
          .where('hotel_id', sub.hotelId)
          .where('module_id', sub.moduleId)
          .where('starts_at', '<', startOfMonth.toSQL())
          .first()

        if (!previousSub) return

        // Vérifier s'il a été recréé ce mois
        const renewed = await Subscription.query()
          .where('hotel_id', sub.hotelId)
          .where('module_id', sub.moduleId)
          .where('status', 'active')
          .where('starts_at', '>=', startOfMonth.toSQL())
          .first()

        if (renewed) renewedCount++
      })
    )

    const renewalRate =
      expiredSubs.length > 0
        ? ((renewedCount / expiredSubs.length) * 100).toFixed(1)
        : '100'

    const expiringSubscriptions = await Subscription.query()
      .where('status', 'active')
      .where('ends_at', '>', now.toSQL())
      .where('ends_at', '<=', in30Days.toSQL())
      .preload('hotel')
      .preload('module')
      .orderBy('ends_at', 'asc')
      .paginate(alertsPage, 5)

    const nowDay = now.startOf('day')

    const licenseAlerts = {
      data: expiringSubscriptions.all().map((sub) => {
        const endsAtDay = sub.endsAt?.startOf('day')
        const daysLeft = endsAtDay ? Math.ceil(endsAtDay.diff(nowDay, 'days').days) : 0

        return {
          id: sub.id,
          hotel: sub.hotel?.hotelName ?? 'Inconnu',
          hotelId: sub.hotelId,
          product:{
          module: sub.module?.name ?? 'Inconnu',
          slug:sub.module?.slug ?? 'Inconnu',
          },
          dueDate: sub.endsAt?.toISODate() ?? null,
          daysLeft,
        }
      }),
      meta: expiringSubscriptions.getMeta(),
    }



    const recentLogs = await ActivityLog.query()
      .whereIn('action', ['subscription.create', 'hotel.create', 'subscription.update'])
      .orderBy('created_at', 'desc')
      .limit(5)

    const recentActivations = recentLogs.map((log) => ({
      id: log.id,
      description: log.description,
      action: log.action,
      hotelId: log.hotelId,
      time: log.createdAt.toRelative({ locale: 'fr' }),
    }))


    const [revenueWeekRaw, revenueYearRaw] = await Promise.all([
      db.rawQuery(`
        SELECT
          gs.day::date AS day,
          COALESCE(SUM(s.price), 0) AS total
        FROM generate_series(
          date_trunc('week', NOW()),
          date_trunc('week', NOW()) + interval '6 days',
          interval '1 day'
        ) AS gs(day)
        LEFT JOIN subscriptions s
          ON DATE_TRUNC('day', s.starts_at)::date = gs.day::date
          AND s.status = 'active'
        GROUP BY gs.day
        ORDER BY gs.day ASC
      `),

      db.rawQuery(`
        SELECT
          gs.month::date AS month,
          COALESCE(SUM(s.price), 0) AS total
        FROM generate_series(
          date_trunc('year', NOW()),
          date_trunc('year', NOW()) + interval '11 months',
          interval '1 month'
        ) AS gs(month)
        LEFT JOIN subscriptions s
          ON DATE_TRUNC('month', s.starts_at)::date = gs.month::date
          AND s.status = 'active'
        GROUP BY gs.month
        ORDER BY gs.month ASC
      `),
    ])


    return response.ok({
      stats: {
        totalHotels: Number(totalHotelsRow?.$extras?.total ?? 0),
        hotelsThisMonth: Number(hotelsThisMonthRow?.$extras?.total ?? 0),
        mrr,
        mrrTrend,
        renewalRate: `${renewalRate}%`,
        renewalObjectif: '99%',
      },
      licenseAlerts,
      recentActivations,
      revenueChart: {
        week: mapChart(revenueWeekRaw.rows, 'week'),
        year: mapChart(revenueYearRaw.rows, 'year'),
      },
    })
  }
}
