import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import Folio from '#models/folio'
import { createFolioTransactionValidator, updateFolioTransactionValidator } from '#validators/folio_transaction'

export default class FolioTransactionsController {
  /**
   * Display a list of folio transactions
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = request.input('hotel_id')
      const folioId = request.input('folio_id')
      const transactionType = request.input('transaction_type')
      const category = request.input('category')
      const status = request.input('status')
      const dateFrom = request.input('date_from')
      const dateTo = request.input('date_to')
      const amountFrom = request.input('amount_from')
      const amountTo = request.input('amount_to')

      const query = FolioTransaction.query()

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (folioId) {
        query.where('folio_id', folioId)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('transaction_number', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
            .orWhere('reference_number', 'ILIKE', `%${search}%`)
        })
      }

      if (transactionType) {
        query.where('transaction_type', transactionType)
      }

      if (category) {
        query.where('category', category)
      }

      if (status) {
        query.where('status', status)
      }

      if (dateFrom) {
        query.where('transaction_date', '>=', new Date(dateFrom))
      }

      if (dateTo) {
        query.where('transaction_date', '<=', new Date(dateTo))
      }

      if (amountFrom) {
        query.where('amount', '>=', amountFrom)
      }

      if (amountTo) {
        query.where('amount', '<=', amountTo)
      }

      const transactions = await query
        .preload('hotel')
        .preload('folio')
        .preload('paymentMethod')
        .orderBy('transaction_date', 'desc')
        .paginate(page, limit)

      return response.ok({
        message: 'Folio transactions retrieved successfully',
        data: transactions
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve folio transactions',
        error: error.message
      })
    }
  }

  /**
   * Create a new folio transaction
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createFolioTransactionValidator)
      
      // Generate transaction number
      const lastTransaction = await FolioTransaction.query()
        .where('hotel_id', payload.hotel_id)
        .orderBy('created_at', 'desc')
        .first()
      
      const transactionNumber = `TXN-${payload.hotel_id}-${String((lastTransaction?.id || 0) + 1).padStart(10, '0')}`
      
      const transaction = await FolioTransaction.create({
        hotelId: payload.hotel_id,
        folioId: payload.folio_id,
        transactionNumber,
        transactionType: payload.transaction_type,
        category: payload.category as 'room' | 'food_beverage' | 'telephone' | 'laundry' | 'minibar' | 'spa' | 'business_center' | 'parking' | 'internet' | 'miscellaneous' | 'package' | 'incidental' | 'tax' | 'service_charge' | 'deposit' | 'payment' | 'adjustment' || 'miscellaneous',
        description: payload.description,
        amount: payload.amount,
        quantity: payload.quantity || 1,
        unitPrice: payload.unit_price || payload.amount,
        taxAmount: payload.tax_amount || 0,
        taxRate: payload.tax_rate || 0,
        serviceChargeAmount: payload.service_charge_amount || 0,
        serviceChargeRate: payload.service_charge_rate || 0,
        discountAmount: 0,
        discountRate: 0,
        netAmount: payload.amount,
        grossAmount: payload.amount,
        transactionDate: payload.transaction_date ? DateTime.fromJSDate(new Date(payload.transaction_date)) : DateTime.now(),
        postingDate: payload.posting_date ? DateTime.fromJSDate(new Date(payload.posting_date)) : DateTime.now(),
        serviceDate: DateTime.now(),
        reference: payload.reference || '',
        externalReference: payload.external_reference || '',
        status: payload.status,
        cashierId: auth.user?.id || 0,
        createdBy: auth.user?.id || 0
      })

      // Update folio totals
      await this.updateFolioTotals(payload.folio_id)

      await transaction.load('hotel')
      await transaction.load('folio')
      await transaction.load('paymentMethod')

      return response.created({
        message: 'Folio transaction created successfully',
        data: transaction
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create folio transaction',
        error: error.message
      })
    }
  }

  /**
   * Show a specific folio transaction
   */
  async show({ params, response }: HttpContext) {
    try {
      const transaction = await FolioTransaction.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('folio')
        .preload('paymentMethod')
        .firstOrFail()

      return response.ok({
        message: 'Folio transaction retrieved successfully',
        data: transaction
      })
    } catch (error) {
      return response.notFound({
        message: 'Folio transaction not found',
        error: error.message
      })
    }
  }

