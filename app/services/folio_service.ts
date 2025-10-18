import { DateTime } from 'luxon'
import Folio from '#models/folio'
import FolioTransaction from '#models/folio_transaction'
import Guest from '#models/guest'
import Reservation from '#models/reservation'
import Discount from '#models/discount'
import Hotel from '#models/hotel'
import { TransactionType, TransactionCategory, SettlementStatus, TransactionStatus, FolioStatus, WorkflowStatus, type FolioType } from '#app/enums'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import LoggerService from '#services/logger_service'
import logger from '@adonisjs/core/services/logger'
import { generateTransactionCode } from '../utils/generate_guest_code.js'

export interface CreateFolioData {
  hotelId: number
  guestId: number
  reservationId?: number
  reservationRoomId?: number
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
  discountAmount?: number,
  discountId?: number,
  extraChargeId?: number,
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

export interface CutFolioData {
  hotelId: number
  folioId: number
  roomCharges?: boolean
  Payment?: boolean
  extractCharges?: boolean
  notes?: string
  cutBy: number
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
      const folioNumber = data.folioNumber || await this.generateFolioNumber(data.hotelId, trx, data.reservationRoomId)

      // Generate folio name if not provided
      const folioName = data.folioName || `${guest.firstName} ${guest.lastName} - ${data.folioType.toUpperCase()}`

      // Create folio
      const folio = await Folio.create({
        hotelId: data.hotelId,
        guestId: data.guestId,
        reservationId: data.reservationId,
        reservationRoomId: data.reservationRoomId,
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

      await LoggerService.logActivity({
        actorId: data.createdBy,
        action: 'CREATE',
        entityType: 'Folio',
        entityId: folio.id,
        hotelId: folio.hotelId,
        description: `Folio "${folio.folioName}" created via service`,
        changes: LoggerService.extractChanges({}, folio.toJSON())
      })

      return folio
    })
  }

  /**
   * Post a transaction to a folio
   */
  // static async postTransaction(data: PostTransactionData): Promise<FolioTransaction> {
  //   return await db.transaction(async (trx) => {
  //     // Validate folio exists and can be modified
  //     const folio = await Folio.findOrFail(data.folioId)
  //     logger.info(data)
  //     if (!folio.canBeModified) {
  //       throw new Error('Folio cannot be modified - it is finalized or closed')
  //     }

  //     // Calculate discount amount if discountId is provided
  //     let calculatedDiscountAmount = data.discountAmount || 0
  //     if (data.discountId) {
  //       const discount = await Discount.findOrFail(data.discountId)

  //       // Validate discount is active
  //       if (discount.status !== 'active' || discount.isDeleted) {
  //         throw new Error('Discount is not active or has been deleted')
  //       }

  //       // Calculate discount amount based on type
  //       if (discount.type === 'percentage') {
  //         calculatedDiscountAmount = data.amount * (discount.value / 100)
  //       } else if (discount.type === 'flat') {
  //         calculatedDiscountAmount = Math.min(discount.value, data.amount)
  //       }
  //     }

  //     // Generate transaction number
  //     const transactionNumber = await this.generateTransactionNumber(folio.hotelId, trx)

  //     // Map category to particular description
  //     let particular = 'Miscellaneous Transaction'

  //     switch (data.category) {
  //       case TransactionCategory.ROOM:
  //         particular = 'Room Charge'
  //         break
  //       case TransactionCategory.FOOD_BEVERAGE:
  //         particular = 'Food & Beverage'
  //         break
  //       case TransactionCategory.TELEPHONE:
  //         particular = 'Telephone Charge'
  //         break
  //       case TransactionCategory.LAUNDRY:
  //         particular = 'Laundry Service'
  //         break
  //       case TransactionCategory.MINIBAR:
  //         particular = 'Minibar Charge'
  //         break
  //       case TransactionCategory.SPA:
  //         particular = 'Spa Service'
  //         break
  //       case TransactionCategory.BUSINESS_CENTER:
  //         particular = 'Business Center'
  //         break
  //       case TransactionCategory.PARKING:
  //         particular = 'Parking Fee'
  //         break
  //       case TransactionCategory.INTERNET:
  //         particular = 'Internet Service'
  //         break
  //       case TransactionCategory.PAYMENT:
  //         particular = 'Payment Received'
  //         break
  //       case TransactionCategory.ADJUSTMENT:
  //         particular = 'Folio Adjustment'
  //         break
  //       case TransactionCategory.TAX:
  //         particular = 'Tax Charge'
  //         break
  //       case TransactionCategory.SERVICE_CHARGE:
  //         particular = 'Service Charge'
  //         break
  //       case TransactionCategory.CANCELLATION_FEE:
  //         particular = 'Cancellation Fee'
  //         break
  //       case TransactionCategory.NO_SHOW_FEE:
  //         particular = 'No Show Fee'
  //         break
  //       case TransactionCategory.EARLY_DEPARTURE_FEE:
  //         particular = 'Early Departure Fee'
  //         break
  //       case TransactionCategory.LATE_CHECKOUT_FEE:
  //         particular = 'Late Checkout Fee'
  //         break
  //       case TransactionCategory.EXTRA_BED:
  //         particular = 'Extra Bed Charge'
  //         break
  //       case TransactionCategory.CITY_TAX:
  //         particular = 'City Tax'
  //         break
  //       case TransactionCategory.RESORT_FEE:
  //         particular = 'Resort Fee'
  //         break
  //       case TransactionCategory.TRANSFER_IN:
  //         particular = 'Transfer In'
  //         break
  //       case TransactionCategory.TRANSFER_OUT:
  //         particular = 'Transfer Out'
  //         break
  //       case TransactionCategory.VOID:
  //         particular = 'Void Transaction'
  //         break
  //       case TransactionCategory.REFUND:
  //         particular = 'Refund'
  //         break
  //       case TransactionCategory.EXTRACT_CHARGE:
  //         particular = 'Extra Charge'
  //         break
  //       default:
  //         particular = 'Miscellaneous Charge'
  //     }
  //     const totalAmount = parseFloat(`${data.quantity ?? 1}`) * parseFloat(`${data.amount}`)
  //     // Create transaction
  //     const transaction = await FolioTransaction.create({
  //       hotelId: folio.hotelId,
  //       folioId: data.folioId,
  //       reservationId: folio.reservationId ?? undefined,
  //       transactionNumber,
  //       transactionType: data.transactionType,
  //       category: data.category,
  //       particular: particular,
  //       description: data.description,
  //       amount: totalAmount,
  //       totalAmount: totalAmount,
  //       quantity: data.quantity || 1,
  //       unitPrice: data.unitPrice || data.amount,
  //       taxAmount: data.taxAmount || 0,
  //       serviceChargeAmount: data.serviceChargeAmount || 0,
  //       discountAmount: calculatedDiscountAmount,
  //       discountId: data.discountId,
  //       netAmount: data.amount - calculatedDiscountAmount,
  //       grossAmount: data.amount + (data.taxAmount || 0) + (data.serviceChargeAmount || 0),
  //       transactionCode: transactionNumber,
  //       transactionTime: DateTime.now().toISOTime(),
  //       postingDate: DateTime.now(),
  //       //departmentId: data.departmentId,
  //       //revenueCenterId: data.revenueCenterId,
  //       //costCenterId: data.costCenterId,
  //       //glAccountCode: data.glAccountCode,
  //       paymentMethodId: data.paymentMethodId,
  //       //reference: data.reference,
  //       //descriptions: data.notes,
  //       transactionDate: data.transactionDate || DateTime.now(),
  //       //businessDate: DateTime.now(),
  //       // auditDate: DateTime.now(),
  //       status: TransactionStatus.POSTED,
  //       // isPosted: true,
  //       //postedDate: DateTime.now(),
  //       //postedBy: data.postedBy,
  //       createdBy: data.postedBy,
  //       lastModifiedBy: data.postedBy
  //     }, { client: trx })

