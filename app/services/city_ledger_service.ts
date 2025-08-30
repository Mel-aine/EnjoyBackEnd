import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import PaymentMethod from '#models/payment_method'
import CompanyAccount from '#models/company_account'

import { PaymentMethodType, TransactionType } from '#app/enums'
import Database from '@adonisjs/lucid/services/db'

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
  isVoided: boolean
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
    
    // Find the city ledger payment method for this company
    const cityLedgerPaymentMethod = await PaymentMethod.query()
      .where('hotel_id', filters.hotelId || companyAccount.hotelId)
      .where('method_type', PaymentMethodType.CITY_LEDGER)
      .where('method_name', 'ILIKE', `%${companyAccount.companyName}%`)
      .where('is_active', true)
      .first()
    
    if (!cityLedgerPaymentMethod) {
      throw new Error(`No city ledger payment method found for company: ${companyAccount.companyName}`)
    }
    
    // Build the main query for transactions
    const query = FolioTransaction.query()
      .where('hotel_id', filters.hotelId || companyAccount.hotelId)
      .where('payment_method_id', cityLedgerPaymentMethod.id)
      .preload('folio', (folioQuery) => {
        folioQuery.preload('guest')
        folioQuery.preload('reservation')
      })
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
          .whereHas('folio', (folioQuery) => {
            folioQuery
              .where('folio_number', 'ILIKE', `%${filters.searchText}%`)
              .orWhereHas('guest', (guestQuery) => {
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
      query.where('is_voided', filters.showVoided)
    }
    
    // Order by date (most recent first)
    const dateColumn = filters.usePostingDate ? 'posting_date' : 'transaction_date'
    query.orderBy(dateColumn, 'desc')
    
    // Get paginated results
    const paginatedResult = await query.paginate(page, limit)
    
    // Calculate running balance and format transactions
    const transactions: CityLedgerTransaction[] = []
    let runningBalance = companyAccount.currentBalance || 0
    
    // Process transactions in reverse order to calculate running balance correctly
    const reversedTransactions = [...paginatedResult.all()].reverse()
    
    for (const transaction of reversedTransactions) {
      const isCredit = transaction.transactionType === TransactionType.PAYMENT
      const isDebit = transaction.transactionType === TransactionType.CHARGE
      
      // All company payments should be treated as debits and unassigned by default
      let credit = 0
      let debit = 0
      let assigned = 0
      let unassigned = 0
      
      if (isCredit) {
        // Company payments are treated as debits (money owed by company)
        debit = Math.abs(transaction.amount)
        // All company payments are unassigned by default unless explicitly assigned
        unassigned = transaction.assignedAmount ? Math.abs(transaction.amount) - Math.abs(transaction.assignedAmount || 0) : Math.abs(transaction.amount)
        assigned = Math.abs(transaction.assignedAmount || 0)
      } else if (isDebit) {
        debit = Math.abs(transaction.amount)
        // For charges, check if they are assigned to specific folios
        assigned = transaction.folioId ? debit : 0
        unassigned = !transaction.folioId ? debit : 0
      }
      
      // Update running balance
      if (isCredit) {
        // Since company payments are now treated as debits, they increase the balance (amount owed)
        runningBalance += debit
      } else if (isDebit) {
        runningBalance += debit
      }
      
      transactions.push({
        id: transaction.id,
        date: transaction.transactionDate,
        description: transaction.description || transaction.particular || 'City Ledger Transaction',
        paymentType: cityLedgerPaymentMethod.methodName,
        guestName: transaction.folio?.guest?.fullName || transaction.guestName || 'N/A',
        folioNo: transaction.folio?.folioNumber || 'N/A',
        user: transaction.creator?.fullName || transaction.folio?.guest?.fullName || 'System',
        amount: Math.abs(transaction.amount || 0),
        assigned: assigned,
        open: unassigned,
        assign: transaction.id, // Transaction ID for assignment actions
        credit,
        debit,
        balance: runningBalance,
        voucherNumber: transaction.voucherNumber,
        isVoided: transaction.isVoided
      })
    }
    
    // Reverse back to show most recent first
    transactions.reverse()
    
    // Calculate totals
    const totals = await this.calculateCityLedgerTotals(filters.companyAccountId, cityLedgerPaymentMethod.id, filters.hotelId || companyAccount.hotelId)
    
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