import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import Room from '#models/room'
import ReservationRoom from '#models/reservation_room'
import RoomBlock from '#models/room_block'
import FolioTransaction from '../models/folio_transaction.js'

type PeriodType = 'monthly' | 'quarterly' | 'semester' | 'yearly'

export class HotelAnalyticsDashboardService {
  public static async getAverageOccupancyRate(serviceId: number, period: PeriodType) {
    // Validation du paramètre period
    const validPeriods: PeriodType[] = ['monthly', 'quarterly', 'semester', 'yearly']
    if (!validPeriods.includes(period)) {
      throw new Error(`Invalid period: ${period}. Valid periods are: ${validPeriods.join(', ')}`)
    }

    const now = DateTime.now()

    // Calcul des périodes selon le type
    const periods = {
      monthly: { current: now.startOf('month') },
      quarterly: { current: now.startOf('quarter') },
      semester: {
        current: DateTime.fromObject({ year: now.year, month: now.month <= 6 ? 1 : 7 }),
      },
      yearly: { current: now.startOf('year') },
    }

    const periodConfig = periods[period]
    if (!periodConfig) {
      throw new Error(
        `Invalid period type: ${period}. Valid types are: ${Object.keys(periods).join(', ')}`
      )
    }

    const { current } = periodConfig
    const previous = current.minus({
      months: period === 'monthly' ? 1 : period === 'quarterly' ? 3 : period === 'semester' ? 6 : 0,
      years: period === 'yearly' ? 1 : 0,
    })

    // Nombre total de chambres (hors paymaster et out_of_order)
    const totalRoomsResult = await Room.query()
      .where('hotel_id', serviceId)
      .where('status', '!=', 'out_of_order')
      .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
      .count('* as total')
    const totalRooms = Number(totalRoomsResult[0].$extras.total || '0')

    if (totalRooms === 0) {
      return {
        currentRate: 0,
        previousRate: 0,
        difference: 0,
        variationPercentage: 0,
      }
    }

    // Calcul des dates de fin basé sur la période réelle (mois/année)
    const currentEnd =
      period === 'yearly'
        ? current.plus({ years: 1 })
        : current.plus({ months: period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 6 })
    const previousEnd =
      period === 'yearly'
        ? previous.plus({ years: 1 })
        : previous.plus({ months: period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 6 })

    const daysInPeriod = currentEnd.diff(current, 'days').days
    const totalPossibleNights = totalRooms * daysInPeriod

    const [currentData, previousData] = await Promise.all([
      this.countNights(serviceId, current, currentEnd),
      this.countNights(serviceId, previous, previousEnd),
    ])

    const currentNetNights = totalPossibleNights - currentData.blockedNights
    const previousNetNights = totalPossibleNights - previousData.blockedNights

    const currentRate =
      currentNetNights > 0
        ? Math.round((currentData.occupiedNights / currentNetNights) * 10000) / 100
        : 0
    const previousRate =
      previousNetNights > 0
        ? Math.round((previousData.occupiedNights / previousNetNights) * 10000) / 100
        : 0
    const difference = Math.round((currentRate - previousRate) * 100) / 100

    // Calcul correct du pourcentage de variation
    let variationPercentage = 0

    if (previousRate === 0) {
      if (currentRate > 0) {
        variationPercentage = 100
      }
    } else {
      variationPercentage = Math.round(((currentRate - previousRate) / previousRate) * 10000) / 100
    }

    return {
      currentRate,
      previousRate,
      difference,
      variationPercentage,
    }
  }
  public static async getMonthlyOccupancyRates(serviceId: number) {
    const now = DateTime.now()
    const year = now.year

    // Nombre total de chambres (hors paymaster et out_of_order)
    const totalRoomsResult = await Room.query()
      .where('hotel_id', serviceId)
      .where('status', '!=', 'out_of_order')
      .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
      .count('* as total')
    const totalRooms = Number(totalRoomsResult[0].$extras.total || '0')

    if (totalRooms === 0) {
      throw new Error('Aucune chambre trouvée pour ce service')
    }

    const results = []

    for (let month = 1; month <= 12; month++) {
      const start = DateTime.local(year, month, 1).startOf('month')
      const end = start.endOf('month')
      const daysInMonth = start.daysInMonth!
      const totalPossibleNights = totalRooms * daysInMonth

      const data = await this.countNights(serviceId, start, end)
      const netNights = totalPossibleNights - data.blockedNights

      const occupancyRate =
        netNights > 0 ? Math.round((data.occupiedNights / netNights) * 10000) / 100 : 0

      results.push({
        month: start.toFormat('MMM'),
        occupancyRate,
      })
    }

    return results
  }