  //     // Update folio totals
  //     await this.updateFolioTotals(data.folioId, trx)

  //     return transaction
  //   })
  // }
  static async postTransaction(data: PostTransactionData, trx?: any): Promise<FolioTransaction> {
    // Si un trx est fourni, on l'utilise, sinon on crée une transaction interne
    if (trx) {
      return await this._executePostTransaction(data, trx)
    } else {
      return await db.transaction(async (internalTrx) => {
        return await this._executePostTransaction(data, internalTrx)
      })
    }
  }

  /**
   *
   * @param transactionId
   * @param data
   * @param updatedBy
   * @returns
   */
  static async updateTransaction(
    transactionId: number,
    data: Partial<PostTransactionData>,
    updatedBy: number
  ): Promise<FolioTransaction> {
    return await db.transaction(async (trx) => {
      //  Vérifier que la transaction existe
      const transaction = await FolioTransaction.findOrFail(transactionId)

      //Vérifier que le folio peut être modifié
      const folio = await Folio.findOrFail(transaction.folioId)
      if (!folio.canBeModified) {
        throw new Error('Folio cannot be modified — it is finalized or closed')
      }

      //  Préparer les valeurs de base
      const quantity = Number(data.quantity ?? transaction.quantity ?? 1)
      const amount = Number(data.amount ?? transaction.amount ?? 0)
      let calculatedDiscountAmount = Number(data.discountAmount ?? transaction.discountAmount ?? 0)

      //  Calcul du discount si discountId fourni
      if (data.discountId) {
        const discount = await Discount.findOrFail(data.discountId)

        if (discount.status !== 'active' || discount.isDeleted) {
          throw new Error('Discount is not active or has been deleted')
        }

        if (discount.type === 'percentage') {
          calculatedDiscountAmount = amount * (discount.value / 100)
        } else if (discount.type === 'flat') {
          calculatedDiscountAmount = Math.min(discount.value, amount)
        }
      }

      //  Recalcul des totaux
      const totalAmount = amount
      const targetCategory = (data.category ?? transaction.category) as TransactionCategory
      const isHotelTaxCategory = [TransactionCategory.ROOM, TransactionCategory.CANCELLATION_FEE, TransactionCategory.NO_SHOW_FEE].includes(targetCategory)
      const computedTax =
        data.taxAmount !== undefined
          ? Number(data.taxAmount)
          : isHotelTaxCategory
            ? await FolioService._getHotelTaxAmountForCategory(
              folio.hotelId,
              targetCategory,
              totalAmount
            )
            : Number(transaction.taxAmount ?? 0)
      const taxAmount = Number(
        data.taxAmount !== undefined
          ? data.taxAmount
          : isHotelTaxCategory
            ? computedTax ?? 0
            : transaction.taxAmount ?? 0
      )
      const serviceChargeAmount = Number(data.serviceChargeAmount ?? transaction.serviceChargeAmount ?? 0)
      const netAmount = totalAmount - calculatedDiscountAmount
      const grossAmount = totalAmount + taxAmount + serviceChargeAmount

      // Mise à jour des champs
      transaction.merge({
        description: data.description ?? transaction.description,
        category: data.category ?? transaction.category,
        transactionType: data.transactionType ?? transaction.transactionType,
        paymentMethodId: data.paymentMethodId ?? transaction.paymentMethodId,
        notes: data.notes ?? transaction.notes,
        discountId: data.discountId ?? transaction.discountId,
        discountAmount: calculatedDiscountAmount,
        taxAmount,
        serviceChargeAmount,
        amount,
        totalAmount,
        netAmount,
        grossAmount,
        quantity,
        unitPrice: data.unitPrice ?? transaction.unitPrice ?? amount,
        lastModifiedBy: updatedBy,
        updatedAt: DateTime.now(),
      })

      //  Sauvegarder la transaction
      await transaction.useTransaction(trx).save()

      //  Mettre à jour les totaux du folio
      await this.updateFolioTotals(folio.id, trx)

      //  Log de l’activité
      await LoggerService.logActivity(
        {
          userId: updatedBy,
          action: 'TRANSACTION_UPDATED',
          resourceType: 'FolioTransaction',
          resourceId: transaction.id,
          details: {
            transactionId: transaction.id,
            folioId: folio.id,
            updatedFields: Object.keys(data),
          },
        },
        trx
      )

      return transaction
    })
  }


