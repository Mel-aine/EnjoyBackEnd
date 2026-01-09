import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import Guest from '#models/guest'
import RoomType from '#models/room_type'
import BookingSource from '#models/booking_source'
import Room from '#models/room'
import BusinessSource from '#models/business_source'
import { ReservationStatus } from '../enums.js'
import ReservationRoom from '#models/reservation_room'

type RowItem = {
  reservationRef: string
  guestName: string
  roomDescription: string
  roomNumber?: string
  roomSortKey?: number | null
  pax: number
  meal: string
  checkIn: string
  checkOut: string
  outstandingAmount: number
  currency: string
}

type GroupBlock = {
  businessSource: string
  rows: RowItem[]
}

type SectionBlock = {
  key:
  | 'in_house'
  | 'due_out'
  | 'confirmed_departure'
  | 'booking_confirmed'
  | 'arrival'
  | 'extended'
  | 'stay'
  | 'tomorrow_booking_confirm'
  | 'tomorrow_departure'
  | 'cancelled_booking'
  title: string
  bookingCount: number
  roomsCount: number
  groups: GroupBlock[]
}

export type TodayHtmlData = {
  hotel: {
    name: string
    addressLine1: string | null
    addressLine2: string | null
    city: string | null
    state: string | null
    country: string | null
    postalCode: string | null
    email: string | null
    phone: string | null
  }
  greetingLine: string
  introLine: string
  todaySections: SectionBlock[]
  tomorrowSections: SectionBlock[]
  inHouseSection: SectionBlock
}

function formatMeal(board?: Reservation['board_basis_type'] | null): string {
  switch (board) {
    case 'BB':
      return 'Breakfast'
    case 'Half Board':
      return 'Breakfast,Dinner'
    case 'Full Board':
      return 'Lunch,Dinner'
    case 'AllInclusive':
      return 'Breakfast,Lunch,Dinner'
    case 'BO':
      return 'No Meal'
    case 'Custom':
      return 'Custom'
    default:
      return ''
  }
}

function fmtDate(date?: DateTime | null, withTime = false): string {
  if (!date) return ''
  return withTime ? date.toFormat('dd-MM-yyyy HH:mm:ss') : date.toFormat('dd-MM-yyyy')
}

function toSqlDate(day: DateTime): string {
  return day.toFormat('yyyy-MM-dd')
}

function getBusinessSourceName(res: Reservation): string {
  const bs = (res as any).bookingSource as BookingSource | undefined
  const bss = (res as any).businessSource as BusinessSource | undefined
  return (
    bss?.name ||
    bs?.sourceName ||
    res.sourceOfBusiness ||
    res.otaName ||
    'Unknown'
  )
}

