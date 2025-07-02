// room_services.ts
import ServiceProduct from '#models/service_product'
import Reservation from '#models/reservation'
import Service from '#models/service'
import { DateTime } from 'luxon'

export class RoomAvailabilityService {
  public static async getHotelStats(serviceId: number): Promise<{
    available: number
    total: number
    reservedToday: number
    reservationRateToday: number
    reservationRateLastWeek: number
  }> {
    const service = await Service.find(serviceId)
    if (!service || service.category_id !== 14) {
      throw new Error('Ce service ne correspond pas à un hôtel')
    }

    const totalResult = await ServiceProduct.query().where('service_id', serviceId).count('* as total')
    const availableResult = await ServiceProduct
      .query()
      .where('service_id', serviceId)
      .where('availability', true)
      .where('status', 'available')
      .count('* as available')

    const total = Number(totalResult[0].$extras.total || '0')
    const available = Number(availableResult[0].$extras.available || '0')
    const occupied = total - available

    const todayStart = DateTime.now().startOf('day').toSQL()
    const tomorrowStart = DateTime.now().plus({ days: 1 }).startOf('day').toSQL()
    const lastWeekStart = DateTime.now().minus({ days: 7 }).startOf('day').toSQL()
    const lastWeekEnd = DateTime.now().minus({ days: 6 }).startOf('day').toSQL()

    const reservedTodayResult = await Reservation
      .query()
      .where('service_id', serviceId)
      .whereBetween('created_at', [todayStart, tomorrowStart])
      .count('* as count')

    const reservedToday = Number(reservedTodayResult[0].$extras.count || '0')
    const reservationRateToday = occupied > 0 ? Math.min(100, Math.round((reservedToday / occupied) * 10000) / 100) : 0

    const reservedLastWeekResult = await Reservation
      .query()
      .where('service_id', serviceId)
      .whereBetween('created_at', [lastWeekStart, lastWeekEnd])
      .count('* as count')

    const reservedLastWeek = Number(reservedLastWeekResult[0].$extras.count || '0')
    const reservationRateLastWeek = occupied > 0 ? Math.min(100, Math.round((reservedLastWeek / occupied) * 10000) / 100) : 0

    return {
      available,
      total,
      reservedToday,
      reservationRateToday,
      reservationRateLastWeek
    }
  }
}

export class RoomAnalyticsService {
  public static async getOccupancyStats(
    serviceId: number,
    period: 'weekly' | 'monthly' | 'yearly'
  ): Promise<{
    current: { label: string; occupancyRate: number }[],
    previous: { label: string; occupancyRate: number }[]
  }> {
    const service = await Service.find(serviceId)
    if (!service || service.category_id !== 14) {
      throw new Error("Ce service n'est pas un hôtel")
    }

    const totalRoomsResult = await ServiceProduct.query().where('service_id', serviceId).count('* as total')
    const totalRooms = Number(totalRoomsResult[0].$extras.total || '0')
    if (totalRooms === 0) return { current: [], previous: [] }

    const now = DateTime.now()
    const current: { label: string; occupancyRate: number }[] = []
    const previous: { label: string; occupancyRate: number }[] = []

    const buildOccupancyData = async (daysBackStart: number, daysBackEnd: number, target: typeof current) => {
      for (let i = daysBackStart; i >= daysBackEnd; i--) {
        const day = now.minus({ days: i })
        const start = day.startOf('day').toSQL()
        const end = day.endOf('day').toSQL()

        const countResult = await Reservation
          .query()
          .where('service_id', serviceId)
          .whereBetween('created_at', [start, end])
          .count('* as count')

        const occupied = Number(countResult[0].$extras.count || '0')
        const rate = Math.min(100, Math.round((occupied / totalRooms) * 10000) / 100)

        target.push({ label: day.toFormat('cccc'), occupancyRate: rate })
      }
    }

    if (period === 'weekly') {
      await buildOccupancyData(6, 0, current)
      await buildOccupancyData(13, 7, previous)
    }

    if (period === 'monthly') {
      const startMonth = now.startOf('month')
      const daysInMonth = now.daysInMonth

      for (let d = 1; d <= daysInMonth; d++) {
        const date = startMonth.set({ day: d })
        const start = date.startOf('day').toSQL()
        const end = date.endOf('day').toSQL()

        const countResult = await Reservation.query().where('service_id', serviceId).whereBetween('created_at', [start, end]).count('* as count')
        const occupied = Number(countResult[0].$extras.count || '0')
        const rate = Math.min(100, Math.round((occupied / totalRooms) * 10000) / 100)

        current.push({ label: date.toFormat('dd'), occupancyRate: rate })
      }

      const previousMonth = now.minus({ months: 1 })
      const startPrevious = previousMonth.startOf('month')
      const daysInPrevious = previousMonth.daysInMonth

      for (let d = 1; d <= daysInPrevious; d++) {
        const date = startPrevious.set({ day: d })
        const start = date.startOf('day').toSQL()
        const end = date.endOf('day').toSQL()

        const countResult = await Reservation.query().where('service_id', serviceId).whereBetween('created_at', [start, end]).count('* as count')
        const occupied = Number(countResult[0].$extras.count || '0')
        const rate = Math.min(100, Math.round((occupied / totalRooms) * 10000) / 100)

        previous.push({ label: date.toFormat('dd'), occupancyRate: rate })
      }
    }

    if (period === 'yearly') {
      for (let m = 1; m <= 12; m++) {
        const start = now.set({ month: m, day: 1 }).startOf('month').toSQL()
        const end = now.set({ month: m, day: 1 }).endOf('month').toSQL()

        const countResult = await Reservation.query().where('service_id', serviceId).whereBetween('created_at', [start, end]).count('* as count')
        const occupied = Number(countResult[0].$extras.count || '0')
        const rate = Math.min(100, Math.round((occupied / totalRooms) * 10000) / 100)

        current.push({ label: DateTime.fromObject({ month: m }).toFormat('MMM'), occupancyRate: rate })
      }

      const previousYear = now.minus({ years: 1 })

      for (let m = 1; m <= 12; m++) {
        const start = previousYear.set({ month: m, day: 1 }).startOf('month').toSQL()
        const end = previousYear.set({ month: m, day: 1 }).endOf('month').toSQL()

        const countResult = await Reservation.query().where('service_id', serviceId).whereBetween('created_at', [start, end]).count('* as count')
        const occupied = Number(countResult[0].$extras.count || '0')
        const rate = Math.min(100, Math.round((occupied / totalRooms) * 10000) / 100)

        previous.push({ label: DateTime.fromObject({ month: m }).toFormat('MMM'), occupancyRate: rate })
      }
    }

    return { current, previous }
  }
  public static async getAverageLengthOfStay(serviceId: number): Promise<number> {
    const reservations = await Reservation
      .query()
      .where('service_id', serviceId)
      .select('arrived_date', 'depart_date')

    if (reservations.length === 0) return 0

    let totalNights = 0
    let validCount = 0

    for (const res of reservations) {
      if (!(res.arrived_date instanceof Date) || !(res.depart_date instanceof Date)) continue

      const start = DateTime.fromJSDate(res.arrived_date)
      const end = DateTime.fromJSDate(res.depart_date)

      if (!start.isValid || !end.isValid) continue

      const diff = end.diff(start, 'days').days
      if (diff > 0) {
        totalNights += diff
        validCount++
      }
    }

    if (validCount === 0) return 0

    const average = totalNights / validCount
    return Math.round(average * 100) / 100
  }

}
