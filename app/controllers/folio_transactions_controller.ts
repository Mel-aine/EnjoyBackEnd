import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import Folio from '#models/folio'
import { TransactionCategory, TransactionStatus, TransactionType } from '#app/enums'
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
      const hotelId = request.input('hotelId')
      const folioId = request.input('folioId')
      const transactionType = request.input('transactionType')
      const category = request.input('category')
      const status = request.input('status')
      const dateFrom = request.input('dateFrom')
      const dateTo = request.input('dateTo')
      const amountFrom = request.input('amountFrom')
      const amountTo = request.input('amountTo')

      const query = FolioTransaction.query()

      if (hotelId) {
        query.where('hotelId', hotelId)
      }

      if (folioId) {
        query.where('folioId', folioId)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('transaction_number', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
            .orWhere('reference', 'ILIKE', `%${search}%`)
        })
      }

      if (transactionType) {
        query.where('transactionType', transactionType)
      }

      if (category) {
        query.where('category', category)
      }

      if (status) {
        query.where('status', status)
      }

      if (dateFrom) {
        query.where('transactionDate', '>=', new Date(dateFrom))
      }

      if (dateTo) {
        query.where('transactionDate', '<=', new Date(dateTo))
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
        .orderBy('transactionDate', 'desc')
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

      // Get folio to access hotel information
      const folio = await Folio.findOrFail(payload.folioId)

      // Generate transaction number
      const lastTransaction = await FolioTransaction.query()
        .where('hotelId', folio.hotelId)
        .orderBy('transactionNumber', 'desc')
        .first()
      const transactionNumber = (lastTransaction?.transactionNumber || 0) + 1

      // Generate transaction code if not provided
      const transactionCode = payload.transactionCode || `TC-${folio.hotelId}-${String((lastTransaction?.id || 0) + 1).padStart(6, '0')}`

      const transaction = await FolioTransaction.create({
        hotelId: folio.hotelId,
        folioId: payload.folioId,
        transactionNumber,
        transactionCode,
        transactionType: payload.transactionType,
        category: payload.category as TransactionCategory || TransactionCategory.MISCELLANEOUS,
        description: payload.description,
        amount: payload.amount,
        quantity: payload.quantity || 1,
        totalAmount: payload.amount,
        paymentMethodId: payload.paymentMethodId,
        //unitPrice: payload.unit_price || payload.amount,
        //taxAmount: payload.tax_amount || 0,
        // taxRate: payload.tax_rate || 0,
        serviceChargeAmount: payload.serviceChargeAmount || 0,
        serviceChargeRate: payload.serviceChargeRate || 0,
        discountAmount: 0,
        discountRate: 0,
        reservationId: payload.reservationId,
        netAmount: payload.amount,
        grossAmount: payload.amount,
        transactionDate: payload.transactionDate ? DateTime.fromJSDate(new Date(payload.transactionDate)) : DateTime.now(),
        postingDate: payload.postingDate ? DateTime.fromJSDate(new Date(payload.postingDate)) : DateTime.now(),
        serviceDate: DateTime.now(),
        transactionTime: DateTime.now().toISOTime(),

        //reference: payload.reference || '',
        //externalReference: payload.external_reference || '',
        status: payload.status,
        cashierId: auth.user?.id || 0,
        createdBy: auth.user?.id || 0
      })

      // Update folio totals
      await this.updateFolioTotals(payload.folioId)

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

      if (transaction.status === TransactionStatus.POSTED) {
        return response.badRequest({
          message: 'Cannot update posted transactions'
        })
      }

      const payload = await request.validateUsing(updateFolioTransactionValidator)

      // Map validator properties to model properties
      if (payload.hotelId) transaction.hotelId = payload.hotelId
      if (payload.folioId) transaction.folioId = payload.folioId
      if (payload.transactionType) transaction.transactionType = payload.transactionType
      if (payload.category) transaction.category = payload.category as TransactionCategory
      if (payload.description) transaction.description = payload.description
      if (payload.amount) transaction.amount = payload.amount
      if (payload.quantity) transaction.quantity = payload.quantity
      if (payload.unitPrice) transaction.unitPrice = payload.unitPrice
      if (payload.taxAmount) transaction.taxAmount = payload.taxAmount
      if (payload.taxRate) transaction.taxRate = payload.taxRate
      if (payload.serviceChargeAmount) transaction.serviceChargeAmount = payload.serviceChargeAmount
      if (payload.serviceChargeRate) transaction.serviceChargeRate = payload.serviceChargeRate
      //if (payload.discountAmount) transaction.discountAmount = payload.discountAmount
      if (payload.externalReference) transaction.externalReference = payload.externalReference
      if (payload.status) transaction.status = payload.status
      if (payload.transactionDate) transaction.transactionDate = DateTime.fromJSDate(new Date(payload.transactionDate))
      if (payload.postingDate) transaction.postingDate = DateTime.fromJSDate(new Date(payload.postingDate))

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

      if (transaction.status === TransactionStatus.POSTED) {
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

      if (transaction.status === TransactionStatus.POSTED) {
        return response.badRequest({
          message: 'Transaction is already posted'
        })
      }

      transaction.status = TransactionStatus.POSTED
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
        transactionType: TransactionType.REFUND,
        category: transaction.category,
        description: `Refund: ${transaction.description}`,
        amount: -refundAmount,
        originalTransactionId: transaction.id,
        refundReason: reason,
        paymentMethodId: refundMethod || transaction.paymentMethodId,
        cashierId: auth.user?.id,
        createdBy: auth.user?.id,
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
        transactionType: TransactionType.TRANSFER,
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
        transactionType: TransactionType.TRANSFER,
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
        query.where('hotelId', hotelId)
      }
      if (folioId) {
        query.where('folioId', folioId)
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

        query.where('transactionDate', '>=', startDate)
      }

      const totalTransactions = await query.clone().count('* as total')
      const chargeTransactions = await query.clone().where('transactionType', TransactionType.CHARGE).count('* as total')
      const paymentTransactions = await query.clone().where('transactionType', TransactionType.PAYMENT).count('* as total')
      const adjustmentTransactions = await query.clone().where('transactionType', TransactionType.ADJUSTMENT).count('* as total')
      const voidedTransactions = await query.clone().where('isVoided', true).count('* as total')
      const refundedTransactions = await query.clone().where('isRefunded', true).count('* as total')

      const totalAmount = await query.clone().sum('amount as amount')
      const totalCharges = await query.clone().where('transactionType', TransactionType.CHARGE).sum('amount as amount')
      const totalPayments = await query.clone().where('transactionType', TransactionType.PAYMENT).sum('amount as amount')

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
      .where('folioId', folioId)
      .where('isVoided', false)

    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0

    for (const transaction of transactions) {
      switch (transaction.transactionType) {
        case TransactionType.CHARGE:
          totalCharges += parseFloat(`${transaction.amount ?? 0}`)
          break
        case TransactionType.PAYMENT:
          totalPayments += Math.abs(parseFloat(`${transaction.amount ?? 0}`))
          break
        case TransactionType.ADJUSTMENT:
          totalAdjustments += parseFloat(`${transaction.amount ?? 0}`)
          break
      }

      totalTaxes += parseFloat(`${transaction.taxAmount ?? 0}`) || 0
      totalServiceCharges += parseFloat(`${transaction.serviceChargeAmount ?? 0}`) || 0
      totalDiscounts += parseFloat(`${transaction.discountAmount ?? 0}`) || 0
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