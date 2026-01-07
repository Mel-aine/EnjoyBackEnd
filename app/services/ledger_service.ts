import { DateTime } from 'luxon'
import DailySummaryFact from '#models/daily_summary_fact'
import FolioTransaction from '#models/folio_transaction'
import Folio from '#models/folio'
import PaymentMethod from '#models/payment_method'
import { TransactionType, PaymentMethodType, FolioType, TransactionCategory } from '#app/enums'

export interface LedgerMetrics {
  openingBalance: number
  closingBalance: number
  [key: string]: number
}

export default class LedgerService {
  /**
   * Get Opening Balance from DailySummaryFact (Previous Day Closing)
   */
  static async getOpeningBalance(
    hotelId: number,
    date: DateTime,
    field: 'cityLedgerClosingBalance' | 'guestLedgerClosingBalance' | 'advanceDepositLedgerClosingBalance'
  ): Promise<number | null> {
    const previousDayDate = date.minus({ days: 1 }).toISODate()
    const previousSummary = await DailySummaryFact.query()
      .where('hotel_id', hotelId)
      .where('audit_date', previousDayDate!)
      .first()

    return previousSummary ? Number(previousSummary[field]) : null
  }

  /**
   * Calculate Guest Ledger Metrics for a specific date
   */
  static async getGuestLedgerMetrics(hotelId: number, date: DateTime): Promise<LedgerMetrics> {
    const dateJS = date.toJSDate()

    // 1. Opening Balance
    let openingBalance = await this.getOpeningBalance(hotelId, date, 'guestLedgerClosingBalance')

    // Identify Guest Folios
    const guestFolios = await Folio.query()
      .where('hotel_id', hotelId)
      .where('folio_type', FolioType.GUEST)
    const guestFolioIds = guestFolios.map((f) => f.id)

    // Fallback Opening Balance Calculation
    if (openingBalance === null) {
      const result = await FolioTransaction.query()
        .where('hotel_id', hotelId)
        .whereIn('folio_id', guestFolioIds)
        .where('current_working_date', '<', date.toISODate()!)
        .where('is_voided', false)
        .sum('amount as total')
        .first()
      openingBalance = Number(result?.$extras.total || 0)
    }

    if (guestFolioIds.length === 0) {
      return {
        openingBalance,
        charges: 0,
        settlements: 0,
        transfers: 0,
        closingBalance: openingBalance
      }
    }

    const cityLedgerPaymentMethods = await PaymentMethod.query()
      .where('hotel_id', hotelId)
      .where('method_type', PaymentMethodType.CITY_LEDGER)
      .where('is_active', true)
    const cityLedgerPaymentMethodIds = cityLedgerPaymentMethods.map((pm) => pm.id)

    // Charges
    const chargesBase = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('folio_id', guestFolioIds)
      .whereIn('transaction_type', [TransactionType.CHARGE, TransactionType.ROOM_POSTING])
      .where('current_working_date', dateJS)
      .where('is_voided', false)
      .sum('amount as total')
      .first()

    const taxesOnCharges = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('folio_id', guestFolioIds)
      .whereIn('transaction_type', [TransactionType.CHARGE, TransactionType.ROOM_POSTING])
      .where('current_working_date', dateJS)
      .where('is_voided', false)
      .sum('tax_amount as total')
      .first()

    const totalCharges = Number(chargesBase?.$extras.total || 0) + Number(taxesOnCharges?.$extras.total || 0)

    // Settlements
    const settlementsResult = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('folio_id', guestFolioIds)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_advance_deposit', false)
      .where('current_working_date', dateJS)
      .where('is_voided', false)
      .whereNotIn('payment_method_id', cityLedgerPaymentMethodIds)
      .sum('amount as total')
      .first()
    const settlements = Math.abs(Number(settlementsResult?.$extras.total || 0))

    // Transfers from AD
    const adTransfersResult = await FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('folio_id', guestFolioIds)
      .where('transaction_type', TransactionType.TRANSFER)
      .where('is_transfer_from_advance_deposit', true)
      .where('current_working_date', dateJS)
      .where('is_voided', false)
      .sum('amount as total')
      .first()
    const adTransfers = Math.abs(Number(adTransfersResult?.$extras.total || 0))

    const closingBalance = openingBalance + totalCharges - settlements - adTransfers

    return {
      openingBalance,
      charges: totalCharges,
      settlements,
      transfers: adTransfers,
      closingBalance
    }
  }

