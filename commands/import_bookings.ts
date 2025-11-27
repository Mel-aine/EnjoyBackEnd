import { BaseCommand, flags } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import fs from 'node:fs'
import path from 'node:path'

// Models are loaded dynamically where needed to avoid startup issues
// Reservation creation service will be imported dynamically during execution

// Reuse simple CSV parsing similar to other import commands
function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let cell = ''
  let inQuotes = false

  // Detect delimiter from first line (prefer ';' if present)
  const firstLineEnd = content.indexOf('\n') >= 0 ? content.indexOf('\n') : content.length
  const firstLine = content.slice(0, firstLineEnd)
  const commaCount = (firstLine.match(/,/g) || []).length
  const semiCount = (firstLine.match(/;/g) || []).length
  const delimiter = semiCount > commaCount ? ';' : ','

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
      } else if (char === delimiter) {
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
  // Normalize and strip potential time part
  let raw = val.trim()
  // Handle Excel-export style ="..." wrapping
  if (raw.startsWith('="') && raw.endsWith('"')) {
    raw = raw.slice(2, -1)
  }
  const dateOnly = raw.split(/[\sT]+/)[0]
  // Try common formats
  const formats = [
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'yyyy-MM-dd',
    'dd-MM-yyyy',
    'd/M/yyyy',
    'd/MM/yyyy',
    'dd/M/yyyy',
    'yyyy/MM/dd',
    'dd.MM.yyyy',
    'dd-MMM-yyyy',
    'd-MMM-yyyy',
  ]
  for (const fmt of formats) {
    const dt = DateTime.fromFormat(dateOnly, fmt)
    if (dt.isValid) return dt
  }
  const iso = DateTime.fromISO(dateOnly)
  return iso.isValid ? iso : null
}

