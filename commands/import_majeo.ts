import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import fs from 'node:fs'
import path from 'node:path'

interface MajeoReservation {
  id: string
  status: string
  client: string
  guests: number
  documents: string[]
  rooms: MajeoRoom[]
}

interface MajeoRoom {
  name: string | null
  check_in: string
  check_out: string
  amenities: { name: string; quantity: number }[]
}

interface ResolvedRoom {
  roomNumber: string | null
  roomId: number | null
  roomTypeId: number | null
  roomTypeName: string | null
  roomRateId: number | null
  baseRate: number | null
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
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

function calculateNightCount(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) {
    return 0
  }

  return Math.max(
    0,
    Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  )
}

export default class ImportMajeo extends BaseCommand {
  public static commandName = 'import:majeo'
  public static description = 'Import done reservations from data/client_data_tomigrate/majeo.json for hotel 47'
  public static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Path to the JSON file', alias: 'f' })
  declare filePath: string | undefined

  @flags.boolean({ description: 'Dry run, resolve DB and show details without writing', alias: 'd' })
  declare dryRun: boolean

  @flags.boolean({ description: 'Show preview only, do not import', alias: 'p' })
  declare preview: boolean

  @flags.boolean({ description: 'Proceed with creation without confirmation', alias: 'y' })
  declare yes: boolean

  @flags.number({ description: 'Hotel ID (default: 47 for Majeo)', alias: 'h' })
  declare hotelId: number

  @flags.number({ description: 'User ID to use as created_by', alias: 'u' })
  declare userId: number

