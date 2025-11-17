import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import Folio from '#models/folio'
import PaymentMethod from '#models/payment_method'
import CompanyAccount from '#models/company_account'

import { PaymentMethodType, TransactionType, TransactionCategory, FolioType, FolioStatus } from '#app/enums'
import type { HttpContext } from '@adonisjs/core/http'
import { generateTransactionCode } from '../utils/generate_guest_code.js'
import Database from '@adonisjs/lucid/services/db'
import CompanyFolioService from './company_folio_service.js'
import FolioService from './folio_service.js'

export interface CityLedgerFilters {
  companyAccountId: number
  hotelId?: number
  dateFrom?: Date
  dateTo?: Date
  usePostingDate?: boolean // true for posting date, false for departure date
  searchText?: string // guest name, folio number, or voucher
  showVoided?: boolean
  page?: number
  limit?: number
}

export interface CityLedgerTransaction {
  id: number
  date: DateTime
  description: string
  paymentType: string
  transactionType: TransactionType
  guestName: string
  folioNo: string
  user: string
  amount: number
  assigned: number
  open: number
  assign: number
  credit: number
  debit: number
  balance: number
  voucherNumber?: string
  isVoided: boolean,
  paymentTypeId: number
}

export interface CityLedgerTotals {
  unpaidInvoices: number
  unassignedPayments: number
  assignedPayments: number
  openingBalance: number
  totalCredit: number
  totalDebit: number
  currentBalance: number
}

export interface CityLedgerResponse {
  data: CityLedgerTransaction[]
  totals: CityLedgerTotals
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  companyAccount: {
    id: number
    companyName: string
    companyCode: string
    currentBalance: number
  }
}

