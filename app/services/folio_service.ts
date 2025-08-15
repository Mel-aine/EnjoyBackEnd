import { DateTime } from 'luxon'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import Guest from '#models/guest'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'

export interface CreateFolioData {
  hotelId: number
  guestId: number
  reservationId?: number
  groupId?: number
  companyId?: number
  folioType: 'guest' | 'master' | 'group' | 'company' | 'house' | 'city_ledger'
  folioName?: string
  creditLimit?: number
  notes?: string
  gstinNo?: string
  showTariffOnPrint?: boolean
  postCommissionToTa?: boolean
  generateInvoiceNumber?: boolean
  createdBy: number
}

export interface PostTransactionData {
  folioId: number
  transactionType: 'charge' | 'payment' | 'adjustment' | 'transfer' | 'refund' | 'void'
  category: string
  description: string
  amount: number
  quantity?: number
  unitPrice?: number
  taxAmount?: number
  serviceChargeAmount?: number
  discountAmount?: number
  departmentId?: number
  revenueCenterId?: number
  costCenterId?: number
  glAccountCode?: string
  paymentMethodId?: number
  reference?: string
  notes?: string
  postedBy: number
}

export interface SettlementData {
  folioId: number
  paymentMethodId: number
  amount: number
  reference?: string
  notes?: string
  settledBy: number
}

export interface TransferData {
  fromFolioId: number
  toFolioId: number
  amount: number
  description: string
  reference?: string
  transferredBy: number
}

export default class FolioService {
  /**
   * Create a new folio for a guest
   */
  static async createFolio(data: CreateFolioData): Promise<Folio> {
    return await db.transaction(async (trx) => {
      // Validate guest exists
      const guest = await Guest.findOrFail(data.guestId)
      
      // Validate hotel exists
      const hotel = await Hotel.findOrFail(data.hotelId)
      
      // Validate reservation if provided
      if (data.reservationId) {
        await Reservation.findOrFail(data.reservationId)
      }
      
      // Generate unique folio number
      const folioNumber = await this.generateFolioNumber(data.hotelId, trx)
      
      // Generate folio name if not provided
      const folioName = data.folioName || `${guest.firstName} ${guest.lastName} - ${data.folioType.toUpperCase()}`
      
      // Create folio
      const folio = await Folio.create({
        hotelId: data.hotelId,
        guestId: data.guestId,
        reservationId: data.reservationId,
        groupId: data.groupId,
        companyId: data.companyId,
        folioNumber,
        folioName,
        folioType: data.folioType,
        status: 'open',
        settlementStatus: 'pending',
        workflowStatus: 'active',
        openedDate: DateTime.now(),
        creditLimit: data.creditLimit || 0,
        notes: data.notes,
        gstinNo: data.gstinNo,
        showTariffOnPrint: data.showTariffOnPrint,
        postCommissionToTa: data.postCommissionToTa,
        generateInvoiceNumber: data.generateInvoiceNumber,
        createdBy: data.createdBy,
        lastModifiedBy: data.createdBy,
        openedBy: data.createdBy
      }, { client: trx })
      
      return folio
    })
  }
  
