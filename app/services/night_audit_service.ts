import { DateTime } from 'luxon'
import DailySummaryFact from '#models/daily_summary_fact'
import FolioTransaction from '#models/folio_transaction'
import Reservation from '#models/reservation'
import Room from '#models/room'
import Folio from '#models/folio'
import Database from '@adonisjs/lucid/services/db'
import { TransactionType, TransactionCategory, ReservationStatus, TransactionStatus } from '#app/enums'
import LoggerService from '#services/logger_service'

export interface NightAuditFilters {
  auditDate: DateTime
  hotelId: number
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
}

export default class NightAuditService {
  /**
   * Calculate and store night audit data for a specific date
   */
  static async calculateNightAudit(filters: NightAuditFilters): Promise<NightAuditSummary> {
    const { auditDate, hotelId } = filters

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

    // Store the calculated data
    await this.storeDailySummary(summary)

    return summary
  }

  /**
   * Calculate revenue-related metrics
   */
  private static async calculateRevenueMetrics(auditDate: DateTime, hotelId: number) {
    const startOfDay = auditDate.startOf('day')
    const endOfDay = auditDate.endOf('day')

    // Get all transactions for the audit date
    const transactions = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereBetween('transaction_date', [startOfDay.toJSDate(), endOfDay.toJSDate()])
      .where('is_voided', false)

    let totalRoomRevenue = 0
    let totalFoodBeverageRevenue = 0
    let totalMiscellaneousRevenue = 0
    let totalTaxes = 0
    let totalResortFees = 0
    let totalPayments = 0
    let totalDiscounts = 0

    for (const transaction of transactions) {
      const amount = Math.abs(transaction.amount || 0)

      if (transaction.transactionType === TransactionType.CHARGE) {
        switch (transaction.category) {
          case TransactionCategory.ROOM:
            totalRoomRevenue += amount
            break
          case TransactionCategory.FOOD_BEVERAGE:
            totalFoodBeverageRevenue += amount
            break
          case TransactionCategory.TAX:
          case TransactionCategory.CITY_TAX:
            totalTaxes += amount
            break
          case TransactionCategory.RESORT_FEE:
            totalResortFees += amount
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
    // Get total available rooms
    const totalAvailableRooms = await Room.query()
      .where('hotel_id', hotelId)
      .where('status', '!=', 'out_of_order')
      .count('* as total')
      .first()

    const totalRooms = Number(totalAvailableRooms?.$extras.total || 0)

    // Get occupied rooms for the audit date
    const occupiedRoomsResult = await Database.from('reservations')
      .join('reservation_rooms', 'reservations.id', 'reservation_rooms.reservation_id')
      .where('reservations.hotel_id', hotelId)
      .where('reservations.status', ReservationStatus.CHECKED_IN)
      .where('reservations.check_in_date', '<=', auditDate.toJSDate())
      .where('reservations.check_out_date', '>', auditDate.toJSDate())
      .countDistinct('reservation_rooms.room_id as occupied')
      .first()

    const occupiedRooms = Number(occupiedRoomsResult?.occupied || 0)
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0

    // Calculate RevPAR and ADR
    const roomRevenueResult = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('transaction_date', auditDate.toJSDate())
      .where('category', TransactionCategory.ROOM)
      .where('transaction_type', TransactionType.CHARGE)
      .where('is_voided', false)
      .sum('amount as total_room_revenue')
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
      .where('status', ReservationStatus.CHECKED_IN)
      .count('* as total')
      .first()

    // Check-outs for the audit date
    const checkedOutResult = await Reservation.query()
      .where('hotel_id', hotelId)
      .where('check_out_date', auditDateJS)
      .where('status', ReservationStatus.CHECKED_OUT)
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

    // Total payments received on audit date
    const paymentsResult = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('transaction_date', auditDateJS)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .sum('amount as total')
      .first()

    // Outstanding folios and balances
    const outstandingFoliosResult = await Database.from('folios')
      .where('hotel_id', hotelId)
      .where('balance', '>', 0)
      .select(
        Database.raw('COUNT(*) as total_folios'),
        Database.raw('SUM(balance) as total_balance')
      )
      .first()

    // Total accounts receivable (sum of all positive folio balances)
    const accountsReceivableResult = await Folio.query()
      .where('hotel_id', hotelId)
      .where('balance', '>', 0)
      .sum('balance as total')
      .first()

    return {
      totalPaymentsReceived: Math.abs(Number(paymentsResult?.$extras.total || 0)),
      totalAccountsReceivable: Number(accountsReceivableResult?.$extras.total || 0),
      totalOutstandingFolios: Number(outstandingFoliosResult?.total_folios || 0),
      totalOutstandingFoliosBalance: Number(outstandingFoliosResult?.total_balance || 0)
    }
  }

  /**
   * Store the calculated daily summary
   */
  private static async storeDailySummary(summary: NightAuditSummary, userId?: number): Promise<DailySummaryFact> {
    // Check if record already exists for this date and hotel
    const existing = await DailySummaryFact.query()
      .where('audit_date', summary.auditDate.toJSDate())
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
      totalOutstandingFoliosBalance: summary.totalOutstandingFoliosBalance
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
          resourceId: existing.id,
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
          resourceId: newRecord.id,
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
      .where('audit_date', auditDate.toJSDate())
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
      .whereBetween('audit_date', [dateFrom.toJSDate(), dateTo.toJSDate()])
      .orderBy('audit_date', 'desc')
  }

  /**
   * Delete night audit record for a specific date
   */
  static async deleteNightAudit(auditDate: DateTime, hotelId: number, userId?: number): Promise<boolean> {
    // Get the record before deletion for logging
    const recordToDelete = userId ? await DailySummaryFact.query()
      .where('audit_date', auditDate.toISODate()!)
      .where('hotel_id', hotelId)
      .first() : null

    const deleted = await DailySummaryFact.query()
      .where('audit_date', auditDate.toISODate()!)
      .where('hotel_id', hotelId)
      .delete()

    // Log the deletion if userId is provided and record was found
    if (userId && recordToDelete && deleted > 0) {
      await LoggerService.logActivity({
        userId: userId,
        action: 'DELETE',
        resourceType: 'DailySummaryFact',
        resourceId: recordToDelete.id,
        hotelId: hotelId,
        details: {
          auditDate: auditDate.toISODate(),
          totalRevenue: recordToDelete.totalRevenue,
          occupancyRate: recordToDelete.occupancyRate,
          occupiedRooms: recordToDelete.occupiedRooms
        }
      })
    }

    return deleted > 0
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
      .preload('roomType')
      .preload('reservationRooms', (reservationRoomQuery) => {
        reservationRoomQuery
          .where('status', '=', 'checked_in')
          .where('check_in_date' ,'<=', auditDateStr)
          .andWhere('check_out_date', '>=', auditDateStr)
          .preload('reservation', (reservationQuery) => {
            reservationQuery
              .preload('guest')
              .preload('folios', (folioQuery) => {
                folioQuery.where('status', 'open')
              })
          })
      })
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
        const checkInDate = DateTime.fromISO(resRoom.checkInDate).toISODate()
        const checkOutDate = DateTime.fromISO(resRoom.checkOutDate).toISODate()
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
        folio = currentReservation?.folios[0]
      }

      // Determine if action is required (checkout date matches audit date)
      const isRequiredAction = activeReservationRoom ? 
        DateTime.fromISO(activeReservationRoom.checkOutDate).toISODate() === auditDateStr : false

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
    ///const auditDateTime = DateTime.fromISO(auditDate)

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
        .whereRaw('DATE(transaction_date) = ?', [auditDate])
        .preload('folio', (folioQuery) => {
          folioQuery.preload('reservation', (reservationQuery) => {
            reservationQuery.preload('guest')
            reservationQuery.preload('reservationRooms', (roomQuery) => {
              roomQuery.preload('room', (roomDetailQuery) => {
                roomDetailQuery.preload('roomType')
              })
              roomQuery.preload('roomRates', (rateQuery) => {
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
            rate_type: reservationRoom?.roomRates.rateType.rateTypeName,
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
      // Get all reservations with check-in date matching audit date but not yet checked in
      const pendingReservations = await Reservation.query()
        .where('hotel_id', hotelId)
        .where('arrived_date', '=', auditDate)
        .orWhere('depart_date', '=', auditDate)
        .whereIn('status', [ReservationStatus.CONFIRMED, ReservationStatus.PENDING])
        .preload('guest')
        .preload('folios')
        .preload('reservationRooms', (roomQuery) => {
          roomQuery.whereIn('status',[ReservationStatus.CONFIRMED, ReservationStatus.PENDING,'reserved'])
          roomQuery.preload('room')
          roomQuery.preload('roomRates', (rateQuery) => {
            rateQuery.preload('rateType')
          })
        })
        .preload('bookingSource')
        .orderBy('arrived_date', 'asc')

      const pendingReservationsList = []
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
            reservation_type: reservation.reservationType,
            scheduled_arrival: reservationRoom.checkInDate,
            departure: reservationRoom.checkOutDate,
            total_amount: Math.abs(totalBalance),
            deposit_amount: depositAmount,
            status: reservationRoom.status,
          }
          pendingReservationsList.push(reservationData)
          totalReservations++
          totalAmount += Math.abs(totalBalance)
          totalDeposit += depositAmount
        }
      }

      return {
        pending_reservations: pendingReservationsList,
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
          .whereRaw('DATE(transaction_date) = ?', [auditDate])
          .andWhere('transaction_type', TransactionType.CHARGE)
          .where('is_voided', false)
          .first()

        if (!existingTransaction) {
          errors.push({
            folioId: charge.folioId,
            chargeDate: auditDate,
            error: 'Existing transaction not found for update'
          })
          continue
        }

        // Get the folio to update balance
        const folio = await Folio.findOrFail(charge.folioId)
        
        // Calculate the difference for balance adjustment
        const amountDifference = charge.amount - existingTransaction.amount

        // Update the existing transaction
        await existingTransaction.merge({
          amount: charge.amount,
          description: charge.description,
          status: TransactionStatus.POSTED,
        }).save()

        // Update folio balance with the difference
        await folio.merge({
          totalCharges: folio.totalCharges + amountDifference,
          balance: folio.balance + amountDifference,
        }).save()

        postedCharges.push({
          folioId: charge.folio_id,
          transactionId: existingTransaction.id,
          amount: charge.amount,
          chargeType: charge.chargeType,
          chargeDate: charge.charge_date,
          status: 'Updated'
        })

        // Prepare log entry for bulk logging
        if (userId) {
          logEntries.push({
            userId: userId,
            action: 'UPDATE',
            resourceType: 'FolioTransaction',
            resourceId: existingTransaction.id,
            hotelId: hotelId,
            details: {
              folioId: charge.folio_id,
              transactionType: TransactionType.CHARGE,
              oldAmount: existingTransaction.amount,
              newAmount: charge.amount,
              amountDifference: amountDifference,
              chargeType: charge.chargeType,
              chargeDate: charge.charge_date,
              auditDate: auditDate,
              reference: existingTransaction.reference
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