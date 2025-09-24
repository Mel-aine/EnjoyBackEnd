import { DateTime } from 'luxon'
import Receipt from '#models/receipt'
import FolioTransaction from '#models/folio_transaction'
import LoggerService from '#services/logger_service'
import db from '@adonisjs/lucid/services/db'

export interface CreateReceiptData {
  tenantId: number
  hotelId: number
  paymentDate: DateTime
  paymentMethodId: number
  totalAmount: number
  description: string
  breakdown?: object
  createdBy: number
  folioTransactionId: number
  currency: string
}

export interface VoidReceiptData {
  receiptId: number
  voidedBy: number
  reason?: string
}

export interface ReceiptQueryOptions {
  page?: number
  limit?: number
  hotelId?: number
  tenantId?: number
  paymentMethodId?: number
  createdBy?: number
  isVoided?: boolean
  fromDate?: DateTime
  toDate?: DateTime
  currency?: string
  search?: string
}

export interface ReceiptSummary {
  totalReceipts: number
  totalAmount: number
  totalVoided: number
  voidedAmount: number
  netAmount: number
  receipts: Receipt[]
}

export default class ReceiptService {
  /**
   * Create a new receipt
   */
  static async createReceipt(data: CreateReceiptData): Promise<Receipt> {
    return await db.transaction(async (trx) => {
      try {
        // Verify the folio transaction exists and is a payment
        const folioTransaction = await FolioTransaction.query({ client: trx })
          .where('id', data.folioTransactionId)
          .where('hotel_id', data.hotelId)
          .first()

        if (!folioTransaction) {
          throw new Error('Folio transaction not found')
        }

        // Create the receipt
        const receipt = await Receipt.create({
          tenantId: data.tenantId,
          hotelId: data.hotelId,
          paymentDate: data.paymentDate,
          paymentMethodId: data.paymentMethodId,
          totalAmount: data.totalAmount,
          description: data.description,
          breakdown: data.breakdown || {},
          createdBy: data.createdBy,
          folioTransactionId: data.folioTransactionId,
          isVoided: false,
          currency: data.currency
        }, { client: trx })

        return receipt
      } catch (error) {
        throw error
      }
    })
  }

  /**
   * Void a receipt
   */
  static async voidReceipt(data: VoidReceiptData): Promise<Receipt> {
    return await db.transaction(async (trx) => {
      try {
        const receipt = await Receipt.query({ client: trx })
          .where('id', data.receiptId)
          .first()

        if (!receipt) {
          throw new Error('Receipt not found')
        }

        if (receipt.isVoided) {
          throw new Error('Receipt is already voided')
        }

        // Update receipt to voided status
        receipt.isVoided = true
        receipt.voidedBy = data.voidedBy
        receipt.voidedAt = DateTime.now()
        
        await receipt.save({ client: trx })

        await LoggerService.log({
          level: 'info',
          message: 'Receipt voided successfully',
          data: {
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            voidedBy: data.voidedBy,
            reason: data.reason
          }
        })

        return receipt
      } catch (error) {
        await LoggerService.log({
          level: 'error',
          message: 'Failed to void receipt',
          data: {
            error: error.message,
            receiptId: data.receiptId,
            voidedBy: data.voidedBy
          }
        })
        throw error
      }
    })
  }

  /**
   * Get receipts with filtering and pagination
   */
  static async getReceipts(options: ReceiptQueryOptions = {}): Promise<{
    data: Receipt[]
    meta: {
      total: number
      page: number
      perPage: number
      lastPage: number
    }
  }> {
    const page = options.page || 1
    const limit = options.limit || 20

    const query = Receipt.query()
      .preload('hotel')
      .preload('tenant')
      .preload('paymentMethod')
      .preload('creator')
      .preload('voider')
      .preload('folioTransaction')

    // Apply filters
    if (options.hotelId) {
      query.where('hotelId', options.hotelId)
    }

    if (options.tenantId) {
      query.where('tenantId', options.tenantId)
    }

    if (options.paymentMethodId) {
      query.where('paymentMethodId', options.paymentMethodId)
    }

    if (options.createdBy) {
      query.where('createdBy', options.createdBy)
    }

    if (options.isVoided !== undefined) {
      query.where('isVoided', options.isVoided)
    }

    if (options.currency) {
      query.where('currency', options.currency)
    }

    if (options.fromDate) {
      query.where('paymentDate', '>=', options.fromDate.toJSDate())
    }

    if (options.toDate) {
      query.where('paymentDate', '<=', options.toDate.toJSDate())
    }

    if (options.search) {
      query.where((builder) => {
        builder
          .where('receiptNumber', 'like', `%${options.search}%`)
          .orWhere('description', 'like', `%${options.search}%`)
      })
    }

    query.orderBy('createdAt', 'desc')

    const result = await query.paginate(page, limit)

    return {
      data: result.all(),
      meta: result.getMeta()
    }
  }

  /**
   * Get receipt summary for a date range
   */
  static async getReceiptSummary(
    hotelId: number,
    fromDate: DateTime,
    toDate: DateTime,
    options: {
      paymentMethodId?: number
      createdBy?: number
      currency?: string
    } = {}
  ): Promise<ReceiptSummary> {
    const query = Receipt.query()
      .where('hotelId', hotelId)
      .whereBetween('paymentDate', [fromDate.toJSDate(), toDate.toJSDate()])

    if (options.paymentMethodId) {
      query.where('paymentMethodId', options.paymentMethodId)
    }

    if (options.createdBy) {
      query.where('createdBy', options.createdBy)
    }

    if (options.currency) {
      query.where('currency', options.currency)
    }

    const receipts = await query
      .preload('paymentMethod')
      .preload('creator')
      .orderBy('paymentDate', 'desc')

    const totalReceipts = receipts.length
    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.totalAmount, 0)
    
    const voidedReceipts = receipts.filter(r => r.isVoided)
    const totalVoided = voidedReceipts.length
    const voidedAmount = voidedReceipts.reduce((sum, receipt) => sum + receipt.totalAmount, 0)
    
    const netAmount = totalAmount - voidedAmount

    return {
      totalReceipts,
      totalAmount,
      totalVoided,
      voidedAmount,
      netAmount,
      receipts
    }
  }

  /**
   * Get receipt by ID with all relationships
   */
  static async getReceiptById(id: number): Promise<Receipt | null> {
    return await Receipt.query()
      .where('id', id)
      .preload('hotel')
      .preload('tenant')
      .preload('paymentMethod')
      .preload('creator')
      .preload('voider')
      .preload('folioTransaction')
      .first()
  }

  /**
   * Get receipt by receipt number
   */
  static async getReceiptByNumber(receiptNumber: string): Promise<Receipt | null> {
    return await Receipt.query()
      .where('receiptNumber', receiptNumber)
      .preload('hotel')
      .preload('tenant')
      .preload('paymentMethod')
      .preload('creator')
      .preload('voider')
      .preload('folioTransaction')
      .first()
  }
}