export default class CityLedgerService {
  /**
   * Get city ledger transactions for a company account
   */
  static async getCityLedgerTransactions(filters: CityLedgerFilters): Promise<CityLedgerResponse> {
    const page = filters.page || 1
    const limit = filters.limit || 50

    // Get company account details
    const companyAccount = await CompanyAccount.findOrFail(filters.companyAccountId)

    // Find the company folio(s) for this company account to align with new logic
    const companyFolios = await Folio.query()
      .where('hotel_id', filters.hotelId || companyAccount.hotelId)
      .where('folio_type', FolioType.COMPANY)
      .where('company_id', companyAccount.id)

    const folioIds = companyFolios.map((f) => f.id)
    if (folioIds.length === 0) {
      return {
        data: [],
        totals: {
          unpaidInvoices: 0,
          unassignedPayments: 0,
          assignedPayments: 0,
          openingBalance: 0,
          totalCredit: 0,
          totalDebit: 0,
          currentBalance: 0,
        },
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        companyAccount: {
          id: companyAccount.id,
          companyName: companyAccount.companyName,
          companyCode: companyAccount.companyCode ?? '',
          currentBalance: companyAccount.currentBalance,
        },
      }
    }

    // Build the main query for transactions
    const query = FolioTransaction.query()
      .where('hotel_id', filters.hotelId || companyAccount.hotelId)
      .whereIn('folio_id', folioIds)
      .preload('folio', (folioQuery: any) => {
        folioQuery.preload('guest')
        folioQuery.preload('reservation')
      })
      .preload('paymentMethod')
      .preload('creator')

    // Apply date filters
    if (filters.dateFrom || filters.dateTo) {
      const dateColumn = filters.usePostingDate ? 'posting_date' : 'transaction_date'

      if (filters.dateFrom) {
        query.where(dateColumn, '>=', filters.dateFrom)
      }

      if (filters.dateTo) {
        query.where(dateColumn, '<=', filters.dateTo)
      }
    }

    // Apply search text filter
    if (filters.searchText) {
      query.where((builder) => {
        builder
          .whereHas('folio', (folioQuery: any) => {
            folioQuery
              .where('folio_number', 'ILIKE', `%${filters.searchText}%`)
              .orWhereHas('guest', (guestQuery: any) => {
                guestQuery
                  .where('first_name', 'ILIKE', `%${filters.searchText}%`)
                  .orWhere('last_name', 'ILIKE', `%${filters.searchText}%`)
                  .orWhere('full_name', 'ILIKE', `%${filters.searchText}%`)
              })
          })
          .orWhere('voucher_number', 'ILIKE', `%${filters.searchText}%`)
          .orWhere('reference', 'ILIKE', `%${filters.searchText}%`)
      })
    }

    // Apply void filter
    if (filters.showVoided !== undefined) {
      if (!filters.showVoided) {
        query.where('is_voided', false)
      }
    }

    // Order by date (most recent first)
    const dateColumn = filters.usePostingDate ? 'posting_date' : 'transaction_date'
    query.orderBy('created_at', 'asc')

    // Get paginated results
    const paginatedResult = await query.paginate(page, limit)

    // Calculate running balance and format transactions
    const transactions: CityLedgerTransaction[] = []
    // Process transactions in reverse order to calculate running balance correctly
    const reversedTransactions = [...paginatedResult.all()].reverse()

    for (const transaction of reversedTransactions) {
      const isCredit = transaction.transactionType === TransactionType.PAYMENT
      const isDebit = transaction.transactionType === TransactionType.TRANSFER

      // All company payments should be treated as debits and unassigned by default
      let credit = 0
      let debit = 0
      let assigned = 0
      let unassigned = 0

      if (isCredit) {
        // Company payments are treated as debits (money owed by company)
        credit = Math.abs(transaction.amount)
        // All company payments are unassigned by default unless explicitly assigned
        unassigned = transaction.unassignedAmount ? Math.abs(transaction.amount) - Math.abs(transaction.assignedAmount || 0) : Math.abs(transaction.amount)
        assigned = Math.abs(transaction.assignedAmount || 0)
      } else if (isDebit) {
        debit = Math.abs(transaction.amount)
        // For charges, check if they are assigned to specific folios
        assigned = transaction.assignedAmount;
        unassigned = transaction.unassignedAmount;
      }


      transactions.push({
        id: transaction.id,
        date: transaction.transactionDate,
        transactionType: transaction.transactionType,
        description: transaction.description || transaction.particular,
        paymentType: transaction.paymentMethod?.methodName,
        paymentTypeId: transaction.paymentMethod?.id,
        guestName: transaction.folio?.guest?.fullName || transaction.guestName,
        folioNo: transaction.folio?.folioNumber,
        user: transaction.creator?.fullName || transaction.folio?.guest?.fullName,
        amount: Math.abs(transaction.amount || 0),
        assigned: assigned,
        open: unassigned,
        assign: transaction.id, // Transaction ID for assignment actions
        credit,
        debit,
        balance: transaction.balance ? transaction.balance : 0,
        voucherNumber: transaction.voucherNumber,
        isVoided: transaction.isVoided
      })
    }

    // Reverse back to show most recent first
    transactions.reverse()

    // Calculate totals
    const totals = await this.calculateCityLedgerTotalsByFolios(filters.companyAccountId, folioIds, filters.hotelId || companyAccount.hotelId)

    return {
      data: transactions,
      totals,
      meta: {
        page: paginatedResult.currentPage,
        limit: paginatedResult.perPage,
        total: paginatedResult.total,
        totalPages: paginatedResult.lastPage
      },
      companyAccount: {
        id: companyAccount.id,
        companyName: companyAccount.companyName,
        companyCode: companyAccount.companyCode || '',
        currentBalance: companyAccount.currentBalance || 0
      }
    }
  }

