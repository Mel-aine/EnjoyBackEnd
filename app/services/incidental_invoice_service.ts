import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import IncidentalInvoice from '#models/incidental_invoice'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import ExtraCharge from '#models/extra_charge'
import Guest from '#models/guest'
import Hotel from '#models/hotel'
import PaymentMethod from '#models/payment_method'
import PdfService, { IncidentalInvoiceData, IncidentalCharge } from '#services/pdf_service'
import LoggerService from '#services/logger_service'
import { FolioType, FolioStatus, SettlementStatus, WorkflowStatus, TransactionType, TransactionCategory, TransactionStatus } from '#app/enums'
import { generateTransactionCode } from '../utils/generate_guest_code.js'

export interface CreateIncidentalInvoiceData {
  hotelId: number
  guestId: number
  date: DateTime
  charges: {
    transactionType?: string
    category?: string
    description?: string
    amount: number
    quantity: number
    unitPrice?: number
    taxAmount?: number
    extraChargeId?: number
    notes?: string
    discountId?: number
  }[]
  paymentType: string
  paymentMethodId: number
  description?: string
  referenceNumber?: string
  notes?: string
  billingName?: string
  billingAddress?: string
  billingCity?: string
  billingState?: string
  billingZip?: string
  billingCountry?: string
  emailInvoice?: boolean
  emailAddress?: string
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
  limit?: number,
  hideVoided: boolean
}

