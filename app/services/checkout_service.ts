import { DateTime } from 'luxon'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import Reservation from '#models/reservation'
import Guest from '#models/guest'
import FolioService from '#services/folio_service'
import db from '@adonisjs/lucid/services/db'

export interface CheckoutData {
  folioId: number
  paymentMethodId: number
  paymentAmount?: number
  paymentReference?: string
  notes?: string
  processedBy: number
}

export interface SettlementSummary {
  folio: Folio
  totalCharges: number
  totalPayments: number
  totalAdjustments: number
  outstandingBalance: number
  isFullySettled: boolean
  requiresPayment: boolean
  transactions: FolioTransaction[]
}

export interface CheckoutResult {
  folio: Folio
  settlement: SettlementSummary
  paymentTransaction?: FolioTransaction
  checkoutCompleted: boolean
  message: string
}

export default class CheckoutService {
  /**
   * Get settlement summary for a folio
   */
  static async getSettlementSummary(folioId: number): Promise<SettlementSummary> {
    const folio = await Folio.query()
      .where('id', folioId)
      .preload('transactions', (query) => {
        query.where('isVoided', false).orderBy('transactionDate', 'asc')
      })
      .firstOrFail()
    
    const transactions = folio.transactions
    
    const totalCharges = transactions
      .filter(t => t.transactionType === 'charge')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalPayments = transactions
      .filter(t => t.transactionType === 'payment')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const totalAdjustments = transactions
      .filter(t => t.transactionType === 'adjustment')
      .reduce((sum, t) => sum + t.amount, 0)
    
    const outstandingBalance = totalCharges - totalPayments + totalAdjustments
    const isFullySettled = Math.abs(outstandingBalance) < 0.01 // Account for floating point precision
    const requiresPayment = outstandingBalance > 0.01
    
    return {
      folio,
      totalCharges,
      totalPayments,
      totalAdjustments,
      outstandingBalance,
      isFullySettled,
      requiresPayment,
      transactions
    }
  }
  
  /**
   * Process checkout for a folio
   */
  static async processCheckout(data: CheckoutData): Promise<CheckoutResult> {
    return await db.transaction(async (trx) => {
      // Get settlement summary
      const settlement = await this.getSettlementSummary(data.folioId)
      
      if (!settlement.folio.canBeModified) {
        throw new Error('Folio cannot be modified - already finalized or closed')
      }
      
      let paymentTransaction: FolioTransaction | undefined
      let checkoutCompleted = false
      let message = ''
      
      // If payment is required and provided
      if (settlement.requiresPayment && data.paymentAmount && data.paymentAmount > 0) {
        // Validate payment amount
        if (data.paymentAmount < settlement.outstandingBalance) {
          message = 'Partial payment processed - folio remains open'
        } else if (data.paymentAmount > settlement.outstandingBalance) {
          message = 'Overpayment processed - change due to guest'
        } else {
          message = 'Full payment processed - folio settled'
        }
        
        // Create payment transaction
        paymentTransaction = await FolioService.postTransaction({
          folioId: data.folioId,
          transactionType: 'payment',
          category: 'payment',
          description: `Checkout payment`,
          amount: data.paymentAmount,
          quantity: 1,
          unitPrice: data.paymentAmount,
          paymentMethodId: data.paymentMethodId,
          reference: data.paymentReference || `PAY-${DateTime.now().toFormat('yyyyMMddHHmmss')}`,
          notes: data.notes || `Checkout payment`,
          postedBy: data.processedBy
        })
      }
      
      // Recalculate settlement after payment
      const updatedSettlement = await this.getSettlementSummary(data.folioId)
      
      // If folio is now fully settled, close it
      if (updatedSettlement.isFullySettled) {
        await FolioService.closeFolio(data.folioId)
        checkoutCompleted = true
        if (!message) message = 'Checkout completed - folio closed'
      } else if (updatedSettlement.requiresPayment) {
        // Still has outstanding balance
        if (!message) message = 'Outstanding balance remains - folio kept open'
      } else {
        // Credit balance
        if (!message) message = 'Credit balance on folio - manual review required'
      }
      
      // Get updated folio
      const updatedFolio = await Folio.find(data.folioId)
      
      return {
        folio: updatedFolio!,
        settlement: updatedSettlement,
        paymentTransaction,
        checkoutCompleted,
        message
      }
    })
  }
  