  private static async _executePostTransaction(data: PostTransactionData, trx: any): Promise<FolioTransaction> {
    const folio = await Folio.findOrFail(data.folioId)
    logger.info(data)
    if (!folio.canBeModified) {
      throw new Error('Folio cannot be modified - it is finalized or closed')
    }

    let calculatedDiscountAmount = data.discountAmount || 0
    if (data.discountId) {
      const discount = await Discount.findOrFail(data.discountId)
      if (discount.status !== 'active' || discount.isDeleted) {
        throw new Error('Discount is not active or has been deleted')
      }
      if (discount.type === 'percentage') {
        calculatedDiscountAmount = data.amount * (discount.value / 100)
      } else if (discount.type === 'flat') {
        calculatedDiscountAmount = Math.min(discount.value, data.amount)
      }
    }

    const transactionNumber = await this.generateTransactionNumber(folio.hotelId, trx)

    let particular = 'Miscellaneous Transaction'
    switch (data.category) {
      case TransactionCategory.ROOM: particular = 'Room Charge'; break
      case TransactionCategory.FOOD_BEVERAGE: particular = 'Food & Beverage'; break
      case TransactionCategory.TELEPHONE: particular = 'Telephone Charge'; break
      case TransactionCategory.LAUNDRY: particular = 'Laundry Service'; break
      case TransactionCategory.MINIBAR: particular = 'Minibar Charge'; break
      case TransactionCategory.SPA: particular = 'Spa Service'; break
      case TransactionCategory.BUSINESS_CENTER: particular = 'Business Center'; break
      case TransactionCategory.PARKING: particular = 'Parking Fee'; break
      case TransactionCategory.INTERNET: particular = 'Internet Service'; break
      case TransactionCategory.PAYMENT: particular = 'Payment Received'; break
      case TransactionCategory.ADJUSTMENT: particular = 'Folio Adjustment'; break
      case TransactionCategory.TAX: particular = 'Tax Charge'; break
      case TransactionCategory.SERVICE_CHARGE: particular = 'Service Charge'; break
      case TransactionCategory.CANCELLATION_FEE: particular = 'Cancellation Fee'; break
      case TransactionCategory.NO_SHOW_FEE: particular = 'No Show Fee'; break
      case TransactionCategory.EARLY_DEPARTURE_FEE: particular = 'Early Departure Fee'; break
      case TransactionCategory.LATE_CHECKOUT_FEE: particular = 'Late Checkout Fee'; break
      case TransactionCategory.EXTRA_BED: particular = 'Extra Bed Charge'; break
      case TransactionCategory.CITY_TAX: particular = 'City Tax'; break
      case TransactionCategory.RESORT_FEE: particular = 'Resort Fee'; break
      case TransactionCategory.TRANSFER_IN: particular = 'Transfer In'; break
      case TransactionCategory.TRANSFER_OUT: particular = 'Transfer Out'; break
      case TransactionCategory.VOID: particular = 'Void Transaction'; break
      case TransactionCategory.REFUND: particular = 'Refund'; break
      case TransactionCategory.EXTRACT_CHARGE: particular = 'Extra Charge'; break
      default: particular = 'Miscellaneous Charge';
    }
    const transactionCode = generateTransactionCode();
    const grossAmount = parseFloat(`${data.quantity ?? 1}`) * parseFloat(`${data.amount}`)
    const computedTaxAmount = data.taxAmount ?? await FolioService._getHotelTaxAmountForCategory(folio.hotelId, data.category, grossAmount);
    const netAmount = grossAmount - (Number(calculatedDiscountAmount) || 0)
    const transaction = await FolioTransaction.create({
      hotelId: folio.hotelId,
      folioId: data.folioId,
      reservationId: folio.reservationId ?? undefined,
      transactionNumber,
      transactionType: data.transactionType,
      category: data.category,
      particular,
      description: data.description,
      amount: grossAmount,
      totalAmount: netAmount + (Number(computedTaxAmount) || 0) + (data.serviceChargeAmount || 0),
      quantity: data.quantity || 1,
      unitPrice: data.unitPrice || 0,
      taxAmount: Number(computedTaxAmount) || 0,
      serviceChargeAmount: data.serviceChargeAmount || 0,
      discountAmount: calculatedDiscountAmount,
      discountId: data.discountId,
      netAmount: netAmount,
      grossAmount: grossAmount,
      extraChargeId: data.extraChargeId,
      transactionCode: transactionCode,
      transactionTime: DateTime.now().toISOTime(),
      postingDate: DateTime.now(),
      paymentMethodId: data.paymentMethodId,
      transactionDate: data.transactionDate || DateTime.now(),
      status: TransactionStatus.POSTED,
      createdBy: data.postedBy,
      lastModifiedBy: data.postedBy
    }, { client: trx })

    await this.updateFolioTotals(data.folioId, trx)
    return transaction
  }

