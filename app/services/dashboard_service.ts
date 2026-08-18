import Reservation from '#models/reservation'
import Service from '#models/hotel'
import { DateTime } from 'luxon'
import Room from '#models/room'
import FolioTransaction from '#models/folio_transaction'
import Hotel from '#models/hotel'
import ReservationRoom from '#models/reservation_room'
import RoomBlock from '#models/room_block'


export class RoomAvailabilityService {


  public static async calculateRevenueWithTax(
    hotelId: number,
    startDate: DateTime,
    endDate: DateTime
  ): Promise<{ revenueWithoutTax: number; tax: number; revenueWithTax: number }> {
    const startStr = startDate.toFormat('yyyy-MM-dd')
    const endStr = endDate.toFormat('yyyy-MM-dd')

    const scopeFolio = (folioQuery: any) => {
      folioQuery.whereHas('reservationRoom', (rrQuery: any) => {
        rrQuery.where('hotel_id', hotelId)
        rrQuery.whereIn('status', ['checked_in', 'checked_out', 'reserved'])
        rrQuery.whereDoesntHave('roomType', (rtQuery: any) => rtQuery.where('is_paymaster', true))
      })
    }

    // ── Room Charges ─────────────────────────────
    const roomChargesRow = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startStr, endStr])
      .where('category', 'room')
      .where('transaction_type', 'charge')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .sum('room_final_net_amount as total')
      .first()
    const roomCharges = Number((roomChargesRow as any)?.$extras.total || 0)

    // ── Extra Charges ────────────────────────────
    const extraChargesRow = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startStr, endStr])
      .where('category', 'extra_charge')
      .where('transaction_type', 'charge')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .sum('amount as total')
      .first()
    const extraCharges = Number((extraChargesRow as any)?.$extras.total || 0)

    // ── Discounts ─────────────────────────────────
    const discountRow = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startStr, endStr])
      .whereNotNull('discount_amount')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .sum('discount_amount as total')
      .first()
    const discounts = Math.abs(Number((discountRow as any)?.$extras.total || 0))

    // ── Adjustments (round off uniquement) ───────
    const adjustmentTx = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startStr, endStr])
      .where('category', 'adjustment')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .select('amount', 'particular', 'description')

    let adjustments = 0
    for (const tx of adjustmentTx as any[]) {
      const amount = Number(tx.amount || 0)
      const desc = (tx.particular || tx.description || '').toLowerCase()
      const isRoundOff =
        desc.includes('round') || desc.includes('unit adjustment') || Math.abs(amount) < 1
      if (isRoundOff) adjustments += amount
    }

    // ── Tax ───────────────────────────────────────
    const taxTx = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startStr, endStr])
      .whereNotIn('status', ['cancelled', 'voided'])
      .whereNot('is_voided', true)
      .select('id', 'tax_breakdown')
      .preload('taxes' as any)

    let tax = 0
    for (const tx of taxTx as any[]) {
      if (tx.taxBreakdown?.items?.length > 0) {
        tx.taxBreakdown.items.forEach((t: any) => {
          tax += Number(t.taxAmount || 0)
        })
      } else if (tx.taxes?.length > 0) {
        tx.taxes.forEach((t: any) => {
          tax += Number(t?.$pivot?.taxAmount ?? t?.taxAmount ?? 0)
        })
      }
    }

    const revenueWithoutTax = roomCharges + extraCharges - discounts + adjustments
    const revenueWithTax = revenueWithoutTax + tax

    return { revenueWithoutTax, tax, revenueWithTax }
  }

  public static async getHotelStats(serviceId: number): Promise<{
  available: number
  total: number
  reservedToday: number
  reservationRateToday: number
  reservationRateLastWeek: number
  totalReservationsThisMonth: number
  totalRevenueThisMonth: number
  revenueGrowthRate: number
}> {
  const service = await Service.find(serviceId)
  if (!service) {
    throw new Error('Ce service ne correspond pas à un hôtel')
  }

  const totalResult = await Room.query()
    .where('hotel_id', serviceId)
    .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
    .count('* as total')
  const availableResult = await Room.query()
    .where('hotel_id', serviceId)
    .where('status', 'available')
    .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
    .count('* as available')

  const total = Number(totalResult[0].$extras.total || '0')
  const available = Number(availableResult[0].$extras.available || '0')
  const occupied = total - available

  const now = DateTime.now()
  const todayStart = now.startOf('day').toSQL()
  const tomorrowStart = now.plus({ days: 1 }).startOf('day').toSQL()
  const lastWeekStart = now.minus({ days: 7 }).startOf('day').toSQL()
  const lastWeekEnd = now.minus({ days: 6 }).startOf('day').toSQL()

  const reservedTodayResult = await Reservation.query()
    .where('hotel_id', serviceId)
    .where('status', 'confirmed')
    .whereBetween('arrived_date', [todayStart, tomorrowStart])
    .whereDoesntHave('reservationRooms', (rr) => {
      rr.whereHas('room', (r) => {
        r.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
      })
    })
    .count('* as count')

  const reservedToday = Number(reservedTodayResult[0].$extras.count || '0')
  const reservationRateToday =
    occupied > 0 ? Math.min(100, Math.round((reservedToday / occupied) * 10000) / 100) : 0

  const reservedLastWeekResult = await Reservation.query()
    .where('hotel_id', serviceId)
    .whereBetween('bookingDate', [lastWeekStart, lastWeekEnd])
    .whereDoesntHave('reservationRooms', (rr) => {
      rr.whereHas('room', (r) => {
        r.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
      })
    })
    .count('* as count')

  const reservedLastWeek = Number(reservedLastWeekResult[0].$extras.count || '0')
  const reservationRateLastWeek =
    occupied > 0 ? Math.min(100, Math.round((reservedLastWeek / occupied) * 10000) / 100) : 0

  const startOfMonth = now.startOf('month')
  const endOfMonth = now.endOf('month')

  const totalReservationsThisMonthResult = await Reservation.query()
    .where('hotel_id', serviceId)
    .whereBetween('bookingDate', [startOfMonth.toSQL(), endOfMonth.toSQL()])
    .whereDoesntHave('reservationRooms', (rr) => {
      rr.whereHas('room', (r) => {
        r.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
      })
    })
    .count('* as count')

  const totalReservationsThisMonth = Number(
    totalReservationsThisMonthResult[0].$extras.count || '0'
  )

  // ── Revenue "à date" (PTD) : du début du mois jusqu'à AUJOURD'HUI ──
  // (aligné avec le Management/Night Audit report qui s'arrête au jour du rapport,
  //  pas à la fin du mois calendaire)
  const { revenueWithTax: totalRevenueThisMonth } = await this.calculateRevenueWithTax(
    serviceId,
    startOfMonth,
    now.endOf('day')
  )

  // ── Revenue du mois précédent, sur la MÊME plage relative (1er -> même jour du mois dernier) ──
  // pour comparer des périodes équivalentes (sinon on compare un PTD partiel à un mois complet)
  const startOfLastMonth = now.minus({ months: 1 }).startOf('month')
  const sameDayLastMonth = startOfLastMonth.plus({ days: now.day - 1 }).endOf('day')

  const { revenueWithTax: lastMonthRevenue } = await this.calculateRevenueWithTax(
    serviceId,
    startOfLastMonth,
    sameDayLastMonth
  )

  const revenueGrowthRate =
    lastMonthRevenue === 0
      ? totalRevenueThisMonth > 0
        ? 100
        : 0
      : Math.round(((totalRevenueThisMonth - lastMonthRevenue) / lastMonthRevenue) * 10000) / 100

  return {
    available,
    total,
    reservedToday,
    reservationRateToday,
    reservationRateLastWeek,
    totalReservationsThisMonth,
    totalRevenueThisMonth,
    revenueGrowthRate,
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
    const hotel = await Hotel.find(serviceId)
    if (!hotel) {
      throw new Error("Ce service n'est pas un hôtel")
    }

    // Total chambres : exclure out_of_order ET paymaster
    const totalRoomsResult = await Room.query()
      .where('hotel_id', serviceId)
      .where('status', '!=', 'out_of_order')
      .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
      .count('* as total')
    const baseTotalRooms = Number(totalRoomsResult[0].$extras.total || '0')
    if (baseTotalRooms === 0) return { current: [], previous: [] }

    const now = DateTime.now()
    const current: { label: string; occupancyRate: number }[] = []
    const previous: { label: string; occupancyRate: number }[] = []

    // Compte les chambres bloquées pour une date donnée
    const countBlockedForDate = async (date: DateTime): Promise<number> => {
      const dateStr = date.toISODate()
      if (!dateStr) return 0
      const result = await RoomBlock
        .query()
        .where('hotel_id', serviceId)
        .whereNot('status', 'completed')
        .where('block_from_date', '<=', dateStr)
        .where('block_to_date', '>=', dateStr)
        .whereHas('room', (roomQuery) => {
          roomQuery.where('status', '!=', 'out_of_order')
          roomQuery.whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
        })
        .countDistinct('room_id as total')
      return Number(result[0].$extras.total || '0')
    }

    // Compte les chambres occupées pour une date donnée
    const countOccupiedForDate = async (date: DateTime): Promise<number> => {
      const dateStr = date.toISODate()
      if (!dateStr) return 0
      const result = await ReservationRoom
        .query()
        .where('hotel_id', serviceId)
        .whereIn('status', ['confirmed', 'checked_in', 'checked_out'])
        .where('check_in_date', '<=', dateStr)
        .where('check_out_date', '>', dateStr)
        .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
        .count('* as count')
      return Number(result[0].$extras.count || '0')
    }

    const buildOccupancyData = async (daysBackStart: number, daysBackEnd: number, target: typeof current) => {
      for (let i = daysBackStart; i >= daysBackEnd; i--) {
        const day = now.minus({ days: i })
        const [occupied, blocked] = await Promise.all([
          countOccupiedForDate(day),
          countBlockedForDate(day),
        ])
        const netRooms = baseTotalRooms - blocked
        const rate = netRooms > 0
          ? Math.min(100, Math.round((occupied / netRooms) * 10000) / 100)
          : 0
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
        const [occupied, blocked] = await Promise.all([
          countOccupiedForDate(date),
          countBlockedForDate(date),
        ])
        const netRooms = baseTotalRooms - blocked
        const rate = netRooms > 0
          ? Math.min(100, Math.round((occupied / netRooms) * 10000) / 100)
          : 0
        current.push({ label: date.toFormat('dd'), occupancyRate: rate })
      }

      const previousMonth = now.minus({ months: 1 })
      const startPrevious = previousMonth.startOf('month')
      const daysInPrevious = previousMonth.daysInMonth

      for (let d = 1; d <= daysInPrevious; d++) {
        const date = startPrevious.set({ day: d })
        const [occupied, blocked] = await Promise.all([
          countOccupiedForDate(date),
          countBlockedForDate(date),
        ])
        const netRooms = baseTotalRooms - blocked
        const rate = netRooms > 0
          ? Math.min(100, Math.round((occupied / netRooms) * 10000) / 100)
          : 0
        previous.push({ label: date.toFormat('dd'), occupancyRate: rate })
      }
    }

    if (period === 'yearly') {
      const calcMonthlyRate = async (year: number, target: typeof current) => {
        for (let m = 1; m <= 12; m++) {
          const monthStart = DateTime.fromObject({ year, month: m }).startOf('month')
          const monthEnd = monthStart.endOf('month')
          const daysInMonth = monthStart.daysInMonth!

          let totalOccupied = 0
          let totalBlockedNights = 0
          let cursor = monthStart
          while (cursor <= monthEnd) {
            const [occ, blk] = await Promise.all([
              countOccupiedForDate(cursor),
              countBlockedForDate(cursor),
            ])
            totalOccupied += occ
            totalBlockedNights += blk
            cursor = cursor.plus({ days: 1 })
          }

          const totalPossibleNights = baseTotalRooms * daysInMonth
          const totalNetNights = totalPossibleNights - totalBlockedNights
          const rate = totalNetNights > 0
            ? Math.min(100, Math.round((totalOccupied / totalNetNights) * 10000) / 100)
            : 0
          target.push({ label: monthStart.toFormat('MMM'), occupancyRate: rate })
        }
      }

      await Promise.all([
        calcMonthlyRate(now.year, current),
        calcMonthlyRate(now.minus({ years: 1 }).year, previous),
      ])
    }

    return { current, previous }
  }

public static async getAverageLengthOfStay(serviceId: number, year?: number): Promise<{
  currentYear: number,
  currentALOS: number,
  previousYear: number,
  previousALOS: number
}> {
  const now = DateTime.now()
  const currentYear = year || now.year
  const previousYear = currentYear - 1

  const calculateALOS = async (yearToCheck: number): Promise<number> => {
    const startOfYear = DateTime.fromObject({ year: yearToCheck, month: 1, day: 1 }).startOf('year')
    const endOfYear = startOfYear.endOf('year')

    const reservations = await Reservation
      .query()
      .where('hotel_id', serviceId)
      .whereBetween('arrived_date', [startOfYear.toSQL()!, endOfYear.toSQL()!])
      .whereDoesntHave('reservationRooms', (rr) => {
        rr.whereHas('room', (r) => {
          r.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
        })
      })
      .select('arrived_date', 'depart_date')

    let totalNights = 0
    let validCount = 0

    for (const res of reservations) {
      if (!res.arrivedDate || !res.departDate) continue

      const start = DateTime.fromISO(res.arrivedDate.toString())
      const end = DateTime.fromISO(res.departDate.toString())

      if (!start.isValid || !end.isValid) continue

      const diff = end.diff(start, 'days').days
      if (diff > 0) {
        totalNights += diff
        validCount++
      }
    }

    return validCount === 0 ? 0 : Math.round((totalNights / validCount) * 100) / 100
  }

  const [currentALOS, previousALOS] = await Promise.all([
    calculateALOS(currentYear),
    calculateALOS(previousYear)
  ])

  return {
    currentYear,
    currentALOS,
    previousYear,
    previousALOS
  }
}


  }