function buildRowsForReservation(res: Reservation): RowItem[] {
  const reservationRooms = (res as any).reservationRooms as ReservationRoom[] | undefined
  const currency = res.currencyCode || ((res as any).hotel?.currencyCode ?? '')
  const reservationRef = res.reservationNumber || String(res.id)
  const defaultRoomType = (res as any).roomType as RoomType | undefined

  if (reservationRooms && reservationRooms.length > 0) {
    // Deduplicate reservation rooms by ID to prevent duplicates in report
    const uniqueRoomsMap = new Map<number, ReservationRoom>()
    reservationRooms.forEach((rr) => {
      if (rr.id) uniqueRoomsMap.set(rr.id, rr)
    })
    const uniqueRooms = Array.from(uniqueRoomsMap.values())

    return uniqueRooms.map((rr) => {
      const guest = (rr as any).guest as Guest | undefined
      const room = (rr as any).room
      const roomType = (rr as any).roomType as RoomType | undefined
      const rateType = (rr as any).rateType as { rateTypeName?: string; shortCode?: string } | undefined
      const folios = (rr as any).folios as any[] | undefined
      const mealPlan = (rr as any).mealPlan as { shortCode?: string; extraCharges?: any[] } | undefined

      const pax = (rr.adults ?? 0) + (rr.children ?? 0)
      const roomDescriptionParts = [
        room?.roomNumber ? `Room ${room.roomNumber}` : undefined,
        roomType?.roomTypeName,
        rateType?.rateTypeName || rateType?.shortCode,
      ].filter(Boolean)
      const roomDescription = roomDescriptionParts.join(' - ')

      let meal = ''
      if ((rr as any).mealPlanRateInclude && mealPlan) {
        const extras = (mealPlan.extraCharges || []) as any[]
        const extraList = extras.map((ec: any) => ec.shortCode || ec.name).filter(Boolean)
        const prefix = mealPlan.shortCode ? `${mealPlan.shortCode}: ` : ''
        meal = prefix + extraList.join(', ')
      }

      let outstandingAmount = 0
      if (folios && folios.length) {
        const openFolio = folios.find((f: any) => f.status === 'open') || folios[0]
        outstandingAmount = Number(openFolio?.balance ?? 0)
      }

      return {
        reservationRef,
        guestName:
          guest?.displayName || `${guest?.title ? guest?.title + ' ' : ''}${guest?.firstName ?? ''} ${guest?.lastName ?? ''}`.trim(),
        roomDescription: roomDescription,
        roomNumber: room?.roomNumber,
        roomSortKey: typeof room?.sortKey === 'number' ? room.sortKey : null,
        pax,
        meal,
        checkIn: fmtDate(rr.checkInDate),
        checkOut: fmtDate(rr.checkOutDate),
        outstandingAmount,
        currency,
      }
    })
  }

  return [
    {
      reservationRef,
      guestName: ((res as any).guest as Guest | undefined)?.displayName || '',
      roomDescription: defaultRoomType?.roomTypeName || 'Room',
      pax: Number(res.guestCount ?? 0),
      meal: formatMeal(res.board_basis_type),
      checkIn: fmtDate(res.arrivedDate ?? res.checkInDate),
      checkOut: fmtDate(res.departDate ?? res.checkOutDate),
      outstandingAmount: Number(res.remainingAmount ?? 0),
      currency,
    },
  ]
}

function queryBase(hotelId: number) {
  return Reservation.query()
    .where('hotel_id', hotelId)
    /*.whereDoesntHave('reservationRooms', (rr) => {
      rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
    })*/
    .preload('guest')
    .preload('roomType')
    .preload('bookingSource')
    .preload('businessSource')
    .preload('hotel')
    .preload('reservationRooms', (rr) =>
      rr.where('is_splited_origin', false)
       // .whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
        .preload('room')
        .preload('roomType')
        .preload('rateType')
        .preload('guest')
        .preload('mealPlan', (m) => m.preload('extraCharges'))
        .preload('folios', (f) => f.where('status', 'open'))
    )
}

// Map enum values to DB status strings used by Reservation.status
function toDbStatus(status: ReservationStatus): string {
  // Convert hyphens to underscores to match DB values (e.g., checked-in -> checked_in)
  return (status as string).replace(/-/g, '_')
}

async function getTodayConfirmBooking(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  return await q
    .whereRaw('DATE(created_at) = ?', [todayStr])
    .where('status', toDbStatus(ReservationStatus.CONFIRMED))
}


async function getInHouse(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  const yesterdayStr = toSqlDate(day.minus({ days: 1 }))
  return await q
    .where('status', toDbStatus(ReservationStatus.CHECKED_IN))
    .whereRaw('DATE(arrived_date) <= ?', [yesterdayStr])
    .whereRaw('DATE(depart_date) >= ?', [todayStr])
}



async function getCancelledToday(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  return await q
    .where('status', toDbStatus(ReservationStatus.CANCELLED))
    .whereRaw('DATE(cancellation_date) = ?', [todayStr])
}