  public static async getAverageDailyRate(serviceId: number, period: PeriodType) {
    const validPeriods: PeriodType[] = ['monthly', 'quarterly', 'semester', 'yearly']
    if (!validPeriods.includes(period)) {
      throw new Error(`Invalid period: ${period}. Valid periods are: ${validPeriods.join(', ')}`)
    }

    const now = DateTime.now()

    // Configuration des périodes
    const periodConfigs = {
      monthly: { start: now.startOf('month'), subtract: { months: 1 } },
      quarterly: { start: now.startOf('quarter'), subtract: { months: 3 } },
      semester: {
        start: DateTime.fromObject({ year: now.year, month: now.month <= 6 ? 1 : 7 }),
        subtract: { months: 6 },
      },
      yearly: { start: now.startOf('year'), subtract: { years: 1 } },
    }

    const config = periodConfigs[period]
    const currentStart = config.start
    const previousStart = currentStart.minus(config.subtract)
    const currentEnd = currentStart.plus(config.subtract)
    const previousEnd = previousStart.plus(config.subtract)

    // Calcul de l'ADR à partir des ReservationRoom
    const calculateADR = async (start: DateTime, end: DateTime): Promise<number> => {
      const startStr = start.toISODate()
      const endStr = end.toISODate()
      if (!startStr || !endStr) return 0

      const rooms = await ReservationRoom.query()
        .where('hotel_id', serviceId)
        .whereIn('status', ['confirmed', 'checked_in', 'checked_out'])
        .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
        .where('check_in_date', '<', endStr) // chevauchement : check_in < fin_période
        .where('check_out_date', '>', startStr) // et check_out > début_période
        .select('check_in_date', 'check_out_date', 'room_rate')

      let totalRevenue = 0
      let totalNights = 0

      for (const room of rooms) {
        const checkIn = room.checkInDate
        const checkOut = room.checkOutDate
        const roomRate = Number(room.roomRate || 0)

        if (!checkIn || !checkOut || roomRate <= 0) continue

        // Dates de la tranche qui tombe dans la période
        const overlapStart = checkIn < start ? start : checkIn
        const overlapEnd = checkOut > end ? end : checkOut
        const nightsInPeriod = overlapEnd.diff(overlapStart, 'days').days

        if (nightsInPeriod > 0) {
          totalRevenue += roomRate * nightsInPeriod
          totalNights += nightsInPeriod
        }
      }

      return totalNights > 0 ? Math.round((totalRevenue / totalNights) * 100) / 100 : 0
    }

    const [currentADR, previousADR] = await Promise.all([
      calculateADR(currentStart, currentEnd),
      calculateADR(previousStart, previousEnd),
    ])

    // Calcul de la variation
    const variationPercentage =
      previousADR === 0
        ? currentADR > 0
          ? 100
          : 0
        : Math.round(((currentADR - previousADR) / previousADR) * 10000) / 100

    return {
      currentADR,
      previousADR,
      variationPercentage,
    }
  }
  public static async getNationalityStats(serviceId: number): Promise<{
    nationalities: { nationality: string; count: number }[]
    customerTypes: { type: string; count: number }[]
  }> {
    // Récupérer les réservations du service avec les guests associés
    const reservations = await Reservation.query()
      .where('hotel_id', serviceId)
      .whereNotIn('status', ['cancelled', 'no_show', 'voided'])
      .preload('guest')

    const nationalityMap: Record<string, number> = {}
    const customerTypeMap: Record<string, number> = {}

    for (const reservation of reservations) {
      // Compter les nationalités
      const nationality = reservation.guest?.country || 'Unknown'
      nationalityMap[nationality] = (nationalityMap[nationality] || 0) + 1

      // Compter les types de clients
      const customerType = reservation.customerType || 'Inconnu'
      customerTypeMap[customerType] = (customerTypeMap[customerType] || 0) + 1
    }

    return {
      nationalities: Object.entries(nationalityMap).map(([nationality, count]) => ({
        nationality,
        count,
      })),
      customerTypes: Object.entries(customerTypeMap).map(([type, count]) => ({
        type,
        count,
      })),
    }
  }
  public static async getStayDurationDistribution(serviceId: number) {
    const reservations = await Reservation.query()
      .where('hotel_id', serviceId)
      .select('number_of_nights')

    let oneToTwo = 0
    let threeToFive = 0
    let sixToTen = 0
    let overTen = 0
    let total = 0

    for (const res of reservations) {
      const nights = res.numberOfNights

      if (typeof nights !== 'number' || nights <= 0) continue

      total++

      if (nights <= 2) oneToTwo++
      else if (nights <= 5) threeToFive++
      else if (nights <= 10) sixToTen++
      else overTen++
    }

    const toPercentage = (count: number) =>
      total > 0 ? Math.round((count / total) * 10000) / 100 : 0

    return {
      '1-2 nuits': toPercentage(oneToTwo),
      '3-5 nuits': toPercentage(threeToFive),
      '6-10 nuits': toPercentage(sixToTen),
      '10+ nuits': toPercentage(overTen),
    }
  }

