import { BaseCommand, flags } from '@adonisjs/core/ace'
import { DateTime } from 'luxon'
import fs from 'node:fs'
import path from 'node:path'

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let cell = ''
  let inQuotes = false

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
  if (cell.length > 0 || inQuotes) current.push(cell)
  if (current.length) rows.push(current)
  return rows
}

function trimLower(s: string | undefined | null): string {
  return (s || '').trim().toLowerCase()
}

function colAny(header: string[], names: string[]): number {
  const normalized = header.map((h) => trimLower(h))
  for (const name of names) {
    const idx = normalized.findIndex((h) => h === trimLower(name))
    if (idx >= 0) return idx
  }
  return -1
}

function parseNumber(val: string | undefined | null): number | null {
  if (val == null) return null
  const n = Number(String(val).replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseIntSafe(val: string | undefined | null): number | null {
  if (val == null) return null
  const n = parseInt(String(val).replace(/[^0-9\-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function parseDate(val: string | undefined | null): DateTime | null {
  if (!val) return null
  let raw = val.trim()
  if (raw.startsWith('="') && raw.endsWith('"')) {
    raw = raw.slice(2, -1)
  }
  const dateOnly = raw.split(/[\sT]+/)[0]
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
  let dv = String(dateVal).trim()
  if (dv.startsWith('="') && dv.endsWith('"')) {
    dv = dv.slice(2, -1)
  }
  const d = parseDate(dv)
  if (!d) return null
  if (!timeVal) return d
  let time = String(timeVal).trim()
  if (time.startsWith('="') && time.endsWith('"')) {
    time = time.slice(2, -1)
  }
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

function parsePax(val: string | undefined | null): number | null {
  if (!val) return null
  const nums = String(val).match(/\d+/g)
  if (!nums || !nums.length) return parseIntSafe(val)
  return nums.map((n) => parseInt(n, 10)).filter(Number.isFinite).reduce((a, b) => a + b, 0)
}

function fitLen(val: string | undefined | null, max = 255): string | null {
  if (val == null) return null
  const s = String(val)
  if (s.length <= max) return s
  return s.slice(0, max)
}

import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class ImportHotelHistory extends BaseCommand {
  public static commandName = 'import:hotel-history'
  public static description = 'Import HotelHistory rows from a CSV file'
  public static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Path to CSV file', alias: 'f' })
  declare filePath: string | undefined

  @flags.number({ description: 'Hotel id to assign', alias: 'h' })
  declare hotelId: number | undefined

  @flags.boolean({ description: 'Dry run (no DB writes)', alias: 'd' })
  declare dryRun: boolean

  @flags.boolean({ description: 'Preview parsed rows', alias: 'p' })
  declare preview: boolean

  @flags.number({ description: 'Limit number of previews shown', alias: 'l' })
  declare previewLimit: number | undefined

  @flags.number({ description: 'Process at most N data rows', alias: 'm' })
  declare maxRows: number | undefined

  @flags.number({ description: 'Chunk size for bulk insert', alias: 'c' })
  declare chunkSize: number | undefined

  public async run() {
    const inputPath = this.filePath || path.resolve('data', 'BookingList.csv')
    const hotelId = this.hotelId ?? 2
    if (!fs.existsSync(inputPath)) {
      this.logger.error(`File not found: ${inputPath}`)
      return
    }

    const content = fs.readFileSync(inputPath, 'utf8')
    const rows = parseCsv(content)
    if (!rows.length) {
      this.logger.error('CSV appears empty')
      return
    }

    const header = rows[0]
    const dataRows = rows.slice(1)

    const col = (name: string) => header.findIndex((h) => trimLower(h) === trimLower(name))
    const idx = {
      hotelName: col('Hotel Name'),
      reservationNumber: col('Res #'),
      bookingDate: col('Booking Date'),
      bookingTime: col('Booking Time'),
      guestName: col('Guest Name'),
      userName: col('User'),
      arrivalDate: col('Arrival'),
      departureDate: col('Dept'),
      room: col('Room'),
      rateType: col('Rate Type'),
      pax: col('Pax'),
      total: col('Total'),
      adr: col('ADR'),
      deposit: col('Deposit'),
      source: col('Source'),
      totalTax: col('Total Tax'),
      totalCharges: col('Total Charges'),
      commission: col('Commission'),
      voucher: col('Voucher'),
      status: col('Status'),
      dueAmount: col('Due Amt.'),
      email: col('Email'),
      mobileNo: col('Mobile No'),
      city: col('City'),
      country: col('Country'),
      zipCode: col('Zip Code'),
      state: col('State'),
      folioNo: col('Folio No'),
      preference: col('Preference'),
      travelAgent: col('Travelagent'),
      salesperson: col('Salesperson'),
      remark: col('Remark'),
      reservationType: col('Reservationn Type'),
      marketCode: col('Market Code '),
      paymentType: col('Payment Type '),
      numberOfNights: col('No Of Nights'),
      cancellationDate: col('Cancellation Date'),
      lastModifiedDate: col('Last Modified Date'),
      lastModifiedBy: col('Last Modified By'),
      numberOfRoomsBooked: col('Number of rooms booked'),
    }

    const chargeColumns = [
      'BLANCHISSERIE',
      'channel',
      'Dette Hebergement',
      'Early Check-in',
      'ECRAN',
      'Epilation',
      'Gommage corporel',
      'Hammam',
      'Late Checkout',
      'Location Sonorisation',
      'Massage',
      'Micro conférencier',
      'MT CONFERENCE 1',
      'MT CONFERENCE 2',
      'Package',
      'PDJ',
      'PDJ 2',
      'Pédicure-Manicure',
      'piscine',
      'PROJECTEUR',
      'Restaurant chez madeleine',
      'SAILOU ROOM',
      'Sauna',
      'Soins cheveux femme',
      'Soins de visage',
      'Transfert de Charges',
    ]

    const chargeIdx: Record<string, number> = {}
    for (const key of chargeColumns) {
      // Try exact, then trimmed variant
      const exact = header.findIndex((h) => h === key)
      if (exact >= 0) {
        chargeIdx[key] = exact
        continue
      }
      const trimmed = header.findIndex((h) => trimLower(h) === trimLower(key))
      if (trimmed >= 0) {
        chargeIdx[key] = trimmed
        continue
      }
      // Also try basic ASCII fallback for accents
      const ascii = key.normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const asciiIdx = header.findIndex((h) => h.normalize('NFD').replace(/\p{Diacritic}/gu, '') === ascii)
      chargeIdx[key] = asciiIdx
    }

    let created = 0
    let skipped = 0
    let failed = 0

    const HhMod = await import('#models/hotel_history')
    const HotelHistory: any = (HhMod as any).default ?? (HhMod as any)

    const payloads: any[] = []
    let previewCount = 0
    let processed = 0
    for (const row of dataRows) {
      if (this.maxRows && this.maxRows > 0 && processed >= this.maxRows) {
        break
      }
      try {
        const payload: any = {
          hotelId,
          hotelName: idx.hotelName >= 0 ? fitLen(row[idx.hotelName]) : null,
          reservationNumber: idx.reservationNumber >= 0 ? fitLen(row[idx.reservationNumber]) : null,
          bookingDate: idx.bookingDate >= 0 ? parseDate(row[idx.bookingDate]) : null,
          bookingTime: idx.bookingTime >= 0 ? fitLen(row[idx.bookingTime]) : null,
          guestName: idx.guestName >= 0 ? fitLen(row[idx.guestName]) : null,
          userName: idx.userName >= 0 ? fitLen(row[idx.userName]) : null,
          arrivalDate: idx.arrivalDate >= 0 ? parseDate(row[idx.arrivalDate]) : null,
          departureDate: idx.departureDate >= 0 ? parseDate(row[idx.departureDate]) : null,
          room: idx.room >= 0 ? fitLen(row[idx.room]) : null,
          rateType: idx.rateType >= 0 ? fitLen(row[idx.rateType]) : null,
          pax: idx.pax >= 0 ? parsePax(row[idx.pax]) : null,
          total: idx.total >= 0 ? parseNumber(row[idx.total]) : null,
          adr: idx.adr >= 0 ? parseNumber(row[idx.adr]) : null,
          deposit: idx.deposit >= 0 ? parseNumber(row[idx.deposit]) : null,
          source: idx.source >= 0 ? fitLen(row[idx.source]) : null,
          totalTax: idx.totalTax >= 0 ? parseNumber(row[idx.totalTax]) : null,
          totalCharges: idx.totalCharges >= 0 ? parseNumber(row[idx.totalCharges]) : null,
          commission: idx.commission >= 0 ? parseNumber(row[idx.commission]) : null,
          voucher: idx.voucher >= 0 ? fitLen(row[idx.voucher]) : null,
          status: idx.status >= 0 ? fitLen(row[idx.status]) : null,
          dueAmount: idx.dueAmount >= 0 ? parseNumber(row[idx.dueAmount]) : null,
          email: idx.email >= 0 ? fitLen(row[idx.email]) : null,
          mobileNo: idx.mobileNo >= 0 ? fitLen(row[idx.mobileNo]) : null,
          city: idx.city >= 0 ? fitLen(row[idx.city]) : null,
          country: idx.country >= 0 ? fitLen(row[idx.country]) : null,
          zipCode: idx.zipCode >= 0 ? fitLen(row[idx.zipCode]) : null,
          state: idx.state >= 0 ? fitLen(row[idx.state]) : null,
          folioNo: idx.folioNo >= 0 ? fitLen(row[idx.folioNo]) : null,
          preference: idx.preference >= 0 ? fitLen(row[idx.preference]) : null,
          travelAgent: idx.travelAgent >= 0 ? fitLen(row[idx.travelAgent]) : null,
          salesperson: idx.salesperson >= 0 ? fitLen(row[idx.salesperson]) : null,
          remark: idx.remark >= 0 ? fitLen(row[idx.remark]) : null,
          reservationType: idx.reservationType >= 0 ? fitLen(row[idx.reservationType]) : null,
          marketCode: idx.marketCode >= 0 ? fitLen(row[idx.marketCode]) : null,
          paymentType: idx.paymentType >= 0 ? fitLen(row[idx.paymentType]) : null,
          numberOfNights: idx.numberOfNights >= 0 ? parseIntSafe(row[idx.numberOfNights]) : null,
          cancellationDate: idx.cancellationDate >= 0 ? parseDate(row[idx.cancellationDate]) : null,
          lastModifiedDate: idx.lastModifiedDate >= 0 ? parseDate(row[idx.lastModifiedDate]) : null,
          lastModifiedBy: idx.lastModifiedBy >= 0 ? fitLen(row[idx.lastModifiedBy]) : null,
          numberOfRoomsBooked: idx.numberOfRoomsBooked >= 0 ? parseIntSafe(row[idx.numberOfRoomsBooked]) : null,
        }

        const charges: Record<string, any> = {}
        for (const key of chargeColumns) {
          const i = chargeIdx[key]
          if (i == null || i < 0) continue
          const raw = row[i]
          if (raw == null || raw === '' || raw === '-') continue
          const num = parseNumber(raw)
          if (num != null && num !== 0) {
            charges[key] = num
          } else {
            const val = (raw || '').trim()
            if (val) charges[key] = val
          }
        }
        payload.extractCharge = Object.keys(charges).length ? charges : null

        if (this.preview && (!this.previewLimit || previewCount < this.previewLimit)) {
          this.logger.info(`[PREVIEW] History for ${payload.reservationNumber || payload.guestName || '(unknown)'}:`)
          this.logger.info(JSON.stringify(payload, null, 2))
          previewCount++
          if (!this.dryRun) {
            skipped++
            processed++
            continue
          }
        }

        if (this.dryRun) {
          this.logger.info(`[DRY] Would create HotelHistory for hotel ${hotelId}`)
          created++
          continue
        }

        payloads.push(payload)
        created++
      } catch (err) {
        this.logger.error(`Failed to import row: ${(err as Error).message}`)
        failed++
      }
      processed++
    }

    // Bulk insert in chunks when not dry-run
    if (!this.dryRun && payloads.length > 0) {
      const size = this.chunkSize && this.chunkSize > 0 ? this.chunkSize : 1000
      for (let i = 0; i < payloads.length; i += size) {
        const chunk = payloads.slice(i, i + size)
        try {
          await HotelHistory.createMany(chunk)
        } catch (err) {
          this.logger.error(`Failed bulk insert for rows ${i}-${Math.min(i + size, payloads.length) - 1}: ${(err as Error).message}`)
          failed += chunk.length
        }
      }
    }

    this.logger.info(`Import complete: created=${created}, skipped=${skipped}, failed=${failed}`)
  }
}