  /**
   * Calculate Advance Deposit Ledger Metrics for a specific date
   */
  static async getAdvanceDepositLedgerMetrics(hotelId: number, date: DateTime): Promise<LedgerMetrics> {
    const dateJS = date.toJSDate()

    // 1. Opening Balance
    let openingBalance = await this.getOpeningBalance(hotelId, date, 'advanceDepositLedgerClosingBalance')

    // Fallback Opening Balance
    if (openingBalance === null) {
      openingBalance =
        (await this.getAdvanceDepositsCollected(hotelId, null, date)) -
        (await this.getAdvanceDepositTransfers(hotelId, null, date))
    }

    // Deposits Collected
    const deposits = await this.getAdvanceDepositsCollected(hotelId, date, date)

    // Transfers
    const transfers = await this.getAdvanceDepositTransfers(hotelId, date, date)

    const closingBalance = openingBalance + deposits - transfers

    return {
      openingBalance,
      deposits,
      transfers,
      closingBalance
    }
  }

  /**
   * Helper: Get Advance Deposits Collected
   * Logic: Payments made before check-in date
   */
  static async getAdvanceDepositsCollected(hotelId: number, startDate: DateTime | null, endDate: DateTime): Promise<number> {
    const query = FolioTransaction.query()
      .join('folios', 'folios.id', 'folio_transactions.folio_id')
      .join('reservation_rooms', 'reservation_rooms.id', 'folios.reservation_room_id')
      .where('folio_transactions.hotel_id', hotelId)
      .where('folio_transactions.transaction_type', TransactionType.PAYMENT)
      .where('folio_transactions.is_voided', false)
      .whereRaw('folio_transactions.current_working_date < reservation_rooms.check_in_date')
      .whereRaw('reservation_rooms.room_type_id NOT IN (SELECT id FROM room_types WHERE is_paymaster = true)')

    if (startDate) {
      query.whereBetween('folio_transactions.current_working_date', [startDate.toISODate()!, endDate.toISODate()!])
    } else {
      query.where('folio_transactions.current_working_date', '<', endDate.toISODate()!)
    }

    const result = await query.sum('folio_transactions.amount as total').first()
    return Math.abs(Number(result?.$extras.total || 0))
  }

  /**
   * Helper: Get Advance Deposit Transfers (to Guest Ledger)
   * Logic: Advance deposits for guests checking in during the period
   */
  static async getAdvanceDepositTransfers(hotelId: number, startDate: DateTime | null, endDate: DateTime): Promise<number> {
    const query = FolioTransaction.query()
      .join('folios', 'folios.id', 'folio_transactions.folio_id')
      .join('reservation_rooms', 'reservation_rooms.id', 'folios.reservation_room_id')
      .where('folio_transactions.hotel_id', hotelId)
      .where('folio_transactions.transaction_type', TransactionType.PAYMENT)
      .where('folio_transactions.is_voided', false)
      .whereRaw('folio_transactions.current_working_date < reservation_rooms.check_in_date')
      .whereRaw('reservation_rooms.room_type_id NOT IN (SELECT id FROM room_types WHERE is_paymaster = true)')

    if (startDate) {
      query.whereBetween('reservation_rooms.check_in_date', [startDate.toISODate()!, endDate.toISODate()!])
    } else {
      query.where('reservation_rooms.check_in_date', '<', endDate.toISODate()!)
    }

    const result = await query.sum('folio_transactions.amount as total').first()
    return Math.abs(Number(result?.$extras.total || 0))
  }

