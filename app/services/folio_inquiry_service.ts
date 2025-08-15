import { DateTime } from 'luxon'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import Guest from '#models/guest'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'

export interface FolioInquiryFilters {
  hotelId?: number
  guestId?: number
  reservationId?: number
  folioNumber?: string
  folioType?: string
  status?: string
  settlementStatus?: string
  workflowStatus?: string
  dateFrom?: Date
  dateTo?: Date
  balanceMin?: number
  balanceMax?: number
  createdBy?: number
  hasOutstandingBalance?: boolean
}

export interface TransactionInquiryFilters {
  folioId?: number
  transactionType?: string
  category?: string
  dateFrom?: Date
  dateTo?: Date
  amountMin?: number
  amountMax?: number
  postedBy?: number
  departmentId?: number
  isVoided?: boolean
}

export interface GuestFolioView {
  folio: {
    id: number
    folioNumber: string
    folioType: string
    status: string
    createdAt: Date
    totalCharges: number
    totalPayments: number
    balance: number
    currency: string
  }
  transactions: {
    id: number
    date: Date
    description: string
    amount: number
    type: 'charge' | 'payment' | 'adjustment'
    category: string
  }[]
  summary: {
    totalCharges: number
    totalPayments: number
    totalAdjustments: number
    currentBalance: number
    lastActivity: Date
  }
}

export interface StaffFolioView {
  folio: Folio
  transactions: FolioTransaction[]
  guest: Guest
  audit: {
    createdBy: User
    lastModifiedBy?: User
    transactionCount: number
    lastTransactionDate?: Date
    voidedTransactions: number
    refundedTransactions: number
  }
  financial: {
    totalCharges: number
    totalPayments: number
    totalAdjustments: number
    totalTaxes: number
    totalServiceCharges: number
    totalDiscounts: number
    currentBalance: number
    creditLimit: number
    availableCredit: number
  }
}

export default class FolioInquiryService {
  /**
   * Get folio view for guests (limited information)
   */
  static async getGuestFolioView(folioId: number, guestId: number): Promise<GuestFolioView> {
    const folio = await Folio.query()
      .where('id', folioId)
      .where('guestId', guestId) // Ensure guest can only see their own folio
      .preload('transactions', (query) => {
        query
          .where('isVoided', false)
          .select(['id', 'transactionDate', 'description', 'amount', 'transactionType', 'category'])
          .orderBy('transactionDate', 'desc')
      })
      .firstOrFail()
    
    // Calculate totals
    const charges = folio.transactions.filter(t => t.transactionType === 'charge')
    const payments = folio.transactions.filter(t => t.transactionType === 'payment')
    const adjustments = folio.transactions.filter(t => t.transactionType === 'adjustment')
    
    const totalCharges = charges.reduce((sum, t) => sum + t.amount, 0)
    const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0)
    const totalAdjustments = adjustments.reduce((sum, t) => sum + t.amount, 0)
    const currentBalance = totalCharges - totalPayments + totalAdjustments
    
    const lastActivity = folio.transactions.length > 0 
      ? folio.transactions[0].transactionDate 
      : folio.createdAt
    