  public async run() {
    const inputPath = this.filePath || path.resolve('data', 'client_data_tomigrate', 'majeo.json')
    const hotelId = this.hotelId || 47
    const userId = this.userId || 1

    if (!fs.existsSync(inputPath)) {
      this.logger.error(`File not found: ${inputPath}`)
      return
    }

    // Read and parse JSON
    const content = fs.readFileSync(inputPath, 'utf8')
    let reservations: MajeoReservation[]
    try {
      reservations = JSON.parse(content)
    } catch (err) {
      this.logger.error(`Invalid JSON: ${(err as Error).message}`)
      return
    }

    if (!Array.isArray(reservations) || reservations.length === 0) {
      this.logger.error('No reservations found in the JSON file.')
      return
    }

    // Filter only "Done" status
    const doneReservations = reservations.filter((r) => r.status === 'Done')
    const cancelledReservations = reservations.filter((r) => r.status === 'Cancel')
    const otherReservations = reservations.filter(
      (r) => r.status !== 'Done' && r.status !== 'Cancel'
    )

    if (doneReservations.length === 0) {
      this.logger.warning('No "Done" reservations found to import.')
      return
    }

    this.logger.info(
      `Found ${doneReservations.length} Done / ${cancelledReservations.length} Cancel / ${otherReservations.length} other reservation(s)`
    )

    // === INITIAL PREVIEW (from JSON only) ===
    this.logger.info('')
    this.logger.info('══════════════════════ PREVIEW ══════════════════════')
    this.logger.info(`Hotel ID: ${hotelId}`)
    this.logger.info(`Created by user ID: ${userId}`)
    this.logger.info('')

    for (const r of doneReservations) {
      const roomsStr = r.rooms
        .map((rm) => `${rm.name || '(no room)'} (${rm.check_in} → ${rm.check_out})`)
        .join(', ')
      this.logger.info(`  • ${r.id} | ${r.client} | ${r.guests} guest(s) | Rooms: ${roomsStr}`)
      if (r.documents.length > 0) {
        this.logger.info(`    Docs: ${r.documents.join(', ')}`)
      }
    }

    this.logger.info('')
    this.logger.info(`Total: ${doneReservations.length} reservation(s) to import`)

    if (this.preview) {
      this.logger.info('Preview only. Run without --preview to proceed.')
      return
    }

    if (!this.dryRun && !this.yes) {
      this.logger.warning('')
      this.logger.warning('Run with --yes to confirm import, or --dry-run to simulate.')
      return
    }

    // === RESOLVE DB DATA via app container ===
    this.logger.info('')
    this.logger.info('Resolving database data...')

    let allRooms: any[] = []
    let allRoomTypes: any[] = []
    let allRoomRates: any[] = []

    try {
      const RoomMod = await import('#models/room')
      const RoomTypeMod = await import('#models/room_type')
      const RoomRateMod = await import('#models/room_rate')

      const Room: any = (RoomMod as any).default ?? (RoomMod as any)
      const RoomType: any = (RoomTypeMod as any).default ?? (RoomTypeMod as any)
      const RoomRate: any = (RoomRateMod as any).default ?? (RoomRateMod as any)

      if (typeof Room?.query !== 'function') {
        throw new Error('Room model is not available in Ace runtime')
      }
      if (typeof RoomType?.query !== 'function') {
        throw new Error('RoomType model is not available in Ace runtime')
      }
      if (typeof RoomRate?.query !== 'function') {
        throw new Error('RoomRate model is not available in Ace runtime')
      }

      allRooms = await Room.query().where('hotel_id', hotelId)
      allRoomTypes = await RoomType.query().where('hotel_id', hotelId)
      allRoomRates = await RoomRate.query()
        .where('hotel_id', hotelId)
        .select('id', 'room_type_id', 'base_rate')
    } catch (err) {
      this.logger.error(`  → DB query error: ${(err as Error).message}`)
    }
    this.logger.info(`  → ${allRooms.length} rooms, ${allRoomTypes.length} room types, ${allRoomRates.length} room rates loaded`)

    // Build lookup maps
    const roomByNumber = new Map<string, any>()
    const roomByShortCode = new Map<string, any>()

    for (const room of allRooms) {
      // db.from() returns raw rows with snake_case keys
      const key = (room.room_number || room.roomNumber || '').toString().trim().toLowerCase()
      roomByNumber.set(key, room)
      if (room.short_code || room.shortCode) {
        roomByShortCode.set((room.short_code || room.shortCode).toString().trim().toLowerCase(), room)
      }
    }

    const roomTypeById = new Map<number, any>()
    const roomTypeByName = new Map<string, any>()

    for (const rt of allRoomTypes) {
      roomTypeById.set(rt.id, rt)
      const name = rt.roomTypeName || rt.room_type_name || ''
      if (name) {
        roomTypeByName.set(name.toString().trim().toLowerCase(), rt)
      }
    }

    const rateByRoomTypeId = new Map<number, any>()
    for (const rate of allRoomRates) {
      const rTypeId = rate.roomTypeId ?? rate.room_type_id
      if (rTypeId != null && !rateByRoomTypeId.has(rTypeId)) {
        rateByRoomTypeId.set(rTypeId, rate)
      }
    }

    // Helper: resolve room name to DB data
    function resolveRoom(roomName: string | null): ResolvedRoom {
      if (!roomName) {
        return {
          roomNumber: null,
          roomId: null,
          roomTypeId: null,
          roomTypeName: null,
          roomRateId: null,
          baseRate: null,
        }
      }

      const normalized = roomName.trim().toLowerCase()

      // Try exact roomNumber match
      const exactRoom = roomByNumber.get(normalized)
      if (exactRoom) {
        const rTypeId = exactRoom.roomTypeId ?? exactRoom.room_type_id
        const rt = rTypeId ? roomTypeById.get(rTypeId) : null
        const rate = rTypeId ? rateByRoomTypeId.get(rTypeId) : null
        return {
          roomNumber: exactRoom.roomNumber || exactRoom.room_number || null,
          roomId: exactRoom.id,
          roomTypeId: rTypeId || null,
          roomTypeName: rt?.roomTypeName || rt?.room_type_name || null,
          roomRateId: rate?.id ?? null,
          baseRate: toNullableNumber(rate?.baseRate ?? rate?.base_rate),
        }
      }

      // Try short code match
      const shortRoom = roomByShortCode.get(normalized)
      if (shortRoom) {
        const rTypeId = shortRoom.roomTypeId ?? shortRoom.room_type_id
        const rt = rTypeId ? roomTypeById.get(rTypeId) : null
        const rate = rTypeId ? rateByRoomTypeId.get(rTypeId) : null
        return {
          roomNumber: shortRoom.roomNumber || shortRoom.room_number || null,
          roomId: shortRoom.id,
          roomTypeId: rTypeId || null,
          roomTypeName: rt?.roomTypeName || rt?.room_type_name || null,
          roomRateId: rate?.id ?? null,
          baseRate: toNullableNumber(rate?.baseRate ?? rate?.base_rate),
        }
      }

      // Try splitting on '-' to get room number part (e.g., "A103" from "A103-HORIZON")
      const parts = roomName.split('-')
      if (parts.length >= 1) {
        const roomNumPart = parts[0].trim().toLowerCase()
        const roomByNumPart = roomByNumber.get(roomNumPart)
        if (roomByNumPart) {
          const rTypeId = roomByNumPart.roomTypeId ?? roomByNumPart.room_type_id
          const rt = rTypeId ? roomTypeById.get(rTypeId) : null
          const rate = rTypeId ? rateByRoomTypeId.get(rTypeId) : null
          return {
            roomNumber: roomByNumPart.roomNumber || roomByNumPart.room_number || null,
            roomId: roomByNumPart.id,
            roomTypeId: rTypeId || null,
            roomTypeName: rt?.roomTypeName || rt?.room_type_name || null,
            roomRateId: rate?.id ?? null,
            baseRate: toNullableNumber(rate?.baseRate ?? rate?.base_rate),
          }
        }

        // Try to match second+ parts as room type name (e.g., "HORIZON", "PINK BEACH")
        if (parts.length >= 2) {
          const roomTypePart = parts.slice(1).join('-').trim().toLowerCase()
          const rt = roomTypeByName.get(roomTypePart)
          if (rt) {
            const rate = rateByRoomTypeId.get(rt.id)
            return {
              roomNumber: null,
              roomId: null,
              roomTypeId: rt.id,
              roomTypeName: rt.roomTypeName || rt.room_type_name || null,
              roomRateId: rate?.id ?? null,
              baseRate: toNullableNumber(rate?.baseRate ?? rate?.base_rate),
            }
          }
        }
      }

      return {
        roomNumber: null,
        roomId: null,
        roomTypeId: null,
        roomTypeName: null,
        roomRateId: null,
        baseRate: null,
      }
    }

    const PaymentMethodMod = await import('#models/payment_method')
    const PaymentMethod: any = (PaymentMethodMod as any).default ?? (PaymentMethodMod as any)
    const cashPaymentMethod = await PaymentMethod.query()
      .where('hotel_id', hotelId)
      .where('is_active', true)
      .where('method_type', 'cash')
      .orderBy('is_default', 'desc')
      .orderBy('id', 'asc')
      .first()

    if (!cashPaymentMethod) {
      this.logger.error(`No active cash payment method found for hotel ${hotelId}.`)
      return
    }

    this.logger.info(
      `Cash payment method: ${cashPaymentMethod.methodName} (#${cashPaymentMethod.id})`
    )

    const ReservationMod = await import('#models/reservation')
    const Reservation: any = (ReservationMod as any).default ?? (ReservationMod as any)
    const doneReservationIds = doneReservations.map((reservation) => reservation.id)
    const existingReservations = await Reservation.query()
      .where('hotel_id', hotelId)
      .whereIn('reservation_number', doneReservationIds)
      .select('id', 'reservation_number')

    const existingReservationNumbers = new Set<string>(
      existingReservations
        .map((reservation: any) => String(reservation.reservationNumber ?? reservation.reservation_number ?? ''))
        .filter(Boolean)
    )

    const reservationsToImport = doneReservations.filter(
      (reservation) => !existingReservationNumbers.has(reservation.id)
    )

    this.logger.info(
      `Already in DB: ${existingReservationNumbers.size} | Missing to import: ${reservationsToImport.length}`
    )

    if (reservationsToImport.length > 0) {
      this.logger.info(`Missing reservation IDs: ${reservationsToImport.map((reservation) => reservation.id).join(', ')}`)
    }

    // === DRY-RUN: show detailed resolved data ===
    if (this.dryRun) {
      this.logger.info('')
      this.logger.info('══════════════════ DRY RUN DETAILS ══════════════════')

      for (const res of reservationsToImport) {
        this.logger.info('')
        this.logger.info(`── ${res.id} | ${res.client} ──`)

        for (const rm of res.rooms) {
          const resolved = resolveRoom(rm.name)
          const nights = calculateNightCount(rm.check_in, rm.check_out)

          const totalPrice = resolved.baseRate && nights > 0 ? resolved.baseRate * nights : null

          this.logger.info(`  Room name (JSON):    ${rm.name || '(none)'}`)
          this.logger.info(`  Room ID (DB):        ${resolved.roomId !== null ? resolved.roomId : '⚠ NOT FOUND'}`)
          this.logger.info(`  Room number (DB):    ${resolved.roomNumber || '—'}`)
          this.logger.info(`  Room type ID (DB):   ${resolved.roomTypeId !== null ? resolved.roomTypeId : '⚠ NOT FOUND'}`)
          this.logger.info(`  Room type name (DB): ${resolved.roomTypeName || '—'}`)
          this.logger.info(`  Room rate ID (DB):   ${resolved.roomRateId !== null ? resolved.roomRateId : '⚠ NOT FOUND'}`)
          this.logger.info(`  Base rate (DB):      ${resolved.baseRate !== null ? `${resolved.baseRate.toFixed(2)} XAF` : '—'}`)
          this.logger.info(`  Nights:              ${nights}`)
          this.logger.info(`  Est. total room:     ${totalPrice !== null ? `${totalPrice.toFixed(2)} XAF` : '—'}`)
          this.logger.info(`  Check in → out:      ${rm.check_in} → ${rm.check_out}`)
        }

        this.logger.info(`  Guests:              ${res.guests}`)
        this.logger.info(`  Documents:           ${res.documents.join(', ') || '—'}`)
      }

      this.logger.info('')
      this.logger.info(`Total missing: ${reservationsToImport.length} reservation(s) — dry run only, no data written.`)
      return
    }

    // === REAL IMPORT ===
    let created = 0
    let skipped = existingReservationNumbers.size
    let failed = 0

    if (reservationsToImport.length === 0) {
      this.logger.info('')
      this.logger.info('══════════════════════ RESULT ══════════════════════')
      this.logger.info(`Created: 0, Skipped: ${skipped}, Failed: 0`)
      this.logger.info('All Done reservations are already present in the database.')
      this.logger.info('══════════════════════════════════════════════════════')
      return
    }

    for (const res of reservationsToImport) {
      try {
        const { title, firstName, lastName } = parseGuestName(res.client)
        const roomData = res.rooms.map((rm) => {
          const resolved = resolveRoom(rm.name)
          const nights = calculateNightCount(rm.check_in, rm.check_out)
          return {
            room_type_id: resolved.roomTypeId || 0,
            room_id: resolved.roomId || null,
            room_rate_id: resolved.roomRateId || null,
            adult_count: res.guests || 1,
            child_count: 0,
            room_rate: resolved.baseRate || 0,
            checkin_date: rm.check_in,
            checkout_date: rm.check_out,
            nights,
          }
        })
        const validRoomData = roomData.filter((room) => room.room_type_id > 0)
        const estimatedTotal = validRoomData.reduce((sum, room) => {
          const nights = room.nights ?? 0
          return sum + (room.room_rate || 0) * (nights > 0 ? nights : 1)
        }, 0)

        const hasValidRoom = validRoomData.length > 0
        if (!hasValidRoom) {
          this.logger.warning(
            `[${res.id}] No matching room/room type found for "${res.rooms.map((r) => r.name).join(', ')}". Importing as reservation without room assignment.`
          )
        }

        const firstRoom = res.rooms[0]
        const lastRoom = res.rooms[res.rooms.length - 1]
        const arrivedDate = firstRoom?.check_in
        const departDate = lastRoom?.check_out

        if (!arrivedDate || !departDate) {
          this.logger.warning(`[${res.id}] Missing dates, skipping.`)
          skipped++
          continue
        }

        const creationData = {
          hotel_id: hotelId,
          arrived_date: arrivedDate,
          depart_date: departDate,
          created_by: userId,
          guest: {
            title,
            firstName,
            lastName,
            email: '',
            phone: '',
          },
          reservation_number: res.id,
          status: 'checked_out',
          payment_mod: cashPaymentMethod.id,
          payment_type: 'cash',
          total_amount: estimatedTotal,
          final_amount: estimatedTotal,
          paid_amount: estimatedTotal,
          remaining_amount: 0,
          special_requests: res.documents ? res.documents.join(' | ') : '',
          rooms: validRoomData,
        }

        const RcsMod = await import('#services/reservation_creation_service')
        const ReservationCreationService: any = (RcsMod as any).default ?? (RcsMod as any)
        const result = await ReservationCreationService.createReservation(creationData as any)

        if (result.success) {
          const FolioMod = await import('#models/folio')
          const ReservationMod = await import('#models/reservation')
          const FolioServiceMod = await import('#services/folio_service')
          const Folio: any = (FolioMod as any).default ?? (FolioMod as any)
          const Reservation: any = (ReservationMod as any).default ?? (ReservationMod as any)
          const FolioService: any = (FolioServiceMod as any).default ?? (FolioServiceMod as any)

          const folios = await Folio.query().where('reservation_id', result.reservationId)
          let settledAmount = 0

          for (const folio of folios) {
            const outstandingBalance = toNullableNumber(folio.balance) || 0
            if (outstandingBalance > 0) {
              await FolioService.settleFolio({
                folioId: folio.id,
                amount: outstandingBalance,
                paymentMethodId: cashPaymentMethod.id,
                reference: `MAJEO-${res.id}`,
                notes: `Auto-settlement during Majeo import for reservation ${res.id}`,
                settledBy: userId,
              })
              settledAmount += outstandingBalance
            }
          }

          const importedReservation = await Reservation.find(result.reservationId)
          if (importedReservation) {
            await importedReservation
              .merge({
                paymentStatus: 'paid',
                paymentMethodId: cashPaymentMethod.id,
                paymentType: 'cash',
                paidAmount: settledAmount,
                remainingAmount: 0,
                totalAmount:
                  importedReservation.totalAmount && importedReservation.totalAmount > 0
                    ? importedReservation.totalAmount
                    : settledAmount,
                finalAmount:
                  importedReservation.finalAmount && importedReservation.finalAmount > 0
                    ? importedReservation.finalAmount
                    : settledAmount,
              })
              .save()
          }

          this.logger.success(
            `Imported ${res.id} | ${res.client} | reservationId=${result.reservationId} | cash settled=${settledAmount.toFixed(2)}`
          )
          created++
        } else {
          this.logger.error(
            `Failed to import ${res.id} (${res.client}): ${result.message || result.error || 'unknown error'}`
          )
          failed++
        }
      } catch (err) {
        this.logger.error(`Failed to import ${res.id}: ${(err as Error).message}`)
        failed++
      }
    }

    this.logger.info('')
    this.logger.info('══════════════════════ RESULT ══════════════════════')
    this.logger.info(`Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`)
    this.logger.info('══════════════════════════════════════════════════════')
  }
}