async function getTomorrowConfirmCheckIn(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const t = day.plus({ days: 1 })
  const tomorrowStr = toSqlDate(t)
  return await q
    .whereRaw('DATE(arrived_date) = ?', [tomorrowStr])
    .where('status', toDbStatus(ReservationStatus.CONFIRMED))
}

async function getConfirmedDepartureToday(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  return await q
    .where('status', toDbStatus(ReservationStatus.CHECKED_OUT))
    .where((qb) => {
      qb
        .whereRaw('DATE(depart_date) = ?', [todayStr])
    })
}

async function getArrivalToday(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  return await q
    .whereRaw('DATE(arrived_date) = ?', [todayStr])
    .whereIn('status', [
      toDbStatus(ReservationStatus.CONFIRMED),
      toDbStatus(ReservationStatus.CHECKED_IN),
    ])
}

async function getExtendedToday(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  const reservations = await q
    .where('status', toDbStatus(ReservationStatus.CHECKED_IN))
    .whereHas('reservationRooms', (query) => {
      query.whereRaw('DATE(extend_date) = ?', [todayStr])
    })

  // Filter reservation rooms to include ONLY those extended today
  reservations.forEach((res) => {
    if (res.reservationRooms) {
      const filtered = res.reservationRooms.filter((rr) => {
        return rr.extendDate && toSqlDate(rr.extendDate) === todayStr
      })
        // Cast to any to bypass strict relation type check
        ; (res as any).reservationRooms = filtered
    }
  })

  return reservations
}

async function getStayToday(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  return await q
    .where('status', toDbStatus(ReservationStatus.CHECKED_IN))
    .whereRaw('DATE(arrived_date) <= ?', [todayStr])
    .whereRaw('(DATE(depart_date) > ? OR depart_date IS NULL)', [todayStr])
}

async function getTomorrowCheckOut(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const t = day.plus({ days: 1 })
  const tomorrowStr = toSqlDate(t)
  return await q
    .whereRaw('DATE(depart_date) = ?', [tomorrowStr])
    .where('status', toDbStatus(ReservationStatus.CHECKED_IN))
}

async function getTodayCheckOut(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const todayStr = toSqlDate(day)
  return await q
    .whereRaw('DATE(depart_date) = ?', [todayStr])
    .whereIn('status', [toDbStatus(ReservationStatus.CHECKED_IN), toDbStatus(ReservationStatus.CHECKED_OUT)])
}


function toSection(title: string, key: SectionBlock['key'], reservations: Reservation[]): SectionBlock {
  // Group rows by business source name
  const groupsMap = new Map<string, RowItem[]>()
  let roomsCount = 0

  // Deduplicate reservations by ID
  const uniqueReservationsMap = new Map<number, Reservation>()
  reservations.forEach((r) => uniqueReservationsMap.set(r.id, r))
  const uniqueReservations = Array.from(uniqueReservationsMap.values())

  for (const res of uniqueReservations) {
    const sourceName = getBusinessSourceName(res)
    const rows = buildRowsForReservation(res)
    const arr = groupsMap.get(sourceName) || []
    for (const row of rows) arr.push(row)
    groupsMap.set(sourceName, arr)
    const reservationRooms = (res as any).reservationRooms as ReservationRoom[] | undefined
    roomsCount += (reservationRooms?.length ?? res.roomsRequested ?? 1)
  }

  const normalizeSortKey = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
    return null
  }

  const compareRows = (a: RowItem, b: RowItem) => {
    const ak = normalizeSortKey(a.roomSortKey)
    const bk = normalizeSortKey(b.roomSortKey)

    if (ak !== null && bk !== null && ak !== bk) return ak - bk
    if (ak !== null && bk === null) return -1
    if (ak === null && bk !== null) return 1

    const an = a.roomNumber || ''
    const bn = b.roomNumber || ''
    const byNumber = an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' })
    if (byNumber !== 0) return byNumber

    return a.roomDescription.localeCompare(b.roomDescription, undefined, { numeric: true, sensitivity: 'base' })
  }

  const groups: GroupBlock[] = Array.from(groupsMap.entries())
    .map(([businessSource, rows]) => ({
      businessSource,
      rows: rows.slice().sort(compareRows),
    }))
    .sort((a, b) => {
      const aMin = a.rows.reduce<number>((min, r) => {
        const k = normalizeSortKey(r.roomSortKey)
        return k === null ? min : Math.min(min, k)
      }, Number.POSITIVE_INFINITY)

      const bMin = b.rows.reduce<number>((min, r) => {
        const k = normalizeSortKey(r.roomSortKey)
        return k === null ? min : Math.min(min, k)
      }, Number.POSITIVE_INFINITY)

      if (aMin !== bMin) return aMin - bMin
      return a.businessSource.localeCompare(b.businessSource, undefined, { sensitivity: 'base' })
    })

  return {
    key,
    title,
    bookingCount: reservations.length,
    roomsCount,
    groups,
  }
}

