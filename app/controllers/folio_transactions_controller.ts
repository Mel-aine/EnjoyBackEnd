import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import Folio from '#models/folio'
import ReceiptService from '#services/receipt_service'
import LoggerService from '#services/logger_service'
import { TransactionCategory, TransactionStatus, TransactionType, PaymentMethodType } from '#app/enums'
import PaymentMethod from '#models/payment_method'
import CityLedgerService from '#services/city_ledger_service'
import FolioService from '#services/folio_service'
import { createFolioTransactionValidator, updateFolioTransactionValidator } from '#validators/folio_transaction'
import Currency from '#models/currency'
import CurrencyCacheService from '#services/currency_cache_service'
import { generateTransactionCode } from '../utils/generate_guest_code.js'

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
  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    try {
      const payload = await request.validateUsing(createFolioTransactionValidator)

      // Get folio to access hotel information
      const folio = await Folio.findOrFail(payload.folioId)

      // Resolve default/base currency for the hotel
      const defaultCurrencyPayload = await CurrencyCacheService.getHotelDefaultCurrency(folio.hotelId)
      if (!defaultCurrencyPayload) {
        return response.badRequest({
          message: 'Default currency not configured for this hotel'
        })
      }
      const baseCurrencyCode: string = defaultCurrencyPayload.currencyCode

      // Generate transaction number
      const lastTransaction = await FolioTransaction.query()
        .where('hotelId', folio.hotelId)
        .select(['id','transactionNumber'])
        .orderBy('transactionNumber', 'desc')
        .first()
      const transactionNumber = (Number(lastTransaction?.transactionNumber) || 0) + 1
      console.log('transactionNumber',transactionNumber)

      // Generate transaction code if not provided
      const transactionCode = generateTransactionCode()

      // Map category to particular description
      const category = payload.category as TransactionCategory || TransactionCategory.MISCELLANEOUS
      let particular = 'Miscellaneous Transaction'

      switch (category) {
        case TransactionCategory.ROOM:
          particular = 'Room Charge'
          break
        case TransactionCategory.FOOD_BEVERAGE:
          particular = 'Food & Beverage'
          break
        case TransactionCategory.TELEPHONE:
          particular = 'Telephone Charge'
          break
        case TransactionCategory.LAUNDRY:
          particular = 'Laundry Service'
          break
        case TransactionCategory.MINIBAR:
          particular = 'Minibar Charge'
          break
        case TransactionCategory.SPA:
          particular = 'Spa Service'
          break
        case TransactionCategory.BUSINESS_CENTER:
          particular = 'Business Center'
          break
        case TransactionCategory.PARKING:
          particular = 'Parking Fee'
          break
        case TransactionCategory.INTERNET:
          particular = 'Internet Service'
          break
        case TransactionCategory.PAYMENT:
          particular = 'Payment Received'
          break
        case TransactionCategory.ADJUSTMENT:
          particular = 'Folio Adjustment'
          break
        case TransactionCategory.TAX:
          particular = 'Tax Charge'
          break
        case TransactionCategory.SERVICE_CHARGE:
          particular = 'Service Charge'
          break
        case TransactionCategory.CANCELLATION_FEE:
          particular = 'Cancellation Fee'
          break
        case TransactionCategory.NO_SHOW_FEE:
          particular = 'No Show Fee'
          break
        case TransactionCategory.EARLY_DEPARTURE_FEE:
          particular = 'Early Departure Fee'
          break
        case TransactionCategory.LATE_CHECKOUT_FEE:
          particular = 'Late Checkout Fee'
          break
        case TransactionCategory.EXTRA_BED:
          particular = 'Extra Bed Charge'
          break
        case TransactionCategory.CITY_TAX:
          particular = 'City Tax'
          break
        case TransactionCategory.RESORT_FEE:
          particular = 'Resort Fee'
          break
        case TransactionCategory.TRANSFER_IN:
          particular = 'Transfer In'
          break
        case TransactionCategory.TRANSFER_OUT:
          particular = 'Transfer Out'
          break
        case TransactionCategory.VOID:
          particular = 'Void Transaction'
          break
        case TransactionCategory.REFUND:
          particular = 'Refund'
          break
        case TransactionCategory.EXTRACT_CHARGE:
          particular = 'Extract Charge'
          break
        default:
          particular = 'Miscellaneous Charge'
      }

      // Currency conversion
      const transactionCurrencyCode: string = (payload.currency || baseCurrencyCode).toUpperCase()
      let usedExchangeRate = 1
      let baseAmount = payload.amount

      // Look up the exchange rate for the transaction currency from the currencies table
      let exchangeRateDate = DateTime.now()
      if (transactionCurrencyCode !== baseCurrencyCode) {
        const currencyRow = await Currency.query()
          .where('hotel_id', folio.hotelId)
          .where('currency_code', transactionCurrencyCode)
          .first()

        usedExchangeRate = currencyRow?.exchangeRate ?? 1
        // Use the currency's last update time as the effective date of the rate, fallback to now
        exchangeRateDate = currencyRow?.updatedAt ?? DateTime.now()
        baseAmount = Number((payload.amount * usedExchangeRate).toFixed(2))
      } else {
        usedExchangeRate = 1
        baseAmount = Number(payload.amount.toFixed(2))
        exchangeRateDate = DateTime.now()
      }

      const transaction = await FolioTransaction.create({
        hotelId: folio.hotelId,
        folioId: payload.folioId,
        transactionNumber,
        transactionCode,
        transactionType: payload.transactionType,
        category: category,
        particular: particular,
        description: payload.description,
        notes: payload.notes || '',

        // Persist base amount into the canonical amount fields
        amount: baseAmount,
        totalAmount: baseAmount,
        netAmount: baseAmount,
        grossAmount: baseAmount,
        baseCurrencyAmount: baseAmount,

        // Track original/source currency details
        originalAmount: payload.amount,
        originalCurrency: transactionCurrencyCode,
        exchangeRate: usedExchangeRate,
        exchangeRateDate,
        currencyCode: baseCurrencyCode,

        quantity: payload.quantity || 1,
        paymentMethodId: payload.paymentMethodId,
        extraChargeId: payload.extraChargeId,
        serviceChargeAmount: payload.serviceChargeAmount || 0,
        serviceChargeRate: payload.serviceChargeRate || 0,
        discountAmount: 0,
        discountRate: 0,
        reservationId: payload.reservationId,

        transactionDate: payload.transactionDate ? DateTime.fromJSDate(new Date(payload.transactionDate)) : DateTime.now(),
        postingDate: payload.postingDate ? DateTime.fromJSDate(new Date(payload.postingDate)) : DateTime.now(),
        serviceDate: DateTime.now(),
        transactionTime: DateTime.now().toISOTime(),

        status: payload.status,
        cashierId: auth.user?.id || 0,
        createdBy: auth.user?.id || 0
      })

      // Update folio totals
      await this.updateFolioTotals(payload.folioId)

      // Create receipt if this is a payment transaction
      if (payload.transactionType === TransactionType.PAYMENT && payload.paymentMethodId) {
        try {
          await ReceiptService.createReceipt({
            tenantId: folio.guestId || 0, // Use guestId from folio
            hotelId: folio.hotelId,
            paymentDate: transaction.transactionDate,
            paymentMethodId: payload.paymentMethodId,
            totalAmount: transaction.amount,
            description: transaction.description,
            breakdown: {
              payment: transaction.amount,
              serviceCharge: transaction.serviceChargeAmount || 0
            },
            createdBy: auth.user?.id || 0,
            folioTransactionId: transaction.id,
            currency: folio.currencyCode || 'XAF'
          })
          // If payment method is City Ledger, create a child transaction on company folio
          try {
            const pm = await PaymentMethod.find(payload.paymentMethodId)
            if (pm && pm.methodType === PaymentMethodType.CITY_LEDGER) {
              // Ensure folio has guest and reservationRoom->room preloaded before creating CL child
              await transaction.load('folio', (folioQuery: any) => {
                folioQuery.preload('guest')
                folioQuery.preload('reservationRoom', (roomQuery: any) => {
                  roomQuery.preload('room')
                })
              })
              const result = await CityLedgerService.createCityLedgerChildForPayment({
                originalTransaction: transaction,
                postedBy: auth.user?.id || 0,
                ctx
              })

              if (result) {
                await LoggerService.log({
                  actorId: auth.user?.id || 0,
                  action: 'CREATE',
                  entityType: 'CityLedgerChildTransaction',
                  entityId: result.child.id,
                  description: 'Created City Ledger child transaction for payment',
                  meta: {
                    parentTransactionId: transaction.id,
                    childTransactionId: result.child.id,
                    companyFolioId: result.child.folioId,
                    currentBalance: result.currentBalance,
                  },
                  hotelId: transaction.hotelId,
                  ctx
                })
              }
            }
          } catch (clError) {
            await LoggerService.log({
              actorId: auth.user?.id || 0,
              action: 'ERROR',
              entityType: 'CityLedgerChildTransaction',
              entityId: transaction.id,
              description: 'Failed to create City Ledger child transaction',
              meta: {
                error: clError.message,
                parentTransactionId: transaction.id,
              },
              hotelId: transaction.hotelId,
              ctx
            })
          }
          await LoggerService.log({
            actorId: auth.user?.id || 0,
            action: 'CREATE',
            entityType: 'Receipt',
            entityId: transaction.id,
            description: 'Receipt created for payment transaction',
            meta: {
              transactionId: transaction.id,
              folioId: folio.id,
              amount: transaction.amount
            },
            hotelId: transaction.hotelId,
            ctx:ctx
          })
        } catch (receiptError) {
          // Log error but don't fail the transaction creation
          await LoggerService.log({
            actorId: auth.user?.id || 0,
            action: 'ERROR',
            entityType: 'Receipt',
            entityId: transaction.id,
            description: 'Failed to create receipt for payment transaction',
            meta: {
              error: receiptError.message,
              transactionId: transaction.id,
              folioId: folio.id
            },
            hotelId: transaction.hotelId,
            ctx: ctx
          })
        }
      }

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
      const payload = await request.validateUsing(updateFolioTransactionValidator)

      const transactionId = Number(params.id)
      if (!transactionId) {
        return response.badRequest({ message: 'Transaction ID is required' })
      }

      // Prepare data for service-level update mirroring postTransaction logic
      const dataForService = {
        description: payload.description,
        category: payload.category as TransactionCategory,
        transactionType: payload.transactionType as TransactionType,
        paymentMethodId: payload.paymentMethodId,
        notes: payload.internalNotes || payload.notes,
        amount: payload.amount,
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        taxAmount: payload.taxAmount,
        discountAmount: payload.discountAmount,
        discountId: payload.discountId,
        serviceChargeAmount: payload.serviceChargeAmount,
        transactionDate: payload.transactionDate ? DateTime.fromJSDate(new Date(payload.transactionDate)) : undefined,
      }

      const updated = await FolioService.updateTransaction(transactionId, dataForService, auth.user!.id)

      // Apply additional optional fields not handled by service
      if (payload.externalReference) updated.externalReference = payload.externalReference
      if (payload.status) updated.status = payload.status
      if (payload.postingDate) updated.postingDate = DateTime.fromJSDate(new Date(payload.postingDate))

      updated.lastModifiedBy = auth.user?.id || 0
      await updated.save()

      // Update folio totals (service does this, but keeping consistent here)
      await this.updateFolioTotals(updated.folioId)

      return response.ok({
        message: 'Folio transaction updated successfully',
        data: updated,
      })
    } catch (error) {
      // Provide field-level details on validation failures
      if ((error as any)?.code === 'E_VALIDATION_ERROR') {
        const err: any = error
        const fields = Array.isArray(err.errors)
          ? err.errors.map((e: any) => ({ field: e.field, message: e.message, rule: e.rule }))
          : []

        return response.badRequest({
          message: 'Validation failed',
          errors: typeof err.messages === 'function' ? err.messages() : err.messages,
          fields,
        })
      }

      return response.badRequest({
        message: 'Failed to update folio transaction',
        error: (error as any)?.message
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

      transaction.isVoided = true
      transaction.voidedAt = DateTime.now()
      transaction.voidedBy = auth.user?.id || 0
      transaction.voidReason = reason
      transaction.lastModifiedBy = auth.user?.id || 0
      transaction.status = TransactionStatus.VOIDED
      transaction.notes += `\nVoid reason: ${reason || 'Transaction voided'}`
      await transaction.save()

      // Update folio totals
      await this.updateFolioTotals(transaction.folioId)

      // Void related receipt if this is a payment transaction
      if (transaction.transactionType === TransactionType.PAYMENT) {
        try {
          await ReceiptService.voidReceipt({
            transactionId: transaction.id,
            voidedBy: auth.user?.id!,
            voidReason: reason
          })

          await LoggerService.log({
            actorId: auth.user?.id || 0,
            action: 'VOID',
            entityType: 'Receipt',
            entityId: transaction.id,
            description: 'Receipt voided for payment transaction',
            meta: {
              transactionId: transaction.id,
              folioId: transaction.folioId,
              voidedBy: auth.user?.id
            },
            hotelId: transaction.hotelId,
            ctx: { request, response }
          })
        } catch (receiptError) {
          // Log error but don't fail the transaction voiding
          await LoggerService.log({
            actorId: auth.user?.id || 0,
            action: 'ERROR',
            entityType: 'Receipt',
            entityId: transaction.id,
            description: 'Failed to void receipt for payment transaction',
            meta: {
              error: receiptError.message,
              transactionId: transaction.id,
              folioId: transaction.folioId
            },
            hotelId: transaction.hotelId,
            ctx: { request, response }
          })
        }
      }

      // Cascade voiding to child transactions linked via originalTransactionId
      try {
        const childTransactions = await FolioTransaction.query()
          .where('originalTransactionId', transaction.id)
          .where('isVoided', false)

        for (const child of childTransactions) {
          child.isVoided = true
          child.voidedAt = DateTime.now()
          child.voidedBy = auth.user?.id || 0
          child.voidReason = reason || `Parent transaction ${transaction.id} voided`
          child.lastModifiedBy = auth.user?.id || 0
          child.status = TransactionStatus.VOIDED
          child.notes = `${child.notes || ''}\nVoid reason: ${child.voidReason}`
          await child.save()

          // Update child folio totals
          await this.updateFolioTotals(child.folioId)

          // Void receipt if child is a payment transaction
          if (child.transactionType === TransactionType.PAYMENT) {
            try {
              await ReceiptService.voidReceipt({
                transactionId: child.id,
                voidedBy: auth.user?.id!,
                voidReason: child.voidReason
              })

              await LoggerService.log({
                actorId: auth.user?.id || 0,
                action: 'VOID',
                entityType: 'Receipt',
                entityId: child.id,
                description: 'Receipt voided for child payment transaction',
                meta: {
                  parentTransactionId: transaction.id,
                  childTransactionId: child.id,
                  folioId: child.folioId,
                },
                hotelId: child.hotelId,
                ctx: { request, response }
              })
            } catch (childReceiptError) {
              await LoggerService.log({
                actorId: auth.user?.id || 0,
                action: 'ERROR',
                entityType: 'Receipt',
                entityId: child.id,
                description: 'Failed to void receipt for child payment transaction',
                meta: {
                  error: childReceiptError.message,
                  parentTransactionId: transaction.id,
                  childTransactionId: child.id,
                  folioId: child.folioId,
                },
                hotelId: child.hotelId,
                ctx: { request, response }
              })
            }
          }

          await LoggerService.log({
            actorId: auth.user?.id || 0,
            action: 'VOID',
            entityType: 'FolioTransaction',
            entityId: child.id,
            description: 'Child transaction voided due to parent void',
            meta: {
              parentTransactionId: transaction.id,
              childTransactionId: child.id,
              voidReason: child.voidReason,
            },
            hotelId: child.hotelId,
            ctx: { request, response }
          })
        }
      } catch (cascadeError) {
        await LoggerService.log({
          actorId: auth.user?.id || 0,
          action: 'ERROR',
          entityType: 'FolioTransaction',
          entityId: transaction.id,
          description: 'Failed cascading void to child transactions',
          meta: {
            error: cascadeError.message,
            parentTransactionId: transaction.id,
          },
          hotelId: transaction.hotelId,
          ctx: { request, response }
        })
      }

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

      // Map category to particular description for refund
      let particular = 'Refund'
      switch (transaction.category) {
        case TransactionCategory.ROOM:
          particular = 'Room Charge Refund'
          break
        case TransactionCategory.FOOD_BEVERAGE:
          particular = 'Food & Beverage Refund'
          break
        case TransactionCategory.TELEPHONE:
          particular = 'Telephone Charge Refund'
          break
        case TransactionCategory.LAUNDRY:
          particular = 'Laundry Service Refund'
          break
        case TransactionCategory.MINIBAR:
          particular = 'Minibar Charge Refund'
          break
        case TransactionCategory.SPA:
          particular = 'Spa Service Refund'
          break
        case TransactionCategory.BUSINESS_CENTER:
          particular = 'Business Center Refund'
          break
        case TransactionCategory.PARKING:
          particular = 'Parking Fee Refund'
          break
        case TransactionCategory.INTERNET:
          particular = 'Internet Service Refund'
          break
        case TransactionCategory.PAYMENT:
          particular = 'Payment Refund'
          break
        case TransactionCategory.ADJUSTMENT:
          particular = 'Adjustment Refund'
          break
        case TransactionCategory.TAX:
          particular = 'Tax Refund'
          break
        case TransactionCategory.SERVICE_CHARGE:
          particular = 'Service Charge Refund'
          break
        case TransactionCategory.CANCELLATION_FEE:
          particular = 'Cancellation Fee Refund'
          break
        case TransactionCategory.NO_SHOW_FEE:
          particular = 'No Show Fee Refund'
          break
        case TransactionCategory.EARLY_DEPARTURE_FEE:
          particular = 'Early Departure Fee Refund'
          break
        case TransactionCategory.LATE_CHECKOUT_FEE:
          particular = 'Late Checkout Fee Refund'
          break
        case TransactionCategory.EXTRA_BED:
          particular = 'Extra Bed Charge Refund'
          break
        case TransactionCategory.CITY_TAX:
          particular = 'City Tax Refund'
          break
        case TransactionCategory.RESORT_FEE:
          particular = 'Resort Fee Refund'
          break
        default:
          particular = 'Miscellaneous Refund'
      }

      // Create refund transaction
      const refundTransaction = await FolioTransaction.create({
        hotelId: transaction.hotelId,
        folioId: transaction.folioId,
        transactionNumber: `REF-${transaction.transactionNumber}`,
        transactionType: TransactionType.REFUND,
        category: transaction.category,
        particular: particular,
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

      // Map category to particular description for transfer
      let transferOutParticular = 'Transfer Out'
      let transferInParticular = 'Transfer In'

      switch (transaction.category) {
        case TransactionCategory.ROOM:
          transferOutParticular = 'Room Charge Transfer Out'
          transferInParticular = 'Room Charge Transfer In'
          break
        case TransactionCategory.FOOD_BEVERAGE:
          transferOutParticular = 'Food & Beverage Transfer Out'
          transferInParticular = 'Food & Beverage Transfer In'
          break
        case TransactionCategory.TELEPHONE:
          transferOutParticular = 'Telephone Charge Transfer Out'
          transferInParticular = 'Telephone Charge Transfer In'
          break
        case TransactionCategory.LAUNDRY:
          transferOutParticular = 'Laundry Service Transfer Out'
          transferInParticular = 'Laundry Service Transfer In'
          break
        case TransactionCategory.MINIBAR:
          transferOutParticular = 'Minibar Charge Transfer Out'
          transferInParticular = 'Minibar Charge Transfer In'
          break
        case TransactionCategory.SPA:
          transferOutParticular = 'Spa Service Transfer Out'
          transferInParticular = 'Spa Service Transfer In'
          break
        case TransactionCategory.BUSINESS_CENTER:
          transferOutParticular = 'Business Center Transfer Out'
          transferInParticular = 'Business Center Transfer In'
          break
        case TransactionCategory.PARKING:
          transferOutParticular = 'Parking Fee Transfer Out'
          transferInParticular = 'Parking Fee Transfer In'
          break
        case TransactionCategory.INTERNET:
          transferOutParticular = 'Internet Service Transfer Out'
          transferInParticular = 'Internet Service Transfer In'
          break
        case TransactionCategory.PAYMENT:
          transferOutParticular = 'Payment Transfer Out'
          transferInParticular = 'Payment Transfer In'
          break
        case TransactionCategory.ADJUSTMENT:
          transferOutParticular = 'Adjustment Transfer Out'
          transferInParticular = 'Adjustment Transfer In'
          break
        case TransactionCategory.TAX:
          transferOutParticular = 'Tax Transfer Out'
          transferInParticular = 'Tax Transfer In'
          break
        case TransactionCategory.SERVICE_CHARGE:
          transferOutParticular = 'Service Charge Transfer Out'
          transferInParticular = 'Service Charge Transfer In'
          break
        default:
          transferOutParticular = 'Miscellaneous Transfer Out'
          transferInParticular = 'Miscellaneous Transfer In'
      }

      // Create transfer-out transaction in original folio
      await FolioTransaction.create({
        hotelId: transaction.hotelId,
        folioId: originalFolioId,
        transactionNumber: `TRF-OUT-${transaction.transactionNumber}`,
        transactionType: TransactionType.TRANSFER,
        category: transaction.category,
        particular: transferOutParticular,
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
        particular: transferInParticular,
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