export default class IncidentalInvoiceService {
  /**
   * Create a new incidental invoice with folio, transactions, and payment
   */
  public static async createIncidentalInvoice(data: CreateIncidentalInvoiceData, createdBy: number, ctx: any) {
    const logContext = {
      action: 'create_incidental_invoice',
      hotelId: data.hotelId,
      guestId: data.guestId,
      createdBy: createdBy
    }

    // Collect all log entries for bulk logging
    const logEntries: any[] = []

    // Add initial log entry
    logEntries.push({
      actorId: createdBy,
      action: 'CREATE',
      entityType: 'incidental_invoice',
      entityId: 0,
      description: 'Starting incidental invoice creation process',
      ctx: ctx,
      meta: logContext,
      hotelId: data.hotelId
    })

    try {
      let folio: Folio | null = null
      let invoice: IncidentalInvoice | null = null
      const transactions = []

      // 1. Validate guest and hotel
      logEntries.push({
        actorId: createdBy,
        action: 'UPDATE',
        entityType: 'incidental_invoice',
        entityId: 0,
        description: 'Validating guest and hotel',
        ctx: ctx,
        meta: { ...logContext, step: 'validate_entities' },
        hotelId: data.hotelId
      })
      const guest = await Guest.findOrFail(data.guestId)
      const paymentMethod = await PaymentMethod.findOrFail(data.paymentMethodId)
      const hotel = await Hotel.findOrFail(data.hotelId)
      logEntries.push({
        actorId: createdBy,
        action: 'UPDATE',
        entityType: 'incidental_invoice',
        entityId: 0,
        description: `Entities validated - Guest: ${guest.firstName} ${guest.lastName}, Payment: ${paymentMethod.methodName}`,
        ctx: ctx,
        meta: { ...logContext, step: 'validate_entities', guestName: `${guest.firstName} ${guest.lastName}`, hotelName: hotel.hotelName },
        hotelId: data.hotelId
      })

      // 2. Generate folio number
      logEntries.push({
        actorId: createdBy,
        action: 'UPDATE',
        entityType: 'incidental_invoice',
        entityId: 0,
        description: 'Generating folio number',
        ctx: ctx,
        meta: { ...logContext, step: 'generate_folio_number' },
        hotelId: data.hotelId
      })

      const folioNumber = await this.generateFolioNumber(data.hotelId)
      logEntries.push({
        actorId: createdBy,
        action: 'UPDATE',
        entityType: 'incidental_invoice',
        entityId: 0,
        description: `Folio number generated: ${folioNumber}`,
        ctx: ctx,
        meta: { ...logContext, step: 'generate_folio_number', folioNumber },
        hotelId: data.hotelId
      })

      // 3. Create the folio with "Voice Incidence" type
      logEntries.push({
        actorId: createdBy,
        action: 'CREATE',
        entityType: 'folio',
        entityId: 'creation_start',
        description: 'Creating folio for voice incidence',
        ctx: ctx,
        meta: { ...logContext, step: 'create_folio' },
        hotelId: data.hotelId
      })
      folio = await Folio.create({
        hotelId: data.hotelId,
        guestId: data.guestId,
        folioNumber: folioNumber,
        folioName: `VC-${guest.firstName} ${guest.lastName}`,
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
        currencyCode: 'XAF',
        exchangeRate: 1.0,
        createdBy: createdBy,
        lastModifiedBy: createdBy
      })
      logEntries.push({
        actorId: createdBy,
        action: 'CREATE',
        entityType: 'folio',
        entityId: folio.id,
        description: `Folio created successfully with ID: ${folio.id}`,
        ctx: ctx,
        meta: { ...logContext, step: 'create_folio', folioId: folio.id },
        hotelId: data.hotelId
      })

      // 4. Calculate totals
      let totalCharges = 0
      let totalTaxes = 0
      let totalDiscounts = 0

      // 5. Create charge transactions
      logEntries.push({
        actorId: createdBy,
        action: 'CREATE',
        entityType: 'folio_transaction',
        entityId: 'charges_start',
        description: `Creating ${data.charges.length} charge transactions`,
        ctx: ctx,
        meta: { ...logContext, step: 'create_charges', chargeCount: data.charges.length },
        hotelId: data.hotelId
      })
      for (const [index, charge] of data.charges.entries()) {
        const transactionNumber = await this.generateTransactionNumber(data.hotelId)

        const quantity = Number(charge.quantity) || 1
        const inclusiveAmount = Number(charge.amount) || 0

        // Load tax rates from ExtraCharge if available
        let taxRates: any[] = []
        if (charge.extraChargeId) {
          const extraCharge = await ExtraCharge.query()
            .where('id', charge.extraChargeId)
            .preload('taxRates')
            .first()
          taxRates = extraCharge?.taxRates ?? []
        }

        // Compute percentage and flat sums
        let percentageSum = 0
        let flatSum = 0
        for (const tax of taxRates) {
          if (tax.postingType === 'flat_percentage' && tax.percentage) {
            percentageSum += Number(tax.percentage) || 0
          } else if (tax.postingType === 'flat_amount' && tax.amount) {
            flatSum += Number(tax.amount) || 0
          }
        }
        const percRate = percentageSum > 0 ? (percentageSum / 100) : 0

        // Derive net amount from inclusive amount
        let netAmount = inclusiveAmount
        if (taxRates.length > 0) {
          netAmount = Math.max(0, +(((inclusiveAmount - flatSum) / (1 + percRate)).toFixed(2)))
        }

        // Per-tax breakdown
        const taxBreakdown: { taxRateId: number, shortName: string, taxAmount: number, percentage: number }[] = []
        let totalTaxAmount = 0
        for (const tax of taxRates) {
          let tAmt = 0
          if (tax.postingType === 'flat_percentage' && tax.percentage) {
            tAmt = +(netAmount * ((Number(tax.percentage) || 0) / 100)).toFixed(2)
          } else if (tax.postingType === 'flat_amount' && tax.amount) {
            tAmt = +(Number(tax.amount) || 0)
          }
          if (tAmt > 0) {
            totalTaxAmount += tAmt
            taxBreakdown.push({
              taxRateId: tax.taxRateId,
              shortName: tax.shortName,
              taxAmount: tAmt,
              percentage: Number(tax.percentage) || 0
            })
          }
        }

        // Adjust net to ensure net + taxes equals inclusive amount
        if (taxRates.length > 0) {
          netAmount = +((inclusiveAmount - totalTaxAmount).toFixed(2))
        }

        const unitPrice = charge.unitPrice ? Number(charge.unitPrice) : +(netAmount / quantity).toFixed(6)

        // Create the main charge transaction as net (taxes posted separately)
        const transaction = await FolioTransaction.create({
          hotelId: data.hotelId,
          folioId: folio.id,
          transactionNumber: transactionNumber,
          transactionCode: generateTransactionCode('CHG'),
          transactionType: TransactionType.CHARGE,
          category: this.mapChargeCategory(charge.category),
          description: charge.description || 'Incidental Charge',
          particular: `${charge.description??''} - QT(${charge.quantity})`,
          extraChargeId: charge.extraChargeId || null,
          amount: netAmount,
          totalAmount: netAmount,
          quantity: quantity,
          unitPrice: unitPrice,
          taxAmount: 0,
          taxRate: percRate,
          serviceChargeAmount: 0,
          serviceChargeRate: 0,
          discountAmount: 0,
          discountRate: 0,
          netAmount: netAmount,
          grossAmount: netAmount,
          transactionDate: data.date,
          transactionTime: '00:00:00',
          postingDate: data.date,
          serviceDate: data.date,
          status: TransactionStatus.POSTED,
          createdBy: createdBy,
          lastModifiedBy: createdBy
        })

        // Attach tax breakdown on pivot
        if (taxBreakdown.length > 0) {
          const attachData: Record<number, { tax_amount: number, tax_rate_percentage: number, taxable_amount: number }> = {}
          for (const tb of taxBreakdown) {
            attachData[tb.taxRateId] = {
              tax_amount: tb.taxAmount,
              tax_rate_percentage: tb.percentage,
              taxable_amount: netAmount
            }
          }
          await transaction.related('taxes').attach(attachData)
        }

        transactions.push(transaction)
        totalCharges += netAmount
        totalTaxes += totalTaxAmount

        logEntries.push({
          actorId: createdBy,
          action: 'CREATE',
          entityType: 'folio_transaction',
          entityId: transaction.id,
          description: `Charge transaction ${index + 1} created: ${charge.description}`,
          ctx: ctx,
          meta: { ...logContext, step: 'create_charges', transactionId: transaction.id, amount: netAmount },
          hotelId: data.hotelId
        })

        // Create individual tax transactions
        for (const tb of taxBreakdown) {
          const taxTransactionNumber = await this.generateTransactionNumber(data.hotelId)
          const taxTransaction = await FolioTransaction.create({
            hotelId: data.hotelId,
            folioId: folio.id,
            transactionNumber: taxTransactionNumber,
            transactionCode: generateTransactionCode('TAX'),
            transactionType: TransactionType.TAX,
            category: TransactionCategory.TAX,
            description: `${tb.shortName} - ${charge.description || 'Incidental Charge'}`,
            particular: `Tax ${tb.shortName}`,
            extraChargeId: charge.extraChargeId || null,
            amount: tb.taxAmount,
            totalAmount: tb.taxAmount,
            quantity: 1,
            unitPrice: tb.taxAmount,
            taxAmount: tb.taxAmount,
            taxRate: (tb.percentage || 0) / 100,
            serviceChargeAmount: 0,
            serviceChargeRate: 0,
            discountAmount: 0,
            discountRate: 0,
            netAmount: tb.taxAmount,
            grossAmount: tb.taxAmount,
            transactionDate: data.date,
            transactionTime: '00:00:00',
            postingDate: data.date,
            serviceDate: data.date,
            originalTransactionId: transaction.id,
            status: TransactionStatus.POSTED,
            createdBy: createdBy,
            lastModifiedBy: createdBy
          })

          transactions.push(taxTransaction)
          logEntries.push({
            actorId: createdBy,
            action: 'CREATE',
            entityType: 'folio_transaction',
            entityId: taxTransaction.id,
            description: `Tax transaction created: ${tb.shortName} (${tb.taxAmount})`,
            ctx: ctx,
            meta: { ...logContext, step: 'create_taxes', transactionId: taxTransaction.id, taxRateId: tb.taxRateId, amount: tb.taxAmount, parentTransactionId: transaction.id },
            hotelId: data.hotelId
          })
        }
      }

      const grandTotal = totalCharges + totalTaxes - totalDiscounts

      // 6. Create payment transaction that matches folio balance
      logEntries.push({
        actorId: createdBy,
        action: 'CREATE',
        entityType: 'folio_transaction',
        entityId: 'payment_start',
        description: `Creating payment transaction for amount: ${grandTotal}`,
        ctx: ctx,
        meta: { ...logContext, step: 'create_payment', amount: grandTotal },
        hotelId: data.hotelId
      })
      const paymentTransactionNumber = await this.generateTransactionNumber(data.hotelId)
      const paymentTransaction = await FolioTransaction.create({
        hotelId: data.hotelId,
        folioId: folio.id,
        transactionNumber: paymentTransactionNumber,
        transactionCode: generateTransactionCode('PY'),
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
        transactionTime: '00:00:00',
        postingDate: data.date,
        serviceDate: data.date,
        paymentMethodId: data.paymentMethodId,
        status: TransactionStatus.POSTED,
        createdBy: createdBy,
        lastModifiedBy: createdBy
      })

      transactions.push(paymentTransaction)
      logEntries.push({
        actorId: createdBy,
        action: 'CREATE',
        entityType: 'folio_transaction',
        entityId: paymentTransaction.id,
        description: `Payment transaction created with ID: ${paymentTransaction.id}`,
        ctx: ctx,
        meta: { ...logContext, step: 'create_payment', transactionId: paymentTransaction.id },
        hotelId: data.hotelId
      })

      // 7. Update folio totals and mark as settled
      logEntries.push({
        actorId: createdBy,
        action: 'UPDATE',
        entityType: 'folio',
        entityId: folio.id,
        description: 'Updating folio totals and settling',
        ctx: ctx,
        meta: { ...logContext, step: 'update_folio', totalCharges, totalTaxes, grandTotal },
        hotelId: data.hotelId
      })
      await folio.merge({
        totalCharges: totalCharges,
        totalPayments: grandTotal,
        totalTaxes: totalTaxes,
        totalDiscounts: totalDiscounts,
        balance: 0, // Should be zero since payment matches charges
        settlementStatus: SettlementStatus.SETTLED,
        // settlementDate: data.date,
        status: FolioStatus.CLOSED,
        workflowStatus: WorkflowStatus.FINALIZED,
        closedDate: data.date,
        // finalizedDate: data.date,
        closedBy: createdBy,
        lastModifiedBy: createdBy
      }).save()
      logEntries.push({
        actorId: createdBy,
        action: 'UPDATE',
        entityType: 'folio',
        entityId: folio.id,
        description: 'Folio updated and settled successfully',
        ctx: ctx,
        meta: { ...logContext, step: 'update_folio', folioId: folio.id },
        hotelId: data.hotelId
      })

      // 8. Generate invoice number and reference number
      logEntries.push({
        actorId: createdBy,
        action: 'GENERATE',
        entityType: 'incidental_invoice',
        entityId: 'number_generation',
        description: 'Generating invoice and reference numbers',
        ctx: ctx,
        meta: { ...logContext, step: 'generate_numbers' },
        hotelId: data.hotelId
      })
      const invoiceNumber = await IncidentalInvoice.generateInvoiceNumber(data.hotelId)
      const referenceNumber = data.referenceNumber || await this.generateReferenceNumber(data.hotelId)
      logEntries.push({
        actorId: createdBy,
        action: 'GENERATE',
        entityType: 'incidental_invoice',
        entityId: 'number_generation',
        description: `Numbers generated - Invoice: ${invoiceNumber}, Reference: ${referenceNumber}`,
        ctx: ctx,
        meta: { ...logContext, step: 'generate_numbers', invoiceNumber, referenceNumber },
        hotelId: data.hotelId
      })

      // 9. Create the incidental invoice
      logEntries.push({
        actorId: createdBy,
        action: 'CREATE',
        entityType: 'incidental_invoice',
        entityId: 'invoice_start',
        description: 'Creating incidental invoice record',
        ctx: ctx,
        meta: { ...logContext, step: 'create_invoice' },
        hotelId: data.hotelId
      })
      invoice = await IncidentalInvoice.create({
        hotelId: data.hotelId,
        folioId: folio.id,
        guestId: data.guestId,
        invoiceNumber: invoiceNumber,
        referenceNumber: referenceNumber,
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
        billingName: data.billingName,
        billingAddress: data.billingAddress,
        billingCity: data.billingCity,
        billingState: data.billingState,
        billingZip: data.billingZip,
        billingCountry: data.billingCountry,
        emailInvoice: data.emailInvoice || false,
        emailAddress: data.emailAddress,
        paymentMethod: paymentMethod.methodName,
        amount: grandTotal,
        dueDate: data.dueDate,
        paidDate: data.date,
        paidAmount: grandTotal,
        outstandingAmount: 0,
        createdBy: createdBy,
        lastModifiedBy: createdBy
      })
      logEntries.push({
        actorId: createdBy,
        action: 'CREATE',
        entityType: 'incidental_invoice',
        entityId: invoice.id,
        description: `Incidental invoice created successfully with ID: ${invoice.id}`,
        ctx: ctx,
        meta: { ...logContext, step: 'create_invoice', invoiceId: invoice.id, invoiceNumber },
        hotelId: data.hotelId
      })

      // 10. Load relationships for response
      logEntries.push({
        actorId: createdBy,
        action: 'READ',
        entityType: 'incidental_invoice',
        entityId: invoice.id,
        description: 'Loading relationships for response',
        ctx: ctx,
        meta: { ...logContext, step: 'load_relationships' },
        hotelId: data.hotelId
      })
      await invoice.load('hotel')
      await invoice.load('folio')
      await invoice.load('guest')
      await folio.load('transactions')

      logEntries.push({
        actorId: createdBy,
        action: 'COMPLETE',
        entityType: 'incidental_invoice',
        entityId: invoice.id,
        description: 'Incidental invoice creation completed successfully',
        ctx: ctx,
        meta: { ...logContext, step: 'complete', invoiceId: invoice.id, folioId: folio.id },
        hotelId: data.hotelId
      })

      // Bulk log all entries at once
      await LoggerService.bulkLog(logEntries)

      return {
        invoice,
        folio,
        transactions
      }
    } catch (error) {
      // Log the error using bulk logging
      const errorLogEntry = {
        actorId: createdBy,
        action: 'ERROR',
        entityType: 'incidental_invoice',
        entityId: 'creation_error',
        description: `Error creating incidental invoice: ${error.message}`,
        ctx: ctx,
        meta: { ...logContext, error: error.message, stack: error.stack },
        hotelId: data.hotelId
      }
      await LoggerService.bulkLog([errorLogEntry])

      // Transaction will automatically rollback due to the error
      throw new Error(`Failed to create incidental invoice: ${error.message}`)
    }
  }