    return {
      folio: {
        id: folio.id,
        folioNumber: folio.folioNumber,
        folioType: folio.folioType,
        status: folio.status,
        createdAt: folio.createdAt,
        totalCharges: folio.totalCharges || 0,
        totalPayments: folio.totalPayments || 0,
        balance: folio.balance || 0,
        currency: folio.currency || 'USD'
      },
      transactions: folio.transactions.map(t => ({
        id: t.id,
        date: t.transactionDate,
        description: t.description,
        amount: t.amount,
        type: t.transactionType as 'charge' | 'payment' | 'adjustment',
        category: t.category
      })),
      summary: {
        totalCharges,
        totalPayments,
        totalAdjustments,
        currentBalance,
        lastActivity
      }
    }
  }
  
  /**
   * Get comprehensive folio view for staff
   */
  static async getStaffFolioView(folioId: number): Promise<StaffFolioView> {
    const folio = await Folio.query()
      .where('id', folioId)
      .preload('guest')
      .preload('transactions', (query) => {
        query.orderBy('transactionDate', 'desc')
      })
      .preload('createdByUser')
      .preload('lastModifiedByUser')
      .firstOrFail()
    
    // Calculate financial summary
    const activeTransactions = folio.transactions.filter(t => !t.isVoided)
    const charges = activeTransactions.filter(t => t.transactionType === 'charge')
    const payments = activeTransactions.filter(t => t.transactionType === 'payment')
    const adjustments = activeTransactions.filter(t => t.transactionType === 'adjustment')
    
    const totalCharges = charges.reduce((sum, t) => sum + t.amount, 0)
    const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0)
    const totalAdjustments = adjustments.reduce((sum, t) => sum + t.amount, 0)
    const totalTaxes = charges.filter(t => t.category === 'tax').reduce((sum, t) => sum + t.amount, 0)
    const totalServiceCharges = charges.filter(t => t.category === 'service_charge').reduce((sum, t) => sum + t.amount, 0)
    const totalDiscounts = adjustments.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const currentBalance = totalCharges - totalPayments + totalAdjustments
    const availableCredit = Math.max(0, (folio.creditLimit || 0) - Math.max(0, currentBalance))
    
    // Audit information
    const voidedTransactions = folio.transactions.filter(t => t.isVoided).length
    const refundedTransactions = folio.transactions.filter(t => t.transactionType === 'refund').length
    const lastTransactionDate = folio.transactions.length > 0 ? folio.transactions[0].transactionDate : undefined
    
    return {
      folio,
      transactions: folio.transactions,
      guest: folio.guest,
      audit: {
        createdBy: folio.createdByUser,
        lastModifiedBy: folio.lastModifiedByUser,
        transactionCount: activeTransactions.length,
        lastTransactionDate,
        voidedTransactions,
        refundedTransactions
      },
      financial: {
        totalCharges,
        totalPayments,
        totalAdjustments,
        totalTaxes,
        totalServiceCharges,
        totalDiscounts,
        currentBalance,
        creditLimit: folio.creditLimit || 0,
        availableCredit
      }
    }
  }
  
  /**
   * Search folios with filters
   */
  static async searchFolios(
    filters: FolioInquiryFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: Folio[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const query = Folio.query()
      .preload('guest', (guestQuery) => {
        guestQuery.select(['id', 'firstName', 'lastName', 'email'])
      })
      .preload('reservation', (resQuery) => {
        resQuery.select(['id', 'confirmationNumber', 'checkInDate', 'checkOutDate'])
      })
    
    // Apply filters
    if (filters.hotelId) {
      query.where('hotelId', filters.hotelId)
    }
    
    if (filters.guestId) {
      query.where('guestId', filters.guestId)
    }
    
    if (filters.reservationId) {
      query.where('reservationId', filters.reservationId)
    }
    
    if (filters.folioNumber) {
      query.where('folioNumber', 'like', `%${filters.folioNumber}%`)
    }
    
    if (filters.folioType) {
      query.where('folioType', filters.folioType)
    }
    
    if (filters.status) {
      query.where('status', filters.status)
    }
    
    if (filters.settlementStatus) {
      query.where('settlementStatus', filters.settlementStatus)
    }
    
    if (filters.workflowStatus) {
      query.where('workflowStatus', filters.workflowStatus)
    }
    
    if (filters.dateFrom) {
      query.where('createdAt', '>=', filters.dateFrom)
    }
    
    if (filters.dateTo) {
      query.where('createdAt', '<=', filters.dateTo)
    }
    
    if (filters.balanceMin !== undefined) {
      query.where('balance', '>=', filters.balanceMin)
    }
    
    if (filters.balanceMax !== undefined) {
      query.where('balance', '<=', filters.balanceMax)
    }
    
    if (filters.createdBy) {
      query.where('createdBy', filters.createdBy)
    }
    
    if (filters.hasOutstandingBalance !== undefined) {
      if (filters.hasOutstandingBalance) {
        query.where('balance', '>', 0)
      } else {
        query.where('balance', '<=', 0)
      }
    }
    
    // Get total count
    const totalQuery = query.clone()
    const total = await totalQuery.count('* as total')
    const totalCount = Number(total[0].$extras.total)
    
    // Apply pagination
    const data = await query
      .orderBy('createdAt', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
    
    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    }
  }
  
  /**
   * Search transactions with filters
   */
  static async searchTransactions(
    filters: TransactionInquiryFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    data: FolioTransaction[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const query = FolioTransaction.query()
      .preload('folio', (folioQuery) => {
        folioQuery.select(['id', 'folioNumber', 'guestId']).preload('guest', (guestQuery) => {
          guestQuery.select(['id', 'firstName', 'lastName'])
        })
      })
      .preload('postedByUser', (userQuery) => {
        userQuery.select(['id', 'firstName', 'lastName'])
      })
    
    // Apply filters
    if (filters.folioId) {
      query.where('folioId', filters.folioId)
    }
    
    if (filters.transactionType) {
      query.where('transactionType', filters.transactionType)
    }
    
    if (filters.category) {
      query.where('category', filters.category)
    }
    
    if (filters.dateFrom) {
      query.where('transactionDate', '>=', filters.dateFrom)
    }
    
    if (filters.dateTo) {
      query.where('transactionDate', '<=', filters.dateTo)
    }
    
    if (filters.amountMin !== undefined) {
      query.where('amount', '>=', filters.amountMin)
    }
    
    if (filters.amountMax !== undefined) {
      query.where('amount', '<=', filters.amountMax)
    }
    
    if (filters.postedBy) {
      query.where('postedBy', filters.postedBy)
    }
    
    if (filters.departmentId) {
      query.where('departmentId', filters.departmentId)
    }
    
    if (filters.isVoided !== undefined) {
      query.where('isVoided', filters.isVoided)
    }
    
    // Get total count
    const totalQuery = query.clone()
    const total = await totalQuery.count('* as total')
    const totalCount = Number(total[0].$extras.total)
    
    // Apply pagination
    const data = await query
      .orderBy('transactionDate', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
    
    return {
      data,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    }
  }
  
  /**
   * Get folio activity timeline
   */
  static async getFolioTimeline(folioId: number): Promise<{
    events: {
      id: string
      type: 'created' | 'transaction' | 'status_change' | 'settlement' | 'closure'
      timestamp: Date
      description: string
      amount?: number
      user?: string
      details?: any
    }[]
  }> {
    const folio = await Folio.query()
      .where('id', folioId)
      .preload('transactions', (query) => {
        query.preload('postedByUser').orderBy('transactionDate', 'asc')
      })
      .preload('createdByUser')
      .firstOrFail()
    
    const events: any[] = []
    
    // Folio creation event
    events.push({
      id: `folio-created-${folio.id}`,
      type: 'created',
      timestamp: folio.createdAt,
      description: `Folio ${folio.folioNumber} created`,
      user: `${folio.createdByUser.firstName} ${folio.createdByUser.lastName}`,
      details: {
        folioType: folio.folioType,
        guestId: folio.guestId
      }
    })
    
    // Transaction events
    folio.transactions.forEach(transaction => {
      events.push({
        id: `transaction-${transaction.id}`,
        type: 'transaction',
        timestamp: transaction.transactionDate,
        description: transaction.description,
        amount: transaction.amount,
        user: transaction.postedByUser ? `${transaction.postedByUser.firstName} ${transaction.postedByUser.lastName}` : 'System',
        details: {
          transactionType: transaction.transactionType,
          category: transaction.category,
          reference: transaction.reference,
          isVoided: transaction.isVoided
        }
      })
    })
    
    // Settlement events
    if (folio.settlementDate) {
      events.push({
        id: `settlement-${folio.id}`,
        type: 'settlement',
        timestamp: folio.settlementDate,
        description: 'Folio settled',
        details: {
          settlementStatus: folio.settlementStatus
        }
      })
    }
    
    // Closure events
    if (folio.workflowStatus === 'closed' && folio.finalizedDate) {
      events.push({
        id: `closure-${folio.id}`,
        type: 'closure',
        timestamp: folio.finalizedDate,
        description: 'Folio closed',
        details: {
          finalBalance: folio.balance
        }
      })
    }
    
    // Sort events by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    
    return { events }
  }
  
  /**
   * Get folio statistics for reporting
   */
  static async getFolioStatistics(filters: FolioInquiryFilters): Promise<{
    totalFolios: number
    openFolios: number
    closedFolios: number
    totalRevenue: number
    totalPayments: number
    outstandingBalance: number
    averageFolioValue: number
    foliosByType: Record<string, number>
    foliosByStatus: Record<string, number>
  }> {
    const query = Folio.query()
    
    // Apply filters (reuse the same logic as searchFolios)
    if (filters.hotelId) query.where('hotelId', filters.hotelId)
    if (filters.dateFrom) query.where('createdAt', '>=', filters.dateFrom)
    if (filters.dateTo) query.where('createdAt', '<=', filters.dateTo)
    // ... other filters
    
    const folios = await query
    
    const totalFolios = folios.length
    const openFolios = folios.filter(f => f.workflowStatus !== 'closed').length
    const closedFolios = folios.filter(f => f.workflowStatus === 'closed').length
    const totalRevenue = folios.reduce((sum, f) => sum + (f.totalCharges || 0), 0)
    const totalPayments = folios.reduce((sum, f) => sum + (f.totalPayments || 0), 0)
    const outstandingBalance = folios.reduce((sum, f) => sum + Math.max(0, f.balance || 0), 0)
    const averageFolioValue = totalFolios > 0 ? totalRevenue / totalFolios : 0
    
    // Group by type and status
    const foliosByType: Record<string, number> = {}
    const foliosByStatus: Record<string, number> = {}
    
    folios.forEach(folio => {
      foliosByType[folio.folioType] = (foliosByType[folio.folioType] || 0) + 1
      foliosByStatus[folio.status] = (foliosByStatus[folio.status] || 0) + 1
    })
    
    return {
      totalFolios,
      openFolios,
      closedFolios,
      totalRevenue,
      totalPayments,
      outstandingBalance,
      averageFolioValue,
      foliosByType,
      foliosByStatus
    }
  }
}