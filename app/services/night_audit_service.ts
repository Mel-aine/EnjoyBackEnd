import { DateTime } from 'luxon'
import DailySummaryFact from '#models/daily_summary_fact'
import FolioTransaction from '#models/folio_transaction'
import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'
import Room from '#models/room'
import RoomBlock from '#models/room_block'
import Folio from '#models/folio'
import PaymentMethod from '#models/payment_method'
import { TransactionType, TransactionCategory, ReservationStatus, TransactionStatus, FolioType, PaymentMethodType } from '#app/enums'
import LoggerService from '#services/logger_service'
import ReportsController from '#controllers/reports_controller'
import Hotel from '#models/hotel'
import PosService from '#services/pos_service'
import ReportsEmailService from './reports_email_service.js'
import LedgerService from '#services/ledger_service'

export interface NightAuditFilters {
  auditDate: DateTime
  hotelId: number
  userId?: number
  skipReport?: boolean
}

export interface NightAuditSummary {
  auditDate: DateTime
  hotelId: number

  // Revenue Fields
  totalRoomRevenue: number
  totalFoodBeverageRevenue: number
  totalMiscellaneousRevenue: number
  totalTaxes: number
  totalResortFees: number
  totalRevenue: number
  totalPayments: number
  totalDiscounts: number

  // Occupancy Fields
  occupiedRooms: number
  totalAvailableRooms: number
  occupancyRate: number
  revPAR: number // Revenue Per Available Room
  adr: number // Average Daily Rate

  // Guest Activity Fields
  numCheckedIn: number
  numCheckedOut: number
  numNoShows: number
  numCancellations: number
  numBookingsMade: number

  // Financial Fields
  totalPaymentsReceived: number
  totalAccountsReceivable: number
  totalOutstandingFolios: number
  totalOutstandingFoliosBalance: number

  // Ledger Closing Balances
  cityLedgerClosingBalance: number
  guestLedgerClosingBalance: number
  advanceDepositLedgerClosingBalance: number
}

export default class NightAuditService {
  private static toAuditDateValue(auditDate: DateTime): string {
    return auditDate.toISODate()!
  }

  /**
   * Update status of occupied rooms to dirty
   */
  private static async updateOccupiedRoomsToDirty(hotelId: number, auditDate: DateTime) {
    const auditDateStr = auditDate.toISODate()!

    // Find all occupied rooms (rooms with checked-in reservations overlapping the audit date)
    const occupiedRooms = await Room.query()
      .where('hotel_id', hotelId)
      .whereDoesntHave('roomType', (q) => q.where('is_paymaster', true))
      .whereHas('reservationRooms', (query) => {
        query.whereHas('reservation', (resQuery) => {
          resQuery.where('status', 'checked_in')
        })
          .where('check_in_date', '<=', auditDateStr)
          .where('check_out_date', '>=', auditDateStr)
      })

    if (occupiedRooms.length > 0) {
      const roomIds = occupiedRooms.map(r => r.id)
      await Room.query()
        .whereIn('id', roomIds)
        .update({
          housekeeping_status: 'dirty',
          updated_at: DateTime.now().toSQL()
        })

      console.log(`Updated ${occupiedRooms.length} occupied rooms to dirty status for audit date ${auditDateStr}`)
    }
  }

  /**
   * Calculate and store night audit data for a specific date
   */
  static async calculateNightAudit(filters: NightAuditFilters): Promise<NightAuditSummary> {
    const { auditDate, hotelId, userId } = filters

    // Update occupied rooms to dirty status
    await this.updateOccupiedRoomsToDirty(hotelId, auditDate)

    // Calculate all metrics in parallel for better performance
    const [
      revenueMetrics,
      occupancyMetrics,
      guestActivityMetrics,
      financialMetrics
    ] = await Promise.all([
      this.calculateRevenueMetrics(auditDate, hotelId),
      this.calculateOccupancyMetrics(auditDate, hotelId),
      this.calculateGuestActivityMetrics(auditDate, hotelId),
      this.calculateFinancialMetrics(auditDate, hotelId)
    ])

    const summary: NightAuditSummary = {
      auditDate,
      hotelId,
      ...revenueMetrics,
      ...occupancyMetrics,
      ...guestActivityMetrics,
      ...financialMetrics
    }

    // Generate all report data
    const reportsController = new ReportsController()
    const [sectionsData, nightAuditData, dailyRevenueData, roomStatusData, posNightAuditData] = await Promise.all([
      reportsController.generateManagementReportSections(hotelId, auditDate, 'XAF'),
      reportsController.generateNightAuditSections(hotelId, auditDate, 'XAF'),
      reportsController.getDailyRevenueData(hotelId, auditDate, []),
      reportsController.getRoomStatusReportData(hotelId, auditDate, 'XAF'),
      this.fetchPosNightAudit(hotelId, auditDate)
    ])

    // Merge POS data into the night audit report data, if available
    const nightAuditDataWithPos = {
      ...(nightAuditData || {}),
      posNightAudit: posNightAuditData || null,
    }
    const hotel = await Hotel.find(hotelId)
    // Store the calculated data with all report data
    await this.storeDailySummary(summary, userId, sectionsData, nightAuditDataWithPos, dailyRevenueData, roomStatusData)

    if (!filters.skipReport) {
      if (hotel) {
        hotel.lastNightAuditDate = DateTime.now();
        hotel.currentWorkingDate = DateTime.now().startOf('day')
        await hotel.save()
        const emailService = new ReportsEmailService()
        setImmediate(async () => {
          await emailService.sendDailyEmail(hotelId, hotel.currentWorkingDate?.toISODate()!)
        })
      }
    }

    return summary
  }