  // Compute tax amount for hotel based on category and base amount
  private static async _getHotelTaxAmountForCategory(
    hotelId: number,
    category: TransactionCategory,
    baseAmount: number
  ): Promise<number> {
    try {
      const hotel = await Hotel.query()
        .where('id', hotelId)
        .preload('roomChargesTaxRates')
        .preload('cancellationRevenueTaxRates')
        .preload('noShowRevenueTaxRates')
        .first()

      if (!hotel) return 0

      let taxRates: any[] = []
      if (category === TransactionCategory.ROOM) {
        taxRates = (hotel as any).roomChargesTaxRates ?? []
      } else if (category === TransactionCategory.CANCELLATION_FEE) {
        taxRates = (hotel as any).cancellationRevenueTaxRates ?? []
      } else if (category === TransactionCategory.NO_SHOW_FEE) {
        taxRates = (hotel as any).noShowRevenueTaxRates ?? []
      } else {
        return 0
      }

      let percentageSum = 0
      let flatSum = 0
      for (const tax of taxRates) {
        if ((tax as any)?.postingType === 'flat_percentage' && (tax as any)?.percentage) {
          percentageSum += Number((tax as any).percentage) || 0
        } else if ((tax as any)?.postingType === 'flat_amount' && (tax as any)?.amount) {
          flatSum += Number((tax as any).amount) || 0
        }
      }
      const percRate = percentageSum > 0 ? percentageSum / 100 : 0
      return baseAmount * percRate + flatSum
    } catch (err) {
      logger.warn(`Failed to compute hotel tax amount: ${String(err)}`)
      return 0
    }
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
        throw new Error('One or both folios cannot be modified' + trx)
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
      .preload('reservationRoom', (roomQuery) => {
        roomQuery.preload('room')
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

      // Validate source and destination folios are different
      if (data.sourceFolioId === data.destinationFolioId) {
        throw new Error('Source and destination folios must be different')
      }

      // Validate both folios belong to the same hotel
      if (sourceFolio.hotelId !== destinationFolio.hotelId) {
        throw new Error('Source and destination folios must belong to the same hotel')
      }

      // Validate source folio is not closed
      /*if (sourceFolio.status === FolioStatus.CLOSED) {
        throw new Error('Cannot split transactions from a closed folio')
      }*/



      // Validate transactions exist and belong to source folio
      const transactionsToMove = await FolioTransaction.query({ client: trx })
        .whereIn('id', data.transactionsToMove)
        .where('folioId', data.sourceFolioId)
      // .where('status', '!=', TransactionStatus.VOIDED)

      if (transactionsToMove.length !== data.transactionsToMove.length) {
        const foundIds = transactionsToMove.map(t => t.id)
        const missingIds = data.transactionsToMove.filter(id => !foundIds.includes(id))
        throw new Error(`Transactions with IDs [${missingIds.join(', ')}] not found in source folio or are voided`)
      }

      // Validate transactions can be moved (not settled, not voided)
      /* const unmovableTransactions = transactionsToMove.filter(t =>
       //  t.status === TransactionStatus.SETTLED ||
         t.status === TransactionStatus.VOIDED
       )

       if (unmovableTransactions.length > 0) {
         const unmovableIds = unmovableTransactions.map(t => t.id)
         throw new Error(`Transactions with IDs [${unmovableIds.join(', ')}] cannot be moved (settled or voided)`)
       }*/

      // Get existing transactions to preserve their descriptions
      const existingTransactions = await FolioTransaction.query({ client: trx })
        .whereIn('id', data.transactionsToMove)
        .select('id', 'description')

      // Transfer transactions to destination folio
      for (const transaction of existingTransactions) {
        const splitMessage = data.notes ? `Split from folio ${sourceFolio.folioNumber}: ${data.notes}` : `Split from folio ${sourceFolio.folioNumber}`
        const newDescription = transaction.description ? `${transaction.description} | ${splitMessage}` : splitMessage

        await FolioTransaction.query({ client: trx })
          .where('id', transaction.id)
          .update({
            folioId: data.destinationFolioId,
            lastModifiedBy: data.splitBy,
            updatedAt: DateTime.now(),
            description: newDescription
          })
      }

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

      // Log successful folio split operation
      await LoggerService.logActivity({
        userId: data.splitBy,
        action: 'FOLIO_SPLIT',
        resourceType: 'Folio',
        resourceId: data.sourceFolioId,
        details: {
          sourceFolioId: data.sourceFolioId,
          destinationFolioId: data.destinationFolioId,
          transactionCount: transactionsToMove.length,
          transactionIds: data.transactionsToMove,
          notes: data.notes
        }
      }, trx)

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
   * Cut a folio by creating a new folio and transferring transactions based on type flags
   */
  static async cutFolio(data: CutFolioData): Promise<{
    originalFolio: Folio
    newFolio: Folio
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
        throw new Error('Cannot cut a closed folio')
      }

      // Validate at least one transaction type is selected
      if (!data.roomCharges && !data.Payment && !data.extractCharges) {
        throw new Error('At least one transaction type must be selected for cutting')
      }

      const transactionsToTransfer: FolioTransaction[] = []

      // Collect room charges if requested
      if (data.roomCharges) {
        const roomChargeTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', data.folioId)
          .where('status', '!=', TransactionStatus.VOIDED)
          .whereIn('transactionType', [TransactionType.CHARGE])

        transactionsToTransfer.push(...roomChargeTransactions)
      }

      // Collect payments if requested
      if (data.Payment) {
        const paymentTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', data.folioId)
          .where('status', '!=', TransactionStatus.VOIDED)
          .where('transactionType', TransactionType.PAYMENT)

        transactionsToTransfer.push(...paymentTransactions)
      }

      // Collect extract charges if requested
      if (data.extractCharges) {
        const extractChargeTransactions = await FolioTransaction.query({ client: trx })
          .where('folioId', data.folioId)
          .where('status', '!=', TransactionStatus.VOIDED)
          .whereIn('category', [
            TransactionCategory.FOOD_BEVERAGE,
            TransactionCategory.SPA,
            TransactionCategory.LAUNDRY,
            TransactionCategory.MINIBAR,
            TransactionCategory.MISCELLANEOUS
          ])

        transactionsToTransfer.push(...extractChargeTransactions)
      }

      // Check if there are transactions to transfer
      if (transactionsToTransfer.length === 0) {
        throw new Error('No transactions found matching the selected criteria')
      }

      // Create new folio for cut transactions
      const typeDescriptions = []
      if (data.roomCharges) typeDescriptions.push('Room Charges')
      if (data.Payment) typeDescriptions.push('Payments')
      if (data.extractCharges) typeDescriptions.push('Extract Charges')

      const newFolio = await this.createFolio({
        hotelId: data.hotelId,
        guestId: originalFolio.guestId,
        reservationId: originalFolio.reservationId,
        folioType: originalFolio.folioType,
        folioName: `${originalFolio.folioName || 'Cut'}`,
        notes: data.notes || `Cut from folio ${originalFolio.folioNumber} - ${typeDescriptions.join(', ')}`,
        createdBy: data.cutBy
      })

      // Transfer transactions to new folio
      const transactionIds = transactionsToTransfer.map(t => t.id)
      const cutMessage = data.notes ? `Cut to folio ${newFolio.folioNumber}: ${data.notes}` : `Cut to folio ${newFolio.folioNumber}`

      // Get existing transactions to preserve their descriptions
      const existingTransactions = await FolioTransaction.query({ client: trx })
        .whereIn('id', transactionIds)
        .select('id', 'description')

      // Update transactions with new folio ID and description
      for (const transaction of existingTransactions) {
        const newDescription = transaction.description ? `${transaction.description} | ${cutMessage}` : cutMessage

        await FolioTransaction.query({ client: trx })
          .where('id', transaction.id)
          .update({
            folioId: newFolio.id,
            lastModifiedBy: data.cutBy,
            updatedAt: DateTime.now(),
            description: newDescription
          })
      }

      // Update folio totals for both folios
      await this.updateFolioTotals(data.folioId, trx)
      await this.updateFolioTotals(newFolio.id, trx)

      // Reload folios with updated totals
      const updatedOriginalFolio = await Folio.query({ client: trx })
        .where('id', data.folioId)
        .firstOrFail()

      const updatedNewFolio = await Folio.query({ client: trx })
        .where('id', newFolio.id)
        .firstOrFail()

      // Log successful folio cut operation
      await LoggerService.logActivity({
        userId: data.cutBy,
        action: 'FOLIO_CUT',
        resourceType: 'Folio',
        resourceId: data.folioId,
        details: {
          originalFolioId: data.folioId,
          newFolioId: newFolio.id,
          transactionCount: transactionsToTransfer.length,
          transactionIds: transactionIds,
          roomCharges: data.roomCharges,
          Payment: data.Payment,
          extractCharges: data.extractCharges,
          notes: data.notes
        }
      }, trx)

      return {
        originalFolio: updatedOriginalFolio,
        newFolio: updatedNewFolio,
        transferredTransactions: transactionsToTransfer
      }
    })
  }