  /**
   * Create a City Ledger child transaction for a guest payment that used a City Ledger payment method.
   * Links the child via originalTransactionId and ensures description and unassigned amounts are correct.
   */
  public static async createCityLedgerChildForPayment(params: {
    originalTransaction: FolioTransaction
    postedBy: number
    ctx?: HttpContext
  }): Promise<{ child: FolioTransaction; currentBalance: number } | null> {
    const { originalTransaction, postedBy } = params

    if (
      !originalTransaction.paymentMethodId ||
      originalTransaction.transactionType !== TransactionType.PAYMENT
    ) {
      return null
    }

    const paymentMethod = await PaymentMethod.find(originalTransaction.paymentMethodId)
    if (!paymentMethod || paymentMethod.methodType !== PaymentMethodType.CITY_LEDGER) {
      return null
    }

    const companyId = paymentMethod.companyId
    const hotelId = originalTransaction.hotelId
    if (!companyId || !hotelId) {
      return null
    }
    const companyFolioService = new CompanyFolioService()
    // Get or create the company folio
    const companyFolio = await companyFolioService.getOrCreateCompanyFolio(companyId, hotelId, postedBy)

    // Derive guest and room details from preloaded folio relations if available (no extra queries)
    const folioGuestName = originalTransaction.folio?.guest?.displayName
    const folioRoomNumber = originalTransaction.folio?.reservationRoom?.room?.roomNumber
    const folioNumber = originalTransaction.folio?.folioNumber

    const guestName = folioGuestName || originalTransaction.guestName || 'N/A'
    const roomNumber = folioRoomNumber || originalTransaction.roomNumber || 'N/A'
    const description = `Guest: ${guestName}, Room: ${roomNumber}, folio: ${folioNumber ?? originalTransaction.folioId}`

    const amount = Math.abs(originalTransaction.amount || 0)

    const transactionNumber = await this.generateTransactionNumber(hotelId)
    const transactionCode = generateTransactionCode('TXN')

    // Create the child transaction on the company folio
    const child = await FolioTransaction.create({
      hotelId,
      folioId: companyFolio.id,
      transactionNumber,
      transactionCode,
      transactionType: TransactionType.TRANSFER,
      category: TransactionCategory.TRANSFER_IN,
      particular: paymentMethod.methodName,
      description,
      amount,
      totalAmount: amount,
      assignedAmount: 0,
      unassignedAmount: amount,
      postingDate: originalTransaction.postingDate,
      transactionDate: originalTransaction.transactionDate,
      paymentMethodId: paymentMethod.id,
      originalTransactionId: originalTransaction.id,
      guestId: originalTransaction.guestId,
      createdBy: postedBy,
      cashierId: postedBy,
      lastModifiedBy: postedBy,
      transactionTime: DateTime.now().toISOTime(),
    })

    // Recalculate folio totals and set the child transaction with the folio's balance
    await FolioService.updateFolioTotals(companyFolio.id)
    const updatedCompanyFolio = await Folio.query().where('id', companyFolio.id).first()
    if (updatedCompanyFolio) {
      await FolioTransaction.query()
        .where('id', child.id)
        .update({ balance: updatedCompanyFolio.balance })
    }

    return { child, currentBalance: updatedCompanyFolio?.balance || 0 }
  }

  /**
   * Recalculate and persist folio totals for a given folio.
   */
  public static async updateFolioTotals(folioId: number): Promise<void> {
    const transactions = await FolioTransaction.query()
      .where('folio_id', folioId)
      .where('is_voided', false)

    const totalCharges = transactions
      .filter((t) => t.transactionType === TransactionType.CHARGE)
      .reduce((sum, t) => sum + Math.abs(t.totalAmount || t.amount || 0), 0)

    const totalPayments = transactions
      .filter((t) => t.transactionType === TransactionType.PAYMENT)
      .reduce((sum, t) => sum + Math.abs(t.totalAmount || t.amount || 0), 0)

    const folio = await Folio.findOrFail(folioId)
    folio.totalCharges = totalCharges
    folio.totalPayments = totalPayments
    folio.balance = totalCharges - totalPayments
    await folio.save()
  }


  /**
   * Generate next transaction number for the hotel.
   */
  private static async generateTransactionNumber(hotelId: number): Promise<number> {
    const lastTxn = await FolioTransaction.query().where('hotel_id', hotelId).orderBy('id', 'desc').first()
    return (lastTxn?.transactionNumber || 0) + 1
  }

