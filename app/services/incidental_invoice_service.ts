import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import IncidentalInvoice from '#models/incidental_invoice'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import Guest from '#models/guest'
import Hotel from '#models/hotel'
import PaymentMethod from '#models/payment_method'
import { FolioType, FolioStatus, SettlementStatus, WorkflowStatus, TransactionType, TransactionCategory, TransactionStatus } from '#app/enums'

export interface CreateIncidentalInvoiceData {
  hotelId: number
  guestId: number
  date: DateTime
  charges: {
    id?: number
    extraChargeId?: number
    discountId?: number
    taxIncludes: boolean
    quantity: number
    amount: number
    description?: string
    category?: string
  }[]
  paymentType: string
  paymentMethodId: number
  description?: string
  notes?: string
  dueDate?: DateTime
}

export interface IncidentalInvoiceSearchFilters {
  hotelId?: number
  guestId?: number
  folioId?: number
  invoiceNumber?: string
  status?: string
  type?: string
  dateFrom?: DateTime
  dateTo?: DateTime
  guestName?: string
  folioNumber?: string
  amountMin?: number
  amountMax?: number
  createdBy?: number
  page?: number
  limit?: number
}

export default class IncidentalInvoiceService {
  /**
   * Create a new incidental invoice with folio, transactions, and payment
   */
 public  static async createIncidentalInvoice(data: CreateIncidentalInvoiceData, createdBy: number) {
    return await db.transaction(async (trx) => {
      try {
        // 1. Validate guest and hotel
        const guest = await Guest.findOrFail(data.guestId)
        const paymentMethod = await PaymentMethod.findOrFail(data.paymentMethodId)

        // 2. Generate folio number
        const folioNumber = await this.generateFolioNumber(data.hotelId)

        // 3. Create the folio with "Voice Incidence" type
        const folio = await Folio.create({
          hotelId: data.hotelId,
          guestId: data.guestId,
          folioNumber: folioNumber,
          folioName: `Voice Incidence - ${guest.firstName} ${guest.lastName}`,
          folioType: FolioType.VOICE_INCIDENTAL, // Using correct enum value for incidental folios
          status: FolioStatus.OPEN,
          settlementStatus: SettlementStatus.SETTLED,
          workflowStatus: WorkflowStatus.ACTIVE,
          openedDate: data.date,
          openedBy: createdBy,
          totalCharges: 0,
          totalPayments: 0,
          totalAdjustments: 0,
          totalTaxes: 0,
          totalServiceCharges: 0,
          totalDiscounts: 0,
          balance: 0,
          creditLimit: 0,
          currencyCode: 'USD',
          exchangeRate: 1.0,
          baseCurrencyAmount: 0,
          createdBy: createdBy,
          lastModifiedBy: createdBy
        }, { client: trx })

        // 4. Calculate totals
        let totalCharges = 0
        let totalTaxes = 0
        let totalDiscounts = 0
        const transactions = []

        // 5. Create charge transactions
        for (const charge of data.charges) {
          const transactionNumber = await this.generateTransactionNumber(data.hotelId)
          
          let taxAmount = 0
          let netAmount = charge.amount
          
          if (charge.taxIncludes) {
            // Tax is included in the amount
            taxAmount = charge.amount * 0.1 // Assuming 10% tax rate
            netAmount = charge.amount - taxAmount
          } else {
            // Tax is additional
            taxAmount = charge.amount * 0.1
            netAmount = charge.amount
          }

          const transaction = await FolioTransaction.create({
            hotelId: data.hotelId,
            folioId: folio.id,
            transactionNumber: transactionNumber,
            transactionCode: transactionNumber.toString(),
            transactionType: TransactionType.CHARGE,
            category: this.mapChargeCategory(charge.category),
            description: charge.description || 'Incidental Charge',
            particular: charge.description || 'Voice Incidence Charge',
            amount: charge.amount,
            totalAmount: charge.amount + taxAmount,
            quantity: charge.quantity,
            unitPrice: charge.amount / charge.quantity,
            taxAmount: taxAmount,
            taxRate: 0.1,
            serviceChargeAmount: 0,
            serviceChargeRate: 0,
            discountAmount: 0,
            discountRate: 0,
            netAmount: netAmount,
            grossAmount: charge.amount + taxAmount,
            transactionDate: data.date,
            transactionTime: data.date.toFormat('HH:mm:ss'),
            postingDate: data.date,
            serviceDate: data.date,
            status: TransactionStatus.POSTED,
            createdBy: createdBy,
            lastModifiedBy: createdBy
          }, { client: trx })

          transactions.push(transaction)
          totalCharges += charge.amount
          totalTaxes += taxAmount
        }

        const grandTotal = totalCharges + totalTaxes - totalDiscounts

        // 6. Create payment transaction that matches folio balance
        const paymentTransactionNumber = await this.generateTransactionNumber(data.hotelId)
        const paymentTransaction = await FolioTransaction.create({
          hotelId: data.hotelId,
          folioId: folio.id,
          transactionNumber: paymentTransactionNumber,
          transactionCode: paymentTransactionNumber.toString(),
          transactionType: TransactionType.PAYMENT,
          category: TransactionCategory.PAYMENT,
          description: `Payment - ${data.paymentType}`,
          particular: 'Payment Received',
          amount: -grandTotal, // Negative for payment
          totalAmount: -grandTotal,
          quantity: 1,
          unitPrice: -grandTotal,
          taxAmount: 0,
          taxRate: 0,
          serviceChargeAmount: 0,
          serviceChargeRate: 0,
          discountAmount: 0,
          discountRate: 0,
          netAmount: -grandTotal,
          grossAmount: -grandTotal,
          transactionDate: data.date,
          transactionTime: data.date.toFormat('HH:mm:ss'),
          postingDate: data.date,
          serviceDate: data.date,
          paymentMethodId: data.paymentMethodId,
          status: TransactionStatus.POSTED,
          createdBy: createdBy,
          lastModifiedBy: createdBy
        }, { client: trx })

        transactions.push(paymentTransaction)

        // 7. Update folio totals and mark as settled
        await folio.useTransaction(trx).merge({
          totalCharges: totalCharges,
          totalPayments: grandTotal,
          totalTaxes: totalTaxes,
          totalDiscounts: totalDiscounts,
          balance: 0, // Should be zero since payment matches charges
          settlementStatus: SettlementStatus.SETTLED,
          settlementDate: data.date,
          status: FolioStatus.CLOSED,
          workflowStatus: WorkflowStatus.FINALIZED,
          closedDate: data.date,
          finalizedDate: data.date,
          closedBy: createdBy,
          lastModifiedBy: createdBy
        }).save()

        // 8. Generate invoice number
        const invoiceNumber = await IncidentalInvoice.generateInvoiceNumber(data.hotelId)

        // 9. Create the incidental invoice
        const invoice = await IncidentalInvoice.create({
          hotelId: data.hotelId,
          folioId: folio.id,
          guestId: data.guestId,
          invoiceNumber: invoiceNumber,
          invoiceDate: data.date,
          totalAmount: totalCharges,
          taxAmount: totalTaxes,
          serviceChargeAmount: 0,
          discountAmount: totalDiscounts,
          netAmount: grandTotal,
          currencyCode: 'USD',
          exchangeRate: 1.0,
          baseCurrencyAmount: grandTotal,
          paymentMethodId: data.paymentMethodId,
          paymentType: data.paymentType,
          status: 'paid', // Since payment was made
          type: 'Voice Incidence',
          description: data.description,
          notes: data.notes,
          charges: data.charges,
          paymentDetails: {
            paymentMethod: paymentMethod.name,
            paymentType: data.paymentType,
            amount: grandTotal,
            date: data.date.toISO()
          },
          dueDate: data.dueDate,
          paidDate: data.date,
          paidAmount: grandTotal,
          outstandingAmount: 0,
          createdBy: createdBy,
          lastModifiedBy: createdBy
        }, { client: trx })

        // 10. Load relationships for response
        await invoice.load('hotel')
        await invoice.load('folio')
        await invoice.load('guest')
        await folio.load('transactions')

        return {
          invoice,
          folio,
          transactions
        }
      } catch (error) {
        throw new Error(`Failed to create incidental invoice: ${error.message}`)
      }
    })
  }