  /**
   * Add room charge to folio
   */
  static async addRoomChargeMethod(data: {
    amount: number
    description: string
    date: DateTime
    taxInclusive: boolean
    folioId: number
    complementary: boolean
    discountId?: number
    chargeSubtype: string
    postedBy: number
  }): Promise<FolioTransaction> {
    return await db.transaction(async (trx) => {
      // Validate folio exists and can be modified
      const folio = await Folio.findOrFail(data.folioId)

      if (!folio.canBeModified) {
        throw new Error('Folio cannot be modified - it is finalized or closed')
      }

      // Validate charge subtype
      const validSubtypes = ['cancellation_revenue', 'day_user_charge', 'late_checkout_charge', 'no_show_revenue', 'room_charge']
      if (!validSubtypes.includes(data.chargeSubtype)) {
        throw new Error(`Invalid charge subtype. Must be one of: ${validSubtypes.join(', ')}`)
      }

      // Calculate amounts based on tax inclusive flag
      let baseAmount = data.amount
      let taxAmount = 0
      let discountAmount = 0

      // Apply discount if provided
      if (data.discountId) {
        const discount = await Discount.findOrFail(data.discountId)

        // Validate discount is active and applicable
        if (discount.status !== 'active' || discount.isDeleted) {
          throw new Error('Discount is not active or has been deleted')
        }

        // Check if discount applies to room charges
        if (discount.applyOn !== 'room_charge') {
          throw new Error('This discount does not apply to room charges')
        }

        // Calculate discount amount based on type
        if (discount.type === 'percentage') {
          discountAmount = baseAmount * (discount.value / 100)
        } else if (discount.type === 'flat') {
          discountAmount = Math.min(discount.value, baseAmount) // Don't exceed the base amount
        }

        baseAmount = baseAmount - discountAmount
      }

      // Calculate tax (assuming 10% tax rate for room charges)
      //TODO
      const taxRate = 0.10
      if (data.taxInclusive) {
        // Tax is included in the amount, so we need to extract it
        taxAmount = baseAmount * (taxRate / (1 + taxRate))
        baseAmount = baseAmount - taxAmount
      } else {
        // Tax is additional to the base amount
        taxAmount = baseAmount * taxRate
      }

      const totalAmount = baseAmount + taxAmount
      const netAmount = baseAmount - discountAmount
      const grossAmount = totalAmount

      // Generate transaction number
      const transactionNumber = await this.generateTransactionNumber(folio.hotelId, trx)

      // Map chargeSubtype to appropriate category and particular
      let category: TransactionCategory
      let particular: string
      switch (data.chargeSubtype) {
        case 'cancellation_revenue':
          category = TransactionCategory.ADJUSTMENT
          particular = 'Cancellation Revenue'
          break
        case 'day_user_charge':
          category = TransactionCategory.ROOM
          particular = 'Day User Charge'
          break
        case 'late_checkout_charge':
          category = TransactionCategory.ROOM
          particular = 'Late Checkout Charge'
          break
        case 'no_show_revenue':
          category = TransactionCategory.NO_SHOW_FEE
          particular = 'No Show Revenue'
          break
        case 'room_charge':
          category = TransactionCategory.ROOM
          particular = 'Room Charge'
          break
        default:
          category = TransactionCategory.MISCELLANEOUS
          particular = 'Miscellaneous Charge'
      }

      // Create room charge transaction
      const transaction = await FolioTransaction.create({
        hotelId: folio.hotelId,
        folioId: data.folioId,
        reservationId: folio.reservationId!,
        transactionNumber,
        transactionCode: transactionNumber.toString(),
        transactionType: TransactionType.CHARGE,
        category: category,
        subcategory: data.chargeSubtype,
        description: data.description,
        particular: particular,
        amount: data.complementary ? 0 : totalAmount,
        totalAmount: data.complementary ? 0 : totalAmount,
        quantity: 1,
        unitPrice: baseAmount,
        taxAmount: data.complementary ? 0 : taxAmount,
        taxRate: taxRate,
        serviceChargeAmount: 0,
        serviceChargeRate: 0,
        discountAmount: discountAmount,
        discountRate: data.discountId && discountAmount > 0 ? (discountAmount / (baseAmount + discountAmount)) : 0,
        netAmount: data.complementary ? 0 : netAmount,
        grossAmount: data.complementary ? 0 : grossAmount,
        transactionDate: DateTime.fromJSDate(data.date),
        transactionTime: '00:00:00',
        postingDate: DateTime.now(),
        serviceDate: DateTime.fromJSDate(data.date),
        complementary: data.complementary,
        compReason: data.complementary ? 'Complimentary room charge' : '',
        discountId: data.discountId,
        isTaxable: !data.complementary,
        taxExempt: data.complementary,
        taxExemptReason: data.complementary ? 'Complimentary charge' : '',
        status: TransactionStatus.POSTED,
        createdBy: data.postedBy,
        lastModifiedBy: data.postedBy
      }, { client: trx })

      // Update folio totals
      await this.updateFolioTotals(data.folioId, trx)

      // Log the room charge activity
      await LoggerService.logActivity({
        userId: data.postedBy,
        action: 'ROOM_CHARGE_ADDED',
        resourceType: 'FolioTransaction',
        resourceId: transaction.id,
        details: {
          folioId: data.folioId,
          amount: data.amount,
          chargeSubtype: data.chargeSubtype,
          complementary: data.complementary,
          description: data.description
        }
      }, trx)

      return transaction
    })
  }

