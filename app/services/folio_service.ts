import { DateTime } from 'luxon'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import Guest from '#models/guest'
import Reservation from '#models/reservation'
import { TransactionType, TransactionCategory, SettlementStatus, TransactionStatus, FolioStatus, WorkflowStatus, type FolioType } from '#app/enums'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'

export interface CreateFolioData {
  hotelId: number
  guestId: number
  reservationId?: number
  groupId?: number
  companyId?: number
  folioType: FolioType,
  folioNumber?: string,
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
  transactionType: TransactionType
  category: TransactionCategory,
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
  transactionDate?: DateTime
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

export interface SplitFolioData {
  sourceFolioId: number
  destinationFolioId: number
  transactionsToMove: number[]
  splitBy: number
  notes?: string
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
      //const hotel = await Hotel.findOrFail(data.hotelId)
      
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
        status: FolioStatus.OPEN,
        settlementStatus: SettlementStatus.PENDING,
        workflowStatus: WorkflowStatus.ACTIVE,
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
        reservationId:folio.reservationId,
        transactionNumber,
        transactionType: data.transactionType,
        category: data.category,
        description: data.description,
        amount: data.amount,
        totalAmount: data.amount,
        quantity: data.quantity || 1,
        unitPrice: data.unitPrice || data.amount,
        taxAmount: data.taxAmount || 0,
        serviceChargeAmount: data.serviceChargeAmount || 0,
        discountAmount: data.discountAmount || 0,
        netAmount: data.amount - (data.discountAmount || 0),
        grossAmount: data.amount + (data.taxAmount || 0) + (data.serviceChargeAmount || 0),
        transactionCode:transactionNumber,
        transactionTime: DateTime.now().toISOTime(),
        postingDate:DateTime.now(),
        //departmentId: data.departmentId,
        //revenueCenterId: data.revenueCenterId,
        //costCenterId: data.costCenterId,
        //glAccountCode: data.glAccountCode,
        paymentMethodId: data.paymentMethodId,
        //reference: data.reference,
        //descriptions: data.notes,
        transactionDate: data.transactionDate || DateTime.now(),
        //businessDate: DateTime.now(),
       // auditDate: DateTime.now(),
        status: TransactionStatus.POSTED,
       // isPosted: true,
        //postedDate: DateTime.now(),
        //postedBy: data.postedBy,
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
        transactionType: TransactionType.PAYMENT,
        category: TransactionCategory.PAYMENT,
        description: 'Payment received',
        amount: -Math.abs(data.amount), // Negative for payment
        paymentMethodId: data.paymentMethodId,
        reference: data.reference,
        notes: data.notes,
        postedBy: data.settledBy
      })
      
      // Refresh folio to get updated balance after payment
      await folio.refresh()
      
      // Update folio settlement status
      const updateData: any = {
        settlementStatus: folio.balance <= 0 ? SettlementStatus.SETTLED : SettlementStatus.PARTIAL,
        settlementDate: folio.balance <= 0 ? DateTime.now() : null,
        lastModifiedBy: data.settledBy
      }
      
      // Auto-close folio if balance is zero
      if (folio.balance <= 0) {
        updateData.status = FolioStatus.CLOSED
        updateData.workflowStatus = WorkflowStatus.FINALIZED
        updateData.closedDate = DateTime.now()
        updateData.finalizedDate = DateTime.now()
        updateData.closedBy = data.settledBy
      }
      
      await folio.useTransaction(trx).merge(updateData).save()
      
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
        throw new Error('One or both folios cannot be modified'+trx)
      }
      
      if (fromFolio.balance < data.amount) {
        throw new Error('Insufficient balance in source folio for transfer')
      }
      
      // Create transfer-out transaction
      const fromTransaction = await this.postTransaction({
        folioId: data.fromFolioId,
        transactionType: TransactionType.TRANSFER,
        category: TransactionCategory.TRANSFER_OUT,
        description: `Transfer to ${toFolio.folioNumber}: ${data.description}`,
        amount: -Math.abs(data.amount), // Negative for transfer out
        reference: data.reference,
        postedBy: data.transferredBy
      })
      
      // Create transfer-in transaction
      const toTransaction = await this.postTransaction({
        folioId: data.toFolioId,
        transactionType: TransactionType.TRANSFER,
        category: TransactionCategory.TRANSFER_IN,
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
        status: FolioStatus.CLOSED,
        workflowStatus: WorkflowStatus.FINALIZED,
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
      status: FolioStatus.OPEN,
      workflowStatus: WorkflowStatus.ACTIVE,
      closedDate: null,
      finalizedDate: null,
      closedBy: null,
      lastModifiedBy: reopenedBy
    }).save()
    
    return folio
  }
  
  /**
   * Get folio statement with transactions and room information
   */
  static async getFolioStatement(folioId: number): Promise<Folio> {
    return await Folio.query()
      .where('id', folioId)
      .preload('guest')
      .preload('reservation', (reservationQuery) => {
        reservationQuery.preload('reservationRooms', (roomQuery) => {
          roomQuery.preload('room')
        })
      })
      .preload('transactions', (transactionQuery) => {
        transactionQuery
          .orderBy('transactionDate', 'asc')
          .preload('paymentMethod')
      })
      .firstOrFail()
  }
  
  /**
   * Split a folio by transferring specified transactions from source to destination folio
   */
  static async splitFolio(data: SplitFolioData): Promise<{ sourceFolio: Folio, destinationFolio: Folio, transferredTransactions: FolioTransaction[] }> {
    return await db.transaction(async (trx) => {
      // Validate both folios exist
      const sourceFolio = await Folio.query({ client: trx })
        .where('id', data.sourceFolioId)
        .first()
      
      if (!sourceFolio) {
        throw new Error(`Source folio with ID ${data.sourceFolioId} not found`)
      }

      const destinationFolio = await Folio.query({ client: trx })
        .where('id', data.destinationFolioId)
        .first()
      
      if (!destinationFolio) {
        throw new Error(`Destination folio with ID ${data.destinationFolioId} not found`)
      }

      // Validate both folios belong to the same hotel
      if (sourceFolio.hotelId !== destinationFolio.hotelId) {
        throw new Error('Source and destination folios must belong to the same hotel')
      }

      // Validate source folio is not closed
      if (sourceFolio.status === FolioStatus.CLOSED) {
        throw new Error('Cannot split transactions from a closed folio')
      }

      // Validate destination folio is not closed
      if (destinationFolio.status === FolioStatus.CLOSED) {
        throw new Error('Cannot split transactions to a closed folio')
      }

      // Validate transactions exist and belong to source folio
      const transactionsToMove = await FolioTransaction.query({ client: trx })
        .whereIn('id', data.transactionsToMove)
        .where('folioId', data.sourceFolioId)
        .where('status', '!=', TransactionStatus.VOIDED)
      
      if (transactionsToMove.length !== data.transactionsToMove.length) {
        const foundIds = transactionsToMove.map(t => t.id)
        const missingIds = data.transactionsToMove.filter(id => !foundIds.includes(id))
        throw new Error(`Transactions with IDs [${missingIds.join(', ')}] not found in source folio or are voided`)
      }

      // Validate transactions can be moved (not settled, not voided)
      const unmovableTransactions = transactionsToMove.filter(t => 
        t.status === TransactionStatus.SETTLED || 
        t.status === TransactionStatus.VOIDED
      )
      
      if (unmovableTransactions.length > 0) {
        const unmovableIds = unmovableTransactions.map(t => t.id)
        throw new Error(`Transactions with IDs [${unmovableIds.join(', ')}] cannot be moved (settled or voided)`)
      }

      // Transfer transactions to destination folio
      await FolioTransaction.query({ client: trx })
        .whereIn('id', data.transactionsToMove)
        .update({
          folioId: data.destinationFolioId,
          lastModifiedBy: data.splitBy,
          updatedAt: DateTime.now(),
          notes: data.notes ? `Split from folio ${sourceFolio.folioNumber}: ${data.notes}` : `Split from folio ${sourceFolio.folioNumber}`
        })

      // Update folio totals for both folios
      await this.updateFolioTotals(data.sourceFolioId, trx)
      await this.updateFolioTotals(data.destinationFolioId, trx)

      // Reload folios with updated totals
      const updatedSourceFolio = await Folio.query({ client: trx })
        .where('id', data.sourceFolioId)
        .firstOrFail()
      
      const updatedDestinationFolio = await Folio.query({ client: trx })
        .where('id', data.destinationFolioId)
        .firstOrFail()

      return {
        sourceFolio: updatedSourceFolio,
        destinationFolio: updatedDestinationFolio,
        transferredTransactions: transactionsToMove
      }
    })
  }
  
  /**
   * Split a folio by transaction types (room charges, payments, extract charges)
   */
  static async splitFolioByType(data: {
    hotelId: number
    folioId: number
    roomCharges?: boolean
    payment?: boolean
    extractCharges?: boolean
    notes?: string
    splitBy: number
  }): Promise<{
    originalFolio: Folio
    newFolios: Folio[]
    transferredTransactions: FolioTransaction[]
  }> {
    return await db.transaction(async (trx) => {
      // Validate original folio exists
      const originalFolio = await Folio.query({ client: trx })
        .where('id', data.folioId)
        .first()
      
      if (!originalFolio) {
        throw new Error(`Folio with ID ${data.folioId} not found`)
      }
      
      // Ensure folio belongs to the specified hotel
      if (originalFolio.hotelId !== data.hotelId) {
        throw new Error('Folio does not belong to the specified hotel')
      }

      // Ensure folio is not closed
      if (originalFolio.status === FolioStatus.CLOSED) {
        throw new Error('Cannot split a closed folio')
      }

      const newFolios: Folio[] = []
      const allTransferredTransactions: FolioTransaction[] = []

      // Handle room charges
      if (data.roomCharges) {
        const roomChargeTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', data.folioId)
          .where('status', '!=', TransactionStatus.VOIDED)
          .whereIn('category', [TransactionCategory.ROOM])

        if (roomChargeTransactions.length > 0) {
          const newFolio = await this.createFolio({
            hotelId: data.hotelId,
            guestId: originalFolio.guestId,
            reservationId: originalFolio.reservationId,
            folioType: originalFolio.folioType,
            folioName: `${originalFolio.folioName || 'Split'} - Room Charges`,
            notes: data.notes || 'Split from original folio - Room charges',
            createdBy: data.splitBy
          })

          // Transfer room charge transactions
          await FolioTransaction.query({ client: trx })
            .whereIn('id', roomChargeTransactions.map(t => t.id))
            .update({
              folioId: newFolio.id,
              lastModifiedBy: data.splitBy,
              updatedAt: DateTime.now()
            })

          newFolios.push(newFolio)
          allTransferredTransactions.push(...roomChargeTransactions)
        }
      }

      // Handle payments
      if (data.payment) {
        const paymentTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', data.folioId)
          .where('status', '!=', TransactionStatus.VOIDED)
          .where('transactionType', TransactionType.PAYMENT)

        if (paymentTransactions.length > 0) {
          const newFolio = await this.createFolio({
            hotelId: data.hotelId,
            guestId: originalFolio.guestId,
            reservationId: originalFolio.reservationId,
            folioType: originalFolio.folioType,
            folioName: `${originalFolio.folioName || 'Split'} - Payments`,
            notes: data.notes || 'Split from original folio - Payments',
            createdBy: data.splitBy
          })

          // Transfer payment transactions
          await FolioTransaction.query({ client: trx })
            .whereIn('id', paymentTransactions.map(t => t.id))
            .update({
              folioId: newFolio.id,
              lastModifiedBy: data.splitBy,
              updatedAt: DateTime.now()
            })

          newFolios.push(newFolio)
          allTransferredTransactions.push(...paymentTransactions)
        }
      }

      // Handle extract charges
      if (data.extractCharges) {
        const extractChargeTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', data.folioId)
          .where('status', '!=', TransactionStatus.VOIDED)
          .whereIn('category', [TransactionCategory.FOOD_BEVERAGE, TransactionCategory.SPA, TransactionCategory.LAUNDRY, TransactionCategory.MINIBAR, TransactionCategory.MISCELLANEOUS])

        if (extractChargeTransactions.length > 0) {
          const newFolio = await this.createFolio({
            hotelId: data.hotelId,
            guestId: originalFolio.guestId,
            reservationId: originalFolio.reservationId,
            folioType: originalFolio.folioType,
            folioName: `${originalFolio.folioName || 'Split'} - Extract Charges`,
            notes: data.notes || 'Split from original folio - Extract charges',
            createdBy: data.splitBy
          })

          // Transfer extract charge transactions
          await FolioTransaction.query({ client: trx })
            .whereIn('id', extractChargeTransactions.map(t => t.id))
            .update({
              folioId: newFolio.id,
              lastModifiedBy: data.splitBy,
              updatedAt: DateTime.now()
            })

          newFolios.push(newFolio)
          allTransferredTransactions.push(...extractChargeTransactions)
        }
      }

      // Update folio totals for all affected folios
      await this.updateFolioTotals(data.folioId, trx)
      for (const folio of newFolios) {
        await this.updateFolioTotals(folio.id, trx)
      }

      // Reload original folio with updated totals
      const updatedOriginalFolio = await Folio.query({ client: trx })
        .where('id', data.folioId)
        .firstOrFail()

      return {
        originalFolio: updatedOriginalFolio,
        newFolios,
        transferredTransactions: allTransferredTransactions
      }
    })
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
  private static async generateTransactionNumber(hotelId: number, trx?: TransactionClientContract, next?:number): Promise<number> {
    const query = FolioTransaction.query({ client: trx })
      .where('hotelId', hotelId)
      .orderBy('transactionNumber', 'desc')
      .first()
    
    const lastTransaction = await query
    let nextNumber = 1
    
    if (lastTransaction && lastTransaction.transactionNumber) {
      nextNumber = lastTransaction.transactionNumber + 1 +(next??0)
    }
    
    return nextNumber
  }
  
  /**
   * Update folio totals based on transactions
   */
  private static async updateFolioTotals(folioId: number, trx?: TransactionClientContract): Promise<void> {
    const transactions = await FolioTransaction.query({ client: trx })
      .where('folioId', folioId)
      .where('status', '!=', TransactionStatus.VOIDED)
    
    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0
    
    for (const transaction of transactions) {
      if (transaction.transactionType === TransactionType.CHARGE) {
        totalCharges += parseFloat(`${transaction.amount}`) || 0
      } else if (transaction.transactionType === TransactionType.PAYMENT) {
        totalPayments += Math.abs(parseFloat(`${transaction.amount}`) || 0)
      } else if (transaction.transactionType === TransactionType.ADJUSTMENT) {
        totalAdjustments += parseFloat(`${transaction.amount}`) || 0
      }
      
      totalTaxes += parseFloat(`${transaction.taxAmount}`) || 0
      totalServiceCharges += parseFloat(`${transaction.serviceChargeAmount}`) || 0
      totalDiscounts += parseFloat(`${transaction.discountAmount}`) || 0
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