  /**
   * Post a transaction to a folio
   */
  static async postTransaction(data: PostTransactionData): Promise<FolioTransaction> {
    return await db.transaction(async (trx) => {
      // Validate folio exists and can be modified
      const folio = await Folio.findOrFail(data.folioId)
      
      if (!folio.canBeModified) {
        throw new Error('Folio cannot be modified - it is finalized or closed')
      }
      
      // Generate transaction number
      const transactionNumber = await this.generateTransactionNumber(folio.hotelId, trx)
      
      // Create transaction
      const transaction = await FolioTransaction.create({
        hotelId: folio.hotelId,
        folioId: data.folioId,
        transactionNumber,
        transactionType: data.transactionType,
        category: data.category,
        description: data.description,
        amount: data.amount,
        quantity: data.quantity || 1,
        unitPrice: data.unitPrice || data.amount,
        taxAmount: data.taxAmount || 0,
        serviceChargeAmount: data.serviceChargeAmount || 0,
        discountAmount: data.discountAmount || 0,
        netAmount: data.amount - (data.discountAmount || 0),
        grossAmount: data.amount + (data.taxAmount || 0) + (data.serviceChargeAmount || 0),
        departmentId: data.departmentId,
        revenueCenterId: data.revenueCenterId,
        costCenterId: data.costCenterId,
        glAccountCode: data.glAccountCode,
        paymentMethodId: data.paymentMethodId,
        reference: data.reference,
        notes: data.notes,
        transactionDate: DateTime.now(),
        businessDate: DateTime.now(),
        auditDate: DateTime.now(),
        status: 'posted',
        isPosted: true,
        postedDate: DateTime.now(),
        postedBy: data.postedBy,
        createdBy: data.postedBy,
        lastModifiedBy: data.postedBy
      }, { client: trx })
      
      // Update folio totals
      await this.updateFolioTotals(data.folioId, trx)
      
      return transaction
    })
  }
  
  /**
   * Settle a folio (process payment)
   */
  static async settleFolio(data: SettlementData): Promise<{ folio: Folio, transaction: FolioTransaction }> {
    return await db.transaction(async (trx) => {
      const folio = await Folio.findOrFail(data.folioId)
      
      if (folio.balance <= 0) {
        throw new Error('Folio has no outstanding balance to settle')
      }
      
      // Create payment transaction
      const transaction = await this.postTransaction({
        folioId: data.folioId,
        transactionType: 'payment',
        category: 'payment',
        description: 'Payment received',
        amount: -Math.abs(data.amount), // Negative for payment
        paymentMethodId: data.paymentMethodId,
        reference: data.reference,
        notes: data.notes,
        postedBy: data.settledBy
      })
      
      // Update folio settlement status
      await folio.useTransaction(trx).merge({
        settlementStatus: folio.balance <= 0 ? 'settled' : 'partial',
        settlementDate: folio.balance <= 0 ? DateTime.now() : null,
        lastModifiedBy: data.settledBy
      }).save()
      
      return { folio, transaction }
    })
  }
  
  /**
   * Transfer charges between folios
   */
  static async transferCharges(data: TransferData): Promise<{ fromTransaction: FolioTransaction, toTransaction: FolioTransaction }> {
    return await db.transaction(async (trx) => {
      const fromFolio = await Folio.findOrFail(data.fromFolioId)
      const toFolio = await Folio.findOrFail(data.toFolioId)
      
      if (!fromFolio.canBeModified || !toFolio.canBeModified) {
        throw new Error('One or both folios cannot be modified')
      }
      
      if (fromFolio.balance < data.amount) {
        throw new Error('Insufficient balance in source folio for transfer')
      }
      
      // Create transfer-out transaction
      const fromTransaction = await this.postTransaction({
        folioId: data.fromFolioId,
        transactionType: 'transfer',
        category: 'transfer_out',
        description: `Transfer to ${toFolio.folioNumber}: ${data.description}`,
        amount: -Math.abs(data.amount), // Negative for transfer out
        reference: data.reference,
        postedBy: data.transferredBy
      })
      
      // Create transfer-in transaction
      const toTransaction = await this.postTransaction({
        folioId: data.toFolioId,
        transactionType: 'transfer',
        category: 'transfer_in',
        description: `Transfer from ${fromFolio.folioNumber}: ${data.description}`,
        amount: Math.abs(data.amount), // Positive for transfer in
        reference: data.reference,
        postedBy: data.transferredBy
      })
      
      return { fromTransaction, toTransaction }
    })
  }
  