export default class TodayReportService {
  /**
   * Build data structure that matches docs/today.html sections and rows
   */
  static async buildDataForTodayHtml(hotelId: number, asOfDate?: string): Promise<TodayHtmlData> {
    const hotel = await Hotel.findOrFail(hotelId)

    // Use hotel timezone if provided, default to system
    const tz = hotel.timezone || undefined
    const today = asOfDate ? DateTime.fromISO(asOfDate).setZone(tz).startOf('day') : DateTime.now().setZone(tz).startOf('day')

    // Today sections
    const [
      inHouse,
      dueOut,
      confirmedDeparture,
      bookingConfirmed,
      arrival,
      extended,
      stay,
      cancelled,
    ] = await Promise.all([
      getInHouse(hotelId, today),
      getTodayCheckOut(hotelId, today),
      getConfirmedDepartureToday(hotelId, today),
      getTodayConfirmBooking(hotelId, today),
      getArrivalToday(hotelId, today),
      getExtendedToday(hotelId, today),
      getStayToday(hotelId, today),
      getCancelledToday(hotelId, today),
    ])

    const todaySections: SectionBlock[] = [
      toSection('DUE OUT', 'due_out', dueOut),
      toSection('DEPARTURE', 'confirmed_departure', confirmedDeparture),
      toSection('EXTENDED', 'extended', extended),
      toSection('CURRENT STAY', 'stay', stay),
      toSection('BOOKING', 'booking_confirmed', bookingConfirmed),
      toSection('CANCELLED BOOKING', 'cancelled_booking', cancelled),
      toSection('CHECK IN', 'arrival', arrival),
    ]

    const inHouseSection = toSection('IN HOUSE AT DAILY REPORT', 'in_house', inHouse)

    // Tomorrow sections
    const [
      tomorrowBookingConfirm,
      tomorrowDeparture,
    ] = await Promise.all([
      getTomorrowConfirmCheckIn(hotelId, today),
      getTomorrowCheckOut(hotelId, today),
    ])
    const tomorrowSections: SectionBlock[] = [
      toSection('TOMORROW BOOKING CONFIRM', 'tomorrow_booking_confirm', tomorrowBookingConfirm),
      toSection('TOMORROW DEPARTURE', 'tomorrow_departure', tomorrowDeparture),
    ]

    const hotelBlock = {
      name: hotel.hotelName,
      addressLine1: hotel.address,
      addressLine2: hotel.city,
      city: hotel.city,
      state: hotel.stateProvince,
      country: hotel.country,
      postalCode: hotel.postalCode,
      email: hotel.email ?? null,
      phone: hotel.phoneNumber ?? null,
    }

    const greetingLine = `Dear ${hotel.hotelName},`
    const introLine = `Below is your ${hotel.hotelName} Daily Report list that you need to acknowledge:`

    return {
      hotel: hotelBlock,
      greetingLine,
      introLine,
      todaySections,
      tomorrowSections,
      inHouseSection,
    }
  }
}