  /**
   * update room charges
   */

  static async updateRoomChargeMethod(
    id: number,
    data: {
      amount?: number
      description?: string
      date?: DateTime
      taxInclusive?: boolean
      complementary?: boolean
      discountId?: number | null
      chargeSubtype?: string
      postedBy: number
    }
  ): Promise<FolioTransaction> {
    return await db.transaction(async (trx) => {


      //  Récupération de la transaction existante
      const transaction = await FolioTransaction.findOrFail(id)
      const folio = await Folio.findOrFail(transaction.folioId)


      // Vérification du folio
      if (!folio.canBeModified) {
        throw new Error('Folio cannot be modified - it is finalized or closed')
      }


      //  Validation du sous-type
      const validSubtypes = [
        'cancellation_revenue',
        'day_user_charge',
        'late_checkout_charge',
        'no_show_revenue',
        'room_charge',
      ]
      if (data.chargeSubtype && !validSubtypes.includes(data.chargeSubtype)) {
        throw new Error(`Invalid charge subtype. Must be one of: ${validSubtypes.join(', ')}`)
      }

      let baseAmount = data.amount ?? transaction.amount
      let taxAmount = 0
      let discountAmount = 0


      // 5Application de la remise (discount)
      if (data.discountId) {
        const discount = await Discount.findOrFail(data.discountId)


        if (discount.status !== 'active' || discount.isDeleted) {
          throw new Error('Discount is not active or has been deleted')
        }

        if (discount.applyOn !== 'room_charge') {
          throw new Error('This discount does not apply to room charges')
        }

        if (discount.type === 'percentage') {
          discountAmount = baseAmount * (discount.value / 100)
        } else if (discount.type === 'flat') {
          discountAmount = Math.min(discount.value, baseAmount)
        }

        baseAmount = baseAmount - discountAmount
        console.log('Discount Applied:', { discountAmount, newBaseAmount: baseAmount })
      } else {
        console.log('No discount applied')
      }
      const taxRate = 0.1
      const taxInclusive = data.taxInclusive ?? transaction.taxExempt


      if (taxInclusive) {
        taxAmount = baseAmount * (taxRate / (1 + taxRate))
        baseAmount = baseAmount - taxAmount

      } else {
        taxAmount = baseAmount * taxRate

      }

      const totalAmount = baseAmount + taxAmount
      const netAmount = baseAmount - discountAmount
      const grossAmount = totalAmount


      //  Mapping du sous-type
      let category = transaction.category
      let particular = transaction.particular

      if (data.chargeSubtype) {
        switch (data.chargeSubtype) {
          case 'cancellation_revenue':
            category = TransactionCategory.ADJUSTMENT
            particular = 'Cancellation Revenue'
            break
          case 'day_user_charge':
            category = TransactionCategory.ROOM
            particular = 'Day User Charge'
            break
          case 'late_checkout_charge':
            category = TransactionCategory.ROOM
            particular = 'Late Checkout Charge'
            break
          case 'no_show_revenue':
            category = TransactionCategory.NO_SHOW_FEE
            particular = 'No Show Revenue'
            break
          case 'room_charge':
            category = TransactionCategory.ROOM
            particular = 'Room Charge'
            break
          default:
            category = TransactionCategory.MISCELLANEOUS
            particular = 'Miscellaneous Charge'
        }

      }

      //  Mise à jour de la transaction
      transaction.merge({
        description: data.description ?? transaction.description,
        category,
        subcategory: data.chargeSubtype ?? transaction.subcategory,
        particular,
        amount: totalAmount,
        totalAmount: totalAmount,
        unitPrice: baseAmount,
        taxAmount: taxAmount,
        taxRate,
        discountAmount,
        discountRate: discountAmount > 0 ? discountAmount / (baseAmount + discountAmount) : 0,
        netAmount: netAmount,
        grossAmount: grossAmount,
        transactionDate: data.date ?? transaction.transactionDate,
        postingDate: DateTime.now(),
        complementary: data.complementary ?? transaction.complementary,
        compReason: data.complementary ? 'Complimentary room charge' : '',
        discountId: data.discountId ?? null,
        lastModifiedBy: data.postedBy,
      })

      console.log(' Transaction Merged Values:', transaction.serialize())

      transaction.useTransaction(trx)
      await transaction.save()

      await this.updateFolioTotals(folio.id, trx)

      //  Log d’activité
      await LoggerService.logActivity(
        {
          userId: data.postedBy,
          action: 'ROOM_CHARGE_UPDATED',
          resourceType: 'FolioTransaction',
          resourceId: transaction.id,
          details: {
            folioId: folio.id,
            newAmount: data.amount,
            chargeSubtype: data.chargeSubtype,
            complementary: data.complementary,
            description: data.description,
          },
        },
        trx
      )
      return transaction
    })
  }