  /**
   * Process checkout for reservation (handles multiple folios if needed)
   */
  static async processReservationCheckout(
    reservationId: number, 
    paymentData: Omit<CheckoutData, 'folioId'>[], 
    processedBy: number
  ): Promise<CheckoutResult[]> {
    return await db.transaction(async (trx) => {
      // Get all folios for the reservation
      const folios = await Folio.query({ client: trx })
        .where('reservationId', reservationId)
        .where('workflowStatus', '!=', 'closed')
      
      if (folios.length === 0) {
        throw new Error('No open folios found for this reservation')
      }
      
      const results: CheckoutResult[] = []
      
      // Process checkout for each folio
      for (let i = 0; i < folios.length; i++) {
        const folio = folios[i]
        const payment = paymentData[i] || paymentData[0] // Use first payment if not enough provided
        
        const checkoutData: CheckoutData = {
          folioId: folio.id,
          ...payment,
          processedBy
        }
        
        const result = await this.processCheckout(checkoutData)
        results.push(result)
      }
      
      // Update reservation status if all folios are closed
      const allFoliosClosed = results.every(r => r.checkoutCompleted)
      if (allFoliosClosed) {
        await Reservation.query({ client: trx })
          .where('id', reservationId)
          .update({
            status: 'checked_out',
            actualCheckOutDate: DateTime.now().toJSDate(),
            lastModifiedBy: processedBy
          })
      }
      
      return results
    })
  }
  
  /**
   * Force close folio with outstanding balance (requires authorization)
   */
  static async forceCloseFolio(
    folioId: number, 
    reason: string, 
    authorizedBy: number, 
    processedBy: number
  ): Promise<Folio> {
    return await db.transaction(async (trx) => {
      const settlement = await this.getSettlementSummary(folioId)
      
      if (settlement.outstandingBalance !== 0) {
        // Create adjustment to zero out the balance
        const adjustmentAmount = -settlement.outstandingBalance
        const adjustmentType = settlement.outstandingBalance > 0 ? 'write_off' : 'correction'
        
        await FolioService.postTransaction({
          folioId,
          transactionType: 'adjustment',
          category: adjustmentType,
          description: `Force closure adjustment - ${reason}`,
          amount: adjustmentAmount,
          quantity: 1,
          unitPrice: adjustmentAmount,
          reference: `ADJ-FORCE-${DateTime.now().toFormat('yyyyMMddHHmmss')}`,
          notes: `Force closure authorized by user ${authorizedBy}. Reason: ${reason}`,
          postedBy: processedBy
        })
      }
      
      // Close the folio
      return await FolioService.closeFolio(folioId)
    })
  }
  
  /**
   * Get checkout summary for display
   */
  static async getCheckoutSummary(folioId: number): Promise<{
    folio: Folio
    settlement: SettlementSummary
    recommendedPayment: number
    canCheckout: boolean
    warnings: string[]
  }> {
    const settlement = await this.getSettlementSummary(folioId)
    const warnings: string[] = []
    
    // Check for potential issues
    if (!settlement.folio.canBeModified) {
      warnings.push('Folio is already finalized or closed')
    }
    
    if (settlement.outstandingBalance < 0) {
      warnings.push('Folio has a credit balance - refund may be required')
    }
    
    if (settlement.transactions.length === 0) {
      warnings.push('Folio has no transactions')
    }
    
    const recommendedPayment = Math.max(0, settlement.outstandingBalance)
    const canCheckout = settlement.folio.canBeModified
    
    return {
      folio: settlement.folio,
      settlement,
      recommendedPayment,
      canCheckout,
      warnings
    }
  }
  
  /**
   * Validate checkout eligibility
   */
  static async validateCheckoutEligibility(folioId: number): Promise<{
    eligible: boolean
    reasons: string[]
  }> {
    const folio = await Folio.query()
      .where('id', folioId)
      .preload('reservation')
      .firstOrFail()
    
    const reasons: string[] = []
    
    if (!folio.canBeModified) {
      reasons.push('Folio is already finalized or closed')
    }
    
    if (folio.workflowStatus === 'draft') {
      reasons.push('Folio is still in draft status')
    }
    
    if (folio.reservation && folio.reservation.status === 'cancelled') {
      reasons.push('Associated reservation is cancelled')
    }
    
    return {
      eligible: reasons.length === 0,
      reasons
    }
  }
}