  public static async getCustomerTypeStats(hotelId: number): Promise<{
    customerTypes: { type: string; percentage: number }[]
  }> {
    const reservations = await Reservation.query().where('hotel_id', hotelId)

    const customerTypeMap: Record<string, number> = {}
    let totalCustomerTypes = 0

    for (const res of reservations) {
      const type = res.numberOfNights || 'Inconnu'
      customerTypeMap[type] = (customerTypeMap[type] || 0) + 1
      totalCustomerTypes++
    }

    const customerTypes = Object.entries(customerTypeMap).map(([type, count]) => ({
      type,
      percentage: totalCustomerTypes > 0 ? Math.round((count / totalCustomerTypes) * 100) : 0,
    }))

    return {
      customerTypes,
    }
  }
 public static async getYearlyReservationTypesStats(serviceId: number, year: number) {
  const now = DateTime.now()
  const currentYear = year || now.year
  const previousYear = currentYear - 1

  const startOfCurrentYear = DateTime.fromObject({ year: currentYear, month: 1, day: 1 }).toISODate()!
  const endOfCurrentYear = DateTime.fromObject({ year: currentYear, month: 12, day: 31 }).toISODate()!
  const startOfPrevYear = DateTime.fromObject({ year: previousYear, month: 1, day: 1 }).toISODate()!
  const endOfPrevYear = DateTime.fromObject({ year: previousYear, month: 12, day: 31 }).toISODate()!

  const [currentYearReservations, prevYearReservations] = await Promise.all([
    Reservation.query()
      .where('reservations.hotel_id', serviceId)
      .whereBetween('reservations.check_in_date', [startOfCurrentYear, endOfCurrentYear])
      .leftJoin('reservation_types', 'reservations.reservation_type_id', 'reservation_types.id')
      .select('reservations.check_in_date')
      .select('reservation_types.name as typeName'),
    Reservation.query()
      .where('reservations.hotel_id', serviceId)
      .whereBetween('reservations.check_in_date', [startOfPrevYear, endOfPrevYear])
      .leftJoin('reservation_types', 'reservations.reservation_type_id', 'reservation_types.id')
      .select('reservations.check_in_date')
      .select('reservation_types.name as typeName'),
  ])

  // checkInDate est déjà un DateTime Luxon grâce au @column() du modèle
  const normalize = (rows: any[]) =>
    rows.map((r) => ({
      checkInDate: r.checkInDate as DateTime,
      typeName: r.$extras.typeName || 'Unknown',
    }))

  const currentRows = normalize(currentYearReservations)
  const prevRows = normalize(prevYearReservations)

  const results: {
    month: string
    weeks: { label: string, data: { type: string, count: number }[] }[]
    summary: { type: string, count: number, progression: number }[]
  }[] = []

  for (let month = 1; month <= 12; month++) {
    const startOfMonth = DateTime.fromObject({ year: currentYear, month }).startOf('month')
    const endOfMonth = startOfMonth.endOf('month')

    const monthRows = currentRows.filter(
      (r) => r.checkInDate >= startOfMonth && r.checkInDate <= endOfMonth
    )

    const prevMonthDate = startOfMonth.minus({ months: 1 })
    const prevMonthStart = prevMonthDate.startOf('month')
    const prevMonthEnd = prevMonthDate.endOf('month')
    const prevMonthPool = prevMonthDate.year === currentYear ? currentRows : prevRows
    const prevMonthRows = prevMonthPool.filter(
      (r) => r.checkInDate >= prevMonthStart && r.checkInDate <= prevMonthEnd
    )

    const types = [...new Set(monthRows.map((r) => r.typeName))]

    const weeks: { label: string, data: { type: string, count: number }[] }[] = []
    for (let i = 0; i < 4; i++) {
      const weekStart = startOfMonth.plus({ days: i * 7 })
      const weekEnd = i === 3 ? endOfMonth : weekStart.plus({ days: 6 })

      const weekRows = monthRows.filter(
        (r) => r.checkInDate >= weekStart && r.checkInDate <= weekEnd
      )

      const data = types.map((type) => ({
        type,
        count: weekRows.filter((r) => r.typeName === type).length,
      }))

      weeks.push({ label: `Semaine ${i + 1}`, data })
    }

    const summary = types.map((type) => {
      const currentCount = monthRows.filter((r) => r.typeName === type).length
      const previousCount = prevMonthRows.filter((r) => r.typeName === type).length

      const progression = previousCount === 0
        ? (currentCount > 0 ? 100 : 0)
        : Math.round(((currentCount - previousCount) / previousCount) * 10000) / 100

      return { type, count: currentCount, progression }
    })

    results.push({
      month: startOfMonth.toFormat('LLLL'),
      weeks,
      summary,
    })
  }

  return results
}
  private static async calculateRevenueWithTaxByMonth(
    hotelId: number,
    year: number,
    endDate?: DateTime
  ): Promise<{ month: string; totalRevenue: number }[]> {
    const startOfYear = DateTime.fromObject({ year }).startOf('year').toFormat('yyyy-MM-dd')
    const yearEnd = DateTime.fromObject({ year }).endOf('year')
    const effectiveEnd = endDate && endDate < yearEnd ? endDate : yearEnd
    const endOfYear = effectiveEnd.toFormat('yyyy-MM-dd')

    const scopeFolio = (folioQuery: any) => {
      folioQuery.whereHas('reservationRoom', (rrQuery: any) => {
        rrQuery.where('hotel_id', hotelId)
        rrQuery.whereIn('status', ['checked_in', 'checked_out', 'reserved'])
        rrQuery.whereDoesntHave('roomType', (rtQuery: any) => rtQuery.where('is_paymaster', true))
      })
    }

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]