  /**
   * Close a folio
   */
  static async closeFolio(folioId: number, closedBy: number): Promise<Folio> {
    return await db.transaction(async (trx) => {
      const folio = await Folio.findOrFail(folioId)
      
      if (folio.balance > 0) {
        throw new Error('Cannot close folio with outstanding balance')
      }
      
      await folio.useTransaction(trx).merge({
        status: 'closed',
        workflowStatus: 'finalized',
        closedDate: DateTime.now(),
        finalizedDate: DateTime.now(),
        closedBy,
        lastModifiedBy: closedBy
      }).save()
      
      return folio
    })
  }
  
  /**
   * Reopen a closed folio
   */
  static async reopenFolio(folioId: number, reopenedBy: number): Promise<Folio> {
    const folio = await Folio.findOrFail(folioId)
    
    if (folio.status !== 'closed') {
      throw new Error('Only closed folios can be reopened')
    }
    
    await folio.merge({
      status: 'open',
      workflowStatus: 'active',
      closedDate: null,
      finalizedDate: null,
      closedBy: null,
      lastModifiedBy: reopenedBy
    }).save()
    
    return folio
  }
  
  /**
   * Get folio statement with all transactions
   */
  static async getFolioStatement(folioId: number): Promise<Folio> {
    return await Folio.query()
      .where('id', folioId)
      .preload('hotel')
      .preload('guest')
      .preload('reservation')
      .preload('transactions', (query) => {
        query.orderBy('transactionDate', 'asc')
      })
      .firstOrFail()
  }
  
  /**
   * Generate unique folio number
   */
  private static async generateFolioNumber(hotelId: number, trx?: TransactionClientContract): Promise<string> {
    const query = Folio.query({ client: trx })
      .where('hotelId', hotelId)
      .orderBy('id', 'desc')
      .first()
    
    const lastFolio = await query
    let nextNumber = 1
    
    if (lastFolio && lastFolio.folioNumber) {
      const match = lastFolio.folioNumber.match(/F-(\d+)-(\d+)$/)
      if (match) {
        nextNumber = parseInt(match[2]) + 1
      }
    }
    
    return `F-${hotelId}-${nextNumber.toString().padStart(8, '0')}`
  }
  
  /**
   * Generate unique transaction number
   */
  private static async generateTransactionNumber(hotelId: number, trx?: TransactionClientContract): Promise<string> {
    const query = FolioTransaction.query({ client: trx })
      .where('hotelId', hotelId)
      .orderBy('id', 'desc')
      .first()
    
    const lastTransaction = await query
    let nextNumber = 1
    
    if (lastTransaction && lastTransaction.transactionNumber) {
      const match = lastTransaction.transactionNumber.match(/T-(\d+)-(\d+)$/)
      if (match) {
        nextNumber = parseInt(match[2]) + 1
      }
    }
    
    return `T-${hotelId}-${nextNumber.toString().padStart(8, '0')}`
  }
  
  /**
   * Update folio totals based on transactions
   */
  private static async updateFolioTotals(folioId: number, trx?: TransactionClientContract): Promise<void> {
    const transactions = await FolioTransaction.query({ client: trx })
      .where('folioId', folioId)
      .where('status', '!=', 'voided')
    
    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0
    
    for (const transaction of transactions) {
      if (transaction.transactionType === 'charge') {
        totalCharges += transaction.amount
      } else if (transaction.transactionType === 'payment') {
        totalPayments += Math.abs(transaction.amount)
      } else if (transaction.transactionType === 'adjustment') {
        totalAdjustments += transaction.amount
      }
      
      totalTaxes += transaction.taxAmount || 0
      totalServiceCharges += transaction.serviceChargeAmount || 0
      totalDiscounts += transaction.discountAmount || 0
    }
    
    const balance = totalCharges + totalAdjustments - totalPayments
    
    await Folio.query({ client: trx })
      .where('id', folioId)
      .update({
        totalCharges,
        totalPayments,
        totalAdjustments,
        totalTaxes,
        totalServiceCharges,
        totalDiscounts,
        balance
      })
  }
}