import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import Guest from '#models/guest'
import RoomType from '#models/room_type'
import BookingSource from '#models/booking_source'
import Room from '#models/room'
import BusinessSource from '#models/business_source'
import { ReservationStatus } from '../enums.js'

type RowItem = {
  reservationRef: string
  guestName: string
  roomDescription: string
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
    | 'today_confirm_check_in'
    | 'today_check_out'
    | 'staying_over'
    | 'hold_expiring_today'
    | 'today_hold_check_in'
    | 'enquiry_check_in_today'
    | 'yesterday_no_show'
    | 'tomorrow_confirm_check_in'
    | 'tomorrow_check_out'
    | 'hold_expiring_tomorrow'
    | 'tomorrow_hold_check_in'
    | 'enquiry_check_in_tomorrow'
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

function buildRow(res: Reservation): RowItem {
  const guest = (res as any).guest as Guest | undefined
  const roomType = (res as any).roomType as RoomType | undefined
  const pax = (res.adults || 0) + (res.children || 0)
  const currency = res.currencyCode || ((res as any).hotel?.currencyCode ?? '')

  // Reference string similar to example: reservationNumber/confirmationCode
  const refLeft = res.reservationNumber || res.otaReservationCode || res.confirmationNumber
  const refRight = res.confirmationCode || res.otaReservationCode || res.reservationNumber
  const reservationRef = [refLeft, refRight].filter(Boolean).join('/') || String(res.id)

  // Outstanding amount: prefer remainingAmount, fallback to balanceDue or 0
  const outstanding = Number(
    (res.remainingAmount ?? res.balanceDue ?? 0) as number
  )

  return {
    reservationRef,
    guestName: guest?.displayName || `${guest?.title ? guest?.title + ' ' : ''}${guest?.firstName ?? ''} ${guest?.lastName ?? ''}`.trim(),
    roomDescription: roomType?.roomTypeName || 'Room',
    pax,
    meal: formatMeal(res.board_basis_type),
    // Prefer actual times when present, otherwise use scheduled+estimated time
    checkIn:
      fmtDate(res.arrivedDate, true) ||
      (res.arrivedDate
        ? `${fmtDate(res.arrivedDate)}${res.checkInTime ? ' ' + res.checkInTime : ''}`
        : ''),
    checkOut:
      fmtDate(res.departDate) ||
      fmtDate(res.departDate) ||
      '',
    outstandingAmount: outstanding,
    currency,
  }
}

function queryBase(hotelId: number) {
  return Reservation.query()
    .where('hotel_id', hotelId)
    .preload('guest')
    .preload('roomType')
    .preload('bookingSource')
    .preload('businessSource')
    .preload('hotel')
}

async function getTodayConfirmCheckIn(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  return await q
    .where('arrivedDate', day.toISODate()!)
    .where('reservation_status', 'Confirmed')
}

async function getStayingOver(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  // Stayover: checked-in and departure after the audit date
  return await q
    .where('status', 'checked_in')
    .where('depart_date', '>', day.toSQL())
}

async function getHoldExpiring(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  return await q
    .where('is_hold', true)
    .where('hold_release_date', day.toSQL())
}

async function getHoldCheckIn(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  return await q
    .where('is_hold', true)
    .where('arrivedDate', day.toISODate()!)
}

async function getEnquiryCheckIn(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  // Treat Pending/Waitlist as enquiry
  return await q
    .whereIn('reservation_status', ['Pending', 'Waitlist'])
    .where('arrivedDate', day.toISODate()!)
}

async function getYesterdayNoShow(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const y = day.minus({ days: 1 })
  return await q
    .where('reservation_status', 'No-Show')
    .orWhere((qb) => {
      qb.where('no_show_date', '>=', y.startOf('day').toSQL()).where('no_show_date', '<=', y.endOf('day').toSQL())
    })
}

async function getTomorrowConfirmCheckIn(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const t = day.plus({ days: 1 })
  return await q.where('arrivedDate', t.toISODate()!).where('reservation_status', ReservationStatus.CONFIRMED)
}

async function getTomorrowCheckOut(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const t = day.plus({ days: 1 })
  return await q.where('departDate', t.toISODate()!)
}

async function getTodayCheckOut(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  return await q.where('departDate', day.toISODate()!)
}

async function getTomorrowHoldExpiring(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const t = day.plus({ days: 1 })
  return await q.where('is_hold', true).where('hold_release_date', t.toSQL())
}

async function getTomorrowHoldCheckIn(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const t = day.plus({ days: 1 })
  return await q.where('is_hold', true).where('arrivedDate', t.toISODate()!)
}

async function getTomorrowEnquiryCheckIn(hotelId: number, day: DateTime): Promise<Reservation[]> {
  const q = queryBase(hotelId)
  const t = day.plus({ days: 1 })
  return await q.whereIn('reservation_status', ['Pending', 'Waitlist']).where('arrivedDate', t.toISODate()!)
}

function toSection(title: string, key: SectionBlock['key'], reservations: Reservation[]): SectionBlock {
  // Group rows by business source name
  const groupsMap = new Map<string, RowItem[]>()
  let roomsCount = 0

  for (const res of reservations) {
    const sourceName = getBusinessSourceName(res)
    const row = buildRow(res)
    const arr = groupsMap.get(sourceName) || []
    arr.push(row)
    groupsMap.set(sourceName, arr)
    roomsCount += res.roomsRequested || 1
  }

  const groups: GroupBlock[] = Array.from(groupsMap.entries()).map(([businessSource, rows]) => ({ businessSource, rows }))

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
      todayConfirmCheckIn,
      todayCheckOut,
      stayingOver,
      holdExpiringToday,
      todayHoldCheckIn,
      enquiryCheckInToday,
      yesterdayNoShow,
    ] = await Promise.all([
      getTodayConfirmCheckIn(hotelId, today),
      getTodayCheckOut(hotelId, today),
      getStayingOver(hotelId, today),
      getHoldExpiring(hotelId, today),
      getHoldCheckIn(hotelId, today),
      getEnquiryCheckIn(hotelId, today),
      getYesterdayNoShow(hotelId, today),
    ])

    const todaySections: SectionBlock[] = [
      toSection("Today's Confirm Check-In", 'today_confirm_check_in', todayConfirmCheckIn),
      toSection("Today's Check-Out", 'today_check_out', todayCheckOut),
      toSection('Staying Over', 'staying_over', stayingOver),
      toSection('Hold Expiring Today', 'hold_expiring_today', holdExpiringToday),
      toSection("Today's Hold Check-In", 'today_hold_check_in', todayHoldCheckIn),
      toSection('Enquiry Check-In Today', 'enquiry_check_in_today', enquiryCheckInToday),
      toSection('Yesterday No Show Booking', 'yesterday_no_show', yesterdayNoShow),
    ]

    // Tomorrow sections
    const [
      tomorrowConfirmCheckIn,
      tomorrowCheckOut,
      holdExpiringTomorrow,
      tomorrowHoldCheckIn,
      enquiryCheckInTomorrow,
    ] = await Promise.all([
      getTomorrowConfirmCheckIn(hotelId, today),
      getTomorrowCheckOut(hotelId, today),
      getTomorrowHoldExpiring(hotelId, today),
      getTomorrowHoldCheckIn(hotelId, today),
      getTomorrowEnquiryCheckIn(hotelId, today),
    ])

    const tomorrowSections: SectionBlock[] = [
      toSection('Tomorrow Confirm Check-In', 'tomorrow_confirm_check_in', tomorrowConfirmCheckIn),
      toSection('Tomorrow Check-Out', 'tomorrow_check_out', tomorrowCheckOut),
      toSection('Hold Expiring Tomorrow', 'hold_expiring_tomorrow', holdExpiringTomorrow),
      toSection('Tomorrow Hold Check-In', 'tomorrow_hold_check_in', tomorrowHoldCheckIn),
      toSection('Enquiry Check-In Tomorrow', 'enquiry_check_in_tomorrow', enquiryCheckInTomorrow),
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
    const introLine = `Below is your ${hotel.hotelName} confirmed bookings list that you need to acknowledge:`

    return {
      hotel: hotelBlock,
      greetingLine,
      introLine,
      todaySections,
      tomorrowSections,
    }
  }
}