  /**
   * Calculate city ledger totals
   */
  static async calculateCityLedgerTotals(
    companyAccountId: number,
    paymentMethodId: number,
    hotelId: number
  ): Promise<CityLedgerTotals> {
    // Get company account
    const companyAccount = await CompanyAccount.findOrFail(companyAccountId)

    // Calculate unpaid invoices (charges without corresponding payments)
    const unpaidInvoicesResult = await Database
      .from('folio_transactions')
      .where('hotel_id', hotelId)
      .where('payment_method_id', paymentMethodId)
      .where('transaction_type', TransactionType.CHARGE)
      .where('is_voided', false)
      .sum('amount as total')
      .first()

    const unpaidInvoices = Math.abs(parseFloat(unpaidInvoicesResult?.total || '0'))

    // Calculate total payments
    const totalPaymentsResult = await Database
      .from('folio_transactions')
      .where('hotel_id', hotelId)
      .where('payment_method_id', paymentMethodId)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .sum('amount as total')
      .first()

    const totalPayments = Math.abs(parseFloat(totalPaymentsResult?.total || '0'))

    // Calculate assigned payments using the assignedAmount field
    const assignedPaymentsResult = await Database
      .from('folio_transactions')
      .where('hotel_id', hotelId)
      .where('payment_method_id', paymentMethodId)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .whereNotNull('assigned_amount')
      .where('assigned_amount', '>', 0)
      .sum('assigned_amount as total')
      .first()

    const assignedPayments = Math.abs(parseFloat(assignedPaymentsResult?.total || '0'))

    // Calculate unassigned payments - total payments minus assigned payments
    const unassignedPayments = totalPayments - assignedPayments

    // Opening balance from company account
    const openingBalance = companyAccount.currentBalance || 0

    // Calculate totals for city ledger accounting
    // In city ledger: charges are debits (increase balance), payments are credits (decrease balance)
    const totalDebit = unpaidInvoices // Charges are debits
    const totalCredit = totalPayments // Payments are credits

    // Current balance = opening balance + debits - credits
    const currentBalance = openingBalance + totalDebit - totalCredit

    return {
      unpaidInvoices,
      unassignedPayments: Math.max(0, unassignedPayments), // Ensure non-negative
      assignedPayments,
      openingBalance,
      totalCredit,
      totalDebit,
      currentBalance
    }
  }

  /**
   * Calculate city ledger totals using company folio IDs (align with new folio-based logic)
   */
  static async calculateCityLedgerTotalsByFolios(
    companyAccountId: number,
    folioIds: number[],
    hotelId: number
  ): Promise<CityLedgerTotals> {
    // Get company account
    const companyAccount = await CompanyAccount.findOrFail(companyAccountId)

    // Calculate unpaid invoices (charges on company folios)
    const unpaidInvoicesResult = await Database
      .from('folio_transactions')
      .where('hotel_id', hotelId)
      .whereIn('folio_id', folioIds)
      .where('transaction_type', TransactionType.TRANSFER)
      .where('is_voided', false)
      .where('unassigned_amount', '>', 0)
      .sum('unassigned_amount as total')
      .first()

    const unpaidInvoices = Math.abs(parseFloat(unpaidInvoicesResult?.total || '0'))

    // Calculate total payments posted to company folios
    const totalPaymentsResult = await Database
      .from('folio_transactions')
      .where('hotel_id', hotelId)
      .whereIn('folio_id', folioIds)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .sum('amount as total')
      .first()

    const totalPayments = Math.abs(parseFloat(totalPaymentsResult?.total || '0'))

    // Calculate assigned payments using the assignedAmount field on company folios
    const assignedPaymentsResult = await Database
      .from('folio_transactions')
      .where('hotel_id', hotelId)
      .whereIn('folio_id', folioIds)
      .where('transaction_type', TransactionType.PAYMENT)
      .where('is_voided', false)
      .whereNotNull('assigned_amount')
      .where('assigned_amount', '>', 0)
      .sum('assigned_amount as total')
      .first()

    const assignedPayments = Math.abs(parseFloat(assignedPaymentsResult?.total || '0'))

    // Calculate unassigned payments - total payments minus assigned payments
    const unassignedPayments = totalPayments - assignedPayments

    // Opening balance from company account
    const openingBalance = companyAccount.currentBalance || 0

    // Calculate totals for city ledger accounting
    // In city ledger: charges are debits (increase balance), payments are credits (decrease balance)
    const totalDebit = unpaidInvoices // Charges are debits
    const totalCredit = totalPayments // Payments are credits

    // Current balance = opening balance + debits - credits
    const currentBalance = openingBalance + totalDebit - totalCredit

    return {
      unpaidInvoices,
      unassignedPayments: Math.max(0, unassignedPayments), // Ensure non-negative
      assignedPayments,
      openingBalance,
      totalCredit,
      totalDebit,
      currentBalance
    }
  }

  /**
   * Get city ledger payment method for a company account
   */
  static async getCityLedgerPaymentMethod(companyAccountId: number, hotelId?: number): Promise<PaymentMethod | null> {
    const companyAccount = await CompanyAccount.findOrFail(companyAccountId)

    return await PaymentMethod.query()
      .where('hotel_id', hotelId || companyAccount.hotelId)
      .where('method_type', PaymentMethodType.CITY_LEDGER)
      .where('method_name', 'ILIKE', `%${companyAccount.companyName}%`)
      .where('is_active', true)
      .first()
  }
}