  /**
   * Helper: Get City Ledger Transfers (New Debt)
   */
  static async getCityLedgerTransfers(hotelId: number, startDate: DateTime | null, endDate: DateTime): Promise<number> {
    const cityLedgerPaymentMethods = await PaymentMethod.query()
      .where('hotel_id', hotelId)
      .where('method_type', PaymentMethodType.CITY_LEDGER)
      .where('is_active', true)
    const cityLedgerPaymentMethodIds = cityLedgerPaymentMethods.map((pm) => pm.id)

    const query = FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereIn('payment_method_id', cityLedgerPaymentMethodIds)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .whereNotIn('status', ['cancelled', 'voided'])

    if (startDate) {
      query.whereBetween('current_working_date', [startDate.toISODate()!, endDate.toISODate()!])
    } else {
      query.where('current_working_date', '<', endDate.toISODate()!)
    }

    const result = await query.sum('amount as total').first()
    return Number(result?.$extras.total || 0)
  }

  /**
   * Helper: Get City Ledger Payments Received
   */
  static async getCityLedgerPayments(hotelId: number, startDate: DateTime | null, endDate: DateTime): Promise<number> {
    const cityLedgerPaymentMethods = await PaymentMethod.query()
      .where('hotel_id', hotelId)
      .where('method_type', PaymentMethodType.CITY_LEDGER)
      .where('is_active', true)
    const cityLedgerPaymentMethodIds = cityLedgerPaymentMethods.map((pm) => pm.id)

    const query = FolioTransaction.query()
      .where('hotel_id', hotelId)
      .whereHas('folio', (folioQuery) => {
        folioQuery.whereIn('folio_type', [FolioType.COMPANY, FolioType.CITY_LEDGER])
      })
      .where('transaction_type', TransactionType.PAYMENT)
      .whereNotIn('payment_method_id', cityLedgerPaymentMethodIds)
      .where('is_voided', false)
      .whereNotIn('status', ['cancelled', 'voided'])

    if (startDate) {
      query.whereBetween('current_working_date', [startDate.toISODate()!, endDate.toISODate()!])
    } else {
      query.where('current_working_date', '<', endDate.toISODate()!)
    }

    const result = await query.sum('amount as total').first()
    return Number(result?.$extras.total || 0)
  }

  /**
   * Helper: Get City Ledger Commissions
   */
  static async getCityLedgerCommissions(hotelId: number, startDate: DateTime | null, endDate: DateTime): Promise<number> {
    const query = FolioTransaction.query()
      .where('hotel_id', hotelId)
      .where('is_commissionable', true)
      .where('is_voided', false)
      .whereNotIn('status', ['cancelled', 'voided'])

    if (startDate) {
      query.whereBetween('current_working_date', [startDate.toISODate()!, endDate.toISODate()!])
    } else {
      query.where('current_working_date', '<', endDate.toISODate()!)
    }

    const result = await query.sum('commission_amount as total').first()
    return Number(result?.$extras.total || 0)
  }

  /**
   * Calculate City Ledger Metrics for a specific date
   */
  static async getCityLedgerMetrics(hotelId: number, date: DateTime): Promise<LedgerMetrics> {
    // 1. Opening Balance
    let openingBalance = await this.getOpeningBalance(hotelId, date, 'cityLedgerClosingBalance')

    // Fallback Opening Balance
    if (openingBalance === null) {
      openingBalance =
        (await this.getCityLedgerTransfers(hotelId, null, date)) -
        (await this.getCityLedgerPayments(hotelId, null, date)) -
        (await this.getCityLedgerCommissions(hotelId, null, date))
    }

    const transfers = await this.getCityLedgerTransfers(hotelId, date, date)
    const payments = await this.getCityLedgerPayments(hotelId, date, date)
    const commissions = await this.getCityLedgerCommissions(hotelId, date, date)

    const closingBalance = openingBalance + transfers - (payments + commissions)

    return {
      openingBalance,
      transfers,
      payments,
      commissions,
      closingBalance
    }
  }
}