  /**
   * Retrieve incidental invoices with search functionality
   */
  static async getIncidentalInvoices(filters: IncidentalInvoiceSearchFilters) {
    const query = IncidentalInvoice.query()
      .preload('hotel')
      .preload('folio')
      .preload('guest')
      .preload('creator')

    // Apply filters
    if (filters.hotelId) {
      query.where('hotelId', filters.hotelId)
    }

    if (filters.guestId) {
      query.where('guestId', filters.guestId)
    }

    if (filters.folioId) {
      query.where('folioId', filters.folioId)
    }

    if (filters.invoiceNumber) {
      query.where('invoiceNumber', 'like', `%${filters.invoiceNumber}%`)
    }

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.type) {
      query.where('type', filters.type)
    }

    if (filters.dateFrom && filters.dateTo) {
      query.whereBetween('invoiceDate', [filters.dateFrom.toSQL(), filters.dateTo.toSQL()])
    } else if (filters.dateFrom) {
      query.where('invoiceDate', '>=', filters.dateFrom.toSQL())
    } else if (filters.dateTo) {
      query.where('invoiceDate', '<=', filters.dateTo.toSQL())
    }

    if (filters.guestName) {
      query.whereHas('guest', (guestQuery) => {
        guestQuery.whereRaw('CONCAT(first_name, " ", last_name) LIKE ?', [`%${filters.guestName}%`])
      })
    }

