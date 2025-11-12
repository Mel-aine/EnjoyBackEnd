import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import fs from 'node:fs'
import path from 'node:path'

import Reservation from '#models/reservation'
import Guest from '#models/guest'
import BookingSource from '#models/booking_source'
import BusinessSource from '#models/business_source'
import ReservationType from '#models/reservation_type'
import MarketCode from '#models/market_code'
import PaymentMethod from '#models/payment_method'
import RoomType from '#models/room_type'

// Reuse simple CSV parsing similar to other import commands
function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        current.push(cell)
        cell = ''
      } else if (char === '\n') {
        current.push(cell)
        rows.push(current)
        current = []
        cell = ''
      } else if (char === '\r') {
        // ignore
      } else {
        cell += char
      }
    }
  }
  // last cell
  if (cell.length > 0 || inQuotes) current.push(cell)
  if (current.length) rows.push(current)
  return rows
}

function trimLower(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase()
}

function parseNumber(val: string | undefined | null): number | null {
  if (!val) return null
  const n = Number(String(val).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseIntSafe(val: string | undefined | null): number | null {
  if (!val) return null
  const n = parseInt(String(val).replace(/[^0-9\-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function parseDate(val: string | undefined | null): DateTime | null {
  if (!val) return null
  // Try common formats
  const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']
  for (const fmt of formats) {
    const dt = DateTime.fromFormat(val.trim(), fmt)
    if (dt.isValid) return dt
  }
  const iso = DateTime.fromISO(val.trim())
  return iso.isValid ? iso : null
}

function parseDateTime(dateVal: string | undefined | null, timeVal?: string | undefined | null): DateTime | null {
  if (!dateVal) return null
  const d = parseDate(dateVal)
  if (!d) return null
  if (!timeVal) return d
  // attempt HH:mm or HH:mm:ss
  const time = String(timeVal).trim()
  const [h, m, s] = time.split(':').map((t) => parseInt(t, 10))
  if (Number.isFinite(h)) {
    return d.set({ hour: h, minute: Number.isFinite(m) ? m! : 0, second: Number.isFinite(s) ? s! : 0 })
  }
  return d
}

function mapStatus(statusRaw: string | undefined | null): { status?: string; reservationStatus?: string } {
  const s = trimLower(statusRaw)
  switch (s) {
    case 'confirmed':
      return { status: 'confirmed', reservationStatus: 'Confirmed' }
    case 'pending':
    case 'tentative':
      return { status: 'pending', reservationStatus: 'Pending' }
    case 'cancelled':
    case 'canceled':
      return { status: 'cancelled', reservationStatus: 'Cancelled' }
    case 'no-show':
    case 'noshow':
      return { status: 'no_show', reservationStatus: 'No-Show' }
    case 'checked-in':
    case 'in-house':
      return { status: 'checked_in', reservationStatus: 'Checked-In' }
    case 'checked-out':
      return { status: 'checked_out', reservationStatus: 'Checked-Out' }
    default:
      return { status: s || undefined, reservationStatus: undefined }
  }
}

async function findGuest(hotelId: number, name: string, email?: string, phone?: string, city?: string, country?: string): Promise<Guest> {
  const emailNorm = (email || '').trim().toLowerCase()
  if (emailNorm) {
    const g = await Guest.query().where('hotel_id', hotelId).where('email', emailNorm).first()
    if (g) return g
  }
  const [firstName, ...rest] = (name || '').trim().split(/\s+/)
  const lastName = rest.join(' ') || '-'
  const existing = await Guest.query()
    .where('hotel_id', hotelId)
    .where('first_name', firstName)
    .where('last_name', lastName)
    .first()
  if (existing) return existing

  // Minimal guest creation
  const guest = new Guest()
  guest.hotelId = hotelId
  guest.firstName = firstName || '-'
  guest.lastName = lastName || '-'
  guest.email = emailNorm || null
  guest.phonePrimary = (phone || '').trim()
  guest.city = city || ''
  guest.country = country || ''
  guest.guestCode = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  await guest.save()
  return guest
}

async function findBookingSource(hotelId: number, sourceName?: string | null): Promise<BookingSource | null> {
  if (!sourceName) return null
  const s = await BookingSource.query().where('hotel_id', hotelId).where('source_name', sourceName).first()
  return s || null
}

async function findBusinessSource(hotelId: number, name?: string | null): Promise<BusinessSource | null> {
  if (!name) return null
  const s = await BusinessSource.query().where('hotel_id', hotelId).where('source_name', name).first()
  return s || null
}

async function findReservationType(hotelId: number, name?: string | null): Promise<ReservationType | null> {
  if (!name) return null
  const s = await ReservationType.query().where('hotel_id', hotelId).where('type_name', name).first()
  return s || null
}

async function findMarketCode(hotelId: number, codeOrName?: string | null): Promise<MarketCode | null> {
  if (!codeOrName) return null
  const byCode = await MarketCode.query().where('hotel_id', hotelId).where('code', codeOrName).first()
  if (byCode) return byCode
  const byName = await MarketCode.query().where('hotel_id', hotelId).where('name', codeOrName).first()
  return byName || null
}

async function findPaymentMethod(hotelId: number, name?: string | null): Promise<PaymentMethod | null> {
  if (!name) return null
  const pm = await PaymentMethod.query().where('hotel_id', hotelId).where('method_name', name).first()
  return pm || null
}

async function findRoomType(hotelId: number, name?: string | null): Promise<RoomType | null> {
  if (!name) return null
  const rt = await RoomType.query().where('hotel_id', hotelId).where('room_type_name', name).first()
  return rt || null
}

export default class ImportBookings extends BaseCommand {
  public static commandName = 'import:bookings'
  public static description = 'Import reservations from a CSV file exported by Enjoy PMS'

  @args.string({ description: 'Path to the CSV file' })
  declare filePath: string

  @flags.boolean({ description: 'Dry run, do not write to DB', alias: 'd' })
  declare dryRun: boolean

  @flags.number({ description: 'Default hotel id when CSV is missing', alias: 'h' })
  declare defaultHotelId: number | undefined

  @flags.number({ description: 'Fallback room type id', alias: 'r' })
  declare fallbackRoomTypeId: number | undefined

  public async run() {
    const inputPath = this.filePath || path.resolve('data', 'BookingList_RES_ij6NHV3euux50fwcgrnpSw_RES_691469caa4f77.csv')
    if (!fs.existsSync(inputPath)) {
      this.logger.error(`File not found: ${inputPath}`)
      return
    }

    const content = fs.readFileSync(inputPath, 'utf8')
    const rows = parseCsv(content)
    if (!rows.length) {
      this.logger.error('CSV file appears empty.')
      return
    }

    const header = rows[0]
    const dataRows = rows.slice(1)

    const col = (name: string) => header.findIndex((h) => trimLower(h) === trimLower(name))
    const idx = {
      hotelId: col('HotelId'),
      reservationNo: col('Res #'),
      bookingDate: col('Booking Date'),
      bookingTime: col('Booking Time'),
      guestName: col('Guest Name'),
      arrival: col('Arrival'),
      departure: col('Dept'),
      roomTypeName: col('Room'),
      rateTypeName: col('Rate Type'),
      pax: col('Pax'),
      total: col('Total'),
      adr: col('ADR'),
      deposit: col('Deposit'),
      source: col('Source'),
      totalTax: col('Total Tax'),
      totalCharges: col('Total Charges'),
      voucher: col('Voucher'),
      status: col('Status'),
      dueAmount: col('Due Amt.'),
      email: col('Email'),
      phone: col('Mobile No'),
      city: col('City'),
      country: col('Country'),
      zip: col('Zip Code'),
      state: col('State'),
      folioNo: col('Folio No'),
      preference: col('Preference'),
      businessSourceName: col('Travelagent'),
      salesperson: col('Salesperson'),
      remark: col('Remark'),
      reservationTypeName: col('Reservationn Type'),
      marketCode: col('Market Code'),
      paymentTypeName: col('Payment Type'),
      nights: col('No Of Nights'),
      cancellationDate: col('Cancellation Date'),
      lastModifiedDate: col('Last Modified Date'),
      lastModifiedBy: col('Last Modified By'),
      roomsBooked: col('Number of rooms booked'),
      currency: col('Currency'),
      user: col('User'),
    }

    let created = 0
    let skipped = 0
    let failed = 0

    for (const row of dataRows) {
      try {
        const hotelId = idx.hotelId >= 0 ? parseIntSafe(row[idx.hotelId]) || this.defaultHotelId || null : this.defaultHotelId || null
        if (!hotelId) {
          this.logger.warn('Skipping row: missing HotelId (and no --hotel fallback)')
          skipped++
          continue
        }

        const guestName = idx.guestName >= 0 ? row[idx.guestName] : ''
        const email = idx.email >= 0 ? row[idx.email] : ''
        const phone = idx.phone >= 0 ? row[idx.phone] : ''
        const city = idx.city >= 0 ? row[idx.city] : ''
        const country = idx.country >= 0 ? row[idx.country] : ''
        const guest = await findGuest(hotelId, guestName, email, phone, city, country)

        const bookingSource = await findBookingSource(hotelId, idx.source >= 0 ? row[idx.source] : undefined)
        const businessSource = await findBusinessSource(hotelId, idx.businessSourceName >= 0 ? row[idx.businessSourceName] : undefined)
        const reservationType = await findReservationType(hotelId, idx.reservationTypeName >= 0 ? row[idx.reservationTypeName] : undefined)
        const marketCode = await findMarketCode(hotelId, idx.marketCode >= 0 ? row[idx.marketCode] : undefined)
        const paymentMethod = await findPaymentMethod(hotelId, idx.paymentTypeName >= 0 ? row[idx.paymentTypeName] : undefined)
        const roomType = await findRoomType(hotelId, idx.roomTypeName >= 0 ? row[idx.roomTypeName] : undefined)

        const reservationNo = idx.reservationNo >= 0 ? row[idx.reservationNo] : ''
        const bookingDt = parseDateTime(idx.bookingDate >= 0 ? row[idx.bookingDate] : undefined, idx.bookingTime >= 0 ? row[idx.bookingTime] : undefined)
        const arrivalDt = parseDate(idx.arrival >= 0 ? row[idx.arrival] : undefined)
        const departureDt = parseDate(idx.departure >= 0 ? row[idx.departure] : undefined)
        const cancellationDt = parseDate(idx.cancellationDate >= 0 ? row[idx.cancellationDate] : undefined)
        const lastModDt = parseDate(idx.lastModifiedDate >= 0 ? row[idx.lastModifiedDate] : undefined)

        const pax = idx.pax >= 0 ? parseIntSafe(row[idx.pax]) : null
        const total = idx.total >= 0 ? parseNumber(row[idx.total]) : null
        const adr = idx.adr >= 0 ? parseNumber(row[idx.adr]) : null
        const deposit = idx.deposit >= 0 ? parseNumber(row[idx.deposit]) : null
        const totalTax = idx.totalTax >= 0 ? parseNumber(row[idx.totalTax]) : null
        const totalCharges = idx.totalCharges >= 0 ? parseNumber(row[idx.totalCharges]) : null
        const dueAmount = idx.dueAmount >= 0 ? parseNumber(row[idx.dueAmount]) : null
        const roomsBooked = idx.roomsBooked >= 0 ? parseIntSafe(row[idx.roomsBooked]) : null
        const nights = idx.nights >= 0 ? parseIntSafe(row[idx.nights]) : null
        const currencyCode = idx.currency >= 0 ? String(row[idx.currency]).trim() : undefined

        const status = mapStatus(idx.status >= 0 ? row[idx.status] : undefined)

        const payload: Partial<Reservation> = {
          hotelId,
          guestId: guest.id,
          reservationNumber: reservationNo || undefined,
          bookingDate: bookingDt || undefined,
          scheduledArrivalDate: arrivalDt || undefined,
          scheduledDepartureDate: departureDt || undefined,
          cancellationDate: cancellationDt || undefined,
          updatedAt: lastModDt || undefined,
          nights: nights ?? undefined,
          adults: pax ?? undefined,
          baseRate: adr ?? undefined,
          totalAmount: total ?? undefined,
          totalCharges: totalCharges ?? undefined,
          totalTax: totalTax ?? undefined,
          depositPaid: deposit ?? undefined,
          balanceDue: dueAmount ?? undefined,
          roomsRequested: roomsBooked ?? undefined,
          currencyCode: currencyCode,
          status: status.status,
          reservationStatus: status.reservationStatus,
          bookingSourceId: bookingSource?.id ?? undefined,
          businessSourceId: businessSource?.id ?? undefined,
          reservationTypeId: reservationType?.id ?? undefined,
          marketCodeId: marketCode?.id ?? undefined,
          paymentMethodId: paymentMethod?.id ?? undefined,
          roomTypeId: roomType?.id ?? this.fallbackRoomTypeId ?? undefined,
          notes: idx.remark >= 0 ? row[idx.remark] : undefined,
        }

        if (this.dryRun) {
          this.logger.info(`[DRY] Would import reservation ${payload.reservationNumber || '(no number)'} for hotel ${hotelId}`)
          created++
          continue
        }

        //const reservation = await Reservation.create(payload)
        this.logger.success(`Imported reservation id=${reservation.id} number=${reservation.reservationNumber || ''}`)
        created++
      } catch (err) {
        this.logger.error(`Failed to import row: ${(err as Error).message}`)
        failed++
      }
    }

    this.logger.info(`Import complete: created=${created}, skipped=${skipped}, failed=${failed}`)
  }
}