  /**
   * Retrieve incidental invoices with search functionality
   */
  static async getIncidentalInvoices(filters: IncidentalInvoiceSearchFilters) {
    const query = IncidentalInvoice.query()
      .preload('hotel')
      .preload('folio', (folioQuery) => {
        folioQuery.preload('guest')
      })
      .preload('guest')
      .preload('creator')

    // Apply filters
    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    if (filters.guestId) {
      query.where('guest_id', filters.guestId)
    }

    if (filters.folioId) {
      query.where('folio_id', filters.folioId)
    }

    if (filters.invoiceNumber) {
      query.where('invoice_number', 'ILIKE', `%${filters.invoiceNumber}%`)
    }

    if (filters.status) {
      query.where('status', filters.status)
    }
    if (filters.hideVoided) {
      query.whereNot('status', 'voided')
    }
    if (filters.type) {
      query.where('type', filters.type)
    }

    if (filters.dateFrom && filters.dateTo) {
      query.whereBetween('invoice_date', [filters.dateFrom.toSQL(), filters.dateTo.toSQL()])
    } else if (filters.dateFrom) {
      query.where('invoice_date', '>=', filters.dateFrom.toSQL())
    } else if (filters.dateTo) {
      query.where('invoice_date', '<=', filters.dateTo.toSQL())
    }

    if (filters.guestName) {
      query.whereHas('guest', (guestQuery) => {
        guestQuery.whereRaw('CONCAT(first_name, \' \', last_name) ILIKE ?', [`%${filters.guestName}%`])
      })
    }

    if (filters.folioNumber) {
      query.whereHas('folio', (folioQuery) => {
        folioQuery.where('folio_number', 'ILIKE', `%${filters.folioNumber}%`)
      })
    }

    if (filters.amountMin !== undefined) {
      query.where('total_amount', '>=', filters.amountMin)
    }

    if (filters.amountMax !== undefined) {
      query.where('total_amount', '<=', filters.amountMax)
    }

    if (filters.createdBy) {
      query.where('created_by', filters.createdBy)
    }

    // Pagination
    const page = filters.page || 1
    const limit = filters.limit || 20

    const result = await query.orderBy('created_at', 'desc').paginate(page, limit)

    return {
      data: result.serialize(),
      meta: {
        total: result.total,
        perPage: result.perPage,
        currentPage: result.currentPage,
        lastPage: result.lastPage,
        hasMorePages: result.hasMorePages
      }
    }
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
      const logEntries: any[] = []
      const voidDate = DateTime.now()

      // Load invoice with folio and transactions
      const invoice = await IncidentalInvoice.query()
        .where('id', id)
        .preload('folio', (folioQuery) => {
          folioQuery.preload('transactions')
        })
        .firstOrFail()

      if (!invoice.canBeVoided) {
        throw new Error('Invoice cannot be voided in its current status')
      }

      logEntries.push({
        actorId: voidedBy,
        action: 'VOID',
        entityType: 'incidental_invoice',
        entityId: invoice.id,
        description: `Starting void process for incidental invoice ${invoice.invoiceNumber}`,
        meta: { voidReason, invoiceNumber: invoice.invoiceNumber },
        hotelId: invoice.hotelId
      })

      // 1. Void all folio transactions
      const transactions = invoice.folio.transactions
      for (const transaction of transactions) {
        if (transaction.status !== TransactionStatus.VOIDED) {
          await transaction.useTransaction(trx).merge({
            status: TransactionStatus.VOIDED,
            isVoided: true,
            voidedBy: voidedBy,
            voidedDate: voidDate,
            voidReason: voidReason,
            lastModifiedBy: voidedBy
          }).save()

          logEntries.push({
            actorId: voidedBy,
            action: 'VOID',
            entityType: 'folio_transaction',
            entityId: transaction.id,
            description: `Voided transaction ${transaction.transactionNumber} - ${transaction.description}`,
            meta: {
              voidReason,
              transactionNumber: transaction.transactionNumber,
              amount: transaction.amount,
              transactionType: transaction.transactionType
            },
            hotelId: invoice.hotelId
          })
        }
      }

      // 2. Void the folio
      await invoice.folio.useTransaction(trx).merge({
        status: FolioStatus.VOIDED,
        workflowStatus: WorkflowStatus.CLOSED,
        voidedDate: voidDate,
        voidReason: voidReason,
        closedDate: voidDate,
        closedBy: voidedBy,
        lastModifiedBy: voidedBy
      }).save()

      logEntries.push({
        actorId: voidedBy,
        action: 'VOID',
        entityType: 'folio',
        entityId: invoice.folio.id,
        description: `Voided folio ${invoice.folio.folioNumber}`,
        meta: {
          voidReason,
          folioNumber: invoice.folio.folioNumber,
          balance: invoice.folio.balance
        },
        hotelId: invoice.hotelId
      })

      // 3. Void the incidental invoice
      await invoice.useTransaction(trx).merge({
        status: 'voided',
        voidReason: voidReason,
        voidedDate: voidDate,
        voidedBy: voidedBy,
        lastModifiedBy: voidedBy
      }).save()

      logEntries.push({
        actorId: voidedBy,
        action: 'VOID',
        entityType: 'incidental_invoice',
        entityId: invoice.id,
        description: `Successfully voided incidental invoice ${invoice.invoiceNumber}`,
        meta: {
          voidReason,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: invoice.totalAmount,
          transactionsVoided: transactions.length
        },
        hotelId: invoice.hotelId
      })

      // Bulk log all entries
      await LoggerService.bulkLog(logEntries)

      return {
        invoice,
        folio: invoice.folio,
        transactionsVoided: transactions.length
      }
    })
  }

  /**
   * Generate a unique reference number for the invoice
   */
  private static async generateReferenceNumber(hotelId: number): Promise<string> {
    const hotel = await Hotel.findOrFail(hotelId)
    const prefix = 'REF'
    const year = new Date().getFullYear().toString().slice(-2)
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0')

    // Get the last reference number for this hotel and month
    const lastInvoice = await IncidentalInvoice.query()
      .where('hotelId', hotelId)
      .where('referenceNumber', 'like', `${prefix}${year}${month}%`)
      .orderBy('id', 'desc')
      .first()

    let nextNumber = 1
    if (lastInvoice && lastInvoice.referenceNumber) {
      const lastNumber = parseInt(lastInvoice.referenceNumber.slice(-4))
      nextNumber = lastNumber + 1
    }

    return `${prefix}${year}${month}${nextNumber.toString().padStart(4, '0')}`
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
    // Use a hybrid approach: timestamp + hotel ID + random component for uniqueness
    const timestamp = Date.now()
    const randomComponent = Math.floor(Math.random() * 1000)
    const hotelComponent = hotelId % 100 // Last 2 digits of hotel ID

    // Create a unique number: timestamp (last 8 digits) + hotel component (2 digits) + random (3 digits)
    const baseNumber = parseInt(
      timestamp.toString().slice(-8) +
      hotelComponent.toString().padStart(2, '0') +
      randomComponent.toString().padStart(3, '0')
    )

    // Ensure it's within reasonable integer range and positive
    let transactionNumber = Math.abs(baseNumber) % 2147483647 // Max 32-bit signed integer

    // Fallback to simple increment if the generated number is too small
    if (transactionNumber < 1000) {
      const result = await db.rawQuery(
        `SELECT COALESCE(MAX(transaction_number), 0) + 1 as next_num FROM folio_transactions WHERE hotel_id = ?`,
        [hotelId]
      )
      transactionNumber = result.rows[0]?.next_num || 1000
    }

    // Final check for uniqueness with a few retries
    let attempts = 0
    const maxAttempts = 5

    while (attempts < maxAttempts) {
      const existingTransaction = await FolioTransaction.query()
        .where('hotelId', hotelId)
        .where('transactionNumber', transactionNumber)
        .first()

      if (!existingTransaction) {
        return transactionNumber
      }

      // If collision occurs, increment and try again
      transactionNumber++
      attempts++

      // Add small delay to reduce collision probability
      if (attempts > 1) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
      }
    }

    // Ultimate fallback: use current timestamp in milliseconds
    return Date.now() % 2147483647
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

  /**
   * Generate PDF for an incidental invoice
   */
  static async generateInvoicePdf(invoiceId: number): Promise<Buffer> {
    const invoice = await IncidentalInvoice.query()
      .where('id', invoiceId)
      .preload('hotel')
      .preload('guest')
      .preload('folio')
      .firstOrFail()

    // Get charges from folio transactions
    const folioTransactions = await invoice.folio.related('transactions').query()
      .where('transactionType', TransactionType.CHARGE)
      .where('status', TransactionStatus.POSTED)

    const charges: IncidentalCharge[] = folioTransactions.map(transaction => ({
      description: transaction.description || '',
      category: transaction.category || '',
      quantity: transaction.quantity || 1,
      unitPrice: transaction.unitPrice || transaction.amount || 0,
      amount: transaction.amount || 0,
      taxAmount: transaction.taxAmount || 0,
      notes: transaction.notes || ''
    }))

    // Prepare invoice data for PDF generation
    const invoiceData: IncidentalInvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      referenceNumber: invoice.referenceNumber || '',
      invoiceDate: invoice.invoiceDate.toFormat('yyyy-MM-dd'),
      hotelName: invoice.hotel?.hotelName,
      hotelAddress: invoice.hotel?.address ?? '',
      guestName: invoice.guest?.fullName,
      guestEmail: invoice.guest?.email,
      billingName: invoice.billingName ?? '',
      billingAddress: invoice.billingAddress || undefined,
      billingCity: invoice.billingCity || undefined,
      billingState: invoice.billingState || undefined,
      billingZip: invoice.billingZip || undefined,
      billingCountry: invoice.billingCountry || undefined,
      charges,
      totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount,
      netAmount: invoice.netAmount,
      paymentType: invoice.paymentType || 'Cash',
      status: invoice.status || 'Pending',
      notes: invoice.notes || undefined
    }

    return await PdfService.generateIncidentalInvoicePdf(invoiceData)
  }
}