  /**
   * Add folio adjustment
   */
  static async addFolioAdjustment(data: {
    folioId: number
    reservationId?: number
    hotelId: number
    type: string
    amount: number
    comment: string
    date: Date
    postedBy: number
  }): Promise<FolioTransaction> {
    return await db.transaction(async (trx) => {
      // Validate folio exists and can be modified
      const folio = await Folio.findOrFail(data.folioId)

      if (!folio.canBeModified) {
        throw new Error('Folio cannot be modified - it is finalized or closed')
      }

      // Generate transaction number
      const transactionNumber = await this.generateTransactionNumber(folio.hotelId, trx)

      // Map category to particular
      let category: TransactionCategory
      let particular: string

      category = TransactionCategory.ADJUSTMENT
      particular = data.type


      // Create adjustment transaction
      const transaction = await FolioTransaction.create({
        hotelId: folio.hotelId,
        folioId: data.folioId,
        reservationId: data.reservationId!,
        transactionNumber,
        transactionCode: transactionNumber.toString(),
        transactionType: TransactionType.ADJUSTMENT,
        category: category,
        subcategory: 'adjustment',
        description: data.comment,
        particular: particular,
        amount: data.amount,
        totalAmount: data.amount,
        quantity: 1,
        unitPrice: data.amount,
        taxAmount: 0,
        taxRate: 0,
        serviceChargeAmount: 0,
        serviceChargeRate: 0,
        discountAmount: 0,
        discountRate: 0,
        netAmount: data.amount,
        grossAmount: data.amount,
        transactionDate: DateTime.fromJSDate(data.date),
        transactionTime: '00:00:00',
        postingDate: DateTime.now(),
        serviceDate: DateTime.fromJSDate(data.date),
        status: TransactionStatus.POSTED,
        createdBy: data.postedBy,
        lastModifiedBy: data.postedBy

      }, { client: trx })

      // Update folio totals
      await this.updateFolioTotals(data.folioId, trx)

      // Log the adjustment activity
      await LoggerService.logActivity({
        userId: data.postedBy,
        action: 'FOLIO_ADJUSTMENT_ADDED',
        resourceType: 'FolioTransaction',
        resourceId: transaction.id,
        details: {
          folioId: data.folioId,
          type: data.type,
          amount: data.amount,
          particular: particular,
          comment: data.comment
        }
      }, trx)

      return transaction
    })
  }


  /**
* update folio adjustement
*/