    const monthlyTotals: Record<string, number> = {}
    months.forEach((m) => (monthlyTotals[m] = 0))

    const addToMonth = (currentWorkingDate: any, amount: number) => {
      if (!currentWorkingDate || !amount) return
      const dt =
        typeof currentWorkingDate?.toFormat === 'function'
          ? currentWorkingDate
          : DateTime.fromISO(String(currentWorkingDate))
      if (!dt.isValid) return
      const month = dt.toFormat('MMM')
      if (monthlyTotals[month] !== undefined) {
        monthlyTotals[month] += amount
      }
    }

    // ── Room Charges ─────────────────────────────
    const roomChargesTx = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startOfYear, endOfYear])
      .where('category', 'room')
      .where('transaction_type', 'charge')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .select('current_working_date', 'room_final_net_amount')

    for (const tx of roomChargesTx as any[]) {
      addToMonth(tx.currentWorkingDate, Number(tx.roomFinalNetAmount || 0))
    }

    // ── Extra Charges ────────────────────────────
    const extraChargesTx = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startOfYear, endOfYear])
      .where('category', 'extra_charge')
      .where('transaction_type', 'charge')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .select('current_working_date', 'amount')

    for (const tx of extraChargesTx as any[]) {
      addToMonth(tx.currentWorkingDate, Number(tx.amount || 0))
    }

    // ── Discounts (soustraits) ───────────────────
    const discountTx = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startOfYear, endOfYear])
      .whereNotNull('discount_amount')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .select('current_working_date', 'discount_amount')

    for (const tx of discountTx as any[]) {
      addToMonth(tx.currentWorkingDate, -Math.abs(Number(tx.discountAmount || 0)))
    }

    // ── Adjustments (round off uniquement) ───────
    const adjustmentTx = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startOfYear, endOfYear])
      .where('category', 'adjustment')
      .whereNotIn('status', ['cancelled', 'void', 'voided'])
      .whereNot('is_voided', true)
      .select('current_working_date', 'amount', 'particular', 'description')

    for (const tx of adjustmentTx as any[]) {
      const amount = Number(tx.amount || 0)
      const desc = (tx.particular || tx.description || '').toLowerCase()
      const isRoundOff =
        desc.includes('round') || desc.includes('unit adjustment') || Math.abs(amount) < 1
      if (isRoundOff) {
        addToMonth(tx.currentWorkingDate, amount)
      }
    }

    // ── Tax ───────────────────────────────────────
    const taxTx = await FolioTransaction.query()
      .whereHas('folio', scopeFolio)
      .whereBetween('current_working_date', [startOfYear, endOfYear])
      .whereNotIn('status', ['cancelled', 'voided'])
      .whereNot('is_voided', true)
      .select('id', 'current_working_date', 'tax_breakdown')
      .preload('taxes' as any)

    for (const tx of taxTx as any[]) {
      let txTax = 0
      if (tx.taxBreakdown?.items?.length > 0) {
        tx.taxBreakdown.items.forEach((t: any) => {
          txTax += Number(t.taxAmount || 0)
        })
      } else if (tx.taxes?.length > 0) {
        tx.taxes.forEach((t: any) => {
          txTax += Number(t?.$pivot?.taxAmount ?? t?.taxAmount ?? 0)
        })
      }
      addToMonth(tx.currentWorkingDate, txTax)
    }

    return months.map((month) => ({
      month,
      totalRevenue: Math.round(monthlyTotals[month]),
    }))
  }

  public static async getMonthlyRevenueComparison(serviceId: number): Promise<{
    currentYear: { month: string; totalRevenue: number }[]
    previousYear: { month: string; totalRevenue: number }[]
  }> {
    const now = DateTime.now()
    const currentYear = now.year
    const previousYear = currentYear - 1

    const currentYearResults = await this.getYearlyRevenueStats(serviceId, currentYear)
    const previousYearResults = await this.getYearlyRevenueStats(serviceId, previousYear)

    return {
      currentYear: currentYearResults.map((r) => ({
        month: r.month,
        totalRevenue: r.totalRevenue,
      })),
      previousYear: previousYearResults.map((r) => ({
        month: r.month,
        totalRevenue: r.totalRevenue,
      })),
    }
  }

  public static async getYearlyRevenueStats(
    serviceId: number,
    year: number
  ): Promise<{ month: string; totalRevenue: number }[]> {
    const now = DateTime.now()
    // Pour l'année en cours, plafonner à "aujourd'hui" (aligné avec le PTD du Management Report)
    // Pour une année passée, on prend l'année complète.
    const endDate = year === now.year ? now.endOf('day') : undefined

    return this.calculateRevenueWithTaxByMonth(serviceId, year, endDate)
  }

  /**
   * Calcule le total des chambres occupées ET bloquées jour par jour sur une période
   */
  private static async countNights(
    serviceId: number,
    start: DateTime,
    end: DateTime
  ): Promise<{ occupiedNights: number; blockedNights: number }> {
    let occupiedNights = 0
    let blockedNights = 0
    let cursor = start
    while (cursor < end) {
      const [occ, blk] = await Promise.all([
        HotelAnalyticsDashboardService.countOccupiedForDate(serviceId, cursor),
        HotelAnalyticsDashboardService.countBlockedForDate(serviceId, cursor),
      ])
      occupiedNights += occ
      blockedNights += blk
      cursor = cursor.plus({ days: 1 })
    }
    return { occupiedNights, blockedNights }
  }

  /**
   * Compte les chambres occupées pour une date donnée
   */
  private static async countOccupiedForDate(serviceId: number, date: DateTime): Promise<number> {
    const dateStr = date.toISODate()
    if (!dateStr) return 0
    const result = await ReservationRoom.query()
      .where('hotel_id', serviceId)
      .whereIn('status', ['confirmed', 'checked_in', 'checked_out'])
      .where('check_in_date', '<=', dateStr)
      .where('check_out_date', '>', dateStr)
      .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
      .count('* as count')
    return Number(result[0].$extras.count || '0')
  }

  /**
   * Compte les chambres bloquées pour une date donnée
   */
  private static async countBlockedForDate(serviceId: number, date: DateTime): Promise<number> {
    const dateStr = date.toISODate()
    if (!dateStr) return 0
    const result = await RoomBlock.query()
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
}