  /**
   * Fetch POS night audit details from external endpoint and return raw data
   * The returned payload is stored under DailySummaryFact.nightAuditReportData.posNightAudit
   */
  private static async fetchPosNightAudit(hotelId: number, auditDate: DateTime): Promise<any | null> {
    try {
      const hotel = await Hotel.find(hotelId)
      if (!hotel || !hotel.posApiKey) {
        return null
      }

      return await PosService.getNightAudit(hotelId, auditDate, hotel.posApiKey)
    } catch (err: any) {
      console.error('Error fetching POS night audit:', err?.message || err)
      return null
    }
  }

  /**
   * Calculate revenue-related metrics
   */
  private static async calculateRevenueMetrics(auditDate: DateTime, hotelId: number) {
    const startOfDay = auditDate
    const allowedReservationStatuses = [
      'checked_in',
      'checked_out',
      ReservationStatus.CONFIRMED,
    ]
    console.log('data', auditDate)
    // Get all transactions for the audit date
    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('current_working_date', startOfDay.toJSDate())
      .where('is_voided', false)
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.whereIn('status', allowedReservationStatuses)
          reservationQuery.whereDoesntHave('reservationRooms', (rr) => {
            rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
          })
        })
      })

    let totalRoomRevenue = 0
    let totalFoodBeverageRevenue = 0
    let totalMiscellaneousRevenue = 0
    let totalTaxes = 0
    let totalResortFees = 0
    let totalPayments = 0
    let totalDiscounts = 0

    for (const transaction of transactions) {
      const amount = Math.abs(transaction.roomFinalNetAmount || transaction.amount || 0)

      if (transaction.transactionType === TransactionType.CHARGE) {
        switch (transaction.category) {
          case TransactionCategory.ROOM:
            totalRoomRevenue += amount
            totalTaxes += Math.abs((transaction as any).roomFinalRateTaxe || 0)
            break
          case TransactionCategory.FOOD_BEVERAGE:
          case TransactionCategory.EXTRACT_CHARGE:
            totalFoodBeverageRevenue += amount
            totalResortFees += Math.abs((transaction as any).taxAmount || 0)
            break
          case TransactionCategory.TAX:
            totalTaxes += amount
            break
          case TransactionCategory.CITY_TAX:
            totalTaxes += amount
            break
          case TransactionCategory.RESORT_FEE:
            totalMiscellaneousRevenue += amount
            break
          case TransactionCategory.POSTING:
            totalResortFees += Number(amount)
            break
          default:
            totalMiscellaneousRevenue += amount
            break
        }
      } else if (transaction.transactionType === TransactionType.PAYMENT) {
        totalPayments += amount
      } else if (transaction.transactionType === TransactionType.DISCOUNT) {
        totalDiscounts += amount
      }
    }

    const totalRevenue = totalRoomRevenue + totalFoodBeverageRevenue + totalMiscellaneousRevenue

    return {
      totalRoomRevenue,
      totalFoodBeverageRevenue,
      totalMiscellaneousRevenue,
      totalTaxes,
      totalResortFees,
      totalRevenue,
      totalPayments,
      totalDiscounts
    }
  }

  /**
   * Calculate occupancy-related metrics
   */
  private static async calculateOccupancyMetrics(auditDate: DateTime, hotelId: number) {
    const allowedReservationStatuses = [
      'checked_in',
      'checked_out',
      ReservationStatus.CONFIRMED,
    ]

    // Get total available rooms
    const totalAvailableRooms = await Room.query()
      .where('hotel_id', hotelId)
      .where('status', '!=', 'out_of_order')
      .whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
      .count('* as total')
      .first()

    // Get blocked rooms count for the audit date that are not OOO
    const blockedRoomsResult = await RoomBlock.query()
      .where('hotel_id', hotelId)
      .whereNot('status', 'completed')
      .where('block_from_date', '<=', auditDate.toFormat('yyyy-MM-dd'))
      .where('block_to_date', '>=', auditDate.toFormat('yyyy-MM-dd'))
      .whereHas('room', (roomQuery) => {
        roomQuery.where('status', '!=', 'out_of_order')
        roomQuery.whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
      })
      .countDistinct('room_id as total')
      .first()

    const blockedRooms = Number(blockedRoomsResult?.$extras.total || 0)
    const totalRooms = Math.max(0, Number(totalAvailableRooms?.$extras.total || 0) - blockedRooms)

    // Get occupied rooms for the audit date
    const occupiedRoomsResult = await ReservationRoom.query()
      .where('check_in_date', '<=', auditDate.toJSDate())
      .where('check_out_date', '>', auditDate.toJSDate())
      .whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
      .whereHas('reservation', (reservationQuery) => {
        reservationQuery
          .where('hotel_id', hotelId)
          .whereIn('status', allowedReservationStatuses)
      })
      .countDistinct('room_id as occupied')
      .first()

    const occupiedRooms = Number(occupiedRoomsResult?.$extras.occupied || 0)
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

    // Calculate RevPAR and ADR
    const roomRevenueResult = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('current_working_date', auditDate.toJSDate())
      .where('category', TransactionCategory.ROOM)
      .where('transaction_type', TransactionType.CHARGE)
      .where('is_voided', false)
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.whereIn('status', allowedReservationStatuses)
          reservationQuery.whereDoesntHave('reservationRooms', (rr) => {
            rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
          })
        })
      })
      .sum('room_final_net_amount as total_room_revenue')
      .first()

    const totalRoomRevenue = Number(roomRevenueResult?.$extras.total_room_revenue || 0)
    const revPAR = totalRooms > 0 ? totalRoomRevenue / totalRooms : 0
    const adr = occupiedRooms > 0 ? totalRoomRevenue / occupiedRooms : 0

    return {
      occupiedRooms,
      totalAvailableRooms: totalRooms,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      revPAR: Math.round(revPAR * 100) / 100,
      adr: Math.round(adr * 100) / 100
    }
  }

  /**
   * Calculate guest activity metrics
   */
  private static async calculateGuestActivityMetrics(auditDate: DateTime, hotelId: number) {
    const auditDateJS = auditDate.toJSDate()

    // Check-ins for the audit date
    const checkedInResult = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('check_in_date', auditDateJS)
      .where('status', 'checked_in')
      .whereDoesntHave('reservationRooms', (rr) => {
        rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
      })
      .count('* as total')
      .first()

    // Check-outs for the audit date
    const checkedOutResult = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('check_out_date', auditDateJS)
      .where('status', 'checked_out')
      .whereDoesntHave('reservationRooms', (rr) => {
        rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
      })
      .count('* as total')
      .first()

    // No-shows for the audit date
    const noShowsResult = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('check_in_date', auditDateJS)
      .where('status', ReservationStatus.NOSHOW)
      .count('* as total')
      .first()

    // Cancellations for the audit date
    const cancellationsResult = await Reservation.query()
      .where('hotel_id', hotelId)
      .whereRaw('DATE(updated_at) = ?', [auditDate.toFormat('yyyy-MM-dd')])
      .where('status', ReservationStatus.CANCELLED)
      .count('* as total')
      .first()

    // New bookings made on the audit date
    const bookingsMadeResult = await Reservation.query()
      .where('hotel_id', hotelId)
      .whereRaw('DATE(created_at) = ?', [auditDate.toFormat('yyyy-MM-dd')])
      .whereDoesntHave('reservationRooms', (rr) => {
        rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
      })
      .count('* as total')
      .first()

    return {
      numCheckedIn: Number(checkedInResult?.$extras.total || 0),
      numCheckedOut: Number(checkedOutResult?.$extras.total || 0),
      numNoShows: Number(noShowsResult?.$extras.total || 0),
      numCancellations: Number(cancellationsResult?.$extras.total || 0),
      numBookingsMade: Number(bookingsMadeResult?.$extras.total || 0)
    }
  }

  /**
   * Calculate financial metrics
   */
  private static async calculateFinancialMetrics(auditDate: DateTime, hotelId: number) {
    const auditDateJS = auditDate.toJSDate()
    const allowedReservationStatuses = [
      'checked_in',
      'checked_out',
      ReservationStatus.CONFIRMED,
    ]

    // 1. Existing Metrics (Payments, Outstanding Folios, Accounts Receivable)
    // Total payments received on audit date
    const paymentsResult = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('current_working_date', auditDateJS)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .sum('amount as total')
      .first()

    // Outstanding folios and balances
    const outstandingFoliosResult = await Folio.query()
      .where('hotel_id', hotelId)
      .where('balance', '>', 0)
      .whereHas('reservation', (reservationQuery) => {
        reservationQuery.whereIn('status', allowedReservationStatuses)
        reservationQuery.whereDoesntHave('reservationRooms', (rr) => {
          rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
        })
      })
      .count('* as total_folios')
      .sum('balance as total_balance')
      .first()

    // Total accounts receivable (sum of all positive folio balances)
    const accountsReceivableResult = await Folio.query()
      .where('hotel_id', hotelId)
      .where('balance', '>', 0)
      .whereHas('reservation', (reservationQuery) => {
        reservationQuery.whereIn('status', allowedReservationStatuses)
        reservationQuery.whereDoesntHave('reservationRooms', (rr) => {
          rr.whereHas('roomType', (rt) => rt.where('is_paymaster', true))
        })
      })
      .sum('balance as total')
      .first()

    // 2. LEDGER CALCULATIONS (Delegated to LedgerService)
    const guestLedgerMetrics = await LedgerService.getGuestLedgerMetrics(hotelId, auditDate)
    const cityLedgerMetrics = await LedgerService.getCityLedgerMetrics(hotelId, auditDate)
    const adLedgerMetrics = await LedgerService.getAdvanceDepositLedgerMetrics(hotelId, auditDate)

    return {
      totalPaymentsReceived: Math.abs(Number(paymentsResult?.$extras.total || 0)),
      totalAccountsReceivable: Number(accountsReceivableResult?.$extras.total || 0),
      totalOutstandingFolios: Number(outstandingFoliosResult?.$extras.total_folios || 0),
      totalOutstandingFoliosBalance: Number(outstandingFoliosResult?.$extras.total_balance || 0),
      cityLedgerClosingBalance: cityLedgerMetrics.closingBalance,
      guestLedgerClosingBalance: guestLedgerMetrics.closingBalance,
      advanceDepositLedgerClosingBalance: adLedgerMetrics.closingBalance
    }
  }

  /**
   * Store the calculated daily summary
   */
  private static async storeDailySummary(
    summary: NightAuditSummary,
    userId?: number,
    managerReportData?: any,
    nightAuditReportData?: any,
    dailyRevenueReportData?: any,
    roomStatusReportData?: any
  ): Promise<DailySummaryFact> {
    // Check if record already exists for this date and hotel
    const existing = await DailySummaryFact.query()
      .where('audit_date', this.toAuditDateValue(summary.auditDate))
      .where('hotel_id', summary.hotelId)
      .first()

    const data = {
      auditDate: summary.auditDate,
      hotelId: summary.hotelId,
      totalRoomRevenue: summary.totalRoomRevenue,
      totalFoodBeverageRevenue: summary.totalFoodBeverageRevenue,
      totalMiscellaneousRevenue: summary.totalMiscellaneousRevenue,
      totalTaxes: summary.totalTaxes,
      totalResortFees: summary.totalResortFees,
      totalRevenue: summary.totalRevenue,
      totalPayments: summary.totalPayments,
      totalDiscounts: summary.totalDiscounts,
      occupiedRooms: summary.occupiedRooms,
      totalAvailableRooms: summary.totalAvailableRooms,
      occupancyRate: summary.occupancyRate,
      revPAR: summary.revPAR,
      adr: summary.adr,
      numCheckedIn: summary.numCheckedIn,
      numCheckedOut: summary.numCheckedOut,
      numNoShows: summary.numNoShows,
      numCancellations: summary.numCancellations,
      numBookingsMade: summary.numBookingsMade,
      totalPaymentsReceived: summary.totalPaymentsReceived,
      totalAccountsReceivable: summary.totalAccountsReceivable,
      totalOutstandingFolios: summary.totalOutstandingFolios,
      totalOutstandingFoliosBalance: summary.totalOutstandingFoliosBalance,
      cityLedgerClosingBalance: summary.cityLedgerClosingBalance,
      guestLedgerClosingBalance: summary.guestLedgerClosingBalance,
      advanceDepositLedgerClosingBalance: summary.advanceDepositLedgerClosingBalance,
      managerReportData: managerReportData,
      revenueByRateType: managerReportData?.revenueByRateType ?? null,
      revenueByRoomType: managerReportData?.revenueByRoomType ?? null,
      nightAuditReportData: nightAuditReportData,
      dailyRevenueReportData: dailyRevenueReportData,
      roomStatusReportData: roomStatusReportData,
      createdById: userId,
      modifiedById: userId
    }

    if (existing) {
      // Update existing record
      existing.merge(data)
      await existing.save()

      // Log the update if userId is provided
      if (userId) {
        await LoggerService.logActivity({
          userId: userId,
          action: 'UPDATE',
          resourceType: 'DailySummaryFact',
          resourceId: existing.hotelId,
          hotelId: summary.hotelId,
          details: {
            auditDate: summary.auditDate.toISODate(),
            totalRevenue: summary.totalRevenue,
            occupancyRate: summary.occupancyRate,
            occupiedRooms: summary.occupiedRooms
          }
        })
      }

      return existing
    } else {
      // Create new record
      const newRecord = await DailySummaryFact.create(data)

      // Log the creation if userId is provided
      if (userId) {
        await LoggerService.logActivity({
          userId: userId,
          action: 'CREATE',
          resourceType: 'DailySummaryFact',
          resourceId: newRecord.hotelId,
          hotelId: summary.hotelId,
          details: {
            auditDate: summary.auditDate.toISODate(),
            totalRevenue: summary.totalRevenue,
            occupancyRate: summary.occupancyRate,
            occupiedRooms: summary.occupiedRooms
          }
        })
      }

      return newRecord
    }
  }

  /**
   * Get night audit details for a specific date
   */
  static async getNightAuditDetails(auditDate: DateTime, hotelId: number): Promise<DailySummaryFact | null> {
    return await DailySummaryFact.query()
      .where('audit_date', this.toAuditDateValue(auditDate))
      .where('hotel_id', hotelId)
      .first()
  }

  /**
   * Get night audit history for a date range
   */
  static async getNightAuditHistory(
    hotelId: number,
    dateFrom: DateTime,
    dateTo: DateTime
  ): Promise<DailySummaryFact[]> {
    return await DailySummaryFact.query()
      .where('hotel_id', hotelId)
      .whereBetween('audit_date', [this.toAuditDateValue(dateFrom), this.toAuditDateValue(dateTo)])
      .orderBy('audit_date', 'desc')
  }

  /**
   * Delete night audit record for a specific date
   */
  static async deleteNightAudit(auditDate: DateTime, hotelId: number, userId?: number): Promise<boolean> {
    const auditDateValue = this.toAuditDateValue(auditDate)

    // Get the record before deletion for logging
    const recordToDelete = userId ? await DailySummaryFact.query()
      .where('audit_date', auditDateValue)
      .where('hotel_id', hotelId)
      .first() : null

    const deleted = await DailySummaryFact.query()
      .where('audit_date', auditDateValue)
      .where('hotel_id', hotelId)
      .delete()

    // Log the deletion if userId is provided and record was found
    if (userId && recordToDelete && deleted.length > 0) {
      await LoggerService.logActivity({
        userId: userId,
        action: 'DELETE',
        resourceType: 'DailySummaryFact',
        resourceId: recordToDelete.hotelId,
        hotelId: hotelId,
        details: {
          auditDate: auditDate.toISODate(),
          totalRevenue: recordToDelete.totalRevenue,
          occupancyRate: recordToDelete.occupancyRate,
          occupiedRooms: recordToDelete.occupiedRooms
        }
      })
    }

    return deleted.length > 0
  }

  /**
   * Get room status information for night audit
   */
  static async getRoomStatusForAudit(hotelId: number, auditDate: DateTime) {
    const auditDateStr = auditDate.toISODate()!

    // Get all rooms for the hotel with their current reservations
    const rooms = await Room.query()
      .where('hotel_id', hotelId)
      .where('is_deleted', false)
      //.whereDoesntHave('roomType', (rt) => rt.where('is_paymaster', true))
      .preload('roomType')
      .preload('reservationRooms', (reservationRoomQuery) => {
        reservationRoomQuery
          .where('status', '=', 'checked_in')
          .where('check_in_date', '<=', auditDateStr)
          .andWhere('check_out_date', '>=', auditDateStr)
          .preload('folios')
          .preload('reservation', (reservationQuery) => {
            reservationQuery
              .preload('guest')
              .preload('folios', (folioQuery) => {
                folioQuery.where('status', 'open')
              })
          })
      })
      .orderBy('sort_key', 'asc')
      .orderBy('floor_number', 'asc')
      .orderBy('room_number', 'asc')

    // Get reservations checking out today
    const checkOutToday = await Reservation.query()
      .where('hotel_id', hotelId)
      .whereIn('status', ['checked_in'])
      .preload('reservationRooms', (roomQuery) => {
        roomQuery
          .where('check_out_date', auditDateStr)
          .preload('room')
      })
      .preload('guest')
      .preload('folios', (folioQuery) => {
        folioQuery.where('status', 'open')
      })


    // Format room status data
    const roomStatusList = rooms.filter(room => room.reservationRooms.length > 0).map(room => {
      let roomStatus = 'Available'
      let currentReservation = null
      let guest = null
      let folio = null

      // Find active reservation for the audit date
      const activeReservationRoom = room.reservationRooms.find(resRoom => {
        const checkInDate = resRoom.checkInDate.toISODate()!;// DateTime.fromISO().toISODate()
        const checkOutDate = resRoom.checkOutDate.toISODate()!
        const reservation = resRoom.reservation

        // Check if reservation is checked in and overlaps with audit date
        if (reservation.status === 'checked_in') {
          // stayOver: checked in and checkout day is after the audit date
          if (checkOutDate > auditDateStr) {
            roomStatus = 'stayOver'
            return true
          }
          // due out: checked in and checkout day is the audit date
          else if (checkOutDate === auditDateStr) {
            roomStatus = 'due out'
            return true
          }
          // dayuse: checked in and check-in date = checkout date = audit date
          else if (checkInDate === checkOutDate && checkInDate === auditDateStr) {
            roomStatus = 'dayuse'
            return true
          }
        }
        // arrived: checked in and check-in date is the audit date
        else if (reservation.status === 'checked_in' && checkInDate === auditDateStr) {
          roomStatus = 'arrived'
          return true

        }

        return false
      })

      if (activeReservationRoom) {
        currentReservation = activeReservationRoom.reservation
        guest = currentReservation?.guest
        folio = currentReservation?.folios[0] ?? activeReservationRoom.folios[0]
      }

      // Determine if action is required (checkout date matches audit date)
      const isRequiredAction = activeReservationRoom ?
        activeReservationRoom.checkOutDate.toISODate() === auditDateStr : false

      return {
        reservation_id: currentReservation?.id,
        roomId: room.id,
        roomNumber: room.roomNumber,
        floorNumber: room.floorNumber,
        roomType: room.roomType?.roomTypeName || 'Unknown',
        status: roomStatus,
        housekeepingStatus: room.housekeepingStatus,
        isRequiredAction,
        guest: guest ? {
          id: guest.id,
          name: `${guest.displayName}`,
          email: guest.email,
          phone: guest.phonePrimary
        } : null,
        reservation: currentReservation ? {
          id: currentReservation.id,
          confirmationCode: currentReservation.confirmationCode,
          checkInDate: activeReservationRoom?.checkInDate,
          checkOutDate: activeReservationRoom?.checkOutDate,
          status: currentReservation.status
        } : null,
        folio: folio ? {
          id: folio.id,
          folioNumber: folio.folioNumber,
          balance: folio.balance,
          totalCharges: folio.totalCharges,
          totalPayments: folio.totalPayments
        } : null
      }
    })


    // Calculate summary statistics
    const totalRooms = rooms.length
    const stayOverRooms = roomStatusList.filter(room => room.status === 'stayOver').length
    const dueOutRooms = roomStatusList.filter(room => room.status === 'due out').length
    const dayUseRooms = roomStatusList.filter(room => room.status === 'dayuse').length
    const arrivedRooms = roomStatusList.filter(room => room.status === 'arrived').length
    const availableRooms = roomStatusList.filter(room => room.status === 'Available').length
    const occupiedRooms = stayOverRooms + dueOutRooms + dayUseRooms + arrivedRooms
    const checkOutsDue = checkOutToday.length

    return {
      auditDate: auditDateStr,
      hotelId,
      summary: {
        totalRooms,
        occupiedRooms,
        availableRooms,
        stayOverRooms,
        dueOutRooms,
        dayUseRooms,
        arrivedRooms,
        checkOutsDue,
        occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100 * 100) / 100 : 0
      },
      roomStatus: roomStatusList.filter(room => room.status !== 'Available'),
      nightlyCharges: {
        roomsRequiringCharges: occupiedRooms,
        estimatedCharges: occupiedRooms * 100 // This should be calculated based on actual room rates
      }
    }
  }

  /**
   * Get unsettled folios for night audit
   */
  static async getUnsettledFoliosForAudit(hotelId: number, auditDate: string) {
    void auditDate

    // Get all folios with outstanding balances for the hotel
    const unsettledFolios = await Folio.query()
      .where('hotel_id', hotelId)
      .where('balance', '>', 0)
      .whereHas('reservation', (reservationQuery) => {
        reservationQuery
          .where('hotel_id', hotelId)
          .whereIn('status', [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT])
      })
      .preload('reservation', (reservationQuery) => {
        reservationQuery.preload('guest')
      })
      .preload('transactions')
      .orderBy('created_at', 'desc')

    const formattedFolios = unsettledFolios.map(folio => ({
      folioId: folio.id,
      folioNumber: folio.folioNumber,
      reservationNumber: folio.reservation?.confirmationCode,
      guestName: folio.reservation?.guest ?
        `${folio.reservation.guest.firstName} ${folio.reservation.guest.lastName}` : 'N/A',
      balance: folio.balance,
      totalCharges: folio.totalCharges,
      totalPayments: folio.totalPayments,
      status: folio.status,
      createdAt: folio.createdAt,
      lastTransactionDate: folio.transactions?.length > 0 ?
        folio.transactions[folio.transactions.length - 1].createdAt : null
    }))

    return {
      unsettledFolios: formattedFolios,
      summary: {
        totalCount: formattedFolios.length,
        totalOutstandingAmount: formattedFolios.reduce((sum, folio) => sum + folio.balance, 0),
        averageBalance: formattedFolios.length > 0 ?
          formattedFolios.reduce((sum, folio) => sum + folio.balance, 0) / formattedFolios.length : 0
      }
    }
  }

  /**
   * Get pending nightly charges for occupied rooms that haven't been billed
   */
  static async getPendingNightlyCharges(hotelId: number, auditDate: string) {
    try {
      // Get all occupied rooms for the audit date with room rates from reservationRooms
      const occupiedRooms = await Reservation.query()
        .where('hotel_id', hotelId)
        .where('status', 'checked_in')
        .whereRaw('DATE(arrived_date) <= ?', [auditDate])
        .whereRaw('(DATE(depart_date) > ? OR depart_date IS NULL)', [auditDate])
        .preload('guest')
        .preload('folios')
        .preload('reservationRooms', (roomQuery) => {
          roomQuery.preload('room')
          roomQuery.preload('roomRates', (rateQuery) => {
            rateQuery.preload('rateType')
          })
        })

      // Get all existing pending room charges for the audit date in a single query
      const folioIds = occupiedRooms
        .flatMap(reservation => reservation.folios?.map(folio => folio.id) || [])
        .filter(Boolean)

      const pendingCharges = folioIds.length > 0 ? await FolioTransaction.query()
        .whereIn('folio_id', folioIds)
        .where('transaction_type', TransactionType.CHARGE)
        .where('status', TransactionStatus.PENDING)
        .whereRaw('DATE(current_working_date) = ?', [auditDate])
        .preload('folio', (folioQuery: any) => {
          folioQuery.preload('reservation', (reservationQuery: any) => {
            reservationQuery.preload('guest')
            reservationQuery.preload('reservationRooms', (roomQuery: any) => {
              roomQuery.preload('room', (roomDetailQuery: any) => {
                roomDetailQuery.preload('roomType')
              })
              roomQuery.preload('roomRates', (rateQuery: any) => {
                rateQuery.preload('rateType')
              })
            })
          })
        }) : []

      // Create a Map for faster lookup of pending charges by folio ID
      const pendingChargesByFolio = new Map()
      pendingCharges.forEach(charge => {
        if (!pendingChargesByFolio.has(charge.folioId)) {
          pendingChargesByFolio.set(charge.folioId, [])
        }
        pendingChargesByFolio.get(charge.folioId).push(charge)
      })

      const chargeData = []
      let totalAmount = 0
      let totalRooms = 0

      for (const reservation of occupiedRooms) {
        if (!reservation.folios || reservation.folios.length === 0) continue

        // Use the first folio for the reservation
        const folio = reservation.folios[0]

        // Only include reservations that have pending room charges
        if (!pendingChargesByFolio.has(folio.id)) continue

        const folioTransactions = pendingChargesByFolio.get(folio.id)

        // Process each pending folio transaction
        for (const transaction of folioTransactions) {
          // Find the corresponding reservation room for this transaction
          const reservationRoom = reservation.reservationRooms.find(rr =>
            rr.room?.roomNumber === transaction.description?.match(/Room (\d+)/)?.[1] ||
            rr.id === transaction.reservationRoomId
          ) || reservation.reservationRooms[0]// fallback to first room

          const transactionData = {
            transaction_id: transaction.id,
            reservation_id: reservation.id,
            reservation_number: reservation.reservationNumber,
            folio_id: folio.id,
            reservation_room_id: reservationRoom?.id,
            room_number: reservationRoom?.room?.roomNumber,
            guest_name: `${reservation.guest?.displayName}`,
            room_type: reservationRoom?.room?.roomType?.roomTypeName,
            rate_type: reservationRoom?.roomRates?.rateType?.rateTypeName,
            rate: transaction.amount,
            charge_date: auditDate,
            transaction_date: transaction.transactionDate,
            description: transaction.description,
            transaction_type: transaction.transactionType,
            transaction_status: transaction.status,
            reference: transaction.reference,
            check_in_date: reservationRoom?.checkInDate,
            check_out_date: reservationRoom?.checkOutDate,
          }

          chargeData.push(transactionData)
          totalAmount += transaction.amount
          totalRooms++
        }
      }

      return {
        pending_charges: chargeData,
        summary: {
          total_rooms: totalRooms,
          total_amount: totalAmount,
          audit_date: auditDate,
          hotel_id: hotelId
        }
      }
    } catch (error) {
      console.error('Error getting pending nightly charges:', error)
      throw new Error(`Failed to get pending nightly charges: ${error.message}`)
    }
  }

  /**
   * Get pending reservations for night audit
   */
  static async getPendingReservations(hotelId: number, auditDate: string) {
    try {
      // Get all reservations with check-in/depart date matching audit date, selecting only needed fields
      const pendingReservations = await Reservation.query()
        .select(['id', 'hotel_id', 'guest_id', 'isGroup', 'arrived_date', 'reservationTypeId', 'depart_date', 'status', 'confirmation_number'])
        .where('hotel_id', hotelId)
        .where((query) => {
          query.where('arrived_date', '=', auditDate).orWhere('depart_date', '=', auditDate)
        })
        .whereIn('status', [ReservationStatus.CONFIRMED, ReservationStatus.PENDING])
        .preload('guest', (guestQuery) => {
          guestQuery.select(['id', 'firstName', "lastName", 'title'])
        })
        .preload('folios', (folioQuery) => {
          folioQuery.select(['id', 'balance', 'total_payments'])
        })
        .preload('reservationType', (typeQuery) => {
          typeQuery.select(['id', 'name'])
        })
        .preload('reservationRooms', (roomQuery) => {
          roomQuery
            .select(['id', 'room_id', 'status', 'check_in_date', 'check_out_date', 'roomRateId'])
            .whereIn('status', [ReservationStatus.CONFIRMED, ReservationStatus.PENDING, 'reserved'])
            .preload('room', (rQuery) => {
              rQuery
                .select(['id', 'room_number', 'room_type_id', 'sort_key'])
                .preload('roomType', (rtQuery) => {
                  rtQuery.select(['id', 'room_type_name'])
                })
            })
            .preload('roomRates', (rateQuery) => {
              rateQuery
                .select(['id', 'rate_type_id'])
                .preload('rateType', (rtQuery) => {
                  rtQuery.select(['id', 'rate_type_name'])
                })
            })
        })
        .orderBy('arrived_date', 'asc')

      const pendingReservationEntries: Array<{
        sortKey: number
        roomNumber: string
        data: any
      }> = []
      let totalReservations = 0
      let totalAmount = 0
      let totalDeposit = 0

      for (const reservation of pendingReservations) {
        for (const reservationRoom of reservation.reservationRooms) {
          // Calculate total folio balance
          const totalBalance = reservation.folios?.reduce((sum, folio) => sum + (Number(folio.balance) || 0), 0) || 0
          // Calculate deposit amount (payments made)
          const depositAmount = reservation.folios?.reduce((sum, folio) => {
            return sum + (Number(folio.totalPayments) || 0)
          }, 0) || 0

          const reservationData = {
            reservation_id: reservation.id,
            confirmation_number: reservation.confirmationNumber || reservation.id.toString(),
            guest_name: `${reservation.guest?.displayName}`,
            room_number: reservationRoom.room?.roomNumber,
            room_type: reservationRoom.room?.roomType,
            rate_type: reservationRoom.roomRates?.rateType?.rateTypeName,
            reservation_type: reservation.reservationType?.name,
            scheduled_arrival: reservationRoom.checkInDate,
            departure: reservationRoom.checkOutDate,
            total_amount: Math.abs(totalBalance),
            deposit_amount: depositAmount,
            status: reservationRoom.status,
          }
          pendingReservationEntries.push({
            sortKey: Number(reservationRoom.room?.sortKey || 0),
            roomNumber: String(reservationRoom.room?.roomNumber || ''),
            data: reservationData,
          })
          totalReservations++
          totalAmount += Math.abs(totalBalance)
          totalDeposit += depositAmount
        }
      }

      pendingReservationEntries.sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' })
      })

      return {
        pending_reservations: pendingReservationEntries.map((e) => e.data),
        summary: {
          total_reservations: totalReservations,
          total_amount: totalAmount,
          total_deposit: totalDeposit,
          audit_date: auditDate,
          hotel_id: hotelId
        }
      }
    } catch (error) {
      console.error('Error getting pending reservations:', error)
      throw new Error(`Failed to get pending reservations: ${error.message}`)
    }
  }
  /**
   * Post nightly charges for night audit
   */
  static async postNightlyCharges(hotelId: number, auditDate: string, charges: any[], userId?: number) {
    const postedCharges = []
    const errors = []
    const logEntries = []

    for (const charge of charges) {
      try {
        // Find existing folio transaction using folio_id and charge_date
        const existingTransaction = await FolioTransaction.query()
          .where('folio_id', charge.folioId)
          .where('hotel_id', hotelId)
          .whereRaw('DATE(current_working_date) = ?', [auditDate])
          .andWhere('transaction_type', TransactionType.CHARGE)
          .where('is_voided', false)
          .update({
            status: TransactionStatus.POSTED,
          })



        postedCharges.push({
          folioId: charge.folio_id,
          transactionId: existingTransaction.map((sp: any) => sp.id),
          amount: charge.amount,
          chargeType: charge.chargeType,
          chargeDate: charge.charge_date,
          status: 'Updated'
        })

        // Prepare log entry for bulk logging
        if (userId) {
          logEntries.push({
            actorId: userId,
            action: 'UPDATE',
            resourceType: 'FolioTransaction',
            entityType: 'FolioTransaction',
            resourceId: charge.folioId,
            entityId: charge.folioId,
            hotelId: hotelId,
            details: {
              folioId: charge.folio_id,
              transactionType: TransactionType.CHARGE,
              oldAmount: charge.amount,
              newAmount: charge.amount,
              chargeType: charge.chargeType,
              chargeDate: charge.charge_date,
              auditDate: auditDate,
            }
          })
        }

      } catch (error) {
        errors.push({
          folioId: charge.folio_id || 'unknown',
          chargeDate: charge.charge_date || 'unknown',
          error: error.message
        })
      }
    }

    // Bulk log all successful transactions
    if (userId && logEntries.length > 0) {
      await LoggerService.bulkLog(logEntries)
    }

    return {
      postedCharges,
      errors,
      summary: {
        totalCharges: charges.length,
        successfulPosts: postedCharges.length,
        failedPosts: errors.length,
        totalAmount: postedCharges.reduce((sum, charge) => sum + charge.amount, 0)
      }
    }
  }
}