  static async updateFolioAdjustment(
    adjustmentId: number,
    data: {
      type?: string
      amount?: number
      comment?: string
      date?: Date
      postedBy: number
    }
  ): Promise<FolioTransaction> {
    return await db.transaction(async (trx) => {


      // Vérifier que la transaction existe
      const transaction = await FolioTransaction.findOrFail(adjustmentId)

      if (transaction.transactionType !== TransactionType.ADJUSTMENT) {
        throw new Error('Transaction is not an adjustment type')
      }

      // Vérifier que le folio peut être modifié
      const folio = await Folio.findOrFail(transaction.folioId)
      if (!folio.canBeModified) {
        throw new Error('Folio cannot be modified — it is finalized or closed')
      }

      // Mettre à jour les champs principaux
      if (data.type !== undefined) {
        transaction.particular = data.type
        transaction.category = TransactionCategory.ADJUSTMENT
        console.log('💡 Champ type mis à jour:', data.type)
      }

      if (data.amount !== undefined) {
        const newAmount = Number(data.amount)
        transaction.amount = newAmount
        transaction.totalAmount = newAmount
        transaction.unitPrice = newAmount
        transaction.netAmount = newAmount
        transaction.grossAmount = newAmount
        console.log('💡 Montant mis à jour:', newAmount)
      }

      if (data.comment !== undefined) {
        transaction.description = data.comment
      }
      if (data.date) {
        const luxonDate = DateTime.fromISO(data.date)
        if (!luxonDate.isValid) {
          throw new Error('Date invalide reçue pour transaction')
        }
        transaction.transactionDate = luxonDate
        transaction.serviceDate = luxonDate

      }
      // Mettre à jour les métadonnées
      transaction.lastModifiedBy = data.postedBy
      transaction.updatedAt = DateTime.now()

      // Sauvegarder la transaction
      await transaction.useTransaction(trx).save()

      // Mettre à jour les totaux du folio
      await this.updateFolioTotals(transaction.folioId, trx)

      await LoggerService.logActivity(
        {
          userId: data.postedBy,
          action: 'FOLIO_ADJUSTMENT_UPDATED',
          resourceType: 'FolioTransaction',
          resourceId: transaction.id,
          details: {
            folioId: transaction.folioId,
            adjustmentId: transaction.id,
            updatedFields: Object.keys(data),
          },
        },
        trx
      )
      return transaction
    })
  }


  /**
   * Generate unique folio number
   */
  private static async generateFolioNumber(hotelId: number, trx?: TransactionClientContract, reservationRoomId?: number): Promise<string> {
    // Use a more robust approach to ensure uniqueness
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      let query = Folio.query({ client: trx })
        .where('hotelId', hotelId)

      // If we have a reservation room ID, look for folios with the same pattern
      if (reservationRoomId) {
        query = query.where('folioNumber', 'like', `F-${hotelId}-${reservationRoomId}-%`)
      }

      const lastFolio = await query
        .orderBy('id', 'desc')
        .first()

      let nextNumber = 1

      if (lastFolio && lastFolio.folioNumber) {
        // Handle both old format F-hotelId-number and new format F-hotelId-roomId-number
        const oldFormatMatch = lastFolio.folioNumber.match(/^F-(\d+)-(\d+)$/)
        const newFormatMatch = lastFolio.folioNumber.match(/^F-(\d+)-(\d+)-(\d+)$/)

        if (newFormatMatch) {
          nextNumber = parseInt(newFormatMatch[3]) + 1
        } else if (oldFormatMatch) {
          nextNumber = parseInt(oldFormatMatch[2]) + 1
        }
      }

      // Include reservation room ID in folio number if available to ensure uniqueness
      const candidateNumber = reservationRoomId
        ? `F-${hotelId}-${reservationRoomId}-${nextNumber.toString().padStart(6, '0')}`
        : `F-${hotelId}-${nextNumber.toString().padStart(8, '0')}`

      // Check if this number already exists
      const existingFolio = await Folio.query({ client: trx })
        .where('folioNumber', candidateNumber)
        .first()

      if (!existingFolio) {
        return candidateNumber
      }

      attempts++
      // Add a small delay to reduce contention
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Fallback: use timestamp-based number if we can't find a unique sequential number
    const timestamp = Date.now()
    return reservationRoomId
      ? `F${hotelId}${reservationRoomId}-${timestamp.toString().padStart(6, '0')}`
      : `F${hotelId}-${timestamp.toString().padStart(8, '0')}`

  }

  /**
   * Generate unique transaction number
   */
  private static async generateTransactionNumber(hotelId: number, trx?: TransactionClientContract, next?: number): Promise<number> {
    const query = FolioTransaction.query({ client: trx })
      .where('hotelId', hotelId)
      .orderBy('transactionNumber', 'desc')
      .first()

    const lastTransaction = await query
    let nextNumber = 1

    if (lastTransaction && lastTransaction.transactionNumber) {
      nextNumber = Number(`${lastTransaction.transactionNumber}`) + 1 + (next ?? 0)
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
        totalCharges += parseFloat(`${transaction.totalAmount}`) || 0
      } else if (transaction.transactionType === TransactionType.PAYMENT) {
        totalPayments += Math.abs(parseFloat(`${transaction.totalAmount}`) || 0)
      } else if (transaction.transactionType === TransactionType.ADJUSTMENT) {
        totalAdjustments += parseFloat(`${transaction.totalAmount}`) || 0
      } else if (transaction.transactionType === TransactionType.TRANSFER) {
        // Treat transfer-in as charge (debit), transfer-out as payment (credit)
        if (transaction.category === TransactionCategory.TRANSFER_IN) {
          totalCharges += parseFloat(`${transaction.totalAmount}`) || 0
        } else if (transaction.category === TransactionCategory.TRANSFER_OUT) {
          totalPayments += Math.abs(parseFloat(`${transaction.totalAmount}`) || 0)
        }
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