  /**
   * Update a folio transaction
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const transaction = await FolioTransaction.findOrFail(params.id)
      
      if (transaction.status === 'posted') {
        return response.badRequest({
          message: 'Cannot update posted transactions'
        })
      }

      const payload = await request.validateUsing(updateFolioTransactionValidator)

      // Map validator properties to model properties
      if (payload.hotel_id) transaction.hotelId = payload.hotel_id
      if (payload.folio_id) transaction.folioId = payload.folio_id
      if (payload.transaction_type) transaction.transactionType = payload.transaction_type
      if (payload.category) transaction.category = payload.category as 'room' | 'food_beverage' | 'telephone' | 'laundry' | 'minibar' | 'spa' | 'business_center' | 'parking' | 'internet' | 'miscellaneous' | 'package' | 'incidental' | 'tax' | 'service_charge' | 'deposit' | 'payment' | 'adjustment'
      if (payload.description) transaction.description = payload.description
      if (payload.amount) transaction.amount = payload.amount
      if (payload.quantity) transaction.quantity = payload.quantity
      if (payload.unit_price) transaction.unitPrice = payload.unit_price
      if (payload.tax_amount) transaction.taxAmount = payload.tax_amount
      if (payload.tax_rate) transaction.taxRate = payload.tax_rate
      if (payload.service_charge_amount) transaction.serviceChargeAmount = payload.service_charge_amount
      if (payload.service_charge_rate) transaction.serviceChargeRate = payload.service_charge_rate
      if (payload.reference) transaction.reference = payload.reference
      if (payload.external_reference) transaction.externalReference = payload.external_reference
      if (payload.status) transaction.status = payload.status
      if (payload.transaction_date) transaction.transactionDate = DateTime.fromJSDate(new Date(payload.transaction_date))
      if (payload.posting_date) transaction.postingDate = DateTime.fromJSDate(new Date(payload.posting_date))
      
      transaction.lastModifiedBy = auth.user?.id || 0

      await transaction.save()

      // Update folio totals
      await this.updateFolioTotals(transaction.folioId)

      await transaction.load('hotel')
      await transaction.load('folio')
      await transaction.load('paymentMethod')

      return response.ok({
        message: 'Folio transaction updated successfully',
        data: transaction
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update folio transaction',
        error: error.message
      })
    }
  }

  /**
   * Delete a folio transaction
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const transaction = await FolioTransaction.findOrFail(params.id)
      
      if (transaction.status === 'posted') {
        return response.badRequest({
          message: 'Cannot delete posted transactions'
        })
      }

      const folioId = transaction.folioId
      await transaction.delete()

      // Update folio totals
      await this.updateFolioTotals(folioId)

      return response.ok({
        message: 'Folio transaction deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete folio transaction',
        error: error.message
      })
    }
  }

  /**
   * Post a transaction
   */
  async post({ params, response, auth }: HttpContext) {
    try {
      const transaction = await FolioTransaction.findOrFail(params.id)
      
      if (transaction.status === 'posted') {
        return response.badRequest({
          message: 'Transaction is already posted'
        })
      }

      transaction.status = 'posted'
      transaction.lastModifiedBy = auth.user?.id || 0
      
      await transaction.save()

      // Update folio totals
      await this.updateFolioTotals(transaction.folioId)

      return response.ok({
        message: 'Transaction posted successfully',
        data: transaction
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to post transaction',
        error: error.message
      })
    }
  }

  /**
   * Void a transaction
   */
  async void({ params, request, response, auth }: HttpContext) {
    try {
      const transaction = await FolioTransaction.findOrFail(params.id)
      const { reason } = request.only(['reason'])
      
      if (transaction.isVoided) {
        return response.badRequest({
          message: 'Transaction is already voided'
        })
      }

      if (!transaction.canBeVoided) {
        return response.badRequest({
          message: 'Transaction cannot be voided'
        })
      }

      transaction.isVoided = true
      transaction.voidedAt = DateTime.now()
      transaction.voidedBy = auth.user?.id || 0
      transaction.voidReason = reason
      transaction.lastModifiedBy = auth.user?.id || 0
      
      await transaction.save()

      // Update folio totals
      await this.updateFolioTotals(transaction.folioId)

      return response.ok({
        message: 'Transaction voided successfully',
        data: transaction
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to void transaction',
        error: error.message
      })
    }
  }