function parseDateTime(dateVal: string | undefined | null, timeVal?: string | undefined | null): DateTime | null {
  if (!dateVal) return null
  // Normalize Excel-export style wrappers
  let dv = String(dateVal).trim()
  if (dv.startsWith('="') && dv.endsWith('"')) {
    dv = dv.slice(2, -1)
  }
  const d = parseDate(dv)
  if (!d) return null
  if (!timeVal) return d
  // attempt HH:mm or HH:mm:ss
  let time = String(timeVal).trim()
  if (time.startsWith('="') && time.endsWith('"')) {
    time = time.slice(2, -1)
  }
  // Try common time formats
  const timeFormats = ['H:mm', 'HH:mm', 'H:mm:ss', 'HH:mm:ss', 'h:mm a', 'hh:mm a']
  for (const tf of timeFormats) {
    const dt = DateTime.fromFormat(`${d.toISODate()} ${time}`, `yyyy-MM-dd ${tf}`)
    if (dt.isValid) return dt
  }
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

function parseGuestName(name: string): { title?: string; firstName: string; lastName: string } {
  const raw = (name || '').trim()
  const parts = raw.split(/\s+/)
  const titles = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sir', 'madam', 'm', 'mme', 'mlle'])
  let title: string | undefined
  let startIdx = 0
  if (parts.length > 0) {
    const first = parts[0].replace(/\.$/, '').toLowerCase()
    if (titles.has(first)) {
      title = parts[0]
      startIdx = 1
    }
  }
  const firstName = parts[startIdx] || '-'
  const lastName = parts.slice(startIdx + 1).join(' ') || '-'
  return { title, firstName, lastName }
}

async function findBookingSource(hotelId: number, sourceName?: string | null): Promise<BookingSource | null> {
  const BookingSourceMod = await import('#models/booking_source')
  const BookingSource: any = (BookingSourceMod as any).default ?? (BookingSourceMod as any)
  if (!sourceName) return null
  const s = await BookingSource.query().where('hotel_id', hotelId).where('source_name', sourceName).first()
  return s || null
}

async function findBusinessSource(hotelId: number, name?: string | null): Promise<BusinessSource | null> {
  const BusinessSourceMod = await import('#models/business_source')
  const BusinessSource: any = (BusinessSourceMod as any).default ?? (BusinessSourceMod as any)
  if (!name) return null
  const s = await BusinessSource.query().where('hotel_id', hotelId).where('source_name', name).first()
  return s || null
}

async function findReservationType(hotelId: number, name?: string | null): Promise<ReservationType | null> {
  const ReservationTypeMod = await import('#models/reservation_type')
  const ReservationType: any = (ReservationTypeMod as any).default ?? (ReservationTypeMod as any)
  if (!name) return null
  const s = await ReservationType.query().where('hotel_id', hotelId).where('type_name', name).first()
  return s || null
}

async function findMarketCode(hotelId: number, codeOrName?: string | null): Promise<MarketCode | null> {
  const MarketCodeMod = await import('#models/market_code')
  const MarketCode: any = (MarketCodeMod as any).default ?? (MarketCodeMod as any)
  if (!codeOrName) return null
  const byCode = await MarketCode.query().where('hotel_id', hotelId).where('code', codeOrName).first()
  if (byCode) return byCode
  const byName = await MarketCode.query().where('hotel_id', hotelId).where('name', codeOrName).first()
  return byName || null
}

async function findPaymentMethod(hotelId: number, name?: string | null): Promise<PaymentMethod | null> {
  const PaymentMethodMod = await import('#models/payment_method')
  const PaymentMethod: any = (PaymentMethodMod as any).default ?? (PaymentMethodMod as any)
  if (!name) return null
  const pm = await PaymentMethod.query().where('hotel_id', hotelId).where('method_name', name).first()
  return pm || null
}

async function findRoomType(hotelId: number, name?: string | null): Promise<RoomType | null> {
  const RoomTypeMod = await import('#models/room_type')
  const RoomType: any = (RoomTypeMod as any).default ?? (RoomTypeMod as any)
  if (!name) return null
  if (!RoomType || typeof RoomType.query !== 'function') return null
  const rt = await RoomType.query().where('hotel_id', hotelId).where('room_type_name', name).first()
  return rt || null
}

async function findRateType(hotelId: number, name?: string | null): Promise<RateType | null> {
  const RateTypeMod = await import('#models/rate_type')
  const RateType: any = (RateTypeMod as any).default ?? (RateTypeMod as any)
  if (!name) return null
  if (!RateType || typeof RateType.query !== 'function') return null
  const rt = await RateType.query().where('hotel_id', hotelId).where('rate_type_name', name).first()
  return rt || null
}

async function findUserByNameOrEmail(hotelId: number, val?: string | null): Promise<User | null> {
  const UserMod = await import('#models/user')
  const User: any = (UserMod as any).default ?? (UserMod as any)
  if (!val) return null
  const raw = String(val).trim()
  const emailNorm = raw.toLowerCase()
  if (emailNorm.includes('@')) {
    const byEmail = await User.query().where('hotel_id', hotelId).where('email', emailNorm).first()
    if (byEmail) return byEmail
  }
  const parts = raw.split(/\s+/)
  const first = parts[0] || ''
  const last = parts.slice(1).join(' ')
  if (first) {
    const byName = await User.query()
      .where('hotel_id', hotelId)
      .where('first_name', first)
      .where('last_name', last || '-')
      .first()
    if (byName) return byName
  }
  return null
}

export default class ImportBookings extends BaseCommand {
  public static commandName = 'import:bookings'
  public static description = 'Import reservations from a CSV file exported by Enjoy PMS'

  @flags.string({ description: 'Path to the CSV file', alias: 'f' })
  declare filePath: string | undefined

  @flags.boolean({ description: 'Dry run, do not write to DB', alias: 'd' })
  declare dryRun: boolean

  @flags.number({ description: 'Default hotel id when CSV is missing', alias: 'h' })
  declare defaultHotelId: number | undefined

  @flags.number({ description: 'Fallback room type id', alias: 'r' })
  declare fallbackRoomTypeId: number | undefined

  @flags.boolean({ description: 'Show reservation payload before creating', alias: 'p' })
  declare showPayload: boolean

  @flags.boolean({ description: 'Proceed with creation after preview', alias: 'y' })
  declare yes: boolean

  @flags.boolean({ description: 'Resolve DB lookups during preview/dry-run', alias: 'R' })
  declare resolvePreviews: boolean

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
    let idx = {
      hotelId: colAny(header, ['HotelId', 'Hotel Id', 'Hotel ID', 'Hotel']), // some exports use HotelId; others use Hotel Name
      hotelName: colAny(header, ['Hotel Name', 'Hotel']),
      reservationNo: colAny(header, ['Res #', 'Reservation #', 'Reservation No', 'Reservation Number', 'Res No']),
      bookingDate: colAny(header, ['Booking Date', 'Reservation Date', 'Created Date', 'Date of Booking']),
      bookingTime: colAny(header, ['Booking Time', 'Reservation Time', 'Time of Booking']),
      guestName: colAny(header, ['Guest Name', 'Primary Guest', 'Name']),
      user: colAny(header, ['User', 'Created By', 'Reserved By', 'Salesperson']),
      arrival: colAny(header, ['Arrival', 'Arrival Date', 'Arrived', 'Check In', 'Check-in Date', 'Check In Date']),
      departure: colAny(header, ['Dept', 'Departure', 'Departure Date', 'Check Out', 'Check-out Date', 'Check Out Date', 'Depart Date']),
      roomTypeName: colAny(header, ['Room', 'Room Type', 'RoomType', 'Room Type Name']),
      rateTypeName: colAny(header, ['Rate Type', 'RateType', 'Rate Plan', 'Rate Plan Name']),
      adult: col('Adult'),
      child: col('Child'),
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
      roomsBooked: col('Number of rooms booked'),
      cancellationDate: col('Cancellation Date'),
      lastModifiedDate: col('Last Modified Date'),
      lastModifiedBy: col('Last Modified By'),
      currency: col('Currency'),
      // optional add-ons in some exports
      blanchisserie: col('BLANCHISSERIE'),
      hammam: col('Hammam'),
      lateCheckout: col('Late Checkout'),
      sonorisation: col('Location Sonorisation'),
      pdj: col('PDJ'),
      transfertCharges: col('Transfert de Charges'),
    }

    // Fallbacks using substring contains if exact aliases didn't match
    const contains = (arr: string[]) => (idxName: number) => idxName < 0 ? header.findIndex(h => trimLower(h).includes(arr.map(s => trimLower(s)).find(() => true) as any) ) : idxName
    if (idx.arrival < 0) idx.arrival = header.findIndex(h => trimLower(h).includes('arrival') || trimLower(h).includes('check in') || trimLower(h).includes('arrived'))
    if (idx.departure < 0) idx.departure = header.findIndex(h => trimLower(h).includes('dept') || trimLower(h).includes('depart') || trimLower(h).includes('departure') || trimLower(h).includes('check out'))
    if (idx.bookingDate < 0) idx.bookingDate = header.findIndex(h => trimLower(h).includes('booking') || trimLower(h).includes('reservation date') || trimLower(h).includes('created'))
    if (idx.bookingTime < 0) idx.bookingTime = header.findIndex(h => trimLower(h).includes('booking time') || trimLower(h).includes('reservation time'))

    let created = 0
    let skipped = 0
    let failed = 0

    for (const row of dataRows) {
      try {
        const hotelId = idx.hotelId >= 0 ? parseIntSafe(row[idx.hotelId]) || this.defaultHotelId || null : this.defaultHotelId || null
        if (!hotelId) {
          this.logger.warning('Skipping row: missing HotelId (and no --hotel fallback)')
          skipped++
          continue
        }

        const guestName = idx.guestName >= 0 ? row[idx.guestName] : ''
        const email = idx.email >= 0 ? row[idx.email] : ''
        const phone = idx.phone >= 0 ? row[idx.phone] : ''
        const city = idx.city >= 0 ? row[idx.city] : ''
        const country = idx.country >= 0 ? row[idx.country] : ''
        const resolve = this.resolvePreviews === true
        const useStub = (this.showPayload || this.dryRun) && !resolve
        const { title, firstName, lastName } = parseGuestName(guestName)
        const guestData = {
          title,
          firstName,
          lastName,
          email: (email || '').trim().toLowerCase(),
          phone: (phone || '').trim(),
          city: city || '',
          country: country || '',
        }

        const bookingSource = useStub
          ? null
          : await findBookingSource(hotelId, idx.source >= 0 ? row[idx.source] : undefined)
        const businessSource = useStub
          ? null
          : await findBusinessSource(hotelId, idx.businessSourceName >= 0 ? row[idx.businessSourceName] : undefined)
        const reservationType = useStub
          ? null
          : await findReservationType(hotelId, idx.reservationTypeName >= 0 ? row[idx.reservationTypeName] : undefined)
        const marketCode = useStub
          ? null
          : await findMarketCode(hotelId, idx.marketCode >= 0 ? row[idx.marketCode] : undefined)
        const paymentMethod = useStub
          ? null
          : await findPaymentMethod(hotelId, idx.paymentTypeName >= 0 ? row[idx.paymentTypeName] : undefined)
        const roomType = useStub
          ? null
          : await findRoomType(
              hotelId,
              idx.roomTypeName >= 0 ? row[idx.roomTypeName] : undefined
            )

        const reservationNo = idx.reservationNo >= 0 ? row[idx.reservationNo] : ''
        const bookingDt = parseDateTime(idx.bookingDate >= 0 ? row[idx.bookingDate] : undefined, idx.bookingTime >= 0 ? row[idx.bookingTime] : undefined)
        const arrivalDt = parseDate(idx.arrival >= 0 ? row[idx.arrival] : undefined)
        const departureDt = parseDate(idx.departure >= 0 ? row[idx.departure] : undefined)
        const cancellationDt = parseDate(idx.cancellationDate >= 0 ? row[idx.cancellationDate] : undefined)
        const lastModDt = parseDate(idx.lastModifiedDate >= 0 ? row[idx.lastModifiedDate] : undefined)

        const adultCount = idx.adult >= 0 ? parseIntSafe(row[idx.adult]) : null
        const childCount = idx.child >= 0 ? parseIntSafe(row[idx.child]) : null
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
        const createdByUser = useStub
          ? null
          : await findUserByNameOrEmail(hotelId, idx.user >= 0 ? row[idx.user] : undefined)
        const rateType = useStub
          ? null
          : await findRateType(
              hotelId,
              idx.rateTypeName >= 0 ? row[idx.rateTypeName] : undefined
            )

        const roomTypeNameRaw = idx.roomTypeName >= 0 ? (row[idx.roomTypeName] || '') : ''
        const rateTypeNameRaw = idx.rateTypeName >= 0 ? (row[idx.rateTypeName] || '') : ''
        const roomTypeIdFromCsv = parseIntSafe(roomTypeNameRaw)
        const rateTypeIdFromCsv = parseIntSafe(rateTypeNameRaw)

        const creationData = {
          hotel_id: hotelId,
          arrived_date: arrivalDt ? arrivalDt.toISODate() : undefined,
          depart_date: departureDt ? departureDt.toISODate() : undefined,
          check_in_date: arrivalDt ? arrivalDt.toISODate() : undefined,
          check_out_date: departureDt ? departureDt.toISODate() : undefined,
          created_by: createdByUser?.id ?? 0,
          guest: guestData,
          booking_date: bookingDt ? bookingDt.toISO() : undefined,
          reservation_number: reservationNo || undefined,
          status: status.status,
          reservation_type_id: reservationType?.id ?? undefined,
          booking_source: bookingSource?.id ?? undefined,
          business_source: businessSource?.id ?? undefined,
          payment_mod: paymentMethod?.id ?? undefined,
          market_code_id: marketCode?.id ?? undefined,
          payment_type: idx.paymentTypeName >= 0 ? row[idx.paymentTypeName] : undefined,
          total_amount: totalCharges ?? total ?? undefined,
          tax_amount: totalTax ?? undefined,
          final_amount: total ?? undefined,
          paid_amount: deposit ?? undefined,
          remaining_amount: dueAmount ?? undefined,
          special_requests: [
            idx.preference >= 0 ? row[idx.preference] : '',
            idx.remark >= 0 ? row[idx.remark] : '',
          ].filter(Boolean).join(' | '),
          rooms: [
            {
              room_type_id: roomTypeIdFromCsv ?? roomType?.id ?? this.fallbackRoomTypeId ?? 0,
              room_type_name: roomTypeNameRaw || undefined,
              adult_count: adultCount ?? 0,
              child_count: childCount ?? 0,
              room_rate: adr ?? 0,
              rate_type_id: rateTypeIdFromCsv ?? rateType?.id ?? undefined,
              rate_type_name: rateTypeNameRaw || undefined,
              nights: nights ?? undefined,
              checkin_date: arrivalDt ? arrivalDt.toISODate() : undefined,
              checkout_date: departureDt ? departureDt.toISODate() : undefined,
            },
          ],
        }

        // Preview payload for confirmation
        if (this.showPayload) {
          this.logger.info(`[PREVIEW] Reservation ${reservationNo || '(no number)'} payload:`)
          this.logger.info(JSON.stringify(creationData, null, 2))
          if (!this.dryRun && !this.yes) {
            this.logger.warning('Preview shown; pass --yes to proceed or use --dryRun to simulate.')
            skipped++
            continue
          }
        }

        if (this.dryRun) {
          this.logger.info(`[DRY] Would import reservation ${reservationNo || '(no number)'} for hotel ${hotelId}`)
          created++
          continue
        }

        const RcsMod = await import('#services/reservation_creation_service')
        const ReservationCreationService: any = (RcsMod as any).default ?? (RcsMod as any)
        const result = await ReservationCreationService.createReservation(creationData as any)
        if (result.success) {
          this.logger.success(`Imported reservation id=${result.reservationId} number=${result.reservationNumber || reservationNo || ''}`)
          created++
        } else {
          this.logger.error(`Failed to import reservation ${reservationNo || ''}: ${result.message || result.error || 'unknown error'}`)
          failed++
        }
      } catch (err) {
        this.logger.error(`Failed to import row: ${(err as Error).message}`)
        failed++
      }
    }

    this.logger.info(`Import complete: created=${created}, skipped=${skipped}, failed=${failed}`)
  }
}
// Find a column index by trying multiple header aliases
function colAny(header: string[], names: string[]): number {
  const normalized = header.map((h) => trimLower(h))
  for (const name of names) {
    const idx = normalized.findIndex((h) => h === trimLower(name))
    if (idx >= 0) return idx
  }
  return -1
}