    if (filters.folioNumber) {
      query.whereHas('folio', (folioQuery) => {
        folioQuery.where('folioNumber', 'like', `%${filters.folioNumber}%`)
      })
    }

    if (filters.amountMin !== undefined) {
      query.where('totalAmount', '>=', filters.amountMin)
    }

    if (filters.amountMax !== undefined) {
      query.where('totalAmount', '<=', filters.amountMax)
    }

    if (filters.createdBy) {
      query.where('createdBy', filters.createdBy)
    }

    // Pagination
    const page = filters.page || 1
    const limit = filters.limit || 20

    const result = await query.orderBy('createdAt', 'desc').paginate(page, limit)

    return result
  }

  /**
   * Get a specific incidental invoice by ID
   */
  static async getIncidentalInvoiceById(id: number, hotelId?: number) {
    const query = IncidentalInvoice.query()
      .where('id', id)
      .preload('hotel')
      .preload('folio', (folioQuery) => {
        folioQuery.preload('transactions')
      })
      .preload('guest')
      .preload('creator')
      .preload('modifier')

    if (hotelId) {
      query.where('hotelId', hotelId)
    }

    return await query.firstOrFail()
  }

  /**
   * Void an incidental invoice
   */
  static async voidIncidentalInvoice(id: number, voidReason: string, voidedBy: number) {
    return await db.transaction(async (trx) => {
      const invoice = await IncidentalInvoice.findOrFail(id)

      if (!invoice.canBeVoided) {
        throw new Error('Invoice cannot be voided in its current status')
      }

      await invoice.useTransaction(trx).merge({
        status: 'voided',
        voidReason: voidReason,
        voidedDate: DateTime.now(),
        voidedBy: voidedBy,
        lastModifiedBy: voidedBy
      }).save()

      return invoice
    })
  }

  /**
   * Generate folio number
   */
  private static async generateFolioNumber(hotelId: number): Promise<string> {
    const year = DateTime.now().year
    const month = DateTime.now().month.toString().padStart(2, '0')
    
    const lastFolio = await Folio.query()
      .where('hotelId', hotelId)
      .where('folioNumber', 'like', `VI-${year}${month}-%`)
      .orderBy('folioNumber', 'desc')
      .first()

    let sequence = 1
    if (lastFolio) {
      const lastSequence = parseInt(lastFolio.folioNumber.split('-').pop() || '0')
      sequence = lastSequence + 1
    }

    return `VI-${year}${month}-${sequence.toString().padStart(4, '0')}`
  }

  /**
   * Generate transaction number
   */
  private static async generateTransactionNumber(hotelId: number): Promise<number> {
    const lastTransaction = await FolioTransaction.query()
      .where('hotelId', hotelId)
      .orderBy('transactionNumber', 'desc')
      .first()

    return lastTransaction ? lastTransaction.transactionNumber + 1 : 1
  }

  /**
   * Map charge category to transaction category
   */
  private static mapChargeCategory(category?: string): TransactionCategory {
    const categoryMap = {
      'food_beverage': TransactionCategory.FOOD_BEVERAGE,
      'spa': TransactionCategory.SPA,
      'laundry': TransactionCategory.LAUNDRY,
      'minibar': TransactionCategory.MINIBAR,
      'telephone': TransactionCategory.TELEPHONE,
      'internet': TransactionCategory.INTERNET,
      'parking': TransactionCategory.PARKING,
      'business_center': TransactionCategory.BUSINESS_CENTER
    }

    return categoryMap[category || ''] || TransactionCategory.MISCELLANEOUS
  }
}