  /**
   * Refund a transaction
   */
  async refund({ params, request, response, auth }: HttpContext) {
    try {
      const transaction = await FolioTransaction.findOrFail(params.id)
      const { amount, reason, refundMethod } = request.only(['amount', 'reason', 'refundMethod'])
      
      if (!transaction.canBeRefunded) {
        return response.badRequest({
          message: 'Transaction cannot be refunded'
        })
      }

      const refundAmount = amount || transaction.amount
      
      if (refundAmount > transaction.amount) {
        return response.badRequest({
          message: 'Refund amount cannot exceed original amount'
        })
      }

      // Create refund transaction
      const refundTransaction = await FolioTransaction.create({
          hotelId: transaction.hotelId,
        folioId: transaction.folioId,
        transactionNumber: `REF-${transaction.transactionNumber}`,
        transactionType: 'refund',
        category: transaction.category,
        description: `Refund: ${transaction.description}`,
        amount: -refundAmount,
        originalTransactionId: transaction.id,
        refundReason: reason,
        paymentMethodId: refundMethod || transaction.paymentMethodId,
        cashierId: auth.user?.id,
        createdBy: auth.user?.id
      })

      // Update original transaction
      transaction.isRefund = true
      transaction.lastModifiedBy = auth.user?.id || 0
      
      await transaction.save()

      // Update folio totals
      await this.updateFolioTotals(transaction.folioId)

      return response.ok({
        message: 'Transaction refunded successfully',
        data: {
          originalTransaction: transaction,
          refundTransaction
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to refund transaction',
        error: error.message
      })
    }
  }

  /**
   * Transfer transaction to another folio
   */
  async transfer({ params, request, response, auth }: HttpContext) {
    try {
      const transaction = await FolioTransaction.findOrFail(params.id)
      const { targetFolioId, reason } = request.only(['targetFolioId', 'reason'])
      
      if (!targetFolioId) {
        return response.badRequest({
          message: 'Target folio ID is required'
        })
      }

      const originalFolioId = transaction.folioId

      // Create transfer-out transaction in original folio
      await FolioTransaction.create({
        hotelId: transaction.hotelId,
        folioId: originalFolioId,
        transactionNumber: `TRF-OUT-${transaction.transactionNumber}`,
        transactionType: 'transfer',
        category: transaction.category,
        description: `Transfer out: ${transaction.description}`,
        amount: -transaction.amount,
        transferredTo: targetFolioId,
        transferReason: reason,
        originalTransactionId: transaction.id,
        cashierId: auth.user?.id || 0,
        createdBy: auth.user?.id || 0
      })

      // Create transfer-in transaction in target folio
      await FolioTransaction.create({
        hotelId: transaction.hotelId,
        folioId: targetFolioId,
        transactionNumber: `TRF-IN-${transaction.transactionNumber}`,
        transactionType: 'transfer',
        category: transaction.category,
        description: `Transfer in: ${transaction.description}`,
        amount: transaction.amount,
        transferredFrom: originalFolioId,
        transferReason: reason,
        originalTransactionId: transaction.id,
        cashierId: auth.user?.id || 0,
        createdBy: auth.user?.id || 0
      })

      // Update original transaction
      transaction.transferredTo = targetFolioId
      transaction.lastModifiedBy = auth.user?.id || 0
      
      await transaction.save()

      // Update both folio totals
      await this.updateFolioTotals(originalFolioId)
      await this.updateFolioTotals(targetFolioId)

      return response.ok({
        message: 'Transaction transferred successfully',
        data: transaction
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to transfer transaction',
        error: error.message
      })
    }
  }

  /**
   * Get transaction statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { hotelId, folioId, period } = request.only(['hotelId', 'folioId', 'period'])
      
      const query = FolioTransaction.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }
      if (folioId) {
        query.where('folio_id', folioId)
      }

      // Apply period filter if provided
      if (period) {
        const now = new Date()
        let startDate: Date
        
        switch (period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            break
          default:
            startDate = new Date(0)
        }
        
        query.where('transaction_date', '>=', startDate)
      }

      const totalTransactions = await query.clone().count('* as total')
      const chargeTransactions = await query.clone().where('transaction_type', 'charge').count('* as total')
      const paymentTransactions = await query.clone().where('transaction_type', 'payment').count('* as total')
      const adjustmentTransactions = await query.clone().where('transaction_type', 'adjustment').count('* as total')
      const voidedTransactions = await query.clone().where('is_voided', true).count('* as total')
      const refundedTransactions = await query.clone().where('is_refunded', true).count('* as total')
      
      const totalAmount = await query.clone().sum('amount as amount')
      const totalCharges = await query.clone().where('transaction_type', 'charge').sum('amount as amount')
      const totalPayments = await query.clone().where('transaction_type', 'payment').sum('amount as amount')

      const stats = {
        totalTransactions: totalTransactions[0].$extras.total,
        chargeTransactions: chargeTransactions[0].$extras.total,
        paymentTransactions: paymentTransactions[0].$extras.total,
        adjustmentTransactions: adjustmentTransactions[0].$extras.total,
        voidedTransactions: voidedTransactions[0].$extras.total,
        refundedTransactions: refundedTransactions[0].$extras.total,
        totalAmount: totalAmount[0].$extras.amount || 0,
        totalCharges: totalCharges[0].$extras.amount || 0,
        totalPayments: totalPayments[0].$extras.amount || 0
      }

      return response.ok({
        message: 'Transaction statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }

  /**
   * Private method to update folio totals
   */
  private async updateFolioTotals(folioId: number) {
    const folio = await Folio.findOrFail(folioId)
    
    const transactions = await FolioTransaction.query()
      .where('folio_id', folioId)
      .where('is_voided', false)
    
    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0
    
    for (const transaction of transactions) {
      switch (transaction.transactionType) {
        case 'charge':
          totalCharges += transaction.amount
          break
        case 'payment':
          totalPayments += Math.abs(transaction.amount)
          break
        case 'adjustment':
          totalAdjustments += transaction.amount
          break
      }
      
      totalTaxes += transaction.taxAmount || 0
      totalServiceCharges += transaction.serviceChargeAmount || 0
      totalDiscounts += transaction.discountAmount || 0
    }
    
    folio.totalCharges = totalCharges
    folio.totalPayments = totalPayments
    folio.totalAdjustments = totalAdjustments
    folio.totalTaxes = totalTaxes
    folio.totalServiceCharges = totalServiceCharges
    folio.totalDiscounts = totalDiscounts
    folio.balance = totalCharges + totalAdjustments + totalTaxes + totalServiceCharges - totalPayments - totalDiscounts
    
    await folio.save()
  }
}